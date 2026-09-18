import sys
sys.path.insert(0, ".")
from app.services.ai_engine_service import AIEngine

ai = AIEngine.get_instance()
ai.initialize()
df = ai.df_cache

mask = df["project_id"].astype(str) == "400259"
history = df[mask].sort_values("report_month").reset_index(drop=True)
print("Latest row for 400259:")
latest = history.iloc[-1]
for k in ["project_id", "project_name", "report_month", "physical_progress_pct", "original_cost_crore", "revised_cost_crore", "approval_start", "original_target_doc", "revised_doc", "schedule_status", "schedule_extension_months"]:
    if k in latest.index:
        print(f"  {k}: {latest[k]}")

print("\nFirst row for 400259:")
first = history.iloc[0]
for k in ["project_id", "project_name", "report_month", "physical_progress_pct", "original_cost_crore", "revised_cost_crore", "approval_start", "original_target_doc", "revised_doc", "schedule_status", "schedule_extension_months"]:
    if k in first.index:
        print(f"  {k}: {first[k]}")
