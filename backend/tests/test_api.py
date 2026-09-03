"""
Comprehensive Backend Test Suite.
Tests database connectivity, CRUD APIs, dashboard aggregations, risk predictions, and AI assistant.
"""
import sys
from pathlib import Path
import pytest

# Ensure backend root is in sys.path
backend_dir = Path(__file__).resolve().parent.parent
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

from fastapi.testclient import TestClient
from app.main import app
from app.database import check_db_connection

client = TestClient(app)


def test_database_connection():
    """Verify that PostgreSQL is connected."""
    assert check_db_connection() is True


def test_health_endpoint():
    """Test GET /api/health returns ok status and connected DB."""
    response = client.get("/api/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    assert data["database"] == "connected"


def test_get_projects_list():
    """Test GET /api/projects pagination and structure."""
    response = client.get("/api/projects?page=1&page_size=10")
    assert response.status_code == 200
    data = response.json()
    assert "items" in data
    assert "total" in data
    assert data["total"] > 0
    assert len(data["items"]) == 10
    first = data["items"][0]
    assert "id" in first
    assert "name" in first
    assert "costRevised" in first


def test_filter_projects_by_status():
    """Test filtering projects by schedule status."""
    response = client.get("/api/projects?schedule_status=DELAYED&page_size=5")
    assert response.status_code == 200
    data = response.json()
    for item in data["items"]:
        assert "DELAY" in item["schedule_status"].upper()


def test_get_project_detail():
    """Test GET /api/projects/{id} with milestones and progress."""
    list_res = client.get("/api/projects?page_size=1")
    project_id = list_res.json()["items"][0]["id"]

    response = client.get(f"/api/projects/{project_id}")
    assert response.status_code == 200
    data = response.json()
    assert data["id"] == project_id
    assert "milestones" in data
    assert "progress_records" in data


def test_project_not_found():
    """Test 404 response for invalid project ID."""
    response = client.get("/api/projects/non-existent-id-999999")
    assert response.status_code == 404


def test_dashboard_summary():
    """Test GET /api/dashboard/summary dynamic calculations."""
    response = client.get("/api/dashboard/summary")
    assert response.status_code == 200
    data = response.json()
    assert "metrics" in data
    assert "health_distribution" in data
    assert "priority_interventions" in data
    assert "delay_factors" in data
    assert "risk_trend" in data
    assert "ai_action_center" in data
    assert data["total_projects"] > 0
    assert data["metrics"]["total_projects"] > 0
    assert len(data["health_distribution"]) == 4


def test_risk_summary():
    """Test GET /api/risk/summary analytics."""
    response = client.get("/api/risk/summary")
    assert response.status_code == 200
    data = response.json()
    assert "total_analyzed" in data
    assert data["total_analyzed"] > 0
    assert "high_risk_count" in data
    assert "avg_risk_score" in data


def test_alerts_action_center():
    """Test GET /api/alerts/summary."""
    response = client.get("/api/alerts/summary")
    assert response.status_code == 200
    data = response.json()
    assert "action_items" in data
    assert len(data["action_items"]) > 0
    assert "simulator_scenarios" in data


def test_project_benchmark():
    """Test GET /api/benchmark/{project_id}."""
    list_res = client.get("/api/projects?page_size=1")
    project_id = list_res.json()["items"][0]["id"]

    response = client.get(f"/api/benchmark/{project_id}")
    assert response.status_code == 200
    data = response.json()
    assert data["project_id"] == project_id
    assert "cost_benchmark" in data
    assert "delay_benchmark" in data


def test_assistant_query():
    """Test POST /api/assistant/query."""
    response = client.post("/api/assistant/query", json={"query": "What are the major delay factors?"})
    assert response.status_code == 200
    data = response.json()
    assert "answer" in data
    assert len(data["answer"]) > 20
