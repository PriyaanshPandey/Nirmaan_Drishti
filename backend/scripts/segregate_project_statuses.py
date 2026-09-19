"""
segregate_project_statuses.py
Synchronizes and segregates all infrastructure projects in PostgreSQL according to the
three authoritative master CSV datasets:
  1. Ongoing Projects (1,379) -> ai/data/input/ongoing project detail.csv
  2. Inactive / Stopped Projects (2,328) -> ai/data/input/Ongoing_2328_Non_Active_Projects_Master.csv
  3. Completed Projects (1,442) -> ai/data/input/Completed_Projects_2001_to_May_2026.csv
"""

import sys
import re
from pathlib import Path
from datetime import datetime, date
import pandas as pd
from sqlalchemy import text

BACKEND_DIR = Path(__file__).resolve().parent.parent
WORKSPACE_ROOT = BACKEND_DIR.parent
sys.path.insert(0, str(BACKEND_DIR))

from app.database import SessionLocal, engine
from app.models.project import Project
from app.models.ministry import Ministry
from app.models.sector import Sector


def clean_num(val, default=0.0):
    if pd.isna(val) or val is None:
        return default
    if isinstance(val, (int, float)):
        return float(val)
    s = str(val).replace(",", "").replace("₹", "").replace("%", "").strip()
    try:
        return float(s)
    except (ValueError, TypeError):
        return default


def parse_date_safe(val):
    if pd.isna(val) or val is None:
        return None
    s = str(val).strip()
    if not s or s.lower() in ("nan", "none", "null", "n/a", "nat"):
        return None
    m = re.match(r"^(\d{1,2})[/.-](\d{4})$", s)
    if m:
        month = int(m.group(1))
        year = int(m.group(2))
        try:
            return date(year, max(1, min(12, month)), 1)
        except Exception:
            pass
    for fmt in ("%B %Y", "%b %Y", "%Y-%m-%d", "%d/%m/%Y", "%m/%d/%Y"):
        try:
            dt = datetime.strptime(s, fmt)
            return dt.date()
        except Exception:
            continue
    return None


def run_segregation():
    print("=" * 75)
    print("NIRMAAN DRISHTI: MASTER PROJECT STATUS SEGREGATION & SEEDING")
    print("=" * 75)

    act_path = WORKSPACE_ROOT / "ai" / "data" / "input" / "ongoing project detail.csv"
    non_path = WORKSPACE_ROOT / "ai" / "data" / "input" / "Ongoing_2328_Non_Active_Projects_Master.csv"
    comp_path = WORKSPACE_ROOT / "ai" / "data" / "input" / "Completed_Projects_2001_to_May_2026.csv"

    if not act_path.exists():
        act_path = WORKSPACE_ROOT / "data" / "Ongoing_Project_Detail.csv"
    if not non_path.exists():
        non_path = WORKSPACE_ROOT / "data" / "Ongoing_2328_Non_Active_Projects_Master (1).csv"

    print(f"1. Loading Ongoing Active: {act_path.name}")
    df_act = pd.read_csv(act_path, low_memory=False)
    act_pids = set(df_act["project_id"].dropna().astype(str).str.strip())
    print(f"   -> Found {len(act_pids):,} unique project IDs.")

    print(f"2. Loading Ongoing Non-Active: {non_path.name}")
    df_non = pd.read_csv(non_path, low_memory=False)
    non_pids = set(df_non["project_id"].dropna().astype(str).str.strip())
    print(f"   -> Found {len(non_pids):,} unique project IDs.")

    print(f"3. Loading Completed Projects: {comp_path.name}")
    df_comp = pd.read_csv(comp_path, low_memory=False)
    print(f"   -> Found {len(df_comp):,} completed project rows.")

    db = SessionLocal()

    # Build Ministry and Sector lookups
    min_map = {m.name.upper(): m.id for m in db.query(Ministry).all()}
    sec_map = {s.name.upper(): s.id for s in db.query(Sector).all()}

    def resolve_min_sec(dept_str):
        if not dept_str or pd.isna(dept_str):
            return None, None
        dept_clean = str(dept_str).strip().upper()
        m_id = min_map.get(dept_clean)
        s_id = sec_map.get(dept_clean)
        if not m_id:
            for k, v in min_map.items():
                if k in dept_clean or dept_clean in k:
                    m_id = v
                    break
        if not s_id:
            for k, v in sec_map.items():
                if k in dept_clean or dept_clean in k:
                    s_id = v
                    break
        return m_id, s_id

    # Reset all project statuses first
    comp_pids = set(df_comp["project_id"].dropna().astype(str).str.strip())

    print("\n[1/3] Tagging exactly 1,379 Ongoing and 2,328 Inactive projects...")
    all_db = db.query(Project).all()
    existing_ids = set(p.id for p in all_db)

    # First pass: tag everything as ARCHIVED by default
    for p in all_db:
        p.project_status = "ARCHIVED"

    # Tag ONGOING
    ongoing_count = 0
    for p in all_db:
        if str(p.id).strip() in act_pids:
            p.project_status = "ONGOING"
            ongoing_count += 1

    # Tag INACTIVE
    inactive_count = 0
    for p in all_db:
        pid = str(p.id).strip()
        if p.project_status != "ONGOING" and pid in non_pids:
            p.project_status = "INACTIVE"
            inactive_count += 1

    # Seed any of the 2,328 non-active that were not directly present as Project.id
    missing_non = non_pids - set(p.id for p in all_db if p.project_status == "INACTIVE")
    if missing_non:
        print(f"   Seeding {len(missing_non)} missing inactive project rows...")
        new_inactives = []
        for pid in missing_non:
            sub_df = df_non[df_non["project_id"].astype(str).str.strip() == pid]
            if sub_df.empty:
                continue
            r = sub_df.iloc[-1]
            pname = str(r.get("project_name", "")).strip() or f"Project {pid}"
            dept = str(r.get("ministry_department", "")).strip()
            m_id, s_id = resolve_min_sec(dept)
            orig_cost = clean_num(r.get("Original cost ( Cr)"), 0.0)
            rev_cost = clean_num(r.get("revised cost ( Cr)"), orig_cost)
            ant_cost = clean_num(r.get("Anticipated cost ( Cr)"), rev_cost)
            cum_exp = clean_num(r.get("cumulative expenditure ( Cr)"), 0.0)
            prog = clean_num(r.get("physical progress"), 0.0)
            target_id = str(pid)
            if target_id in existing_ids:
                target_id = f"{target_id}-NONACT"

            new_inactives.append(Project(
                id=target_id,
                project_code=str(pid),
                legacy_ocms_code=str(pid),
                name=pname,
                description=f"{pname} discontinued/inactive infrastructure asset monitored under PAIMANA.",
                ministry_id=m_id,
                sector_id=s_id,
                location=str(r.get("state", "India")),
                state=str(r.get("state", "India")),
                district=str(r.get("state", "India")),
                implementing_agency=dept if dept else "Government of India",
                phase="Stalled / Non-Active",
                type="Infrastructure",
                project_status="INACTIVE",
                schedule_status="DELAYED",
                original_cost=orig_cost,
                revised_cost=ant_cost or rev_cost or orig_cost,
                cumulative_expenditure=cum_exp,
                physical_progress=prog,
                risk_score=60,
                risk_level="Medium",
                source_report="Ongoing_2328_Non_Active_Projects_Master.csv",
            ))
            existing_ids.add(target_id)
            inactive_count += 1
        if new_inactives:
            db.bulk_save_objects(new_inactives)
            db.commit()

    # Tag COMPLETED (1,442)
    print("\n[2/3] Tagging and seeding exactly 1,442 Completed projects...")
    # Tag existing records from df_comp
    completed_count = 0
    tagged_comp_pids = set()
    for p in all_db:
        pid = str(p.id).strip()
        if p.project_status == "ARCHIVED" and pid in comp_pids:
            p.project_status = "COMPLETED"
            p.physical_progress = 100.0
            p.schedule_status = "COMPLETED"
            completed_count += 1
            tagged_comp_pids.add(pid)

    # Also include previously seeded completed projects
    for p in all_db:
        if p.project_status == "ARCHIVED" and p.source_report == "Completed_Projects_2001_to_May_2026.csv":
            p.project_status = "COMPLETED"
            completed_count += 1
            tagged_comp_pids.add(str(p.id).strip())

    # Seed remaining to reach exactly 1,442
    needed_completed = len(df_comp) - completed_count
    if needed_completed > 0:
        print(f"   Seeding {needed_completed} remaining completed rows from CSV...")
        new_comps = []
        comp_seq = 1
        for idx, row in df_comp.iterrows():
            if completed_count >= len(df_comp):
                break
            raw_pid = str(row.get("project_id", "")).strip() if pd.notna(row.get("project_id")) else ""
            if raw_pid and raw_pid in tagged_comp_pids:
                continue

            pname = str(row.get("project_name", "")).strip() or f"Completed Project {idx+1}"
            target_id = raw_pid if raw_pid and raw_pid not in existing_ids else f"COMP-{comp_seq:04d}"
            while target_id in existing_ids:
                comp_seq += 1
                target_id = f"COMP-{comp_seq:04d}"
            comp_seq += 1
            existing_ids.add(target_id)
            tagged_comp_pids.add(target_id)

            dept = str(row.get("ministry_department", "")).strip()
            m_id, s_id = resolve_min_sec(dept)
            orig_cost = clean_num(row.get("Original cost ( Cr)"), 0.0)
            rev_cost = clean_num(row.get("revised cost ( Cr)"), orig_cost)
            ant_cost = clean_num(row.get("Anticipated cost ( Cr)"), rev_cost)
            final_cost = ant_cost if ant_cost > 0 else (rev_cost if rev_cost > 0 else orig_cost)
            cum_exp = clean_num(row.get("cumulative expenditure ( Cr)"), final_cost)

            start_d = parse_date_safe(row.get("Date of approval"))
            orig_doc = parse_date_safe(row.get("original DOC"))
            act_doc = parse_date_safe(row.get("latest commissioning date")) or orig_doc

            state_val = str(row.get("state", "")).strip() if pd.notna(row.get("state")) else "India"
            if not state_val or state_val.lower() == "nan":
                state_val = "India"

            new_comps.append(Project(
                id=target_id,
                project_code=raw_pid if raw_pid else target_id,
                name=pname,
                description=f"{pname} completed infrastructure asset monitored under PAIMANA.",
                ministry_id=m_id,
                sector_id=s_id,
                location=state_val,
                state=state_val,
                district=state_val,
                implementing_agency=dept if dept else "Government of India",
                phase="Completed",
                type="Completed Infrastructure",
                project_status="COMPLETED",
                schedule_status="COMPLETED",
                start_date=start_d,
                original_completion_date=orig_doc,
                expected_completion_date=act_doc,
                actual_completion_date=act_doc,
                original_cost=orig_cost,
                revised_cost=final_cost,
                cumulative_expenditure=cum_exp,
                physical_progress=100.0,
                physical_progress_target=100.0,
                financial_progress=100.0,
                delay_days=0,
                risk_score=15,
                risk_level="Low",
                source_report="Completed_Projects_2001_to_May_2026.csv",
            ))
            completed_count += 1

        if new_comps:
            db.bulk_save_objects(new_comps)

    db.commit()

    # Step 3: Final Verification
    print("\n[3/3] Final Database State & Category Reconciliation:")
    count_ongoing = db.query(Project).filter(Project.project_status == "ONGOING").count()
    count_inactive = db.query(Project).filter(Project.project_status == "INACTIVE").count()
    count_completed = db.query(Project).filter(Project.project_status == "COMPLETED").count()
    count_archived = db.query(Project).filter(Project.project_status == "ARCHIVED").count()
    total_active_assets = count_ongoing + count_inactive + count_completed

    print("-" * 60)
    print(f"  ONGOING PROJECTS          : {count_ongoing:>6,}")
    print(f"  COMPLETED PROJECTS        : {count_completed:>6,}")
    print(f"  INACTIVE / STOPPED PROJECTS: {count_inactive:>6,}")
    print(f"  Total Segregated Assets    : {total_active_assets:>6,}")
    print(f"  (Archived legacy records)  : {count_archived:>6,}")
    print("-" * 60)

    db.close()
    print("STATUS SEGREGATION COMPLETED SUCCESSFULLY!\n")


if __name__ == "__main__":
    run_segregation()
