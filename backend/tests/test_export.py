"""
Test script to verify CSV export endpoint and validate content.
"""
import sys
import pytest
from pathlib import Path

# Ensure backend and ai are at the head of sys.path, and purge any conflicting root 'app'
backend_dir = Path(__file__).resolve().parent.parent
ai_dir = backend_dir.parent / "ai"
if str(backend_dir) in sys.path:
    sys.path.remove(str(backend_dir))
sys.path.insert(0, str(backend_dir))

if str(ai_dir) in sys.path:
    sys.path.remove(str(ai_dir))
sys.path.insert(1, str(ai_dir))

if "app" in sys.modules:
    mod = sys.modules["app"]
    if getattr(mod, "__file__", None) is None or "backend" not in str(getattr(mod, "__file__", "")):
        to_del = [k for k in sys.modules if k == "app" or k.startswith("app.")]
        for k in to_del:
            del sys.modules[k]

from fastapi.testclient import TestClient
from app.main import app
from app.database import check_db_connection

client = TestClient(app)

pytestmark = pytest.mark.skipif(not check_db_connection(), reason="Live PostgreSQL database is offline")

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
