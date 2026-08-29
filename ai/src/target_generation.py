"""
Target generation for PAIMANA ML models.

Creates rolling forecasting targets for incremental cost and schedule overrun
by looking forward from each snapshot to future snapshots.

Primary Targets:
- Additional Cost Escalation (% and ₹ Cr): change in cost overrun after month t.
- Additional Schedule Delay (months): change in schedule extension after month t.
- Additional Escalation Events (binary): whether additional cost/delay occurs.

CRITICAL: Never uses future information as features.
The Master CSV is never modified — separate training datasets are created.
"""

import pandas as pd
import numpy as np
from pathlib import Path
from typing import Dict, Tuple, Optional


def generate_cost_targets(df: pd.DataFrame, horizon_months: int,
                          threshold_pct: float = 0.0) -> pd.DataFrame:
    """
    Generate incremental cost overrun targets by looking forward from each snapshot.

    For each (project_id, report_month=T), look forward to T+horizon_months.
    Target = cost_overrun_pct(T+horizon) - cost_overrun_pct(T).

    Parameters
    ----------
    df : pd.DataFrame
        Master dataset sorted by (project_id, report_month).
    horizon_months : int
        Number of months to look forward (3 or 6).
    threshold_pct : float
        Threshold for incremental escalation classification (default >0 pp).

    Returns
    -------
    pd.DataFrame
        Dataset with incremental cost target columns added.
    """
    target_col_reg_pct = f"additional_cost_overrun_pct_{horizon_months}m"
    target_col_reg_cr = f"additional_cost_escalation_crore_{horizon_months}m"
    target_col_cls = f"additional_cost_escalation_event_{horizon_months}m"

    # Vectorized computation via forward shift/merge
    df_sorted = df.sort_values(["project_id", "report_month"]).copy()
    
    # Future lookup frame
    future_lookup = df_sorted[[
        "project_id", "report_month", "cost_overrun_pct", "cost_escalation_crore"
    ]].copy()
    future_lookup["target_lookup_month"] = future_lookup["report_month"] - pd.DateOffset(months=horizon_months)

    merged = pd.merge(
        df_sorted,
        future_lookup,
        left_on=["project_id", "report_month"],
        right_on=["project_id", "target_lookup_month"],
        how="left",
        suffixes=("", "_future")
    )

    # Compute incremental changes
    delta_cost_pct = merged["cost_overrun_pct_future"] - merged["cost_overrun_pct"]
    delta_cost_cr = merged["cost_escalation_crore_future"] - merged["cost_escalation_crore"]
    
    # Binary event: 1 if delta_cost_pct > threshold_pct, 0 if delta_cost_pct <= threshold_pct, NaN if future missing
    event_cls = np.where(
        delta_cost_pct.isna(),
        np.nan,
        (delta_cost_pct > threshold_pct).astype(float)
    )

    merged[target_col_reg_pct] = delta_cost_pct
    merged[target_col_reg_cr] = delta_cost_cr
    merged[target_col_cls] = event_cls

    # Cleanup temporary merge columns
    cols_to_drop = [c for c in merged.columns if c.endswith("_future") or c == "target_lookup_month"]
    result = merged.drop(columns=cols_to_drop)

    return result


def generate_time_targets(df: pd.DataFrame, horizon_months: int,
                          threshold_months: float = 0.0) -> pd.DataFrame:
    """
    Generate incremental schedule delay targets by looking forward from each snapshot.

    Authoritative Field: schedule_extension_months.
    Target = schedule_extension_months(T+horizon) - schedule_extension_months(T).

    Parameters
    ----------
    df : pd.DataFrame
        Master dataset sorted by (project_id, report_month).
    horizon_months : int
        Number of months to look forward (3 or 6).
    threshold_months : float
        Threshold for additional delay classification (default >0 months).

    Returns
    -------
    pd.DataFrame
        Dataset with incremental schedule target columns added.
    """
    target_col_cls = f"additional_delay_event_{horizon_months}m"
    target_col_reg = f"additional_delay_months_{horizon_months}m"

    df_sorted = df.sort_values(["project_id", "report_month"]).copy()

    # Fill NaNs in schedule extension safely with 0 for computation
    df_sorted["_clean_ext"] = df_sorted["schedule_extension_months"].fillna(0.0)

    future_lookup = df_sorted[[
        "project_id", "report_month", "_clean_ext", "schedule_status"
    ]].copy()
    future_lookup["target_lookup_month"] = future_lookup["report_month"] - pd.DateOffset(months=horizon_months)

    merged = pd.merge(
        df_sorted,
        future_lookup,
        left_on=["project_id", "report_month"],
        right_on=["project_id", "target_lookup_month"],
        how="left",
        suffixes=("", "_future")
    )

    # Incremental delay in months
    delta_delay_months = merged["_clean_ext_future"] - merged["_clean_ext"]
    # Handle rows where future is missing
    delta_delay_months = np.where(
        merged["_clean_ext_future"].isna(),
        np.nan,
        delta_delay_months
    )

    # Binary delay event: 1 if additional delay > threshold, 0 otherwise
    event_cls = np.where(
        np.isnan(delta_delay_months),
        np.nan,
        (delta_delay_months > threshold_months).astype(float)
    )

    merged[target_col_reg] = delta_delay_months
    merged[target_col_cls] = event_cls

    cols_to_drop = [c for c in merged.columns if c.endswith("_future") or c in ["target_lookup_month", "_clean_ext"]]
    result = merged.drop(columns=cols_to_drop)

    return result


def generate_all_targets(df: pd.DataFrame, config: dict) -> pd.DataFrame:
    """
    Generate all incremental cost and schedule targets for all horizons.

    Parameters
    ----------
    df : pd.DataFrame
        Master dataset.
    config : dict
        Configuration dictionary.

    Returns
    -------
    pd.DataFrame
        Dataset with all target columns.
    """
    cost_threshold = config.get("cost", {}).get("additional_escalation_threshold_pct", 0.0)
    sched_threshold = config.get("schedule", {}).get("additional_delay_threshold_months", 0.0)
    horizons = config["prediction"]["horizons"]

    result = df.copy()

    for h in horizons:
        print(f"\n--- Generating {h}M incremental cost targets (threshold > {cost_threshold} pp) ---")
        result = generate_cost_targets(result, h, cost_threshold)

        target_reg = f"additional_cost_overrun_pct_{h}m"
        target_cls = f"additional_cost_escalation_event_{h}m"
        valid = result[target_reg].notna().sum()
        pos = (result[target_cls] == 1).sum()
        neg = (result[target_cls] == 0).sum()
        print(f"  Valid targets: {valid}")
        print(f"  Positive (> {cost_threshold} pp): {pos} ({pos / max(valid, 1) * 100:.1f}%)")
        print(f"  Negative (<= {cost_threshold} pp): {neg} ({neg / max(valid, 1) * 100:.1f}%)")

    for h in horizons:
        print(f"\n--- Generating {h}M incremental schedule targets (threshold > {sched_threshold} mo) ---")
        result = generate_time_targets(result, h, sched_threshold)

        target_cls = f"additional_delay_event_{h}m"
        target_reg = f"additional_delay_months_{h}m"
        valid_cls = result[target_cls].notna().sum()
        valid_reg = result[target_reg].notna().sum()
        pos = (result[target_cls] == 1).sum()
        neg = (result[target_cls] == 0).sum()
        print(f"  Valid classification targets: {valid_cls}")
        print(f"  Delayed (> {sched_threshold} mo): {pos} ({pos / max(valid_cls, 1) * 100:.1f}%)")
        print(f"  No additional delay: {neg} ({neg / max(valid_cls, 1) * 100:.1f}%)")
        print(f"  Valid regression targets: {valid_reg}")

    return result


def save_training_datasets(df: pd.DataFrame, config: dict,
                           output_dir: str = None) -> Dict[str, str]:
    """
    Save separate training datasets for each horizon/target combination.
    Only rows with valid targets are included.

    Returns dict of {name: filepath}.
    """
    if output_dir is None:
        output_dir = Path(__file__).parent.parent / config["data"]["training_dir"]
    output_dir = Path(output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    saved = {}
    horizons = config["prediction"]["horizons"]

    for h in horizons:
        # Cost training data
        cost_reg = f"additional_cost_overrun_pct_{h}m"
        cost_cls = f"additional_cost_escalation_event_{h}m"
        if cost_reg in df.columns:
            cost_df = df[df[cost_reg].notna()].copy()
            path = output_dir / f"cost_{h}m_training.csv"
            cost_df.to_csv(path, index=False)
            saved[f"cost_{h}m"] = str(path)
            print(f"Saved cost {h}M training: {len(cost_df)} rows -> {path}")

        # Time training data
        time_cls = f"additional_delay_event_{h}m"
        time_reg = f"additional_delay_months_{h}m"
        if time_cls in df.columns:
            time_df = df[df[time_cls].notna()].copy()
            path = output_dir / f"time_{h}m_training.csv"
            time_df.to_csv(path, index=False)
            saved[f"time_{h}m"] = str(path)
            print(f"Saved time {h}M training: {len(time_df)} rows -> {path}")

    return saved


def report_target_availability(df: pd.DataFrame, config: dict) -> Dict:
    """
    Report detailed target availability for each horizon.

    Returns
    -------
    dict
        Target availability summary.
    """
    horizons = config["prediction"]["horizons"]
    cost_threshold = config.get("cost", {}).get("additional_escalation_threshold_pct", 0.0)
    sched_threshold = config.get("schedule", {}).get("additional_delay_threshold_months", 0.0)

    summary = {}
    for h in horizons:
        cost_reg = f"additional_cost_overrun_pct_{h}m"
        cost_cls = f"additional_cost_escalation_event_{h}m"
        time_cls = f"additional_delay_event_{h}m"
        time_reg = f"additional_delay_months_{h}m"

        h_info = {}
        if cost_reg in df.columns and cost_cls in df.columns:
            valid = df[cost_reg].notna()
            h_info["cost"] = {
                "eligible_snapshots": int(valid.sum()),
                "unique_projects": int(df.loc[valid, "project_id"].nunique()),
                "positive": int((df.loc[valid, cost_cls] == 1).sum()),
                "negative": int((df.loc[valid, cost_cls] == 0).sum()),
                "threshold_pct": cost_threshold,
            }

        if time_cls in df.columns and time_reg in df.columns:
            valid_cls = df[time_cls].notna()
            valid_reg = df[time_reg].notna()
            h_info["time"] = {
                "eligible_snapshots": int(valid_cls.sum()),
                "unique_projects": int(df.loc[valid_cls, "project_id"].nunique()),
                "positive_delayed": int((df.loc[valid_cls, time_cls] == 1).sum()),
                "negative_ontime": int((df.loc[valid_cls, time_cls] == 0).sum()),
                "regression_valid": int(valid_reg.sum()),
                "threshold_months": sched_threshold,
            }

        summary[f"{h}m"] = h_info

    return summary
