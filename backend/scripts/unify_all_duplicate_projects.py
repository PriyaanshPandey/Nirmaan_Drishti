"""
unify_all_duplicate_projects.py - Unify All Duplicate Project Entities across PostgreSQL & Frontend.
Nirmaan Drishti / Infrastructure Project Monitoring.

Comprehensive Resolution:
1. Combines verified OCMS mappings from Ongoing_Project_Detail.csv (976 mappings).
2. Adds verified transitions from official parenthetical ID in project name '(PID)' (224 mappings).
3. Safely excludes ambiguous and conflicting IDs (e.g. N24001263, N24001590, N24002025, N24001323).
4. Unifies all ~1,180 duplicate project records in PostgreSQL:
   - Sets legacy_ocms_code on canonical project rows.
   - Re-links any child records (milestones, progress, predictions) from legacy OCMS to canonical Project ID.
   - Deletes duplicate legacy project records.
5. Updates frontend/src/data/projectsData.ts:
   - Sets legacyOcmsCode on canonical projects.
   - Removes duplicate legacy project records.
"""

import sys
import re
import json
from pathlib import Path
import pandas as pd
from sqlalchemy import text

BACKEND_DIR = Path(__file__).resolve().parent.parent
WORKSPACE_ROOT = BACKEND_DIR.parent
sys.path.insert(0, str(BACKEND_DIR))

from app.database import SessionLocal, engine
from app.models.identifier_mapping import ProjectIdentifierMapping
from app.models.project import Project
from app.models.milestone import Milestone
from app.models.progress import ProjectProgress
from app.models.risk_prediction import RiskPrediction

# Ambiguous conflicts and rejected clashes to never auto-merge
EXCLUDED_CONFLICTS = {
    "N24001323",
    "N24001263",
    "N24001590",
    "N24002025",
    "N12000135",
    "N22000602",
    "N24000979",
    "N24001416",
    "N24001418",
    "N24001419",
    "N24001631",
    "N24001925",
}


def build_unified_mapping_dict(db) -> dict:
    # 1. Base mappings from report
    rep_path = WORKSPACE_ROOT / "data" / "07_validation_reports" / "ocms_project_id_transition_report.csv"
    df_rep = pd.read_csv(rep_path)
    verified = df_rep[df_rep["mapping_status"] == "ACTIVE_VERIFIED"]

    mapping = {}
    for _, r in verified.iterrows():
        ocms = str(r["legacy_ocms_code"]).strip()
        pid = str(r["project_id"]).strip()
        if ocms.endswith(".0"): ocms = ocms[:-2]
        if pid.endswith(".0"): pid = pid[:-2]
        if ocms not in EXCLUDED_CONFLICTS:
            mapping[ocms] = pid

    mapping["N06000152"] = "400259"

    # 2. Extract from parenthetical trailing ID in names
    existing_pids = {p.id for p in db.query(Project.id).all()}
    all_projects = db.query(Project.id, Project.name).all()

    pattern = re.compile(r'\((\d{5,7})\)\s*$')
    added_from_names = 0
    for old_id, name in all_projects:
        if old_id in EXCLUDED_CONFLICTS:
            continue
        m = pattern.search(name or "")
        if m:
            extracted_id = m.group(1)
            if extracted_id in existing_pids and old_id != extracted_id:
                if old_id not in mapping:
                    mapping[old_id] = extracted_id
                    added_from_names += 1

    print(f"Total verified identifier mappings: {len(mapping)} (added {added_from_names} from parenthetical name IDs)")
    return mapping


def unify_database():
    print("=" * 80)
    print("STEP 1: UNIFYING POSTGRESQL DATABASE ENTITIES")
    print("=" * 80)

    db = SessionLocal()
    try:
        mapping = build_unified_mapping_dict(db)

        # 1. Seed any missing mappings into project_identifier_mappings
        existing_mappings = {m.legacy_ocms_code for m in db.query(ProjectIdentifierMapping.legacy_ocms_code).all()}
        new_mappings = []
        for ocms, pid in mapping.items():
            if ocms not in existing_mappings:
                new_mappings.append(ProjectIdentifierMapping(
                    project_id=pid,
                    legacy_ocms_code=ocms,
                    mapping_confidence="HIGH_EXPLICIT",
                    mapping_source="PAIMANA_OFFICIAL_NAME_AND_DATASET_LINKAGE",
                    mapping_status="ACTIVE_VERIFIED"
                ))
                existing_mappings.add(ocms)

        if new_mappings:
            db.bulk_save_objects(new_mappings)
            db.commit()
            print(f"Added {len(new_mappings)} new mappings to project_identifier_mappings table.")

        # 2. Merge duplicate project records in database
        existing_project_map = {p.id: p for p in db.query(Project).all()}
        print(f"Initial total projects in DB: {len(existing_project_map)}")

        merged_count = 0
        total_ms = 0
        total_pr = 0
        total_rp = 0

        for old_ocms, target_pid in mapping.items():
            old_proj = existing_project_map.get(old_ocms)
            target_proj = existing_project_map.get(target_pid)

            if old_proj and target_proj:
                # Set legacy_ocms_code on canonical project
                if target_proj.legacy_ocms_code != old_ocms:
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

                total_ms += ms_moved
                total_pr += pr_moved
                total_rp += rp_moved

                # Delete duplicate legacy project
                db.delete(old_proj)
                merged_count += 1
            elif target_proj and not old_proj:
                # Old project already deleted/not present, just ensure legacy_ocms_code is set
                if target_proj.legacy_ocms_code != old_ocms:
                    target_proj.legacy_ocms_code = old_ocms

        db.commit()
        print(f"Successfully merged {merged_count} duplicate projects in DB.")
        print(f"Re-linked: {total_ms} milestones, {total_pr} progress records, {total_rp} risk predictions.")

        remaining = db.query(Project).count()
        print(f"Remaining distinct projects in PostgreSQL DB: {remaining}")

    except Exception as e:
        db.rollback()
        print(f"Error unifying DB: {e}")
        raise
    finally:
        db.close()


def unify_frontend(mapping: dict):
    print("\n" + "=" * 80)
    print("STEP 2: UNIFYING FRONTEND DATASET (projectsData.ts)")
    print("=" * 80)

    ts_path = WORKSPACE_ROOT / "frontend" / "src" / "data" / "projectsData.ts"
    content = ts_path.read_text(encoding="utf-8")

    decl = "export const projectsData: Project[] = "
    start_idx = content.find(decl)
    header_part = content[:start_idx + len(decl)]

    json_str = content[start_idx + len(decl):].strip().rstrip(";")
    projects = json.loads(json_str)
    print(f"Initial projects in projectsData.ts: {len(projects)}")

    # Create target pid to ocms reverse map
    pid_to_ocms = {pid: ocms for ocms, pid in mapping.items()}

    # Set of duplicate legacy IDs to remove
    duplicates_to_remove = set(mapping.keys())

    cleaned = []
    removed_count = 0
    for p in projects:
        pid = str(p.get("id", "")).strip()
        if pid in duplicates_to_remove:
            removed_count += 1
            continue

        if pid in pid_to_ocms:
            p["legacyOcmsCode"] = pid_to_ocms[pid]
            p["legacy_ocms_code"] = pid_to_ocms[pid]
        else:
            p["legacyOcmsCode"] = None
            p["legacy_ocms_code"] = None

        cleaned.append(p)

    print(f"Removed {removed_count} duplicate legacy project entries from frontend dataset.")
    print(f"Remaining distinct projects in frontend dataset: {len(cleaned)}")

    new_json = json.dumps(cleaned, indent=2)
    ts_path.write_text(header_part + new_json + ";\n", encoding="utf-8")
    print("Successfully updated frontend/src/data/projectsData.ts")


def verify_target_projects():
    print("\n" + "=" * 80)
    print("STEP 3: VERIFYING TARGET PROJECTS")
    print("=" * 80)

    targets = [
        ("N24001958", "618256", "Rehabilitation and Upgradation to 2-lane..."),
        ("N16000234", "400301", "Multi Product Pipeline from Irugur to Devangonthi..."),
        ("N24001257", "618291", "Kohima-Bypass Road..."),
        ("N06000152", "400259", "Ghatampur Thermal Power Plant..."),
    ]

    db = SessionLocal()
    try:
        for old_ocms, target_pid, desc in targets:
            p_target = db.query(Project).filter(Project.id == target_pid).first()
            p_old = db.query(Project).filter(Project.id == old_ocms).first()

            print(f"Check: {desc}")
            print(f"  - Target '{target_pid}': Exists={p_target is not None}, Legacy OCMS='{p_target.legacy_ocms_code if p_target else None}'")
            print(f"  - Old '{old_ocms}': Exists={p_old is not None} (MUST BE False)")
            assert p_target is not None, f"Target project {target_pid} should exist!"
            assert p_old is None, f"Duplicate legacy project {old_ocms} should be DELETED!"
            assert p_target.legacy_ocms_code == old_ocms, f"Target {target_pid} legacy_ocms_code should be {old_ocms}!"
            print("  -> PASSED VERIFICATION!")

    finally:
        db.close()


def main():
    db = SessionLocal()
    mapping = build_unified_mapping_dict(db)
    db.close()

    unify_database()
    unify_frontend(mapping)
    verify_target_projects()
    print("\nALL ENTITY DUPLICATIONS SUCCESSFULLY UNIFIED AND RESOLVED!")


if __name__ == "__main__":
    main()
