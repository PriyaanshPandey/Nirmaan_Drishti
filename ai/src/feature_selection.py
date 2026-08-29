"""
Feature selection and trajectory engineering for PAIMANA ML models.

Defines approved feature lists, trajectory features, and feature splitting.
Ensures zero temporal leakage: all trajectory features are computed strictly
from current and prior historical snapshots.
"""

from typing import List, Tuple, Dict
import pandas as pd
import numpy as np


# --- Identifier / lineage columns: NEVER used as ML features ---
IDENTIFIER_COLUMNS = [
    "project_id",
    "project_key",
    "project_name",
    "legacy_ocms_code",
    "pmgid",
    "page",
    "source_report",
    "data_quality_flag",
]

# --- Date columns: used for ordering/targets, not raw features ---
DATE_COLUMNS = [
    "report_month",
    "approval_start",
    "original_target_doc",
    "revised_doc",
]

# --- Categorical features ---
CATEGORICAL_FEATURES = [
    "agency",
    "ministry_department",
    "sector",
    "state",
    "schedule_status",
]

# --- Numeric state features ---
NUMERIC_STATE_FEATURES = [
    "project_age_months",
    "original_duration_months",
    "planned_remaining_months",
    "revised_remaining_months",
    "schedule_extension_months",
    "extension_rate_pct",
    "original_cost_crore",
    "revised_cost_crore",
    "cumulative_expenditure_crore",
    "cost_overrun_pct",
    "expenditure_ratio_pct",
    "cost_escalation_crore",
    "cost_escalation_ratio",
    "remaining_budget_crore",
    "expenditure_velocity_crore_month",
    "physical_progress_pct",
    "remaining_work_pct",
    "physical_financial_gap_pct",
    "physical_to_expenditure_ratio",
    "progress_expenditure_mismatch_flag",
    "high_expenditure_low_progress_flag",
    "days_to_original_target",
    "days_to_revised_target",
    "overdue_days",
    "extension_count",
    "risk_signal_count",
]

# --- Numeric trend & trajectory features ---
NUMERIC_TREND_FEATURES = [
    "physical_progress_delta_1m",
    "physical_progress_delta_3m",
    "progress_velocity_3m",
    "progress_trend_slope",
    "cost_overrun_delta_1m",
    "cost_overrun_delta_3m",
    "cost_overrun_trend_slope",
    "expenditure_ratio_delta_1m",
    "expenditure_ratio_delta_3m",
    "schedule_extension_delta_1m",
    # Engineered trajectory features
    "progress_minus_expenditure_gap",
    "expenditure_minus_progress_gap",
    "cost_overrun_negative_flag",
    "is_overdue_flag",
    "is_extended_flag",
    "consecutive_stagnant_months",
]

# --- All approved features ---
ALL_NUMERIC_FEATURES = NUMERIC_STATE_FEATURES + NUMERIC_TREND_FEATURES
ALL_FEATURES = CATEGORICAL_FEATURES + ALL_NUMERIC_FEATURES


def enrich_trajectory_features(df: pd.DataFrame) -> pd.DataFrame:
    """
    Compute trajectory features strictly from historical data up to month t.
    Does NOT use future information.

    Parameters
    ----------
    df : pd.DataFrame
        Dataset sorted chronologically by (project_id, report_month).

    Returns
    -------
    pd.DataFrame
        Dataset with enriched trajectory features.
    """
    df = df.sort_values(["project_id", "report_month"]).copy()

    # Progress vs Expenditure gap
    prog = df["physical_progress_pct"].fillna(0)
    exp = df["expenditure_ratio_pct"].fillna(0)
    df["progress_minus_expenditure_gap"] = prog - exp
    df["expenditure_minus_progress_gap"] = exp - prog

    # Under budget flag (preserves negative cost overrun semantics)
    df["cost_overrun_negative_flag"] = (df["cost_overrun_pct"] < 0).astype(float)

    # Schedule flags
    status = df["schedule_status"].fillna("")
    overdue_d = df["overdue_days"].fillna(0)
    ext_mo = df["schedule_extension_months"].fillna(0)
    df["is_overdue_flag"] = ((status == "OVERDUE") | (overdue_d > 0)).astype(float)
    df["is_extended_flag"] = ((status == "EXTENDED") | (ext_mo > 0)).astype(float)

    # Consecutive stagnant months (months where progress delta <= 0.1)
    stagnant_counts = []
    for pid, grp in df.groupby("project_id", sort=False):
        current_streak = 0
        deltas = grp["physical_progress_delta_1m"].values
        for d in deltas:
            if pd.notna(d) and d <= 0.1:
                current_streak += 1
            else:
                current_streak = 0
            stagnant_counts.append(float(current_streak))

    df["consecutive_stagnant_months"] = stagnant_counts

    return df


def get_feature_columns() -> List[str]:
    """Return the list of all approved feature columns."""
    return ALL_FEATURES.copy()


def get_categorical_features() -> List[str]:
    """Return the list of categorical feature columns."""
    return CATEGORICAL_FEATURES.copy()


def get_numeric_features() -> List[str]:
    """Return the list of numeric feature columns."""
    return ALL_NUMERIC_FEATURES.copy()


def get_available_features(df: pd.DataFrame) -> List[str]:
    """Return the list of approved features present in the DataFrame."""
    return [col for col in ALL_FEATURES if col in df.columns]


def get_available_feature_split(df: pd.DataFrame) -> Dict[str, List[str]]:
    """Return dict of available categorical and numeric features."""
    return {
        "categorical": [c for c in CATEGORICAL_FEATURES if c in df.columns],
        "numeric": [c for c in ALL_NUMERIC_FEATURES if c in df.columns],
    }


def validate_features(df: pd.DataFrame) -> Tuple[List[str], List[str]]:
    """Check which approved features are present and which are missing."""
    available = get_available_features(df)
    missing = [c for c in ALL_FEATURES if c not in df.columns]
    return available, missing
