"""
Unit and API integration tests for mutually exclusive Project Status Segregation:
  - Ongoing (1,379)
  - Inactive (2,328)
  - Completed (1,442)
  - Total (5,149)
"""
import sys
from pathlib import Path
import pytest
from fastapi.testclient import TestClient

BACKEND_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BACKEND_DIR))

from app.main import app
from app.database import SessionLocal
from app.models.project import Project
from app.routes.projects import format_project_response


@pytest.fixture(scope="module")
def client():
    with TestClient(app) as c:
        # Obtain demo token
        resp = c.post("/api/auth/login", json={"username": "ipmd001", "password": "ipmd123"})
        assert resp.status_code == 200, f"Auth login failed: {resp.text}"
        token = resp.json()["access_token"]
        c.headers.update({"Authorization": f"Bearer {token}"})
        yield c


class TestProjectStatusSegregation:

    def test_status_counts_reconciliation(self, client):
        """Test /api/projects/status-counts returns exact reconciled counts."""
        resp = client.get("/api/projects/status-counts")
        assert resp.status_code == 200
        data = resp.json()

        assert data["ongoing"] == 1379, f"Expected 1,379 ongoing projects, got {data['ongoing']}"
        assert data["inactive"] == 2328, f"Expected 2,328 inactive projects, got {data['inactive']}"
        assert data["completed"] == 1442, f"Expected 1,442 completed projects, got {data['completed']}"
        assert data["total"] == 5149, f"Expected 5,149 total projects, got {data['total']}"

        # Strict mutual exclusivity
        assert data["total"] == data["ongoing"] + data["inactive"] + data["completed"]

    def test_projects_query_filtering_mutually_exclusive(self, client):
        """Test each status filter returns the exact authoritative count."""
        resp_ong = client.get("/api/projects?status=ongoing&page_size=1")
        assert resp_ong.status_code == 200
        assert resp_ong.json()["total"] == 1379

        resp_inact = client.get("/api/projects?status=inactive&page_size=1")
        assert resp_inact.status_code == 200
        assert resp_inact.json()["total"] == 2328

        resp_comp = client.get("/api/projects?status=completed&page_size=1")
        assert resp_comp.status_code == 200
        assert resp_comp.json()["total"] == 1442

        resp_all = client.get("/api/projects?page_size=1")
        assert resp_all.status_code == 200
        assert resp_all.json()["total"] == 5149

    def test_representative_project_709858_not_completed(self, client):
        """
        Verify project 709858 (with physical_progress = 100.0%) is classified as
        Inactive and NOT mutated into Completed.
        """
        resp = client.get("/api/projects/709858")
        assert resp.status_code == 200
        data = resp.json()

        assert data["status"] == "inactive", f"Expected status='inactive', got '{data['status']}'"
        assert data["project_status"] == "INACTIVE", f"Expected project_status='INACTIVE', got '{data['project_status']}'"
        assert data["isCompleted"] is False, f"Expected isCompleted=False, got {data['isCompleted']}"
        assert data["physical_progress"] >= 100.0, "Project 709858 should have 100% progress"

    def test_representative_ongoing_active_project(self, client):
        """Verify standard ongoing active project classification."""
        resp = client.get("/api/projects/400006")
        assert resp.status_code == 200
        data = resp.json()

        assert data["status"] == "ongoing"
        assert data["project_status"] == "ONGOING"
        assert data["isCompleted"] is False

    def test_representative_completed_project(self, client):
        """Verify standard completed project classification."""
        resp = client.get("/api/projects/060100093")
        assert resp.status_code == 200
        data = resp.json()

        assert data["status"] == "completed"
        assert data["project_status"] == "COMPLETED"
        assert data["isCompleted"] is True

    def test_format_project_response_direct(self):
        """Unit test format_project_response function directly."""
        db = SessionLocal()
        try:
            # 709858 test
            p = db.query(Project).filter(Project.id == "709858").first()
            assert p is not None
            res = format_project_response(p)
            assert res["status"] == "inactive"
            assert res["project_status"] == "INACTIVE"
            assert res["isCompleted"] is False
        finally:
            db.close()
