"""
Comprehensive Unit & Integration Test Suite for Centralized Risk Engine.

Verifies:
1. Determinism (same inputs produce identical outputs).
2. Monotonicity (increasing cost/schedule overrun never decreases risk).
3. Boundedness ([0, 100] strict bounds for all components and overall score).
4. Boundary & edge conditions (negatives, zero, extreme values, None/NaN).
5. Centralized Risk Level mapping (Low, Medium, High, Critical).
6. Configurable weight parameters.
7. API response format conformity with the centralized risk architecture.
"""
import sys
import math
from pathlib import Path
import pytest

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

from app.services.risk_engine import (
    calculate_risk_score,
    get_risk_level,
    DEFAULT_WEIGHT_COST,
    DEFAULT_WEIGHT_SCHEDULE,
    RiskScoreResult,
)
from fastapi.testclient import TestClient
from app.main import app
from app.database import SessionLocal, check_db_connection
from app.models.project import Project

client = TestClient(app)


class TestRiskEngineCore:
    """Core mathematical and statistical unit tests for Risk Engine."""

    def test_determinism(self):
        """Verify that identical inputs produce exactly the same risk score, tier, and components."""
        inputs = [
            (0.0, 0.0),
            (15.5, 6.0),
            (40.77, 25.0),
            (92.25, 48.0),
            (250.0, 100.0),
        ]
        for cost_val, delay_val in inputs:
            res1 = calculate_risk_score(cost_val, delay_val)
            res2 = calculate_risk_score(cost_val, delay_val)
            assert res1.risk_score == res2.risk_score
            assert res1.risk_level == res2.risk_level
            assert res1.cost_risk_component == res2.cost_risk_component
            assert res1.schedule_risk_component == res2.schedule_risk_component

    def test_monotonicity_cost_overrun(self):
        """Increasing predicted cost overrun must never decrease cost risk component or total score."""
        fixed_delay = 12.0
        cost_steps = [-10.0, 0.0, 2.0, 5.0, 10.0, 20.0, 40.0, 60.0, 100.0, 200.0, 500.0, 6000.0]

        prev_cost_risk = -1.0
        prev_score = -1.0
        for c in cost_steps:
            res = calculate_risk_score(c, fixed_delay)
            assert res.cost_risk_component >= prev_cost_risk, f"Cost risk decreased from {prev_cost_risk} to {res.cost_risk_component} at cost {c}"
            assert res.risk_score >= prev_score, f"Total risk decreased from {prev_score} to {res.risk_score} at cost {c}"
            prev_cost_risk = res.cost_risk_component
            prev_score = res.risk_score

    def test_monotonicity_schedule_delay(self):
        """Increasing predicted schedule delay must never decrease schedule risk component or total score."""
        fixed_cost = 25.0
        delay_steps = [-6.0, 0.0, 1.0, 3.0, 6.0, 12.0, 24.0, 36.0, 48.0, 72.0, 120.0, 400.0]

        prev_sched_risk = -1.0
        prev_score = -1.0
        for d in delay_steps:
            res = calculate_risk_score(fixed_cost, d)
            assert res.schedule_risk_component >= prev_sched_risk, f"Schedule risk decreased from {prev_sched_risk} to {res.schedule_risk_component} at delay {d}"
            assert res.risk_score >= prev_score, f"Total risk decreased from {prev_score} to {res.risk_score} at delay {d}"
            prev_sched_risk = res.schedule_risk_component
            prev_score = res.risk_score

    def test_boundary_and_null_inputs(self):
        """Inputs <= 0, None, NaN must yield 0.0 risk, and extreme inputs must not exceed 100.0."""
        # Zero and negative values
        zero_res = calculate_risk_score(0.0, 0.0)
        assert zero_res.risk_score == 0.0
        assert zero_res.risk_level == "Low"
        assert zero_res.cost_risk_component == 0.0
        assert zero_res.schedule_risk_component == 0.0

        neg_res = calculate_risk_score(-25.0, -12.0)
        assert neg_res.risk_score == 0.0
        assert neg_res.risk_level == "Low"
        assert neg_res.cost_risk_component == 0.0
        assert neg_res.schedule_risk_component == 0.0

        # None inputs
        none_res = calculate_risk_score(None, None)
        assert none_res.risk_score == 0.0
        assert none_res.risk_level == "Low"

        # NaN inputs
        nan_res = calculate_risk_score(float("nan"), float("nan"))
        assert nan_res.risk_score == 0.0
        assert nan_res.risk_level == "Low"

        # Extremely high values capped at 100.0
        extreme_res = calculate_risk_score(100000.0, 5000.0)
        assert extreme_res.risk_score == 100.0
        assert extreme_res.risk_level == "Critical"
        assert extreme_res.cost_risk_component == 100.0
        assert extreme_res.schedule_risk_component == 100.0

    def test_strict_boundedness(self):
        """All output components and total scores must strictly be within [0.0, 100.0]."""
        test_cases = [
            (-50, -20), (0, 0), (0.1, 0.5), (10, 5), (35, 18),
            (75, 40), (150, 80), (500, 200), (9999, 9999)
        ]
        for cost, delay in test_cases:
            res = calculate_risk_score(cost, delay)
            assert 0.0 <= res.risk_score <= 100.0
            assert 0.0 <= res.cost_risk_component <= 100.0
            assert 0.0 <= res.schedule_risk_component <= 100.0

    def test_risk_level_mapping(self):
        """Verify centralized risk level tier mapping."""
        # Low: [0, 35)
        assert get_risk_level(0.0) == "Low"
        assert get_risk_level(20.0) == "Low"
        assert get_risk_level(34.9) == "Low"

        # Medium: [35, 60)
        assert get_risk_level(35.0) == "Medium"
        assert get_risk_level(50.0) == "Medium"
        assert get_risk_level(59.9) == "Medium"

        # High: [60, 80)
        assert get_risk_level(60.0) == "High"
        assert get_risk_level(70.0) == "High"
        assert get_risk_level(79.9) == "High"

        # Critical: [80, 100]
        assert get_risk_level(80.0) == "Critical"
        assert get_risk_level(95.0) == "Critical"
        assert get_risk_level(100.0) == "Critical"

    def test_configurable_weights(self):
        """Verify that weights can be adjusted and properly shift the composite score."""
        # Cost risk high (92% overrun -> ~75 risk), Schedule risk 0 (0 delay -> 0 risk)
        res_equal = calculate_risk_score(92.25, 0.0, weight_cost=0.5, weight_schedule=0.5)
        assert 35.0 <= res_equal.risk_score <= 40.0

        # Cost only (100% cost weight)
        res_cost_only = calculate_risk_score(92.25, 0.0, weight_cost=1.0, weight_schedule=0.0)
        assert round(res_cost_only.risk_score) == round(res_cost_only.cost_risk_component)

        # Schedule only (100% schedule weight -> score should be 0 since delay is 0)
        res_sched_only = calculate_risk_score(92.25, 0.0, weight_cost=0.0, weight_schedule=1.0)
        assert res_sched_only.risk_score == 0.0


@pytest.mark.skipif(not check_db_connection(), reason="Live PostgreSQL database is offline")
class TestRiskAPIIntegration:
    """Integration tests verifying API endpoints return dynamic risk fields."""

    @pytest.fixture
    def sample_project_id(self):
        """Get an active project ID from database."""
        db = SessionLocal()
        try:
            proj = db.query(Project).first()
            assert proj is not None, "At least one project must exist in DB for testing"
            return proj.id
        finally:
            db.close()

    def test_project_endpoint_contains_risk_components(self, sample_project_id):
        """Verify GET /api/projects/{id} contains centralized risk engine fields."""
        response = client.get(f"/api/projects/{sample_project_id}")
        assert response.status_code == 200
        data = response.json()

        assert "risk_score" in data
        assert "risk_level" in data
        assert "cost_risk_component" in data
        assert "schedule_risk_component" in data
        assert "predicted_cost_overrun" in data
        assert "predicted_schedule_delay" in data
        assert 0 <= data["risk_score"] <= 100
        assert data["risk_level"] in ["Low", "Medium", "High", "Critical"]

    def test_predict_endpoint_returns_centralized_risk_response(self, sample_project_id):
        """Verify POST /api/risk/projects/{id}/predict returns all 6 required fields."""
        response = client.post(f"/api/risk/projects/{sample_project_id}/predict?horizon=3")
        assert response.status_code == 200
        data = response.json()

        # Check all 6 required fields specified by user
        assert "predicted_cost_overrun" in data
        assert "predicted_schedule_delay" in data
        assert "risk_score" in data
        assert "risk_level" in data
        assert "cost_risk_component" in data
        assert "schedule_risk_component" in data

        # Value validations
        assert data["risk_score"] is not None
        assert 0 <= data["risk_score"] <= 100
        assert data["risk_level"] in ["Low", "Medium", "High", "Critical"]
        assert data["cost_risk_component"] is not None
        assert 0 <= data["cost_risk_component"] <= 100
        assert data["schedule_risk_component"] is not None
        assert 0 <= data["schedule_risk_component"] <= 100

    def test_risk_summary_endpoint(self):
        """Verify GET /api/risk/summary returns aligned categories."""
        response = client.get("/api/risk/summary")
        assert response.status_code == 200
        data = response.json()

        assert "total_analyzed" in data
        assert "high_risk_count" in data
        assert "distribution_categories" in data
        assert len(data["distribution_categories"]) == 4
