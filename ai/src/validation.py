"""
Dataset validation for PAIMANA Master CSV.

Checks data quality, reports issues, and ensures the dataset
meets minimum requirements for training.
"""

import pandas as pd
import numpy as np
from typing import Dict, Any


def validate_dataset(df: pd.DataFrame) -> Dict[str, Any]:
    """
    Validate the dataset and produce a comprehensive data-quality report.

    Parameters
    ----------
    df : pd.DataFrame
        The loaded Master dataset with parsed dates.

    Returns
    -------
    dict
        Data quality report with all validation results.
    """
    report = {}

    # --- Basic stats ---
    report["total_rows"] = len(df)
    report["total_columns"] = len(df.columns)
    report["unique_projects"] = df["project_id"].nunique()
    report["min_report_month"] = str(df["report_month"].min().date())
    report["max_report_month"] = str(df["report_month"].max().date())
    report["num_report_months"] = df["report_month"].nunique()
    report["report_months"] = sorted([str(d.date()) for d in df["report_month"].unique()])

    # --- Duplicates ---
    dup_count = df.duplicated(subset=["project_id", "report_month"]).sum()
    report["duplicate_project_month_count"] = int(dup_count)
    if dup_count > 0:
        dups = df[df.duplicated(subset=["project_id", "report_month"], keep=False)]
        report["duplicate_examples"] = dups[["project_id", "report_month"]].head(10).to_dict("records")

    # --- Snapshot counts per project ---
    snapshot_counts = df.groupby("project_id").size()
    report["snapshot_distribution"] = {
        "1_snapshot": int((snapshot_counts == 1).sum()),
        "2_plus_snapshots": int((snapshot_counts >= 2).sum()),
        "3_plus_snapshots": int((snapshot_counts >= 3).sum()),
        "4_plus_snapshots": int((snapshot_counts >= 4).sum()),
        "6_plus_snapshots": int((snapshot_counts >= 6).sum()),
        "9_plus_snapshots": int((snapshot_counts >= 9).sum()),
        "12_plus_snapshots": int((snapshot_counts >= 12).sum()),
        "max_snapshots": int(snapshot_counts.max()),
        "mean_snapshots": round(float(snapshot_counts.mean()), 2),
        "median_snapshots": int(snapshot_counts.median()),
    }

    # --- Missing values ---
    missing = df.isnull().sum()
    missing_pct = (missing / len(df) * 100).round(2)
    missing_report = {}
    for col in missing[missing > 0].sort_values(ascending=False).index:
        missing_report[col] = {
            "count": int(missing[col]),
            "pct": float(missing_pct[col]),
        }
    report["missing_values"] = missing_report

    # --- Numeric range checks ---
    numeric_checks = {}
    range_specs = {
        "physical_progress_pct": (0, 100),
        "remaining_work_pct": (0, 100),
        "expenditure_ratio_pct": (0, None),
        "cost_overrun_pct": (None, None),  # Can be negative
    }
    for col, (low, high) in range_specs.items():
        if col in df.columns:
            col_data = df[col].dropna()
            check = {
                "min": float(col_data.min()) if len(col_data) > 0 else None,
                "max": float(col_data.max()) if len(col_data) > 0 else None,
                "mean": round(float(col_data.mean()), 2) if len(col_data) > 0 else None,
            }
            if low is not None:
                below = (col_data < low).sum()
                check["below_range"] = int(below)
            if high is not None:
                above = (col_data > high).sum()
                check["above_range"] = int(above)
            numeric_checks[col] = check
    report["numeric_ranges"] = numeric_checks

    # --- Chronological ordering check ---
    chrono_issues = 0
    for pid, grp in df.groupby("project_id"):
        months = grp["report_month"].values
        if not all(months[i] <= months[i + 1] for i in range(len(months) - 1)):
            chrono_issues += 1
    report["chronological_order_issues"] = chrono_issues

    # --- Schedule status distribution ---
    if "schedule_status" in df.columns:
        report["schedule_status_distribution"] = df["schedule_status"].value_counts().to_dict()

    # --- Cost overrun distribution ---
    if "cost_overrun_pct" in df.columns:
        co = df["cost_overrun_pct"].dropna()
        report["cost_overrun_stats"] = {
            "mean": round(float(co.mean()), 2),
            "median": round(float(co.median()), 2),
            "std": round(float(co.std()), 2),
            "pct_above_5": round(float((co > 5).mean() * 100), 1),
            "pct_above_10": round(float((co > 10).mean() * 100), 1),
            "pct_above_20": round(float((co > 20).mean() * 100), 1),
        }

    return report


def print_validation_report(report: Dict[str, Any]) -> None:
    """Print a formatted data quality report."""
    print("=" * 70)
    print("PAIMANA DATA QUALITY REPORT")
    print("=" * 70)

    print(f"\n{'Total rows:':<35} {report['total_rows']}")
    print(f"{'Unique projects:':<35} {report['unique_projects']}")
    print(f"{'Report months:':<35} {report['num_report_months']}")
    print(f"{'Date range:':<35} {report['min_report_month']} to {report['max_report_month']}")
    print(f"{'Duplicate (pid + month):':<35} {report['duplicate_project_month_count']}")

    print(f"\n--- Snapshot Distribution ---")
    sd = report["snapshot_distribution"]
    print(f"  {'1 snapshot:':<30} {sd['1_snapshot']}")
    print(f"  {'2+ snapshots:':<30} {sd['2_plus_snapshots']}")
    print(f"  {'3+ snapshots:':<30} {sd['3_plus_snapshots']}")
    print(f"  {'4+ snapshots:':<30} {sd['4_plus_snapshots']}")
    print(f"  {'6+ snapshots:':<30} {sd['6_plus_snapshots']}")
    print(f"  {'9+ snapshots:':<30} {sd['9_plus_snapshots']}")
    print(f"  {'12+ snapshots:':<30} {sd['12_plus_snapshots']}")
    print(f"  {'Max snapshots:':<30} {sd['max_snapshots']}")
    print(f"  {'Mean snapshots:':<30} {sd['mean_snapshots']}")

    print(f"\n--- Missing Values (top 15) ---")
    mv = report["missing_values"]
    for i, (col, info) in enumerate(mv.items()):
        if i >= 15:
            break
        print(f"  {col:<45} {info['count']:>6} ({info['pct']:.1f}%)")

    if "cost_overrun_stats" in report:
        print(f"\n--- Cost Overrun Distribution ---")
        cos = report["cost_overrun_stats"]
        print(f"  {'Mean:':<30} {cos['mean']}%")
        print(f"  {'Median:':<30} {cos['median']}%")
        print(f"  {'Std:':<30} {cos['std']}%")
        print(f"  {'% above 5%:':<30} {cos['pct_above_5']}%")
        print(f"  {'% above 10%:':<30} {cos['pct_above_10']}%")
        print(f"  {'% above 20%:':<30} {cos['pct_above_20']}%")

    if "schedule_status_distribution" in report:
        print(f"\n--- Schedule Status ---")
        for status, count in report["schedule_status_distribution"].items():
            print(f"  {status:<30} {count}")

    if report["chronological_order_issues"] > 0:
        print(f"\n[WARNING]  Chronological ordering issues: {report['chronological_order_issues']} projects")

    if report["duplicate_project_month_count"] > 0:
        print(f"\n[WARNING]  Duplicates found: {report['duplicate_project_month_count']}")

    print("\n" + "=" * 70)


def check_minimum_requirements(report: Dict[str, Any]) -> bool:
    """Check if the dataset meets minimum requirements for training."""
    issues = []

    if report["total_rows"] < 100:
        issues.append(f"Too few rows: {report['total_rows']} (need 100+)")

    if report["unique_projects"] < 10:
        issues.append(f"Too few projects: {report['unique_projects']} (need 10+)")

    if report["snapshot_distribution"]["3_plus_snapshots"] < 10:
        issues.append(f"Too few projects with 3+ snapshots: {report['snapshot_distribution']['3_plus_snapshots']}")

    if report["duplicate_project_month_count"] > 0:
        issues.append(f"Duplicates detected: {report['duplicate_project_month_count']}")

    if issues:
        print("\n[WARNING]  MINIMUM REQUIREMENTS NOT MET:")
        for issue in issues:
            print(f"  - {issue}")
        return False

    print("\n[OK] Dataset passes minimum requirements.")
    return True
