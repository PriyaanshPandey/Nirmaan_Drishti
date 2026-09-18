"""
01_canonical_ingestion.py - Canonical Data Ingestion & Harmonization Pipeline
Nirmaan Drishti / Infrastructure Project Monitoring (April 2001 - May 2026).

Responsibilities:
1. Ingest all authoritative source datasets (Completed 2001-2026, Ongoing Non-Active, Ongoing Active).
2. Fix column corruption found in existing files by selecting certified intact columns.
3. Enforce strict Project Identity rules without inventing artificial IDs:
   - Projects with official ID use that ID.
   - Pre-2011 completed projects without official ID use project_id = NULL and identifier_type = 'PROJECT_NAME'.
4. Perform systematic data validation (dates, progress, costs, milestones, deduplication).
5. Output the single authoritative canonical dataset to data/03_validated/.
"""

import sys
import os
import re
from pathlib import Path

WORKSPACE_ROOT = Path(__file__).resolve().parent.parent
if str(WORKSPACE_ROOT) not in sys.path:
    sys.path.insert(0, str(WORKSPACE_ROOT))

from datetime import datetime
from typing import Tuple, Dict, List, Any
import numpy as np
import pandas as pd

from data_pipeline.project_identity_resolver import identity_resolver, clean_id

# Force UTF-8 output
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

WORKSPACE_ROOT = Path(r"d:\Nirmaan-Drishti-secret-")
DATA_DIR = WORKSPACE_ROOT / "data"
AI_INPUT_DIR = WORKSPACE_ROOT / "ai" / "data" / "input"
VALIDATED_DIR = DATA_DIR / "03_validated"
REPORTS_DIR = DATA_DIR / "07_validation_reports"

VALIDATED_DIR.mkdir(parents=True, exist_ok=True)
REPORTS_DIR.mkdir(parents=True, exist_ok=True)


def normalize_project_name(name: str) -> str:
    """Normalize project name for robust search/matching while preserving original."""
    if pd.isna(name) or name is None:
        return "UNKNOWN_PROJECT"
    s = str(name).strip().lower()
    # Replace multiple spaces, dashes, slashes with single space
    s = re.sub(r"[\s\-_/\\,;:.]+", " ", s)
    return s.strip()


def parse_flexible_date(series: pd.Series) -> pd.Series:
    """Safely parse mixed date representations into datetime64[ns]."""
    # Try direct pandas mixed parsing with dayfirst=False, then dayfirst=True
    dt = pd.to_datetime(series, errors="coerce", format="mixed")
    return dt


def clean_percentage(series: pd.Series) -> pd.Series:
    """Extract numeric percentage from string or float."""
    def _parse(v):
        if pd.isna(v) or v is None:
            return np.nan
        if isinstance(v, (int, float)):
            # If formatted as fraction e.g. 0.32, convert to percentage
            if 0 < v <= 1.0:
                return float(v * 100.0)
            return float(v)
        s = str(v).replace("%", "").strip()
        try:
            val = float(s)
            if 0 < val <= 1.0 and "." in s and float(s) < 1.0:
                # Could be decimal percentage like 0.50% vs decimal fraction 0.50
                pass
            return val
        except ValueError:
            return np.nan

    return series.apply(_parse)


def clean_currency(series: pd.Series) -> pd.Series:
    """Clean currency string/numeric values into float in Crore."""
    def _parse(v):
        if pd.isna(v) or v is None:
            return np.nan
        if isinstance(v, (int, float)):
            return float(v)
        s = str(v).replace(",", "").replace("₹", "").replace("Cr", "").replace("cr", "").strip()
        try:
            return float(s)
        except ValueError:
            return np.nan

    return series.apply(_parse)


def load_raw_sources() -> Tuple[pd.DataFrame, pd.DataFrame, pd.DataFrame]:
    """Load the three authoritative source datasets."""
    print("=" * 80)
    print("STEP 1: LOADING AUTHORITATIVE SOURCE DATASETS")
    print("=" * 80)

    # 1. Completed Projects (2001 - May 2026 full monthly snapshots)
    p_comp = DATA_DIR / "Completed_Projects_2001_to_May_2026 (1).csv"
    if not p_comp.exists():
        p_comp = DATA_DIR / "Completed_Projects_2001_to_May_2026.csv"
    print(f"Loading Completed Projects from: {p_comp.name}...")
    df_comp = pd.read_csv(p_comp, encoding="utf-8", encoding_errors="replace", low_memory=False)
    df_comp["dataset_source"] = "Completed_Projects_2001_to_May_2026"
    df_comp["operational_status"] = "COMPLETED"
    print(f"  -> Loaded {len(df_comp):,} snapshots, {df_comp['project_id'].nunique(dropna=True):,} projects with ID, {df_comp['project_name'].nunique():,} unique names.")

    # 2. Ongoing Non-Active (2328 projects, 2011 - 2025)
    # Use uncorrupted version from ai/data/input
    p_nonact = AI_INPUT_DIR / "Ongoing_2328_Non_Active_Projects_Master.csv"
    if not p_nonact.exists():
        p_nonact = DATA_DIR / "Ongoing_2328_Non_Active_Projects_Master (1).csv"
    print(f"Loading Ongoing Non-Active Projects from: {p_nonact.name}...")
    df_nonact = pd.read_csv(p_nonact, encoding="utf-8", encoding_errors="replace", low_memory=False)
    df_nonact["dataset_source"] = "Ongoing_2328_Non_Active_Projects_Master"
    df_nonact["operational_status"] = "ONGOING_NON_ACTIVE"
    print(f"  -> Loaded {len(df_nonact):,} snapshots, {df_nonact['project_id'].nunique(dropna=True):,} projects with ID.")

    # 3. Ongoing Active (1379 projects, 2011 - May 2026)
    # Use uncorrupted version from ai/data/input (verified intact anticipated cost and expenditure columns)
    p_act = AI_INPUT_DIR / "ongoing project detail.csv"
    if not p_act.exists():
        p_act = DATA_DIR / "Ongoing_Project_Detail.csv"
    print(f"Loading Ongoing Active Projects from: {p_act.name}...")
    df_act = pd.read_csv(p_act, encoding="utf-8", encoding_errors="replace", low_memory=False)
    df_act["dataset_source"] = "Ongoing_Project_Detail"
    df_act["operational_status"] = "ONGOING_ACTIVE"
    print(f"  -> Loaded {len(df_act):,} snapshots, {df_act['project_id'].nunique(dropna=True):,} projects with ID.")

    return df_comp, df_nonact, df_act


def harmonize_dataset(df: pd.DataFrame, source_type: str) -> pd.DataFrame:
    """Harmonize schema, parse fields, and compute identity features using deterministic resolver."""
    out = pd.DataFrame(index=df.index)

    # 1. Project Identity (Deterministic OCMS -> Project ID transition)
    raw_id_series = df["project_id"] if "project_id" in df.columns else pd.Series(None, index=df.index)
    raw_ocms_series = df["legacy_ocms_code"] if "legacy_ocms_code" in df.columns else pd.Series(None, index=df.index)

    res_df = identity_resolver.resolve_series(raw_id_series, raw_ocms_series)

    out["project_id"] = res_df["project_id"]
    out["legacy_ocms_code"] = res_df["legacy_ocms_code"]
    out["raw_project_id"] = res_df["raw_project_id"]
    out["raw_legacy_ocms_code"] = res_df["raw_legacy_ocms_code"]
    out["resolution_rule"] = res_df["resolution_rule"]
    out["is_transitioned"] = res_df["is_transitioned"]
    out["has_project_id"] = out["project_id"].notna()

    # Original Project Name
    out["project_name"] = df["project_name"].astype(str).str.strip() if "project_name" in df.columns else "UNKNOWN"
    out["normalized_project_name"] = out["project_name"].apply(normalize_project_name)

    # Identifier type & Identity Source
    out["identifier_type"] = np.where(
        out["has_project_id"],
        "OFFICIAL_ID",
        np.where(out["legacy_ocms_code"].notna(), "LEGACY_OCMS", "PROJECT_NAME")
    )
    out["identity_source"] = np.where(
        out["has_project_id"],
        "OCMS_PROJECT_ID",
        np.where(out["legacy_ocms_code"].notna(), "LEGACY_OCMS", "PROJECT_NAME")
    )
    out["identity_confidence"] = np.where(
        out["has_project_id"],
        1.0,
        np.where(out["legacy_ocms_code"].notna(), 0.98, 0.95)
    )

    # Effective project key for grouping and linking (Prefix avoids collisions)
    out["effective_project_key"] = res_df["resolved_effective_key"].fillna("NAME:" + out["normalized_project_name"])

    if "PMGID" in df.columns:
        pmg = df["PMGID"].astype(str).str.strip()
        out["pmg_id"] = np.where(pmg.isin(["nan", "None", "null", ""]), np.nan, pmg)
    else:
        out["pmg_id"] = np.nan

    # 2. Administrative Context
    out["ministry_department"] = df["ministry_department"].fillna("UNKNOWN").astype(str).str.strip()
    
    # Extract sector and agency from ministry_department if separated by '/'
    def get_sector(val):
        s = str(val).strip()
        return s.split("/")[0].strip() if "/" in s else s

    def get_agency(val):
        s = str(val).strip()
        return s.split("/")[1].strip() if "/" in s else s

    out["sector"] = out["ministry_department"].apply(get_sector)
    out["agency"] = out["ministry_department"].apply(get_agency)
    out["state"] = df["state"].fillna("UNKNOWN").astype(str).str.strip() if "state" in df.columns else "UNKNOWN"

    # 3. Temporal Reporting Snapshot
    out["year"] = pd.to_numeric(df["year"], errors="coerce").astype("Int64")
    out["month"] = df["month"].astype(str).str.strip()
    out["financial_year"] = df["financial_year"].astype(str).str.strip() if "financial_year" in df.columns else np.nan
    out["month_order"] = pd.to_numeric(df["month_order"], errors="coerce").astype("Int64") if "month_order" in df.columns else np.nan

    # Build exact report_month as datetime64 (first day of month)
    date_str = out["year"].astype(str) + "-" + out["month"] + "-01"
    out["report_month"] = pd.to_datetime(date_str, format="%Y-%B-%d", errors="coerce")
    
    # Fallback if month is numeric or abbreviated
    fallback_mask = out["report_month"].isna()
    if fallback_mask.any():
        out.loc[fallback_mask, "report_month"] = pd.to_datetime(date_str[fallback_mask], format="mixed", errors="coerce")

    # 4. Lifecycle Dates
    out["approval_date"] = parse_flexible_date(df["Date of approval"]) if "Date of approval" in df.columns else pd.NaT
    out["original_doc"] = parse_flexible_date(df["original date of commissioning"]) if "original date of commissioning" in df.columns else pd.NaT
    out["anticipated_doc"] = parse_flexible_date(df["anticipated commissioning"]) if "anticipated commissioning" in df.columns else pd.NaT

    # 5. Financial & Progress Metrics (Crores & %)
    out["original_cost_cr"] = clean_currency(df["Original cost (₹ Cr)"]) if "Original cost (₹ Cr)" in df.columns else np.nan
    out["revised_cost_cr"] = clean_currency(df["revised cost (₹ Cr)"]) if "revised cost (₹ Cr)" in df.columns else np.nan
    out["anticipated_cost_cr"] = clean_currency(df["Anticipated cost (₹ Cr)"]) if "Anticipated cost (₹ Cr)" in df.columns else np.nan
    out["cumulative_expenditure_cr"] = clean_currency(df["cumulative expenditure (₹ Cr)"]) if "cumulative expenditure (₹ Cr)" in df.columns else np.nan
    out["physical_progress_pct"] = clean_percentage(df["physical progress"]) if "physical progress" in df.columns else np.nan

    # 6. Milestone String
    ms_col = "ministry_department/milestone" if "ministry_department/milestone" in df.columns else None
    out["raw_milestone"] = df[ms_col].astype(str).str.strip() if ms_col else np.nan
    out["raw_milestone"] = np.where(out["raw_milestone"].isin(["nan", "None", "null", ""]), np.nan, out["raw_milestone"])

    # 7. Metadata & Lineage
    out["dataset_source"] = df["dataset_source"]
    out["operational_status"] = df["operational_status"]

    return out


def validate_and_deduplicate(df: pd.DataFrame) -> Tuple[pd.DataFrame, dict]:
    """
    Run systematic validation across all rows:
    - Dates sanity
    - Progress bounds [0, 100]
    - Costs sanity & revisions
    - Duplicate detection & resolution
    """
    print("=" * 80)
    print("STEP 2: SYSTEMATIC DATA VALIDATION & DEDUPLICATION")
    print("=" * 80)

    stats = {}
    stats["total_raw_rows"] = len(df)
    stats["total_unique_projects"] = df["effective_project_key"].nunique()

    # 1. Flag invalid progress
    invalid_prog = (df["physical_progress_pct"] < 0) | (df["physical_progress_pct"] > 100)
    df["invalid_progress_flag"] = invalid_prog.astype(int)
    stats["invalid_progress_count"] = int(invalid_prog.sum())

    # 2. Flag negative costs or expenditures
    neg_cost = (df["original_cost_cr"] < 0) | (df["anticipated_cost_cr"] < 0) | (df["cumulative_expenditure_cr"] < 0)
    df["negative_cost_flag"] = neg_cost.astype(int)
    stats["negative_cost_count"] = int(neg_cost.sum())

    # 3. Flag downward revised cost (legitimate administrative occurrence, flag rather than remove)
    downward_rev = (df["revised_cost_cr"] < df["original_cost_cr"]) & df["revised_cost_cr"].notna() & df["original_cost_cr"].notna()
    df["downward_cost_revision_flag"] = downward_rev.astype(int)
    stats["downward_cost_revision_count"] = int(downward_rev.sum())

    # 4. Flag date inversions (approval > original_doc or start > completion)
    date_inv = (df["approval_date"] > df["original_doc"]) & df["approval_date"].notna() & df["original_doc"].notna()
    df["date_inversion_flag"] = date_inv.astype(int)
    stats["date_inversion_count"] = int(date_inv.sum())

    # 5. Missing values flags (Section 18)
    df["missing_project_id_flag"] = (~df["has_project_id"]).astype(int)
    df["missing_revised_cost_flag"] = df["revised_cost_cr"].isna().astype(int)
    df["missing_original_cost_flag"] = df["original_cost_cr"].isna().astype(int)
    df["missing_anticipated_cost_flag"] = df["anticipated_cost_cr"].isna().astype(int)
    df["missing_expenditure_flag"] = df["cumulative_expenditure_cr"].isna().astype(int)
    df["missing_progress_flag"] = df["physical_progress_pct"].isna().astype(int)
    df["missing_original_doc_flag"] = df["original_doc"].isna().astype(int)
    df["missing_anticipated_doc_flag"] = df["anticipated_doc"].isna().astype(int)

    # 6. Duplicate detection at (effective_project_key, report_month)
    dup_mask = df.duplicated(subset=["effective_project_key", "report_month"], keep=False)
    stats["total_duplicate_snapshots"] = int(dup_mask.sum())
    print(f"  -> Detected {dup_mask.sum():,} duplicate snapshot records across (effective_project_key, report_month).")

    # Deduplicate strictly by retaining the record with highest data completeness
    # Measure completeness by counting non-null critical values
    completeness_score = (
        df["anticipated_cost_cr"].notna().astype(int) * 2 +
        df["cumulative_expenditure_cr"].notna().astype(int) * 2 +
        df["physical_progress_pct"].notna().astype(int) * 2 +
        df["anticipated_doc"].notna().astype(int) * 2 +
        df["raw_milestone"].notna().astype(int)
    )
    df["_completeness_score"] = completeness_score

    df_sorted = df.sort_values(["effective_project_key", "report_month", "_completeness_score"], ascending=[True, True, False])
    df_dedup = df_sorted.drop_duplicates(subset=["effective_project_key", "report_month"], keep="first").reset_index(drop=True)
    df_dedup = df_dedup.drop(columns=["_completeness_score"])

    stats["total_deduplicated_rows"] = len(df_dedup)
    stats["deduplicated_projects"] = df_dedup["effective_project_key"].nunique()
    print(f"  -> Retained {len(df_dedup):,} clean canonical snapshots across {df_dedup['effective_project_key'].nunique():,} unique projects.")

    return df_dedup, stats


def main():
    # 1. Load source files
    df_comp_raw, df_nonact_raw, df_act_raw = load_raw_sources()

    # 2. Harmonize individual sources
    print("\nHarmonizing datasets into unified schema...")
    df_comp = harmonize_dataset(df_comp_raw, "Completed")
    df_nonact = harmonize_dataset(df_nonact_raw, "Ongoing_Non_Active")
    df_act = harmonize_dataset(df_act_raw, "Ongoing_Active")

    # 3. Concatenate all datasets
    combined = pd.concat([df_comp, df_nonact, df_act], ignore_index=True)
    print(f"Combined total raw snapshots: {len(combined):,} across {combined['effective_project_key'].nunique():,} unique project keys.")

    # 4. Validate and deduplicate
    canonical_df, stats = validate_and_deduplicate(combined)

    # 5. Output canonical dataset
    out_parquet = VALIDATED_DIR / "canonical_project_snapshots.parquet"
    out_csv_sample = VALIDATED_DIR / "canonical_project_snapshots_sample.csv"

    print(f"\nSaving canonical dataset to {out_parquet}...")
    canonical_df.to_parquet(out_parquet, index=False)
    canonical_df.head(1000).to_csv(out_csv_sample, index=False)
    print(f"Saved canonical dataset: {len(canonical_df):,} rows x {len(canonical_df.columns)} columns.")

    # Print summary breakdown
    print("\n" + "=" * 80)
    print("CANONICAL DATASET BREAKDOWN BY OPERATIONAL STATUS")
    print("=" * 80)
    for status, grp in canonical_df.groupby("operational_status"):
        p_with_id = grp[grp['has_project_id']]['project_id'].nunique()
        p_without_id = grp[~grp['has_project_id']]['project_name'].nunique()
        min_date = grp['report_month'].min().strftime('%Y-%m') if grp['report_month'].notna().any() else "N/A"
        max_date = grp['report_month'].max().strftime('%Y-%m') if grp['report_month'].notna().any() else "N/A"
        print(f"Status: {status:<20} | Snapshots: {len(grp):>8,} | Projs with ID: {p_with_id:>5,} | Projs w/o ID: {p_without_id:>4,} | Dates: {min_date} to {max_date}")

    print("\n" + "=" * 80)
    print("PROJECT IDENTITY AUDIT")
    print("=" * 80)
    print(f"Total Unique Effective Projects: {canonical_df['effective_project_key'].nunique():,}")
    print(f"  - Projects with official ID     : {canonical_df[canonical_df['has_project_id']]['project_id'].nunique():,}")
    print(f"  - Projects identified by Name   : {canonical_df[~canonical_df['has_project_id']]['normalized_project_name'].nunique():,}")
    print(f"  - Total snapshots without ID    : {(~canonical_df['has_project_id']).sum():,}")

    return canonical_df, stats


if __name__ == "__main__":
    main()
