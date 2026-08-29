"""
Prediction module for PAIMANA ML.

Runs incremental cost and schedule predictions using saved models.
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

from src.feature_selection import get_available_feature_split
from src.preprocessing import transform_features


def load_model(model_path: str):
    """Load a saved model from disk."""
    path = Path(model_path)
    if not path.exists():
        raise FileNotFoundError(f"Model not found: {path}")
    return joblib.load(path)


def load_all_models(models_dir: str = None) -> Dict[str, Any]:
    """
    Load all saved models and preprocessors.

    Returns
    -------
    dict
        {model_name: model_object} for all available models.
    """
    if models_dir is None:
        models_dir = Path(__file__).parent.parent / "models"
    models_dir = Path(models_dir)

    models = {}
    model_files = {
        "cost_classifier_3m": "cost_classifier_3m.pkl",
        "cost_regressor_3m": "cost_regressor_3m.pkl",
        "cost_classifier_6m": "cost_classifier_6m.pkl",
        "cost_regressor_6m": "cost_regressor_6m.pkl",
        "time_classifier_3m": "time_classifier_3m.pkl",
        "time_regressor_3m": "time_regressor_3m.pkl",
        "time_classifier_6m": "time_classifier_6m.pkl",
        "time_regressor_6m": "time_regressor_6m.pkl",
    }

    preprocessor_files = {
        "cost_cls_3m_preprocessor": "preprocessing/cost_cls_3m_preprocessor.pkl",
        "cost_reg_3m_preprocessor": "preprocessing/cost_reg_3m_preprocessor.pkl",
        "cost_cls_6m_preprocessor": "preprocessing/cost_cls_6m_preprocessor.pkl",
        "cost_reg_6m_preprocessor": "preprocessing/cost_reg_6m_preprocessor.pkl",
        "time_cls_3m_preprocessor": "preprocessing/time_cls_3m_preprocessor.pkl",
        "time_reg_3m_preprocessor": "preprocessing/time_reg_3m_preprocessor.pkl",
        "time_cls_6m_preprocessor": "preprocessing/time_cls_6m_preprocessor.pkl",
        "time_reg_6m_preprocessor": "preprocessing/time_reg_6m_preprocessor.pkl",
    }

    for name, fname in {**model_files, **preprocessor_files}.items():
        path = models_dir / fname
        if path.exists():
            models[name] = joblib.load(path)
        else:
            print(f"[WARNING] Model not found: {name} ({path})")

    print(f"Loaded {len(models)} model/preprocessor files.")
    return models


def predict_cost(features_df: pd.DataFrame, models: Dict,
                 current_status: Dict,
                 horizons: list = None) -> Dict[str, Any]:
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

        # Classification (probability of additional escalation)
        cls_key = f"cost_classifier_{h}m"
        prep_key = f"cost_cls_{h}m_preprocessor"
        if cls_key in models and prep_key in models:
            X = models[prep_key].transform(features_df)
            proba = models[cls_key].predict_proba(X)[0, 1]
            h_result["additional_escalation_probability"] = round(float(proba), 4)
        else:
            h_result["additional_escalation_probability"] = None

        # Regression (predicted incremental overrun % and ₹ Cr)
        reg_key = f"cost_regressor_{h}m"
        prep_key = f"cost_reg_{h}m_preprocessor"
        if reg_key in models and prep_key in models:
            X = models[prep_key].transform(features_df)
            pred_delta_pct = float(models[reg_key].predict(X)[0])
            
            pred_delta_cr = float(orig_cost_cr * (pred_delta_pct / 100.0))

            h_result["predicted_additional_overrun_pct"] = round(pred_delta_pct, 2)
            h_result["predicted_additional_cost_crore"] = round(pred_delta_cr, 2)

            # Mathematically consistent final totals
            h_result["predicted_final_cost_overrun_pct"] = round(curr_cost_ov_pct + pred_delta_pct, 2)
            h_result["predicted_final_cost_escalation_crore"] = round(curr_cost_ov_cr + pred_delta_cr, 2)
            h_result["predicted_final_revised_cost_crore"] = round(orig_cost_cr + (curr_cost_ov_cr + pred_delta_cr), 2)
        else:
            h_result["predicted_additional_overrun_pct"] = None
            h_result["predicted_additional_cost_crore"] = None
            h_result["predicted_final_cost_overrun_pct"] = None
            h_result["predicted_final_cost_escalation_crore"] = None
            h_result["predicted_final_revised_cost_crore"] = None

        results[f"{h}_month"] = h_result

    return results


def predict_time(features_df: pd.DataFrame, models: Dict,
                 current_status: Dict,
                 horizons: list = None) -> Dict[str, Any]:
    """
    Run incremental schedule delay predictions and derive total extension.

    Parameters
    ----------
    features_df : pd.DataFrame
        Single-row dataframe with feature columns.
    models : dict
        Loaded models dict.
    current_status : dict
        Dictionary of current reported metrics for the project.
    horizons : list
        Horizons to predict (default [3, 6]).

    Returns
    -------
    dict
        Schedule prediction results with incremental delay and total extension.
    """
    if horizons is None:
        horizons = [3, 6]

    curr_extension = current_status.get("schedule_extension_months") or 0.0

    results = {}

    for h in horizons:
        h_result = {}

        # Classification (probability of additional delay)
        cls_key = f"time_classifier_{h}m"
        prep_key = f"time_cls_{h}m_preprocessor"
        if cls_key in models and prep_key in models:
            X = models[prep_key].transform(features_df)
            proba = models[cls_key].predict_proba(X)[0, 1]
            h_result["additional_delay_probability"] = round(float(proba), 4)
        else:
            h_result["additional_delay_probability"] = None

        # Regression (predicted additional delay in months)
        reg_key = f"time_regressor_{h}m"
        prep_key = f"time_reg_{h}m_preprocessor"
        if reg_key in models and prep_key in models:
            X = models[prep_key].transform(features_df)
            pred_delta_months = float(models[reg_key].predict(X)[0])
            
            h_result["predicted_additional_delay_months"] = round(pred_delta_months, 2)
            h_result["predicted_total_schedule_extension_months"] = round(curr_extension + pred_delta_months, 2)
        else:
            h_result["predicted_additional_delay_months"] = None
            h_result["predicted_total_schedule_extension_months"] = None

        results[f"{h}_month"] = h_result

    return results
