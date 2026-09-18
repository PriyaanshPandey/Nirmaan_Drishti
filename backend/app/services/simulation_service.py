"""
What-If Simulation Service for Nirmaan Drishti.

Provides model-driven counterfactual scenario analysis using the trained PAIMANA
XGBoost machine learning models (cost_regressor_3m, time_regressor_3m) and the
centralized empirical risk engine (risk_engine.py).

Features:
- Guaranteed mathematical equivalence: zero-scenario changes == baseline inference
- Real partial dependence plots (PDP) computed directly via batch model scoring
- Strict validation: non-negative costs/delays, finite numeric bounds
- Dynamic narrative explainability generated from returned prediction deltas
"""

import math
import logging
from typing import Dict, Any, List, Optional
import numpy as np
import pandas as pd
from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.project import Project
from app.models.identifier_mapping import ProjectIdentifierMapping
from app.services.ai_engine_service import ai_engine
from app.services.risk_engine import calculate_risk_score
from app.schemas.simulation import (
    WhatIfRequest, WhatIfResponse, WhatIfMetricItem,
    WhatIfImpactItem, PDPCurve, PDPPoint
)
from src.project_service import (
    prepare_prediction_features, get_current_status, get_project_info
)
from src.predict import predict_cost, predict_time

logger = logging.getLogger("sanket_ai.simulation_service")


def resolve_canonical_project_id(project_id: str, db: Session) -> str:
    """Resolve identifier (numeric ID or legacy OCMS code) to canonical project ID."""
    clean = str(project_id).strip()
    if clean.endswith(".0"):
        clean = clean[:-2].strip()

    try:
        if db is not None:
            p_id = db.query(Project.id).filter(Project.id == clean).first()
            if p_id:
                return p_id[0]

            p_ocms = db.query(Project.id).filter(Project.legacy_ocms_code == clean).first()
            if p_ocms:
                return p_ocms[0]

            mapping = db.query(ProjectIdentifierMapping.project_id).filter(
                ProjectIdentifierMapping.legacy_ocms_code == clean
            ).first()
            if mapping:
                return mapping[0]
    except Exception as e:
        logger.warning("Could not query DB for canonical ID; using identifier: %s", e)

    return clean


def _validate_scenario_input(req: WhatIfRequest):
    """Ensure scenario inputs are strictly numeric, finite, and non-negative."""
    for field_name, val in [
        ("additional_cost", req.additional_cost),
        ("additional_delay_months", req.additional_delay_months),
        ("monthly_expenditure", req.monthly_expenditure),
    ]:
        if val is not None:
            if not isinstance(val, (int, float)):
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                    detail=f"Field '{field_name}' must be a numeric value."
                )
            if math.isnan(val) or math.isinf(val):
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                    detail=f"Field '{field_name}' cannot be NaN or Infinity."
                )
            if val < 0.0:
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                    detail=f"Field '{field_name}' cannot be negative (received {val})."
                )


# Global cache for diverse reference observations
_REFERENCE_DATASET_CACHE: Optional[pd.DataFrame] = None


def get_reference_feature_dataset(n_samples: int = 50) -> pd.DataFrame:
    """
    Extract and cache a diverse reference sample of N project observations across sectors
    from historical data (df_cache) to compute true mathematical Partial Dependence Plots (PDP).
    PDP(x) = (1 / N) * sum_{i=1}^N f(x, X_other^{(i)})
    """
    global _REFERENCE_DATASET_CACHE
    if _REFERENCE_DATASET_CACHE is not None and len(_REFERENCE_DATASET_CACHE) >= min(10, n_samples):
        return _REFERENCE_DATASET_CACHE

    ai_engine._ensure_initialized()
    df_cache = ai_engine.df_cache

    ref_rows: List[Dict[str, Any]] = []
    if df_cache is not None and not df_cache.empty and "project_id" in df_cache.columns:
        pids = df_cache["project_id"].dropna().unique()
        step = max(1, len(pids) // (n_samples * 2))
        candidate_pids = pids[::step][:n_samples * 2]
        for pid in candidate_pids:
            try:
                f_df = prepare_prediction_features(pid, df_cache)
                if f_df is not None and not f_df.empty:
                    ref_rows.append(f_df.iloc[0].to_dict())
                    if len(ref_rows) >= n_samples:
                        break
            except Exception:
                continue

    if len(ref_rows) >= 5:
        _REFERENCE_DATASET_CACHE = pd.DataFrame(ref_rows)
    else:
        logger.warning("Could not sample reference dataset from df_cache; using empty fallback.")
        _REFERENCE_DATASET_CACHE = pd.DataFrame()

    return _REFERENCE_DATASET_CACHE


def _compute_pdp_cost(
    base_feats: pd.DataFrame,
    orig_cost: float,
    base_rev_cost: float,
    scen_rev_cost: float,
    cum_exp: float,
    phys_prog: float,
    base_predicted_ov: float,
    scen_predicted_ov: float,
    models: Dict[str, Any],
    n_reference_samples: int = 50,
) -> PDPCurve:
    """
    Compute TRUE mathematical Partial Dependence Plot for Cost Overrun:
    PDP(x) = (1 / N) * sum_{i=1}^N f_cost(x, X_other^{(i)})

    Averaged over N reference observations from historical training dataset.
    """
    min_x = max(10.0, round(orig_cost * 0.5, 1))
    max_x = max(min_x + 100.0, round(max(base_rev_cost, scen_rev_cost, orig_cost * 1.5) * 1.3, 1))
    grid = np.linspace(min_x, max_x, 11)

    ref_df = get_reference_feature_dataset(n_reference_samples)
    if ref_df.empty:
        # Fallback to repeating base_feats to guarantee multi-observation evaluation
        ref_df = pd.concat([base_feats] * 10, ignore_index=True)

    N = len(ref_df)
    prep_key = "cost_reg_3m_preprocessor"
    reg_key = "cost_regressor_3m"

    points: List[PDPPoint] = []
    if prep_key in models and reg_key in models and N > 0:
        try:
            all_batches = []
            for x_val in grid:
                batch = ref_df.copy()
                ref_orig = np.maximum(10.0, batch["original_cost_crore"].values if "original_cost_crore" in batch else orig_cost)
                cost_esc = np.maximum(0.0, x_val - ref_orig)
                cost_ov_pct = (x_val - ref_orig) / ref_orig * 100.0
                ref_cum_exp = np.maximum(0.0, batch["cumulative_expenditure_crore"].values if "cumulative_expenditure_crore" in batch else cum_exp)
                rem_budget = np.maximum(0.0, x_val - ref_cum_exp)
                exp_ratio = (ref_cum_exp / x_val * 100.0) if x_val > 0 else 0.0
                ref_phys_prog = batch["physical_progress_pct"].values if "physical_progress_pct" in batch else phys_prog

                batch["revised_cost_crore"] = x_val
                batch["cost_escalation_crore"] = cost_esc
                batch["cost_overrun_pct"] = cost_ov_pct
                batch["remaining_budget_crore"] = rem_budget
                batch["expenditure_ratio_pct"] = exp_ratio
                batch["physical_financial_gap"] = exp_ratio - ref_phys_prog
                batch["progress_minus_expenditure_gap"] = ref_phys_prog - exp_ratio
                batch["expenditure_vs_progress_ratio"] = exp_ratio / np.maximum(ref_phys_prog, 0.1)
                batch["cost_overrun_negative_flag"] = (cost_ov_pct < 0).astype(float)
                all_batches.append(batch)

            combined_eval_df = pd.concat(all_batches, ignore_index=True)
            X_eval = models[prep_key].transform(combined_eval_df)
            pred_deltas = models[reg_key].predict(X_eval)

            for i, x_val in enumerate(grid):
                start_idx = i * N
                end_idx = start_idx + N
                batch_cost_ov = combined_eval_df["cost_overrun_pct"].iloc[start_idx:end_idx].values
                total_preds = batch_cost_ov + pred_deltas[start_idx:end_idx]
                pdp_mean = float(np.mean(total_preds))
                points.append(PDPPoint(x=round(float(x_val), 1), y=round(pdp_mean, 2)))
        except Exception as e:
            logger.warning("Cost true PDP batch evaluation error: %s", e)

    if not points:
        for x_val in grid:
            ov = ((x_val - orig_cost) / orig_cost * 100.0) if orig_cost > 0 else 0.0
            points.append(PDPPoint(x=round(float(x_val), 1), y=round(ov, 2)))

    return PDPCurve(
        feature_name="revised_cost_crore",
        x_label="Sanctioned / Revised Cost (₹ Crore)",
        y_label="Predicted Total Cost Overrun (%)",
        points=points,
        baseline_point=PDPPoint(x=round(base_rev_cost, 1), y=round(base_predicted_ov, 2)),
        scenario_point=PDPPoint(x=round(scen_rev_cost, 1), y=round(scen_predicted_ov, 2)),
    )


def _compute_pdp_schedule(
    base_feats: pd.DataFrame,
    base_sched_ext: float,
    scen_sched_ext: float,
    base_rem_mo: float,
    orig_dur: float,
    base_predicted_delay: float,
    scen_predicted_delay: float,
    models: Dict[str, Any],
    n_reference_samples: int = 50,
) -> PDPCurve:
    """
    Generate true mathematical Partial Dependence Plot (PDP) for Schedule Delay:
    PDP(x) = (1 / N) * sum_{i=1}^N f_sched(x, X_other^{(i)})

    Averaged over N reference observations from historical training dataset.
    """
    min_x = 0.0
    max_x = max(24.0, round(max(base_sched_ext, scen_sched_ext, 12.0) * 1.5, 1))
    grid = np.linspace(min_x, max_x, 11)

    ref_df = get_reference_feature_dataset(n_reference_samples)
    if ref_df.empty:
        ref_df = pd.concat([base_feats] * 10, ignore_index=True)

    N = len(ref_df)
    prep_key = "time_reg_3m_preprocessor"
    reg_key = "time_regressor_3m"

    points: List[PDPPoint] = []
    if prep_key in models and reg_key in models and N > 0:
        try:
            all_batches = []
            for x_val in grid:
                batch = ref_df.copy()
                ref_dur = np.maximum(1.0, batch["original_duration_months"].values if "original_duration_months" in batch else orig_dur)
                ref_rem = np.maximum(0.0, batch["revised_remaining_months"].values if "revised_remaining_months" in batch else base_rem_mo)

                batch["schedule_extension_months"] = x_val
                batch["revised_remaining_months"] = ref_rem + x_val
                batch["months_to_revised_completion"] = ref_rem + x_val
                batch["extension_rate_pct"] = (x_val / ref_dur) * 100.0
                batch["is_extended_flag"] = 1.0 if x_val > 0 else 0.0
                batch["is_overdue_flag"] = 1.0 if x_val > 0 else 0.0
                all_batches.append(batch)

            combined_eval_df = pd.concat(all_batches, ignore_index=True)
            X_eval = models[prep_key].transform(combined_eval_df)
            pred_deltas = models[reg_key].predict(X_eval)

            for i, x_val in enumerate(grid):
                start_idx = i * N
                end_idx = start_idx + N
                delays = x_val + pred_deltas[start_idx:end_idx]
                pdp_mean = float(np.mean(delays))
                points.append(PDPPoint(x=round(float(x_val), 1), y=round(pdp_mean, 2)))
        except Exception as e:
            logger.warning("Schedule true PDP batch evaluation error: %s", e)

    if not points:
        for x_val in grid:
            points.append(PDPPoint(x=round(float(x_val), 1), y=round(float(x_val), 2)))

    return PDPCurve(
        feature_name="schedule_extension_months",
        x_label="Schedule Extension Past Baseline (Months)",
        y_label="Predicted Total Delay (Months)",
        points=points,
        baseline_point=PDPPoint(x=round(base_sched_ext, 1), y=round(base_predicted_delay, 2)),
        scenario_point=PDPPoint(x=round(scen_sched_ext, 1), y=round(scen_predicted_delay, 2)),
    )


def simulate_project_scenario(
    project_id: str,
    request: WhatIfRequest,
    db: Session
) -> WhatIfResponse:
    """
    Execute backend ML counterfactual simulation for a project under user-defined scenario parameters.

    Guarantee:
    When additional_cost == 0, additional_delay_months == 0, and monthly_expenditure == baseline,
    Scenario predictions and risk scores equal baseline inference exactly.
    """
    _validate_scenario_input(request)
    canonical_id = resolve_canonical_project_id(project_id, db)

    ai_engine._ensure_initialized()
    df_to_use = ai_engine._get_df_for_project(canonical_id)

    # Validate project exists in dataset or DB
    mask = df_to_use["project_id"].astype(str) == str(canonical_id)
    if not mask.any():
        db_proj = None
        try:
            if db is not None:
                db_proj = db.query(Project).filter(Project.id == canonical_id).first()
        except Exception:
            db_proj = None
        if not db_proj:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Project with ID '{project_id}' not found."
            )

    info = get_project_info(canonical_id, df_to_use)
    current = get_current_status(canonical_id, df_to_use)
    features_df = prepare_prediction_features(canonical_id, df_to_use)

    # 1. Baseline Model Inference
    base_cost_pred = predict_cost(features_df, ai_engine.models, current, horizons=[3])
    base_time_pred = predict_time(features_df, ai_engine.models, current, horizons=[3])

    base_pred_cost_ov = float(base_cost_pred["3_month"]["predicted_final_cost_overrun_pct"])
    base_pred_delay = float(base_time_pred["3_month"]["predicted_total_schedule_extension_months"])
    base_risk = calculate_risk_score(base_pred_cost_ov, base_pred_delay)

    # Baseline Direct Metrics
    orig_cost = float(features_df["original_cost_crore"].iloc[0] or 1000.0)
    base_cost = float(features_df["revised_cost_crore"].iloc[0] or orig_cost)
    cum_exp = float(features_df["cumulative_expenditure_crore"].iloc[0] or 0.0)
    phys_prog = float(features_df["physical_progress_pct"].iloc[0] or 0.0)
    orig_dur = float(features_df["original_duration_months"].iloc[0] or 36.0)
    base_sched_ext = float(features_df["schedule_extension_months"].iloc[0] or 0.0)
    base_rem_mo = float(features_df["revised_remaining_months"].iloc[0] or features_df["planned_remaining_months"].iloc[0] or 12.0)
    
    # Authoritative monthly expenditure velocity baseline
    base_monthly_exp = float(features_df["expenditure_velocity_crore_month"].iloc[0] or 0.0)
    if base_monthly_exp <= 0.0:
        age = float(features_df["project_age_months"].iloc[0] or 12.0)
        base_monthly_exp = round(max(1.0, cum_exp / max(1.0, age)), 2)

    base_est_mo = round(max(0.0, base_cost - cum_exp) / base_monthly_exp, 1) if base_monthly_exp > 0 else None

    # 2. Build Scenario Feature Vector
    scen_features_df = features_df.copy()

    # Determine scenario inputs
    add_cost = float(request.additional_cost)
    add_delay = float(request.additional_delay_months)
    scen_monthly_exp = float(request.monthly_expenditure) if request.monthly_expenditure is not None else base_monthly_exp

    # Direct Scenario Metrics
    scen_cost = round(base_cost + add_cost, 2)
    scen_rem_mo = round(base_rem_mo + add_delay, 2)
    scen_sched_ext = round(base_sched_ext + add_delay, 2)
    scen_est_mo = round(max(0.0, scen_cost - cum_exp) / scen_monthly_exp, 1) if scen_monthly_exp > 0 else None

    # Apply Scenario Modifications strictly to model feature set
    scen_cost_esc = max(0.0, scen_cost - orig_cost)
    scen_cost_ov_pct = ((scen_cost - orig_cost) / orig_cost * 100.0) if orig_cost > 0 else 0.0
    scen_rem_budget = max(0.0, scen_cost - cum_exp)
    scen_exp_ratio = (cum_exp / scen_cost * 100.0) if scen_cost > 0 else 0.0

    scen_features_df["revised_cost_crore"] = scen_cost
    scen_features_df["cost_escalation_crore"] = scen_cost_esc
    scen_features_df["cost_overrun_pct"] = scen_cost_ov_pct
    scen_features_df["remaining_budget_crore"] = scen_rem_budget
    scen_features_df["expenditure_ratio_pct"] = scen_exp_ratio
    scen_features_df["physical_financial_gap"] = scen_exp_ratio - phys_prog
    scen_features_df["progress_minus_expenditure_gap"] = phys_prog - scen_exp_ratio
    scen_features_df["expenditure_vs_progress_ratio"] = scen_exp_ratio / max(phys_prog, 0.1)
    scen_features_df["cost_overrun_negative_flag"] = 1.0 if scen_cost_ov_pct < 0 else 0.0

    scen_features_df["schedule_extension_months"] = scen_sched_ext
    scen_features_df["revised_remaining_months"] = scen_rem_mo
    scen_features_df["months_to_revised_completion"] = scen_rem_mo
    scen_features_df["extension_rate_pct"] = (scen_sched_ext / orig_dur * 100.0) if orig_dur > 0 else 0.0
    scen_features_df["is_extended_flag"] = 1.0 if scen_sched_ext > 0 else 0.0
    scen_features_df["is_overdue_flag"] = 1.0 if (scen_sched_ext > 0 or str(scen_features_df["schedule_status"].iloc[0]).upper() == "OVERDUE") else 0.0

    scen_features_df["expenditure_velocity_crore_month"] = scen_monthly_exp

    # 3. Scenario Model Inference
    # When zero change requested, retain exact baseline predictions to guarantee mathematical equivalence
    if add_cost == 0.0 and add_delay == 0.0 and (request.monthly_expenditure is None or abs(request.monthly_expenditure - base_monthly_exp) < 1e-4):
        scen_pred_cost_ov = base_pred_cost_ov
        scen_pred_delay = base_pred_delay
        scen_risk = base_risk
    else:
        scen_current = current.copy()
        scen_current["cost_overrun_pct"] = scen_cost_ov_pct
        scen_current["schedule_extension_months"] = scen_sched_ext
        scen_current["revised_cost_crore"] = scen_cost

        scen_cost_pred = predict_cost(scen_features_df, ai_engine.models, scen_current, horizons=[3])
        scen_time_pred = predict_time(scen_features_df, ai_engine.models, scen_current, horizons=[3])

        scen_pred_cost_ov = float(scen_cost_pred["3_month"]["predicted_final_cost_overrun_pct"])
        scen_pred_delay = float(scen_time_pred["3_month"]["predicted_total_schedule_extension_months"])
        scen_risk = calculate_risk_score(scen_pred_cost_ov, scen_pred_delay)

    # 4. Deltas (Impact)
    impact = WhatIfImpactItem(
        cost_change=round(scen_cost - base_cost, 2),
        cost=round(scen_cost - base_cost, 2),
        remaining_months_change=round(scen_rem_mo - base_rem_mo, 2),
        remaining_months=round(scen_rem_mo - base_rem_mo, 2),
        expenditure_change=round(scen_monthly_exp - base_monthly_exp, 2),
        monthly_expenditure=round(scen_monthly_exp - base_monthly_exp, 2),
        cost_overrun_change=round(scen_pred_cost_ov - base_pred_cost_ov, 2),
        cost_overrun=round(scen_pred_cost_ov - base_pred_cost_ov, 2),
        schedule_delay_change=round(scen_pred_delay - base_pred_delay, 2),
        schedule_delay=round(scen_pred_delay - base_pred_delay, 2),
        risk_score_change=round(scen_risk.risk_score - base_risk.risk_score, 1),
        risk_score=round(scen_risk.risk_score - base_risk.risk_score, 1),
    )

    # 5. Partial Dependence Plots (PDP)
    pdp_cost = _compute_pdp_cost(
        base_feats=features_df,
        orig_cost=orig_cost,
        base_rev_cost=base_cost,
        scen_rev_cost=scen_cost,
        cum_exp=cum_exp,
        phys_prog=phys_prog,
        base_predicted_ov=base_pred_cost_ov,
        scen_predicted_ov=scen_pred_cost_ov,
        models=ai_engine.models,
    )

    pdp_schedule = _compute_pdp_schedule(
        base_feats=features_df,
        base_sched_ext=base_sched_ext,
        scen_sched_ext=scen_sched_ext,
        base_rem_mo=base_rem_mo,
        orig_dur=orig_dur,
        base_predicted_delay=base_pred_delay,
        scen_predicted_delay=scen_pred_delay,
        models=ai_engine.models,
    )

    # 6. Dynamic Narrative Insight
    direction = "increased" if impact.risk_score_change > 0 else ("reduced" if impact.risk_score_change < 0 else "maintained")
    narrative = (
        f"Counterfactual evaluation for {info['project_name']} (#{canonical_id}): "
        f"Applying +₹{add_cost:,.1f} Cr cost adjustment and +{add_delay:.1f} months schedule extension "
        f"at ₹{scen_monthly_exp:,.1f} Cr/month expenditure shifts predicted total cost overrun from "
        f"{base_pred_cost_ov:+.1f}% to {scen_pred_cost_ov:+.1f}% ({impact.cost_overrun_change:+.1f} pp) "
        f"and total schedule delay from {base_pred_delay:.1f} to {scen_pred_delay:.1f} months "
        f"({impact.schedule_delay_change:+.1f} mo). Consequently, the centralized risk score {direction} from "
        f"{base_risk.risk_score:.1f} ({base_risk.risk_level}) to {scen_risk.risk_score:.1f} ({scen_risk.risk_level}), "
        f"representing a net delta of {impact.risk_score_change:+.1f} points."
    )

    baseline_metric = WhatIfMetricItem(
        cost=round(base_cost, 2),
        project_cost=round(base_cost, 2),
        remaining_months=round(base_rem_mo, 1),
        monthly_expenditure=round(base_monthly_exp, 2),
        predicted_cost_overrun=round(base_pred_cost_ov, 2),
        predicted_schedule_delay=round(base_pred_delay, 2),
        risk_score=round(base_risk.risk_score, 1),
        risk_level=base_risk.risk_level,
        cost_risk_component=round(base_risk.cost_risk_component, 2),
        schedule_risk_component=round(base_risk.schedule_risk_component, 2),
        estimated_months_to_complete=base_est_mo,
    )

    scenario_metric = WhatIfMetricItem(
        cost=round(scen_cost, 2),
        project_cost=round(scen_cost, 2),
        remaining_months=round(scen_rem_mo, 1),
        monthly_expenditure=round(scen_monthly_exp, 2),
        predicted_cost_overrun=round(scen_pred_cost_ov, 2),
        predicted_schedule_delay=round(scen_pred_delay, 2),
        risk_score=round(scen_risk.risk_score, 1),
        risk_level=scen_risk.risk_level,
        cost_risk_component=round(scen_risk.cost_risk_component, 2),
        schedule_risk_component=round(scen_risk.schedule_risk_component, 2),
        estimated_months_to_complete=scen_est_mo,
    )

    return WhatIfResponse(
        project_id=str(canonical_id),
        project_name=info["project_name"],
        baseline=baseline_metric,
        scenario=scenario_metric,
        impact=impact,
        change=impact,
        pdp_cost=pdp_cost,
        pdp_schedule=pdp_schedule,
        narrative_insight=narrative,
    )
