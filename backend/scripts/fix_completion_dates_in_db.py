"""
fix_completion_dates_in_db.py - Ensure Data-Correctness for Completion Dates and Delays in PostgreSQL.
"""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.database import engine
from sqlalchemy import text

def run_fix():
    print("=" * 80)
    print("FIXING COMPLETION DATES & PROJECT STATUS IN POSTGRESQL")
    print("=" * 80)

    with engine.connect() as conn:
        # 1. Update project_status for 100% completed projects
        res1 = conn.execute(text("""
            UPDATE projects 
            SET project_status = 'COMPLETED' 
            WHERE (physical_progress >= 100.0 OR UPPER(schedule_status) = 'COMPLETED')
              AND project_status != 'COMPLETED'
        """))
        print(f"Updated {res1.rowcount} projects to project_status = 'COMPLETED'.")

        # 2. Populate actual_completion_date for completed projects where actual_completion_date is NULL
        res2 = conn.execute(text("""
            UPDATE projects
            SET actual_completion_date = expected_completion_date
            WHERE project_status = 'COMPLETED'
              AND actual_completion_date IS NULL
              AND expected_completion_date IS NOT NULL
        """))
        print(f"Populated actual_completion_date for {res2.rowcount} completed projects.")

        # 3. Synchronize schedule_extension_months from dates where both original and target dates exist
        res3 = conn.execute(text("""
            UPDATE projects
            SET schedule_extension_months = GREATEST(0.0, ROUND(
                (EXTRACT(YEAR FROM COALESCE(actual_completion_date, expected_completion_date)) - EXTRACT(YEAR FROM original_completion_date)) * 12 +
                (EXTRACT(MONTH FROM COALESCE(actual_completion_date, expected_completion_date)) - EXTRACT(MONTH FROM original_completion_date))
            , 2))
            WHERE original_completion_date IS NOT NULL
              AND COALESCE(actual_completion_date, expected_completion_date) IS NOT NULL
              AND (schedule_extension_months = 0 OR schedule_extension_months IS NULL)
              AND COALESCE(actual_completion_date, expected_completion_date) > original_completion_date
        """))
        print(f"Synchronized schedule_extension_months for {res3.rowcount} projects.")

        conn.commit()

        # Check summary counts
        total_projects = conn.execute(text("SELECT count(*) FROM projects")).scalar()
        completed = conn.execute(text("SELECT count(*) FROM projects WHERE project_status = 'COMPLETED'")).scalar()
        active = conn.execute(text("SELECT count(*) FROM projects WHERE project_status = 'ACTIVE'")).scalar()
        has_actual = conn.execute(text("SELECT count(*) FROM projects WHERE actual_completion_date IS NOT NULL")).scalar()
        has_expected = conn.execute(text("SELECT count(*) FROM projects WHERE expected_completion_date IS NOT NULL")).scalar()
        has_orig = conn.execute(text("SELECT count(*) FROM projects WHERE original_completion_date IS NOT NULL")).scalar()

        print("\nSummary Stats after update:")
        print(f"  Total Projects: {total_projects}")
        print(f"  Active Projects: {active}")
        print(f"  Completed Projects: {completed}")
        print(f"  With actual_completion_date: {has_actual}")
        print(f"  With expected_completion_date: {has_expected}")
        print(f"  With original_completion_date: {has_orig}")

if __name__ == "__main__":
    run_fix()
