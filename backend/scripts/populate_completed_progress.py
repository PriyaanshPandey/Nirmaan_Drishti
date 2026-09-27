"""
Populate project_progress table in PostgreSQL from:
1. data/New_data_2011-26.csv
2. data/Completed_Projects_2001_to_May_2026 (1).csv
"""
import sys
import time
import re
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

MONTH_MAP = {
    'january': 1, 'february': 2, 'march': 3, 'april': 4, 'may': 5, 'june': 6,
    'july': 7, 'august': 8, 'september': 9, 'october': 10, 'november': 11, 'december': 12,
    'jan': 1, 'feb': 2, 'mar': 3, 'apr': 4, 'jun': 6,
    'jul': 7, 'aug': 8, 'sep': 9, 'oct': 10, 'nov': 11, 'dec': 12
}


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
    if isinstance(val, (int, float)):
        return float(val) if not (np.isnan(val) or np.isinf(val)) else default
    s = str(val).replace(",", "").replace("\u20b9", "").replace("%", "").strip()
    try:
        return float(s)
    except (ValueError, TypeError):
        return default


def clean_str(val, max_len=255):
    if pd.isna(val) or val is None:
        return None
    s = str(val).strip()
    return s[:max_len] if s else None


def run():
    print("=" * 65)
    print("INGESTING COMPLETED PROJECTS HISTORICAL SNAPSHOTS")
    print("=" * 65)

    comp_csv = WORKSPACE_ROOT / "data" / "Completed_Projects_2001_to_May_2026 (1).csv"
    if not comp_csv.exists():
        print(f"Notice: {comp_csv} not found, skipping completed file.")
        return

    db = SessionLocal()
    db_projects = set(r[0] for r in db.query(Project.id).all())
    print(f"Found {len(db_projects):,} projects in database.")

    print(f"Loading {comp_csv.name}...")
    start_t = time.time()
    df_comp = pd.read_csv(comp_csv, low_memory=False, encoding="utf-8", encoding_errors="replace")
    print(f"Loaded {len(df_comp):,} raw completed snapshot rows.")

    df_comp["clean_pid"] = df_comp["project_id"].astype(str).str.strip()
    df_comp = df_comp[df_comp["clean_pid"].isin(db_projects)].copy()
    print(f"Filtered to {len(df_comp):,} rows matching projects in DB.")

    # Find columns for cost, exp, progress
    col_orig = [c for c in df_comp.columns if "original cost" in c.lower()][0]
    col_rev = [c for c in df_comp.columns if "revised cost" in c.lower()][0]
    col_ant = [c for c in df_comp.columns if "anticipated cost" in c.lower()][0]
    col_exp = [c for c in df_comp.columns if "cumulative expenditure" in c.lower()][0]
    col_prog = [c for c in df_comp.columns if "physical progress" in c.lower()][0]

    def parse_comp_date(row):
        try:
            yr = int(row.get("year"))
            m_str = str(row.get("month", "")).strip().lower()
            m_num = MONTH_MAP.get(m_str)
            if not m_num:
                m_num = int(row.get("month_order", 1))
            m_num = max(1, min(12, m_num))
            d = date(yr, m_num, 1)
            m_label = f"{yr}-{m_num:02d}"
            return d, m_label
        except Exception:
            return None, None

    records = []
    now_dt = datetime.now()
    for _, r in df_comp.iterrows():
        d, m_label = parse_comp_date(r)
        if not d:
            continue
        orig = clean_num(r.get(col_orig), 0.0)
        rev = clean_num(r.get(col_ant), 0.0) or clean_num(r.get(col_rev), 0.0) or orig
        exp = clean_num(r.get(col_exp), 0.0)
        prog = clean_num(r.get(col_prog), 100.0)
        overrun = round(((rev - orig) / orig * 100), 1) if orig > 0 else 0.0

        records.append((
            r["clean_pid"],
            d,
            m_label,
            prog,
            100.0 if prog >= 100.0 else round(exp / rev * 100, 1) if rev > 0 else 0.0,
            exp,
            rev,
            overrun,
            0.0,
            0,
            "COMPLETED",
            None,
            None,
            None,
            0,
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
        schedule_status = EXCLUDED.schedule_status;
    """

    raw_conn = engine.raw_connection()
    raw_cur = raw_conn.cursor()
    chunk_size = 10000
    total = len(records)
    print(f"Upserting {total:,} completed snapshots in batches of {chunk_size}...")
    for i in range(0, total, chunk_size):
        chunk = records[i:i + chunk_size]
        execute_values(raw_cur, insert_sql, chunk)
        raw_conn.commit()
        pct = min(100.0, (i + len(chunk)) / total * 100)
        print(f"  Inserted: {min(i + chunk_size, total):,} / {total:,} ({pct:.1f}%)")

    raw_cur.close()
    raw_conn.close()
    db.close()

    # Final count
    with engine.connect() as conn:
        from sqlalchemy import text
        tot = conn.execute(text("SELECT count(*) FROM project_progress")).scalar()
        print("=" * 65)
        print(f"FINISHED! Total snapshots in database: {tot:,} in {time.time() - start_t:.1f}s")
        print("=" * 65)


if __name__ == "__main__":
    run()
