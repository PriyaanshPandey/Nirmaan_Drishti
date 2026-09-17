"""
Fast PostgreSQL Seeder for Nirmaan Drishti / Sanket-AI.
Seeds ministries, sectors, and projects directly from the canonical projectsData.ts.
"""
import sys
import json
import re
from pathlib import Path
from datetime import datetime

BACKEND_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BACKEND_DIR))

from app.database import SessionLocal, engine
from app.models.ministry import Ministry
from app.models.sector import Sector
from app.models.project import Project

def clean_cr_cost(cost_str: str) -> float:
    if not cost_str:
        return 0.0
    cleaned = re.sub(r"[^\d.]", "", cost_str)
    try:
        return float(cleaned) if cleaned else 0.0
    except ValueError:
        return 0.0

def clean_pct(pct_str: str) -> float:
    if not pct_str:
        return 0.0
    cleaned = re.sub(r"[^\d.-]", "", pct_str)
    try:
        return float(cleaned) if cleaned else 0.0
    except ValueError:
        return 0.0

def parse_date(date_str: str):
    if not date_str or date_str in ("N/A", "None", ""):
        return None
    for fmt in ("%Y-%m-%d", "%d-%m-%Y", "%Y-%m", "%d/%m/%Y", "%m/%Y"):
        try:
            return datetime.strptime(date_str.strip(), fmt).date()
        except ValueError:
            pass
    return None

def main():
    root_dir = BACKEND_DIR.parent
    data_file = root_dir / "frontend" / "src" / "data" / "projectsData.ts"
    print(f"Loading data from {data_file}...")
    
    with open(data_file, "r", encoding="utf-8") as f:
        content = f.read()
    
    start_idx = content.find("export const projectsData: Project[] = ")
    if start_idx == -1:
        print("Could not find declaration in projectsData.ts")
        sys.exit(1)
    
    json_str = content[start_idx + len("export const projectsData: Project[] = "):].strip()
    if json_str.endswith(";"):
        json_str = json_str[:-1].strip()
    
    projects_raw = json.loads(json_str)
    print(f"Found {len(projects_raw)} projects. Preparing to seed database...")

    db = SessionLocal()
    try:
        # Check existing
        existing_count = db.query(Project).count()
        if existing_count > 0:
            print(f"Database already contains {existing_count} projects. Skipping duplicate seed.")
            return

        ministry_cache = {}
        sector_cache = {}

        # Pre-seed ministries
        for p in projects_raw:
            m_name = (p.get("ministry") or "UNKNOWN").strip()[:255]
            if m_name and m_name not in ministry_cache:
                m_obj = Ministry(name=m_name)
                db.add(m_obj)
                ministry_cache[m_name] = m_obj

            s_name = (p.get("sector") or "OTHER").strip()[:255]
            if s_name and s_name not in sector_cache:
                s_obj = Sector(name=s_name)
                db.add(s_obj)
                sector_cache[s_name] = s_obj

        db.commit()

        # Refresh IDs
        ministry_id_map = {m.name: m.id for m in db.query(Ministry).all()}
        sector_id_map = {s.name: s.id for s in db.query(Sector).all()}

        print(f"Created {len(ministry_id_map)} ministries and {len(sector_id_map)} sectors.")

        # Batch insert projects
        batch_size = 500
        batch = []
        seen_ids = set()

        for idx, p in enumerate(projects_raw):
            pid = str(p.get("id")).strip()
            if not pid or pid in seen_ids:
                continue
            seen_ids.add(pid)

            m_name = (p.get("ministry") or "UNKNOWN").strip()[:255]
            s_name = (p.get("sector") or "OTHER").strip()[:255]

            orig_cost = clean_cr_cost(p.get("costApproved", ""))
            rev_cost = clean_cr_cost(p.get("costRevised", ""))
            exp = clean_cr_cost(p.get("costExpenditure", ""))
            overrun = clean_pct(p.get("costOverrunPct", ""))
            escalation = max(0.0, rev_cost - orig_cost) if rev_cost > 0 and orig_cost > 0 else 0.0

            sched_status = (p.get("scheduleStatus") or "ON TRACK").upper()
            if sched_status not in ("DELAYED", "ON TRACK", "CRITICAL", "COMPLETED"):
                sched_status = "ON TRACK"

            ext_months = p.get("scheduleExtensionMonths")
            try:
                ext_months_val = float(ext_months) if ext_months is not None else 0.0
            except (ValueError, TypeError):
                ext_months_val = 0.0

            delay_days_val = int(p.get("delayDays") or 0)

            project_obj = Project(
                id=pid,
                project_code=pid,
                name=(p.get("name") or "Unnamed Project")[:500],
                description=(p.get("description") or ""),
                ministry_id=ministry_id_map.get(m_name),
                sector_id=sector_id_map.get(s_name),
                location=(p.get("location") or "")[:500],
                state=(p.get("location") or "")[:255],
                implementing_agency=(p.get("agency") or "")[:255],
                phase=(p.get("phase") or "Construction")[:100],
                type=(p.get("type") or "INFRASTRUCTURE")[:100],
                project_status="COMPLETED" if p.get("phase") == "Completed" else "ACTIVE",
                schedule_status=sched_status,
                start_date=parse_date(p.get("startDate")),
                original_completion_date=parse_date(p.get("originalCompletion")),
                expected_completion_date=parse_date(p.get("expectedCompletion")),
                schedule_extension_months=ext_months_val,
                delay_days=delay_days_val,
                original_cost=orig_cost,
                revised_cost=rev_cost,
                cumulative_expenditure=exp,
                cost_overrun_pct=overrun,
                cost_escalation_crore=escalation,
                expenditure_ratio_pct=(exp / rev_cost * 100) if rev_cost > 0 else 0.0,
                physical_progress=float(p.get("progressPhysical") or 0.0),
                physical_progress_target=float(p.get("progressPhysicalTarget") or 0.0),
                financial_progress=float(p.get("progressFinancial") or 0.0),
                risk_score=int(p.get("riskScore") or 30),
                risk_level=(p.get("riskLevel") or "Low")[:50],
                cost_risk=int(p.get("costRisk") or 20),
                time_risk=int(p.get("timeRisk") or 20),
                impl_risk=int(p.get("implRisk") or 20),
                overall_risk=int(p.get("overallRisk") or 20),
                source_report=(p.get("sourceReport") or "")[:255]
            )
            batch.append(project_obj)

            if len(batch) >= batch_size:
                db.bulk_save_objects(batch)
                db.commit()
                print(f"  - Seeded {idx + 1}/{len(projects_raw)} projects...")
                batch = []

        if batch:
            db.bulk_save_objects(batch)
            db.commit()
            print(f"  - Seeded final batch. Total: {len(seen_ids)} projects.")

        total_seeded = db.query(Project).count()
        print(f"\n[SUCCESS] Successfully seeded {total_seeded} projects into PostgreSQL!")

    except Exception as e:
        db.rollback()
        print(f"[ERROR] Seeding failed: {e}")
        raise
    finally:
        db.close()

if __name__ == "__main__":
    main()
