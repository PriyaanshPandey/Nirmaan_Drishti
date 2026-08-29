"""
Project service layer for PAIMANA ML.

Provides API-ready functions for project lookup, prediction, timeline calculations,
completed project summary, and SHAP explanations. Does NOT depend on Streamlit.
All date and timeline arithmetic is handled in this application service layer.
"""

import pandas as pd
import numpy as np
from datetime import datetime, date
from dateutil.relativedelta import relativedelta
from pathlib import Path
from typing import Dict, Any, Optional, List

from src.feature_selection import get_available_feature_split, get_feature_columns
from src.predict import predict_cost, predict_time, load_all_models
from src.explain import get_shap_explanation
from src.preprocessing import get_feature_names


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
    """
    Format calendar difference between two dates as e.g. '3 years 7 months'.
    Uses exact date arithmetic via relativedelta, handling different month lengths and leap years.

    Parameters
    ----------
    d1 : datetime or Timestamp or date
        Start date.
    d2 : datetime or Timestamp or date
        End date.
    is_remaining : bool
        Whether this is a time remaining query (handles overdue prefix).

    Returns
    -------
    str
        Formatted string like '3 years 7 months' or 'Overdue by 1 month'.
    """
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
    mask = df["project_id"].astype(str) == str(project_id)
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
    feature_split = get_available_feature_split(df)
    feature_cols = feature_split["categorical"] + feature_split["numeric"]

    features = pd.DataFrame([latest[feature_cols]])
    return features


def get_current_status(project_id: str, df: pd.DataFrame) -> Dict[str, Any]:
    """Get the current reported status of a project from its latest snapshot."""
    latest = get_latest_snapshot(project_id, df)

    status = {
        "physical_progress_pct": _safe_val(latest, "physical_progress_pct"),
        "cost_overrun_pct": _safe_val(latest, "cost_overrun_pct"),
        "original_cost_crore": _safe_val(latest, "original_cost_crore"),
        "revised_cost_crore": _safe_val(latest, "revised_cost_crore"),
        "cost_escalation_crore": _safe_val(latest, "cost_escalation_crore"),
        "cumulative_expenditure_crore": _safe_val(latest, "cumulative_expenditure_crore"),
        "expenditure_ratio_pct": _safe_val(latest, "expenditure_ratio_pct"),
        "schedule_status": _safe_str(latest, "schedule_status"),
        "schedule_extension_months": _safe_val(latest, "schedule_extension_months"),
        "remaining_work_pct": _safe_val(latest, "remaining_work_pct"),
        "remaining_budget_crore": _safe_val(latest, "remaining_budget_crore"),
        "project_age_months": _safe_val(latest, "project_age_months"),
        "overdue_days": _safe_val(latest, "overdue_days"),
        "is_completed": str(latest.get("schedule_status", "")).upper() == "COMPLETED" or _safe_val(latest, "physical_progress_pct") == 100.0,
    }

    return status


def get_project_info(project_id: str, df: pd.DataFrame) -> Dict[str, Any]:
    """Get project metadata."""
    latest = get_latest_snapshot(project_id, df)

    return {
        "project_id": str(project_id),
        "project_name": _safe_str(latest, "project_name"),
        "agency": _safe_str(latest, "agency"),
        "sector": _safe_str(latest, "sector"),
        "state": _safe_str(latest, "state"),
        "ministry_department": _safe_str(latest, "ministry_department"),
        "latest_report_month": str(latest["report_month"].date()) if pd.notna(latest["report_month"]) else None,
        "original_target_doc": str(latest["original_target_doc"].date()) if pd.notna(latest.get("original_target_doc")) else None,
        "revised_doc": str(latest["revised_doc"].date()) if pd.notna(latest.get("revised_doc")) else None,
        "total_snapshots": len(load_project_history(project_id, df)),
    }


def get_project_timeline(project_id: str, df: pd.DataFrame) -> Dict[str, Any]:
    """
    Calculate project timeline metrics using exact date arithmetic.
    Robust against missing dates by using available timeline/remaining duration fields.
    """
    latest = get_latest_snapshot(project_id, df)

    start_date = latest.get("approval_start")
    as_of_date = latest.get("report_month")
    orig_doc = latest.get("original_target_doc")
    rev_doc = latest.get("revised_doc")

    # Planned DOC resolution with fallbacks
    planned_doc = None
    if pd.notna(rev_doc):
        planned_doc = rev_doc
    elif pd.notna(orig_doc):
        planned_doc = orig_doc
    else:
        # Fallback using remaining months if explicit date columns are not populated
        rem_mo = latest.get("revised_remaining_months") or latest.get("planned_remaining_months")
        if pd.notna(rem_mo) and pd.notna(as_of_date):
            planned_doc = add_months_to_date(as_of_date, float(rem_mo))
        elif pd.notna(as_of_date):
            planned_doc = as_of_date

    # 1. Time Elapsed Till Now
    time_elapsed_str = format_calendar_duration(start_date, as_of_date) if pd.notna(start_date) and pd.notna(as_of_date) else "N/A"

    # 2. Time Remaining for Planned Completion
    if pd.notna(planned_doc) and pd.notna(as_of_date):
        time_remaining_str = format_calendar_duration(as_of_date, planned_doc, is_remaining=True)
    else:
        time_remaining_str = "N/A"

    return {
        "start_date": str(start_date.date()) if pd.notna(start_date) else "N/A",
        "as_of_date": str(as_of_date.date()) if pd.notna(as_of_date) else "N/A",
        "planned_completion_date": str(planned_doc.date()) if pd.notna(planned_doc) else "N/A",
        "time_elapsed_till_now": time_elapsed_str,
        "time_remaining_planned_completion": time_remaining_str,
    }


def get_completed_project_summary(project_id: str, df: pd.DataFrame) -> Dict[str, Any]:
    """
    Generate final outcome summary for completed projects.
    Used instead of future forecasts.
    """
    latest = get_latest_snapshot(project_id, df)

    return {
        "is_completed": True,
        "final_physical_progress_pct": _safe_val(latest, "physical_progress_pct"),
        "actual_completion_date": str(latest["report_month"].date()) if pd.notna(latest["report_month"]) else None,
        "original_target_doc": str(latest["original_target_doc"].date()) if pd.notna(latest.get("original_target_doc")) else None,
        "revised_doc": str(latest["revised_doc"].date()) if pd.notna(latest.get("revised_doc")) else None,
        "actual_schedule_extension_months": _safe_val(latest, "schedule_extension_months"),
        "original_cost_crore": _safe_val(latest, "original_cost_crore"),
        "final_revised_cost_crore": _safe_val(latest, "revised_cost_crore"),
        "final_expenditure_crore": _safe_val(latest, "cumulative_expenditure_crore"),
        "actual_cost_overrun_pct": _safe_val(latest, "cost_overrun_pct"),
        "actual_cost_escalation_crore": _safe_val(latest, "cost_escalation_crore"),
        "source_report": _safe_str(latest, "source_report"),
    }


def get_full_prediction(project_id: str, df: pd.DataFrame,
                        models: Dict[str, Any],
                        horizons: list = None) -> Dict[str, Any]:
    """
    Generate complete prediction output for a project.
    Combines ML predictions with application-level timeline/date forecasts.

    Main API endpoint function.
    """
    if horizons is None:
        horizons = [3, 6]

    info = get_project_info(project_id, df)
    current = get_current_status(project_id, df)
    timeline = get_project_timeline(project_id, df)
    latest = get_latest_snapshot(project_id, df)

    # If project is completed, return final outcomes summary
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
            "cost_prediction": {},
            "time_prediction": {},
            "explanations": {},
            "project_info": info,
        }

    # For active projects, prepare features and run ML predictions
    features_df = prepare_prediction_features(project_id, df)

    cost_pred = predict_cost(features_df, models, current, horizons)
    time_pred = predict_time(features_df, models, current, horizons)

    # Resolve dates for timeline forecasting
    as_of = latest.get("report_month")
    if isinstance(as_of, (pd.Timestamp, datetime)):
        as_of = as_of.date()
    elif isinstance(as_of, str):
        try:
            as_of = pd.to_datetime(as_of).date()
        except Exception:
            as_of = None

    rev_doc = latest.get("revised_doc")
    orig_doc = latest.get("original_target_doc")
    planned_doc = None
    if pd.notna(rev_doc):
        planned_doc = rev_doc.date() if isinstance(rev_doc, (pd.Timestamp, datetime)) else pd.to_datetime(rev_doc).date()
    elif pd.notna(orig_doc):
        planned_doc = orig_doc.date() if isinstance(orig_doc, (pd.Timestamp, datetime)) else pd.to_datetime(orig_doc).date()
    else:
        rem_mo = latest.get("revised_remaining_months") or latest.get("planned_remaining_months")
        if pd.notna(rem_mo) and as_of is not None:
            planned_doc = add_months_to_date(as_of, float(rem_mo))
        elif as_of is not None:
            planned_doc = as_of

    # Enrich time_prediction with application-level completion forecast fields
    for h in horizons:
        h_key = f"{h}_month"
        if h_key in time_pred:
            pred_h = time_pred[h_key]
            delay_months = pred_h.get("predicted_additional_delay_months")
            delay_val = float(delay_months) if delay_months is not None else 0.0

            # 1. Predicted Additional Delay formatted
            pred_h["predicted_additional_delay"] = f"{delay_val:+.2f} months"

            # 2. Tentative Completion Date
            if planned_doc and as_of:
                base_date = max(planned_doc, as_of)
                tentative_doc = add_months_to_date(base_date, delay_val)
            elif as_of:
                tentative_doc = add_months_to_date(as_of, delay_val)
            else:
                tentative_doc = None

            if tentative_doc:
                pred_h["tentative_completion_date"] = tentative_doc.strftime("%d %B %Y")
                pred_h["tentative_completion_date_iso"] = tentative_doc.strftime("%Y-%m-%d")
            else:
                pred_h["tentative_completion_date"] = "N/A"

            # 3. Estimated Time Needed for Completion (from latest report/current date to tentative completion date)
            if as_of and tentative_doc:
                pred_h["estimated_time_needed_completion"] = format_calendar_duration(as_of, tentative_doc)
            else:
                pred_h["estimated_time_needed_completion"] = "N/A"

    # Generate SHAP explanations
    explanations = {}
    for model_type in ["cost", "time"]:
        for h in reversed(horizons):
            cls_key = f"{model_type}_classifier_{h}m"
            prep_key = f"{model_type}_cls_{h}m_preprocessor"
            if cls_key in models and prep_key in models:
                X = models[prep_key].transform(features_df)
                feature_names = get_feature_names(models[prep_key])
                explanation = get_shap_explanation(
                    models[cls_key], X, feature_names
                )
                explanations[f"{model_type}_{h}m"] = explanation

    return {
        "project_id": str(project_id),
        "project_name": info["project_name"],
        "as_of_month": info["latest_report_month"],
        "is_completed": False,
        "current_status": current,
        "timeline": timeline,
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
        return round(float(val), 2)
    return None


def _safe_str(series, col):
    """Safely extract a string value."""
    val = series.get(col, None)
    if val is not None and pd.notna(val):
        return str(val)
    return None
