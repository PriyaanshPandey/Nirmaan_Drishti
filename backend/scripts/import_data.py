"""
Robust CSV Data Import Pipeline for Nirmaan Drishti / Sanket-AI.
Loads the complete historical and current dataset from both master CSVs:
  1. New_data_2011-jun25.csv (2011 to June 2025)
  2. New_data_july2025-may26.csv (July 2025 to May 2026)
Loads into PostgreSQL:
  - Ministries & Sectors
  - Projects (6,500+ projects with latest accurate operational status)
  - ProjectProgress (238,000+ monthly progress time-series snapshots)
  - Standard Milestones
"""
import os
import sys
import time
from pathlib import Path
from datetime import datetime, date
import pandas as pd
import numpy as np
from psycopg2.extras import execute_values

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

INPUT_DIRS = [
    BACKEND_DIR.parent / "data" / "input",
    BACKEND_DIR.parent / "ai" / "data" / "input",
    BACKEND_DIR.parent / "data",
]


def find_csv_files() -> tuple[Path, Path]:
    """Locate both CSV files across candidate input directories."""
    f1, f2 = None, None
    for d in INPUT_DIRS:
        c1 = d / "New_data_2011-jun25.csv"
        c2 = d / "New_data_july2025-may26.csv"
        if not f1 and c1.exists():
            f1 = c1
        if not f2 and c2.exists():
            f2 = c2

    if not f1 or not f2:
        raise FileNotFoundError(
            f"Could not find both CSVs in {[str(d) for d in INPUT_DIRS]}.\n"
            f"Found file1: {f1}, file2: {f2}"
        )
    return f1, f2


def parse_date_safe(val) -> date | None:
    """Safely parse diverse date formats into datetime.date."""
    if pd.isna(val) or val is None or str(val).strip() == "":
        return None
    val_str = str(val).strip()
    for fmt in (
        "%Y-%m-%d", "%d-%m-%Y", "%Y-%m", "%d/%m/%Y", "%m/%Y",
        "%Y/%m/%d", "%b-%y", "%d-%b-%y", "%B %Y", "%b %Y"
    ):
        try:
            return datetime.strptime(val_str, fmt).date()
        except ValueError:
            pass
    try:
        dt = pd.to_datetime(val_str, dayfirst=True)
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


def calculate_project_risk(row: dict) -> tuple[int, str, int, int, int, int]:
    """Compute structured risk scores (0-100), risk tier, and sub-risk factors."""
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
    """Execute complete multi-dataset ingestion into PostgreSQL."""
    start_time = time.time()
    csv1_path, csv2_path = find_csv_files()
    print("=" * 70, flush=True)
    print("NIRMAAN DRISHTI / SANKET-AI: MASTER DATASET INGESTION", flush=True)
    print("=" * 70, flush=True)
    print(f"Dataset 1 (2011-Jun 2025): {csv1_path} ({csv1_path.stat().st_size / (1024*1024):.1f} MB)", flush=True)
    print(f"Dataset 2 (Jul 2025-May 2026): {csv2_path} ({csv2_path.stat().st_size / (1024*1024):.1f} MB)", flush=True)

    # Read both CSVs
    print("\nReading CSV files...", flush=True)
    df1 = pd.read_csv(csv1_path, low_memory=False)
    print(f"  Loaded Dataset 1: {len(df1):,} rows, {len(df1.columns)} columns.", flush=True)
    df2 = pd.read_csv(csv2_path, low_memory=False)
    print(f"  Loaded Dataset 2: {len(df2):,} rows, {len(df2.columns)} columns.", flush=True)

    # Standardize project identifiers
    df1["project_id"] = df1["project_id"].astype(str).str.strip()
    if "project_code" in df2.columns:
        df2["project_id"] = df2["project_code"].fillna(df2.get("project_key", "")).astype(str).str.strip()
    else:
        df2["project_id"] = df2["project_key"].astype(str).str.strip()

    # Drop any invalid empty project_ids
    df1 = df1[df1["project_id"].str.len() > 0]
    df2 = df2[df2["project_id"].str.len() > 0]

    # Combine dataframes
    print("\nCombining datasets...", flush=True)
    combined_df = pd.concat([df1, df2], ignore_index=True)
    print(f"  Total combined records: {len(combined_df):,}", flush=True)

    combined_df["_rep_dt"] = pd.to_datetime(combined_df["report_month"], errors="coerce", dayfirst=True)
    combined_df.sort_values(by=["project_id", "_rep_dt"], inplace=True)

    db = SessionLocal()
    raw_conn = engine.raw_connection()
    raw_cur = raw_conn.cursor()

    try:
        # Step 1: Ministries
        print("\n[1/5] Ingesting Ministries...", flush=True)
        raw_ministries = combined_df["ministry_department"].dropna().unique()
        existing_ministries = {m.name: m.id for m in db.query(Ministry).all()}
        new_ministries = 0

        for m_name in raw_ministries:
            clean_m = clean_str(m_name, 255)
            if not clean_m or clean_m in existing_ministries:
                continue
            code_cand = "".join([w[0] for w in clean_m.split() if w[0].isalnum()])[:10].upper()
            m_obj = Ministry(name=clean_m, code=code_cand, description=clean_m)
            db.add(m_obj)
            db.flush()
            existing_ministries[clean_m] = m_obj.id
            new_ministries += 1

        db.commit()
        print(f"  Ministries total: {len(existing_ministries)} (added {new_ministries} new).", flush=True)

        # Step 2: Sectors
        print("\n[2/5] Ingesting Sectors...", flush=True)
        raw_sectors = combined_df["sector"].dropna().unique()
        existing_sectors = {s.name: s.id for s in db.query(Sector).all()}
        new_sectors = 0

        for s_name in raw_sectors:
            clean_s = clean_str(s_name, 255)
            if not clean_s or clean_s in existing_sectors:
                continue
            code_cand = "".join([w[0] for w in clean_s.split() if w[0].isalnum()])[:10].upper()
            s_obj = Sector(name=clean_s, code=code_cand, description=clean_s)
            db.add(s_obj)
            db.flush()
            existing_sectors[clean_s] = s_obj.id
            new_sectors += 1

        db.commit()
        print(f"  Sectors total: {len(existing_sectors)} (added {new_sectors} new).", flush=True)

        # Step 3: Projects (Latest State per Project via fast drop_duplicates)
        print("\n[3/5] Ingesting Projects (Extracting latest status for every project)...", flush=True)
        latest_df = combined_df.drop_duplicates(subset=["project_id"], keep="last")
        total_unique_projects = len(latest_df)
        print(f"  Identified {total_unique_projects:,} unique projects across both datasets.", flush=True)

        project_records = []
        now_dt = datetime.now()

        latest_dict_rows = latest_df.to_dict("records")
        for latest_row in latest_dict_rows:
            p_id_str = str(latest_row["project_id"]).strip()
            p_name = clean_str(latest_row.get("project_name"), 500) or f"Infrastructure Project {p_id_str}"
            p_code = clean_str(latest_row.get("project_key") or latest_row.get("project_code"), 100) or p_id_str

            m_id = existing_ministries.get(clean_str(latest_row.get("ministry_department")))
            s_id = existing_sectors.get(clean_str(latest_row.get("sector")))

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
            target_prog = clean_num(latest_row.get("physical_progress_target"), 100.0)
            sched_ext = clean_num(latest_row.get("schedule_extension_months"), 0.0)
            sched_status = clean_str(latest_row.get("schedule_status"), 50) or ("DELAYED" if sched_ext > 0 else "ON TRACK")

            risk_score, risk_lvl, cost_r, time_r, impl_r, over_r = calculate_project_risk(latest_row)

            is_completed = (phys_prog >= 100.0) or ("COMPLETED" in sched_status)
            proj_status = "COMPLETED" if is_completed else "ACTIVE"
            actual_doc = (rev_doc or orig_doc) if is_completed else None
            legacy_ocms = clean_str(latest_row.get("legacy_ocms_code"), 100)

            project_records.append((
                p_id_str,
                p_code,
                legacy_ocms,
                p_name,
                f"{p_name} monitored under National Infrastructure PAIMANA framework.",
                m_id,
                s_id,
                clean_str(latest_row.get("state"), 500),
                clean_str(latest_row.get("state"), 255),
                clean_str(latest_row.get("agency"), 255),
                proj_status,
                sched_status,
                start_d,
                orig_doc,
                rev_doc or orig_doc,
                actual_doc,
                clean_num(latest_row.get("project_age_months")),
                sched_ext,
                int(clean_num(latest_row.get("overdue_days"), 0)),
                orig_cost,
                rev_cost,
                cum_exp,
                overrun_pct,
                cost_esc,
                exp_ratio,
                phys_prog,
                target_prog,
                min(100.0, exp_ratio),
                risk_score,
                risk_lvl,
                cost_r,
                time_r,
                impl_r,
                over_r,
                clean_str(latest_row.get("source_report"), 255),
                now_dt,
                now_dt
            ))

        # Bulk upsert projects into PostgreSQL
        project_upsert_sql = """
        INSERT INTO projects (
            id, project_code, legacy_ocms_code, name, description, ministry_id, sector_id,
            location, state, implementing_agency, project_status, schedule_status,
            start_date, original_completion_date, expected_completion_date, actual_completion_date,
            project_age_months, schedule_extension_months, delay_days,
            original_cost, revised_cost, cumulative_expenditure, cost_overrun_pct,
            cost_escalation_crore, expenditure_ratio_pct, physical_progress, physical_progress_target, financial_progress,
            risk_score, risk_level, cost_risk, time_risk, impl_risk, overall_risk,
            source_report, created_at, updated_at
        ) VALUES %s
        ON CONFLICT (id) DO UPDATE SET
            project_code = EXCLUDED.project_code,
            legacy_ocms_code = COALESCE(projects.legacy_ocms_code, EXCLUDED.legacy_ocms_code),
            name = EXCLUDED.name,
            ministry_id = EXCLUDED.ministry_id,
            sector_id = EXCLUDED.sector_id,
            location = EXCLUDED.location,
            state = EXCLUDED.state,
            implementing_agency = EXCLUDED.implementing_agency,
            project_status = EXCLUDED.project_status,
            schedule_status = EXCLUDED.schedule_status,
            start_date = EXCLUDED.start_date,
            original_completion_date = EXCLUDED.original_completion_date,
            expected_completion_date = EXCLUDED.expected_completion_date,
            actual_completion_date = EXCLUDED.actual_completion_date,
            project_age_months = EXCLUDED.project_age_months,
            schedule_extension_months = EXCLUDED.schedule_extension_months,
            delay_days = EXCLUDED.delay_days,
            original_cost = EXCLUDED.original_cost,
            revised_cost = EXCLUDED.revised_cost,
            cumulative_expenditure = EXCLUDED.cumulative_expenditure,
            cost_overrun_pct = EXCLUDED.cost_overrun_pct,
            cost_escalation_crore = EXCLUDED.cost_escalation_crore,
            expenditure_ratio_pct = EXCLUDED.expenditure_ratio_pct,
            physical_progress = EXCLUDED.physical_progress,
            physical_progress_target = EXCLUDED.physical_progress_target,
            financial_progress = EXCLUDED.financial_progress,
            risk_score = EXCLUDED.risk_score,
            risk_level = EXCLUDED.risk_level,
            cost_risk = EXCLUDED.cost_risk,
            time_risk = EXCLUDED.time_risk,
            impl_risk = EXCLUDED.impl_risk,
            overall_risk = EXCLUDED.overall_risk,
            source_report = EXCLUDED.source_report,
            updated_at = EXCLUDED.updated_at;
        """

        print(f"  Upserting {len(project_records):,} projects via fast bulk batching...", flush=True)
        batch_size = 1000
        for i in range(0, len(project_records), batch_size):
            chunk = project_records[i:i + batch_size]
            execute_values(raw_cur, project_upsert_sql, chunk)
            raw_conn.commit()
            print(f"    Upserted: {min(i + batch_size, len(project_records)):,} / {len(project_records):,} projects.", flush=True)

        print("  Projects successfully committed to database.", flush=True)

        # Step 4: Progress Snapshots (Fast bulk conversion)
        print("\n[4/5] Preparing Progress Snapshots...", flush=True)
        # Parse reporting dates
        combined_df["reporting_date_parsed"] = combined_df["report_month"].apply(parse_date_safe)
        valid_snapshots = combined_df.dropna(subset=["reporting_date_parsed"]).copy()
        valid_snapshots.drop_duplicates(subset=["project_id", "reporting_date_parsed"], keep="last", inplace=True)
        total_snapshots = len(valid_snapshots)
        print(f"  Prepared {total_snapshots:,} unique monthly snapshot records.", flush=True)

        progress_records = []
        snap_rows = valid_snapshots.to_dict("records")
        for r in snap_rows:
            progress_records.append((
                str(r["project_id"]).strip(),
                r["reporting_date_parsed"],
                clean_str(r.get("report_month"), 20),
                clean_num(r.get("physical_progress_pct"), 0.0),
                clean_num(r.get("expenditure_ratio_pct"), 0.0),
                clean_num(r.get("cumulative_expenditure_crore"), 0.0),
                clean_num(r.get("revised_cost_crore"), None),
                clean_num(r.get("cost_overrun_pct"), 0.0),
                clean_num(r.get("schedule_extension_months"), 0.0),
                int(clean_num(r.get("overdue_days"), 0)),
                clean_str(r.get("schedule_status"), 50),
                clean_num(r.get("physical_progress_delta_1m"), None),
                clean_num(r.get("cost_overrun_delta_1m"), None),
                clean_num(r.get("expenditure_ratio_delta_1m"), None),
                int(clean_num(r.get("risk_signal_count"), 0)),
                now_dt
            ))

        progress_insert_sql = """
        INSERT INTO project_progress (
            project_id, reporting_date, report_month_str, physical_progress,
            financial_progress, cumulative_expenditure, revised_cost, cost_overrun_pct,
            schedule_extension_months, overdue_days, schedule_status,
            physical_progress_delta_1m, cost_overrun_delta_1m, expenditure_ratio_delta_1m,
            risk_signal_count, created_at
        ) VALUES %s
        ON CONFLICT (project_id, reporting_date) DO UPDATE SET
            report_month_str = EXCLUDED.report_month_str,
            physical_progress = EXCLUDED.physical_progress,
            financial_progress = EXCLUDED.financial_progress,
            cumulative_expenditure = EXCLUDED.cumulative_expenditure,
            revised_cost = EXCLUDED.revised_cost,
            cost_overrun_pct = EXCLUDED.cost_overrun_pct,
            schedule_extension_months = EXCLUDED.schedule_extension_months,
            overdue_days = EXCLUDED.overdue_days,
            schedule_status = EXCLUDED.schedule_status,
            physical_progress_delta_1m = EXCLUDED.physical_progress_delta_1m,
            cost_overrun_delta_1m = EXCLUDED.cost_overrun_delta_1m,
            expenditure_ratio_delta_1m = EXCLUDED.expenditure_ratio_delta_1m,
            risk_signal_count = EXCLUDED.risk_signal_count;
        """

        print(f"  Bulk inserting {len(progress_records):,} snapshot rows in batches of 5,000...", flush=True)
        chunk_size = 5000
        for i in range(0, len(progress_records), chunk_size):
            chunk = progress_records[i:i + chunk_size]
            execute_values(raw_cur, progress_insert_sql, chunk)
            raw_conn.commit()
            pct_done = min(100.0, ((i + len(chunk)) / len(progress_records)) * 100)
            print(f"    Snapshots: {min(i + chunk_size, len(progress_records)):,} / {len(progress_records):,} ({pct_done:.1f}%)", flush=True)

        print("  Progress snapshots successfully committed.", flush=True)

        # Step 5: Milestones for Projects
        print("\n[5/5] Checking Project Milestones...", flush=True)
        projects_with_milestones = set(r[0] for r in db.query(Milestone.project_id).distinct().all())
        all_db_projects = db.query(Project).all()
        milestones_to_add = []

        for p in all_db_projects:
            if p.id not in projects_with_milestones:
                prog = float(p.physical_progress or 0.0)
                m1 = Milestone(project_id=p.id, name="Detailed Project Report (DPR) & Approval", status="completed", completion_percentage=100.0, planned_date=p.start_date)
                m2 = Milestone(project_id=p.id, name="Land Acquisition & Environmental NOC", status="completed" if prog > 30 else "in_progress", completion_percentage=100.0 if prog > 30 else min(100.0, prog * 2.5))
                m3 = Milestone(project_id=p.id, name="Civil Construction & Structural Works", status="in_progress" if prog < 85 else "completed", completion_percentage=min(100.0, prog))
                m4 = Milestone(project_id=p.id, name="Systems Integration & Trial Runs", status="pending" if prog < 80 else "in_progress", completion_percentage=max(0.0, min(100.0, (prog - 80) * 5)), planned_date=p.expected_completion_date)
                m5 = Milestone(project_id=p.id, name="Final Commissioning & Handover", status="completed" if prog >= 100 else "pending", completion_percentage=100.0 if prog >= 100 else 0.0, planned_date=p.expected_completion_date)
                milestones_to_add.extend([m1, m2, m3, m4, m5])

        if milestones_to_add:
            print(f"  Adding {len(milestones_to_add):,} default milestone entries for newly added projects...", flush=True)
            db.add_all(milestones_to_add)
            db.commit()
            print("  Milestones committed.", flush=True)
        else:
            print("  All projects already have milestone tracking.", flush=True)

        # Log audit entry
        log_audit_event(
            db=db,
            action="MULTI_CSV_IMPORT",
            entity_type="system",
            entity_id="New_data_2011-jun25.csv + New_data_july2025-may26.csv",
            new_value={"projects": total_unique_projects, "snapshots": total_snapshots}
        )

        elapsed = time.time() - start_time
        print("\n" + "=" * 70, flush=True)
        print("DATABASE INGESTION FULLY COMPLETED!", flush=True)
        print(f"Total Projects in Database: {db.query(Project).count():,}", flush=True)
        print(f"Total Ministries in Database: {db.query(Ministry).count():,}", flush=True)
        print(f"Total Sectors in Database: {db.query(Sector).count():,}", flush=True)
        print(f"Total Progress Snapshots: {db.query(ProjectProgress).count():,}", flush=True)
        print(f"Total Milestones: {db.query(Milestone).count():,}", flush=True)
        print(f"Total Elapsed Time: {elapsed:.1f} seconds", flush=True)
        print("=" * 70, flush=True)

    except Exception as e:
        print(f"\nERROR during data import: {e}", flush=True)
        raw_conn.rollback()
        db.rollback()
        raise e
    finally:
        raw_cur.close()
        raw_conn.close()
        db.close()


if __name__ == "__main__":
    run_import()
