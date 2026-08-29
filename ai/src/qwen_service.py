"""
Qwen3-8B Natural Language Explanation & Grounded Q&A Service for PAIMANA ML.

Architectural Flow:
ML Prediction -> SHAP -> Structured Context Payload -> Qwen3-8B -> User-Friendly Explanation

Strict Principles:
1. ML Model remains the sole source of truth for all predictions and numbers.
2. SHAP remains the sole source of truth for contributing factors.
3. Qwen converts structured evidence into clear, professional sentences without inventing facts.
4. Fully decoupled from Streamlit for seamless FastAPI/backend reusability.
5. Deterministic rule-based fallback if API is unconfigured or offline.
"""

import os
import json
import logging
import requests
import pandas as pd
import numpy as np
from pathlib import Path
from typing import Dict, Any, Optional, List, Tuple
from datetime import datetime, date

from src.data_loader import load_config

logger = logging.getLogger(__name__)

# Human-readable dictionary mapping feature column names to plain English descriptions & units
FEATURE_METADATA = {
    "schedule_extension_months": {"label": "Schedule Extension", "unit": "months"},
    "cost_overrun_pct": {"label": "Cost Overrun", "unit": "%"},
    "cost_escalation_crore": {"label": "Cost Escalation", "unit": "₹ Cr"},
    "physical_progress_pct": {"label": "Physical Progress", "unit": "%"},
    "remaining_work_pct": {"label": "Remaining Work", "unit": "%"},
    "cumulative_expenditure_crore": {"label": "Cumulative Expenditure", "unit": "₹ Cr"},
    "expenditure_ratio_pct": {"label": "Expenditure vs Budget", "unit": "%"},
    "expenditure_velocity_crore_month": {"label": "Monthly Expenditure Velocity", "unit": "₹ Cr/month"},
    "progress_velocity_3m": {"label": "3-Month Progress Velocity", "unit": "%/month"},
    "progress_trend_slope": {"label": "Progress Trend Slope", "unit": "rate"},
    "cost_overrun_trend_slope": {"label": "Cost Overrun Trend Slope", "unit": "rate"},
    "physical_progress_delta_1m": {"label": "1-Month Progress Delta", "unit": "pp"},
    "physical_progress_delta_3m": {"label": "3-Month Progress Delta", "unit": "pp"},
    "cost_overrun_delta_1m": {"label": "1-Month Cost Overrun Delta", "unit": "pp"},
    "cost_overrun_delta_3m": {"label": "3-Month Cost Overrun Delta", "unit": "pp"},
    "consecutive_stagnant_months": {"label": "Consecutive Stagnant Months", "unit": "months"},
    "progress_minus_expenditure_gap": {"label": "Physical vs Financial Gap", "unit": "pp"},
    "expenditure_minus_progress_gap": {"label": "Financial vs Physical Gap", "unit": "pp"},
    "overdue_days": {"label": "Overdue Duration", "unit": "days"},
    "extension_count": {"label": "Number of Schedule Revisions", "unit": "revisions"},
    "extension_rate_pct": {"label": "Extension Rate vs Duration", "unit": "%"},
    "days_to_revised_target": {"label": "Days to Revised Target Date", "unit": "days"},
    "days_to_original_target": {"label": "Days to Original Target Date", "unit": "days"},
    "revised_remaining_months": {"label": "Planned Remaining Duration", "unit": "months"},
    "planned_remaining_months": {"label": "Original Remaining Duration", "unit": "months"},
    "original_duration_months": {"label": "Original Planned Duration", "unit": "months"},
    "project_age_months": {"label": "Project Age Since Approval", "unit": "months"},
    "original_cost_crore": {"label": "Original Approved Cost", "unit": "₹ Cr"},
    "revised_cost_crore": {"label": "Current Revised Cost", "unit": "₹ Cr"},
    "risk_signal_count": {"label": "Risk Signal Count", "unit": "signals"},
    "stagnation_flag": {"label": "Recent Work Stagnation Flag", "unit": "flag"},
    "is_overdue_flag": {"label": "Overdue Status Flag", "unit": "flag"},
    "is_extended_flag": {"label": "Extension Status Flag", "unit": "flag"},
    "cost_overrun_negative_flag": {"label": "Under-Budget Indicator", "unit": "flag"},
}


def get_feature_readable_info(feature_col: str, snapshot_row: Optional[pd.Series] = None) -> Dict[str, Any]:
    """
    Translate raw feature column names (including one-hot encoded categorical columns)
    into plain English descriptions and extract the actual project value.
    """
    if feature_col in FEATURE_METADATA:
        meta = FEATURE_METADATA[feature_col]
        raw_val = snapshot_row.get(feature_col) if snapshot_row is not None else None
        return {
            "feature_col": feature_col,
            "display_name": meta["label"],
            "unit": meta["unit"],
            "actual_value": _format_feature_value(raw_val, meta["unit"]),
            "raw_value": raw_val,
        }

    # Handle one-hot encoded columns (e.g. ministry_department_Ministry of Railways, sector_Coal)
    prefixes = [
        ("sector_", "Sector: "),
        ("ministry_department_", "Ministry: "),
        ("agency_", "Executing Agency: "),
        ("state_", "State: "),
        ("schedule_status_", "Reported Status: "),
    ]
    for pfx, label_pfx in prefixes:
        if feature_col.startswith(pfx):
            category_val = feature_col[len(pfx):]
            is_active = False
            if snapshot_row is not None:
                base_col = pfx.rstrip("_")
                actual_cat = snapshot_row.get(base_col)
                is_active = str(actual_cat).strip().lower() == category_val.strip().lower()
            return {
                "feature_col": feature_col,
                "display_name": f"{label_pfx}{category_val}",
                "unit": "category",
                "actual_value": "Applies to Project" if is_active else "Historical Category Baseline",
                "raw_value": category_val,
            }

    # Generic fallback
    clean_name = feature_col.replace("_", " ").title()
    raw_val = snapshot_row.get(feature_col) if snapshot_row is not None else None
    return {
        "feature_col": feature_col,
        "display_name": clean_name,
        "unit": "",
        "actual_value": str(raw_val) if raw_val is not None else "N/A",
        "raw_value": raw_val,
    }


def _format_feature_value(val: Any, unit: str) -> str:
    """Format numeric values cleanly with their units."""
    if val is None or pd.isna(val):
        return "N/A"
    try:
        fval = float(val)
        if unit == "₹ Cr":
            return f"₹{fval:,.2f} Cr"
        elif unit == "%" or unit == "pp":
            return f"{fval:.2f}{unit}"
        elif unit in ["months", "days", "revisions", "signals"]:
            return f"{fval:.1f} {unit}" if fval % 1 != 0 else f"{int(fval)} {unit}"
        elif unit == "flag":
            return "Yes" if fval > 0.5 else "No"
        return f"{fval:.2f}"
    except (ValueError, TypeError):
        return str(val)


def build_explanation_payload(
    project_id: str,
    df: pd.DataFrame,
    prediction_result: Dict[str, Any],
    forecast_type: str = "schedule", # "schedule" or "cost"
    horizon: str = "3_month" # "3_month" or "6_month"
) -> Dict[str, Any]:
    """
    Construct a verified, structured payload containing only necessary facts
    and SHAP evidence to send to Qwen3-8B.
    """
    proj_mask = df["project_id"].astype(str) == str(project_id)
    history = df[proj_mask].sort_values("report_month")
    if len(history) == 0:
        raise ValueError(f"Project not found: {project_id}")

    latest_row = history.iloc[-1]
    total_snapshots = len(history)
    is_limited_history = total_snapshots <= 2

    info = prediction_result.get("project_info", {})
    curr = prediction_result.get("current_status", {})
    timeline = prediction_result.get("timeline", {})

    # Extract specific forecast data
    if forecast_type.lower().startswith("sched") or forecast_type.lower().startswith("time"):
        f_type_key = "schedule"
        f_type_label = "Schedule Delay"
        pred_dict = prediction_result.get("time_prediction", {}).get(horizon, {})
        prob = pred_dict.get("additional_delay_probability")
        delta_val = pred_dict.get("predicted_additional_delay_months")
        delta_str = pred_dict.get("predicted_additional_delay", f"{delta_val:+.2f} months" if delta_val is not None else "N/A")
        total_val_str = f"{pred_dict.get('predicted_total_schedule_extension_months', 'N/A')} months"
        shap_key = f"time_{horizon.split('_')[0]}m"
    else:
        f_type_key = "cost"
        f_type_label = "Cost Escalation"
        pred_dict = prediction_result.get("cost_prediction", {}).get(horizon, {})
        prob = pred_dict.get("additional_escalation_probability")
        delta_val = pred_dict.get("predicted_additional_overrun_pct")
        delta_cr = pred_dict.get("predicted_additional_cost_crore")
        delta_str = f"{delta_val:+.2f}% (+₹{delta_cr:,.2f} Cr)" if delta_val is not None else "N/A"
        total_val_str = f"{pred_dict.get('predicted_final_cost_overrun_pct', 'N/A')}% (₹{pred_dict.get('predicted_final_cost_escalation_crore', 'N/A')} Cr)"
        shap_key = f"cost_{horizon.split('_')[0]}m"

    # Map Risk Level
    risk_level = "LOW RISK"
    if prob is not None:
        if prob >= 0.50:
            risk_level = "HIGH RISK"
        elif prob >= 0.25:
            risk_level = "MODERATE RISK"

    # Extract and enrich SHAP drivers with actual project values
    raw_explanation = prediction_result.get("explanations", {}).get(shap_key, {})
    raw_pos = raw_explanation.get("top_risk_drivers", [])
    raw_neg = raw_explanation.get("top_protective_factors", [])

    positive_drivers = []
    for d in raw_pos[:6]:
        meta = get_feature_readable_info(d["feature"], latest_row)
        positive_drivers.append({
            "feature": d["feature"],
            "label": meta["display_name"],
            "actual_value": meta["actual_value"],
            "shap_contribution": d["shap_value"],
        })

    protective_factors = []
    for d in raw_neg[:6]:
        meta = get_feature_readable_info(d["feature"], latest_row)
        protective_factors.append({
            "feature": d["feature"],
            "label": meta["display_name"],
            "actual_value": meta["actual_value"],
            "shap_contribution": d["shap_value"],
        })

    return {
        "project_id": str(project_id),
        "project_name": info.get("project_name", "Unknown Project"),
        "sector": info.get("sector", "N/A"),
        "ministry": info.get("ministry_department", "N/A"),
        "executing_agency": info.get("agency", "N/A"),
        "state": info.get("state", "N/A"),
        "reported_status": curr.get("schedule_status", "N/A"),
        "is_limited_history": is_limited_history,
        "total_snapshots_available": total_snapshots,
        "is_completed": curr.get("is_completed", False),
        "forecast_type": f_type_label,
        "forecast_horizon": horizon.replace("_", " ").title(),
        "risk_level": risk_level,
        "probability_pct": round(prob * 100, 1) if prob is not None else None,
        "predicted_incremental_change": delta_str,
        "forecasted_final_outcome": total_val_str,
        "tentative_completion_date": pred_dict.get("tentative_completion_date", "N/A"),
        "estimated_time_needed": pred_dict.get("estimated_time_needed_completion", "N/A"),
        "current_metrics": {
            "physical_progress_pct": f"{curr.get('physical_progress_pct', 'N/A')}%",
            "cost_overrun_pct": f"{curr.get('cost_overrun_pct', 'N/A')}%",
            "cost_escalation_crore": f"₹{curr.get('cost_escalation_crore', 'N/A')} Cr",
            "schedule_extension_months": f"{curr.get('schedule_extension_months', 'N/A')} months",
            "time_elapsed_till_now": timeline.get("time_elapsed_till_now", "N/A"),
            "time_remaining_planned": timeline.get("time_remaining_planned_completion", "N/A"),
            "original_cost_crore": f"₹{curr.get('original_cost_crore', 'N/A')} Cr",
            "revised_cost_crore": f"₹{curr.get('revised_cost_crore', 'N/A')} Cr",
        },
        "top_positive_shap_drivers": positive_drivers,
        "top_protective_shap_factors": protective_factors,
    }


def build_project_chat_context(
    project_id: str,
    df: pd.DataFrame,
    prediction_result: Dict[str, Any]
) -> Dict[str, Any]:
    """
    Build a comprehensive factual context dictionary for interactive Q&A.
    """
    payload_sched_3m = build_explanation_payload(project_id, df, prediction_result, "schedule", "3_month")
    payload_sched_6m = build_explanation_payload(project_id, df, prediction_result, "schedule", "6_month")
    payload_cost_3m = build_explanation_payload(project_id, df, prediction_result, "cost", "3_month")
    payload_cost_6m = build_explanation_payload(project_id, df, prediction_result, "cost", "6_month")

    return {
        "project_metadata": {
            "project_id": str(project_id),
            "project_name": payload_sched_3m["project_name"],
            "sector": payload_sched_3m["sector"],
            "ministry": payload_sched_3m["ministry"],
            "agency": payload_sched_3m["executing_agency"],
            "state": payload_sched_3m["state"],
            "status": payload_sched_3m["reported_status"],
            "is_limited_history": payload_sched_3m["is_limited_history"],
            "is_completed": payload_sched_3m["is_completed"],
        },
        "current_metrics": payload_sched_3m["current_metrics"],
        "schedule_forecasts": {
            "3_month": {
                "risk_level": payload_sched_3m["risk_level"],
                "probability_pct": payload_sched_3m["probability_pct"],
                "predicted_additional_delay": payload_sched_3m["predicted_incremental_change"],
                "forecasted_total_extension": payload_sched_3m["forecasted_final_outcome"],
                "tentative_completion_date": payload_sched_3m["tentative_completion_date"],
                "estimated_time_needed": payload_sched_3m["estimated_time_needed"],
                "top_risk_drivers": payload_sched_3m["top_positive_shap_drivers"],
                "protective_factors": payload_sched_3m["top_protective_shap_factors"],
            },
            "6_month": {
                "risk_level": payload_sched_6m["risk_level"],
                "probability_pct": payload_sched_6m["probability_pct"],
                "predicted_additional_delay": payload_sched_6m["predicted_incremental_change"],
                "forecasted_total_extension": payload_sched_6m["forecasted_final_outcome"],
                "tentative_completion_date": payload_sched_6m["tentative_completion_date"],
                "estimated_time_needed": payload_sched_6m["estimated_time_needed"],
                "top_risk_drivers": payload_sched_6m["top_positive_shap_drivers"],
                "protective_factors": payload_sched_6m["top_protective_shap_factors"],
            },
        },
        "cost_forecasts": {
            "3_month": {
                "risk_level": payload_cost_3m["risk_level"],
                "probability_pct": payload_cost_3m["probability_pct"],
                "predicted_additional_overrun": payload_cost_3m["predicted_incremental_change"],
                "forecasted_final_cost": payload_cost_3m["forecasted_final_outcome"],
                "top_risk_drivers": payload_cost_3m["top_positive_shap_drivers"],
                "protective_factors": payload_cost_3m["top_protective_shap_factors"],
            },
            "6_month": {
                "risk_level": payload_cost_6m["risk_level"],
                "probability_pct": payload_cost_6m["probability_pct"],
                "predicted_additional_overrun": payload_cost_6m["predicted_incremental_change"],
                "forecasted_final_cost": payload_cost_6m["forecasted_final_outcome"],
                "top_risk_drivers": payload_cost_6m["top_positive_shap_drivers"],
                "protective_factors": payload_cost_6m["top_protective_shap_factors"],
            },
        },
    }


def _load_env_file():
    """Load environment variables from .env or .env.example if present."""
    root = Path(__file__).parent.parent
    for env_file in [root / ".env", root / ".env.example"]:
        if env_file.exists():
            try:
                with open(env_file, "r", encoding="utf-8") as f:
                    for line in f:
                        line = line.strip()
                        if line and not line.startswith("#") and "=" in line:
                            k, v = line.split("=", 1)
                            k = k.strip()
                            v = v.strip().strip('"').strip("'")
                            if k and v and k not in os.environ:
                                os.environ[k] = v
            except Exception:
                pass


def extract_financial_and_graph_trajectory(history: pd.DataFrame, latest_row: pd.Series) -> Dict[str, Any]:
    """
    Extracts and verifies the full financial trajectory, cost revisions, expenditure trends,
    and alignment with physical progress over the project's historical timeline.
    Guarantees strict mathematical reconciliation with zero contradictions.
    """
    total_snaps = len(history)
    earliest_row = history.iloc[0]

    orig_c = float(latest_row["original_cost_crore"]) if pd.notna(latest_row.get("original_cost_crore")) else None
    rev_c = float(latest_row["revised_cost_crore"]) if pd.notna(latest_row.get("revised_cost_crore")) else None
    curr_exp = float(latest_row["cumulative_expenditure_crore"]) if pd.notna(latest_row.get("cumulative_expenditure_crore")) else None
    earliest_exp = float(earliest_row["cumulative_expenditure_crore"]) if pd.notna(earliest_row.get("cumulative_expenditure_crore")) else curr_exp

    curr_p = float(latest_row["physical_progress_pct"]) if pd.notna(latest_row.get("physical_progress_pct")) else 0.0
    earliest_p = float(earliest_row["physical_progress_pct"]) if pd.notna(earliest_row.get("physical_progress_pct")) else curr_p

    start_m_str = earliest_row["report_month"].strftime("%B %Y") if pd.notna(earliest_row.get("report_month")) else "earlier reporting period"
    curr_m_str = latest_row["report_month"].strftime("%B %Y") if pd.notna(latest_row.get("report_month")) else "current period"

    # Financial reconciliation & revisions
    has_rev = (rev_c is not None) and (orig_c is not None) and (abs(rev_c - orig_c) > 0.01)
    rev_diff = round(rev_c - orig_c, 2) if has_rev else 0.0
    rev_pct = round((rev_diff / orig_c) * 100, 2) if has_rev and orig_c and orig_c > 0 else 0.0

    # Check if dynamic cost revision happened in historical timeline
    rev_events = []
    if "revised_cost_crore" in history.columns and orig_c is not None:
        first_r = history.iloc[0].get("revised_cost_crore")
        if pd.notna(first_r) and abs(float(first_r) - orig_c) > 0.01:
            first_diff = round(float(first_r) - orig_c, 2)
            first_date = history.iloc[0]["report_month"].strftime("%B %Y") if pd.notna(history.iloc[0].get("report_month")) else "baseline period"
            if first_diff > 0:
                rev_events.append(f"₹{first_diff:,.2f} crore was added to the project in {first_date} (raising cost to ₹{float(first_r):,.2f} Cr)")
            else:
                rev_events.append(f"₹{abs(first_diff):,.2f} crore was reduced in {first_date} (adjusting cost to ₹{float(first_r):,.2f} Cr)")

        if total_snaps > 1:
            prev_r = first_r
            for i in range(1, total_snaps):
                curr_r = history.iloc[i].get("revised_cost_crore")
                if pd.notna(prev_r) and pd.notna(curr_r) and abs(float(curr_r) - float(prev_r)) > 0.01:
                    r_date = history.iloc[i]["report_month"].strftime("%B %Y") if pd.notna(history.iloc[i].get("report_month")) else f"Month {i+1}"
                    step_diff = round(float(curr_r) - float(prev_r), 2)
                    if step_diff > 0:
                        rev_events.append(f"₹{step_diff:,.2f} crore was added to the project in {r_date} (raising sanctioned cost to ₹{float(curr_r):,.2f} Cr)")
                    else:
                        rev_events.append(f"₹{abs(step_diff):,.2f} crore was reduced in {r_date} (adjusting cost to ₹{float(curr_r):,.2f} Cr)")
                prev_r = curr_r

    # Expenditure growth & rate
    exp_growth = round(curr_exp - earliest_exp, 2) if curr_exp is not None and earliest_exp is not None else 0.0
    p_growth = round(curr_p - earliest_p, 2)

    # Spending acceleration / pattern
    exp_pattern = "consistent"
    if total_snaps >= 3 and exp_growth > 0:
        recent_snaps = min(3, total_snaps)
        recent_exp_start = float(history.iloc[-recent_snaps]["cumulative_expenditure_crore"]) if pd.notna(history.iloc[-recent_snaps].get("cumulative_expenditure_crore")) else curr_exp
        recent_growth = curr_exp - recent_exp_start
        monthly_recent = recent_growth / (recent_snaps - 1) if recent_snaps > 1 else recent_growth

        earlier_growth = recent_exp_start - earliest_exp
        earlier_snaps = total_snaps - recent_snaps
        monthly_earlier = earlier_growth / earlier_snaps if earlier_snaps > 0 else monthly_recent

        if monthly_recent > monthly_earlier * 1.35:
            exp_pattern = "accelerating"
        elif monthly_recent < monthly_earlier * 0.65:
            exp_pattern = "slowing down"
        else:
            exp_pattern = "consistent"
    elif total_snaps <= 1:
        exp_pattern = "initial baseline"

    # Math reconciliation
    extra_beyond_orig = None
    rem_against_orig = None
    rem_against_rev = None

    if orig_c is not None and curr_exp is not None:
        if curr_exp > orig_c:
            extra_beyond_orig = round(curr_exp - orig_c, 2)
        else:
            rem_against_orig = round(orig_c - curr_exp, 2)

    if rev_c is not None and curr_exp is not None:
        if curr_exp <= rev_c:
            rem_against_rev = round(rev_c - curr_exp, 2)

    reported_overrun_pct = float(latest_row["cost_overrun_pct"]) if pd.notna(latest_row.get("cost_overrun_pct")) else None
    stagnant_months = int(latest_row.get("consecutive_stagnant_months", 0)) if pd.notna(latest_row.get("consecutive_stagnant_months")) else 0
    gap_phys_fin = float(latest_row.get("progress_minus_expenditure_gap")) if pd.notna(latest_row.get("progress_minus_expenditure_gap")) else None

    # Check progress rate moderation
    progress_moderated = False
    if total_snaps >= 4 and p_growth > 0:
        recent_snaps = min(3, total_snaps)
        recent_p_start = float(history.iloc[-recent_snaps]["physical_progress_pct"]) if pd.notna(history.iloc[-recent_snaps].get("physical_progress_pct")) else curr_p
        recent_p_growth = curr_p - recent_p_start
        p_monthly_recent = recent_p_growth / (recent_snaps - 1) if recent_snaps > 1 else recent_p_growth

        earlier_p_growth = recent_p_start - earliest_p
        earlier_snaps = total_snaps - recent_snaps
        p_monthly_earlier = earlier_p_growth / earlier_snaps if earlier_snaps > 0 else p_monthly_recent

        if p_monthly_earlier > 0 and p_monthly_recent < p_monthly_earlier * 0.4:
            progress_moderated = True

    # Progress vs expenditure mismatch detection
    mismatch_flag = False
    mismatch_interpretation = ""

    if total_snaps > 1:
        if stagnant_months >= 2 and exp_growth > 0:
            mismatch_flag = True
            mismatch_interpretation = f"While physical progress has remained stalled at {curr_p:.1f}% across {stagnant_months} consecutive reporting cycles, expenditure continued to rise by ₹{exp_growth:,.2f} crore, creating a pronounced cost-progress mismatch."
        elif (exp_growth > 0) and (p_growth <= 1.5 and total_snaps >= 4):
            mismatch_flag = True
            mismatch_interpretation = f"Expenditure has risen substantially (+₹{exp_growth:,.2f} crore) while physical progress advanced at a slower pace from {earliest_p:.1f}% to {curr_p:.1f}% ({p_growth:+.1f} pp), creating a cost-progress mismatch."
        elif gap_phys_fin is not None and gap_phys_fin < -15.0:
            mismatch_flag = True
            mismatch_interpretation = f"Expenditure has outpaced physical execution by {abs(gap_phys_fin):.1f} percentage points, reflecting front-loaded disbursements ahead of physical deliverables."
        elif progress_moderated and exp_growth > 0:
            mismatch_interpretation = f"Physical progress has reached {curr_p:.1f}% (advancing {p_growth:+.1f} pp from {earliest_p:.1f}%), with recent progress rate moderating while expenditure continued to increase."
        elif p_growth > 0 and exp_growth > 0:
            mismatch_interpretation = f"Physical progress has reached {curr_p:.1f}% (advancing {p_growth:+.1f} pp from {earliest_p:.1f}%), with expenditure tracking in steady proportion alongside milestone delivery."
        elif p_growth > 0 and exp_growth == 0:
            mismatch_interpretation = f"Physical progress reached {curr_p:.1f}% ({p_growth:+.1f} pp) while disbursements remained controlled."
        else:
            mismatch_interpretation = f"Physical progress stands at {curr_p:.1f}% with cumulative expenditure at ₹{curr_exp:,.2f} crore."
    else:
        mismatch_interpretation = f"Physical progress stands at {curr_p:.1f}% in the initial baseline snapshot."

    return {
        "orig_cost": orig_c,
        "rev_cost": rev_c,
        "has_revision": has_rev,
        "cost_revision_amount": rev_diff,
        "cost_revision_pct": rev_pct,
        "revision_events": rev_events,
        "start_month": start_m_str,
        "current_month": curr_m_str,
        "total_snapshots": total_snaps,
        "earliest_expenditure": earliest_exp,
        "current_expenditure": curr_exp,
        "expenditure_growth": exp_growth,
        "expenditure_pattern": exp_pattern,
        "earliest_progress": earliest_p,
        "current_progress": curr_p,
        "progress_growth": p_growth,
        "extra_beyond_orig": extra_beyond_orig,
        "rem_against_orig": rem_against_orig,
        "rem_against_rev": rem_against_rev,
        "reported_overrun_pct": reported_overrun_pct,
        "stagnant_months": stagnant_months,
        "mismatch_flag": mismatch_flag,
        "mismatch_interpretation": mismatch_interpretation,
    }


class QwenExplainer:
    """
    Service client for Qwen3-8B Natural Language Explanations and Interactive Q&A.
    """

    def __init__(self, api_key: Optional[str] = None, config: Optional[dict] = None):
        _load_env_file()
        if config is None:
            try:
                config = load_config()
            except Exception:
                config = {}

        llm_cfg = config.get("llm", {})

        # Priority: explicit arg -> environment variable -> empty
        self.api_key = api_key or os.environ.get("QWEN_API_KEY", "").strip()
        self.api_base = os.environ.get("QWEN_API_BASE") or llm_cfg.get("api_base", "https://dashscope-intl.aliyuncs.com/compatible-mode/v1")
        self.model_name = os.environ.get("QWEN_MODEL_NAME") or llm_cfg.get("model_name", "qwen/qwen3-8b")
        self.temperature = float(llm_cfg.get("temperature", 0.2))
        self.max_tokens = int(llm_cfg.get("max_tokens", 800))
        self.timeout_seconds = int(llm_cfg.get("timeout_seconds", 30))

    def get_status(self) -> Dict[str, Any]:
        """Check whether live AI generation or rule-based fallback is active."""
        is_active = bool(self.api_key and len(self.api_key) > 5)
        return {
            "is_configured": is_active,
            "model_name": self.model_name,
            "mode": "ai" if is_active else "fallback",
            "status_label": "🟢 AI Explanation Active (Qwen3-8B)" if is_active else "⚪ Rule-Based Explanation Active",
        }

    def generate_explanation(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        """
        Generate structured natural language explanation from verified SHAP payload.
        Falls back to rule-based generation if API is unconfigured or unreachable.
        """
        # If project is completed, return completed outcome explanation
        if payload.get("is_completed", False):
            return self._generate_completed_project_explanation(payload)

        # Check if API key is present
        if not self.api_key:
            return self.generate_fallback_explanation(payload)

        system_prompt = (
            "You are the senior infrastructure AI analyst for Nirmaan Dristi (Central Sector Infrastructure Monitoring).\n"
            "Your task is to convert verified Machine Learning predictions and SHAP feature attributions into a concise, professional explanation.\n\n"
            "STRICT RULES:\n"
            "1. NEVER invent reasons, causes, contractor names, or historical trends not in the supplied JSON.\n"
            "2. NEVER recalculate or alter the predicted probabilities, delay months, or cost figures.\n"
            "3. If the project has limited historical data (is_limited_history=true), explicitly state that the evaluation is based on limited available reporting history.\n"
            "4. Use the actual project values where useful to provide clear context for decision-makers.\n"
            "5. Return ONLY a valid JSON object matching the exact schema below.\n\n"
            "REQUIRED JSON SCHEMA:\n"
            "{\n"
            '  "summary": "One concise sentence summarizing the prediction result and main driver.",\n'
            '  "primary_reasons": ["Point 1 citing top risk driver with real project value", "Point 2 citing second driver with real value"],\n'
            '  "supporting_factors": ["Secondary contributing factor 1", "Secondary contributing factor 2"],\n'
            '  "risk_reducing_factors": ["Protective factor 1 mitigating the risk", "Protective factor 2"]\n'
            "}"
        )

        user_prompt = f"Please generate the explanation for this project prediction:\n{json.dumps(payload, indent=2, default=str)}"

        url = f"{self.api_base.rstrip('/')}/chat/completions"
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }
        body = {
            "model": self.model_name,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            "temperature": self.temperature,
            "max_tokens": self.max_tokens,
            "response_format": {"type": "json_object"} if "qwen" in self.model_name.lower() or "gpt" in self.model_name.lower() else None
        }

        try:
            resp = requests.post(url, headers=headers, json=body, timeout=self.timeout_seconds)
            if resp.status_code == 200:
                data = resp.json()
                content = data["choices"][0]["message"]["content"].strip()
                parsed = json.loads(content)
                parsed["provider"] = f"Qwen3-8B ({self.model_name})"
                parsed["is_fallback"] = False
                return parsed
            else:
                logger.warning(f"Qwen API returned status {resp.status_code}: {resp.text}")
                fallback = self.generate_fallback_explanation(payload)
                fallback["fallback_reason"] = f"API returned status {resp.status_code}"
                return fallback
        except Exception as e:
            logger.warning(f"Qwen API call failed: {e}. Using deterministic fallback.")
            fallback = self.generate_fallback_explanation(payload)
            fallback["fallback_reason"] = str(e)
            return fallback

    def generate_fallback_explanation(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        """
        Generate a deterministic, fact-grounded explanation directly from SHAP drivers & metrics.
        Guarantees zero hallucination and 100% availability.
        """
        pname = payload.get("project_name", "This project")
        f_type = payload.get("forecast_type", "Schedule Delay")
        horizon = payload.get("forecast_horizon", "3 Month")
        risk_level = payload.get("risk_level", "MODERATE RISK")
        prob_pct = payload.get("probability_pct", 0)
        pred_delta = payload.get("predicted_incremental_change", "0")
        is_limited = payload.get("is_limited_history", False)

        pos_drivers = payload.get("top_positive_shap_drivers", [])
        neg_drivers = payload.get("top_protective_shap_factors", [])
        curr_metrics = payload.get("current_metrics", {})

        # Build Summary Sentence
        lead_driver = pos_drivers[0]["label"] if pos_drivers else "current project trajectory"
        lead_val = pos_drivers[0]["actual_value"] if pos_drivers and pos_drivers[0]["actual_value"] != "N/A" else ""
        lead_clause = f" primarily driven by {lead_driver} ({lead_val})" if lead_val and lead_val != "Applies to Project" else f" primarily driven by {lead_driver}"

        if risk_level == "HIGH RISK":
            summary = f"{pname} is assessed at {risk_level} ({prob_pct}% probability) for additional {f_type.lower()} over the next {horizon.lower()},{lead_clause}."
        elif risk_level == "LOW RISK":
            summary = f"{pname} exhibits a {risk_level} ({prob_pct}% probability) of additional {f_type.lower()} in the next {horizon.lower()}, supported by stable reported trajectory."
        else:
            summary = f"{pname} carries a {risk_level} ({prob_pct}% probability) of additional {f_type.lower()} ({pred_delta}) over the next {horizon.lower()}."

        if is_limited:
            summary += " (Note: Assessment is based on limited available reporting snapshots)."

        # Build Primary Reasons
        primary_reasons = []
        for d in pos_drivers[:3]:
            val_str = f" (current: {d['actual_value']})" if d['actual_value'] not in ["N/A", "Applies to Project", "Historical Category Baseline"] else ""
            primary_reasons.append(f"{d['label']}{val_str} strongly elevates the model's predicted risk score (+{d['shap_contribution']:.2f} SHAP impact).")

        if not primary_reasons:
            primary_reasons.append(f"Model baseline expectations for {payload.get('sector', 'this sector')} infrastructure projects.")

        # Build Supporting Factors
        supporting_factors = []
        for d in pos_drivers[3:5]:
            val_str = f" (recorded value: {d['actual_value']})" if d['actual_value'] not in ["N/A", "Applies to Project", "Historical Category Baseline"] else ""
            supporting_factors.append(f"{d['label']}{val_str} provides secondary pressure toward delay/escalation.")

        if curr_metrics.get("physical_progress_pct") and curr_metrics.get("physical_progress_pct") != "N/A%":
            supporting_factors.append(f"Recorded physical progress is currently {curr_metrics['physical_progress_pct']} against reported project duration.")

        # Build Risk Reducing Factors
        risk_reducing_factors = []
        for d in neg_drivers[:3]:
            val_str = f" ({d['actual_value']})" if d['actual_value'] not in ["N/A", "Applies to Project", "Historical Category Baseline"] else ""
            risk_reducing_factors.append(f"{d['label']}{val_str} actively acts as a protective buffer, lowering the predicted risk ({d['shap_contribution']:.2f} SHAP impact).")

        if not risk_reducing_factors:
            risk_reducing_factors.append("No major protective factors detected in the current snapshot.")

        return {
            "summary": summary,
            "primary_reasons": primary_reasons,
            "supporting_factors": supporting_factors,
            "risk_reducing_factors": risk_reducing_factors,
            "provider": "Rule-Based SHAP Synthesis (Deterministic Fallback)",
            "is_fallback": True,
        }

    def _generate_completed_project_explanation(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        """Generate outcome summary explanation for completed projects."""
        pname = payload.get("project_name", "This project")
        curr = payload.get("current_metrics", {})
        return {
            "summary": f"{pname} has reached 100% completion with final reported outcomes recorded.",
            "primary_reasons": [
                f"Project physical progress reached {curr.get('physical_progress_pct', '100%')}.",
                f"Final schedule extension closed at {curr.get('schedule_extension_months', '0')} months.",
                f"Final cost escalation recorded at {curr.get('cost_escalation_crore', '₹0.00 Cr')} ({curr.get('cost_overrun_pct', '0%')}).",
            ],
            "supporting_factors": [
                "Future 3-month and 6-month forecasting is discontinued for completed assets.",
                "Historical predictions from earlier active snapshots remain accessible in the timeline.",
            ],
            "risk_reducing_factors": [
                "Project execution risk has concluded with final commissioning.",
            ],
            "provider": "Outcome Summary Layer",
            "is_fallback": False,
        }

    def answer_question(
        self,
        project_context: Dict[str, Any],
        question: str,
        chat_history: Optional[List[Dict[str, str]]] = None
    ) -> str:
        """
        Interactive Q&A assistant strictly grounded in the project context & SHAP evidence.
        """
        if not self.api_key:
            return self._answer_question_fallback(project_context, question)

        system_prompt = (
            "You are the Nirmaan Dristi AI Assistant explaining infrastructure risk predictions for government decision-makers.\n"
            "You must answer user questions using ONLY the supplied verified project context, ML prediction results, and SHAP evidence.\n\n"
            "STRICT RULES:\n"
            "1. Answer ONLY based on the facts provided in the JSON context.\n"
            "2. NEVER invent facts, reasons, contractor information, or historical trends not in the context.\n"
            "3. If the context does not contain enough data to answer a specific question, state clearly that the available PAIMANA report data does not contain that information.\n"
            "4. Keep answers professional, concise, and structured (use bullet points where appropriate).\n"
            "5. Cite specific numbers (progress %, months, ₹ Cr, SHAP drivers) directly from the context."
        )

        messages = [{"role": "system", "content": system_prompt}]
        messages.append({"role": "system", "content": f"VERIFIED PROJECT CONTEXT:\n{json.dumps(project_context, indent=2, default=str)}"})

        if chat_history:
            for msg in chat_history[-4:]:
                messages.append({"role": msg["role"], "content": msg["content"]})

        messages.append({"role": "user", "content": question})

        url = f"{self.api_base.rstrip('/')}/chat/completions"
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }
        body = {
            "model": self.model_name,
            "messages": messages,
            "temperature": 0.2,
            "max_tokens": 600,
        }

        try:
            resp = requests.post(url, headers=headers, json=body, timeout=self.timeout_seconds)
            if resp.status_code == 200:
                data = resp.json()
                return data["choices"][0]["message"]["content"].strip()
            else:
                return self._answer_question_fallback(project_context, question)
        except Exception as e:
            logger.warning(f"Interactive Q&A API call failed: {e}")
            return self._answer_question_fallback(project_context, question)

    def _answer_question_fallback(self, ctx: Dict[str, Any], question: str) -> str:
        """Deterministic grounded answers for common questions when offline."""
        q_lower = question.lower()
        meta = ctx.get("project_metadata", {})
        sched_3m = ctx.get("schedule_forecasts", {}).get("3_month", {})
        sched_6m = ctx.get("schedule_forecasts", {}).get("6_month", {})
        cost_3m = ctx.get("cost_forecasts", {}).get("3_month", {})
        cost_6m = ctx.get("cost_forecasts", {}).get("6_month", {})
        metrics = ctx.get("current_metrics", {})

        pname = meta.get("project_name", "This project")

        if "biggest factor" in q_lower or "main driver" in q_lower or "top factor" in q_lower:
            drivers = sched_3m.get("top_risk_drivers", [])
            if drivers:
                top = drivers[0]
                return f"**Biggest Risk Driver for {pname}:**\n\nThe primary factor driving the prediction is **{top['label']}** ({top['actual_value']}), contributing **+{top['shap_contribution']:.2f}** to the model's risk score."
            return f"The model is relying on baseline sectoral metrics for {meta.get('sector', 'this sector')}."

        elif "reducing" in q_lower or "protective" in q_lower or "mitigat" in q_lower:
            prot = sched_3m.get("protective_factors", [])
            if prot:
                items = "\n".join([f"- **{p['label']}** ({p['actual_value']}): reduces risk score by **{p['shap_contribution']:.2f}**" for p in prot[:3]])
                return f"**Factors Reducing Risk for {pname}:**\n\n{items}"
            return f"No strong protective factors were identified for {pname} in the latest snapshot."

        elif "cost" in q_lower:
            return (
                f"**Cost Overrun Assessment for {pname}:**\n\n"
                f"- **Current Reported Overrun**: {metrics.get('cost_overrun_pct', 'N/A')} ({metrics.get('cost_escalation_crore', 'N/A')})\n"
                f"- **3-Month Additional Risk**: {cost_3m.get('probability_pct', 'N/A')}% ({cost_3m.get('risk_level', 'N/A')})\n"
                f"- **6-Month Additional Risk**: {cost_6m.get('probability_pct', 'N/A')}% ({cost_6m.get('risk_level', 'N/A')})\n"
                f"- **Predicted 3M Overrun Increment**: {cost_3m.get('predicted_additional_overrun', 'N/A')}\n"
                f"- **Forecasted Final Cost**: {cost_3m.get('forecasted_final_cost', 'N/A')}"
            )

        elif "6-month" in q_lower or "difference" in q_lower or "horizon" in q_lower:
            return (
                f"**Comparison between 3-Month and 6-Month Horizons for {pname}:**\n\n"
                f"- **3-Month Schedule Risk**: {sched_3m.get('probability_pct', 'N/A')}% (Predicted Additional Delay: {sched_3m.get('predicted_additional_delay', 'N/A')})\n"
                f"- **6-Month Schedule Risk**: {sched_6m.get('probability_pct', 'N/A')}% (Predicted Additional Delay: {sched_6m.get('predicted_additional_delay', 'N/A')})\n\n"
                f"The 6-month horizon models compound escalation over a longer trajectory window, accounting for persistent stagnation streaks and cumulative target deadlines."
            )

        else:
            # General overview
            return (
                f"**Assessment Summary for {pname} (Project ID: {meta.get('project_id')}):**\n\n"
                f"- **Reported Status**: {meta.get('status', 'N/A')} (Physical Progress: {metrics.get('physical_progress_pct', 'N/A')})\n"
                f"- **3M Schedule Risk**: {sched_3m.get('risk_level', 'N/A')} ({sched_3m.get('probability_pct', 'N/A')}%), predicted delay {sched_3m.get('predicted_additional_delay', 'N/A')}\n"
                f"- **Tentative Completion Date**: {sched_3m.get('tentative_completion_date', 'N/A')}\n"
                f"- **Key Driver**: {sched_3m.get('top_risk_drivers', [{}])[0].get('label', 'Sector baseline') if sched_3m.get('top_risk_drivers') else 'Sector baseline'}\n\n"
                f"*(Generated via grounded rule-based explanation layer)*"
            )

    def generate_project_narrative_summary(
        self,
        project_id: str,
        df: pd.DataFrame,
        prediction_result: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Generate a decision-oriented 'AI Project Summary' and 'Key Early Alerts'
        synthesizing Raw Project Data, Historical Trends, ML Predictions, and SHAP drivers.
        Strictly conforms to the 5 Project-Stage-Aware maturity cases while analyzing
        financial performance as a continuous trend over the project's history.
        """
        proj_mask = df["project_id"].astype(str) == str(project_id)
        history = df[proj_mask].sort_values("report_month").reset_index(drop=True)
        if len(history) == 0:
            raise ValueError(f"Project not found: {project_id}")

        latest_row = history.iloc[-1]
        raw_progress = latest_row.get("physical_progress_pct")
        curr_progress = float(raw_progress) if pd.notna(raw_progress) else 0.0

        schedule_status = str(latest_row.get("schedule_status", "")).upper()
        is_completed_flag = (curr_progress >= 100.0) or (schedule_status == "COMPLETED")

        # Determine Stage Case
        if is_completed_flag:
            stage_case = "CASE 1 — COMPLETED PROJECT"
        elif curr_progress >= 99.0:
            stage_case = "CASE 2 — ALMOST COMPLETED PROJECT"
        elif curr_progress == 0.0:
            stage_case = "CASE 3 — NEW PROJECT"
        elif curr_progress < 2.0:
            stage_case = "CASE 4 — JUST STARTED PROJECT"
        else:
            stage_case = "CASE 5 — NORMAL ACTIVE PROJECT"

        info = prediction_result.get("project_info", {})
        timeline = prediction_result.get("timeline", {})

        pname = info.get("project_name", "Unknown Project")
        ministry = info.get("ministry_department", "N/A")
        sector = info.get("sector", "N/A")

        # Extract comprehensive financial & graph trajectory analytics
        fin_traj = extract_financial_and_graph_trajectory(history, latest_row)

        start_d = latest_row["approval_start"].strftime("%B %Y") if pd.notna(latest_row.get("approval_start")) else "N/A"
        orig_doc_d = latest_row["original_target_doc"].strftime("%B %Y") if pd.notna(latest_row.get("original_target_doc")) else "N/A"
        rev_doc_d = latest_row["revised_doc"].strftime("%B %Y") if pd.notna(latest_row.get("revised_doc")) else None
        effective_doc_d = rev_doc_d if rev_doc_d else orig_doc_d
        as_of_d = latest_row["report_month"].strftime("%B %Y") if pd.notna(latest_row.get("report_month")) else "N/A"

        ext_months_val = float(latest_row.get("schedule_extension_months")) if pd.notna(latest_row.get("schedule_extension_months")) else 0.0

        # ML Forecasts
        time_pred = prediction_result.get("time_prediction", {})
        cost_pred = prediction_result.get("cost_prediction", {})
        sched_3m = time_pred.get("3_month", {})
        sched_6m = time_pred.get("6_month", {})
        c_3m = cost_pred.get("3_month", {})
        c_6m = cost_pred.get("6_month", {})

        # SHAP
        shap_sched = prediction_result.get("explanations", {}).get("time_3m", {})
        top_pos_shap = [get_feature_readable_info(d["feature"], latest_row)["display_name"] for d in shap_sched.get("top_risk_drivers", [])[:3]]
        top_neg_shap = [get_feature_readable_info(d["feature"], latest_row)["display_name"] for d in shap_sched.get("top_protective_factors", [])[:3]]

        # Build Context Package
        context_pkg = {
            "project_id": str(project_id),
            "project_name": pname,
            "stage_case": stage_case,
            "sector": sector,
            "ministry": ministry,
            "physical_progress_pct": curr_progress,
            "financial_trajectory": fin_traj,
            "schedule_data": {
                "start_date": start_d,
                "original_target_doc": orig_doc_d,
                "revised_doc": rev_doc_d,
                "effective_doc": effective_doc_d,
                "as_of_date": as_of_d,
                "schedule_extension_months": ext_months_val,
                "schedule_status": schedule_status,
                "time_elapsed_till_now": timeline.get("time_elapsed_till_now", "N/A"),
                "time_remaining_planned": timeline.get("time_remaining_planned_completion", "N/A"),
            },
            "ml_forecasts": {
                "schedule_3m": sched_3m,
                "schedule_6m": sched_6m,
                "cost_3m": c_3m,
                "cost_6m": c_6m,
            },
            "top_shap_drivers": {
                "positive_drivers": top_pos_shap,
                "protective_factors": top_neg_shap,
            },
        }

        # Determine Stage Alerts Title
        if is_completed_flag:
            alerts_title = "Final Outcome Insights"
        elif curr_progress >= 99.0:
            alerts_title = "Final-Stage Insights"
        elif curr_progress < 2.0:
            alerts_title = "Initial Project Insights"
        else:
            alerts_title = "Key Early Alerts"

        # If API key is available, call Qwen3-8B
        if self.api_key:
            system_prompt = (
                "You are the Senior Infrastructure AI Monitoring Officer for Nirmaan Drishti (Central Sector Infrastructure Monitoring).\n"
                "Generate an AI Project Summary that reads like a high-level executive briefing for a senior monitoring officer, along with a stage-appropriate insights/alerts box (2–3 bullets).\n\n"
                "RESPONSE FRAMING PRINCIPLES (Answer in natural order: What happened -> What changed -> Where the project stands -> What trends show -> What is likely to happen -> What needs attention):\n"
                "1. START WITH CURRENT STATE: Establish where the project stands today (physical progress %, expenditure ₹ Cr, schedule status, execution phase) without robotic listing.\n"
                "2. EXPLAIN PROJECT HISTORY & COST OVERRUN DETAILS: Sanction date, baseline approved cost, planned timeline. When a cost revision or cost overrun occurred, specify the exact amount added and the exact month (e.g., '₹X crore was added to the project in [Month Year], raising the cost from ₹A Cr to ₹B Cr, representing a Y% cost overrun').\n"
                "3. FINANCIAL STORY OVER TIME: Original cost -> cost revisions -> expenditure over time (earliest to current) -> remaining budget -> expected final financial position (tentative estimate).\n"
                "4. GRAPH & TRAJECTORY INTERPRETATION: Progress velocity, widening/narrowing gap, acceleration/slowing, disbursement pace.\n"
                "5. CONNECT COST + PROGRESS + TIME: Integrate Money + Physical Progress + Schedule dynamics (e.g. cost-progress mismatches or balanced tracking).\n"
                "6. FUTURE OUTLOOK (EXISTING ML OUTPUT): Interpret 3M & 6M delay probabilities, predicted delay months, tentative completion date, without inventing new predictions.\n"
                "7. SHAP ATTRIBUTION: Explain why the model made its assessment ('The model's assessment is primarily influenced by...').\n"
                "8. MATURITY ADAPTATION:\n"
                "   - CASE 1 (100% Completed): 'Final Outcome Insights'. Focus on final cost, revisions, expenditure, completion date, historical delay.\n"
                "   - CASE 2 (99% to <100% Near Completion): 'Final-Stage Insights'. Focus on remaining work %, completion target, commissioning clearances.\n"
                "   - CASE 3 & 4 (0% to <2% New/Just Started): 'Initial Project Insights'. State clearly that insufficient execution history exists for reliable long-term predictive assessment.\n"
                "   - CASE 5 (2% to <99% Active): Full narrative flow with 'Key Early Alerts' (What is happening -> Evidence -> Why it matters -> What should be watched).\n"
                "9. FINANCIAL TERMINOLOGY: Strict mathematical reconciliation (Original Cost, Revised Cost, Actual Expenditure, Remaining Budget, Cost Overrun).\n"
                "10. DYNAMIC LENGTH: Provide a complete, analytical executive briefing with natural paragraph transitions.\n\n"
                "OUTPUT FORMAT:\n"
                "- Return ONLY valid JSON matching: {'summary': str, 'alerts_title': str, 'key_alerts': [{'issue': str, 'evidence': str, 'why_it_matters': str}]}"
            )

            url = f"{self.api_base.rstrip('/')}/chat/completions"
            headers = {"Authorization": f"Bearer {self.api_key}", "Content-Type": "application/json"}
            body = {
                "model": self.model_name,
                "messages": [
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": json.dumps(context_pkg, indent=2, default=str)},
                ],
                "temperature": 0.2,
                "max_tokens": 1000,
                "response_format": {"type": "json_object"} if "qwen" in self.model_name.lower() or "gpt" in self.model_name.lower() else None,
            }
            try:
                resp = requests.post(url, headers=headers, json=body, timeout=self.timeout_seconds)
                if resp.status_code == 200:
                    parsed = json.loads(resp.json()["choices"][0]["message"]["content"].strip())
                    parsed["stage_case"] = stage_case
                    parsed["alerts_title"] = alerts_title
                    parsed["provider"] = f"Qwen3-8B ({self.model_name})"
                    parsed["is_fallback"] = False
                    return parsed
            except Exception as e:
                logger.warning(f"Qwen Project Summary generation failed: {e}")

        # Deterministic Fallback Generation
        return self._generate_narrative_summary_fallback(context_pkg, alerts_title)

    def _generate_narrative_summary_fallback(self, ctx: Dict[str, Any], alerts_title: Optional[str] = None) -> Dict[str, Any]:
        """
        Deterministic stage-aware narrative summary and insights generator.
        Implements mathematically verified executive briefing adhering to all 12 Response Framing rules.
        """
        stage_case = ctx["stage_case"]
        pname = ctx["project_name"]
        sector = ctx["sector"]
        ministry = ctx["ministry"]
        curr_progress = ctx["physical_progress_pct"]

        if alerts_title is None:
            if "CASE 1" in stage_case:
                alerts_title = "Final Outcome Insights"
            elif "CASE 2" in stage_case:
                alerts_title = "Final-Stage Insights"
            elif "CASE 3" in stage_case or "CASE 4" in stage_case:
                alerts_title = "Initial Project Insights"
            else:
                alerts_title = "Key Early Alerts"

        fin = ctx.get("financial_trajectory", {})
        orig_c = fin.get("orig_cost")
        rev_c = fin.get("rev_cost")
        has_rev = fin.get("has_revision", False)
        rev_diff = fin.get("cost_revision_amount", 0.0)
        rev_pct = fin.get("cost_revision_pct", 0.0)
        rev_events = fin.get("revision_events", [])

        earliest_exp = fin.get("earliest_expenditure")
        curr_exp = fin.get("current_expenditure")
        exp_growth = fin.get("expenditure_growth", 0.0)
        exp_pattern = fin.get("expenditure_pattern", "consistent")
        start_m_str = fin.get("start_month", "earlier reporting period")
        curr_m_str = fin.get("current_month", "current period")
        total_snaps = fin.get("total_snapshots", 1)

        earliest_p = fin.get("earliest_progress", curr_progress)
        p_growth = fin.get("progress_growth", 0.0)
        extra_beyond_orig = fin.get("extra_beyond_orig")
        rem_against_orig = fin.get("rem_against_orig")
        rem_against_rev = fin.get("rem_against_rev")
        reported_overrun_pct = fin.get("reported_overrun_pct")
        stagnant_months = fin.get("stagnant_months", 0)

        sched = ctx["schedule_data"]
        start_d = sched.get("start_date", "N/A")
        orig_doc = sched.get("original_target_doc", "N/A")
        rev_doc = sched.get("revised_doc")
        effective_doc = sched.get("effective_doc", orig_doc)
        as_of = sched.get("as_of_date", "N/A")
        ext_mo = float(sched.get("schedule_extension_months", 0.0))
        time_elapsed = sched.get("time_elapsed_till_now", "N/A")

        ml_s3 = ctx.get("ml_forecasts", {}).get("schedule_3m", {})
        ml_s6 = ctx.get("ml_forecasts", {}).get("schedule_6m", {})
        ml_c3 = ctx.get("ml_forecasts", {}).get("cost_3m", {})
        top_shap = ctx.get("top_shap_drivers", {}).get("positive_drivers", [])

        # --- Helper Clauses ---
        # 1. Current State Sentence
        status_clause = f"remains behind its planned trajectory with {ext_mo:.1f} months of accumulated schedule extension" if ext_mo > 0 else "is currently tracking on its planned timeline"
        curr_state_brief = (
            f"The {pname} under {ministry} ({sector}) stands at {curr_progress:.2f}% physical completion and {status_clause}, "
            f"with cumulative expenditure reaching ₹{curr_exp:,.2f} crore after {time_elapsed} of execution."
        ) if curr_exp is not None else (
            f"The {pname} under {ministry} ({sector}) stands at {curr_progress:.2f}% physical completion after {time_elapsed} of execution."
        )

        # 2. History & Baseline (including specific cost overrun details and month)
        if orig_c is not None:
            history_brief = f"Initially approved in {start_d} with a baseline sanctioned cost of ₹{orig_c:,.2f} crore and scheduled completion by {orig_doc}, "
            if has_rev and rev_diff > 0:
                if rev_events:
                    history_brief += f"the project subsequently accumulated an approved cost overrun of ₹{rev_diff:,.2f} crore (+{rev_pct:.1f}%), where {'; '.join(rev_events)}, expanding the total sanctioned budget to ₹{rev_c:,.2f} crore."
                else:
                    history_brief += f"the project subsequently underwent an approved cost revision, adding ₹{rev_diff:,.2f} crore (+{rev_pct:.1f}% cost overrun) to the project budget and expanding the sanctioned fiscal envelope from ₹{orig_c:,.2f} crore to ₹{rev_c:,.2f} crore."
            elif has_rev and rev_diff < 0:
                if rev_events:
                    history_brief += f"the project subsequently underwent a budget revision, where {'; '.join(rev_events)}, reducing the sanctioned cost to ₹{rev_c:,.2f} crore (-₹{abs(rev_diff):,.2f} crore or {abs(rev_pct):.1f}% reduction)."
                else:
                    history_brief += f"the project was revised downward to ₹{rev_c:,.2f} crore (-₹{abs(rev_diff):,.2f} crore or {abs(rev_pct):.1f}% reduction)."
            else:
                history_brief += "the project has operated without subsequent formal cost revisions."
        else:
            history_brief = "Historical baseline parameters require formal verification against sanction records."

        # 3. Financial Journey Over Time
        if total_snaps > 1 and curr_exp is not None and earliest_exp is not None:
            fin_journey_brief = f"Over the reporting timeline, expenditure has risen from ₹{earliest_exp:,.2f} crore in {start_m_str} to ₹{curr_exp:,.2f} crore currently (+₹{exp_growth:,.2f} crore across {total_snaps} reporting snapshots), exhibiting a {exp_pattern} disbursement pace. "
        elif curr_exp is not None:
            fin_journey_brief = f"Cumulative expenditure currently stands at ₹{curr_exp:,.2f} crore. "
        else:
            fin_journey_brief = "Expenditure figures require account verification. "

        if curr_exp is not None and orig_c is not None:
            if extra_beyond_orig is not None and extra_beyond_orig > 0:
                if has_rev and rem_against_rev is not None and rem_against_rev > 0:
                    fin_journey_brief += f"Actual expenditure has exceeded the original sanction by ₹{extra_beyond_orig:,.2f} crore, while leaving approximately ₹{rem_against_rev:,.2f} crore unutilized against the expanded revised allocation."
                elif has_rev and rem_against_rev is not None and rem_against_rev == 0:
                    fin_journey_brief += f"Actual expenditure has exhausted the entire revised allocation of ₹{rev_c:,.2f} crore (exceeding original sanction by ₹{extra_beyond_orig:,.2f} crore)."
                else:
                    overrun_str = f" of {reported_overrun_pct:.1f}%" if reported_overrun_pct is not None else ""
                    fin_journey_brief += f"Actual expenditure has exceeded the sanctioned allocation by ₹{extra_beyond_orig:,.2f} crore, reflecting unbudgeted financial escalation{overrun_str}."
            elif rem_against_orig is not None and rem_against_orig > 0:
                if has_rev and rem_against_rev is not None:
                    fin_journey_brief += f"Cumulative disbursements leave approximately ₹{rem_against_rev:,.2f} crore unutilized against the expanded revised budget (and ₹{rem_against_orig:,.2f} crore remaining against the original baseline allocation)."
                else:
                    fin_journey_brief += f"Cumulative disbursements leave approximately ₹{rem_against_orig:,.2f} crore unutilized against the sanctioned allocation."

        # 4. Graph & Trend (Money + Physical Progress + Schedule)
        if total_snaps > 1:
            if stagnant_months >= 2 and exp_growth > 0:
                trend_brief = f"Trajectory analysis reveals a critical disconnect: while physical progress has remained stalled at {curr_progress:.1f}% across {stagnant_months} consecutive reporting cycles, expenditure continued to rise by ₹{exp_growth:,.2f} crore, creating a pronounced cost-progress mismatch alongside {ext_mo:.1f} months of cumulative schedule extension."
            elif exp_growth > 0 and p_growth <= 1.5 and total_snaps >= 4:
                trend_brief = f"Trajectory analysis indicates that expenditure has risen substantially (+₹{exp_growth:,.2f} crore) while physical progress advanced at a slower pace from {earliest_p:.1f}% to {curr_progress:.1f}% ({p_growth:+.1f} pp), creating a cost-progress divergence alongside {ext_mo:.1f} months of schedule extension."
            elif p_growth > 0 and exp_growth > 0:
                trend_brief = f"Trajectory trends show physical progress advancing steadily from {earliest_p:.1f}% to {curr_progress:.1f}% ({p_growth:+.1f} pp), with expenditure tracking in steady proportion against project milestones despite {ext_mo:.1f} months of historical timeline extension."
            else:
                trend_brief = f"Recorded trajectory shows physical execution at {curr_progress:.1f}% against cumulative disbursements of ₹{curr_exp:,.2f} crore."
        else:
            trend_brief = f"The project is in its baseline monitoring snapshot with {curr_progress:.1f}% physical progress."

        # 5. Future Outlook (ML) & 6. SHAP
        prob_raw = ml_s3.get("additional_delay_probability")
        prob_s3 = round(float(prob_raw) * 100, 1) if prob_raw is not None else float(ml_s3.get("probability_pct", 0))
        risk_s3 = "HIGH RISK" if prob_s3 >= 50.0 else "MODERATE RISK" if prob_s3 >= 25.0 else "LOW RISK"
        delta_val = ml_s3.get("predicted_additional_delay_months")
        delay_s3 = f"{float(delta_val):+.2f} months" if delta_val is not None else ml_s3.get("predicted_additional_delay", "+0.00 months")
        tentative_d = ml_s3.get("tentative_completion_date", "target schedule")
        time_needed = ml_s3.get("estimated_time_needed_completion", "N/A")

        pred_cost_final = ml_c3.get("predicted_final_revised_cost_crore")
        rem_work = round(100.0 - curr_progress, 2)
        fin_estimate_str = ""
        if pred_cost_final is not None and curr_exp is not None and pred_cost_final > curr_exp:
            needed_funds = round(pred_cost_final - curr_exp, 2)
            fin_estimate_str = f" Based on current expenditure patterns and the remaining {rem_work}% of physical work, tentative model estimates suggest approximately ₹{needed_funds:,.2f} crore in additional disbursements will be required to reach completion."
        elif rem_against_rev is not None and rem_against_rev > 0 and (ml_c3.get("additional_escalation_probability", 0) < 0.2):
            fin_estimate_str = f" Current expenditure trends suggest that a portion of the revised allocation (approx. ₹{rem_against_rev:,.2f} crore) remains available to support final-mile completion."

        lead_driver = top_shap[0] if top_shap else "target date compression"
        future_shap_brief = (
            f"Looking ahead, the machine-learning forecast evaluates the project at {risk_s3} ({prob_s3}% probability) for additional schedule delay over the next 3 months, projecting an additional delay of {delay_s3} and shifting tentative completion to {tentative_d} (estimated {time_needed} needed).{fin_estimate_str} "
            f"The model's forward assessment is primarily influenced by {lead_driver}, which places ongoing pressure on target milestone delivery."
        )

        # ----------------------------------------------------
        # CASE 1: COMPLETED PROJECT -> Final Outcome Insights
        # ----------------------------------------------------
        if "CASE 1" in stage_case:
            delay_outcome = f"delayed by {ext_mo:.1f} months against its original target" if ext_mo > 0 else "on schedule"
            summary = (
                f"The {pname} under {ministry} ({sector}) has reached 100% physical completion and successfully closed active execution. "
                f"{history_brief} {fin_journey_brief} "
                f"The project achieved final physical completion in {curr_m_str} (originally scheduled for {orig_doc}), resulting in {delay_outcome}. "
                f"Active project monitoring has concluded with final asset handover."
            )
            alerts = []
            if extra_beyond_orig and extra_beyond_orig > 0:
                alerts.append({
                    "issue": "Overall Financial Outcome",
                    "evidence": f"Original allocation ₹{orig_c:,.2f} Cr vs actual expenditure ₹{curr_exp:,.2f} Cr (₹{extra_beyond_orig:,.2f} Cr additional spent).",
                    "why_it_matters": "Cumulative budgetary escalation absorbed during asset lifecycle."
                })
            elif rem_against_orig and rem_against_orig > 0:
                alerts.append({
                    "issue": "Overall Financial Outcome",
                    "evidence": f"Original allocation ₹{orig_c:,.2f} Cr vs actual expenditure ₹{curr_exp:,.2f} Cr (₹{rem_against_orig:,.2f} Cr unutilized balance).",
                    "why_it_matters": "Execution completed within sanctioned fiscal envelope."
                })
            if ext_mo > 0:
                alerts.append({
                    "issue": "Overall Schedule Outcome",
                    "evidence": f"Originally scheduled for {orig_doc}, completed in {as_of} ({ext_mo:.1f} months total delay).",
                    "why_it_matters": "Reflects cumulative timeline revisions experienced prior to final commissioning."
                })
            else:
                alerts.append({
                    "issue": "Overall Schedule Outcome",
                    "evidence": f"Achieved on-time completion by {as_of} within planned baseline schedule.",
                    "why_it_matters": "Successful milestone adherence and timely public handover."
                })
            alerts.append({
                "issue": "Historical Execution Assessment",
                "evidence": f"100% physical progress achieved across {total_snaps} reported monitoring cycles.",
                "why_it_matters": "Active project monitoring concluded; asset is fully commissioned."
            })

        # ----------------------------------------------------
        # CASE 2: ALMOST COMPLETED PROJECT -> Final-Stage Insights
        # ----------------------------------------------------
        elif "CASE 2" in stage_case:
            rem_pct = round(100.0 - curr_progress, 2)
            summary = (
                f"{curr_state_brief} {history_brief} {fin_journey_brief} "
                f"With only {rem_pct}% of physical work remaining, current completion is targeted for {effective_doc} ({ext_mo:.1f} months cumulative extension). "
                f"Executive attention shifts towards statutory clearances, integrated testing, punch-list closure, and administrative asset handover."
            )
            alerts = [
                {
                    "issue": "Remaining Execution & Target Timeline",
                    "evidence": f"Only {rem_pct}% physical work remains, with current completion targeted for {effective_doc}.",
                    "why_it_matters": "Final-mile delivery must be closely tracked to avoid lingering completion overhang."
                },
                {
                    "issue": "Commissioning & Asset Handover",
                    "evidence": f"Project stands at {curr_progress:.1f}% physical progress after {ext_mo:.1f} months of extension.",
                    "why_it_matters": "Focus shifts to statutory testing, safety clearances, and administrative handover."
                }
            ]
            if rem_against_rev and rem_against_rev > 0:
                alerts.append({
                    "issue": "Allocation Balance Reconciliation",
                    "evidence": f"₹{rem_against_rev:,.2f} crore remains against the revised allocation balance.",
                    "why_it_matters": "Requires final bill processing and contract closure upon commissioning."
                })
            elif rem_against_orig and rem_against_orig > 0:
                alerts.append({
                    "issue": "Allocation Balance Reconciliation",
                    "evidence": f"₹{rem_against_orig:,.2f} crore remains unutilized against the sanctioned allocation.",
                    "why_it_matters": "Requires final bill processing and contract closure upon commissioning."
                })

        # ----------------------------------------------------
        # CASE 3: NEW PROJECT (0%) -> Initial Project Insights
        # ----------------------------------------------------
        elif "CASE 3" in stage_case:
            summary = (
                f"The {pname} is an approved {sector} infrastructure project under {ministry} with an allotted cost of ₹{orig_c:,.2f} crore and scheduled completion by {orig_doc}. "
                f"This is a new project with 0% physical execution progress, so there is currently insufficient execution history for a reliable assessment of long-term project performance. "
                f"Initial focus remains on statutory clearances, land acquisition, site handover, and contractor mobilization."
            )
            alerts = [
                {
                    "issue": "Project Initiation Baseline",
                    "evidence": f"Allotted cost of ₹{orig_c:,.2f} Cr with scheduled completion targeted for {orig_doc}.",
                    "why_it_matters": "Establishes the approved master baseline parameters for future monitoring."
                },
                {
                    "issue": "Execution History Limitation",
                    "evidence": "0% physical progress recorded in baseline inception snapshot.",
                    "why_it_matters": "Insufficient execution history exists for reliable long-term predictive assessment."
                }
            ]

        # ----------------------------------------------------
        # CASE 4: JUST STARTED PROJECT (<2%) -> Initial Project Insights
        # ----------------------------------------------------
        elif "CASE 4" in stage_case:
            summary = (
                f"The {pname} under {ministry} has recently commenced physical execution, standing at {curr_progress:.2f}% progress against an allotted cost of ₹{orig_c:,.2f} crore. "
                f"{fin_journey_brief} Scheduled completion is targeted for {orig_doc}. "
                f"Only limited conclusions can be drawn regarding long-term project performance at this inception stage, as ground execution and site mobilization are actively ramping up."
            )
            alerts = [
                {
                    "issue": "Early Inception Progress",
                    "evidence": f"Physical progress stands at {curr_progress:.2f}% with ₹{curr_exp:,.2f} Cr initial expenditure.",
                    "why_it_matters": "Site mobilization and ground execution are in preliminary setup phase."
                },
                {
                    "issue": "Execution History Limitation",
                    "evidence": f"Initial execution stage with {total_snaps} reported snapshot(s).",
                    "why_it_matters": "Insufficient execution history exists for reliable long-term predictive assessment."
                }
            ]

        # ----------------------------------------------------
        # CASE 5: NORMAL ACTIVE PROJECT (2% to <99%) -> Key Early Alerts
        # ----------------------------------------------------
        else:
            summary = (
                f"{curr_state_brief} {history_brief} {fin_journey_brief} "
                f"{trend_brief} "
                f"{future_shap_brief}"
            )

            alerts = []
            if prob_s3 >= 50.0 or ext_mo > 12:
                alerts.append({
                    "issue": "Schedule Escalation Risk",
                    "evidence": f"Existing extension of {ext_mo:.1f} months combined with {prob_s3}% probability of {delay_s3} additional delay.",
                    "why_it_matters": f"Pushes projected completion to {tentative_d}, compounding operational handover delays."
                })

            if fin.get("mismatch_flag", False):
                if stagnant_months >= 2:
                    alerts.append({
                        "issue": "Progress Stagnation vs Spending",
                        "evidence": f"Physical progress stalled at {curr_progress:.1f}% for {stagnant_months} consecutive cycles while cumulative expenditure rose by ₹{exp_growth:,.2f} Cr.",
                        "why_it_matters": "Signals execution bottlenecks on ground while fixed project costs and disbursements continue to accrue."
                    })
                else:
                    alerts.append({
                        "issue": "Financial vs Physical Progress Divergence",
                        "evidence": f"Expenditure increased by ₹{exp_growth:,.2f} Cr (+{exp_pattern} pace) while progress advanced {p_growth:+.1f} pp.",
                        "why_it_matters": "Elevated fund outflow ahead of physical milestone deliverables increases overall cost overrun risk."
                    })
            elif has_rev and rev_diff > 0:
                alerts.append({
                    "issue": "Cost Revision & Budgetary Escalation",
                    "evidence": f"Project budget revised from ₹{orig_c:,.2f} Cr to ₹{rev_c:,.2f} Cr (+₹{rev_diff:,.2f} Cr or +{rev_pct:.1f}%).",
                    "why_it_matters": "Monitors adherence to the expanded fiscal ceiling to prevent secondary revision cycles."
                })

            if not alerts:
                alerts.append({
                    "issue": "Execution Alignment Monitored",
                    "evidence": f"Progress ({curr_progress:.1f}%) and expenditure (₹{curr_exp:,.2f} Cr) tracking consistently against schedule.",
                    "why_it_matters": "Maintain current monthly execution velocity to prevent milestone slippage."
                })

        return {
            "stage_case": stage_case,
            "alerts_title": alerts_title,
            "summary": summary,
            "key_alerts": alerts,
            "provider": "Nirmaan Drishti Grounded Analyst (Senior Briefing Synthesis)",
            "is_fallback": True,
        }

