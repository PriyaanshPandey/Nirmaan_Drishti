"""
Populate project_progress table in PostgreSQL from data/New_data_2011-26.csv
"""
import sys
import time
from pathlib import Path
from datetime import datetime, date
import pandas as pd
import numpy as np
from psycopg2.extras import execute_values

BACKEND_DIR = Path(__file__).resolve().parent.parent
WORKSPACE_ROOT = BACKEND_DIR.parent
sys.path.insert(0, str(BACKEND_DIR))

from app.database import SessionLocal, engine
from app.models.project import Project
from app.models.progress import ProjectProgress


def parse_date_safe(val):
    if pd.isna(val) or val is None or str(val).strip() == "":
        return None
    val_str = str(val).strip()
    for fmt in ("%Y-%m-%d", "%d-%m-%Y", "%Y-%m", "%d/%m/%Y", "%m/%Y", "%Y/%m/%d", "%b-%y", "%d-%b-%y", "%B %Y", "%b %Y"):
        try:
            return datetime.strptime(val_str, fmt).date()
        except ValueError:
            pass
    try:
        dt = pd.to_datetime(val_str, dayfirst=True)
        return dt.date()
    except Exception:
        return None


def clean_num(val, default=0.0):
    if pd.isna(val) or val is None:
        return default
    try:
        v = float(val)
        return default if np.isnan(v) or np.isinf(v) else v
    except (ValueError, TypeError):
        return default


def clean_str(val, max_len=255):
    if pd.isna(val) or val is None:
        return None
    s = str(val).strip()
    return s[:max_len] if s else None


def run():
    print("=" * 65)
    print("POPULATING PROJECT_PROGRESS HISTORICAL TIMELINE SNAPSHOTS")
    print("=" * 65)

    csv_path = WORKSPACE_ROOT / "data" / "New_data_2011-26.csv"
    if not csv_path.exists():
        print(f"Error: {csv_path} does not exist!")
        return

    db = SessionLocal()
    db_projects = set(r[0] for r in db.query(Project.id).all())
    print(f"Found {len(db_projects):,} projects in database.")

    # Load legacy OCMS code mappings to canonical project IDs
    projs = db.query(Project.id, Project.legacy_ocms_code).all()
    ocms_map = {p.legacy_ocms_code.strip(): p.id.strip() for p in projs if p.legacy_ocms_code}
    from app.models.identifier_mapping import ProjectIdentifierMapping
    mappings = db.query(ProjectIdentifierMapping).all()
    for m in mappings:
        if m.legacy_ocms_code and m.project_id:
            ocms_map[m.legacy_ocms_code.strip()] = m.project_id.strip()
    print(f"Loaded {len(ocms_map):,} legacy OCMS code mappings.")

    print(f"Loading {csv_path.name}...")
    start_t = time.time()
    cols = [
        "project_id", "report_month", "physical_progress_pct", "expenditure_ratio_pct",
        "cumulative_expenditure_crore", "revised_cost_crore", "cost_overrun_pct",
        "schedule_extension_months", "overdue_days", "schedule_status",
        "physical_progress_delta_1m", "cost_overrun_delta_1m", "expenditure_ratio_delta_1m",
        "risk_signal_count"
    ]
    df = pd.read_csv(csv_path, usecols=cols, low_memory=False)
    print(f"Loaded {len(df):,} raw snapshot rows in {time.time() - start_t:.1f}s.")

    # Filter to projects existing in DB (resolving legacy OCMS codes)
    df["raw_pid"] = df["project_id"].astype(str).str.strip()
    df["clean_pid"] = df["raw_pid"].map(lambda x: ocms_map.get(x, x))
    df = df[df["clean_pid"].isin(db_projects)].copy()
    print(f"Filtered to {len(df):,} rows matching projects in DB (including mapped legacy OCMS codes).")

    df["reporting_date_parsed"] = df["report_month"].apply(parse_date_safe)
    df = df.dropna(subset=["reporting_date_parsed"]).copy()
    df.drop_duplicates(subset=["clean_pid", "reporting_date_parsed"], keep="last", inplace=True)
    df.sort_values(by=["clean_pid", "reporting_date_parsed"], inplace=True)
    print(f"Total valid unique snapshots to insert: {len(df):,}")

    now_dt = datetime.utcnow()
    progress_records = []
    curr_pid = None
    prev_exp = None
    prev_prog = None

    for r in df.to_dict("records"):
        pid = r["clean_pid"]
        if pid != curr_pid:
            curr_pid = pid
            prev_exp = None
            prev_prog = None

        phys_val = clean_num(r.get("physical_progress_pct"), 0.0)
        exp_val = clean_num(r.get("cumulative_expenditure_crore"), 0.0)
        rev_val = clean_num(r.get("revised_cost_crore"), None)
        exp_ratio = clean_num(r.get("expenditure_ratio_pct"), 0.0)

        # Detect swapped physical progress & expenditure
        if (phys_val == 0.0 or phys_val < 10.0) and (0.0 < exp_val <= 100.0) and (rev_val is not None and rev_val > 500.0) and (prev_exp is not None and prev_exp > 500.0):
            phys_val = exp_val
            exp_val = prev_exp
            exp_ratio = round((exp_val / rev_val) * 100.0, 2)
        elif (0.0 < exp_val <= 100.0) and (rev_val is not None and rev_val > 500.0) and (prev_exp is not None and prev_exp > 500.0):
            exp_val = prev_exp
            exp_ratio = round((exp_val / rev_val) * 100.0, 2)

        if exp_val > 100.0:
            prev_exp = exp_val
        if phys_val > 0.0:
            prev_prog = phys_val

        progress_records.append((
            pid,
            r["reporting_date_parsed"],
            clean_str(r.get("report_month"), 20),
            phys_val,
            exp_ratio,
            exp_val,
            rev_val,
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

    insert_sql = """
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

    raw_conn = engine.raw_connection()
    raw_cur = raw_conn.cursor()
    chunk_size = 10000
    total = len(progress_records)
    print(f"Upserting {total:,} snapshots in batches of {chunk_size}...")
    for i in range(0, total, chunk_size):
        chunk = progress_records[i:i + chunk_size]
        execute_values(raw_cur, insert_sql, chunk)
        raw_conn.commit()
        pct = min(100.0, (i + len(chunk)) / total * 100)
        print(f"  Inserted: {min(i + chunk_size, total):,} / {total:,} ({pct:.1f}%)")

    raw_cur.close()
    raw_conn.close()
    db.close()
    print("=" * 65)
    print(f"FINISHED! Total time: {time.time() - start_t:.1f} seconds")
    print("=" * 65)


if __name__ == "__main__":
    run()
