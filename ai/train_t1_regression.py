"""
train_t1_regression.py - Comprehensive T+1 Regression Orchestrator for Nirmaan Drishti.

Implements:
1. Chronological T -> T+1 data loading and transition gap diagnostics.
2. Schedule Regression:
   - Direct Formulation: predict future_delay_months(T+1)
   - Delta Formulation: predict delta_delay(T) with persistence anchor
   - Comparison and selection of winning formulation on Validation set alone
3. Unified Scale-Invariant Cost Architecture:
   - Predict T+1 Cost Multiplier = anticipated_cost_cr(T+1) / original_cost_cr(T)
   - Derived Future Cost = Multiplier * original_cost_cr(T)
   - Derived Cost Overrun % = (Multiplier - 1.0) * 100
4. Evaluates 8 Candidate Models per target:
   - Persistence Baseline
   - Linear Regression
   - Ridge Regression
   - Random Forest Regressor
   - HistGradientBoostingRegressor
   - CatBoost Regressor
   - XGBoost Regressor
   - Chronological Stacking Regressor (with TimeSeriesSplit out-of-fold meta-training)
5. Comprehensive Metrics:
   - R², MAE, RMSE, MedAE, P50, P75, P90, P95, P99, Mean Bias Error, Explained Variance
6. Model Selection on Validation using balanced composite score across bulk and tail errors.
7. Unseen Holdout Test Evaluation and side-by-side comparison against historical Nirmaan benchmarks:
   - Schedule benchmark: R² = 0.9331, MAE = 3.97, RMSE = 11.60
   - Cost benchmark: R² = 0.8862, MAE = 424.55 Cr, RMSE = 1891.13 Cr
8. Artifact Serialization:
   - Model comparison CSV
   - Validation & Test predictions (Parquet)
   - Regression metrics (JSON)
   - Selected production models & preprocessors under ai/models/
   - Feature importances under ai/models/shap/
   - Updated model_metadata.json
"""

import sys
import os
import json
import time
from pathlib import Path
from typing import Dict, Any, Tuple, List

import numpy as np
import pandas as pd
import joblib

from sklearn.base import BaseEstimator, RegressorMixin, clone
from sklearn.linear_model import LinearRegression, Ridge
from sklearn.ensemble import RandomForestRegressor, HistGradientBoostingRegressor
from sklearn.model_selection import TimeSeriesSplit
from sklearn.metrics import (
    r2_score, mean_absolute_error, root_mean_squared_error,
    median_absolute_error, explained_variance_score
)
from xgboost import XGBRegressor
from catboost import CatBoostRegressor

# Configure paths
ROOT_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT_DIR))
sys.path.insert(0, str(ROOT_DIR / "ai"))

from ai.src.t1_pipeline import (
    load_canonical_trajectory_data,
    add_t1_dynamic_physics_features,
    construct_t1_regression_targets,
    apply_chronological_splits,
    get_t1_feature_definitions,
    build_t1_preprocessor,
    get_preprocessor_feature_names,
    assert_zero_leakage,
    ChronologicalStackingRegressor,
)

RESULTS_DIR = ROOT_DIR / "results"
PREDICTIONS_DIR = RESULTS_DIR / "predictions"
METRICS_DIR = RESULTS_DIR / "metrics"
MODELS_DIR = ROOT_DIR / "ai" / "models"
SHAP_DIR = MODELS_DIR / "shap"

PREDICTIONS_DIR.mkdir(parents=True, exist_ok=True)
METRICS_DIR.mkdir(parents=True, exist_ok=True)
SHAP_DIR.mkdir(parents=True, exist_ok=True)


def evaluate_regression_metrics(y_true: np.ndarray, y_pred: np.ndarray) -> Dict[str, float]:
    """
    Computes complete suite of regression metrics:
    R², MAE, RMSE, MedAE, P50, P75, P90, P95, P99, Mean Bias Error, Explained Variance.
    """
    mask = ~np.isnan(y_true) & ~np.isnan(y_pred)
    yt = y_true[mask]
    yp = y_pred[mask]

    if len(yt) < 2:
        return {
            "R2": 0.0, "MAE": 0.0, "RMSE": 0.0, "MedAE": 0.0,
            "P50": 0.0, "P75": 0.0, "P90": 0.0, "P95": 0.0, "P99": 0.0,
            "Mean_Bias": 0.0, "Explained_Variance": 0.0
        }

    abs_errors = np.abs(yt - yp)

    return {
        "R2": round(float(r2_score(yt, yp)), 4),
        "MAE": round(float(mean_absolute_error(yt, yp)), 4),
        "RMSE": round(float(root_mean_squared_error(yt, yp)), 4),
        "MedAE": round(float(median_absolute_error(yt, yp)), 4),
        "P50": round(float(np.percentile(abs_errors, 50)), 4),
        "P75": round(float(np.percentile(abs_errors, 75)), 4),
        "P90": round(float(np.percentile(abs_errors, 90)), 4),
        "P95": round(float(np.percentile(abs_errors, 95)), 4),
        "P99": round(float(np.percentile(abs_errors, 99)), 4),
        "Mean_Bias": round(float(np.mean(yp - yt)), 4),
        "Explained_Variance": round(float(explained_variance_score(yt, yp)), 4),
    }


def main():
    print("=" * 80)
    print("NIRMAAN DRISHTI: T+1 REGRESSION LAYER RETRAINING & BENCHMARKING")
    print("=" * 80)
    start_total = time.time()

    # 1. Load Data
    print("\n[Step 1/7] Loading canonical trajectory panel...")
    df_raw = load_canonical_trajectory_data()
    print(f"Raw observations: {len(df_raw):,} rows across {df_raw['effective_project_key'].nunique():,} projects.")

    # 2. Enrich dynamic physics features
    print("\n[Step 2/7] Enriching physics-informed features strictly at time T...")
    df_enriched = add_t1_dynamic_physics_features(df_raw)

    # 3. Construct continuous regression targets & gap diagnostics
    print("\n[Step 3/7] Constructing T+1 continuous targets & performing gap analysis...")
    df_usable, gap_stats = construct_t1_regression_targets(df_enriched)
    print(f"Usable observations with valid T+1: {len(df_usable):,} rows across {gap_stats['projects_retained']:,} projects.")
    print(f"Terminal records dropped: {gap_stats['rows_dropped']:,}")
    print("\nTransition Gap Breakdown:")
    print(f"  Exact 1 calendar month: {gap_stats['gap_analysis']['exact_1m_count']:,} ({gap_stats['gap_analysis']['exact_1m_pct']}%)")
    print(f"  Multi-month transitions: {gap_stats['gap_analysis']['multi_month_count']:,} ({gap_stats['gap_analysis']['multi_month_pct']}%)")
    print(f"    - 2 to 3 months: {gap_stats['gap_analysis']['gap_2_3m_count']:,} ({gap_stats['gap_analysis']['gap_2_3m_pct']}%)")
    print(f"    - 4 to 6 months: {gap_stats['gap_analysis']['gap_4_6m_count']:,} ({gap_stats['gap_analysis']['gap_4_6m_pct']}%)")
    print(f"    - 7 to 12 months: {gap_stats['gap_analysis']['gap_7_12m_count']:,} ({gap_stats['gap_analysis']['gap_7_12m_pct']}%)")
    print(f"    - > 12 months: {gap_stats['gap_analysis']['gap_gt_12m_count']:,} ({gap_stats['gap_analysis']['gap_gt_12m_pct']}%)")

    # 4. Strict Chronological Partitioning by Observation Date T
    print("\n[Step 4/7] Applying strict chronological temporal partitioning by observation date T...")
    df_train, df_val, df_test, df_inf = apply_chronological_splits(df_usable)
    print(f"  Train Split (T <= 2022-12-01)        : {len(df_train):,} rows ({df_train['effective_project_key'].nunique():,} projects)")
    print(f"  Val Split   (2023-01-01 <= T <= 2024-06-01): {len(df_val):,} rows ({df_val['effective_project_key'].nunique():,} projects)")
    print(f"  Test Split  (2024-07-01 <= T <= 2026-04-01): {len(df_test):,} rows ({df_test['effective_project_key'].nunique():,} projects)")
    print(f"  Inference   (T >= 2026-05-01)        : {len(df_inf):,} rows")

    # 5. Extract Feature Matrix & Verify Zero Leakage
    cat_cols, num_cols = get_t1_feature_definitions()
    all_feature_cols = cat_cols + num_cols
    assert_zero_leakage(all_feature_cols)
    print(f"\nTotal verified features: {len(all_feature_cols)} ({len(cat_cols)} categorical, {len(num_cols)} numerical). Zero leakage verified.")

    # 6. Fit Preprocessor SOLELY on Training Data
    print("\nFitting ColumnTransformer preprocessor strictly on Training data...")
    preprocessor = build_t1_preprocessor(cat_cols, num_cols)
    preprocessor.fit(df_train[all_feature_cols])

    X_train = preprocessor.transform(df_train[all_feature_cols])
    X_val = preprocessor.transform(df_val[all_feature_cols])
    X_test = preprocessor.transform(df_test[all_feature_cols])
    transformed_feature_names = get_preprocessor_feature_names(preprocessor, cat_cols, num_cols)
    print(f"Transformed matrix shape: Train={X_train.shape}, Val={X_val.shape}, Test={X_test.shape}")

    # Data arrays for Schedule
    curr_delay_tr = df_train["schedule_extension_months"].fillna(0.0).values
    curr_delay_val = df_val["schedule_extension_months"].fillna(0.0).values
    curr_delay_te = df_test["schedule_extension_months"].fillna(0.0).values

    # Schedule Direct Target: y(T+1)
    y_del_direct_tr = df_train["future_delay_months"].fillna(0.0).values
    y_del_direct_val = df_val["future_delay_months"].fillna(0.0).values
    y_del_direct_te = df_test["future_delay_months"].fillna(0.0).values

    # Schedule Delta Target: y(T+1) - y(T)
    y_del_delta_tr = df_train["target_delta_delay_months"].fillna(0.0).values
    y_del_delta_val = df_val["target_delta_delay_months"].fillna(0.0).values
    y_del_delta_te = df_test["target_delta_delay_months"].fillna(0.0).values

    # Data arrays for Cost Multiplier
    cost_mask_tr = df_train["target_cost_multiplier"].notna() & (df_train["original_cost_cr"] > 0)
    cost_mask_val = df_val["target_cost_multiplier"].notna() & (df_val["original_cost_cr"] > 0)
    cost_mask_te = df_test["target_cost_multiplier"].notna() & (df_test["original_cost_cr"] > 0)

    X_tr_cost = X_train[cost_mask_tr]
    X_val_cost = X_val[cost_mask_val]
    X_te_cost = X_test[cost_mask_te]

    # Clip training multiplier to [0.5, 10.0] to prevent extreme reporting typos from distorting gradient models
    y_mult_tr = np.clip(df_train.loc[cost_mask_tr, "target_cost_multiplier"].values, 0.5, 10.0)
    y_mult_val = df_val.loc[cost_mask_val, "target_cost_multiplier"].values
    y_mult_te = df_test.loc[cost_mask_te, "target_cost_multiplier"].values

    orig_cost_val = df_val.loc[cost_mask_val, "original_cost_cr"].values
    orig_cost_te = df_test.loc[cost_mask_te, "original_cost_cr"].values

    y_antic_val = df_val.loc[cost_mask_val, "future_anticipated_cost"].values
    y_antic_te = df_test.loc[cost_mask_te, "future_anticipated_cost"].values

    # Persistence baselines
    pers_del_val = curr_delay_val
    pers_del_te = curr_delay_te

    curr_antic_tr = df_train.loc[cost_mask_tr, "anticipated_cost_cr"].fillna(df_train.loc[cost_mask_tr, "original_cost_cr"]).values
    curr_antic_val = df_val.loc[cost_mask_val, "anticipated_cost_cr"].fillna(df_val.loc[cost_mask_val, "original_cost_cr"]).values
    curr_antic_te = df_test.loc[cost_mask_te, "anticipated_cost_cr"].fillna(df_test.loc[cost_mask_te, "original_cost_cr"]).values

    pers_mult_val = curr_antic_val / np.maximum(1.0, orig_cost_val)
    pers_mult_te = curr_antic_te / np.maximum(1.0, orig_cost_te)

    comparison_records = []
    val_pred_dict = {
        "report_month": df_val["report_month"].values,
        "effective_project_key": df_val["effective_project_key"].values,
        "curr_schedule_delay": curr_delay_val,
        "actual_future_delay": y_del_direct_val,
    }
    test_pred_dict = {
        "report_month": df_test["report_month"].values,
        "effective_project_key": df_test["effective_project_key"].values,
        "curr_schedule_delay": curr_delay_te,
        "actual_future_delay": y_del_direct_te,
    }

    # =========================================================================
    # PART 1: SCHEDULE REGRESSION (DIRECT VS DELTA + PERSISTENCE ANCHOR)
    # =========================================================================
    print("\n" + "=" * 80)
    print("PART 1: SCHEDULE REGRESSION EXPERIMENTATION (DIRECT VS DELTA)")
    print("=" * 80)

    # Persistence Baseline
    m_p_val = evaluate_regression_metrics(y_del_direct_val, pers_del_val)
    m_p_te = evaluate_regression_metrics(y_del_direct_te, pers_del_te)
    comparison_records.append({
        "target": "Schedule Delay (Months)", "formulation": "Persistence Baseline",
        "model": "Persistence", **{f"val_{k.lower()}": v for k, v in m_p_val.items()},
        **{f"test_{k.lower()}": v for k, v in m_p_te.items()}, "fit_time_s": 0.0
    })
    val_pred_dict["sched_pred_persistence"] = pers_del_val
    test_pred_dict["sched_pred_persistence"] = pers_del_te

    # Define base estimators generator
    def get_candidate_models():
        return {
            "Linear Regression": LinearRegression(),
            "Ridge Regression": Ridge(alpha=10.0, random_state=42),
            "Random Forest": RandomForestRegressor(n_estimators=100, max_depth=14, max_samples=0.7, n_jobs=-1, random_state=42),
            "HistGradientBoosting": HistGradientBoostingRegressor(max_iter=150, max_depth=8, learning_rate=0.05, random_state=42),
            "CatBoost": CatBoostRegressor(iterations=300, depth=6, learning_rate=0.05, thread_count=-1, random_seed=42, verbose=0),
            "XGBoost": XGBRegressor(n_estimators=300, max_depth=6, learning_rate=0.04, subsample=0.85, colsample_bytree=0.85, n_jobs=-1, random_state=42),
        }

    # 1. Evaluate Direct Formulation: Model predicts Delay(T+1) directly
    print("\n--- Evaluating Schedule Formulation A: Direct T+1 Future Delay ---")
    direct_models = get_candidate_models()
    direct_val_results = {}
    direct_fitted_models = {}

    for name, model in direct_models.items():
        t0 = time.time()
        print(f"  Training Direct Model: {name}...")
        model.fit(X_train, y_del_direct_tr)
        t_fit = round(time.time() - t0, 2)
        direct_fitted_models[name] = model

        pred_val = np.maximum(0.0, model.predict(X_val))
        pred_te = np.maximum(0.0, model.predict(X_test))

        m_val = evaluate_regression_metrics(y_del_direct_val, pred_val)
        m_te = evaluate_regression_metrics(y_del_direct_te, pred_te)
        direct_val_results[name] = (m_val, m_te, t_fit, pred_val, pred_te)

        comparison_records.append({
            "target": "Schedule Delay (Months)", "formulation": "Direct T+1",
            "model": name, **{f"val_{k.lower()}": v for k, v in m_val.items()},
            **{f"test_{k.lower()}": v for k, v in m_te.items()}, "fit_time_s": t_fit
        })
        val_pred_dict[f"sched_direct_{name.replace(' ', '_').lower()}"] = pred_val
        test_pred_dict[f"sched_direct_{name.replace(' ', '_').lower()}"] = pred_te
        print(f"    Val : R²={m_val['R2']:+.4f} | MAE={m_val['MAE']:.2f} mo | RMSE={m_val['RMSE']:.2f} mo | P90={m_val['P90']:.2f} mo | P95={m_val['P95']:.2f} mo")
        print(f"    Test: R²={m_te['R2']:+.4f} | MAE={m_te['MAE']:.2f} mo | RMSE={m_te['RMSE']:.2f} mo | P90={m_te['P90']:.2f} mo | P95={m_te['P95']:.2f} mo")

    # Stacking Regressor for Direct Formulation
    print("  Training Direct Stacking Regressor (Chronological TimeSeriesSplit)...")
    t0 = time.time()
    stack_direct = ChronologicalStackingRegressor(
        estimators=[
            ('ridge', Ridge(alpha=10.0, random_state=42)),
            ('rf', RandomForestRegressor(n_estimators=60, max_depth=12, max_samples=0.5, n_jobs=-1, random_state=42)),
            ('hgb', HistGradientBoostingRegressor(max_iter=100, max_depth=6, random_state=42)),
            ('xgb', XGBRegressor(n_estimators=150, max_depth=6, learning_rate=0.05, n_jobs=-1, random_state=42)),
            ('cat', CatBoostRegressor(iterations=150, depth=6, learning_rate=0.06, thread_count=-1, random_seed=42, verbose=0)),
        ],
        final_estimator=Ridge(alpha=1.0),
        n_splits=3
    )
    stack_direct.fit(X_train, y_del_direct_tr)
    t_stack_dir = round(time.time() - t0, 2)
    pred_val_sd = np.maximum(0.0, stack_direct.predict(X_val))
    pred_te_sd = np.maximum(0.0, stack_direct.predict(X_test))
    m_val_sd = evaluate_regression_metrics(y_del_direct_val, pred_val_sd)
    m_te_sd = evaluate_regression_metrics(y_del_direct_te, pred_te_sd)
    direct_val_results["Stacking Regressor"] = (m_val_sd, m_te_sd, t_stack_dir, pred_val_sd, pred_te_sd)
    direct_fitted_models["Stacking Regressor"] = stack_direct
    comparison_records.append({
        "target": "Schedule Delay (Months)", "formulation": "Direct T+1",
        "model": "Stacking Regressor", **{f"val_{k.lower()}": v for k, v in m_val_sd.items()},
        **{f"test_{k.lower()}": v for k, v in m_te_sd.items()}, "fit_time_s": t_stack_dir
    })
    val_pred_dict["sched_direct_stacking"] = pred_val_sd
    test_pred_dict["sched_direct_stacking"] = pred_te_sd
    print(f"    Val : R²={m_val_sd['R2']:+.4f} | MAE={m_val_sd['MAE']:.2f} mo | RMSE={m_val_sd['RMSE']:.2f} mo | P90={m_val_sd['P90']:.2f} mo")
    print(f"    Test: R²={m_te_sd['R2']:+.4f} | MAE={m_te_sd['MAE']:.2f} mo | RMSE={m_te_sd['RMSE']:.2f} mo | P90={m_te_sd['P90']:.2f} mo")

    # 2. Evaluate Delta Formulation: Model predicts Δ(T) with Persistence Anchor
    print("\n--- Evaluating Schedule Formulation B: Delta Delay + Persistence Anchor ---")
    delta_models = get_candidate_models()
    delta_val_results = {}
    delta_fitted_models = {}

    for name, model in delta_models.items():
        t0 = time.time()
        print(f"  Training Delta Model: {name}...")
        model.fit(X_train, y_del_delta_tr)
        t_fit = round(time.time() - t0, 2)
        delta_fitted_models[name] = model

        # Anchored direct delay: Delay(T) + max(0, Δ)
        pred_delta_val = model.predict(X_val)
        pred_delta_te = model.predict(X_test)

        pred_val_anchored = np.maximum(0.0, curr_delay_val + np.maximum(0.0, pred_delta_val))
        pred_te_anchored = np.maximum(0.0, curr_delay_te + np.maximum(0.0, pred_delta_te))

        m_val = evaluate_regression_metrics(y_del_direct_val, pred_val_anchored)
        m_te = evaluate_regression_metrics(y_del_direct_te, pred_te_anchored)
        delta_val_results[name] = (m_val, m_te, t_fit, pred_val_anchored, pred_te_anchored)

        comparison_records.append({
            "target": "Schedule Delay (Months)", "formulation": "Delta + Anchor",
            "model": name, **{f"val_{k.lower()}": v for k, v in m_val.items()},
            **{f"test_{k.lower()}": v for k, v in m_te.items()}, "fit_time_s": t_fit
        })
        val_pred_dict[f"sched_delta_{name.replace(' ', '_').lower()}"] = pred_val_anchored
        test_pred_dict[f"sched_delta_{name.replace(' ', '_').lower()}"] = pred_te_anchored
        print(f"    Val : R²={m_val['R2']:+.4f} | MAE={m_val['MAE']:.2f} mo | RMSE={m_val['RMSE']:.2f} mo | P90={m_val['P90']:.2f} mo | P95={m_val['P95']:.2f} mo")
        print(f"    Test: R²={m_te['R2']:+.4f} | MAE={m_te['MAE']:.2f} mo | RMSE={m_te['RMSE']:.2f} mo | P90={m_te['P90']:.2f} mo | P95={m_te['P95']:.2f} mo")

    # Stacking Regressor for Delta Formulation
    print("  Training Delta Stacking Regressor (Chronological TimeSeriesSplit)...")
    t0 = time.time()
    stack_delta = ChronologicalStackingRegressor(
        estimators=[
            ('ridge', Ridge(alpha=10.0, random_state=42)),
            ('rf', RandomForestRegressor(n_estimators=60, max_depth=12, max_samples=0.5, n_jobs=-1, random_state=42)),
            ('hgb', HistGradientBoostingRegressor(max_iter=100, max_depth=6, random_state=42)),
            ('xgb', XGBRegressor(n_estimators=150, max_depth=6, learning_rate=0.05, n_jobs=-1, random_state=42)),
            ('cat', CatBoostRegressor(iterations=150, depth=6, learning_rate=0.06, thread_count=-1, random_seed=42, verbose=0)),
        ],
        final_estimator=Ridge(alpha=1.0),
        n_splits=3
    )
    stack_delta.fit(X_train, y_del_delta_tr)
    t_stack_del = round(time.time() - t0, 2)
    pred_val_d_del = stack_delta.predict(X_val)
    pred_te_d_del = stack_delta.predict(X_test)
    pred_val_del_anchored = np.maximum(0.0, curr_delay_val + np.maximum(0.0, pred_val_d_del))
    pred_te_del_anchored = np.maximum(0.0, curr_delay_te + np.maximum(0.0, pred_te_d_del))

    m_val_s_del = evaluate_regression_metrics(y_del_direct_val, pred_val_del_anchored)
    m_te_s_del = evaluate_regression_metrics(y_del_direct_te, pred_te_del_anchored)
    delta_val_results["Stacking Regressor"] = (m_val_s_del, m_te_s_del, t_stack_del, pred_val_del_anchored, pred_te_del_anchored)
    delta_fitted_models["Stacking Regressor"] = stack_delta
    comparison_records.append({
        "target": "Schedule Delay (Months)", "formulation": "Delta + Anchor",
        "model": "Stacking Regressor", **{f"val_{k.lower()}": v for k, v in m_val_s_del.items()},
        **{f"test_{k.lower()}": v for k, v in m_te_s_del.items()}, "fit_time_s": t_stack_del
    })
    val_pred_dict["sched_delta_stacking"] = pred_val_del_anchored
    test_pred_dict["sched_delta_stacking"] = pred_te_del_anchored
    print(f"    Val : R²={m_val_s_del['R2']:+.4f} | MAE={m_val_s_del['MAE']:.2f} mo | RMSE={m_val_s_del['RMSE']:.2f} mo | P90={m_val_s_del['P90']:.2f} mo")
    print(f"    Test: R²={m_te_s_del['R2']:+.4f} | MAE={m_te_s_del['MAE']:.2f} mo | RMSE={m_te_s_del['RMSE']:.2f} mo | P90={m_te_s_del['P90']:.2f} mo")

    # 3. Schedule Formulation & Production Model Selection on Validation
    print("\n--- Schedule Formulation & Model Selection on Validation Set ---")
    sched_candidates = []
    for model_name, (m_val, m_te, t_fit, _, _) in direct_val_results.items():
        sched_candidates.append({
            "formulation": "Direct T+1", "model": model_name,
            "val_mae": m_val["MAE"], "val_rmse": m_val["RMSE"],
            "val_p90": m_val["P90"], "val_p95": m_val["P95"], "val_r2": m_val["R2"]
        })
    for model_name, (m_val, m_te, t_fit, _, _) in delta_val_results.items():
        sched_candidates.append({
            "formulation": "Delta + Anchor", "model": model_name,
            "val_mae": m_val["MAE"], "val_rmse": m_val["RMSE"],
            "val_p90": m_val["P90"], "val_p95": m_val["P95"], "val_r2": m_val["R2"]
        })
    df_sched_cand = pd.DataFrame(sched_candidates)

    # Multi-metric rank on Validation
    df_sched_cand["rank_mae"] = df_sched_cand["val_mae"].rank()
    df_sched_cand["rank_rmse"] = df_sched_cand["val_rmse"].rank()
    df_sched_cand["rank_p90"] = df_sched_cand["val_p90"].rank()
    df_sched_cand["rank_p95"] = df_sched_cand["val_p95"].rank()
    df_sched_cand["rank_r2"] = (-df_sched_cand["val_r2"]).rank()
    df_sched_cand["composite_score"] = (
        df_sched_cand["rank_mae"] +
        df_sched_cand["rank_rmse"] +
        df_sched_cand["rank_p90"] +
        df_sched_cand["rank_p95"] +
        df_sched_cand["rank_r2"]
    )
    df_sched_cand = df_sched_cand.sort_values("composite_score").reset_index(drop=True)
    best_sched_row = df_sched_cand.iloc[0]
    best_sched_formulation = best_sched_row["formulation"]
    best_sched_model_name = best_sched_row["model"]

    print(f"\n[WINNER SELECTED ON VALIDATION] Formulation: '{best_sched_formulation}' | Model: '{best_sched_model_name}'")
    print(f"  Val MAE: {best_sched_row['val_mae']:.2f} mo, RMSE: {best_sched_row['val_rmse']:.2f} mo, P90: {best_sched_row['val_p90']:.2f} mo, R²: {best_sched_row['val_r2']:.4f}")

    if best_sched_formulation == "Direct T+1":
        best_sched_model = direct_fitted_models[best_sched_model_name]
    else:
        best_sched_model = delta_fitted_models[best_sched_model_name]

    # =========================================================================
    # PART 2: UNIFIED SCALE-INVARIANT COST REGRESSION
    # =========================================================================
    print("\n" + "=" * 80)
    print("PART 2: UNIFIED SCALE-INVARIANT COST ARCHITECTURE (MULTIPLIER -> FUTURE COST)")
    print("=" * 80)

    # Persistence Baseline for Multiplier & Derived Cost
    pers_future_cost_val = curr_antic_val
    pers_future_cost_te = curr_antic_te
    m_p_cost_val = evaluate_regression_metrics(y_antic_val, pers_future_cost_val)
    m_p_cost_te = evaluate_regression_metrics(y_antic_te, pers_future_cost_te)

    comparison_records.append({
        "target": "Future Cost (INR Cr)", "formulation": "Persistence Multiplier",
        "model": "Persistence", **{f"val_{k.lower()}": v for k, v in m_p_cost_val.items()},
        **{f"test_{k.lower()}": v for k, v in m_p_cost_te.items()}, "fit_time_s": 0.0
    })
    pers_future_full_val = np.full(len(df_val), np.nan)
    pers_future_full_val[cost_mask_val] = pers_future_cost_val
    val_pred_dict["cost_future_persistence_cr"] = pers_future_full_val

    pers_future_full_te = np.full(len(df_test), np.nan)
    pers_future_full_te[cost_mask_te] = pers_future_cost_te
    test_pred_dict["cost_future_persistence_cr"] = pers_future_full_te

    cost_models = get_candidate_models()
    cost_val_results = {}
    cost_fitted_models = {}

    for name, model in cost_models.items():
        t0 = time.time()
        print(f"  Training Cost Multiplier Model: {name}...")
        model.fit(X_tr_cost, y_mult_tr)
        t_fit = round(time.time() - t0, 2)
        cost_fitted_models[name] = model

        pred_mult_val = np.clip(model.predict(X_val_cost), 0.5, 10.0)
        pred_mult_te = np.clip(model.predict(X_te_cost), 0.5, 10.0)

        # Multiplier metrics
        m_mult_val = evaluate_regression_metrics(y_mult_val, pred_mult_val)
        m_mult_te = evaluate_regression_metrics(y_mult_te, pred_mult_te)

        # Derived Future Cost metrics: Cost = Multiplier * original_cost_cr
        pred_cost_val_cr = pred_mult_val * orig_cost_val
        pred_cost_te_cr = pred_mult_te * orig_cost_te
        m_cost_val = evaluate_regression_metrics(y_antic_val, pred_cost_val_cr)
        m_cost_te = evaluate_regression_metrics(y_antic_te, pred_cost_te_cr)

        cost_val_results[name] = (m_mult_val, m_mult_te, m_cost_val, m_cost_te, t_fit, pred_cost_val_cr, pred_cost_te_cr)

        pred_cost_full_val = np.full(len(df_val), np.nan)
        pred_cost_full_val[cost_mask_val] = pred_cost_val_cr
        val_pred_dict[f"cost_pred_{name.replace(' ', '_').lower()}_cr"] = pred_cost_full_val

        pred_cost_full_te = np.full(len(df_test), np.nan)
        pred_cost_full_te[cost_mask_te] = pred_cost_te_cr
        test_pred_dict[f"cost_pred_{name.replace(' ', '_').lower()}_cr"] = pred_cost_full_te

        comparison_records.append({
            "target": "Cost Multiplier", "formulation": "T+1 Multiplier",
            "model": name, **{f"val_{k.lower()}": v for k, v in m_mult_val.items()},
            **{f"test_{k.lower()}": v for k, v in m_mult_te.items()}, "fit_time_s": t_fit
        })
        comparison_records.append({
            "target": "Derived Future Cost (INR Cr)", "formulation": "Derived from Multiplier",
            "model": name, **{f"val_{k.lower()}": v for k, v in m_cost_val.items()},
            **{f"test_{k.lower()}": v for k, v in m_cost_te.items()}, "fit_time_s": t_fit
        })
        print(f"    [Multiplier]  Val : R2={m_mult_val['R2']:+.4f} | MAE={m_mult_val['MAE']:.4f} | P90={m_mult_val['P90']:.4f}")
        print(f"    [Future Cost] Val : R2={m_cost_val['R2']:+.4f} | MAE={m_cost_val['MAE']:.1f} Cr | RMSE={m_cost_val['RMSE']:.1f} Cr | P90={m_cost_val['P90']:.1f} Cr")
        print(f"    [Future Cost] Test: R2={m_cost_te['R2']:+.4f} | MAE={m_cost_te['MAE']:.1f} Cr | RMSE={m_cost_te['RMSE']:.1f} Cr | P90={m_cost_te['P90']:.1f} Cr")

    # Stacking Regressor for Cost Multiplier
    print("  Training Cost Stacking Regressor (Chronological TimeSeriesSplit)...")
    t0 = time.time()
    stack_cost = ChronologicalStackingRegressor(
        estimators=[
            ('ridge', Ridge(alpha=10.0, random_state=42)),
            ('rf', RandomForestRegressor(n_estimators=60, max_depth=12, max_samples=0.5, n_jobs=-1, random_state=42)),
            ('hgb', HistGradientBoostingRegressor(max_iter=100, max_depth=6, random_state=42)),
            ('xgb', XGBRegressor(n_estimators=150, max_depth=6, learning_rate=0.05, n_jobs=-1, random_state=42)),
            ('cat', CatBoostRegressor(iterations=150, depth=6, learning_rate=0.06, thread_count=-1, random_seed=42, verbose=0)),
        ],
        final_estimator=Ridge(alpha=1.0),
        n_splits=3
    )
    stack_cost.fit(X_tr_cost, y_mult_tr)
    t_stack_cost = round(time.time() - t0, 2)
    pred_mult_val_s = np.clip(stack_cost.predict(X_val_cost), 0.5, 10.0)
    pred_mult_te_s = np.clip(stack_cost.predict(X_te_cost), 0.5, 10.0)

    m_mult_val_s = evaluate_regression_metrics(y_mult_val, pred_mult_val_s)
    m_mult_te_s = evaluate_regression_metrics(y_mult_te, pred_mult_te_s)

    pred_cost_val_cr_s = pred_mult_val_s * orig_cost_val
    pred_cost_te_cr_s = pred_mult_te_s * orig_cost_te
    m_cost_val_s = evaluate_regression_metrics(y_antic_val, pred_cost_val_cr_s)
    m_cost_te_s = evaluate_regression_metrics(y_antic_te, pred_cost_te_cr_s)

    cost_val_results["Stacking Regressor"] = (m_mult_val_s, m_mult_te_s, m_cost_val_s, m_cost_te_s, t_stack_cost, pred_cost_val_cr_s, pred_cost_te_cr_s)
    cost_fitted_models["Stacking Regressor"] = stack_cost

    pred_cost_full_val_s = np.full(len(df_val), np.nan)
    pred_cost_full_val_s[cost_mask_val] = pred_cost_val_cr_s
    val_pred_dict["cost_pred_stacking_cr"] = pred_cost_full_val_s

    pred_cost_full_te_s = np.full(len(df_test), np.nan)
    pred_cost_full_te_s[cost_mask_te] = pred_cost_te_cr_s
    test_pred_dict["cost_pred_stacking_cr"] = pred_cost_full_te_s

    comparison_records.append({
        "target": "Cost Multiplier", "formulation": "T+1 Multiplier",
        "model": "Stacking Regressor", **{f"val_{k.lower()}": v for k, v in m_mult_val_s.items()},
        **{f"test_{k.lower()}": v for k, v in m_mult_te_s.items()}, "fit_time_s": t_stack_cost
    })
    comparison_records.append({
        "target": "Derived Future Cost (INR Cr)", "formulation": "Derived from Multiplier",
        "model": "Stacking Regressor", **{f"val_{k.lower()}": v for k, v in m_cost_val_s.items()},
        **{f"test_{k.lower()}": v for k, v in m_cost_te_s.items()}, "fit_time_s": t_stack_cost
    })
    print(f"    [Future Cost] Val : R2={m_cost_val_s['R2']:+.4f} | MAE={m_cost_val_s['MAE']:.1f} Cr | RMSE={m_cost_val_s['RMSE']:.1f} Cr | P90={m_cost_val_s['P90']:.1f} Cr")
    print(f"    [Future Cost] Test: R2={m_cost_te_s['R2']:+.4f} | MAE={m_cost_te_s['MAE']:.1f} Cr | RMSE={m_cost_te_s['RMSE']:.1f} Cr | P90={m_cost_te_s['P90']:.1f} Cr")

    # Cost Model Selection on Validation
    print("\n--- Cost Model Selection on Validation Set ---")
    cost_candidates = []
    for model_name, (m_m_v, m_m_t, m_c_v, m_c_t, t_fit, _, _) in cost_val_results.items():
        cost_candidates.append({
            "model": model_name,
            "val_mae_cr": m_c_v["MAE"], "val_rmse_cr": m_c_v["RMSE"],
            "val_p90_cr": m_c_v["P90"], "val_p95_cr": m_c_v["P95"], "val_r2": m_c_v["R2"],
            "val_mult_mae": m_m_v["MAE"], "val_mult_rmse": m_m_v["RMSE"]
        })
    df_cost_cand = pd.DataFrame(cost_candidates)
    df_cost_cand["rank_mae"] = df_cost_cand["val_mae_cr"].rank()
    df_cost_cand["rank_rmse"] = df_cost_cand["val_rmse_cr"].rank()
    df_cost_cand["rank_p90"] = df_cost_cand["val_p90_cr"].rank()
    df_cost_cand["rank_p95"] = df_cost_cand["val_p95_cr"].rank()
    df_cost_cand["rank_r2"] = (-df_cost_cand["val_r2"]).rank()
    df_cost_cand["composite_score"] = (
        df_cost_cand["rank_mae"] +
        df_cost_cand["rank_rmse"] +
        df_cost_cand["rank_p90"] +
        df_cost_cand["rank_p95"] +
        df_cost_cand["rank_r2"]
    )
    df_cost_cand = df_cost_cand.sort_values("composite_score").reset_index(drop=True)
    best_cost_row = df_cost_cand.iloc[0]
    best_cost_model_name = best_cost_row["model"]
    best_cost_model = cost_fitted_models[best_cost_model_name]

    print(f"\n[WINNER SELECTED ON VALIDATION] Model: '{best_cost_model_name}'")
    print(f"  Val Future Cost MAE: Rs. {best_cost_row['val_mae_cr']:.1f} Cr, RMSE: Rs. {best_cost_row['val_rmse_cr']:.1f} Cr, P90: Rs. {best_cost_row['val_p90_cr']:.1f} Cr, R2: {best_cost_row['val_r2']:.4f}")

    # =========================================================================
    # PART 3: SAVE COMPARISONS & PREDICTIONS
    # =========================================================================
    print("\n" + "=" * 80)
    print("PART 3: ARTIFACT GENERATION & PERSISTENCE")
    print("=" * 80)

    # 1. Save Model Comparison CSV
    df_comp = pd.DataFrame(comparison_records)
    comp_csv_path = RESULTS_DIR / "t1_regression_model_comparison.csv"
    df_comp.to_csv(comp_csv_path, index=False)
    print(f"Saved comprehensive model comparison table to {comp_csv_path}")

    # 2. Save Validation and Test Predictions (Parquet)
    df_val_preds = pd.DataFrame(val_pred_dict)
    df_test_preds = pd.DataFrame(test_pred_dict)
    val_pred_path = PREDICTIONS_DIR / "regression_val_predictions.parquet"
    test_pred_path = PREDICTIONS_DIR / "regression_test_predictions.parquet"
    df_val_preds.to_parquet(val_pred_path, index=False)
    df_test_preds.to_parquet(test_pred_path, index=False)
    print(f"Saved validation predictions to {val_pred_path}")
    print(f"Saved holdout test predictions to {test_pred_path}")

    # 3. Serialize Selected Production Models
    sched_model_dir = MODELS_DIR / "schedule_regression"
    cost_model_dir = MODELS_DIR / "cost_regression"
    sched_model_dir.mkdir(parents=True, exist_ok=True)
    cost_model_dir.mkdir(parents=True, exist_ok=True)

    joblib.dump(best_sched_model, sched_model_dir / "production_model.pkl")
    joblib.dump(preprocessor, sched_model_dir / "preprocessor.joblib")
    print(f"Serialized production schedule regression model to {sched_model_dir / 'production_model.pkl'}")

    joblib.dump(best_cost_model, cost_model_dir / "production_model.pkl")
    joblib.dump(preprocessor, cost_model_dir / "preprocessor.joblib")
    print(f"Serialized production cost regression model to {cost_model_dir / 'production_model.pkl'}")

    # 4. Extract & Save Feature Importances
    print("Extracting and saving feature importances...")
    sched_feat_imp = {}
    if hasattr(best_sched_model, "feature_importances_"):
        imps = best_sched_model.feature_importances_
        sched_feat_imp = {feat: round(float(imp), 5) for feat, imp in zip(transformed_feature_names, imps)}
    elif hasattr(best_sched_model, "coef_"):
        coefs = best_sched_model.coef_
        sched_feat_imp = {feat: round(float(abs(c)), 5) for feat, c in zip(transformed_feature_names, coefs)}
    elif hasattr(best_sched_model, "fitted_estimators_"):
        for est_name, est in best_sched_model.fitted_estimators_:
            if hasattr(est, "feature_importances_"):
                imps = est.feature_importances_
                sched_feat_imp = {feat: round(float(imp), 5) for feat, imp in zip(transformed_feature_names, imps)}
                break

    cost_feat_imp = {}
    if hasattr(best_cost_model, "feature_importances_"):
        imps = best_cost_model.feature_importances_
        cost_feat_imp = {feat: round(float(imp), 5) for feat, imp in zip(transformed_feature_names, imps)}
    elif hasattr(best_cost_model, "coef_"):
        coefs = best_cost_model.coef_
        cost_feat_imp = {feat: round(float(abs(c)), 5) for feat, c in zip(transformed_feature_names, coefs)}
    else:
        ref_model = cost_fitted_models.get("CatBoost") or cost_fitted_models.get("XGBoost")
        if ref_model and hasattr(ref_model, "feature_importances_"):
            imps = ref_model.feature_importances_
            cost_feat_imp = {feat: round(float(imp), 5) for feat, imp in zip(transformed_feature_names, imps)}

    with open(SHAP_DIR / "regression_schedule_feature_importance.json", "w", encoding="utf-8") as f:
        json.dump(sched_feat_imp, f, indent=2)
    with open(SHAP_DIR / "regression_cost_feature_importance.json", "w", encoding="utf-8") as f:
        json.dump(cost_feat_imp, f, indent=2)

    # 5. Save Structured Regression Metrics JSON
    if best_sched_formulation == "Direct T+1":
        final_sched_test_m = direct_val_results[best_sched_model_name][1]
        final_sched_val_m = direct_val_results[best_sched_model_name][0]
    else:
        final_sched_test_m = delta_val_results[best_sched_model_name][1]
        final_sched_val_m = delta_val_results[best_sched_model_name][0]

    final_cost_test_m = cost_val_results[best_cost_model_name][3]
    final_cost_val_m = cost_val_results[best_cost_model_name][2]
    final_mult_test_m = cost_val_results[best_cost_model_name][1]
    final_mult_val_m = cost_val_results[best_cost_model_name][0]

    regression_metrics_summary = {
        "timestamp": time.strftime("%Y-%m-%d %H:%M:%S UTC", time.gmtime()),
        "schedule_regression": {
            "winning_formulation": best_sched_formulation,
            "winning_model": best_sched_model_name,
            "validation_metrics": final_sched_val_m,
            "holdout_test_metrics": final_sched_test_m,
            "historical_benchmark_comparison": {
                "benchmark_holdout_r2": 0.9331,
                "benchmark_holdout_mae_months": 3.97,
                "benchmark_holdout_rmse_months": 11.60,
                "achieved_holdout_r2": final_sched_test_m["R2"],
                "achieved_holdout_mae_months": final_sched_test_m["MAE"],
                "achieved_holdout_rmse_months": final_sched_test_m["RMSE"],
                "achieved_holdout_medae_months": final_sched_test_m["MedAE"],
                "achieved_holdout_p90_months": final_sched_test_m["P90"],
                "achieved_holdout_p95_months": final_sched_test_m["P95"],
            }
        },
        "cost_regression": {
            "unified_architecture": "T+1 Cost Multiplier -> Future Cost",
            "winning_model": best_cost_model_name,
            "multiplier_val_metrics": final_mult_val_m,
            "multiplier_test_metrics": final_mult_test_m,
            "derived_future_cost_val_metrics": final_cost_val_m,
            "derived_future_cost_test_metrics": final_cost_test_m,
            "historical_benchmark_comparison": {
                "benchmark_holdout_r2": 0.8862,
                "benchmark_holdout_mae_cr": 424.55,
                "benchmark_holdout_rmse_cr": 1891.13,
                "achieved_holdout_r2": final_cost_test_m["R2"],
                "achieved_holdout_mae_cr": final_cost_test_m["MAE"],
                "achieved_holdout_rmse_cr": final_cost_test_m["RMSE"],
                "achieved_holdout_medae_cr": final_cost_test_m["MedAE"],
                "achieved_holdout_p90_cr": final_cost_test_m["P90"],
                "achieved_holdout_p95_cr": final_cost_test_m["P95"],
            }
        },
        "transition_gap_analysis": gap_stats["gap_analysis"],
        "dataset_counts": {
            "total_usable_rows": len(df_usable),
            "train_rows": len(df_train),
            "val_rows": len(df_val),
            "test_rows": len(df_test),
            "inference_rows": len(df_inf),
            "unique_projects": df_usable["effective_project_key"].nunique()
        }
    }

    with open(METRICS_DIR / "regression_metrics.json", "w", encoding="utf-8") as f:
        json.dump(regression_metrics_summary, f, indent=2)
    print(f"Saved regression metrics summary to {METRICS_DIR / 'regression_metrics.json'}")

    # 6. Update Model Metadata
    meta_path = MODELS_DIR / "model_metadata.json"
    metadata = {}
    if meta_path.exists():
        try:
            with open(meta_path, "r", encoding="utf-8") as f:
                metadata = json.load(f)
        except Exception:
            metadata = {}

    metadata["regression_layer"] = {
        "updated_at": time.strftime("%Y-%m-%d %H:%M:%S UTC", time.gmtime()),
        "schedule_model": {
            "formulation": best_sched_formulation,
            "model_type": best_sched_model_name,
            "artifact_path": "schedule_regression/production_model.pkl",
            "val_r2": final_sched_val_m["R2"],
            "val_mae": final_sched_val_m["MAE"],
            "test_r2": final_sched_test_m["R2"],
            "test_mae": final_sched_test_m["MAE"],
        },
        "cost_model": {
            "architecture": "T+1 Cost Multiplier",
            "model_type": best_cost_model_name,
            "artifact_path": "cost_regression/production_model.pkl",
            "val_future_cost_r2": final_cost_val_m["R2"],
            "val_future_cost_mae_cr": final_cost_val_m["MAE"],
            "test_future_cost_r2": final_cost_test_m["R2"],
            "test_future_cost_mae_cr": final_cost_test_m["MAE"],
        }
    }
    with open(meta_path, "w", encoding="utf-8") as f:
        json.dump(metadata, f, indent=2)
    print(f"Updated metadata at {meta_path}")

    elapsed = round(time.time() - start_total, 1)
    print(f"\nCompleted T+1 Regression Orchestration in {elapsed}s.")


if __name__ == "__main__":
    main()
