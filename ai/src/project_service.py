"""
Project service layer for PAIMANA ML / Nirmaan Drishti.

Provides API-ready functions for project lookup, prediction, timeline calculations,
completed project summary, and SHAP explanations.
All date and timeline arithmetic is handled in this application service layer.
"""

import pandas as pd
import numpy as np
from datetime import datetime, date
from dateutil.relativedelta import relativedelta
from pathlib import Path
from typing import Dict, Any, Optional, List

from src.t1_pipeline import (
    get_t1_feature_definitions,
    add_t1_dynamic_physics_features,
    get_preprocessor_feature_names
)
from src.predict import predict_t1, predict_cost, predict_time, load_all_models
from src.explain import get_shap_explanation


def add_months_to_date(base_date, months_float: float):
    """
    Add a fractional/float number of months to a base date using relativedelta.
    Accounts for differing month lengths and leap years accurately.
    """
    if base_date is None or pd.isna(base_date) or months_float is None or pd.isna(months_float):
        return None
    if isinstance(base_date, (pd.Timestamp, datetime)):
        base_date = base_date.date()
    elif isinstance(base_date, str):
        try:
            base_date = pd.to_datetime(base_date).date()
        except Exception:
            return None

    whole_months = int(months_float)
    frac_months = months_float - whole_months
    days = int(round(frac_months * 30.4375))

    return base_date + relativedelta(months=whole_months, days=days)


def format_calendar_duration(d1, d2, is_remaining: bool = False) -> str:
    """Format calendar difference between two dates as e.g. '3 years 7 months'."""
    if d1 is None or d2 is None or pd.isna(d1) or pd.isna(d2):
        return "N/A"

    if isinstance(d1, (pd.Timestamp, datetime)):
        d1 = d1.date()
    elif isinstance(d1, str):
        try:
            d1 = pd.to_datetime(d1).date()
        except Exception:
            return "N/A"

    if isinstance(d2, (pd.Timestamp, datetime)):
        d2 = d2.date()
    elif isinstance(d2, str):
        try:
            d2 = pd.to_datetime(d2).date()
        except Exception:
            return "N/A"

    if d1 == d2:
        return "0 months"

    is_negative = d1 > d2
    start, end = (d2, d1) if is_negative else (d1, d2)
    rd = relativedelta(end, start)

    parts = []
    if rd.years > 0:
        parts.append(f"{rd.years} year" if rd.years == 1 else f"{rd.years} years")
    if rd.months > 0:
        parts.append(f"{rd.months} month" if rd.months == 1 else f"{rd.months} months")
    if not parts:
        if rd.days > 0:
            parts.append(f"{rd.days} day" if rd.days == 1 else f"{rd.days} days")
        else:
            parts.append("0 months")

    duration_str = " ".join(parts)
    if is_negative and is_remaining:
        return f"Overdue by {duration_str}"
    return duration_str


def load_project_history(project_id: str, df: pd.DataFrame) -> pd.DataFrame:
    """Retrieve all historical rows for a project, sorted chronologically."""
    clean_id = str(project_id).strip()
    if clean_id.endswith(".0"):
        clean_id = clean_id[:-2]

    mask = df["project_id"].astype(str) == clean_id
    if not mask.any() and "legacy_ocms_code" in df.columns:
        mask = df["legacy_ocms_code"].astype(str) == clean_id
    if not mask.any() and "effective_project_key" in df.columns:
        mask = df["effective_project_key"].astype(str) == clean_id

    history = df[mask].sort_values("report_month").reset_index(drop=True)

    if len(history) == 0:
        raise ValueError(f"Project not found: {project_id}")

    return history


def get_latest_snapshot(project_id: str, df: pd.DataFrame) -> pd.Series:
    """Get the most recent snapshot for a project."""
    history = load_project_history(project_id, df)
    return history.iloc[-1]


def prepare_prediction_features(project_id: str, df: pd.DataFrame) -> pd.DataFrame:
    """Build the model-ready feature dataframe from the latest snapshot."""
    latest = get_latest_snapshot(project_id, df)
    cat_cols, num_cols = get_t1_feature_definitions()
    all_feature_cols = cat_cols + num_cols

    row_df = pd.DataFrame([latest])
    row_df = add_t1_dynamic_physics_features(row_df)

    # Reconcile aliases and fill missing columns safely
    for col in num_cols:
        if col not in row_df.columns or row_df[col].isna().all():
            if col == "original_cost_cr" and "original_cost_crore" in row_df.columns:
                row_df[col] = row_df["original_cost_crore"]
            elif col == "revised_cost_cr" and "revised_cost_crore" in row_df.columns:
                row_df[col] = row_df["revised_cost_crore"]
            elif col == "anticipated_cost_cr" and "anticipated_cost_crore" in row_df.columns:
                row_df[col] = row_df["anticipated_cost_crore"]
            elif col == "cumulative_expenditure_cr" and "cumulative_expenditure_crore" in row_df.columns:
                row_df[col] = row_df["cumulative_expenditure_crore"]
            elif col not in row_df.columns:
                row_df[col] = 0.0

    for col in cat_cols:
        if col not in row_df.columns:
            row_df[col] = "UNKNOWN"

    # Set crore aliases if missing for downstream simulation service
    if "original_cost_crore" not in row_df.columns and "original_cost_cr" in row_df.columns:
        row_df["original_cost_crore"] = row_df["original_cost_cr"]
    if "revised_cost_crore" not in row_df.columns and "revised_cost_cr" in row_df.columns:
        row_df["revised_cost_crore"] = row_df["revised_cost_cr"]
    if "cumulative_expenditure_crore" not in row_df.columns and "cumulative_expenditure_cr" in row_df.columns:
        row_df["cumulative_expenditure_crore"] = row_df["cumulative_expenditure_cr"]
    if "expenditure_velocity_crore_month" not in row_df.columns:
        row_df["expenditure_velocity_crore_month"] = row_df.get("expenditure_velocity", 0.0)

    return row_df


def get_current_status(project_id: str, df: pd.DataFrame) -> Dict[str, Any]:
    """Get the current reported status of a project from its latest snapshot."""
    latest = get_latest_snapshot(project_id, df)

    status = {
        "physical_progress_pct": _safe_val(latest, "physical_progress_pct"),
        "cost_overrun_pct": _safe_val(latest, "cost_overrun_pct"),
        "original_cost_crore": _safe_val(latest, "original_cost_crore") or _safe_val(latest, "original_cost_cr"),
        "revised_cost_crore": _safe_val(latest, "revised_cost_crore") or _safe_val(latest, "revised_cost_cr"),
        "cost_escalation_crore": _safe_val(latest, "cost_escalation_crore"),
        "cumulative_expenditure_crore": _safe_val(latest, "cumulative_expenditure_crore") or _safe_val(latest, "cumulative_expenditure_cr"),
        "expenditure_ratio_pct": _safe_val(latest, "expenditure_ratio_pct"),
        "schedule_status": _safe_str(latest, "schedule_status"),
        "schedule_extension_months": _safe_val(latest, "schedule_extension_months"),
        "remaining_work_pct": _safe_val(latest, "remaining_work_pct"),
        "remaining_budget_crore": _safe_val(latest, "remaining_budget_crore") or _safe_val(latest, "remaining_budget_headroom"),
        "project_age_months": _safe_val(latest, "project_age_months"),
        "overdue_days": _safe_val(latest, "overdue_days"),
        "is_completed": str(latest.get("schedule_status", "")).upper() == "COMPLETED" or str(latest.get("operational_status", "")).upper() == "COMPLETED" or _safe_val(latest, "physical_progress_pct") == 100.0,
    }

    return status


def get_project_info(project_id: str, df: pd.DataFrame) -> Dict[str, Any]:
    """Get project metadata."""
    latest = get_latest_snapshot(project_id, df)

    return {
        "project_id": str(project_id),
        "project_name": _safe_str(latest, "project_name") or f"Project {project_id}",
        "agency": _safe_str(latest, "agency"),
        "ministry_department": _safe_str(latest, "ministry_department"),
        "sector": _safe_str(latest, "sector"),
        "state": _safe_str(latest, "state"),
        "latest_report_month": str(latest["report_month"].date()) if pd.notna(latest.get("report_month")) else "N/A",
    }


def get_project_timeline(project_id: str, df: pd.DataFrame) -> Dict[str, Any]:
    """Calculate timeline metadata."""
    latest = get_latest_snapshot(project_id, df)

    start_date = latest.get("approval_date") or latest.get("approval_start")
    as_of_date = latest.get("report_month")
    planned_doc = latest.get("anticipated_doc") or latest.get("revised_doc") or latest.get("original_doc") or latest.get("original_target_doc")

    time_elapsed_str = format_calendar_duration(start_date, as_of_date) if pd.notna(start_date) and pd.notna(as_of_date) else "N/A"
    time_remaining_str = format_calendar_duration(as_of_date, planned_doc, is_remaining=True) if pd.notna(planned_doc) and pd.notna(as_of_date) else "N/A"

    return {
        "start_date": str(start_date.date()) if pd.notna(start_date) and hasattr(start_date, "date") else str(start_date) if pd.notna(start_date) else "N/A",
        "as_of_date": str(as_of_date.date()) if pd.notna(as_of_date) and hasattr(as_of_date, "date") else str(as_of_date) if pd.notna(as_of_date) else "N/A",
        "planned_completion_date": str(planned_doc.date()) if pd.notna(planned_doc) and hasattr(planned_doc, "date") else str(planned_doc) if pd.notna(planned_doc) else "N/A",
        "time_elapsed_till_now": time_elapsed_str,
        "time_remaining_planned_completion": time_remaining_str,
    }


def get_completed_project_summary(project_id: str, df: pd.DataFrame) -> Dict[str, Any]:
    """Generate final outcome summary for completed projects."""
    latest = get_latest_snapshot(project_id, df)

    return {
        "is_completed": True,
        "final_physical_progress_pct": _safe_val(latest, "physical_progress_pct"),
        "actual_completion_date": str(latest["report_month"].date()) if pd.notna(latest.get("report_month")) else None,
        "actual_schedule_extension_months": _safe_val(latest, "schedule_extension_months"),
        "original_cost_crore": _safe_val(latest, "original_cost_crore") or _safe_val(latest, "original_cost_cr"),
        "final_revised_cost_crore": _safe_val(latest, "revised_cost_crore") or _safe_val(latest, "revised_cost_cr"),
        "final_expenditure_crore": _safe_val(latest, "cumulative_expenditure_crore") or _safe_val(latest, "cumulative_expenditure_cr"),
        "actual_cost_overrun_pct": _safe_val(latest, "cost_overrun_pct"),
        "actual_cost_escalation_crore": _safe_val(latest, "cost_escalation_crore"),
    }


def get_full_prediction(project_id: str, df: pd.DataFrame,
                        models: Dict[str, Any],
                        horizons: list = None) -> Dict[str, Any]:
    """
    Generate complete T+1 prediction output for a project.
    Combines T+1 schedule delay and cost overrun ML models, anomaly detection,
    risk score computation, and fresh SHAP explanations.
    """
    info = get_project_info(project_id, df)
    current = get_current_status(project_id, df)
    timeline = get_project_timeline(project_id, df)
    latest = get_latest_snapshot(project_id, df)

    # Completed project handling
    if current.get("is_completed", False):
        completed_summary = get_completed_project_summary(project_id, df)
        return {
            "project_id": str(project_id),
            "project_name": info["project_name"],
            "as_of_month": info["latest_report_month"],
            "is_completed": True,
            "completed_summary": completed_summary,
            "current_status": current,
            "timeline": timeline,
            "t1_prediction": {},
            "cost_prediction": {},
            "time_prediction": {},
            "explanations": {},
            "project_info": info,
        }

    # Active project: prepare features
    features_df = prepare_prediction_features(project_id, df)

    # Run T+1 core prediction
    t1_res = predict_t1(features_df, models, current)

    # Backwards compatibility dictionaries
    cost_pred = predict_cost(features_df, models, current)
    time_pred = predict_time(features_df, models, current)

    # Generate SHAP explanations using new production models
    explanations = {}
    cat_cols, num_cols = get_t1_feature_definitions()

    # 1. Schedule delay SHAP
    sched_model = models.get("schedule_delay_model")
    sched_prep = models.get("schedule_delay_preprocessor")
    if sched_model is not None and sched_prep is not None:
        try:
            X_sched = sched_prep.transform(features_df)
            feat_names = models.get("transformed_feature_names") or get_preprocessor_feature_names(sched_prep, cat_cols, num_cols)
            exp_sched = get_shap_explanation(sched_model, X_sched, feat_names)
            explanations["schedule_delay"] = exp_sched
            explanations["time_3m"] = exp_sched  # Alias for existing downstream UI/LLM consumption
        except Exception as e:
            print(f"[WARNING] Schedule delay SHAP error: {e}")

    # 2. Cost overrun SHAP
    cost_model = models.get("cost_overrun_model")
    cost_prep = models.get("cost_overrun_preprocessor")
    if cost_model is not None and cost_prep is not None:
        try:
            X_cost = cost_prep.transform(features_df)
            feat_names = models.get("transformed_feature_names") or get_preprocessor_feature_names(cost_prep, cat_cols, num_cols)
            exp_cost = get_shap_explanation(cost_model, X_cost, feat_names)
            explanations["cost_overrun"] = exp_cost
            explanations["cost_3m"] = exp_cost  # Alias for existing downstream UI/LLM consumption
        except Exception as e:
            print(f"[WARNING] Cost overrun SHAP error: {e}")

    return {
        "project_id": str(project_id),
        "project_name": info["project_name"],
        "as_of_month": info["latest_report_month"],
        "is_completed": False,
        "current_status": current,
        "timeline": timeline,
        "t1_prediction": t1_res,
        "schedule_delay_probability": t1_res["schedule_delay_probability"],
        "cost_overrun_probability": t1_res["cost_overrun_probability"],
        "schedule_delay_flag": t1_res["schedule_delay_flag"],
        "cost_overrun_flag": t1_res["cost_overrun_flag"],
        "is_anomaly": t1_res["is_anomaly"],
        "anomaly_score": t1_res["anomaly_score"],
        "risk_score": t1_res["risk_score"],
        "risk_level": t1_res["risk_level"],
        "cost_prediction": cost_pred,
        "time_prediction": time_pred,
        "explanations": explanations,
        "project_info": info,
    }


def get_project_list(df: pd.DataFrame) -> List[Dict[str, str]]:
    """Get list of all projects with basic info."""
    latest = df.sort_values("report_month").groupby("project_id").last().reset_index()
    projects = []
    for _, row in latest.iterrows():
        projects.append({
            "project_id": str(row["project_id"]),
            "project_name": _safe_str(row, "project_name"),
            "sector": _safe_str(row, "sector"),
            "state": _safe_str(row, "state"),
            "schedule_status": _safe_str(row, "schedule_status"),
        })
    return projects


def _safe_val(series, col):
    """Safely extract a numeric value."""
    val = series.get(col, None)
    if val is not None and pd.notna(val):
        try:
            return round(float(val), 2)
        except Exception:
            return None
    return None


def _safe_str(series, col):
    """Safely extract a string value."""
    val = series.get(col, None)
    if val is not None and pd.notna(val):
        return str(val).strip()
    return None
