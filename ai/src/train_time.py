"""
Schedule Delay Model Training for PAIMANA ML.

Trains baseline (LogisticRegression/Ridge) and XGBoost models
for incremental schedule delay classification and regression at 3M and 6M horizons,
using expanding-window walk-forward cross-validation with zero temporal leakage.
Trains separate Mature Project and Cold-Start Project models.
"""

import numpy as np
import pandas as pd
import joblib
from pathlib import Path
from sklearn.linear_model import LogisticRegression, Ridge
from sklearn.calibration import CalibratedClassifierCV
from xgboost import XGBClassifier, XGBRegressor
from typing import Dict, Any, Tuple, Optional

from src.feature_selection import get_available_feature_split, is_cold_start
from src.preprocessing import build_preprocessor, transform_features
from src.walk_forward import generate_walk_forward_folds, print_fold_summary
from src.evaluate import (
    evaluate_classifier, evaluate_regressor,
    aggregate_fold_metrics, print_metrics
)


def train_time_models(df: pd.DataFrame, config: dict,
                      models_dir: str = None) -> Dict[str, Any]:
    """
    Train incremental schedule delay models for all horizons using walk-forward validation.
    Trains both Mature models and Cold-Start models.

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
    (models_dir / "cold_start").mkdir(parents=True, exist_ok=True)
    (models_dir / "preprocessing").mkdir(parents=True, exist_ok=True)
    (models_dir / "cold_start" / "preprocessing").mkdir(parents=True, exist_ok=True)

    horizons = config["prediction"]["horizons"]
    threshold = config.get("schedule", {}).get("additional_delay_threshold_months", 0.0)

    all_results = {}

    mature_split = get_available_feature_split(df, is_cold=False)
    mature_cols = mature_split["categorical"] + mature_split["numeric"]

    cold_split = get_available_feature_split(df, is_cold=True)
    cold_cols = cold_split["categorical"] + cold_split["numeric"]

    cold_mask = is_cold_start(df)

    for horizon in horizons:
        print(f"\n{'#' * 75}")
        print(f"# MATURE SCHEDULE DELAY MODELS — {horizon}M HORIZON")
        print(f"{'#' * 75}")

        cls_target = f"additional_delay_event_{horizon}m"
        reg_target = f"additional_delay_months_{horizon}m"

        if cls_target not in df.columns:
            print(f"[WARNING] Target {cls_target} not found. Skipping.")
            continue

        # ===== 1. MATURE CLASSIFICATION =====
        print(f"\n--- Mature Classification: {cls_target} (Threshold > {threshold} mo) ---")
        mature_df = df[~cold_mask].copy()
        cls_folds = generate_walk_forward_folds(mature_df, horizon, cls_target)

        if not cls_folds:
            print(f"[WARNING] No valid folds for mature {cls_target}.")
        else:
            print_fold_summary(cls_folds, f"{horizon}M Mature Schedule Delay Classification")
            baseline_cls_metrics = []
            xgb_cls_metrics = []

            for i, fold in enumerate(cls_folds):
                train_feat = mature_df.loc[fold["train_indices"], mature_cols]
                val_feat = mature_df.loc[fold["val_indices"], mature_cols]

                preprocessor = build_preprocessor(train_feat, mature_split["categorical"], mature_split["numeric"], is_cold=False)
                X_train = transform_features(train_feat, preprocessor)
                X_val = transform_features(val_feat, preprocessor)

                y_train = mature_df.loc[fold["train_indices"], cls_target].values
                y_val = mature_df.loc[fold["val_indices"], cls_target].values

                n_pos = (y_train == 1).sum()
                n_neg = (y_train == 0).sum()
                scale_pos = max(float(n_neg / max(n_pos, 1)), 1.0)

                b_model = LogisticRegression(max_iter=500, C=1.0, class_weight="balanced", random_state=42)
                b_model.fit(X_train, y_train)
                b_proba = b_model.predict_proba(X_val)[:, 1] if len(np.unique(y_train)) > 1 else np.zeros(len(y_val))
                b_metrics = evaluate_classifier(y_val, b_proba)
                baseline_cls_metrics.append(b_metrics)

                xgb_params = config["models"]["xgboost"].copy()
                base_xgb = XGBClassifier(**xgb_params, scale_pos_weight=scale_pos, eval_metric="logloss", n_jobs=-1)
                
                calibrated_xgb = CalibratedClassifierCV(base_xgb, method="sigmoid", cv=3)
                calibrated_xgb.fit(X_train, y_train)

                x_proba = calibrated_xgb.predict_proba(X_val)[:, 1]
                x_metrics = evaluate_classifier(y_val, x_proba)
                xgb_cls_metrics.append(x_metrics)
                print(f"  Fold {i+1} ({fold['val_period']}): XGB ROC-AUC={x_metrics['roc_auc']} | PR-AUC={x_metrics['pr_auc']} | F1={x_metrics['f1']} | Baseline PR-AUC={b_metrics['pr_auc']}")

            agg_baseline = aggregate_fold_metrics(baseline_cls_metrics)
            agg_xgb = aggregate_fold_metrics(xgb_cls_metrics)

            print(f"\n  Retraining final Mature Schedule Classifier {horizon}M on all eligible data...")
            labeled_mask = mature_df[cls_target].notna()
            all_train_feat = mature_df.loc[labeled_mask, mature_cols]
            y_all = mature_df.loc[labeled_mask, cls_target].values

            final_prep = build_preprocessor(all_train_feat, mature_split["categorical"], mature_split["numeric"], is_cold=False)
            X_all = transform_features(all_train_feat, final_prep)

            n_pos_all = (y_all == 1).sum()
            n_neg_all = (y_all == 0).sum()
            scale_pos_all = max(float(n_neg_all / max(n_pos_all, 1)), 1.0)

            final_base_xgb = XGBClassifier(**config["models"]["xgboost"], scale_pos_weight=scale_pos_all, eval_metric="logloss", n_jobs=-1)
            final_xgb = CalibratedClassifierCV(final_base_xgb, method="sigmoid", cv=3)
            final_xgb.fit(X_all, y_all)

            joblib.dump(final_xgb, models_dir / f"time_classifier_{horizon}m.pkl")
            joblib.dump(final_prep, models_dir / "preprocessing" / f"time_cls_{horizon}m_preprocessor.pkl")
            print(f"  [OK] Saved time_classifier_{horizon}m.pkl")

            all_results[f"time_classifier_{horizon}m"] = {
                "aggregated": agg_xgb,
                "folds": xgb_cls_metrics,
                "baseline_aggregated": agg_baseline,
            }

        # ===== 2. MATURE REGRESSION =====
        print(f"\n--- Mature Regression: {reg_target} ---")
        reg_folds = generate_walk_forward_folds(mature_df, horizon, reg_target)

        if not reg_folds:
            print(f"[WARNING] No valid folds for mature {reg_target}.")
        else:
            print_fold_summary(reg_folds, f"{horizon}M Mature Schedule Delay Regression")
            baseline_reg_metrics = []
            xgb_reg_metrics = []

            for i, fold in enumerate(reg_folds):
                train_feat = mature_df.loc[fold["train_indices"], mature_cols]
                val_feat = mature_df.loc[fold["val_indices"], mature_cols]

                preprocessor = build_preprocessor(train_feat, mature_split["categorical"], mature_split["numeric"], is_cold=False)
                X_train = transform_features(train_feat, preprocessor)
                X_val = transform_features(val_feat, preprocessor)

                y_train = mature_df.loc[fold["train_indices"], reg_target].values
                y_val = mature_df.loc[fold["val_indices"], reg_target].values

                b_reg = Ridge(alpha=1.0, random_state=42)
                b_reg.fit(X_train, y_train)
                b_pred = b_reg.predict(X_val)
                b_metrics = evaluate_regressor(y_val, b_pred)
                baseline_reg_metrics.append(b_metrics)

                xgb_reg = XGBRegressor(**config["models"]["xgboost"], eval_metric="mae", n_jobs=-1)
                xgb_reg.fit(X_train, y_train)
                x_pred = xgb_reg.predict(X_val)
                x_metrics = evaluate_regressor(y_val, x_pred)
                xgb_reg_metrics.append(x_metrics)
                print(f"  Fold {i+1} ({fold['val_period']}): XGB MAE={x_metrics['mae']:.2f} mo | RMSE={x_metrics['rmse']:.2f} | R2={x_metrics['r2']:.3f} | Baseline MAE={b_metrics['mae']:.2f}")

            agg_base_reg = aggregate_fold_metrics(baseline_reg_metrics)
            agg_xgb_reg = aggregate_fold_metrics(xgb_reg_metrics)

            print(f"\n  Retraining final Mature Schedule Regressor {horizon}M on all eligible data...")
            labeled_reg_mask = mature_df[reg_target].notna()
            all_reg_feat = mature_df.loc[labeled_reg_mask, mature_cols]
            y_all_reg = mature_df.loc[labeled_reg_mask, reg_target].values

            final_reg_prep = build_preprocessor(all_reg_feat, mature_split["categorical"], mature_split["numeric"], is_cold=False)
            X_all_reg = transform_features(all_reg_feat, final_reg_prep)

            final_xgb_reg = XGBRegressor(**config["models"]["xgboost"], eval_metric="mae", n_jobs=-1)
            final_xgb_reg.fit(X_all_reg, y_all_reg)

            joblib.dump(final_xgb_reg, models_dir / f"time_regressor_{horizon}m.pkl")
            joblib.dump(final_reg_prep, models_dir / "preprocessing" / f"time_reg_{horizon}m_preprocessor.pkl")
            print(f"  [OK] Saved time_regressor_{horizon}m.pkl")

            all_results[f"time_regressor_{horizon}m"] = {
                "aggregated": agg_xgb_reg,
                "folds": xgb_reg_metrics,
                "baseline_aggregated": agg_base_reg,
            }

        # ===== 3. COLD-START SCHEDULE MODELS =====
        print(f"\n{'#' * 75}")
        print(f"# COLD-START SCHEDULE DELAY MODELS — {horizon}M HORIZON")
        print(f"{'#' * 75}")

        cold_df = df[cold_mask].copy()
        cold_cls_folds = generate_walk_forward_folds(cold_df, horizon, cls_target)

        if cold_cls_folds:
            cold_xgb_cls_metrics = []
            for i, fold in enumerate(cold_cls_folds):
                train_feat = cold_df.loc[fold["train_indices"], cold_cols]
                val_feat = cold_df.loc[fold["val_indices"], cold_cols]

                prep_cold = build_preprocessor(train_feat, cold_split["categorical"], cold_split["numeric"], is_cold=True)
                X_train = transform_features(train_feat, prep_cold)
                X_val = transform_features(val_feat, prep_cold)

                y_train = cold_df.loc[fold["train_indices"], cls_target].values
                y_val = cold_df.loc[fold["val_indices"], cls_target].values

                n_pos = (y_train == 1).sum()
                n_neg = (y_train == 0).sum()
                scale_pos = max(float(n_neg / max(n_pos, 1)), 1.0)

                cold_xgb = XGBClassifier(**config["models"]["xgboost"], scale_pos_weight=scale_pos, eval_metric="logloss", n_jobs=-1)
                calibrated_cold_xgb = CalibratedClassifierCV(cold_xgb, method="sigmoid", cv=3)
                calibrated_cold_xgb.fit(X_train, y_train)

                x_proba = calibrated_cold_xgb.predict_proba(X_val)[:, 1]
                x_metrics = evaluate_classifier(y_val, x_proba)
                cold_xgb_cls_metrics.append(x_metrics)

            agg_cold_cls = aggregate_fold_metrics(cold_xgb_cls_metrics)
            all_results[f"cold_start_time_classifier_{horizon}m"] = {
                "aggregated": agg_cold_cls,
                "folds": cold_xgb_cls_metrics,
            }

            labeled_cold = cold_df[cls_target].notna()
            all_cold_feat = cold_df.loc[labeled_cold, cold_cols]
            y_all_cold = cold_df.loc[labeled_cold, cls_target].values

            final_cold_prep = build_preprocessor(all_cold_feat, cold_split["categorical"], cold_split["numeric"], is_cold=True)
            X_all_cold = transform_features(all_cold_feat, final_cold_prep)

            n_pos_all = (y_all_cold == 1).sum()
            n_neg_all = (y_all_cold == 0).sum()
            scale_pos_all = max(float(n_neg_all / max(n_pos_all, 1)), 1.0)

            final_base_cold = XGBClassifier(**config["models"]["xgboost"], scale_pos_weight=scale_pos_all, eval_metric="logloss", n_jobs=-1)
            final_cold_cls = CalibratedClassifierCV(final_base_cold, method="sigmoid", cv=3)
            final_cold_cls.fit(X_all_cold, y_all_cold)

            joblib.dump(final_cold_cls, models_dir / "cold_start" / f"time_classifier_{horizon}m.pkl")
            joblib.dump(final_cold_prep, models_dir / "cold_start" / "preprocessing" / f"time_cls_{horizon}m_preprocessor.pkl")
            print(f"  [OK] Saved cold_start/time_classifier_{horizon}m.pkl")

    return all_results
