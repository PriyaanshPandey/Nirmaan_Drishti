"""
02_trajectory_builder.py - Project-Level Trajectory & Milestone Dynamics Construction
Nirmaan Drishti / Infrastructure Project Monitoring (April 2001 - May 2026).

Implements:
1. Chronological time-series ordering per project.
2. Incomplete historical trajectory detection (coverage, completeness, late-entry flags).
3. Reporting staleness and gap analysis (RECENT, STALE, LONG_STALE, UNKNOWN).
4. Milestone progress & dynamics (completed/total, deltas, scope expansion/reduction).
5. Milestone event taxonomy & revision flags (distinguishing scope changes from reversals).
6. Trajectory-level scope instability metrics.
7. Physical and financial progress velocities, accelerations, and physical-financial divergence.
8. Schedule slippage, delay velocity, cost escalation counts, and reporting reliability scores.
"""

import sys
import os
import re
from pathlib import Path
from typing import Tuple, Dict, List, Any
import numpy as np
import pandas as pd

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

WORKSPACE_ROOT = Path(r"d:\Nirmaan-Drishti-secret-")
VALIDATED_DIR = WORKSPACE_ROOT / "data" / "03_validated"
TRAJECTORY_DIR = WORKSPACE_ROOT / "data" / "04_project_trajectories"

TRAJECTORY_DIR.mkdir(parents=True, exist_ok=True)


def parse_milestones(series: pd.Series) -> Tuple[np.ndarray, np.ndarray, np.ndarray]:
    """
    Parse milestone string format e.g. '23/52', '2/8', '0/12'.
    Returns (completed, total, ratio_pct).
    """
    n = len(series)
    completed = np.full(n, np.nan, dtype=float)
    total = np.full(n, np.nan, dtype=float)
    pct = np.full(n, np.nan, dtype=float)

    raw_vals = series.values
    for i in range(n):
        val = raw_vals[i]
        if pd.isna(val) or val is None:
            continue
        s = str(val).strip()
        if "/" in s:
            parts = s.split("/")
            if len(parts) >= 2:
                try:
                    c = float(re.sub(r"[^\d.]", "", parts[0]))
                    t = float(re.sub(r"[^\d.]", "", parts[1]))
                    completed[i] = c
                    total[i] = t
                    pct[i] = (c / t * 100.0) if t > 0 else 0.0
                except (ValueError, TypeError):
                    pass

    return completed, total, pct


def month_diff(dt1_series: pd.Series, dt2_series: pd.Series) -> pd.Series:
    """Compute difference in months between dt1 and dt2 (dt1 - dt2)."""
    return (dt1_series.dt.year - dt2_series.dt.year) * 12 + (dt1_series.dt.month - dt2_series.dt.month)


def build_project_trajectories(df: pd.DataFrame) -> pd.DataFrame:
    print("=" * 80)
    print("STEP 1: SORTING & TEMPORAL INTEGRITY VERIFICATION")
    print("=" * 80)

    # Sort strictly chronologically per project
    df = df.sort_values(["effective_project_key", "report_month"]).reset_index(drop=True)
    print(f"Total canonical snapshots to process: {len(df):,} across {df['effective_project_key'].nunique():,} unique projects.")

    grouped = df.groupby("effective_project_key", sort=False)

    print("\n" + "=" * 80)
    print("STEP 2: INCOMPLETE HISTORICAL TRAJECTORIES & COVERAGE (SECTION 5)")
    print("=" * 80)

    # Incomplete historical trajectories
    df["first_observation_date"] = grouped["report_month"].transform("min")
    df["latest_observation_date"] = grouped["report_month"].transform("max")
    df["trajectory_start_date"] = df["first_observation_date"]

    # Months from approval to first observation
    months_approval_to_first = month_diff(df["first_observation_date"], df["approval_date"])
    df["months_approval_to_first_obs"] = months_approval_to_first.fillna(0.0)

    # Observed duration in months
    df["observed_duration_months"] = month_diff(df["latest_observation_date"], df["first_observation_date"]) + 1
    df["trajectory_coverage_months"] = grouped["report_month"].transform("count")

    # Historical coverage ratio
    total_project_lifetime = month_diff(df["report_month"], df["approval_date"]) + 1
    df["total_project_lifetime_months"] = np.maximum(1, total_project_lifetime.fillna(1.0))
    df["historical_coverage_ratio"] = (df["trajectory_coverage_months"] / df["total_project_lifetime_months"]).clip(0.0, 1.0)

    # Trajectory completeness classification
    # Complete: First observation within 12 months of approval or inception
    # Late-entry: Approved > 36 months before first available observation in dataset
    # Partial: Any gaps or entered between 12-36 months
    is_late = df["months_approval_to_first_obs"] > 36
    is_complete = df["months_approval_to_first_obs"] <= 12
    df["trajectory_completeness"] = np.where(is_late, "Late-entry", np.where(is_complete, "Complete", "Partial"))

    print("Trajectory completeness distribution across snapshots:")
    for comp, count in df["trajectory_completeness"].value_counts().items():
        print(f"  - {comp:<15}: {count:>8,} snapshots ({count/len(df):.2%})")

    print("\n" + "=" * 80)
    print("STEP 3: REPORTING STALENESS & NON-ACTIVE ANALYSIS (SECTION 6)")
    print("=" * 80)

    # Dataset boundary (latest observation across entire dataset)
    dataset_max_date = df["report_month"].max()
    print(f"Dataset boundary date: {dataset_max_date.strftime('%Y-%m')}")

    # Months since last update relative to snapshot and dataset boundary
    df["last_update_date"] = df["latest_observation_date"]
    df["months_since_last_update"] = month_diff(pd.Series(dataset_max_date, index=df.index), df["last_update_date"])
    df["updated_in_2026"] = (df["latest_observation_date"].dt.year >= 2026).astype(int)

    # Consecutive reporting gap
    prev_report_month = grouped["report_month"].shift(1)
    gap_months = month_diff(df["report_month"], prev_report_month)
    df["reporting_gap_months"] = gap_months.fillna(1.0)
    df["reporting_gap_days"] = (df["report_month"] - prev_report_month).dt.days.fillna(30.0)
    df["reporting_staleness_flag"] = (df["reporting_gap_months"] >= 5).astype(int)

    # Reporting status category
    status_conds = [
        df["months_since_last_update"] <= 3,
        (df["months_since_last_update"] > 3) & (df["months_since_last_update"] <= 12),
        df["months_since_last_update"] > 12
    ]
    status_choices = ["RECENT", "STALE", "LONG_STALE"]
    df["reporting_status"] = np.select(status_conds, status_choices, default="UNKNOWN")

    print("Reporting status distribution across snapshots:")
    for st, count in df["reporting_status"].value_counts().items():
        print(f"  - {st:<15}: {count:>8,} snapshots ({count/len(df):.2%})")

    print("\n" + "=" * 80)
    print("STEP 4: MILESTONE PROGRESS, DYNAMICS & SCOPE INSTABILITY (SECTIONS 7-10)")
    print("=" * 80)

    # Parse milestones
    ms_comp, ms_tot, ms_pct = parse_milestones(df["raw_milestone"])
    df["milestones_completed"] = ms_comp
    df["milestones_total"] = ms_tot
    df["milestone_progress_pct"] = ms_pct

    # Consecutive milestone deltas
    df["milestones_completed_delta"] = grouped["milestones_completed"].diff(1).fillna(0.0)
    df["milestones_total_delta"] = grouped["milestones_total"].diff(1).fillna(0.0)
    df["milestone_progress_pct_delta"] = grouped["milestone_progress_pct"].diff(1).fillna(0.0)

    # Scope expansion / reduction flags & ratios
    df["scope_expansion_flag"] = (df["milestones_total_delta"] > 0).astype(int)
    df["scope_reduction_flag"] = (df["milestones_total_delta"] < 0).astype(int)
    
    prev_total = grouped["milestones_total"].shift(1)
    df["scope_change_ratio"] = np.where(
        prev_total > 0,
        df["milestones_total_delta"] / prev_total,
        0.0
    )

    # Distinguish milestone events (Section 9)
    # 1. Normal progress: completed increases, total unchanged
    # 2. Progress + scope expansion: completed increases, total increases
    # 3. Scope expansion with small progress: total increases faster than completed
    # 4. Scope reduction: total decreases
    # 5. Apparent milestone reversal: completed decreases (reporting revision)
    df["milestone_revision_flag"] = (df["milestones_completed_delta"] < 0).astype(int)

    event_conds = [
        (df["milestones_completed_delta"] > 0) & (df["milestones_total_delta"] == 0),
        (df["milestones_completed_delta"] > 0) & (df["milestones_total_delta"] > 0) & (df["milestone_progress_pct_delta"] >= 0),
        (df["milestones_completed_delta"] > 0) & (df["milestones_total_delta"] > 0) & (df["milestone_progress_pct_delta"] < 0),
        df["scope_reduction_flag"] == 1,
        df["milestone_revision_flag"] == 1
    ]
    event_names = [
        "NORMAL_PROGRESS",
        "PROGRESS_AND_SCOPE_EXPANSION",
        "SCOPE_EXPANSION_PROGRESS_DILUTION",
        "SCOPE_REDUCTION",
        "MILESTONE_REVISION"
    ]
    df["milestone_event_type"] = np.select(event_conds, event_names, default="NO_CHANGE")

    print("Milestone event distribution:")
    for ev, count in df["milestone_event_type"].value_counts().items():
        print(f"  - {ev:<35}: {count:>8,} snapshots")

    # Scope Instability Trajectory Features (Section 10)
    df["milestone_plan_change_event"] = (df["milestones_total_delta"] != 0).astype(int)
    df["number_of_milestone_plan_changes"] = grouped["milestone_plan_change_event"].cumsum()
    df["total_milestone_increases"] = grouped["scope_expansion_flag"].cumsum()
    df["total_milestone_decreases"] = grouped["scope_reduction_flag"].cumsum()

    df["_pos_expansion"] = np.maximum(0.0, df["milestones_total_delta"])
    df["cumulative_scope_expansion"] = grouped["_pos_expansion"].cumsum()
    df["maximum_scope_expansion"] = grouped["_pos_expansion"].cummax()
    df = df.drop(columns=["_pos_expansion"])

    df["snapshot_history_count"] = grouped.cumcount() + 1
    df["scope_change_frequency"] = df["number_of_milestone_plan_changes"] / df["snapshot_history_count"]
    df["scope_instability_score"] = (
        df["number_of_milestone_plan_changes"] * 1.0 +
        df["scope_change_frequency"] * 5.0 +
        np.log1p(df["cumulative_scope_expansion"])
    )

    print("\n" + "=" * 80)
    print("STEP 5: PHYSICAL & FINANCIAL VELOCITIES, ACCELERATIONS & DIVERGENCE (SECTION 11)")
    print("=" * 80)

    # Impute baseline original cost if missing or <= 1.0 Cr
    orig_cost = df["original_cost_cr"].copy()
    zero_orig = orig_cost.isna() | (orig_cost <= 1.0)
    df["original_cost_crore"] = np.where(zero_orig, df["anticipated_cost_cr"].clip(lower=150.0), orig_cost)
    df["anticipated_cost_crore"] = df["anticipated_cost_cr"].fillna(df["original_cost_crore"])
    df["revised_cost_crore"] = df["revised_cost_cr"].fillna(df["original_cost_crore"])
    df["cumulative_expenditure_crore"] = df["cumulative_expenditure_cr"].fillna(0.0)

    # Cost escalation & overrun pct
    df["cost_escalation_crore"] = df["anticipated_cost_crore"] - df["original_cost_crore"]
    df["cost_overrun_pct"] = np.where(
        df["original_cost_crore"] > 0,
        (df["cost_escalation_crore"] / df["original_cost_crore"]) * 100.0,
        0.0
    )

    # Expenditure ratio %
    df["expenditure_ratio_pct"] = np.where(
        df["original_cost_crore"] > 0,
        (df["cumulative_expenditure_crore"] / df["original_cost_crore"]) * 100.0,
        0.0
    )

    # Physical progress clean [0, 100]
    df["physical_progress_clean"] = df["physical_progress_pct"].fillna(0.0).clip(0.0, 100.0)
    df["remaining_work_pct"] = np.maximum(0.0, 100.0 - df["physical_progress_clean"])

    # Physical-Financial divergence (Section 11)
    df["physical_financial_divergence"] = df["expenditure_ratio_pct"] - df["physical_progress_clean"]
    df["absolute_progress_gap"] = np.abs(df["physical_financial_divergence"])

    def pgroup(col_name):
        return df.groupby("effective_project_key", sort=False)[col_name]

    # Physical progress deltas & velocities (1m, 3m, 6m, 12m)
    df["physical_progress_delta_1m"] = pgroup("physical_progress_clean").diff(1).fillna(0.0)
    df["physical_progress_delta_3m"] = pgroup("physical_progress_clean").diff(3).fillna(0.0)
    df["physical_progress_delta_6m"] = pgroup("physical_progress_clean").diff(6).fillna(0.0)
    df["physical_progress_delta_12m"] = pgroup("physical_progress_clean").diff(12).fillna(0.0)

    df["progress_velocity"] = df["physical_progress_delta_1m"] / df["reporting_gap_months"].clip(lower=1.0)
    df["progress_velocity_3m"] = df["physical_progress_delta_3m"] / (3.0 * df["reporting_gap_months"].clip(lower=1.0))
    df["progress_velocity_6m"] = df["physical_progress_delta_6m"] / (6.0 * df["reporting_gap_months"].clip(lower=1.0))
    df["progress_velocity_12m"] = df["physical_progress_delta_12m"] / (12.0 * df["reporting_gap_months"].clip(lower=1.0))
    df["progress_acceleration"] = pgroup("progress_velocity").diff(1).fillna(0.0)
    df["progress_deceleration"] = np.maximum(0.0, -df["progress_acceleration"])

    # Financial progress deltas & velocity
    df["financial_progress_delta_1m"] = pgroup("expenditure_ratio_pct").diff(1).fillna(0.0)
    df["financial_progress_delta_3m"] = pgroup("expenditure_ratio_pct").diff(3).fillna(0.0)
    df["financial_progress_velocity"] = df["financial_progress_delta_1m"] / df["reporting_gap_months"].clip(lower=1.0)
    df["progress_gap_change"] = pgroup("physical_financial_divergence").diff(1).fillna(0.0)
    df["divergence_delta_3m"] = pgroup("physical_financial_divergence").diff(3).fillna(0.0)
    df["divergence_delta_6m"] = pgroup("physical_financial_divergence").diff(6).fillna(0.0)
    df["divergence_delta_12m"] = pgroup("physical_financial_divergence").diff(12).fillna(0.0)

    # Expenditure velocity & efficiency
    df["expenditure_delta_1m"] = pgroup("cumulative_expenditure_crore").diff(1).fillna(0.0)
    df["expenditure_delta_3m"] = pgroup("cumulative_expenditure_crore").diff(3).fillna(0.0)
    prev_exp = pgroup("cumulative_expenditure_crore").shift(1)
    df["expenditure_growth_rate"] = np.where(prev_exp > 0, df["expenditure_delta_1m"] / prev_exp, 0.0)
    df["expenditure_velocity"] = df["expenditure_delta_1m"] / df["reporting_gap_months"].clip(lower=1.0)
    df["expenditure_vs_original_cost"] = df["expenditure_ratio_pct"]
    df["expenditure_efficiency"] = df["cumulative_expenditure_crore"] / np.maximum(0.1, df["physical_progress_clean"])

    # Cost revision count & escalation velocity
    df["_cost_revised_event"] = (pgroup("anticipated_cost_crore").diff(1) != 0).astype(int)
    df["cost_revision_count"] = pgroup("_cost_revised_event").cumsum()
    df = df.drop(columns=["_cost_revised_event"])
    df["cost_escalation_velocity"] = pgroup("cost_overrun_pct").diff(1).fillna(0.0) / df["reporting_gap_months"].clip(lower=1.0)

    # Strict point-in-time date propagation (strictly ffill() only, zero bfill())
    df["original_doc_clean"] = pgroup("original_doc").ffill()
    df["anticipated_doc_clean"] = pgroup("anticipated_doc").ffill()

    # Schedule slippage & delay velocity using clean point-in-time dates
    df["schedule_extension_months"] = month_diff(df["anticipated_doc_clean"], df["original_doc_clean"]).fillna(0.0).clip(-60, 360)
    df["schedule_slippage"] = np.maximum(0.0, df["schedule_extension_months"])
    delay_delta = pgroup("schedule_extension_months").diff(1).fillna(0.0)
    df["_delay_increased_event"] = (delay_delta > 0).astype(int)
    df["extension_count"] = pgroup("_delay_increased_event").cumsum()
    df = df.drop(columns=["_delay_increased_event"])
    df["delay_velocity"] = delay_delta / df["reporting_gap_months"].clip(lower=1.0)
    
    # Remaining duration using clean point-in-time dates
    df["remaining_duration_months"] = month_diff(df["anticipated_doc_clean"], df["report_month"]).fillna(24.0).clip(-60, 360)

    # Project age in months
    df["project_age_months"] = month_diff(df["report_month"], df["approval_date"]).fillna(0.0).clip(0, 480)

    # Rolling window statistics (3m, 6m, 12m)
    df["cost_overrun_roll_mean_3m"] = pgroup("cost_overrun_pct").transform(lambda s: s.rolling(3, min_periods=1).mean())
    df["cost_overrun_roll_mean_6m"] = pgroup("cost_overrun_pct").transform(lambda s: s.rolling(6, min_periods=1).mean())
    df["cost_overrun_roll_mean_12m"] = pgroup("cost_overrun_pct").transform(lambda s: s.rolling(12, min_periods=1).mean())
    df["cost_overrun_roll_std_3m"] = pgroup("cost_overrun_pct").transform(lambda s: s.rolling(3, min_periods=1).std()).fillna(0.0)
    df["cost_overrun_roll_std_6m"] = pgroup("cost_overrun_pct").transform(lambda s: s.rolling(6, min_periods=1).std()).fillna(0.0)

    df["delay_roll_mean_3m"] = pgroup("schedule_extension_months").transform(lambda s: s.rolling(3, min_periods=1).mean())
    df["delay_roll_mean_6m"] = pgroup("schedule_extension_months").transform(lambda s: s.rolling(6, min_periods=1).mean())
    df["delay_roll_mean_12m"] = pgroup("schedule_extension_months").transform(lambda s: s.rolling(12, min_periods=1).mean())
    df["delay_roll_std_3m"] = pgroup("schedule_extension_months").transform(lambda s: s.rolling(3, min_periods=1).std()).fillna(0.0)
    df["delay_roll_std_6m"] = pgroup("schedule_extension_months").transform(lambda s: s.rolling(6, min_periods=1).std()).fillna(0.0)

    df["progress_roll_mean_3m"] = pgroup("physical_progress_clean").transform(lambda s: s.rolling(3, min_periods=1).mean())
    df["progress_roll_mean_6m"] = pgroup("physical_progress_clean").transform(lambda s: s.rolling(6, min_periods=1).mean())
    df["progress_roll_mean_12m"] = pgroup("physical_progress_clean").transform(lambda s: s.rolling(12, min_periods=1).mean())
    df["progress_roll_std_3m"] = pgroup("physical_progress_clean").transform(lambda s: s.rolling(3, min_periods=1).std()).fillna(0.0)

    # Consecutive Stagnancy Streak
    prog_deltas = df["physical_progress_delta_1m"].values
    proj_keys = df["effective_project_key"].values
    n = len(df)
    stagnant_streaks = np.zeros(n, dtype=float)
    cur_streak = 0
    prev_k = None
    for i in range(n):
        k = proj_keys[i]
        if k != prev_k:
            cur_streak = 0
            prev_k = k
        if prog_deltas[i] <= 0.1:
            cur_streak += 1
        else:
            cur_streak = 0
        stagnant_streaks[i] = cur_streak
    df["consecutive_stagnant_months"] = stagnant_streaks

    print("\n" + "=" * 80)
    print("STEP 6: REPORTING QUALITY METRICS (SECTION 12)")
    print("=" * 80)

    df["number_of_reporting_gaps"] = pgroup("reporting_staleness_flag").cumsum()
    df["average_reporting_gap"] = pgroup("reporting_gap_months").transform(lambda s: s.expanding().mean())
    df["maximum_reporting_gap"] = pgroup("reporting_gap_months").transform(lambda s: s.expanding().max())
    df["reporting_frequency"] = 1.0 / df["average_reporting_gap"].clip(lower=1.0)
    
    # Reliability score (0 to 1) based on regularity of updates
    df["reporting_reliability_score"] = (
        (1.0 / (1.0 + np.log1p(df["average_reporting_gap"] - 1.0).clip(lower=0.0))) * 0.7 +
        (1.0 / (1.0 + df["number_of_reporting_gaps"] * 0.1)) * 0.3
    ).clip(0.0, 1.0)

    return df


def main():
    p_in = VALIDATED_DIR / "canonical_project_snapshots.parquet"
    print(f"Reading canonical dataset from {p_in}...")
    df = pd.read_parquet(p_in)

    # Build trajectories
    trajectories_df = build_project_trajectories(df)

    # Save output
    out_parquet = TRAJECTORY_DIR / "project_trajectories.parquet"
    out_csv_sample = TRAJECTORY_DIR / "project_trajectories_sample.csv"

    print(f"\nSaving trajectory dataset to {out_parquet}...")
    trajectories_df.to_parquet(out_parquet, index=False)
    trajectories_df.head(1000).to_csv(out_csv_sample, index=False)
    print(f"Saved {len(trajectories_df):,} rows x {len(trajectories_df.columns)} columns.")

    print("\n" + "=" * 80)
    print("TRAJECTORY CONSTRUCTION VALIDATION SUMMARY")
    print("=" * 80)
    print(f"Total projects with trajectories : {trajectories_df['effective_project_key'].nunique():,}")
    print(f"Total snapshots with trajectory  : {len(trajectories_df):,}")
    print(f"Scope expansions detected        : {trajectories_df['scope_expansion_flag'].sum():,}")
    print(f"Scope reductions detected        : {trajectories_df['scope_reduction_flag'].sum():,}")
    print(f"Milestone revisions (reversals)  : {trajectories_df['milestone_revision_flag'].sum():,}")
    print(f"Reporting gaps (>= 5 months)     : {trajectories_df['reporting_staleness_flag'].sum():,}")
    print(f"Mean reporting reliability score : {trajectories_df['reporting_reliability_score'].mean():.4f}")


if __name__ == "__main__":
    main()
