"""
Incremental Schedule Overrun Model Training for PAIMANA ML.

Trains baseline (LogisticRegression/Ridge) and XGBoost models
for incremental schedule delay classification and regression at 3M and 6M horizons,
using walk-forward cross-validation with probability calibration.
"""

import numpy as np
import pandas as pd
import joblib
from pathlib import Path
from sklearn.linear_model import LogisticRegression, Ridge
from sklearn.calibration import CalibratedClassifierCV
from xgboost import XGBClassifier, XGBRegressor
from typing import Dict, Any, Tuple, Optional

from src.feature_selection import get_available_feature_split, get_feature_columns
from src.preprocessing import build_preprocessor, transform_features, get_feature_names
from src.walk_forward import generate_walk_forward_folds, print_fold_summary
from src.evaluate import (
    evaluate_classifier, evaluate_regressor,
    aggregate_fold_metrics, print_metrics, print_comparison
)


def train_time_models(df: pd.DataFrame, config: dict,
                      models_dir: str = None) -> Dict[str, Any]:
    """
    Train incremental schedule delay models for all horizons using walk-forward validation.

    Parameters
    ----------
    df : pd.DataFrame
        Dataset with incremental schedule target columns generated.
    config : dict
        Configuration dictionary.
    models_dir : str, optional
        Directory to save models.

    Returns
    -------
    dict
        All metrics and trained models.
    """
    if models_dir is None:
        models_dir = Path(__file__).parent.parent / config["output"]["models_dir"]
    models_dir = Path(models_dir)
    models_dir.mkdir(parents=True, exist_ok=True)

    horizons = config["prediction"]["horizons"]
    threshold = config.get("schedule", {}).get("additional_delay_threshold_months", 0.0)
    calibrate = config.get("models", {}).get("calibration", {}).get("enabled", True)
    calib_method = config.get("models", {}).get("calibration", {}).get("method", "sigmoid")

    all_results = {}

    feature_split = get_available_feature_split(df)
    feature_cols = feature_split["categorical"] + feature_split["numeric"]

    for horizon in horizons:
        print(f"\n{'#' * 70}")
        print(f"# INCREMENTAL SCHEDULE MODELS — {horizon}M HORIZON")
        print(f"{'#' * 70}")

        cls_target = f"additional_delay_event_{horizon}m"
        reg_target = f"additional_delay_months_{horizon}m"

        if cls_target not in df.columns:
            print(f"[WARNING] Target {cls_target} not found. Skipping.")
            continue

        # ===== CLASSIFICATION =====
        print(f"\n--- Classification: {cls_target} (Threshold > {threshold} mo) ---")
        cls_folds = generate_walk_forward_folds(
            df, horizon, cls_target,
            min_positive=config.get("walk_forward", {}).get("min_positive_examples", 5),
            min_negative=config.get("walk_forward", {}).get("min_negative_examples", 5)
        )

        if not cls_folds:
            print(f"[WARNING] No valid folds for {cls_target}. Skipping classification.")
            continue

        print_fold_summary(cls_folds, f"{horizon}M Incremental Schedule Delay Classification")

        baseline_cls_metrics = []
        xgb_cls_metrics = []

        for i, fold in enumerate(cls_folds):
            print(f"\n  Fold {i + 1}:")

            # Fit preprocessor on TRAIN fold only (zero leakage)
            train_features = df.loc[fold["train_indices"], feature_cols]
            val_features = df.loc[fold["val_indices"], feature_cols]

            preprocessor = build_preprocessor(train_features, feature_split["categorical"], feature_split["numeric"])
            X_train = transform_features(train_features, preprocessor)
            X_val = transform_features(val_features, preprocessor)

            y_train = df.loc[fold["train_indices"], cls_target].values
            y_val = df.loc[fold["val_indices"], cls_target].values

            # Class imbalance ratio
            n_pos = (y_train == 1).sum()
            n_neg = (y_train == 0).sum()
            scale_pos = max(float(n_neg / max(n_pos, 1)), 1.0)

            # Baseline: Logistic Regression
            baseline_model = LogisticRegression(
                max_iter=config["models"]["logistic_regression"]["max_iter"],
                C=config["models"]["logistic_regression"]["C"],
                class_weight="balanced",
                random_state=config["models"]["logistic_regression"]["random_state"]
            )
            baseline_model.fit(X_train, y_train)
            baseline_proba = baseline_model.predict_proba(X_val)[:, 1] if len(np.unique(y_train)) > 1 else np.zeros(len(y_val))
            b_metrics = evaluate_classifier(y_val, baseline_proba)
            baseline_cls_metrics.append(b_metrics)
            print_metrics(b_metrics, f"Baseline (LogReg) Fold {i + 1}")

            # Candidate: XGBoost with probability calibration
            xgb_params = config["models"]["xgboost"].copy()
            xgb_model = XGBClassifier(
                **xgb_params,
                scale_pos_weight=scale_pos,
                eval_metric="logloss"
            )
            xgb_model.fit(X_train, y_train)

            if calibrate and len(np.unique(y_train)) > 1:
                calibrated_model = CalibratedClassifierCV(xgb_model, method=calib_method, cv="prefit")
                calibrated_model.fit(X_val, y_val)
                xgb_proba = calibrated_model.predict_proba(X_val)[:, 1]
            else:
                xgb_proba = xgb_model.predict_proba(X_val)[:, 1] if len(np.unique(y_train)) > 1 else np.zeros(len(y_val))

            x_metrics = evaluate_classifier(y_val, xgb_proba)
            xgb_cls_metrics.append(x_metrics)
            print_metrics(x_metrics, f"XGBoost Fold {i + 1}")

        # Summary & comparison
        agg_baseline = aggregate_fold_metrics(baseline_cls_metrics)
        agg_xgb = aggregate_fold_metrics(xgb_cls_metrics)
        print_comparison(agg_baseline, agg_xgb, f"Incremental Schedule Classifier {horizon}M")

        # Retrain final model on all labeled data
        print(f"\n  Retraining final Incremental Schedule Classifier {horizon}M on all labeled data...")
        labeled_mask = df[cls_target].notna()
        labeled_df = df[labeled_mask]

        final_preprocessor = build_preprocessor(labeled_df[feature_cols], feature_split["categorical"], feature_split["numeric"])
        X_all = transform_features(labeled_df[feature_cols], final_preprocessor)
        y_all = labeled_df[cls_target].values

        n_pos_all = (y_all == 1).sum()
        n_neg_all = (y_all == 0).sum()
        scale_pos_all = max(float(n_neg_all / max(n_pos_all, 1)), 1.0)

        final_xgb = XGBClassifier(
            **config["models"]["xgboost"],
            scale_pos_weight=scale_pos_all,
            eval_metric="logloss"
        )
        final_xgb.fit(X_all, y_all)

        joblib.dump(final_xgb, models_dir / f"time_classifier_{horizon}m.pkl")
        joblib.dump(final_preprocessor, models_dir / "preprocessing" / f"time_cls_{horizon}m_preprocessor.pkl")
        print(f"  [OK] Saved time_classifier_{horizon}m.pkl")

        all_results[f"time_classifier_{horizon}m"] = {
            "aggregated": agg_xgb,
            "folds": xgb_cls_metrics,
            "baseline_aggregated": agg_baseline,
        }

        # ===== REGRESSION =====
        print(f"\n--- Regression: {reg_target} ---")
        reg_folds = generate_walk_forward_folds(
            df, horizon, reg_target
        )

        if not reg_folds:
            print(f"[WARNING] No valid folds for {reg_target}. Skipping regression.")
            continue

        print_fold_summary(reg_folds, f"{horizon}M Incremental Schedule Delay Regression")

        baseline_reg_metrics = []
        xgb_reg_metrics = []

        for i, fold in enumerate(reg_folds):
            train_features = df.loc[fold["train_indices"], feature_cols]
            val_features = df.loc[fold["val_indices"], feature_cols]

            preprocessor = build_preprocessor(train_features, feature_split["categorical"], feature_split["numeric"])
            X_train = transform_features(train_features, preprocessor)
            X_val = transform_features(val_features, preprocessor)

            y_train = df.loc[fold["train_indices"], reg_target].values
            y_val = df.loc[fold["val_indices"], reg_target].values

            # Baseline: Ridge
            baseline_reg = Ridge(alpha=config["models"]["ridge"]["alpha"], random_state=42)
            baseline_reg.fit(X_train, y_train)
            b_pred = baseline_reg.predict(X_val)
            b_metrics = evaluate_regressor(y_val, b_pred)
            baseline_reg_metrics.append(b_metrics)
            print_metrics(b_metrics, f"Baseline (Ridge) Fold {i + 1}")

            # Candidate: XGBoost Regressor
            xgb_reg = XGBRegressor(**config["models"]["xgboost"], eval_metric="mae")
            xgb_reg.fit(X_train, y_train)
            x_pred = xgb_reg.predict(X_val)
            x_metrics = evaluate_regressor(y_val, x_pred)
            xgb_reg_metrics.append(x_metrics)
            print_metrics(x_metrics, f"XGBoost Fold {i + 1}")

        agg_baseline_reg = aggregate_fold_metrics(baseline_reg_metrics)
        agg_xgb_reg = aggregate_fold_metrics(xgb_reg_metrics)
        print_comparison(agg_baseline_reg, agg_xgb_reg, f"Incremental Schedule Regressor {horizon}M")

        # Retrain final regressor on all data
        print(f"\n  Retraining final Incremental Schedule Regressor {horizon}M on all data...")
        labeled_reg_mask = df[reg_target].notna()
        labeled_reg_df = df[labeled_reg_mask]

        final_reg_prep = build_preprocessor(labeled_reg_df[feature_cols], feature_split["categorical"], feature_split["numeric"])
        X_all_reg = transform_features(labeled_reg_df[feature_cols], final_reg_prep)
        y_all_reg = labeled_reg_df[reg_target].values

        final_xgb_reg = XGBRegressor(**config["models"]["xgboost"], eval_metric="mae")
        final_xgb_reg.fit(X_all_reg, y_all_reg)

        joblib.dump(final_xgb_reg, models_dir / f"time_regressor_{horizon}m.pkl")
        joblib.dump(final_reg_prep, models_dir / "preprocessing" / f"time_reg_{horizon}m_preprocessor.pkl")
        print(f"  [OK] Saved time_regressor_{horizon}m.pkl")

        all_results[f"time_regressor_{horizon}m"] = {
            "aggregated": agg_xgb_reg,
            "folds": xgb_reg_metrics,
            "baseline_aggregated": agg_baseline_reg,
        }

    return all_results
