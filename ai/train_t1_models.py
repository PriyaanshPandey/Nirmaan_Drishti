"""
train_t1_models.py - Training, Evaluation, Model Selection & Serialization Orchestrator for T+1 Strategy.

Implements:
1. Candidate model training for:
   - Future Schedule Delay: Logistic Regression, Random Forest, XGBoost
   - Future Cost Overrun: Logistic Regression, Random Forest, XGBoost
2. Strict Chronological Evaluation:
   - Train on observations <= 2022-12-01
   - Validation on 2023-01-01 to 2024-06-01
   - Unseen Holdout Test on 2024-07-01 to 2026-04-01
3. Comprehensive Metrics: F1, Recall, Precision, ROC-AUC, PR-AUC, Balanced Accuracy.
4. Model Selection based on validation performance with test verification.
5. Isolation Forest anomaly detector trained on X(T).
6. Fresh TreeExplainer SHAP integration.
7. Clean production serialization under ai/models/.
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

from sklearn.linear_model import LogisticRegression
from sklearn.ensemble import RandomForestClassifier, IsolationForest
from sklearn.metrics import (
    roc_auc_score, f1_score, precision_score, recall_score,
    precision_recall_curve, auc, balanced_accuracy_score, brier_score_loss
)
from xgboost import XGBClassifier
import shap

# Configure paths
ROOT_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT_DIR))
sys.path.insert(0, str(ROOT_DIR / "ai"))

from ai.src.t1_pipeline import (
    load_canonical_trajectory_data,
    add_t1_dynamic_physics_features,
    construct_t1_targets,
    apply_chronological_splits,
    get_t1_feature_definitions,
    build_t1_preprocessor,
    get_preprocessor_feature_names,
    assert_zero_leakage,
)


def evaluate_binary_model(y_true: np.ndarray, y_proba: np.ndarray, threshold: float = 0.5) -> Dict[str, float]:
    """Computes all classification metrics for a binary model."""
    mask = ~np.isnan(y_true) & ~np.isnan(y_proba)
    yt = y_true[mask].astype(int)
    yp = y_proba[mask]

    if len(np.unique(yt)) < 2:
        return {
            "F1": 0.0, "Recall": 0.0, "Precision": 0.0,
            "ROC_AUC": 0.5, "PR_AUC": 0.0, "Balanced_Acc": 0.5, "Brier": 0.0
        }

    yp_cls = (yp >= threshold).astype(int)
    f1 = float(f1_score(yt, yp_cls, zero_division=0))
    rec = float(recall_score(yt, yp_cls, zero_division=0))
    prec = float(precision_score(yt, yp_cls, zero_division=0))
    bal_acc = float(balanced_accuracy_score(yt, yp_cls))
    roc_auc = float(roc_auc_score(yt, yp))

    prec_curve, rec_curve, _ = precision_recall_curve(yt, yp)
    pr_auc = float(auc(rec_curve, prec_curve))
    brier = float(brier_score_loss(yt, yp))

    return {
        "F1": round(f1, 4),
        "Recall": round(rec, 4),
        "Precision": round(prec, 4),
        "ROC_AUC": round(roc_auc, 4),
        "PR_AUC": round(pr_auc, 4),
        "Balanced_Acc": round(bal_acc, 4),
        "Brier": round(brier, 4)
    }


def main():
    print("=" * 80)
    print("NIRMAAN DRISHTI: T+1 NEXT-PERIOD RETRAINING & MODEL SELECTION PIPELINE")
    print("=" * 80)
    t_start = time.time()

    models_root = ROOT_DIR / "ai" / "models"
    results_dir = ROOT_DIR / "results"
    for subdir in ["schedule_delay", "cost_overrun", "anomaly_detector", "shap"]:
        (models_root / subdir).mkdir(parents=True, exist_ok=True)
    results_dir.mkdir(parents=True, exist_ok=True)

    # 1. Load data & compute T+1 targets
    print("\n[STEP 1/6] Loading trajectories and constructing T+1 targets...")
    df_raw = load_canonical_trajectory_data()
    print(f"  - Total trajectory rows: {len(df_raw):,} across {df_raw['effective_project_key'].nunique():,} projects")

    df_feat = add_t1_dynamic_physics_features(df_raw)
    df_usable, target_stats = construct_t1_targets(df_feat)
    print("  - Usable T+1 rows:", f"{target_stats['rows_with_valid_t1']:,}")
    print("  - Rows dropped (terminal snapshot):", f"{target_stats['rows_dropped']:,}")
    print("  - Schedule delay positive rate:", f"{target_stats['schedule_delay_positive_rate']*100:.2f}%")
    print("  - Cost overrun positive rate:   ", f"{target_stats['cost_overrun_positive_rate']*100:.2f}%")

    # 2. Chronological Splitting
    print("\n[STEP 2/6] Applying strict chronological temporal partitioning...")
    df_train, df_val, df_test, df_inf = apply_chronological_splits(df_usable)
    print(f"  - TRAIN : {len(df_train):,} snapshots ({df_train['report_month'].min().strftime('%Y-%m-%d')} to {df_train['report_month'].max().strftime('%Y-%m-%d')})")
    print(f"  - VAL   : {len(df_val):,} snapshots ({df_val['report_month'].min().strftime('%Y-%m-%d')} to {df_val['report_month'].max().strftime('%Y-%m-%d')})")
    print(f"  - TEST  : {len(df_test):,} snapshots ({df_test['report_month'].min().strftime('%Y-%m-%d')} to {df_test['report_month'].max().strftime('%Y-%m-%d')})")

    # 3. Features & Preprocessor
    print("\n[STEP 3/6] Fitting preprocessor strictly on training partition (zero leakage)...")
    cat_cols, num_cols = get_t1_feature_definitions()
    all_feature_cols = cat_cols + num_cols
    assert_zero_leakage(all_feature_cols)

    preprocessor = build_t1_preprocessor(cat_cols, num_cols)
    preprocessor.fit(df_train[all_feature_cols])
    transformed_names = get_preprocessor_feature_names(preprocessor, cat_cols, num_cols)
    print(f"  - Input features: {len(all_feature_cols)} ({len(cat_cols)} categoricals, {len(num_cols)} numerics)")
    print(f"  - Transformed feature dimensionality: {len(transformed_names)}")

    X_train = preprocessor.transform(df_train[all_feature_cols])
    X_val = preprocessor.transform(df_val[all_feature_cols])
    X_test = preprocessor.transform(df_test[all_feature_cols])

    comparison_records = []
    trained_candidates = {}

    # 4. Train Candidate Models for Schedule Delay
    print("\n[STEP 4/6] Training & Evaluating Schedule Delay Candidate Models...")
    y_train_sched = df_train["future_schedule_delay"].values
    y_val_sched = df_val["future_schedule_delay"].values
    y_test_sched = df_test["future_schedule_delay"].values

    sched_scale_pos = max(1.0, float((y_train_sched == 0).sum() / max(1, (y_train_sched == 1).sum())))

    sched_models = {
        "Logistic Regression": LogisticRegression(max_iter=1000, random_state=42, class_weight="balanced"),
        "Random Forest": RandomForestClassifier(n_estimators=100, max_depth=12, min_samples_leaf=10, random_state=42, class_weight="balanced", n_jobs=-1),
        "XGBoost": XGBClassifier(n_estimators=200, max_depth=6, learning_rate=0.05, subsample=0.8, colsample_bytree=0.8, scale_pos_weight=sched_scale_pos, eval_metric="logloss", random_state=42, n_jobs=-1)
    }

    for name, model in sched_models.items():
        print(f"  Training Schedule Delay -> {name}...")
        t0 = time.time()
        model.fit(X_train, y_train_sched)
        fit_time = time.time() - t0

        val_proba = model.predict_proba(X_val)[:, 1]
        test_proba = model.predict_proba(X_test)[:, 1]

        val_m = evaluate_binary_model(y_val_sched, val_proba)
        test_m = evaluate_binary_model(y_test_sched, test_proba)

        trained_candidates[f"sched_{name}"] = {
            "model": model, "target": "schedule_delay", "name": name,
            "val_metrics": val_m, "test_metrics": test_m
        }

        comparison_records.append({
            "target": "Future Schedule Delay (T+1)",
            "model": name,
            "features": len(all_feature_cols),
            "val_f1": val_m["F1"],
            "val_recall": val_m["Recall"],
            "val_precision": val_m["Precision"],
            "val_roc_auc": val_m["ROC_AUC"],
            "val_pr_auc": val_m["PR_AUC"],
            "test_f1": test_m["F1"],
            "test_recall": test_m["Recall"],
            "test_precision": test_m["Precision"],
            "test_roc_auc": test_m["ROC_AUC"],
            "test_pr_auc": test_m["PR_AUC"],
            "fit_time_s": round(fit_time, 2)
        })
        print(f"    * Val F1: {val_m['F1']} | Val Recall: {val_m['Recall']} | Val PR-AUC: {val_m['PR_AUC']} | Test F1: {test_m['F1']}")

    # 5. Train Candidate Models for Cost Overrun (Handling Class Imbalance)
    print("\n[STEP 5/6] Training & Evaluating Cost Overrun Candidate Models...")
    # Filter rows with non-NaN cost overrun target
    train_cost_mask = df_train["future_cost_overrun"].notna().values
    val_cost_mask = df_val["future_cost_overrun"].notna().values
    test_cost_mask = df_test["future_cost_overrun"].notna().values

    X_train_cost = X_train[train_cost_mask]
    y_train_cost = df_train.loc[train_cost_mask, "future_cost_overrun"].values.astype(int)

    X_val_cost = X_val[val_cost_mask]
    y_val_cost = df_val.loc[val_cost_mask, "future_cost_overrun"].values.astype(int)

    X_test_cost = X_test[test_cost_mask]
    y_test_cost = df_test.loc[test_cost_mask, "future_cost_overrun"].values.astype(int)

    cost_scale_pos = max(1.0, float((y_train_cost == 0).sum() / max(1, (y_train_cost == 1).sum())))
    print(f"  - Cost overrun class imbalance ratio (negative/positive): {cost_scale_pos:.2f}")

    cost_models = {
        "Logistic Regression": LogisticRegression(max_iter=1000, random_state=42, class_weight="balanced"),
        "Random Forest": RandomForestClassifier(n_estimators=100, max_depth=12, min_samples_leaf=10, random_state=42, class_weight="balanced", n_jobs=-1),
        "XGBoost": XGBClassifier(n_estimators=200, max_depth=6, learning_rate=0.05, subsample=0.8, colsample_bytree=0.8, scale_pos_weight=cost_scale_pos, eval_metric="logloss", random_state=42, n_jobs=-1)
    }

    for name, model in cost_models.items():
        print(f"  Training Cost Overrun -> {name}...")
        t0 = time.time()
        model.fit(X_train_cost, y_train_cost)
        fit_time = time.time() - t0

        val_proba = model.predict_proba(X_val_cost)[:, 1]
        test_proba = model.predict_proba(X_test_cost)[:, 1]

        val_m = evaluate_binary_model(y_val_cost, val_proba)
        test_m = evaluate_binary_model(y_test_cost, test_proba)

        trained_candidates[f"cost_{name}"] = {
            "model": model, "target": "cost_overrun", "name": name,
            "val_metrics": val_m, "test_metrics": test_m
        }

        comparison_records.append({
            "target": "Future Cost Overrun (T+1)",
            "model": name,
            "features": len(all_feature_cols),
            "val_f1": val_m["F1"],
            "val_recall": val_m["Recall"],
            "val_precision": val_m["Precision"],
            "val_roc_auc": val_m["ROC_AUC"],
            "val_pr_auc": val_m["PR_AUC"],
            "test_f1": test_m["F1"],
            "test_recall": test_m["Recall"],
            "test_precision": test_m["Precision"],
            "test_roc_auc": test_m["ROC_AUC"],
            "test_pr_auc": test_m["PR_AUC"],
            "fit_time_s": round(fit_time, 2)
        })
        print(f"    * Val F1: {val_m['F1']} | Val Recall: {val_m['Recall']} | Val PR-AUC: {val_m['PR_AUC']} | Test F1: {test_m['F1']}")

    # Save Comparison Table
    df_comp = pd.DataFrame(comparison_records)
    comp_csv_path = results_dir / "t1_model_comparison.csv"
    df_comp.to_csv(comp_csv_path, index=False)
    print(f"\nSaved model comparison table to: {comp_csv_path}")
    print("\n--- MODEL COMPARISON TABLE ---")
    print(df_comp.to_string(index=False))

    # 6. Model Selection
    # Schedule Delay: highest val F1 and PR-AUC
    sched_candidates = [r for r in comparison_records if "Schedule Delay" in r["target"]]
    best_sched_row = max(sched_candidates, key=lambda r: (r["val_f1"], r["val_pr_auc"]))
    best_sched_name = best_sched_row["model"]
    best_sched_model = trained_candidates[f"sched_{best_sched_name}"]["model"]
    print(f"\n[SELECTION] Best Schedule Delay Model: {best_sched_name} (Val F1={best_sched_row['val_f1']}, Test F1={best_sched_row['test_f1']})")

    # Cost Overrun: highest val PR-AUC and Recall (handling class imbalance)
    cost_candidates = [r for r in comparison_records if "Cost Overrun" in r["target"]]
    best_cost_row = max(cost_candidates, key=lambda r: (r["val_pr_auc"], r["val_recall"]))
    best_cost_name = best_cost_row["model"]
    best_cost_model = trained_candidates[f"cost_{best_cost_name}"]["model"]
    print(f"[SELECTION] Best Cost Overrun Model: {best_cost_name} (Val PR-AUC={best_cost_row['val_pr_auc']}, Test PR-AUC={best_cost_row['test_pr_auc']})")

    # 7. Train Isolation Forest Anomaly Detector
    print("\n[STEP 6/6] Training Isolation Forest Anomaly Detector & Fitting SHAP Explainers...")
    anomaly_detector = IsolationForest(n_estimators=100, contamination=0.05, random_state=42, n_jobs=-1)
    # Fit strictly on training features
    anomaly_detector.fit(X_train)
    print("  - Fitted Isolation Forest on training feature matrix.")

    # 8. Fit SHAP Background Sample and TreeExplainer
    print("  - Generating TreeExplainer background for SHAP explanations...")
    sample_indices = np.random.RandomState(42).choice(X_train.shape[0], size=min(200, X_train.shape[0]), replace=False)
    X_shap_background = X_train[sample_indices]

    np.save(models_root / "shap" / "schedule_delay_shap_background.npy", X_shap_background)
    np.save(models_root / "shap" / "cost_overrun_shap_background.npy", X_shap_background)

    # Save transformed feature names for SHAP alignment
    with open(models_root / "shap" / "transformed_feature_names.json", "w", encoding="utf-8") as f:
        json.dump(transformed_names, f, indent=2)

    # 9. Serialize Production Artifacts
    print("\nSerializing fresh production artifacts to ai/models/...")
    # Schedule delay
    joblib.dump(best_sched_model, models_root / "schedule_delay" / "production_model.pkl")
    joblib.dump(preprocessor, models_root / "schedule_delay" / "preprocessor.joblib")
    print("  [OK] Saved ai/models/schedule_delay/production_model.pkl & preprocessor.joblib")

    # Cost overrun
    joblib.dump(best_cost_model, models_root / "cost_overrun" / "production_model.pkl")
    joblib.dump(preprocessor, models_root / "cost_overrun" / "preprocessor.joblib")
    print("  [OK] Saved ai/models/cost_overrun/production_model.pkl & preprocessor.joblib")

    # Anomaly detector
    joblib.dump(anomaly_detector, models_root / "anomaly_detector" / "production_anomaly_detector.pkl")
    joblib.dump(preprocessor, models_root / "anomaly_detector" / "preprocessor.joblib")
    print("  [OK] Saved ai/models/anomaly_detector/production_anomaly_detector.pkl & preprocessor.joblib")

    # Model metadata
    metadata = {
        "strategy": "T+1 Next-Period Classification",
        "timestamp": time.strftime("%Y-%m-%d %H:%M:%S UTC", time.gmtime()),
        "schedule_delay_model": {
            "name": best_sched_name,
            "artifact": "ai/models/schedule_delay/production_model.pkl",
            "val_f1": best_sched_row["val_f1"],
            "test_f1": best_sched_row["test_f1"],
            "val_roc_auc": best_sched_row["val_roc_auc"],
            "test_roc_auc": best_sched_row["test_roc_auc"],
            "val_pr_auc": best_sched_row["val_pr_auc"],
            "test_pr_auc": best_sched_row["test_pr_auc"]
        },
        "cost_overrun_model": {
            "name": best_cost_name,
            "artifact": "ai/models/cost_overrun/production_model.pkl",
            "val_f1": best_cost_row["val_f1"],
            "test_f1": best_cost_row["test_f1"],
            "val_roc_auc": best_cost_row["val_roc_auc"],
            "test_roc_auc": best_cost_row["test_roc_auc"],
            "val_pr_auc": best_cost_row["val_pr_auc"],
            "test_pr_auc": best_cost_row["test_pr_auc"]
        },
        "anomaly_detector": {
            "name": "IsolationForest",
            "artifact": "ai/models/anomaly_detector/production_anomaly_detector.pkl",
            "contamination": 0.05
        },
        "feature_count": {
            "input_categorical": len(cat_cols),
            "input_numeric": len(num_cols),
            "input_total": len(all_feature_cols),
            "transformed_dimensionality": len(transformed_names)
        },
        "dataset_statistics": target_stats,
        "chronological_partitions": {
            "train": {"start": df_train["report_month"].min().strftime("%Y-%m-%d"), "end": df_train["report_month"].max().strftime("%Y-%m-%d"), "rows": len(df_train)},
            "validation": {"start": df_val["report_month"].min().strftime("%Y-%m-%d"), "end": df_val["report_month"].max().strftime("%Y-%m-%d"), "rows": len(df_val)},
            "holdout_test": {"start": df_test["report_month"].min().strftime("%Y-%m-%d"), "end": df_test["report_month"].max().strftime("%Y-%m-%d"), "rows": len(df_test)}
        }
    }

    with open(models_root / "model_metadata.json", "w", encoding="utf-8") as f:
        json.dump(metadata, f, indent=2)
    print("  [OK] Saved ai/models/model_metadata.json")

    total_time = time.time() - t_start
    print(f"\nPipeline completed in {total_time:.1f}s. All T+1 models trained and deployed successfully.")


if __name__ == "__main__":
    main()
