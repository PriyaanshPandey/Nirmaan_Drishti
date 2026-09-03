"""
Generate complete projectsData.ts containing all 3,361 projects from PAIMANA_Master.csv.
Ensures zero hardcoding in frontend portfolio and offline fallback modes.
"""
import sys
import json
from pathlib import Path
import pandas as pd
import numpy as np

BACKEND_DIR = Path(__file__).resolve().parent.parent
ROOT_DIR = BACKEND_DIR.parent
CSV_PATH = ROOT_DIR / "data" / "raw" / "PAIMANA_Master.csv"
OUTPUT_TS = ROOT_DIR / "frontend" / "src" / "data" / "projectsData.ts"

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

def generate_projects_data():
    if not CSV_PATH.exists():
        print(f"Error: CSV not found at {CSV_PATH}")
        sys.exit(1)

    print(f"Reading CSV from {CSV_PATH}...")
    df = pd.read_csv(CSV_PATH, low_memory=False)
    print(f"Loaded {len(df):,} rows.")

    df["report_month_parsed"] = pd.to_datetime(df["report_month"], errors='coerce')
    grouped = df.sort_values(by=["project_id", "report_month_parsed"]).groupby("project_id")

    projects = []
    
    for p_id, p_rows in grouped:
        latest = p_rows.iloc[-1]
        p_id_str = str(p_id).strip()
        p_name = clean_str(latest.get("project_name")) or f"Infrastructure Project {p_id_str}"
        ministry = clean_str(latest.get("ministry_department")) or "Ministry of Infrastructure"
        sector = clean_str(latest.get("sector")) or "Infrastructure"
        location = clean_str(latest.get("state")) or "India"
        agency = clean_str(latest.get("agency")) or "Government of India"

        orig_cost = clean_num(latest.get("original_cost_crore"), 0.0)
        rev_cost = clean_num(latest.get("revised_cost_crore"), orig_cost)
        cum_exp = clean_num(latest.get("cumulative_expenditure_crore"), 0.0)
        overrun_pct = clean_num(latest.get("cost_overrun_pct"), 0.0)

        phys_prog = clean_num(latest.get("physical_progress_pct"), 0.0)
        fin_prog = min(100.0, round((cum_exp / rev_cost * 100), 1)) if rev_cost > 0 else 0.0
        sched_ext = clean_num(latest.get("schedule_extension_months"), 0.0)
        sched_status = clean_str(latest.get("schedule_status")).upper() or ("DELAYED" if sched_ext > 0 else "ON TRACK")

        if "CRIT" in sched_status:
            sched_status_enum = "CRITICAL"
        elif "DELAY" in sched_status or sched_ext > 0:
            sched_status_enum = "DELAYED"
        else:
            sched_status_enum = "ON TRACK"

        # Risk scoring
        signal_count = clean_num(latest.get("risk_signal_count"), 0.0)
        mismatch = clean_num(latest.get("progress_expenditure_mismatch_flag"), 0.0)

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
        orig_doc = clean_str(latest.get("original_target_doc")) or "N/A"
        rev_doc = clean_str(latest.get("revised_doc")) or orig_doc
        start_d = clean_str(latest.get("approval_start")) or "N/A"

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
    ts_content = f"""// Auto-generated full dataset containing all {len(projects):,} projects from PAIMANA_Master.csv

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
