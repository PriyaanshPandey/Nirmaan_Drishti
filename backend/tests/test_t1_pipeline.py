"""
test_t1_pipeline.py - Comprehensive Test Suite for T+1 Next-Period Strategy.

Verifies:
1. Target Creation:
   - T+1 target is genuinely future data (shifted from T+1).
   - Zero current target leakage.
   - Projects are grouped strictly by project identity.
   - Chronological ordering is preserved.
2. Feature Matrix:
   - No forbidden future or target features in X(T).
   - Expected feature count and naming.
   - Alignment between training and inference preprocessors.
3. Model Artifacts:
   - Production artifacts exist in ai/models/.
   - All models load successfully into memory.
   - Prediction probabilities strictly in [0.0, 1.0].
   - Both targets produce valid risk predictions.
4. Inference Contract:
   - Current project snapshot can be scored.
   - Output contains T+1 fields (schedule_delay_probability, cost_overrun_probability, risk_score).
   - No obsolete 3M/6M forecast fields or stale models loaded.
5. SHAP Explanations:
   - Feature names align with model input dimensionality.
   - Local explanations return top risk drivers and protective factors with valid signs.
"""

import os
import sys
import json
from pathlib import Path
import pytest
import numpy as np
import pandas as pd
import joblib

WORKSPACE_ROOT = Path(__file__).resolve().parent.parent.parent
sys.path.insert(0, str(WORKSPACE_ROOT))
sys.path.insert(0, str(WORKSPACE_ROOT / "ai"))

from ai.src.t1_pipeline import (
    get_t1_feature_definitions,
    assert_zero_leakage,
    construct_t1_targets,
    construct_t1_regression_targets,
    apply_chronological_splits,
    FORBIDDEN_LEAKAGE_TERMS
)
from ai.src.predict import load_all_models, predict_t1
from ai.src.explain import get_shap_explanation
from ai.src.project_service import get_full_prediction


# ============================================================================
# 1. TARGET CREATION TESTS
# ============================================================================

def test_t1_target_is_future_data():
    """Verify that T+1 target corresponds strictly to the next observation period."""
    # Synthetic chronological panel with 2 projects
    data = {
        "effective_project_key": ["P1", "P1", "P1", "P2", "P2"],
        "report_month": pd.to_datetime(["2024-01-01", "2024-02-01", "2024-03-01", "2024-01-01", "2024-02-01"]),
        "schedule_extension_months": [0.0, 5.0, 10.0, 0.0, 0.0],
        "original_cost_cr": [100.0, 100.0, 100.0, 200.0, 200.0],
        "cumulative_expenditure_cr": [50.0, 120.0, 150.0, 100.0, 110.0],
    }
    df = pd.DataFrame(data)

    df_usable, stats = construct_t1_targets(df)

    # 1. Total usable rows drops terminal observations (P1 month 3, P2 month 2)
    assert len(df_usable) == 3, f"Expected 3 rows with valid T+1, got {len(df_usable)}"
    assert stats["rows_dropped"] == 2

    # 2. P1 at T=Jan (index 0) sees T+1=Feb:
    # Schedule delay at Feb is 5.0 >= 1.0 -> target must be 1
    # Cum exp at Feb is 120.0 > orig_cost 100.0 -> cost overrun must be 1
    row_p1_t1 = df_usable[(df_usable["effective_project_key"] == "P1") & (df_usable["report_month"] == "2024-01-01")].iloc[0]
    assert row_p1_t1["future_schedule_delay"] == 1
    assert row_p1_t1["future_cost_overrun"] == 1

    # 3. P2 at T=Jan sees T+1=Feb:
    # Schedule delay at Feb is 0.0 < 1.0 -> target must be 0
    # Cum exp at Feb is 110.0 <= orig_cost 200.0 -> cost overrun must be 0
    row_p2_t1 = df_usable[(df_usable["effective_project_key"] == "P2") & (df_usable["report_month"] == "2024-01-01")].iloc[0]
    assert row_p2_t1["future_schedule_delay"] == 0
    assert row_p2_t1["future_cost_overrun"] == 0


def test_zero_current_target_leakage():
    """Verify that current row's target at T is NOT used as T+1 target."""
    # Current row at T has delay 10.0, but T+1 recovers to 0.0 delay
    data = {
        "effective_project_key": ["P_TEST", "P_TEST"],
        "report_month": pd.to_datetime(["2024-01-01", "2024-02-01"]),
        "schedule_extension_months": [10.0, 0.0],  # Recovers at T+1
        "original_cost_cr": [100.0, 100.0],
        "cumulative_expenditure_cr": [150.0, 80.0],  # Audit revision at T+1
    }
    df = pd.DataFrame(data)
    df_usable, _ = construct_t1_targets(df)

    # At T=2024-01-01, current delay is 10 (delayed), but future is 0 (ontime)
    # Target MUST be 0 (derived from T+1, NOT T)
    row = df_usable.iloc[0]
    assert row["future_schedule_delay"] == 0, "Current delay at T leaked into target!"
    assert row["future_cost_overrun"] == 0, "Current cost overrun at T leaked into target!"


def test_chronological_ordering_and_grouping():
    """Verify projects are strictly grouped and sorted chronologically."""
    # Shuffled input order
    data = {
        "effective_project_key": ["P2", "P1", "P2", "P1"],
        "report_month": pd.to_datetime(["2024-02-01", "2024-02-01", "2024-01-01", "2024-01-01"]),
        "schedule_extension_months": [5.0, 8.0, 0.0, 2.0],
        "original_cost_cr": [100.0, 100.0, 100.0, 100.0],
        "cumulative_expenditure_cr": [50.0, 50.0, 50.0, 50.0],
    }
    df = pd.DataFrame(data)
    df_usable, _ = construct_t1_targets(df)

    p1_rows = df_usable[df_usable["effective_project_key"] == "P1"]
    p2_rows = df_usable[df_usable["effective_project_key"] == "P2"]

    assert len(p1_rows) == 1
    assert len(p2_rows) == 1
    assert p1_rows.iloc[0]["report_month"] == pd.Timestamp("2024-01-01")
    assert p1_rows.iloc[0]["future_schedule_delay"] == 1  # sees month 2 delay (8.0)
    assert p2_rows.iloc[0]["future_schedule_delay"] == 1  # sees month 2 delay (5.0)


# ============================================================================
# 2. FEATURE MATRIX & LEAKAGE TESTS
# ============================================================================

def test_feature_matrix_leakage_assertion():
    """Verify that assert_zero_leakage raises error on any forbidden term."""
    clean_cols = ["original_cost_cr", "physical_progress_pct", "sector", "agency"]
    assert_zero_leakage(clean_cols)  # Must pass

    for forbidden in FORBIDDEN_LEAKAGE_TERMS:
        with pytest.raises(ValueError, match="DATA LEAKAGE DETECTED"):
            assert_zero_leakage(clean_cols + [f"sample_{forbidden}_feature"])


def test_t1_feature_definitions_count_and_types():
    """Verify expected feature counts and zero forbidden columns in production features."""
    cat_cols, num_cols = get_t1_feature_definitions()
    assert len(cat_cols) == 4, f"Expected 4 categoricals, got {len(cat_cols)}"
    assert len(num_cols) >= 100, f"Expected >=100 numerics, got {len(num_cols)}"
    assert_zero_leakage(cat_cols + num_cols)


# ============================================================================
# 3. MODEL ARTIFACTS & INTEGRITY TESTS
# ============================================================================

def test_production_artifacts_exist():
    """Verify all required production model files exist on disk."""
    models_dir = WORKSPACE_ROOT / "ai" / "models"
    required_paths = [
        models_dir / "schedule_delay" / "production_model.pkl",
        models_dir / "schedule_delay" / "preprocessor.joblib",
        models_dir / "cost_overrun" / "production_model.pkl",
        models_dir / "cost_overrun" / "preprocessor.joblib",
        models_dir / "anomaly_detector" / "production_anomaly_detector.pkl",
        models_dir / "anomaly_detector" / "preprocessor.joblib",
        models_dir / "shap" / "transformed_feature_names.json",
        models_dir / "model_metadata.json",
    ]
    for path in required_paths:
        assert path.exists(), f"Required production artifact missing: {path}"


def test_models_load_successfully():
    """Verify all production models load into memory via load_all_models()."""
    models = load_all_models()
    assert "schedule_delay_model" in models
    assert "schedule_delay_preprocessor" in models
    assert "cost_overrun_model" in models
    assert "cost_overrun_preprocessor" in models
    assert "anomaly_detector" in models
    assert "transformed_feature_names" in models


def test_prediction_probabilities_valid_range():
    """Verify models produce valid probabilities in [0.0, 1.0]."""
    models = load_all_models()
    cat_cols, num_cols = get_t1_feature_definitions()

    # Synthetic sample row
    sample = {c: [0.0] for c in num_cols}
    sample.update({c: ["UNKNOWN"] for c in cat_cols})
    sample["original_cost_cr"] = [1000.0]
    sample["cumulative_expenditure_cr"] = [500.0]
    sample["physical_progress_pct"] = [50.0]
    sample_df = pd.DataFrame(sample)

    current_status = {
        "cost_overrun_pct": 0.0,
        "cost_escalation_crore": 0.0,
        "original_cost_crore": 1000.0,
        "schedule_extension_months": 0.0
    }

    pred = predict_t1(sample_df, models, current_status)

    assert 0.0 <= pred["schedule_delay_probability"] <= 1.0
    assert 0.0 <= pred["cost_overrun_probability"] <= 1.0
    assert pred["schedule_delay_flag"] in (0, 1)
    assert pred["cost_overrun_flag"] in (0, 1)
    assert 0.0 <= pred["risk_score"] <= 100.0
    assert pred["risk_level"] in ("Low", "Medium", "High", "Critical")
    assert isinstance(pred["is_anomaly"], bool)


# ============================================================================
# 4. INFERENCE CONTRACT TESTS
# ============================================================================

def test_inference_end_to_end_project_scoring():
    """Verify real-world project can be scored end-to-end via get_full_prediction."""
    models = load_all_models()
    from ai.src.data_loader import load_master_csv, load_config

    config = load_config()
    df = load_master_csv(None, config)

    res = get_full_prediction("400005", df, models)
    assert res["project_id"] == "400005"
    assert "schedule_delay_probability" in res
    assert "cost_overrun_probability" in res
    assert "risk_score" in res
    assert "t1_prediction" in res

    # Verify no stale 3M/6M regression output
    t1 = res["t1_prediction"]
    assert "predicted_3m" not in t1
    assert "predicted_6m" not in t1
    assert "forecast_3m" not in t1
    assert "forecast_6m" not in t1


# ============================================================================
# 5. SHAP EXPLANATION ALIGNMENT TESTS
# ============================================================================

def test_shap_explanation_feature_alignment():
    """Verify SHAP explanations use production feature names and return drivers."""
    models = load_all_models()
    sched_model = models["schedule_delay_model"]
    sched_prep = models["schedule_delay_preprocessor"]
    transformed_names = models["transformed_feature_names"]

    cat_cols, num_cols = get_t1_feature_definitions()
    sample = {c: [0.0] for c in num_cols}
    sample.update({c: ["UNKNOWN"] for c in cat_cols})
    sample["schedule_extension_months"] = [24.0]
    sample["delay_roll_mean_3m"] = [20.0]
    sample_df = pd.DataFrame(sample)

    X = sched_prep.transform(sample_df)
    assert X.shape[1] == len(transformed_names), "Dimensionality mismatch between preprocessor and SHAP names!"

    exp = get_shap_explanation(sched_model, X, transformed_names, top_n=5)
    assert "top_risk_drivers" in exp
    assert "top_protective_factors" in exp
    assert "base_value" in exp
    assert len(exp["top_risk_drivers"]) <= 5
    for driver in exp["top_risk_drivers"]:
        assert driver["shap_value"] > 0, "Risk driver must have positive SHAP value!"
        assert driver["feature"] in transformed_names


# ============================================================================
# 6. T+1 REGRESSION TARGET CREATION & INTEGRITY TESTS
# ============================================================================

def test_t1_regression_targets_calculation():
    """Verify continuous T+1 regression targets are correctly computed with zero leakage."""
    data = {
        "effective_project_key": ["P1", "P1", "P1", "P2", "P2"],
        "report_month": pd.to_datetime(["2024-01-01", "2024-02-01", "2024-03-01", "2024-01-01", "2024-02-01"]),
        "schedule_extension_months": [5.0, 8.0, 14.0, 2.0, 2.0],
        "original_cost_cr": [100.0, 100.0, 100.0, 500.0, 500.0],
        "revised_cost_cr": [100.0, 120.0, 150.0, 500.0, 550.0],
        "cumulative_expenditure_cr": [20.0, 50.0, 90.0, 100.0, 200.0],
    }
    df = pd.DataFrame(data)
    df_usable, stats = construct_t1_regression_targets(df)

    # 1. Dropped terminal rows (P1 month 3, P2 month 2)
    assert len(df_usable) == 3
    assert stats["rows_dropped"] == 2

    # 2. Project P1 at T=Jan:
    # Next period T+1 is Feb:
    # Future delay = 8.0
    # Delay delta = 8.0 - 5.0 = 3.0
    # Future revised cost = 120.0
    # Cost multiplier = 120.0 / 100.0 = 1.2
    # Future cost overrun pct = (120 - 100) / 100 * 100 = 20.0%
    p1_jan = df_usable[(df_usable["effective_project_key"] == "P1") & (df_usable["report_month"] == "2024-01-01")].iloc[0]
    assert np.isclose(p1_jan["future_delay_months"], 8.0)
    assert np.isclose(p1_jan["target_delta_delay_months"], 3.0)
    assert np.isclose(p1_jan["target_cost_multiplier"], 1.2)
    assert np.isclose(p1_jan["future_anticipated_cost"], 120.0)
    assert np.isclose(p1_jan["target_future_cost_overrun_pct"], 20.0)

    # 3. Project P1 at T=Feb:
    # Next period T+1 is Mar:
    # Future delay = 14.0
    # Delay delta = 14.0 - 8.0 = 6.0
    # Future revised cost = 150.0
    # Cost multiplier = 150.0 / 100.0 = 1.50 (relative to orig_cost)
    p1_feb = df_usable[(df_usable["effective_project_key"] == "P1") & (df_usable["report_month"] == "2024-02-01")].iloc[0]
    assert np.isclose(p1_feb["future_delay_months"], 14.0)
    assert np.isclose(p1_feb["target_delta_delay_months"], 6.0)
    assert np.isclose(p1_feb["target_cost_multiplier"], 1.50)

    # 4. Project P2 at T=Jan:
    # Next period T+1 is Feb:
    # Delay delta = 2.0 - 2.0 = 0.0
    # Cost multiplier = 550.0 / 500.0 = 1.10
    p2_jan = df_usable[(df_usable["effective_project_key"] == "P2") & (df_usable["report_month"] == "2024-01-01")].iloc[0]
    assert np.isclose(p2_jan["future_delay_months"], 2.0)
    assert np.isclose(p2_jan["target_delta_delay_months"], 0.0)
    assert np.isclose(p2_jan["target_cost_multiplier"], 1.10)


# ============================================================================
# 7. REGRESSION MODEL ARTIFACTS & INTEGRATION TESTS
# ============================================================================

def test_production_regression_artifacts_exist():
    """Verify continuous regression models and metadata exist in ai/models/."""
    models_dir = WORKSPACE_ROOT / "ai" / "models"
    required_paths = [
        models_dir / "schedule_regression" / "production_model.pkl",
        models_dir / "schedule_regression" / "preprocessor.joblib",
        models_dir / "cost_regression" / "production_model.pkl",
        models_dir / "cost_regression" / "preprocessor.joblib",
        models_dir / "shap" / "regression_schedule_feature_importance.json",
        models_dir / "shap" / "regression_cost_feature_importance.json",
    ]
    for path in required_paths:
        assert path.exists(), f"Required regression artifact missing: {path}"


def test_regression_models_load_successfully():
    """Verify production regression models load into memory via load_all_models()."""
    models = load_all_models()
    assert "schedule_regression_model" in models
    assert "schedule_regression_preprocessor" in models
    assert "cost_regression_model" in models
    assert "cost_regression_preprocessor" in models


def test_continuous_regression_inference_and_consistency():
    """Verify predict_t1 produces continuous regression outputs that are physically and mathematically consistent."""
    models = load_all_models()
    cat_cols, num_cols = get_t1_feature_definitions()

    sample = {c: [0.0] for c in num_cols}
    sample.update({c: ["UNKNOWN"] for c in cat_cols})
    orig_cost = 2000.0
    curr_revised = 2200.0
    curr_delay = 12.0

    sample["original_cost_cr"] = [orig_cost]
    sample["revised_cost_cr"] = [curr_revised]
    sample["cumulative_expenditure_cr"] = [1100.0]
    sample["schedule_extension_months"] = [curr_delay]
    sample["physical_progress_pct"] = [65.0]
    sample_df = pd.DataFrame(sample)

    current_status = {
        "cost_overrun_pct": 10.0,
        "cost_escalation_crore": 200.0,
        "original_cost_crore": orig_cost,
        "revised_cost_crore": curr_revised,
        "schedule_extension_months": curr_delay,
    }

    pred = predict_t1(sample_df, models, current_status)

    # 1. Schedule regression checks
    assert "predicted_schedule_delay_months" in pred
    assert pred["predicted_schedule_delay_months"] is not None
    assert pred["predicted_schedule_delay_months"] >= 0.0
    assert isinstance(pred["predicted_additional_delay_months"], (int, float))

    # 2. Cost regression checks
    assert "predicted_cost_multiplier" in pred
    assert pred["predicted_cost_multiplier"] is not None
    assert pred["predicted_cost_multiplier"] > 0.0

    assert "predicted_future_cost_crore" in pred
    assert pred["predicted_future_cost_crore"] is not None
    assert pred["predicted_future_cost_crore"] > 0.0

    # 3. Mathematical consistency:
    # Future Cost = orig_cost * predicted_cost_multiplier
    expected_future_cost = orig_cost * pred["predicted_cost_multiplier"]
    assert np.isclose(pred["predicted_future_cost_crore"], expected_future_cost, rtol=1e-3)

    # Escalation = Future Cost - Original Cost
    expected_escalation = pred["predicted_future_cost_crore"] - orig_cost
    assert np.isclose(pred["predicted_final_cost_escalation_crore"], expected_escalation, rtol=1e-3)

    # Overrun % = (Future Cost - Original Cost) / Original Cost * 100
    expected_overrun_pct = (expected_escalation / orig_cost) * 100.0
    assert np.isclose(pred["predicted_cost_overrun_pct"], expected_overrun_pct, atol=0.01)
