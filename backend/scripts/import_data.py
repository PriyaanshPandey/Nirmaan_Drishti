"""
Robust CSV Data Import Pipeline.
Loads PAIMANA master dataset into the PostgreSQL national_infrastructure database.
Handles ministries, sectors, projects, progress time-series snapshots, and milestones.
"""
import os
import sys
from pathlib import Path
from datetime import datetime, date
import pandas as pd
import numpy as np

# Add backend directory to sys.path
BACKEND_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BACKEND_DIR))

from app.database import SessionLocal, engine
from app.models.ministry import Ministry
from app.models.sector import Sector
from app.models.project import Project
from app.models.progress import ProjectProgress
from app.models.milestone import Milestone
from app.audit import log_audit_event

# Candidate data paths
CANDIDATE_PATHS = [
    BACKEND_DIR.parent / "data" / "raw" / "PAIMANA_Master.csv",
    BACKEND_DIR.parent / "ai" / "data" / "input" / "PAIMANA_Master.csv",
]


def parse_date_safe(val) -> date | None:
    """Safely parse various date formats into datetime.date."""
    if pd.isna(val) or val is None or str(val).strip() == "":
        return None
    val_str = str(val).strip()
    # Try ISO format YYYY-MM-DD
    for fmt in ("%Y-%m-%d", "%Y-%m", "%d/%m/%Y", "%m/%Y", "%Y/%m/%d", "%b-%y", "%d-%b-%y"):
        try:
            return datetime.strptime(val_str, fmt).date()
        except ValueError:
            pass
    try:
        dt = pd.to_datetime(val_str)
        return dt.date()
    except Exception:
        return None


def clean_num(val, default=0.0) -> float:
    """Safely convert numeric values."""
    if pd.isna(val) or val is None:
        return default
    try:
        v = float(val)
        return default if np.isnan(v) or np.isinf(v) else v
    except (ValueError, TypeError):
        return default


def clean_str(val, max_len=255) -> str | None:
    """Safely clean string values."""
    if pd.isna(val) or val is None:
        return None
    s = str(val).strip()
    return s[:max_len] if s else None


def calculate_project_risk(row) -> tuple[int, str, int, int, int, int]:
    """
    Compute structured risk score (0-100), risk level, and sub-risk components.
    """
    overrun_pct = clean_num(row.get("cost_overrun_pct"), 0.0)
    delay_months = clean_num(row.get("schedule_extension_months"), 0.0)
    signal_count = clean_num(row.get("risk_signal_count"), 0.0)
    mismatch = clean_num(row.get("progress_expenditure_mismatch_flag"), 0.0)
    sched_status = str(row.get("schedule_status", "")).upper()

    # Cost Risk (0-100)
    cost_risk = int(min(100, max(10, overrun_pct * 1.5 + (20 if mismatch else 0))))

    # Time Risk (0-100)
    time_risk = int(min(100, max(10, delay_months * 2.0 + (30 if "DELAY" in sched_status or "CRIT" in sched_status else 0))))

    # Implementation Risk (0-100)
    impl_risk = int(min(100, max(10, signal_count * 18.0 + (25 if mismatch else 0))))

    # Overall Combined Risk Score (0-100)
    overall_score = int(min(98, max(15, (cost_risk * 0.35 + time_risk * 0.40 + impl_risk * 0.25))))

    if overall_score >= 80 or "CRIT" in sched_status:
        risk_level = "Critical"
    elif overall_score >= 65 or "DELAY" in sched_status:
        risk_level = "High"
    elif overall_score >= 45 or "EXTEND" in sched_status:
        risk_level = "Medium"
    else:
        risk_level = "Low"

    return overall_score, risk_level, cost_risk, time_risk, impl_risk, overall_score


def run_import():
    """Main data import pipeline."""
    csv_path = None
    for p in CANDIDATE_PATHS:
        if p.exists():
            csv_path = p
            break

    if not csv_path:
        print(f"ERROR: Could not find PAIMANA_Master.csv in candidate paths: {[str(p) for p in CANDIDATE_PATHS]}")
        sys.exit(1)

    print(f"Loading data from: {csv_path} ({csv_path.stat().st_size:,} bytes)...")
    df = pd.read_csv(csv_path, low_memory=False)
    print(f"Loaded CSV with {len(df):,} rows and {len(df.columns)} columns.")

    db = SessionLocal()
    try:
        # Step 1: Import Ministries
        print("\n[1/5] Processing Ministries...")
        raw_ministries = df["ministry_department"].dropna().unique()
        ministry_cache = {}
        for m_name in raw_ministries:
            clean_m = clean_str(m_name, 255)
            if not clean_m:
                continue
            existing = db.query(Ministry).filter(Ministry.name == clean_m).first()
            if not existing:
                code_cand = "".join([w[0] for w in clean_m.split() if w[0].isalnum()])[:10].upper()
                existing = Ministry(name=clean_m, code=code_cand, description=clean_m)
                db.add(existing)
                db.flush()
            ministry_cache[clean_m] = existing.id
        db.commit()
        print(f"  Processed {len(ministry_cache)} ministries.")

        # Step 2: Import Sectors
        print("\n[2/5] Processing Sectors...")
        raw_sectors = df["sector"].dropna().unique()
        sector_cache = {}
        for s_name in raw_sectors:
            clean_s = clean_str(s_name, 255)
            if not clean_s:
                continue
            existing = db.query(Sector).filter(Sector.name == clean_s).first()
            if not existing:
                code_cand = "".join([w[0] for w in clean_s.split() if w[0].isalnum()])[:10].upper()
                existing = Sector(name=clean_s, code=code_cand, description=clean_s)
                db.add(existing)
                db.flush()
            sector_cache[clean_s] = existing.id
        db.commit()
        print(f"  Processed {len(sector_cache)} sectors.")

        # Step 3: Group by Project and identify latest record
        print("\n[3/5] Processing Projects...")
        df["report_month_parsed"] = pd.to_datetime(df["report_month"], errors='coerce')
        grouped = df.sort_values(by=["project_id", "report_month_parsed"]).groupby("project_id")

        existing_project_ids = set(r[0] for r in db.query(Project.id).all())
        imported_projects = 0
        updated_projects = 0

        for p_id, p_rows in grouped:
            latest_row = p_rows.iloc[-1]
            p_id_str = str(p_id).strip()
            p_name = clean_str(latest_row.get("project_name"), 500) or f"Infrastructure Project {p_id_str}"
            m_id = ministry_cache.get(clean_str(latest_row.get("ministry_department")))
            s_id = sector_cache.get(clean_str(latest_row.get("sector")))

            start_d = parse_date_safe(latest_row.get("approval_start"))
            orig_doc = parse_date_safe(latest_row.get("original_target_doc"))
            rev_doc = parse_date_safe(latest_row.get("revised_doc"))

            orig_cost = clean_num(latest_row.get("original_cost_crore"), 0.0)
            rev_cost = clean_num(latest_row.get("revised_cost_crore"), orig_cost)
            cum_exp = clean_num(latest_row.get("cumulative_expenditure_crore"), 0.0)
            overrun_pct = clean_num(latest_row.get("cost_overrun_pct"), 0.0)
            cost_esc = clean_num(latest_row.get("cost_escalation_crore"), max(0.0, rev_cost - orig_cost))
            exp_ratio = clean_num(latest_row.get("expenditure_ratio_pct"), (cum_exp / rev_cost * 100) if rev_cost > 0 else 0.0)

            phys_prog = clean_num(latest_row.get("physical_progress_pct"), 0.0)
            sched_ext = clean_num(latest_row.get("schedule_extension_months"), 0.0)
            sched_status = clean_str(latest_row.get("schedule_status"), 50) or ("DELAYED" if sched_ext > 0 else "ON TRACK")

            risk_score, risk_lvl, cost_r, time_r, impl_r, over_r = calculate_project_risk(latest_row)

            # Check if project exists
            if p_id_str not in existing_project_ids:
                project = Project(
                    id=p_id_str,
                    project_code=clean_str(latest_row.get("project_key"), 100) or p_id_str,
                    name=p_name,
                    description=f"{p_name} monitored under National Infrastructure PAIMANA framework.",
                    ministry_id=m_id,
                    sector_id=s_id,
                    location=clean_str(latest_row.get("state"), 500),
                    state=clean_str(latest_row.get("state"), 255),
                    implementing_agency=clean_str(latest_row.get("agency"), 255),
                    project_status="COMPLETED" if phys_prog >= 100 else "ACTIVE",
                    schedule_status=sched_status,
                    start_date=start_d,
                    original_completion_date=orig_doc,
                    expected_completion_date=rev_doc or orig_doc,
                    project_age_months=clean_num(latest_row.get("project_age_months")),
                    schedule_extension_months=sched_ext,
                    delay_days=int(clean_num(latest_row.get("overdue_days"), 0)),
                    original_cost=orig_cost,
                    revised_cost=rev_cost,
                    cumulative_expenditure=cum_exp,
                    cost_overrun_pct=overrun_pct,
                    cost_escalation_crore=cost_esc,
                    expenditure_ratio_pct=exp_ratio,
                    physical_progress=phys_prog,
                    financial_progress=min(100.0, exp_ratio),
                    risk_score=risk_score,
                    risk_level=risk_lvl,
                    cost_risk=cost_r,
                    time_risk=time_r,
                    impl_risk=impl_r,
                    overall_risk=over_r,
                    source_report=clean_str(latest_row.get("source_report"), 255)
                )
                db.add(project)
                existing_project_ids.add(p_id_str)
                imported_projects += 1
            else:
                updated_projects += 1

            if imported_projects > 0 and imported_projects % 100 == 0:
                db.commit()

        db.commit()
        print(f"  Inserted {imported_projects:,} new projects, updated {updated_projects:,} existing projects.")

        # Step 4: Import Progress Snapshots
        print("\n[4/5] Processing Monthly Progress Snapshots...")
        existing_progress_keys = set((r[0], r[1]) for r in db.query(ProjectProgress.project_id, ProjectProgress.reporting_date).all())
        progress_records_count = 0
        for idx, row in df.iterrows():
            p_id_str = str(row["project_id"]).strip()
            rep_date = parse_date_safe(row.get("report_month"))
            if not rep_date:
                continue

            if (p_id_str, rep_date) not in existing_progress_keys:
                prog = ProjectProgress(
                    project_id=p_id_str,
                    reporting_date=rep_date,
                    report_month_str=clean_str(row.get("report_month"), 20),
                    physical_progress=clean_num(row.get("physical_progress_pct"), 0.0),
                    financial_progress=clean_num(row.get("expenditure_ratio_pct"), 0.0),
                    cumulative_expenditure=clean_num(row.get("cumulative_expenditure_crore"), 0.0),
                    revised_cost=clean_num(row.get("revised_cost_crore"), None),
                    cost_overrun_pct=clean_num(row.get("cost_overrun_pct"), 0.0),
                    schedule_extension_months=clean_num(row.get("schedule_extension_months"), 0.0),
                    overdue_days=int(clean_num(row.get("overdue_days"), 0)),
                    schedule_status=clean_str(row.get("schedule_status"), 50),
                    physical_progress_delta_1m=clean_num(row.get("physical_progress_delta_1m"), None),
                    cost_overrun_delta_1m=clean_num(row.get("cost_overrun_delta_1m"), None),
                    expenditure_ratio_delta_1m=clean_num(row.get("expenditure_ratio_delta_1m"), None),
                    risk_signal_count=int(clean_num(row.get("risk_signal_count"), 0))
                )
                db.add(prog)
                existing_progress_keys.add((p_id_str, rep_date))
                progress_records_count += 1

            if progress_records_count > 0 and progress_records_count % 500 == 0:
                db.commit()

        db.commit()
        print(f"  Inserted {progress_records_count:,} progress snapshot records.")

        # Step 5: Generate Standard Project Milestones
        print("\n[5/5] Generating Project Milestones...")
        milestones_count = 0
        all_projects = db.query(Project).limit(500).all()
        for p in all_projects:
            existing_m = db.query(Milestone).filter(Milestone.project_id == p.id).first()
            if not existing_m:
                # Add default standard milestone stages
                m1 = Milestone(project_id=p.id, name="Detailed Project Report (DPR) & Approval", status="completed", completion_percentage=100.0, planned_date=p.start_date)
                m2 = Milestone(project_id=p.id, name="Land Acquisition & Environmental NOC", status="completed" if float(p.physical_progress) > 30 else "in_progress", completion_percentage=100.0 if float(p.physical_progress) > 30 else float(p.physical_progress) * 2.5)
                m3 = Milestone(project_id=p.id, name="Civil Construction & Structural Works", status="in_progress" if float(p.physical_progress) < 85 else "completed", completion_percentage=float(p.physical_progress))
                m4 = Milestone(project_id=p.id, name="Systems Integration & Trial Runs", status="pending" if float(p.physical_progress) < 80 else "in_progress", completion_percentage=max(0.0, (float(p.physical_progress) - 80) * 5), planned_date=p.expected_completion_date)
                m5 = Milestone(project_id=p.id, name="Final Commissioning & Handover", status="completed" if float(p.physical_progress) >= 100 else "pending", completion_percentage=100.0 if float(p.physical_progress) >= 100 else 0.0, planned_date=p.expected_completion_date)
                db.add_all([m1, m2, m3, m4, m5])
                milestones_count += 5

        db.commit()
        print(f"  Generated {milestones_count:,} milestone records for top projects.")

        # Log audit entry
        log_audit_event(
            db=db,
            action="IMPORT_DATA",
            entity_type="system",
            entity_id="PAIMANA_Master.csv",
            new_value={"imported_projects": imported_projects, "snapshots": progress_records_count}
        )

        print("\n" + "=" * 60)
        print("DATA IMPORT SUCCESSFULLY COMPLETED!")
        print(f"Total Projects in Database: {db.query(Project).count():,}")
        print(f"Total Ministries in Database: {db.query(Ministry).count():,}")
        print(f"Total Sectors in Database: {db.query(Sector).count():,}")
        print(f"Total Progress Snapshots: {db.query(ProjectProgress).count():,}")
        print(f"Total Milestones: {db.query(Milestone).count():,}")
        print("=" * 60)

    except Exception as e:
        print(f"\nERROR during data import: {e}")
        db.rollback()
        raise e
    finally:
        db.close()


if __name__ == "__main__":
    run_import()
