"""
Unseen-Project and Sub-Cohort Evaluation Module for PAIMANA ML.

Implements:
1. Evaluation B: Temporal + Project-Group Holdout (Unseen projects evaluated strictly in future test window)
2. Evaluation C: Trajectory History Progression (Prediction performance by history depth: 1m, 2m, 3m, 6m, 12m+)
3. Evaluation D: Completed-Project Historical Analysis (Validation on projects reaching completion)
"""

import numpy as np
import pandas as pd
from typing import Dict, Any, List
from sklearn.linear_model import LogisticRegression, Ridge
from sklearn.calibration import CalibratedClassifierCV
from xgboost import XGBClassifier, XGBRegressor

from src.feature_selection import get_available_feature_split, is_cold_start
from src.preprocessing import build_preprocessor, transform_features
from src.evaluate import evaluate_classifier, evaluate_regressor


def evaluate_unseen_projects(df: pd.DataFrame, config: dict,
                             holdout_ratio: float = 0.2,
                             split_date: str = "2022-01-01") -> Dict[str, Any]:
    """
    Evaluation B — Temporal + Project-Group Holdout.

    Trains on 80% of projects prior to split_date.
    Evaluates strictly on 20% unseen projects after split_date.
    """
    print(f"\n{'=' * 75}")
    print(f"EVALUATION B: UNSEEN-PROJECT GENERALIZATION (Temporal + Group Holdout)")
    print(f"{'=' * 75}")

    feature_split = get_available_feature_split(df, is_cold=False)
    feature_cols = feature_split["categorical"] + feature_split["numeric"]
    horizons = config["prediction"]["horizons"]

    # Disjoint project partitioning
    unique_projects = np.array(sorted(df["project_id"].astype(str).unique()))
    rng = np.random.RandomState(42)
    rng.shuffle(unique_projects)

    n_holdout = int(len(unique_projects) * holdout_ratio)
    test_projects = set(unique_projects[:n_holdout])
    train_projects = set(unique_projects[n_holdout:])

    split_dt = pd.to_datetime(split_date)
    unseen_results = {}

    for h in horizons:
        cls_target = f"additional_cost_escalation_event_{h}m"
        time_target = f"additional_delay_event_{h}m"
        cost_reg_target = f"additional_cost_overrun_pct_{h}m"
        time_reg_target = f"additional_delay_months_{h}m"

        # Train on train_projects before split_dt
        train_mask = (df["project_id"].isin(train_projects)) & (df["report_month"] < split_dt) & df[cls_target].notna()
        # Test on test_projects on or after split_dt
        test_mask = (df["project_id"].isin(test_projects)) & (df["report_month"] >= split_dt) & df[cls_target].notna()

        train_df = df[train_mask]
        test_df = df[test_mask]

        if len(train_df) == 0 or len(test_df) == 0:
            continue

        prep = build_preprocessor(train_df[feature_cols], feature_split["categorical"], feature_split["numeric"], is_cold=False)
        X_train = transform_features(train_df[feature_cols], prep)
        X_test = transform_features(test_df[feature_cols], prep)

        # 1. Cost Classifier on Unseen Projects
        y_train_cost = train_df[cls_target].values
        y_test_cost = test_df[cls_target].values
        scale_pos = max(float((y_train_cost == 0).sum() / max((y_train_cost == 1).sum(), 1)), 1.0)

        xgb_cost = XGBClassifier(**config["models"]["xgboost"], scale_pos_weight=scale_pos, eval_metric="logloss", n_jobs=-1)
        calibrated_cost = CalibratedClassifierCV(xgb_cost, method="sigmoid", cv=3)
        calibrated_cost.fit(X_train, y_train_cost)

        cost_proba = calibrated_cost.predict_proba(X_test)[:, 1]
        cost_metrics = evaluate_classifier(y_test_cost, cost_proba)

        # 2. Time Classifier on Unseen Projects
        y_train_time = train_df[time_target].values
        y_test_time = test_df[time_target].values
        scale_pos_time = max(float((y_train_time == 0).sum() / max((y_train_time == 1).sum(), 1)), 1.0)

        xgb_time = XGBClassifier(**config["models"]["xgboost"], scale_pos_weight=scale_pos_time, eval_metric="logloss", n_jobs=-1)
        calibrated_time = CalibratedClassifierCV(xgb_time, method="sigmoid", cv=3)
        calibrated_time.fit(X_train, y_train_time)

        time_proba = calibrated_time.predict_proba(X_test)[:, 1]
        time_metrics = evaluate_classifier(y_test_time, time_proba)

        # 3. Regressors
        reg_cost_mask_tr = train_df[cost_reg_target].notna().values
        reg_cost_mask_te = test_df[cost_reg_target].notna().values
        xgb_cost_reg = XGBRegressor(**config["models"]["xgboost"], eval_metric="mae", n_jobs=-1)
        xgb_cost_reg.fit(X_train[reg_cost_mask_tr], train_df.loc[reg_cost_mask_tr, cost_reg_target].values)
        cost_reg_pred = xgb_cost_reg.predict(X_test[reg_cost_mask_te])
        cost_reg_metrics = evaluate_regressor(test_df.loc[reg_cost_mask_te, cost_reg_target].values, cost_reg_pred)

        reg_time_mask_tr = train_df[time_reg_target].notna().values
        reg_time_mask_te = test_df[time_reg_target].notna().values
        xgb_time_reg = XGBRegressor(**config["models"]["xgboost"], eval_metric="mae", n_jobs=-1)
        xgb_time_reg.fit(X_train[reg_time_mask_tr], train_df.loc[reg_time_mask_tr, time_reg_target].values)
        time_reg_pred = xgb_time_reg.predict(X_test[reg_time_mask_te])
        time_reg_metrics = evaluate_regressor(test_df.loc[reg_time_mask_te, time_reg_target].values, time_reg_pred)

        print(f"\n  Horizon {h}M Unseen Projects (Train N={len(train_df):,}, Test N={len(test_df):,} across {test_df['project_id'].nunique()} projects):")
        print(f"    Cost Escalation Classifier: ROC-AUC={cost_metrics['roc_auc']} | PR-AUC={cost_metrics['pr_auc']} | F1={cost_metrics['f1']}")
        print(f"    Schedule Delay Classifier:  ROC-AUC={time_metrics['roc_auc']} | PR-AUC={time_metrics['pr_auc']} | F1={time_metrics['f1']}")
        print(f"    Cost Overrun Regressor:     MAE={cost_reg_metrics['mae']:.2f}% | RMSE={cost_reg_metrics['rmse']:.2f}% | R2={cost_reg_metrics['r2']:.3f}")
        print(f"    Schedule Delay Regressor:   MAE={time_reg_metrics['mae']:.2f} mo | RMSE={time_reg_metrics['rmse']:.2f} mo | R2={time_reg_metrics['r2']:.3f}")

        unseen_results[f"{h}m"] = {
            "train_samples": int(len(train_df)),
            "test_samples": int(len(test_df)),
            "test_unique_projects": int(test_df["project_id"].nunique()),
            "cost_classification": cost_metrics,
            "time_classification": time_metrics,
            "cost_regression": cost_reg_metrics,
            "time_regression": time_reg_metrics,
        }

    return unseen_results


def evaluate_history_depth(df: pd.DataFrame, config: dict) -> Dict[str, Any]:
    """
    Evaluate how model accuracy evolves as project history depth increases (1m, 2-3m, 4-6m, >6m).
    """
    print(f"\n{'=' * 75}")
    print(f"EVALUATION C: PERFORMANCE BY PROJECT HISTORY DEPTH")
    print(f"{'=' * 75}")

    feature_split = get_available_feature_split(df, is_cold=False)
    feature_cols = feature_split["categorical"] + feature_split["numeric"]
    
    cls_target = "additional_cost_escalation_event_3m"
    valid_df = df[df[cls_target].notna()].copy()
    
    # Train cutoff at 2021
    train_mask = valid_df["report_month"] < "2021-01-01"
    val_mask = valid_df["report_month"] >= "2021-01-01"

    train_df = valid_df[train_mask]
    val_df = valid_df[val_mask]

    prep = build_preprocessor(train_df[feature_cols], feature_split["categorical"], feature_split["numeric"], is_cold=False)
    X_train = transform_features(train_df[feature_cols], prep)
    y_train = train_df[cls_target].values

    scale_pos = max(float((y_train == 0).sum() / max((y_train == 1).sum(), 1)), 1.0)
    xgb = XGBClassifier(**config["models"]["xgboost"], scale_pos_weight=scale_pos, eval_metric="logloss", n_jobs=-1)
    calibrated = CalibratedClassifierCV(xgb, method="sigmoid", cv=3)
    calibrated.fit(X_train, y_train)

    # Bucket evaluation by snapshot history count
    val_df = val_df.copy()
    val_df["snap_bucket"] = pd.cut(
        val_df["snapshot_history_count"],
        bins=[0, 1, 3, 6, 12, 999],
        labels=["1 month (Inception)", "2-3 months", "4-6 months", "7-12 months", "13+ months (Mature)"]
    )

    depth_results = {}
    for bucket, grp in val_df.groupby("snap_bucket", observed=False):
        if len(grp) < 50:
            continue
        X_sub = transform_features(grp[feature_cols], prep)
        y_sub = grp[cls_target].values
        proba = calibrated.predict_proba(X_sub)[:, 1]
        m = evaluate_classifier(y_sub, proba)
        print(f"  History {bucket:<22}: N={len(grp):>6} | ROC-AUC={m['roc_auc']} | PR-AUC={m['pr_auc']} | PosRate={y_sub.mean()*100:.1f}%")
        depth_results[str(bucket)] = {
            "samples": int(len(grp)),
            "pos_rate": round(float(y_sub.mean()), 4),
            "roc_auc": m["roc_auc"],
            "pr_auc": m["pr_auc"],
            "f1": m["f1"],
        }

    return depth_results


def evaluate_completed_projects(df: pd.DataFrame, config: dict) -> Dict[str, Any]:
    """
    Evaluation D — Completed Project Historical Outcome Analysis.
    """
    print(f"\n{'=' * 75}")
    print(f"EVALUATION D: COMPLETED PROJECT HISTORICAL ANALYSIS")
    print(f"{'=' * 75}")

    completed_mask = (df["schedule_status"] == "Completed") | (df["physical_progress_pct"] == 100.0)
    completed_df = df[completed_mask]
    completed_pids = completed_df["project_id"].unique()

    print(f"  Total completed projects identified: {len(completed_pids)}")
    print(f"  Total completed project snapshots in history: {len(completed_df)}")

    # Summary statistics on completed projects
    final_snaps = completed_df.sort_values("report_month").groupby("project_id").last()
    
    mean_cost_overrun = final_snaps["cost_overrun_pct"].mean()
    median_cost_overrun = final_snaps["cost_overrun_pct"].median()
    overrun_projects_pct = (final_snaps["cost_overrun_pct"] > 0).mean() * 100

    mean_sched_ext = final_snaps["schedule_extension_months"].mean()
    median_sched_ext = final_snaps["schedule_extension_months"].median()
    delayed_projects_pct = (final_snaps["schedule_extension_months"] > 0).mean() * 100

    print(f"  Completed Projects Cost Overrun: Mean={mean_cost_overrun:.1f}%, Median={median_cost_overrun:.1f}%, With Escalation={overrun_projects_pct:.1f}%")
    print(f"  Completed Projects Schedule Extension: Mean={mean_sched_ext:.1f} mo, Median={median_sched_ext:.1f} mo, With Delay={delayed_projects_pct:.1f}%")

    return {
        "completed_projects_count": int(len(completed_pids)),
        "completed_snapshots_count": int(len(completed_df)),
        "cost_overrun_pct_mean": round(float(mean_cost_overrun), 2),
        "cost_overrun_pct_median": round(float(median_cost_overrun), 2),
        "pct_projects_with_cost_overrun": round(float(overrun_projects_pct), 1),
        "schedule_extension_months_mean": round(float(mean_sched_ext), 2),
        "schedule_extension_months_median": round(float(median_sched_ext), 2),
        "pct_projects_with_delay": round(float(delayed_projects_pct), 1),
    }
