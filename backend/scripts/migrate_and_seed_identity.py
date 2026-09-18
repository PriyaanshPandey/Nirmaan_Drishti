"""
migrate_and_seed_identity.py - Database Migration & Seeding for Project Identity Resolution
Nirmaan Drishti / Infrastructure Project Monitoring.

Actions:
1. Adds `legacy_ocms_code` column to `projects` table in PostgreSQL.
2. Creates `project_identifier_mappings` table and indexes.
3. Seeds all 977 verified (legacy_ocms_code -> project_id) mappings.
4. Unifies split project entities (including Ghatampur N06000152 -> 400259) in PostgreSQL:
   - Sets legacy_ocms_code on canonical project rows.
   - Re-links any child records (milestones, progress, predictions) from legacy OCMS IDs to canonical Project IDs.
   - Deletes duplicate project records for verified transitions.
"""

import sys
from pathlib import Path
import pandas as pd
from sqlalchemy import text

BACKEND_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BACKEND_DIR))

from app.database import SessionLocal, engine
from app.models.identifier_mapping import ProjectIdentifierMapping
from app.models.project import Project
from app.models.milestone import Milestone
from app.models.progress import ProjectProgress
from app.models.risk_prediction import RiskPrediction


def migrate_schema():
    print("=" * 80)
    print("STEP 1: DATABASE SCHEMA MIGRATION")
    print("=" * 80)
    with engine.connect() as conn:
        # 1. Add legacy_ocms_code column if not exists
        check_col = conn.execute(text("""
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'projects' AND column_name = 'legacy_ocms_code';
        """)).fetchone()

        if not check_col:
            print("Adding column 'legacy_ocms_code' to 'projects' table...")
            conn.execute(text("ALTER TABLE projects ADD COLUMN legacy_ocms_code VARCHAR(100);"))
            conn.execute(text("CREATE INDEX IF NOT EXISTS ix_projects_legacy_ocms_code ON projects (legacy_ocms_code);"))
            conn.commit()
            print("Column 'legacy_ocms_code' added successfully.")
        else:
            print("Column 'legacy_ocms_code' already exists on 'projects' table.")

        # 2. Create project_identifier_mappings table if not exists
        check_tbl = conn.execute(text("""
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_name = 'project_identifier_mappings';
        """)).fetchone()

        if not check_tbl:
            print("Creating table 'project_identifier_mappings'...")
            ProjectIdentifierMapping.__table__.create(engine)
            print("Table 'project_identifier_mappings' created successfully.")
        else:
            print("Table 'project_identifier_mappings' already exists.")


def seed_mappings():
    print("\n" + "=" * 80)
    print("STEP 2: SEEDING VERIFIED IDENTIFIER MAPPINGS")
    print("=" * 80)

    report_path = BACKEND_DIR.parent / "data" / "07_validation_reports" / "ocms_project_id_transition_report.csv"
    if not report_path.exists():
        print(f"Error: Transition report not found at {report_path}")
        return

    df = pd.read_csv(report_path)
    # Filter only ACTIVE_VERIFIED mappings
    verified_df = df[df["mapping_status"] == "ACTIVE_VERIFIED"].copy()
    print(f"Found {len(verified_df)} active verified mappings in report.")

    db = SessionLocal()
    try:
        existing_count = db.query(ProjectIdentifierMapping).count()
        if existing_count > 0:
            print(f"Table already contains {existing_count} mappings. Updating missing entries...")

        existing_ocms = {m.legacy_ocms_code for m in db.query(ProjectIdentifierMapping.legacy_ocms_code).all()}

        to_add = []
        for _, row in verified_df.iterrows():
            ocms = str(row["legacy_ocms_code"]).strip()
            pid = str(row["project_id"]).strip()
            if ocms.endswith(".0"):
                ocms = ocms[:-2]
            if pid.endswith(".0"):
                pid = pid[:-2]

            if ocms not in existing_ocms:
                to_add.append(ProjectIdentifierMapping(
                    project_id=pid,
                    legacy_ocms_code=ocms,
                    mapping_confidence="HIGH_EXPLICIT",
                    mapping_source=str(row.get("mapping_source", "Ongoing_Project_Detail.csv")),
                    mapping_status="ACTIVE_VERIFIED"
                ))
                existing_ocms.add(ocms)

        # Ensure Ghatampur explicitly present
        if "N06000152" not in existing_ocms:
            to_add.append(ProjectIdentifierMapping(
                project_id="400259",
                legacy_ocms_code="N06000152",
                mapping_confidence="HIGH_EXPLICIT",
                mapping_source="Ongoing_Project_Detail.csv",
                mapping_status="ACTIVE_VERIFIED"
            ))

        if to_add:
            db.bulk_save_objects(to_add)
            db.commit()
            print(f"Successfully seeded {len(to_add)} new identifier mappings.")
        else:
            print("All verified mappings already present.")

        total_mappings = db.query(ProjectIdentifierMapping).count()
        print(f"Total mappings in database: {total_mappings}")

    finally:
        db.close()


def unify_split_entities():
    print("\n" + "=" * 80)
    print("STEP 3: UNIFYING SPLIT PROJECT ENTITIES IN POSTGRESQL")
    print("=" * 80)

    # 1. Load the 19 safe split transitions + Ghatampur
    split_report_path = BACKEND_DIR.parent / "data" / "07_validation_reports" / "split_histories_final_validation.csv"
    pairs = [("N06000152", "400259")]  # Ghatampur

    if split_report_path.exists():
        df_split = pd.read_csv(split_report_path)
        safe = df_split[df_split["decision"] == "VERIFIED_SAFE_TRANSITION"]
        for _, r in safe.iterrows():
            ocms = str(r["ocms_code"]).strip()
            pid = str(r["resolved_project_id"]).strip()
            if (ocms, pid) not in pairs:
                pairs.append((ocms, pid))

    print(f"Processing {len(pairs)} verified entity unifications...")

    db = SessionLocal()
    try:
        # Also batch update legacy_ocms_code for ALL verified mappings where project exists
        all_mappings = db.query(ProjectIdentifierMapping).all()
        mapping_dict = {m.project_id: m.legacy_ocms_code for m in all_mappings}

        # Update legacy_ocms_code on all target projects
        updated_count = 0
        for pid, ocms in mapping_dict.items():
            proj = db.query(Project).filter(Project.id == pid).first()
            if proj and proj.legacy_ocms_code != ocms:
                proj.legacy_ocms_code = ocms
                updated_count += 1

        print(f"Updated legacy_ocms_code on {updated_count} existing canonical projects.")

        # Process the split entity pairs: transfer child records & remove duplicate old rows
        merged_count = 0
        for old_ocms, target_pid in pairs:
            old_proj = db.query(Project).filter(Project.id == old_ocms).first()
            target_proj = db.query(Project).filter(Project.id == target_pid).first()

            if old_proj:
                print(f"Unifying split entity: '{old_ocms}' -> '{target_pid}' ({old_proj.name})...")

                if target_proj:
                    target_proj.legacy_ocms_code = old_ocms

                    # Re-link child records
                    ms_moved = db.query(Milestone).filter(Milestone.project_id == old_ocms).update(
                        {"project_id": target_pid}, synchronize_session=False
                    )
                    pr_moved = db.query(ProjectProgress).filter(ProjectProgress.project_id == old_ocms).update(
                        {"project_id": target_pid}, synchronize_session=False
                    )
                    rp_moved = db.query(RiskPrediction).filter(RiskPrediction.project_id == old_ocms).update(
                        {"project_id": target_pid}, synchronize_session=False
                    )

                    # Delete duplicate old project row
                    db.delete(old_proj)
                    db.commit()
                    merged_count += 1
                    print(f"  -> Merged successfully (re-linked {ms_moved} milestones, {pr_moved} progress records, {rp_moved} predictions). Duplicate row {old_ocms} deleted.")
                else:
                    # If target project didn't exist, simply rename ID
                    old_proj.id = target_pid
                    old_proj.legacy_ocms_code = old_ocms
                    db.commit()
                    print(f"  -> Renamed project ID from '{old_ocms}' to '{target_pid}'.")

        db.commit()
        print(f"\nEntity unification complete: {merged_count} duplicate split project entities merged.")

        # Verify Ghatampur state
        ghat_projects = db.query(Project).filter(Project.name.ilike("%Ghatampur%")).all()
        print("\nCurrent Ghatampur projects in DB after unification:")
        for p in ghat_projects:
            print(f"  - ID: '{p.id}', Legacy OCMS: '{p.legacy_ocms_code}', Name: '{p.name}'")

    except Exception as e:
        db.rollback()
        print(f"Error during entity unification: {e}")
        raise
    finally:
        db.close()


def main():
    migrate_schema()
    seed_mappings()
    unify_split_entities()
    print("\nAll database migrations and identity resolutions completed successfully!")


if __name__ == "__main__":
    main()
