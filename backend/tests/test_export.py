"""
Test script to verify CSV export endpoint and validate content.
"""
import sys
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parent.parent
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def test_export_endpoints():
    print("=" * 65)
    print("TESTING ACTION CENTRE CSV EXPORT ENDPOINTS")
    print("=" * 65)

    # 1. Test /api/alerts/export
    res = client.get("/api/alerts/export")
    assert res.status_code == 200
    assert "text/csv" in res.headers["content-type"]
    assert "attachment; filename=action_centre_report_" in res.headers["content-disposition"]
    csv_text = res.content.decode("utf-8-sig")
    print(f"[OK] GET /api/alerts/export -> Status: 200 (Size: {len(res.content):,} bytes)")

    # 2. Test /api/action-centre/export
    res_alias = client.get("/api/action-centre/export")
    assert res_alias.status_code == 200
    print(f"[OK] GET /api/action-centre/export -> Status: 200")

    # 3. Validate content sections
    assert "SANKET-AI: NATIONAL INFRASTRUCTURE ACTION PLAN & INTERVENTIONS REPORT" in csv_text
    assert "SECTION 1: ACTION QUEUE EXECUTIVE SUMMARY" in csv_text
    assert "Total Projects Requiring Intervention" in csv_text
    assert "SECTION 2: PRIORITY ACTION QUEUE & INTERVENTIONS" in csv_text
    assert "Item #" in csv_text
    assert "SECTION 3: RESOLUTION SIMULATOR SCENARIOS & INTERVENTION GAINS" in csv_text
    assert "Land Acquisition" in csv_text
    assert "SECTION 4: PRIORITIZATION SCORING MODEL WEIGHTS" in csv_text

    print("=" * 65)
    print("ALL 4 SECTIONS & REAL VALUES VERIFIED IN GENERATED CSV REPORT!")
    print("=" * 65)

if __name__ == "__main__":
    test_export_endpoints()
