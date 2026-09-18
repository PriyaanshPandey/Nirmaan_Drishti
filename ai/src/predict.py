"""
Prediction module for PAIMANA ML.

Runs incremental cost and schedule predictions using saved mature and cold-start models.
Derives final consistent outcomes mathematically:
- Final Cost % = Current Cost % + Predicted Additional Cost %
- Final Cost Amount = Current Cost Amount + Predicted Additional Cost Amount
- Final Extension = Current Extension + Predicted Additional Delay
"""

import numpy as np
import pandas as pd
import joblib
from pathlib import Path
from typing import Dict, Any, Optional

from src.feature_selection import get_available_feature_split, is_cold_start
from src.preprocessing import transform_features


def load_model(model_path: str):
    """Load a saved model from disk."""
    path = Path(model_path)
    if not path.exists():
        raise FileNotFoundError(f"Model not found: {path}")
    return joblib.load(path)


def load_all_models(models_dir: str = None) -> Dict[str, Any]:
    """
    Load all saved models and preprocessors (both Mature and Cold-Start).

    Returns
    -------
    dict
        {model_name: model_object} for all available models.
    """
    if models_dir is None:
        models_dir = Path(__file__).parent.parent / "models"
    models_dir = Path(models_dir)

    models = {}

    # Mature models
    mature_model_files = {
        "cost_classifier_3m": "cost_classifier_3m.pkl",
        "cost_regressor_3m": "cost_regressor_3m.pkl",
        "cost_classifier_6m": "cost_classifier_6m.pkl",
        "cost_regressor_6m": "cost_regressor_6m.pkl",
        "time_classifier_3m": "time_classifier_3m.pkl",
        "time_regressor_3m": "time_regressor_3m.pkl",
        "time_classifier_6m": "time_classifier_6m.pkl",
        "time_regressor_6m": "time_regressor_6m.pkl",
        "cost_cls_3m_preprocessor": "preprocessing/cost_cls_3m_preprocessor.pkl",
        "cost_reg_3m_preprocessor": "preprocessing/cost_reg_3m_preprocessor.pkl",
        "cost_cls_6m_preprocessor": "preprocessing/cost_cls_6m_preprocessor.pkl",
        "cost_reg_6m_preprocessor": "preprocessing/cost_reg_6m_preprocessor.pkl",
        "time_cls_3m_preprocessor": "preprocessing/time_cls_3m_preprocessor.pkl",
        "time_reg_3m_preprocessor": "preprocessing/time_reg_3m_preprocessor.pkl",
        "time_cls_6m_preprocessor": "preprocessing/time_cls_6m_preprocessor.pkl",
        "time_reg_6m_preprocessor": "preprocessing/time_reg_6m_preprocessor.pkl",
    }

    # Cold-start models
    cold_model_files = {
        "cold_cost_classifier_3m": "cold_start/cost_classifier_3m.pkl",
        "cold_cost_classifier_6m": "cold_start/cost_classifier_6m.pkl",
        "cold_time_classifier_3m": "cold_start/time_classifier_3m.pkl",
        "cold_time_classifier_6m": "cold_start/time_classifier_6m.pkl",
        "cold_cost_cls_3m_preprocessor": "cold_start/preprocessing/cost_cls_3m_preprocessor.pkl",
        "cold_cost_cls_6m_preprocessor": "cold_start/preprocessing/cost_cls_6m_preprocessor.pkl",
        "cold_time_cls_3m_preprocessor": "cold_start/preprocessing/time_cls_3m_preprocessor.pkl",
        "cold_time_cls_6m_preprocessor": "cold_start/preprocessing/time_cls_6m_preprocessor.pkl",
    }

    all_files = {**mature_model_files, **cold_model_files}
    for name, fname in all_files.items():
        path = models_dir / fname
        if path.exists():
            try:
                models[name] = joblib.load(path)
            except Exception as e:
                print(f"[WARNING] Error loading {name}: {e}")
        else:
            pass

    # Load synchronized canonical XGBoost models and full preprocessor from train_models.py
    json_model_files = {
        "best_model_schedule_delay": "best_model_schedule_delay.json",
        "xgb_schedule_model": "best_model_schedule_delay.json",
        "best_model_anticipated_cost": "best_model_anticipated_cost.json",
        "best_model_delay_risk": "best_model_delay_risk.json",
    }
    for name, fname in json_model_files.items():
        path = models_dir / fname
        if not path.exists():
            fallback = Path(models_dir).parent.parent / "results" / "best_model" / fname
            if fallback.exists():
                path = fallback
        if path.exists():
            try:
                import xgboost as xgb
                if "risk" in name or "classifier" in name:
                    m = xgb.XGBClassifier()
                else:
                    m = xgb.XGBRegressor()
                m.load_model(str(path))
                models[name] = m
            except Exception as e:
                print(f"[WARNING] Error loading {name} from {path}: {e}")

    # Canonical full preprocessor
    prep_path = models_dir / "preprocessor.joblib"
    if not prep_path.exists():
        prep_path = Path(models_dir).parent.parent / "results" / "best_model" / "preprocessor.joblib"
    if prep_path.exists() and "preprocessor" not in models:
        try:
            models["preprocessor"] = joblib.load(prep_path)
        except Exception as e:
            print(f"[WARNING] Error loading preprocessor.joblib: {e}")

    print(f"Loaded {len(models)} model/preprocessor files from {models_dir}.")
    return models


def predict_cost(features_df: pd.DataFrame, models: Dict,
                 current_status: Dict,
                 horizons: list = None,
                 is_cold: bool = False) -> Dict[str, Any]:
    """
    Run incremental cost overrun predictions and derive final totals.
    """
    if horizons is None:
        horizons = [3, 6]

    curr_cost_ov_pct = current_status.get("cost_overrun_pct") or 0.0
    curr_cost_ov_cr = current_status.get("cost_escalation_crore") or 0.0
    orig_cost_cr = current_status.get("original_cost_crore") or 0.0

    results = {}

    for h in horizons:
        h_result = {}

        prefix = "cold_" if is_cold else ""
        cls_key = f"{prefix}cost_classifier_{h}m"
        prep_key = f"{prefix}cost_cls_{h}m_preprocessor"

        if cls_key in models and prep_key in models:
            X = models[prep_key].transform(features_df)
            proba = models[cls_key].predict_proba(X)[0, 1]
            h_result["additional_escalation_probability"] = round(float(proba), 4)
            h_result["escalation_risk_level"] = "HIGH" if proba >= 0.50 else ("MEDIUM" if proba >= 0.25 else "LOW")
        else:
            h_result["additional_escalation_probability"] = None
            h_result["escalation_risk_level"] = "UNKNOWN"

        # Mature regressor
        reg_key = f"cost_regressor_{h}m"
        reg_prep_key = f"cost_reg_{h}m_preprocessor"
        if reg_key in models and reg_prep_key in models and not is_cold:
            X_reg = models[reg_prep_key].transform(features_df)
            pred_delta_pct = float(models[reg_key].predict(X_reg)[0])
            pred_delta_cr = float(orig_cost_cr * (pred_delta_pct / 100.0))

            h_result["predicted_additional_overrun_pct"] = round(pred_delta_pct, 2)
            h_result["predicted_additional_cost_crore"] = round(pred_delta_cr, 2)
            h_result["predicted_final_cost_overrun_pct"] = round(curr_cost_ov_pct + pred_delta_pct, 2)
            h_result["predicted_final_cost_escalation_crore"] = round(curr_cost_ov_cr + pred_delta_cr, 2)
            h_result["predicted_final_revised_cost_crore"] = round(orig_cost_cr + (curr_cost_ov_cr + pred_delta_cr), 2)
        else:
            h_result["predicted_additional_overrun_pct"] = None
            h_result["predicted_additional_cost_crore"] = None
            h_result["predicted_final_cost_overrun_pct"] = curr_cost_ov_pct
            h_result["predicted_final_cost_escalation_crore"] = curr_cost_ov_cr
            h_result["predicted_final_revised_cost_crore"] = orig_cost_cr + curr_cost_ov_cr

        results[f"{h}_month"] = h_result

    return results


def predict_time(features_df: pd.DataFrame, models: Dict,
                 current_status: Dict,
                 horizons: list = None,
                 is_cold: bool = False) -> Dict[str, Any]:
    """
    Run incremental schedule delay predictions and derive total extension.
    """
    if horizons is None:
        horizons = [3, 6]

    curr_extension = current_status.get("schedule_extension_months") or 0.0

    results = {}

    for h in horizons:
        h_result = {}

        prefix = "cold_" if is_cold else ""
        cls_key = f"{prefix}time_classifier_{h}m"
        prep_key = f"{prefix}time_cls_{h}m_preprocessor"

        if cls_key in models and prep_key in models:
            X = models[prep_key].transform(features_df)
            proba = models[cls_key].predict_proba(X)[0, 1]
            h_result["additional_delay_probability"] = round(float(proba), 4)
            h_result["delay_risk_level"] = "HIGH" if proba >= 0.50 else ("MEDIUM" if proba >= 0.25 else "LOW")
        else:
            h_result["additional_delay_probability"] = None
            h_result["delay_risk_level"] = "UNKNOWN"

        # Mature regressor
        reg_key = f"time_regressor_{h}m"
        reg_prep_key = f"time_reg_{h}m_preprocessor"
        if reg_key in models and reg_prep_key in models and not is_cold:
            X_reg = models[reg_prep_key].transform(features_df)
            pred_delta_months = float(models[reg_key].predict(X_reg)[0])
            h_result["predicted_additional_delay_months"] = round(pred_delta_months, 2)
            h_result["predicted_total_schedule_extension_months"] = round(curr_extension + pred_delta_months, 2)
        else:
            h_result["predicted_additional_delay_months"] = None
            h_result["predicted_total_schedule_extension_months"] = curr_extension

        results[f"{h}_month"] = h_result

    return results
