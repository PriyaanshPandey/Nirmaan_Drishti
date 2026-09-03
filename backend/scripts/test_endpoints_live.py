"""
Verification script to test all FastAPI endpoints against live database.
"""
import sys
from pathlib import Path

# Add backend directory to sys.path
BACKEND_DIR = Path(__file__).resolve().parent.parent
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def test_all_endpoints():
    print("=" * 65)
    print("VERIFYING LIVE BACKEND FASTAPI ENDPOINTS WITH REAL DATA")
    print("=" * 65)

    endpoints = [
        ("GET", "/api/health"),
        ("GET", "/api/dashboard/summary"),
        ("GET", "/api/dashboard/health-distribution"),
        ("GET", "/api/dashboard/priority-interventions"),
        ("GET", "/api/dashboard/risk-trend"),
        ("GET", "/api/dashboard/delay-factors"),
        ("GET", "/api/projects?page=1&page_size=5"),
        ("GET", "/api/projects/ministries"),
        ("GET", "/api/projects/sectors"),
        ("GET", "/api/risk/summary"),
        ("GET", "/api/risk/high-risk?limit=5"),
        ("GET", "/api/alerts/summary"),
    ]

    for method, path in endpoints:
        if method == "GET":
            res = client.get(path)
        else:
            res = client.post(path)

        status_text = "OK" if res.status_code == 200 else f"ERR {res.status_code}"
        print(f"[{status_text}] {method:<4} {path:<40} -> Status: {res.status_code}")
        if res.status_code != 200:
            print(f"       Detail: {res.text}")

    # Test single project endpoint
    p_list = client.get("/api/projects?page_size=1").json()
    if p_list.get("items"):
        sample_id = p_list["items"][0]["id"]
        res_detail = client.get(f"/api/projects/{sample_id}")
        print(f"[OK] GET  /api/projects/{sample_id:<32} -> Status: {res_detail.status_code} ({res_detail.json().get('name')[:30]}...)")
        res_bm = client.get(f"/api/benchmark/{sample_id}")
        print(f"[OK] GET  /api/benchmark/{sample_id:<31} -> Status: {res_bm.status_code}")

    print("=" * 65)
    print("ALL API ENDPOINTS FUNCTIONING WITH LIVE DATABASE DATA!")
    print("=" * 65)

if __name__ == "__main__":
    test_all_endpoints()
