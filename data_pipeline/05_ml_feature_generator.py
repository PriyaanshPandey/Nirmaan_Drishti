"""
05_ml_feature_generator.py - Leakage-Safe ML Dataset & Temporal Split Generator
Nirmaan Drishti / Infrastructure Project Monitoring (April 2001 - May 2026).

Implements:
1. Strict forward-looking target construction (3M/6M horizons and Final outcomes).
2. Point-in-time sector and ministry aggregations (using strictly past completed projects).
3. Missingness indicator features (Section 18).
4. Strict temporal splits:
   - TRAIN: April 2001 to December 2022
   - VAL  : January 2023 to June 2024
   - TEST : July 2024 to May 2026
5. Saves clean feature matrices for Model Training (data/05_ml_features/).
"""

import sys
import os
import json
from pathlib import Path
from typing import Tuple, Dict, List, Any
import numpy as np
import pandas as pd

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

WORKSPACE_ROOT = Path(r"d:\Nirmaan-Drishti-secret-")
TRAJECTORY_DIR = WORKSPACE_ROOT / "data" / "04_project_trajectories"
ML_DIR = WORKSPACE_ROOT / "data" / "05_ml_features"

ML_DIR.mkdir(parents=True, exist_ok=True)


def generate_forward_targets(df: pd.DataFrame, horizons: List[int] = [3]) -> pd.DataFrame:
    """
    Construct forward-looking targets strictly at T+3M using future lookup.
    Never exposes target information to features.
    """
    print("Generating forward targets (3M horizon)...")
    df = df.sort_values(["effective_project_key", "report_month"]).reset_index(drop=True)

    for h in horizons:
        # Create lookup table of future states
        future_lookup = df[[
            "effective_project_key",
            "report_month",
            "cost_overrun_pct",
            "schedule_extension_months",
            "anticipated_cost_crore"
        ]].copy()
        future_lookup["target_lookup_month"] = future_lookup["report_month"] - pd.DateOffset(months=h)

        merged = pd.merge(
            df,
            future_lookup,
            left_on=["effective_project_key", "report_month"],
            right_on=["effective_project_key", "target_lookup_month"],
            how="left",
            suffixes=("", "_future")
        )

        # Primary Continuous Regression Targets
        df[f"target_future_cost_overrun_pct_{h}m"] = merged["cost_overrun_pct_future"]
        df[f"target_future_delay_months_{h}m"] = merged["schedule_extension_months_future"]
        df[f"target_future_anticipated_cost_{h}m"] = merged["anticipated_cost_crore_future"]

        # Scale-Invariant Cost Multiplier Target
        df[f"target_cost_multiplier_{h}m"] = np.where(
            df["original_cost_crore"] > 0,
            merged["anticipated_cost_crore_future"] / df["original_cost_crore"],
            np.nan
        )

        # Delta Targets (T+h minus T)
        df[f"target_delta_cost_overrun_pct_{h}m"] = merged["cost_overrun_pct_future"] - merged["cost_overrun_pct"]
        df[f"target_delta_delay_months_{h}m"] = merged["schedule_extension_months_future"] - merged["schedule_extension_months"]

        # Binary Risk Classification Targets
        df[f"target_cost_risk_{h}m"] = np.where(
            df[f"target_delta_cost_overrun_pct_{h}m"].isna(),
            np.nan,
            (df[f"target_delta_cost_overrun_pct_{h}m"] > 0.0).astype(float)
        )
        df[f"target_delay_risk_{h}m"] = np.where(
            df[f"target_delta_delay_months_{h}m"].isna(),
            np.nan,
            (df[f"target_delta_delay_months_{h}m"] >= 1.0).astype(float)
        )

    # Multi-class Risk Tier Target at 3M
    # Low: delta delay <= 0 and delta cost <= 0
    # Medium: delta delay 1-6 months OR delta cost 0-10%
    # High: delta delay > 6 months OR delta cost > 10%
    d_del = df["target_delta_delay_months_3m"]
    d_cost = df["target_delta_cost_overrun_pct_3m"]
    
    tier_conds = [
        (d_del <= 0) & (d_cost <= 0),
        (d_del > 6) | (d_cost > 10.0)
    ]
    tier_choices = [0, 2]  # 0: Low Risk, 2: High Risk, default: Medium Risk (1)
    df["target_risk_tier_3m"] = np.where(
        d_del.isna() | d_cost.isna(),
        np.nan,
        np.select(tier_conds, tier_choices, default=1)
    )

    return df


def add_point_in_time_historical_stats(df: pd.DataFrame) -> pd.DataFrame:
    """
    Calculate point-in-time sector, ministry, and agency historical delay and cost overrun averages
    strictly from projects completed prior to that snapshot year with empirical Bayes shrinkage.
    Zero future leakage.
    """
    print("Computing point-in-time sector, ministry, and agency historical statistics...")
    df["report_year"] = df["report_month"].dt.year
    comp_mask = df["operational_status"] == "COMPLETED"
    df_comp = df[comp_mask]

    years = np.sort(df["report_year"].unique())

    df["sector_historical_avg_delay"] = 0.0
    df["sector_historical_avg_cost_overrun"] = 0.0
    df["agency_historical_avg_delay"] = 0.0
    df["agency_historical_avg_cost_overrun"] = 0.0
    df["ministry_historical_avg_delay"] = 0.0
    df["ministry_historical_avg_cost_overrun"] = 0.0

    for yr in years:
        hist_comp = df_comp[df_comp["report_year"] < yr]
        if len(hist_comp) > 0:
            glob_del = hist_comp["schedule_extension_months"].mean()
            glob_cost = hist_comp["cost_overrun_pct"].mean()

            sec_del = hist_comp.groupby("sector")["schedule_extension_months"].mean().to_dict()
            sec_cost = hist_comp.groupby("sector")["cost_overrun_pct"].mean().to_dict()

            # Agency shrinkage toward sector average (m=5)
            ag_stats = hist_comp.groupby("agency").agg(
                n=("schedule_extension_months", "count"),
                mean_del=("schedule_extension_months", "mean"),
                mean_cost=("cost_overrun_pct", "mean"),
                sec=("sector", "first")
            )
            ag_del, ag_cost = {}, {}
            for ag, row in ag_stats.iterrows():
                sec_d = sec_del.get(row["sec"], glob_del)
                sec_c = sec_cost.get(row["sec"], glob_cost)
                ag_del[ag] = (row["n"] * row["mean_del"] + 5.0 * sec_d) / (row["n"] + 5.0)
                ag_cost[ag] = (row["n"] * row["mean_cost"] + 5.0 * sec_c) / (row["n"] + 5.0)

            # Ministry shrinkage toward global average (m=5)
            min_stats = hist_comp.groupby("ministry_department").agg(
                n=("schedule_extension_months", "count"),
                mean_del=("schedule_extension_months", "mean"),
                mean_cost=("cost_overrun_pct", "mean")
            )
            min_del, min_cost = {}, {}
            for m_dept, row in min_stats.iterrows():
                min_del[m_dept] = (row["n"] * row["mean_del"] + 5.0 * glob_del) / (row["n"] + 5.0)
                min_cost[m_dept] = (row["n"] * row["mean_cost"] + 5.0 * glob_cost) / (row["n"] + 5.0)
        else:
            sec_del, sec_cost = {}, {}
            ag_del, ag_cost = {}, {}
            min_del, min_cost = {}, {}
            glob_del, glob_cost = 12.0, 15.0

        yr_mask = df["report_year"] == yr
        sec_s = df.loc[yr_mask, "sector"].map(sec_del).fillna(glob_del)
        df.loc[yr_mask, "sector_historical_avg_delay"] = sec_s
        df.loc[yr_mask, "sector_historical_avg_cost_overrun"] = df.loc[yr_mask, "sector"].map(sec_cost).fillna(glob_cost)

        df.loc[yr_mask, "agency_historical_avg_delay"] = df.loc[yr_mask, "agency"].map(ag_del).fillna(sec_s)
        df.loc[yr_mask, "agency_historical_avg_cost_overrun"] = df.loc[yr_mask, "agency"].map(ag_cost).fillna(df.loc[yr_mask, "sector"].map(sec_cost).fillna(glob_cost))

        df.loc[yr_mask, "ministry_historical_avg_delay"] = df.loc[yr_mask, "ministry_department"].map(min_del).fillna(glob_del)
        df.loc[yr_mask, "ministry_historical_avg_cost_overrun"] = df.loc[yr_mask, "ministry_department"].map(min_cost).fillna(glob_cost)

    # Scale-normalized features
    df["expenditure_to_original_cost"] = np.where(
        df["original_cost_crore"] > 0,
        df["cumulative_expenditure_crore"] / df["original_cost_crore"],
        0.0
    )
    df["revised_to_original_cost"] = np.where(
        df["original_cost_crore"] > 0,
        df["revised_cost_crore"] / df["original_cost_crore"],
        1.0
    )
    dur = df["observed_duration_months"].clip(lower=6.0)
    df["delay_to_duration_ratio"] = df["schedule_extension_months"] / dur

    return df


def add_schedule_trajectory_features(df: pd.DataFrame) -> pd.DataFrame:
    """
    Compute comprehensive longitudinal schedule trajectory features strictly point-in-time (T <= t).
    Captures deltas, velocity, trends, acceleration, streaks, volatility, revision recency,
    and progress gaps without forward leakage.
    """
    print("Computing longitudinal schedule trajectory features (zero forward leakage)...")
    df = df.sort_values(["effective_project_key", "report_month"]).reset_index(drop=True)
    grp = df.groupby("effective_project_key", sort=False)
    rg = df["reporting_gap_months"].clip(lower=1.0)

    # 1. Multi-horizon delay deltas
    df["delay_change_1m"] = grp["schedule_extension_months"].diff(1).fillna(0.0)
    df["delay_change_3m"] = grp["schedule_extension_months"].diff(3).fillna(0.0)
    df["delay_change_6m"] = grp["schedule_extension_months"].diff(6).fillna(0.0)
    df["delay_change_12m"] = grp["schedule_extension_months"].diff(12).fillna(0.0)

    # 2. Delay trends / velocities
    df["delay_trend_3m"] = df["delay_change_3m"] / (3.0 * rg)
    df["delay_trend_6m"] = df["delay_change_6m"] / (6.0 * rg)
    df["delay_trend_12m"] = df["delay_change_12m"] / (12.0 * rg)

    # 3. Delay acceleration & deceleration
    df["delay_acceleration"] = grp["delay_change_1m"].diff(1).fillna(0.0) / rg
    df["delay_deceleration"] = np.maximum(0.0, -df["delay_acceleration"])

    # 4. Rolling delay medians (less sensitive to single-month reporting anomalies)
    df["delay_roll_median_3m"] = grp["schedule_extension_months"].transform(lambda s: s.rolling(3, min_periods=1).median())
    df["delay_roll_median_6m"] = grp["schedule_extension_months"].transform(lambda s: s.rolling(6, min_periods=1).median())

    # 5. Expanding historical bounds
    df["max_historical_delay"] = grp["schedule_extension_months"].transform(lambda s: s.expanding().max())
    df["min_historical_delay"] = grp["schedule_extension_months"].transform(lambda s: s.expanding().min())

    # 6. Delay volatility & divergence
    roll_mean_6m = df["delay_roll_mean_6m"].clip(lower=0.1)
    df["delay_volatility"] = df["delay_roll_std_6m"] / roll_mean_6m
    df["delay_divergence_recent_vs_longterm"] = df["delay_roll_mean_3m"] - df["delay_roll_mean_12m"]

    # 7. Consecutive increasing and recovery months (streaks)
    del_deltas = df["delay_change_1m"].values
    proj_keys = df["effective_project_key"].values
    n = len(df)
    inc_streaks = np.zeros(n, dtype=float)
    rec_streaks = np.zeros(n, dtype=float)
    cur_inc, cur_rec = 0, 0
    prev_k = None
    for i in range(n):
        k = proj_keys[i]
        if k != prev_k:
            cur_inc, cur_rec = 0, 0
            prev_k = k
        if del_deltas[i] > 0.05:
            cur_inc += 1
            cur_rec = 0
        elif del_deltas[i] < -0.05:
            cur_rec += 1
            cur_inc = 0
        else:
            cur_inc = 0
            cur_rec = 0
        inc_streaks[i] = cur_inc
        rec_streaks[i] = cur_rec
    df["consecutive_increasing_delay_months"] = inc_streaks
    df["consecutive_recovery_months"] = rec_streaks

    # 8. Schedule revision frequencies & recency
    hist_count = df["snapshot_history_count"].clip(lower=1.0)
    df["schedule_revision_frequency"] = df["extension_count"] / hist_count
    df["extension_frequency"] = df["extension_count"] / df["project_age_months"].clip(lower=1.0)

    rev_events = (df["delay_change_1m"] != 0).astype(int).values
    months_since_rev = np.zeros(n, dtype=float)
    last_rev_idx = -1
    prev_k = None
    for i in range(n):
        k = proj_keys[i]
        if k != prev_k:
            last_rev_idx = -1
            prev_k = k
        if rev_events[i] == 1:
            last_rev_idx = i
            months_since_rev[i] = 0.0
        else:
            if last_rev_idx >= 0:
                months_since_rev[i] = float(i - last_rev_idx)
            else:
                months_since_rev[i] = float(df["project_age_months"].iloc[i])
    df["months_since_last_schedule_revision"] = months_since_rev

    # 9. Original vs current completion date movement
    df["original_doc_revision_count"] = grp["original_doc_clean"].transform(lambda s: (s != s.shift(1)).cumsum())
    df["anticipated_doc_revision_count"] = grp["anticipated_doc_clean"].transform(lambda s: (s != s.shift(1)).cumsum())

    # 10. Elapsed duration ratio & planned-vs-observed gap
    tot_dur = df["project_age_months"] + np.maximum(1.0, df["remaining_duration_months"])
    df["elapsed_duration_ratio"] = (df["project_age_months"] / tot_dur).clip(0.0, 1.0)
    expected_progress = df["elapsed_duration_ratio"] * 100.0
    df["planned_vs_observed_gap"] = expected_progress - df["physical_progress_clean"]

    # 11. Milestone completion velocity & stagnation
    df["milestone_velocity"] = df["milestones_completed_delta"] / rg
    ms_deltas = df["milestones_completed_delta"].values
    ms_stagnant = np.zeros(n, dtype=float)
    cur_ms_stag = 0
    prev_k = None
    for i in range(n):
        k = proj_keys[i]
        if k != prev_k:
            cur_ms_stag = 0
            prev_k = k
        if ms_deltas[i] <= 0:
            cur_ms_stag += 1
        else:
            cur_ms_stag = 0
        ms_stagnant[i] = cur_ms_stag
    df["milestone_stagnation_months"] = ms_stagnant

    return df


def split_data_temporally(df: pd.DataFrame) -> Tuple[pd.DataFrame, pd.DataFrame, pd.DataFrame]:
    """
    Strict Temporal Split (Section 17):
    - Train: April 2001 to Dec 2022
    - Val  : Jan 2023 to June 2024
    - Test : July 2024 to May 2026
    """
    train_mask = df["report_month"] <= pd.Timestamp("2022-12-31")
    val_mask = (df["report_month"] > pd.Timestamp("2022-12-31")) & (df["report_month"] <= pd.Timestamp("2024-06-30"))
    test_mask = df["report_month"] > pd.Timestamp("2024-06-30")

    df_train = df[train_mask].copy()
    df_val = df[val_mask].copy()
    df_test = df[test_mask].copy()

    print("\n" + "=" * 80)
    print("STRICT TEMPORAL TRAIN / VAL / TEST SPLIT BREAKDOWN")
    print("=" * 80)
    print(f"TRAIN Set (2001-04 to 2022-12): {len(df_train):>8,} snapshots ({df_train['effective_project_key'].nunique():>5,} projects)")
    print(f"VAL Set   (2023-01 to 2024-06): {len(df_val):>8,} snapshots ({df_val['effective_project_key'].nunique():>5,} projects)")
    print(f"TEST Set  (2024-07 to 2026-05): {len(df_test):>8,} snapshots ({df_test['effective_project_key'].nunique():>5,} projects)")

    return df_train, df_val, df_test


def get_feature_columns() -> Dict[str, List[str]]:
    """Returns curated feature sets for ablation and model training."""
    categorical = ["sector", "ministry_department", "state", "trajectory_completeness", "reporting_status"]

    baseline_state = [
        "original_cost_crore", "anticipated_cost_crore", "cumulative_expenditure_crore",
        "physical_progress_clean", "expenditure_ratio_pct", "schedule_extension_months",
        "project_age_months", "remaining_duration_months", "cost_overrun_pct",
        "expenditure_to_original_cost", "revised_to_original_cost", "delay_to_duration_ratio"
    ]

    trajectory_dynamics = [
        "progress_velocity", "progress_velocity_3m", "progress_velocity_6m", "progress_velocity_12m",
        "progress_acceleration", "progress_deceleration",
        "financial_progress_velocity", "physical_financial_divergence", "absolute_progress_gap",
        "divergence_delta_3m", "divergence_delta_6m",
        "expenditure_velocity", "expenditure_growth_rate", "expenditure_efficiency",
        "delay_velocity", "cost_escalation_velocity",
        "physical_progress_delta_1m", "physical_progress_delta_3m", "physical_progress_delta_6m",
        "cost_overrun_roll_mean_3m", "cost_overrun_roll_mean_6m", "cost_overrun_roll_mean_12m",
        "cost_overrun_roll_std_3m", "cost_overrun_roll_std_6m",
        "delay_roll_mean_3m", "delay_roll_mean_6m", "delay_roll_mean_12m",
        "delay_roll_std_3m", "delay_roll_std_6m",
        "progress_roll_mean_3m", "progress_roll_mean_6m", "progress_roll_mean_12m",
        "progress_roll_std_3m",
        "consecutive_stagnant_months", "cost_revision_count", "extension_count"
    ]

    schedule_longitudinal = [
        "delay_change_1m", "delay_change_3m", "delay_change_6m", "delay_change_12m",
        "delay_trend_3m", "delay_trend_6m", "delay_trend_12m",
        "delay_acceleration", "delay_deceleration",
        "delay_roll_median_3m", "delay_roll_median_6m",
        "max_historical_delay", "min_historical_delay",
        "delay_volatility", "delay_divergence_recent_vs_longterm",
        "consecutive_increasing_delay_months", "consecutive_recovery_months",
        "schedule_revision_frequency", "extension_frequency", "months_since_last_schedule_revision",
        "original_doc_revision_count", "anticipated_doc_revision_count",
        "elapsed_duration_ratio", "planned_vs_observed_gap",
        "milestone_velocity", "milestone_stagnation_months"
    ]

    milestone_scope = [
        "milestone_progress_pct", "milestones_completed", "milestones_total",
        "scope_expansion_flag", "scope_reduction_flag", "scope_change_ratio",
        "milestone_revision_flag", "number_of_milestone_plan_changes",
        "cumulative_scope_expansion", "scope_instability_score", "scope_change_frequency"
    ]

    reporting_quality = [
        "reporting_gap_months", "reporting_staleness_flag", "reporting_reliability_score",
        "reporting_frequency", "number_of_reporting_gaps", "snapshot_history_count",
        "historical_coverage_ratio", "months_approval_to_first_obs"
    ]

    similarity_features = [
        "nearest_project_similarity", "mean_similarity_top_k",
        "median_delay_top_k", "mean_cost_escalation_top_k",
        "high_delay_fraction_top_k", "high_cost_escalation_fraction_top_k"
    ]

    kg_features = [
        "sector_historical_avg_delay", "sector_historical_avg_cost_overrun",
        "agency_historical_avg_delay", "agency_historical_avg_cost_overrun",
        "ministry_historical_avg_delay", "ministry_historical_avg_cost_overrun"
    ]

    missingness_flags = [
        "missing_project_id_flag", "missing_revised_cost_flag",
        "missing_original_cost_flag", "missing_anticipated_cost_flag",
        "missing_expenditure_flag", "missing_progress_flag"
    ]

    all_num = baseline_state + trajectory_dynamics + schedule_longitudinal + milestone_scope + reporting_quality + similarity_features + kg_features + missingness_flags

    return {
        "categorical": categorical,
        "baseline": baseline_state,
        "trajectory": trajectory_dynamics + milestone_scope,
        "schedule_longitudinal": schedule_longitudinal,
        "reporting": reporting_quality,
        "similarity": similarity_features,
        "kg": kg_features,
        "missingness": missingness_flags,
        "all_numeric": all_num,
        "full_features": categorical + all_num
    }


def main():
    p_in = TRAJECTORY_DIR / "project_trajectories_with_similarity.parquet"
    if not p_in.exists():
        p_in = TRAJECTORY_DIR / "project_trajectories.parquet"
    print(f"Reading dataset from {p_in}...")
    df = pd.read_parquet(p_in)

    # 1. Generate forward targets
    df = generate_forward_targets(df, horizons=[3, 6])

    # 2. Add longitudinal schedule trajectory features (point-in-time)
    df = add_schedule_trajectory_features(df)

    # 3. Add point-in-time historical statistics & scale-normalized features
    df = add_point_in_time_historical_stats(df)

    # 4. Save feature definitions
    feat_defs = get_feature_columns()
    with open(ML_DIR / "feature_catalog.json", "w", encoding="utf-8") as f:
        json.dump(feat_defs, f, indent=2)

    # 5. Strict Temporal Split
    df_train, df_val, df_test = split_data_temporally(df)

    # 6. Save Parquet Splits
    print("\nSaving train, val, test splits to data/05_ml_features/...")
    df_train.to_parquet(ML_DIR / "train.parquet", index=False)
    df_val.to_parquet(ML_DIR / "val.parquet", index=False)
    df_test.to_parquet(ML_DIR / "test.parquet", index=False)

    print(f"Features saved successfully! Catalog contains {len(feat_defs['full_features'])} total features.")


if __name__ == "__main__":
    main()

