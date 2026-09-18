"""
history_pipeline.py - Core Pipeline Module for Global + Project-History-Aware XGBoost
Supports Nirmaan-Drishti / PAIMANA Infrastructure Monitoring (2011 - May 2026).
"""

import os
import sys
import json
import time
from pathlib import Path
from typing import Dict, List, Tuple, Any

import numpy as np
import pandas as pd
from sklearn.metrics import (
    mean_absolute_error, mean_squared_error, r2_score, median_absolute_error,
    roc_auc_score, f1_score, precision_score, recall_score,
    precision_recall_curve, auc, confusion_matrix, balanced_accuracy_score
)
from xgboost import XGBClassifier, XGBRegressor


def load_and_clean_all_data(workspace_dir: Path = None) -> Tuple[pd.DataFrame, pd.DataFrame]:
    """
    Load and harmonize the three uploaded datasets:
    1. Ongoing Active (data/ongoing project detail.csv / .xlsx)
    2. Ongoing Not Active (data/Ongoing_2328_Non_Active_Projects_Master.csv / .xlsx)
    3. Completed Projects (data/Completed_Projects_2001_to_May_2026.csv / .xlsx) - Reference benchmark
    """
    if workspace_dir is None:
        workspace_dir = Path(__file__).resolve().parent.parent.parent

    data_dir = workspace_dir / "data"

    # 1. Load Ongoing Active
    act_path = data_dir / "ongoing project detail.csv"
    if not act_path.exists():
        act_path = data_dir / "ongoing project detail.xlsx"
        df_act = pd.read_excel(act_path)
    else:
        df_act = pd.read_csv(act_path, low_memory=False)
    df_act["dataset_status"] = "Ongoing Active"
    df_act["is_active_status"] = 1

    # 2. Load Ongoing Not Active
    non_path = data_dir / "Ongoing_2328_Non_Active_Projects_Master.csv"
    if not non_path.exists():
        non_path = data_dir / "Ongoing_2328_Non_Active_Projects_Master.xlsx"
        df_non = pd.read_excel(non_path)
    else:
        df_non = pd.read_csv(non_path, low_memory=False)
    df_non["dataset_status"] = "Ongoing Not Active"
    df_non["is_active_status"] = 0

    # 3. Load Completed Projects (Benchmark table)
    comp_path = data_dir / "Completed_Projects_2001_to_May_2026.csv"
    if not comp_path.exists():
        comp_path = data_dir / "Completed_Projects_2001_to_May_2026.xlsx"
        df_comp = pd.read_excel(comp_path)
    else:
        df_comp = pd.read_csv(comp_path, low_memory=False)
    df_comp["dataset_status"] = "Completed"

    # Combine Active & Non-Active for the snapshot panel
    cols_to_use = [
        "project_id", "project_name", "ministry_department", "state",
        "Date of approval", "Original cost (₹ Cr)", "revised cost (₹ Cr)",
        "Anticipated cost (₹ Cr)", "cumulative expenditure (₹ Cr)",
        "original date of commissioning", "anticipated commissioning",
        "ministry_department/milestone", "physical progress",
        "financial_year", "month", "year", "dataset_status", "is_active_status"
    ]
    df = pd.concat([df_act[cols_to_use], df_non[cols_to_use]], ignore_index=True)

    # Clean strings and parse dates
    df["project_id"] = df["project_id"].astype(str).str.strip()
    df["project_name"] = df["project_name"].fillna("UNKNOWN").astype(str).str.strip()
    df["report_month"] = pd.to_datetime(df["year"].astype(str) + "-" + df["month"].astype(str) + "-01", format="%Y-%B-%d", errors="coerce")
    df["approval_date"] = pd.to_datetime(df["Date of approval"], format="mixed", errors="coerce")
    df["orig_doc"] = pd.to_datetime(df["original date of commissioning"], format="mixed", errors="coerce")
    df["antic_doc"] = pd.to_datetime(df["anticipated commissioning"], format="mixed", errors="coerce")

    # Numeric conversions & cleaning
    df["original_cost_crore"] = pd.to_numeric(df["Original cost (₹ Cr)"], errors="coerce").fillna(0.0)
    df["revised_cost_crore"] = pd.to_numeric(df["revised cost (₹ Cr)"], errors="coerce").fillna(df["original_cost_crore"])
    df["anticipated_cost_crore"] = pd.to_numeric(df["Anticipated cost (₹ Cr)"], errors="coerce").fillna(df["original_cost_crore"])
    df["cumulative_expenditure_crore"] = pd.to_numeric(df["cumulative expenditure (₹ Cr)"], errors="coerce").fillna(0.0)

    # Physical progress %
    prog_clean = df["physical progress"].astype(str).str.replace("%", "", regex=False).str.strip()
    df["physical_progress_pct"] = pd.to_numeric(prog_clean, errors="coerce").fillna(0.0).clip(0.0, 100.0)

    # Milestones parsing
    def parse_ms(val):
        if pd.isna(val): return 0.0, 0.0, 0.0
        s = str(val).strip()
        if "/" in s:
            parts = s.split("/")
            try:
                ach = float(parts[0])
                tot = float(parts[1])
                ratio = (ach / tot) if tot > 0 else 0.0
                return ach, tot, ratio
            except:
                return 0.0, 0.0, 0.0
        return 0.0, 0.0, 0.0

    ms_data = [parse_ms(v) for v in df["ministry_department/milestone"]]
    df["milestones_achieved"] = [t[0] for t in ms_data]
    df["milestones_total"] = [t[1] for t in ms_data]
    df["milestone_ratio"] = [t[2] for t in ms_data]

    # Sector & Agency
    df["ministry_department"] = df["ministry_department"].fillna("UNKNOWN").astype(str).str.strip()
    df["sector"] = df["ministry_department"].apply(lambda s: s.split("/")[0].strip() if "/" in s else s)
    df["agency"] = df["ministry_department"].apply(lambda s: s.split("/")[1].strip() if "/" in s else s)
    df["state"] = df["state"].fillna("UNKNOWN").astype(str).str.strip()

    # Deduplication across (project_id, report_month) to eliminate duplicate reporting entries
    df = df.drop_duplicates(subset=["project_id", "report_month"], keep="last").reset_index(drop=True)

    # Impute zero original cost anomalies
    zero_orig_mask = df["original_cost_crore"] <= 1.0
    df.loc[zero_orig_mask, "original_cost_crore"] = df.loc[zero_orig_mask, "anticipated_cost_crore"].clip(lower=150.0)

    # Derived state metrics
    df["cost_escalation_crore"] = df["anticipated_cost_crore"] - df["original_cost_crore"]
    df["cost_overrun_pct"] = (df["cost_escalation_crore"] / df["original_cost_crore"]) * 100.0
    df["expenditure_ratio_pct"] = (df["cumulative_expenditure_crore"] / df["original_cost_crore"]) * 100.0
    df["physical_financial_gap"] = df["expenditure_ratio_pct"] - df["physical_progress_pct"]
    df["remaining_work_pct"] = np.maximum(0.0, 100.0 - df["physical_progress_pct"])

    # Schedule extension in months
    df["schedule_extension_months"] = (df["antic_doc"].dt.year - df["orig_doc"].dt.year)*12 + (df["antic_doc"].dt.month - df["orig_doc"].dt.month)
    df["schedule_extension_months"] = df["schedule_extension_months"].fillna(0.0).clip(-60, 360)

    # Project age in months
    df["project_age_months"] = (df["report_month"].dt.year - df["approval_date"].dt.year)*12 + (df["report_month"].dt.month - df["approval_date"].dt.month)
    df["project_age_months"] = df["project_age_months"].fillna(0.0).clip(0, 480)

    # Original duration in months
    df["original_duration_months"] = (df["orig_doc"].dt.year - df["approval_date"].dt.year)*12 + (df["orig_doc"].dt.month - df["approval_date"].dt.month)
    df["original_duration_months"] = df["original_duration_months"].fillna(36.0).clip(1, 240)

    return df, df_comp


def engineer_project_history_features(df: pd.DataFrame) -> pd.DataFrame:
    """
    Computes strictly backward-looking historical trajectory features per project (<= month T).
    Guarantees ZERO leakage of future information.
    """
    df = df.sort_values(["project_id", "report_month"]).reset_index(drop=True)
    grouped = df.groupby("project_id", sort=False)

    # 1. Historical Lags (T-1, T-2, T-3)
    df["cost_overrun_lag1"] = grouped["cost_overrun_pct"].shift(1).fillna(df["cost_overrun_pct"])
    df["cost_overrun_lag2"] = grouped["cost_overrun_pct"].shift(2).fillna(df["cost_overrun_lag1"])
    df["cost_overrun_lag3"] = grouped["cost_overrun_pct"].shift(3).fillna(df["cost_overrun_lag2"])

    df["delay_lag1"] = grouped["schedule_extension_months"].shift(1).fillna(df["schedule_extension_months"])
    df["delay_lag2"] = grouped["schedule_extension_months"].shift(2).fillna(df["delay_lag1"])
    df["delay_lag3"] = grouped["schedule_extension_months"].shift(3).fillna(df["delay_lag2"])

    df["progress_lag1"] = grouped["physical_progress_pct"].shift(1).fillna(df["physical_progress_pct"])
    df["progress_lag2"] = grouped["physical_progress_pct"].shift(2).fillna(df["progress_lag1"])
    df["progress_lag3"] = grouped["physical_progress_pct"].shift(3).fillna(df["progress_lag2"])

    df["expenditure_lag1"] = grouped["expenditure_ratio_pct"].shift(1).fillna(df["expenditure_ratio_pct"])

    # 2. Rolling Window Averages & Volatility (3M, 6M backward-looking)
    df["cost_overrun_roll_mean_3m"] = grouped["cost_overrun_pct"].transform(lambda s: s.rolling(3, min_periods=1).mean())
    df["cost_overrun_roll_mean_6m"] = grouped["cost_overrun_pct"].transform(lambda s: s.rolling(6, min_periods=1).mean())
    df["cost_overrun_roll_std_3m"] = grouped["cost_overrun_pct"].transform(lambda s: s.rolling(3, min_periods=1).std()).fillna(0.0)
    df["cost_overrun_roll_std_6m"] = grouped["cost_overrun_pct"].transform(lambda s: s.rolling(6, min_periods=1).std()).fillna(0.0)

    df["delay_roll_mean_3m"] = grouped["schedule_extension_months"].transform(lambda s: s.rolling(3, min_periods=1).mean())
    df["delay_roll_mean_6m"] = grouped["schedule_extension_months"].transform(lambda s: s.rolling(6, min_periods=1).mean())
    df["delay_roll_std_3m"] = grouped["schedule_extension_months"].transform(lambda s: s.rolling(3, min_periods=1).std()).fillna(0.0)
    df["delay_roll_std_6m"] = grouped["schedule_extension_months"].transform(lambda s: s.rolling(6, min_periods=1).std()).fillna(0.0)

    df["progress_roll_mean_3m"] = grouped["physical_progress_pct"].transform(lambda s: s.rolling(3, min_periods=1).mean())
    df["progress_roll_mean_6m"] = grouped["physical_progress_pct"].transform(lambda s: s.rolling(6, min_periods=1).mean())
    df["progress_roll_std_3m"] = grouped["physical_progress_pct"].transform(lambda s: s.rolling(3, min_periods=1).std()).fillna(0.0)

    df["expenditure_roll_mean_3m"] = grouped["expenditure_ratio_pct"].transform(lambda s: s.rolling(3, min_periods=1).mean())

    # 3. Month-over-Month Deltas (Velocities)
    df["cost_overrun_delta_1m"] = grouped["cost_overrun_pct"].diff(1).fillna(0.0)
    df["cost_overrun_delta_3m"] = grouped["cost_overrun_pct"].diff(3).fillna(0.0)

    df["delay_delta_1m"] = grouped["schedule_extension_months"].diff(1).fillna(0.0)
    df["delay_delta_3m"] = grouped["schedule_extension_months"].diff(3).fillna(0.0)

    df["progress_delta_1m"] = grouped["physical_progress_pct"].diff(1).fillna(0.0)
    df["progress_delta_3m"] = grouped["physical_progress_pct"].diff(3).fillna(0.0)

    df["expenditure_delta_1m"] = grouped["expenditure_ratio_pct"].diff(1).fillna(0.0)
    df["expenditure_delta_3m"] = grouped["expenditure_ratio_pct"].diff(3).fillna(0.0)

    # 4. Accelerations (Momentum)
    df["cost_overrun_accel"] = grouped["cost_overrun_delta_1m"].diff(1).fillna(0.0)
    df["delay_accel"] = grouped["delay_delta_1m"].diff(1).fillna(0.0)
    df["progress_accel"] = grouped["progress_delta_1m"].diff(1).fillna(0.0)

    # 5. Cumulative Escalation & Delay Events Prior to or at T
    df["cost_inc_flag"] = (df["cost_overrun_delta_1m"] > 0).astype(int)
    df["delay_inc_flag"] = (df["delay_delta_1m"] > 0).astype(int)
    df["historical_cost_escalations_count"] = grouped["cost_inc_flag"].cumsum()
    df["historical_delay_events_count"] = grouped["delay_inc_flag"].cumsum()

    # 6. Consecutive Stagnancy Streak
    prog_deltas = df["progress_delta_1m"].values
    proj_ids = df["project_id"].values
    n = len(df)
    stagnant_streaks = np.zeros(n, dtype=float)
    current_streak = 0
    prev_pid = None
    for i in range(n):
        pid = proj_ids[i]
        if pid != prev_pid:
            current_streak = 0
            prev_pid = pid
        if prog_deltas[i] <= 0.1:
            current_streak += 1
        else:
            current_streak = 0
        stagnant_streaks[i] = current_streak
    df["consecutive_stagnant_months"] = stagnant_streaks

    # 7. Reporting Gap & Snapshot History Count
    df["snapshot_history_count"] = grouped.cumcount() + 1
    prev_rm = grouped["report_month"].shift(1)
    df["reporting_gap_months"] = (df["report_month"].dt.year - prev_rm.dt.year)*12 + (df["report_month"].dt.month - prev_rm.dt.month)
    df["reporting_gap_months"] = df["reporting_gap_months"].fillna(0.0)

    return df


def generate_forward_targets(df: pd.DataFrame, horizons: List[int] = [3, 6]) -> pd.DataFrame:
    """
    Constructs forward-looking targets strictly at T+H.
    Generates both cumulative state targets and incremental delta/risk targets.
    """
    df = df.sort_values(["project_id", "report_month"]).reset_index(drop=True)

    for h in horizons:
        future_lookup = df[["project_id", "report_month", "cost_overrun_pct", "schedule_extension_months", "anticipated_cost_crore"]].copy()
        future_lookup["target_lookup_month"] = future_lookup["report_month"] - pd.DateOffset(months=h)

        merged = pd.merge(
            df,
            future_lookup,
            left_on=["project_id", "report_month"],
            right_on=["project_id", "target_lookup_month"],
            how="left",
            suffixes=("", "_future")
        )

        # 1. Cumulative Future State Targets at T+H (High Signal / Primary Targets)
        df[f"future_anticipated_cost_{h}m"] = merged["anticipated_cost_crore_future"]
        df[f"future_delay_months_{h}m"] = merged["schedule_extension_months_future"]
        df[f"future_cost_overrun_pct_{h}m"] = merged["cost_overrun_pct_future"]

        # 2. Incremental Delta Targets (T+H minus T)
        df[f"forward_cost_delta_crore_{h}m"] = merged["anticipated_cost_crore_future"] - merged["anticipated_cost_crore"]
        df[f"additional_cost_overrun_pct_{h}m"] = merged["cost_overrun_pct_future"] - merged["cost_overrun_pct"]
        df[f"additional_delay_months_{h}m"] = merged["schedule_extension_months_future"] - merged["schedule_extension_months"]

        # 3. Binary Classification Targets (Strict Risk Event Flags)
        # Cost escalation risk: positive cost delta in next H months
        df[f"target_cost_escalation_risk_{h}m"] = np.where(
            df[f"forward_cost_delta_crore_{h}m"].isna(),
            np.nan,
            (df[f"forward_cost_delta_crore_{h}m"] > 0.0).astype(float)
        )
        # Schedule delay risk: schedule delay extends by >= 1 month in next H months
        df[f"target_schedule_delay_risk_{h}m"] = np.where(
            df[f"additional_delay_months_{h}m"].isna(),
            np.nan,
            (df[f"additional_delay_months_{h}m"] >= 1.0).astype(float)
        )

    return df


def apply_chronological_project_split(df: pd.DataFrame, min_snapshots: int = 6, split_mode: str = "3way") -> pd.DataFrame:
    """
    Splits snapshots chronologically per project.
    - Projects with < min_snapshots: flagged as 'insufficient_history'
    - '3way' mode: first 60% snapshots -> 'train', 60%-75% -> 'val', remaining 25% -> 'test'
    - '2way' mode: first 70% snapshots -> 'train', remaining 30% -> 'test'
    Guarantees strict temporal order: min(T_test) > max(T_train).
    """
    df = df.sort_values(["project_id", "report_month"]).reset_index(drop=True)
    grouped = df.groupby("project_id", sort=False)

    df["snap_idx"] = grouped.cumcount()
    df["total_snaps"] = grouped["project_id"].transform("count")
    df["has_sufficient_history"] = df["total_snaps"] >= min_snapshots

    df["split"] = "train"
    if split_mode == "3way":
        cutoff_val = np.maximum(1, np.floor(df["total_snaps"] * 0.60).astype(int))
        cutoff_test = np.maximum(2, np.floor(df["total_snaps"] * 0.75).astype(int))
        val_cond = df["has_sufficient_history"] & (df["snap_idx"] >= cutoff_val) & (df["snap_idx"] < cutoff_test)
        test_cond = df["has_sufficient_history"] & (df["snap_idx"] >= cutoff_test)
        df.loc[val_cond, "split"] = "val"
        df.loc[test_cond, "split"] = "test"
    else:
        cutoff_test = np.maximum(1, np.floor(df["total_snaps"] * 0.70).astype(int))
        test_cond = df["has_sufficient_history"] & (df["snap_idx"] >= cutoff_test)
        df.loc[test_cond, "split"] = "test"

    df.loc[~df["has_sufficient_history"], "split"] = "insufficient_history"

    return df


def get_feature_definitions() -> Tuple[List[str], List[str]]:
    """Returns static baseline feature list (Old) and project-history-aware feature list (New)."""
    cat_cols = ["sector", "ministry_department", "state"]
    static_num_cols = [
        "original_cost_crore", "revised_cost_crore", "anticipated_cost_crore",
        "cumulative_expenditure_crore", "physical_progress_pct", "expenditure_ratio_pct",
        "physical_financial_gap", "remaining_work_pct", "schedule_extension_months",
        "project_age_months", "original_duration_months", "cost_escalation_crore",
        "cost_overrun_pct", "milestones_achieved", "milestones_total", "milestone_ratio",
        "is_active_status"
    ]
    old_features = cat_cols + static_num_cols

    history_features = [
        "cost_overrun_lag1", "cost_overrun_lag2", "cost_overrun_lag3",
        "delay_lag1", "delay_lag2", "delay_lag3",
        "progress_lag1", "progress_lag2", "progress_lag3", "expenditure_lag1",
        "cost_overrun_roll_mean_3m", "cost_overrun_roll_mean_6m",
        "cost_overrun_roll_std_3m", "cost_overrun_roll_std_6m",
        "delay_roll_mean_3m", "delay_roll_mean_6m",
        "delay_roll_std_3m", "delay_roll_std_6m",
        "progress_roll_mean_3m", "progress_roll_mean_6m", "progress_roll_std_3m",
        "expenditure_roll_mean_3m",
        "cost_overrun_delta_1m", "cost_overrun_delta_3m",
        "delay_delta_1m", "delay_delta_3m",
        "progress_delta_1m", "progress_delta_3m",
        "expenditure_delta_1m", "expenditure_delta_3m",
        "cost_overrun_accel", "delay_accel", "progress_accel",
        "historical_cost_escalations_count", "historical_delay_events_count",
        "consecutive_stagnant_months", "snapshot_history_count", "reporting_gap_months"
    ]
    new_features = old_features + history_features

    return old_features, new_features
