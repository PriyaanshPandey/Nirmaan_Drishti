"""
predict.py - Prediction Engine for Nirmaan Drishti T+1 Next-Period Strategy.

Loads strictly the newly trained production T+1 models and preprocessors:
- Schedule Delay: ai/models/schedule_delay/production_model.pkl
- Cost Overrun:   ai/models/cost_overrun/production_model.pkl
- Anomaly:        ai/models/anomaly_detector/production_anomaly_detector.pkl

Produces clean T+1 probabilities:
- schedule_delay_probability (T -> T+1)
- cost_overrun_probability   (T -> T+1)
- anomaly detection flag & score
- calibrated centralized risk score
"""

import sys
import json
import logging
from pathlib import Path
from typing import Dict, Any, Optional
import numpy as np
import pandas as pd
import joblib

logger = logging.getLogger("sanket_ai.predict")

ROOT_DIR = Path(__file__).resolve().parent.parent.parent
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

try:
    from src.t1_pipeline import ChronologicalStackingRegressor
    sys.modules.setdefault("ai.src.t1_pipeline", sys.modules[ChronologicalStackingRegressor.__module__])
except Exception:
    pass


def load_model(model_path: str):
    """Load a saved model or preprocessor from disk."""
    path = Path(model_path)
    if not path.exists():
        raise FileNotFoundError(f"Model not found: {path}")
    return joblib.load(path)


def load_all_models(models_dir: str = None) -> Dict[str, Any]:
    """
    Load all production T+1 models, preprocessors, and SHAP metadata.

    Returns
    -------
    dict
        {model_key: model_object}
    """
    if models_dir is None:
        models_dir = ROOT_DIR / "ai" / "models"
    models_dir = Path(models_dir)

    models = {}

    # 1. Schedule Delay Production Model & Preprocessor
    sched_path = models_dir / "schedule_delay" / "production_model.pkl"
    sched_prep_path = models_dir / "schedule_delay" / "preprocessor.joblib"
    if sched_path.exists():
        models["schedule_delay_model"] = joblib.load(sched_path)
        # Aliases for backwards compatibility with any existing reference
        models["time_classifier_3m"] = models["schedule_delay_model"]
    if sched_prep_path.exists():
        models["schedule_delay_preprocessor"] = joblib.load(sched_prep_path)
        models["time_cls_3m_preprocessor"] = models["schedule_delay_preprocessor"]

    # 2. Cost Overrun Production Model & Preprocessor
    cost_path = models_dir / "cost_overrun" / "production_model.pkl"
    cost_prep_path = models_dir / "cost_overrun" / "preprocessor.joblib"
    if cost_path.exists():
        models["cost_overrun_model"] = joblib.load(cost_path)
        # Aliases for backwards compatibility
        models["cost_classifier_3m"] = models["cost_overrun_model"]
    if cost_prep_path.exists():
        models["cost_overrun_preprocessor"] = joblib.load(cost_prep_path)
        models["cost_cls_3m_preprocessor"] = models["cost_overrun_preprocessor"]

    # 3. Anomaly Detector & Preprocessor
    anom_path = models_dir / "anomaly_detector" / "production_anomaly_detector.pkl"
    anom_prep_path = models_dir / "anomaly_detector" / "preprocessor.joblib"
    if anom_path.exists():
        models["anomaly_detector"] = joblib.load(anom_path)
    if anom_prep_path.exists():
        models["anomaly_preprocessor"] = joblib.load(anom_prep_path)

    # 6. Schedule Regression Production Model & Preprocessor
    sched_reg_path = models_dir / "schedule_regression" / "production_model.pkl"
    sched_reg_prep = models_dir / "schedule_regression" / "preprocessor.joblib"
    if sched_reg_path.exists():
        try:
            models["schedule_regression_model"] = joblib.load(sched_reg_path)
        except Exception as e:
            print(f"[WARNING] Could not load schedule_regression_model: {e}")
    if sched_reg_prep.exists():
        models["schedule_regression_preprocessor"] = joblib.load(sched_reg_prep)

    # 7. Cost Regression Production Model & Preprocessor
    cost_reg_path = models_dir / "cost_regression" / "production_model.pkl"
    cost_reg_prep = models_dir / "cost_regression" / "preprocessor.joblib"
    if cost_reg_path.exists():
        try:
            models["cost_regression_model"] = joblib.load(cost_reg_path)
        except Exception as e:
            print(f"[WARNING] Could not load cost_regression_model: {e}")
    if cost_reg_prep.exists():
        models["cost_regression_preprocessor"] = joblib.load(cost_reg_prep)

    # 8. Transformed Feature Names for SHAP
    shap_names_path = models_dir / "shap" / "transformed_feature_names.json"
    if shap_names_path.exists():
        with open(shap_names_path, "r", encoding="utf-8") as f:
            models["transformed_feature_names"] = json.load(f)

    # 9. Model Metadata
    meta_path = models_dir / "model_metadata.json"
    if meta_path.exists():
        with open(meta_path, "r", encoding="utf-8") as f:
            models["model_metadata"] = json.load(f)

    print(f"Loaded {len(models)} model/preprocessor keys from {models_dir}.")
    return models


def predict_t1(features_df: pd.DataFrame,
               models: Dict[str, Any],
               current_status: Dict[str, Any]) -> Dict[str, Any]:
    """
    Run next-period (T+1) prediction using production classification and regression models.

    Parameters
    ----------
    features_df : pd.DataFrame
        Single-row or batch dataframe with features at observation time T.
    models : dict
        Dictionary of loaded models and preprocessors.
    current_status : dict
        Current reported metrics (cost_overrun_pct, schedule_extension_months, etc.).

    Returns
    -------
    dict
        Structured prediction output containing T+1 probabilities, continuous predictions, risk levels, and anomaly flags.
    """
    # 1. Schedule Delay Probability (T+1)
    sched_model = models.get("schedule_delay_model")
    sched_prep = models.get("schedule_delay_preprocessor")
    if sched_model is not None and sched_prep is not None:
        X_sched = sched_prep.transform(features_df)
        prob_sched = float(sched_model.predict_proba(X_sched)[0, 1])
    else:
        prob_sched = 0.5

    # 2. Cost Overrun Probability (T+1)
    cost_model = models.get("cost_overrun_model")
    cost_prep = models.get("cost_overrun_preprocessor")
    if cost_model is not None and cost_prep is not None:
        X_cost = cost_prep.transform(features_df)
        prob_cost = float(cost_model.predict_proba(X_cost)[0, 1])
    else:
        prob_cost = 0.5

    # 3. Schedule Regression (Predicted Future Delay Months)
    curr_extension = float(current_status.get("schedule_extension_months") or 0.0)
    sched_reg_model = models.get("schedule_regression_model")
    sched_reg_prep = models.get("schedule_regression_preprocessor", sched_prep)
    if sched_reg_model is not None and sched_reg_prep is not None:
        try:
            X_sr = sched_reg_prep.transform(features_df)
            pred_sched_delay = float(np.maximum(0.0, sched_reg_model.predict(X_sr)[0]))
        except Exception:
            pred_sched_delay = curr_extension
    else:
        pred_sched_delay = curr_extension
    pred_add_delay = max(0.0, pred_sched_delay - curr_extension)

    # 4. Cost Regression (Predicted Cost Multiplier -> Derived Future Cost & Overrun %)
    orig_cost_cr = float(current_status.get("original_cost_crore") or current_status.get("original_cost_cr") or 0.0)
    curr_cost_ov_cr = float(current_status.get("cost_escalation_crore") or 0.0)
    curr_cost_ov_pct = float(current_status.get("cost_overrun_pct") or 0.0)

    cost_reg_model = models.get("cost_regression_model")
    cost_reg_prep = models.get("cost_regression_preprocessor", cost_prep)
    if cost_reg_model is not None and cost_reg_prep is not None and orig_cost_cr > 0:
        try:
            X_cr = cost_reg_prep.transform(features_df)
            pred_mult = float(np.clip(cost_reg_model.predict(X_cr)[0], 0.5, 10.0))
            pred_future_cost_cr = round(pred_mult * orig_cost_cr, 2)
            pred_cost_overrun_pct = round((pred_mult - 1.0) * 100.0, 2)
            pred_cost_escalation_cr = round(max(0.0, pred_future_cost_cr - orig_cost_cr), 2)
            pred_add_overrun_pct = max(0.0, pred_cost_overrun_pct - curr_cost_ov_pct)
            pred_add_cost_cr = max(0.0, pred_future_cost_cr - (orig_cost_cr + curr_cost_ov_cr))
        except Exception:
            pred_mult = 1.0 + (curr_cost_ov_cr / orig_cost_cr if orig_cost_cr > 0 else 0.0)
            pred_future_cost_cr = orig_cost_cr + curr_cost_ov_cr
            pred_cost_overrun_pct = curr_cost_ov_pct
            pred_cost_escalation_cr = curr_cost_ov_cr
            pred_add_overrun_pct = 0.0
            pred_add_cost_cr = 0.0
    else:
        pred_mult = 1.0
        pred_future_cost_cr = orig_cost_cr + curr_cost_ov_cr
        pred_cost_overrun_pct = curr_cost_ov_pct
        pred_cost_escalation_cr = curr_cost_ov_cr
        pred_add_overrun_pct = 0.0
        pred_add_cost_cr = 0.0

    # 5. Anomaly Detection
    anom_model = models.get("anomaly_detector")
    anom_prep = models.get("anomaly_preprocessor", sched_prep)
    if anom_model is not None and anom_prep is not None:
        X_anom = anom_prep.transform(features_df)
        is_anom_val = anom_model.predict(X_anom)[0]  # -1 for anomaly, 1 for normal
        is_anomaly = bool(is_anom_val == -1)
        anom_score = float(anom_model.score_samples(X_anom)[0])
    else:
        is_anomaly = False
        anom_score = 0.0

    # 6. Centralized Risk Engine Integration
    raw_risk = (prob_sched * 50.0) + (prob_cost * 50.0)
    risk_score = round(float(np.clip(raw_risk, 0.0, 100.0)), 1)

    if risk_score >= 80.0:
        risk_level = "Critical"
    elif risk_score >= 60.0:
        risk_level = "High"
    elif risk_score >= 35.0:
        risk_level = "Medium"
    else:
        risk_level = "Low"

    sched_tier = "HIGH" if prob_sched >= 0.50 else ("MEDIUM" if prob_sched >= 0.25 else "LOW")
    cost_tier = "HIGH" if prob_cost >= 0.50 else ("MEDIUM" if prob_cost >= 0.25 else "LOW")

    result = {
        "schedule_delay_probability": round(prob_sched, 4),
        "cost_overrun_probability": round(prob_cost, 4),
        "schedule_delay_flag": int(prob_sched >= 0.50),
        "cost_overrun_flag": int(prob_cost >= 0.50),
        "schedule_risk_tier": sched_tier,
        "cost_risk_tier": cost_tier,
        "is_anomaly": is_anomaly,
        "anomaly_score": round(anom_score, 4),
        "risk_score": risk_score,
        "risk_level": risk_level,
        "predicted_schedule_delay_months": round(pred_sched_delay, 2),
        "predicted_additional_delay_months": round(pred_add_delay, 2),
        "predicted_cost_multiplier": round(pred_mult, 4),
        "predicted_future_cost_crore": round(pred_future_cost_cr, 2),
        "predicted_final_cost_escalation_crore": round(pred_cost_escalation_cr, 2),
        "predicted_cost_overrun_pct": round(pred_cost_overrun_pct, 2),
        "predicted_additional_overrun_pct": round(pred_add_overrun_pct, 2),
        "predicted_additional_cost_crore": round(pred_add_cost_cr, 2),
        "strategy": "T+1 Next-Period Classification & Regression"
    }

    return result


def predict_cost(features_df: pd.DataFrame, models: Dict,
                 current_status: Dict,
                 horizons: list = None,
                 is_cold: bool = False) -> Dict[str, Any]:
    """
    Backwards-compatible wrapper returning T+1 cost probability and derived continuous regression totals.
    """
    t1_res = predict_t1(features_df, models, current_status)
    prob = t1_res["cost_overrun_probability"]
    tier = t1_res["cost_risk_tier"]

    payload = {
        "additional_escalation_probability": prob,
        "escalation_risk_level": tier,
        "predicted_additional_overrun_pct": t1_res["predicted_additional_overrun_pct"],
        "predicted_additional_cost_crore": t1_res["predicted_additional_cost_crore"],
        "predicted_final_cost_overrun_pct": t1_res["predicted_cost_overrun_pct"],
        "predicted_final_cost_escalation_crore": t1_res["predicted_final_cost_escalation_crore"],
        "predicted_final_revised_cost_crore": t1_res["predicted_future_cost_crore"],
    }

    return {
        "t_plus_1": payload,
        "3_month": payload,
    }


def predict_time(features_df: pd.DataFrame, models: Dict,
                 current_status: Dict,
                 horizons: list = None,
                 is_cold: bool = False) -> Dict[str, Any]:
    """
    Backwards-compatible wrapper returning T+1 schedule delay probability and continuous delay prediction.
    """
    t1_res = predict_t1(features_df, models, current_status)
    prob = t1_res["schedule_delay_probability"]
    tier = t1_res["schedule_risk_tier"]

    payload = {
        "additional_delay_probability": prob,
        "delay_risk_level": tier,
        "predicted_additional_delay_months": t1_res["predicted_additional_delay_months"],
        "predicted_total_schedule_extension_months": t1_res["predicted_schedule_delay_months"],
    }

    return {
        "t_plus_1": payload,
        "3_month": payload,
    }

