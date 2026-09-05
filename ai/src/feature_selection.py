"""
Feature selection and trajectory engineering for PAIMANA ML models.

Defines approved feature lists, trajectory features, cold-start features, and feature splitting.
Ensures zero temporal leakage: all trajectory features are computed strictly
from current and prior historical snapshots.
"""

from typing import List, Tuple, Dict
import pandas as pd
import numpy as np


# --- Identifier / lineage columns: NEVER used as ML features (causes memorization) ---
IDENTIFIER_COLUMNS = [
    "project_id",
    "project_key",
    "project_name",
    "legacy_ocms_code",
    "pmgid",
    "page",
    "source_report",
    "data_quality_flag",
    "extraction_date",
    "record_version",
]

# --- Date columns: used for ordering/targets, not raw string features ---
DATE_COLUMNS = [
    "report_month",
    "approval_start",
    "original_target_doc",
    "revised_doc",
]

# --- Categorical features (Contextual) ---
CATEGORICAL_FEATURES = [
    "agency",
    "ministry_department",
    "sector",
    "state",
    "schedule_status",
]

# --- Cold-Start Categorical Features (Known at project sanction) ---
COLD_START_CATEGORICAL_FEATURES = [
    "agency",
    "ministry_department",
    "sector",
    "state",
]

# --- Cold-Start Numeric Features (Known at project sanction) ---
COLD_START_NUMERIC_FEATURES = [
    "original_cost_crore",
    "original_duration_months",
    "planned_remaining_months",
]

# --- Numeric state features (Snapshot at forecast origin T) ---
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
    "remaining_budget_crore",
    "expenditure_velocity_crore_month",
    "physical_progress_pct",
    "remaining_work_pct",
    "physical_financial_gap",
    "progress_minus_expenditure_gap",
    "expenditure_vs_progress_ratio",
    "elapsed_duration_pct",
    "months_to_original_completion",
    "months_to_revised_completion",
    "progress_vs_elapsed_time",
    "is_overdue_flag",
    "is_extended_flag",
    "cost_overrun_negative_flag",
    "snapshot_history_count",
]

# --- Numeric trend & trajectory features (Backward-looking from T) ---
NUMERIC_TREND_FEATURES = [
    "cost_overrun_rolling_mean_3m",
    "cost_overrun_rolling_mean_6m",
    "cost_overrun_rolling_std_3m",
    "cost_overrun_rolling_std_6m",
    "progress_rolling_mean_3m",
    "progress_rolling_std_3m",
    "delay_rolling_mean_3m",
    "delay_rolling_std_3m",
    "expenditure_change_1m",
    "expenditure_change_3m",
    "expenditure_acceleration",
    "progress_change_1m",
    "progress_change_3m",
    "progress_acceleration",
    "delay_change_1m",
    "delay_change_3m",
    "delay_acceleration",
    "consecutive_stagnant_months",
]

# --- All approved mature features ---
ALL_NUMERIC_FEATURES = NUMERIC_STATE_FEATURES + NUMERIC_TREND_FEATURES
ALL_FEATURES = CATEGORICAL_FEATURES + ALL_NUMERIC_FEATURES
COLD_START_ALL_FEATURES = COLD_START_CATEGORICAL_FEATURES + COLD_START_NUMERIC_FEATURES


def is_cold_start(df: pd.DataFrame) -> pd.Series:
    """
    Classify projects as new/low-history when:
    project_age_months < 2 OR physical_progress_pct < 2.0% OR snapshot_history_count <= 2.
    """
    age = df["project_age_months"].fillna(0)
    prog = df["physical_progress_pct"].fillna(0)
    
    # If snapshot_history_count is present
    if "snapshot_history_count" in df.columns:
        snaps = df["snapshot_history_count"].fillna(1)
        return (age < 2) | (prog < 2.0) | (snaps <= 2)
    return (age < 2) | (prog < 2.0)


def enrich_trajectory_features(df: pd.DataFrame) -> pd.DataFrame:
    """
    Compute comprehensive backward-looking features strictly up to month t.
    Does NOT use future information.

    Parameters
    ----------
    df : pd.DataFrame
        Dataset sorted chronologically by (project_id, report_month).

    Returns
    -------
    pd.DataFrame
        Dataset with all 45 enriched state and trajectory features.
    """
    df = df.sort_values(["project_id", "report_month"]).copy()

    # Progress vs Expenditure gaps
    prog = df["physical_progress_pct"].fillna(0)
    exp = df["expenditure_ratio_pct"].fillna(0)
    df["physical_financial_gap"] = exp - prog
    df["progress_minus_expenditure_gap"] = prog - exp
    df["expenditure_vs_progress_ratio"] = np.where(prog > 0, exp / np.maximum(prog, 0.1), 1.0)

    # Under budget flag (preserves negative cost overrun semantics)
    cost_ov = df["cost_overrun_pct"].fillna(0) if "cost_overrun_pct" in df.columns else pd.Series(0.0, index=df.index)
    df["cost_overrun_negative_flag"] = (cost_ov < 0).astype(float)

    # Lifecycle duration features
    orig_dur = df["original_duration_months"].fillna(36.0) if "original_duration_months" in df.columns else pd.Series(36.0, index=df.index)
    age = df["project_age_months"].fillna(0) if "project_age_months" in df.columns else pd.Series(0.0, index=df.index)
    df["elapsed_duration_pct"] = np.where(orig_dur > 0, (age / np.maximum(orig_dur, 0.1)) * 100.0, 0.0)
    df["months_to_original_completion"] = df["planned_remaining_months"].fillna(0) if "planned_remaining_months" in df.columns else pd.Series(0.0, index=df.index)
    df["months_to_revised_completion"] = df["revised_remaining_months"].fillna(0) if "revised_remaining_months" in df.columns else pd.Series(0.0, index=df.index)
    df["progress_vs_elapsed_time"] = np.where(df["elapsed_duration_pct"] > 0, prog / np.maximum(df["elapsed_duration_pct"], 0.1), 1.0)

    # Schedule flags
    status = df["schedule_status"].fillna("").astype(str).str.upper() if "schedule_status" in df.columns else pd.Series("", index=df.index)
    overdue_d = df["overdue_days"].fillna(0) if "overdue_days" in df.columns else pd.Series(0.0, index=df.index)
    ext_mo = df["schedule_extension_months"].fillna(0) if "schedule_extension_months" in df.columns else pd.Series(0.0, index=df.index)
    df["is_overdue_flag"] = ((status == "OVERDUE") | (overdue_d > 0)).astype(float)
    df["is_extended_flag"] = ((status == "EXTENDED") | (ext_mo > 0)).astype(float)

    # Cumulative snapshot history count up to T
    df["snapshot_history_count"] = df.groupby("project_id").cumcount() + 1

    # Project-level rolling backward-looking features
    grouped = df.groupby("project_id", sort=False)
    df["cost_overrun_rolling_mean_3m"] = grouped["cost_overrun_pct"].transform(lambda s: s.rolling(3, min_periods=1).mean()).fillna(0)
    df["cost_overrun_rolling_mean_6m"] = grouped["cost_overrun_pct"].transform(lambda s: s.rolling(6, min_periods=1).mean()).fillna(0)
    df["cost_overrun_rolling_std_3m"] = grouped["cost_overrun_pct"].transform(lambda s: s.rolling(3, min_periods=1).std()).fillna(0)
    df["cost_overrun_rolling_std_6m"] = grouped["cost_overrun_pct"].transform(lambda s: s.rolling(6, min_periods=1).std()).fillna(0)

    df["progress_rolling_mean_3m"] = grouped["physical_progress_pct"].transform(lambda s: s.rolling(3, min_periods=1).mean()).fillna(0)
    df["progress_rolling_std_3m"] = grouped["physical_progress_pct"].transform(lambda s: s.rolling(3, min_periods=1).std()).fillna(0)

    df["delay_rolling_mean_3m"] = grouped["schedule_extension_months"].transform(lambda s: s.rolling(3, min_periods=1).mean()).fillna(0)
    df["delay_rolling_std_3m"] = grouped["schedule_extension_months"].transform(lambda s: s.rolling(3, min_periods=1).std()).fillna(0)

    # Expenditure velocity & acceleration
    exp_series = df["expenditure_ratio_pct"].fillna(0) if "expenditure_ratio_pct" in df.columns else pd.Series(0.0, index=df.index)
    df["expenditure_change_1m"] = grouped["expenditure_ratio_pct"].diff(1).fillna(0)
    df["expenditure_change_3m"] = grouped["expenditure_ratio_pct"].diff(3).fillna(0)
    df["expenditure_acceleration"] = df.groupby("project_id", sort=False)["expenditure_change_1m"].diff(1).fillna(0)

    # Progress velocity & acceleration
    df["progress_change_1m"] = grouped["physical_progress_pct"].diff(1).fillna(0)
    df["progress_change_3m"] = grouped["physical_progress_pct"].diff(3).fillna(0)
    df["progress_acceleration"] = df.groupby("project_id", sort=False)["progress_change_1m"].diff(1).fillna(0)

    # Delay velocity & acceleration
    df["delay_change_1m"] = grouped["schedule_extension_months"].diff(1).fillna(0)
    df["delay_change_3m"] = grouped["schedule_extension_months"].diff(3).fillna(0)
    df["delay_acceleration"] = df.groupby("project_id", sort=False)["delay_change_1m"].diff(1).fillna(0)

    # Consecutive stagnant months
    stagnant_counts = []
    for pid, grp in grouped:
        current_streak = 0
        deltas = grp["progress_change_1m"].values
        for d in deltas:
            if pd.notna(d) and d <= 0.1:
                current_streak += 1
            else:
                current_streak = 0
            stagnant_counts.append(float(current_streak))
    df["consecutive_stagnant_months"] = stagnant_counts

    return df


def get_feature_columns(is_cold: bool = False) -> List[str]:
    """Return the list of approved feature columns."""
    if is_cold:
        return COLD_START_ALL_FEATURES.copy()
    return ALL_FEATURES.copy()


def get_categorical_features(is_cold: bool = False) -> List[str]:
    """Return the list of categorical feature columns."""
    if is_cold:
        return COLD_START_CATEGORICAL_FEATURES.copy()
    return CATEGORICAL_FEATURES.copy()


def get_numeric_features(is_cold: bool = False) -> List[str]:
    """Return the list of numeric feature columns."""
    if is_cold:
        return COLD_START_NUMERIC_FEATURES.copy()
    return ALL_NUMERIC_FEATURES.copy()


def get_available_features(df: pd.DataFrame, is_cold: bool = False) -> List[str]:
    """Return the list of approved features present in the DataFrame."""
    target_list = COLD_START_ALL_FEATURES if is_cold else ALL_FEATURES
    return [col for col in target_list if col in df.columns]


def get_available_feature_split(df: pd.DataFrame, is_cold: bool = False) -> Dict[str, List[str]]:
    """Return dict of available categorical and numeric features."""
    cat_list = COLD_START_CATEGORICAL_FEATURES if is_cold else CATEGORICAL_FEATURES
    num_list = COLD_START_NUMERIC_FEATURES if is_cold else ALL_NUMERIC_FEATURES
    return {
        "categorical": [c for c in cat_list if c in df.columns],
        "numeric": [c for c in num_list if c in df.columns],
    }


def validate_features(df: pd.DataFrame) -> Tuple[List[str], List[str]]:
    """Check which approved features are present and which are missing."""
    available = [col for col in ALL_FEATURES if col in df.columns]
    missing = [c for c in ALL_FEATURES if c not in df.columns]
    return available, missing
