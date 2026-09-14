"""
Generate complete projectsData.ts containing all 6,500+ projects from both master CSVs:
  1. New_data_2011-jun25.csv (2011 to June 2025)
  2. New_data_july2025-may26.csv (July 2025 to May 2026)
Ensures zero hardcoding in frontend portfolio, map, dashboard, and offline fallback modes.
"""
import sys
import json
from pathlib import Path
from datetime import datetime
import pandas as pd
import numpy as np

BACKEND_DIR = Path(__file__).resolve().parent.parent
ROOT_DIR = BACKEND_DIR.parent
OUTPUT_TS = ROOT_DIR / "frontend" / "src" / "data" / "projectsData.ts"

INPUT_DIRS = [
    ROOT_DIR / "data" / "input",
    ROOT_DIR / "ai" / "data" / "input",
    ROOT_DIR / "data",
]


def find_csv_files() -> tuple[Path, Path]:
    f1, f2 = None, None
    for d in INPUT_DIRS:
        c1 = d / "New_data_2011-jun25.csv"
        c2 = d / "New_data_july2025-may26.csv"
        if not f1 and c1.exists():
            f1 = c1
        if not f2 and c2.exists():
            f2 = c2
    if not f1 or not f2:
        raise FileNotFoundError(f"Could not find CSVs in {INPUT_DIRS}")
    return f1, f2


def clean_str(val, default="") -> str:
    if pd.isna(val) or val is None:
        return default
    s = str(val).strip()
    return s if s else default


def clean_num(val, default=0.0) -> float:
    if pd.isna(val) or val is None:
        return default
    try:
        v = float(val)
        return default if np.isnan(v) or np.isinf(v) else v
    except (ValueError, TypeError):
        return default


def parse_date_safe(val) -> str:
    if pd.isna(val) or val is None or str(val).strip() == "":
        return "N/A"
    val_str = str(val).strip()
    for fmt in (
        "%Y-%m-%d", "%d-%m-%Y", "%Y-%m", "%d/%m/%Y", "%m/%Y",
        "%Y/%m/%d", "%b-%y", "%d-%b-%y"
    ):
        try:
            return datetime.strptime(val_str, fmt).strftime("%Y-%m-%d")
        except ValueError:
            pass
    try:
        dt = pd.to_datetime(val_str, dayfirst=True)
        return dt.strftime("%Y-%m-%d")
    except Exception:
        return val_str


def generate_projects_data():
    f1, f2 = find_csv_files()
    print(f"Reading CSV 1: {f1}")
    df1 = pd.read_csv(f1, low_memory=False)
    print(f"Reading CSV 2: {f2}")
    df2 = pd.read_csv(f2, low_memory=False)

    df1["project_id"] = df1["project_id"].astype(str).str.strip()
    if "project_code" in df2.columns:
        df2["project_id"] = df2["project_code"].fillna(df2.get("project_key", "")).astype(str).str.strip()
    else:
        df2["project_id"] = df2["project_key"].astype(str).str.strip()

    df1 = df1[df1["project_id"].str.len() > 0]
    df2 = df2[df2["project_id"].str.len() > 0]

    combined = pd.concat([df1, df2], ignore_index=True)
    print(f"Combined total records: {len(combined):,}")

    # Parse report month for accurate chronological ordering
    combined["_rep_dt"] = pd.to_datetime(combined["report_month"], errors="coerce", dayfirst=True)
    combined.sort_values(by=["project_id", "_rep_dt"], inplace=True)

    # Fast extraction of latest row for every single project
    latest_df = combined.drop_duplicates(subset=["project_id"], keep="last")
    print(f"Unique projects identified: {len(latest_df):,}")

    projects = []

    for _, row in latest_df.iterrows():
        p_id_str = str(row["project_id"]).strip()
        p_name = clean_str(row.get("project_name")) or f"Infrastructure Project {p_id_str}"
        ministry = clean_str(row.get("ministry_department")) or "Ministry of Infrastructure"
        sector = clean_str(row.get("sector")) or "Infrastructure"
        location = clean_str(row.get("state")) or "India"
        agency = clean_str(row.get("agency")) or "Government of India"

        orig_cost = clean_num(row.get("original_cost_crore"), 0.0)
        rev_cost = clean_num(row.get("revised_cost_crore"), orig_cost)
        cum_exp = clean_num(row.get("cumulative_expenditure_crore"), 0.0)
        overrun_pct = clean_num(row.get("cost_overrun_pct"), 0.0)

        phys_prog = clean_num(row.get("physical_progress_pct"), 0.0)
        fin_prog = min(100.0, round((cum_exp / rev_cost * 100), 1)) if rev_cost > 0 else 0.0
        sched_ext = clean_num(row.get("schedule_extension_months"), 0.0)
        sched_status = clean_str(row.get("schedule_status")).upper() or ("DELAYED" if sched_ext > 0 else "ON TRACK")

        if "CRIT" in sched_status:
            sched_status_enum = "CRITICAL"
        elif "DELAY" in sched_status or sched_ext > 0:
            sched_status_enum = "DELAYED"
        else:
            sched_status_enum = "ON TRACK"

        # Risk scoring
        signal_count = clean_num(row.get("risk_signal_count"), 0.0)
        mismatch = clean_num(row.get("progress_expenditure_mismatch_flag"), 0.0)

        cost_risk = int(min(100, max(10, overrun_pct * 1.5 + (20 if mismatch else 0))))
        time_risk = int(min(100, max(10, sched_ext * 2.0 + (30 if sched_status_enum != "ON TRACK" else 0))))
        impl_risk = int(min(100, max(10, signal_count * 18.0 + (25 if mismatch else 0))))
        overall_risk = int(min(98, max(15, (cost_risk * 0.35 + time_risk * 0.40 + impl_risk * 0.25))))

        if overall_risk >= 80 or sched_status_enum == "CRITICAL":
            risk_level = "Critical"
        elif overall_risk >= 65 or sched_status_enum == "DELAYED":
            risk_level = "High"
        elif overall_risk >= 45:
            risk_level = "Medium"
        else:
            risk_level = "Low"

        # Dates
        orig_doc = parse_date_safe(row.get("original_target_doc"))
        rev_doc = parse_date_safe(row.get("revised_doc"))
        if rev_doc == "N/A":
            rev_doc = orig_doc
        start_d = parse_date_safe(row.get("approval_start"))

        cost_overrun_str = f"+{overrun_pct:.1f}% overrun" if overrun_pct > 0 else f"{overrun_pct:.1f}% overrun"

        project_obj = {
            "id": p_id_str,
            "name": p_name,
            "ministry": ministry,
            "sector": sector,
            "location": location,
            "agency": agency,
            "costApproved": f"₹{orig_cost:,.2f} Cr" if orig_cost > 0 else "₹0.00 Cr",
            "costRevised": f"₹{rev_cost:,.2f} Cr" if rev_cost > 0 else "₹0.00 Cr",
            "costExpenditure": f"₹{cum_exp:,.2f} Cr" if cum_exp > 0 else "₹0.00 Cr",
            "costOverrunPct": cost_overrun_str,
            "progressPhysical": round(phys_prog, 1),
            "progressPhysicalTarget": min(100.0, round(phys_prog + (5.0 if sched_status_enum != "ON TRACK" else 0.0), 1)),
            "progressFinancial": round(fin_prog, 1),
            "expectedCompletion": rev_doc if rev_doc != "N/A" else "Ongoing",
            "originalCompletion": orig_doc if orig_doc != "N/A" else "Ongoing",
            "startDate": start_d if start_d != "N/A" else "Baseline",
            "phase": "Completed" if phys_prog >= 100 else "Construction",
            "type": sector,
            "scheduleStatus": sched_status_enum,
            "scheduleExtensionMonths": round(sched_ext, 1),
            "delayDays": int(clean_num(row.get("overdue_days"), 0)),
            "sourceReport": clean_str(row.get("source_report")),
            "asOfDate": clean_str(row.get("report_month")),
            "costLabel": f"₹{rev_cost:,.0f} Cr" if rev_cost > 0 else "₹0 Cr",
            "costSubtext": f"Approved: ₹{orig_cost:,.0f} Cr ({overrun_pct:+.1f}%)" if orig_cost > 0 else "",
            "riskScore": overall_risk,
            "riskLevel": risk_level,
            "description": f"{p_name} is monitored under National Infrastructure PAIMANA framework ({sector}, {ministry}).",
            "costRisk": cost_risk,
            "timeRisk": time_risk,
            "implRisk": impl_risk,
            "overallRisk": overall_risk,
        }
        projects.append(project_obj)

    print(f"Generated {len(projects):,} unique project objects.")

    # Write TypeScript file
    ts_content = f"""// Auto-generated full dataset containing all {len(projects):,} projects from PAIMANA master datasets
// Generated from New_data_2011-jun25.csv and New_data_july2025-may26.csv

export interface Project {{
  id: string;
  name: string;
  ministry: string;
  sector: string;
  location: string;
  agency: string;
  costApproved: string;
  costRevised: string;
  costExpenditure: string;
  costOverrunPct: string;
  progressPhysical: number;
  progressPhysicalTarget: number;
  progressFinancial: number;
  expectedCompletion: string;
  originalCompletion: string;
  startDate: string;
  phase: string;
  type: string;
  scheduleStatus: 'DELAYED' | 'ON TRACK' | 'CRITICAL';
  scheduleExtensionMonths?: number | string;
  delayDays?: number;
  sourceReport?: string;
  asOfDate?: string;
  costLabel: string;
  costSubtext: string;
  riskScore: number; // 0 to 100
  riskLevel: 'Low' | 'Medium' | 'High' | 'Critical';
  description: string;
  costRisk: number;
  timeRisk: number;
  implRisk: number;
  overallRisk: number;
}}

export interface ProjectMilestone {{
  id: number;
  name: string;
  target_date?: string;
  actual_date?: string;
  status: string;
  delay_months?: number;
}}

export interface ProjectBenchmark {{
  project_id: string;
  project_name: string;
  sector_name: string;
  cost_benchmark: Array<{{ label: string; projectVal: string; avg: string; benchmark: string; isAlert?: boolean }}>;
  delay_benchmark: Array<{{ label: string; projectVal: string; avg: string; benchmark: string; isAlert?: boolean }}>;
  tech_benchmark: Array<{{ label: string; projectVal: string; avg: string; benchmark: string; isAlert?: boolean }}>;
  recommendation: string;
}}

export const projectsData: Project[] = {json.dumps(projects, indent=2)};
"""

    OUTPUT_TS.parent.mkdir(parents=True, exist_ok=True)
    with open(OUTPUT_TS, "w", encoding="utf-8") as f:
        f.write(ts_content)

    print(f"Successfully wrote {len(projects):,} projects to {OUTPUT_TS}!")


if __name__ == "__main__":
    generate_projects_data()
