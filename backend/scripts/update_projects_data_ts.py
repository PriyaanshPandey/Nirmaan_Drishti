"""
update_projects_data_ts.py - Updates frontend/src/data/projectsData.ts with deterministic entity resolution.
1. Adds legacyOcmsCode to interface Project.
2. Maps all 972 canonical project IDs to their legacy OCMS code (e.g. 400259 -> N06000152).
3. Eliminates duplicate legacy project records for the 20 verified split cases.
"""

import json
from pathlib import Path
import pandas as pd

WORKSPACE_ROOT = Path(__file__).resolve().parent.parent.parent
ts_path = WORKSPACE_ROOT / "frontend" / "src" / "data" / "projectsData.ts"
content = ts_path.read_text(encoding="utf-8")

decl = "export const projectsData: Project[] = "
start_idx = content.find(decl)
header_part = content[:start_idx + len(decl)]

# Update interface in header_part
if "legacyOcmsCode?: string | null;" not in header_part:
    header_part = header_part.replace(
        "export interface Project {\n  id: string;",
        "export interface Project {\n  id: string;\n  legacyOcmsCode?: string | null;\n  legacy_ocms_code?: string | null;"
    )

json_str = content[start_idx + len(decl):].strip()
if json_str.endswith(";"):
    json_str = json_str[:-1].strip()

projects = json.loads(json_str)
print("Original projects count:", len(projects))

# Load transition report
rep_path = WORKSPACE_ROOT / "data" / "07_validation_reports" / "ocms_project_id_transition_report.csv"
df = pd.read_csv(rep_path)
verified = df[df["mapping_status"] == "ACTIVE_VERIFIED"]

pid_to_ocms = {}
for _, r in verified.iterrows():
    ocms = str(r["legacy_ocms_code"]).strip()
    pid = str(r["project_id"]).strip()
    if ocms.endswith(".0"):
        ocms = ocms[:-2]
    if pid.endswith(".0"):
        pid = pid[:-2]
    pid_to_ocms[pid] = ocms

pid_to_ocms["400259"] = "N06000152"

# Split histories report
split_path = WORKSPACE_ROOT / "data" / "07_validation_reports" / "split_histories_final_validation.csv"
safe_splits = set()
if split_path.exists():
    df_s = pd.read_csv(split_path)
    for _, r in df_s[df_s["decision"] == "VERIFIED_SAFE_TRANSITION"].iterrows():
        ocms = str(r["ocms_code"]).strip()
        safe_splits.add(ocms)
safe_splits.add("N06000152")

cleaned_projects = []
removed_count = 0
for p in projects:
    pid = str(p.get("id", "")).strip()
    if pid in safe_splits:
        p_name = p.get("name", "")[:35]
        print(f"Removing duplicate legacy entry: {pid} ({p_name})")
        removed_count += 1
        continue

    if pid in pid_to_ocms:
        p["legacyOcmsCode"] = pid_to_ocms[pid]
        p["legacy_ocms_code"] = pid_to_ocms[pid]
    else:
        p["legacyOcmsCode"] = None
        p["legacy_ocms_code"] = None

    cleaned_projects.append(p)

print(f"Removed {removed_count} duplicate entries. Cleaned projects count: {len(cleaned_projects)}")

# Verify Ghatampur
ghat = [p for p in cleaned_projects if "ghatampur" in p.get("name", "").lower()]
print("Ghatampur projects after cleanup:")
for p in ghat:
    print(f"  - ID: {p['id']}, Legacy OCMS: {p.get('legacyOcmsCode')}, Name: {p['name']}")

new_json = json.dumps(cleaned_projects, indent=2)
ts_path.write_text(header_part + new_json + ";\n", encoding="utf-8")
print(f"Successfully wrote {len(cleaned_projects)} projects to {ts_path}")
