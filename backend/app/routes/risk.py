"""
Risk and Prediction API Router.
Connects FastAPI to the ML Risk Client and database prediction logs.
"""
from typing import List, Dict, Any, Optional
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from sqlalchemy import desc, func

from app.database import get_db
from app.models.project import Project
from app.models.risk_prediction import RiskPrediction
from app.schemas.risk import RiskPredictionResponse, RiskSummaryResponse
from app.schemas.project import ProjectResponse
from app.routes.projects import format_project_response
from app.ml_integration.risk_client import get_ml_client
from app.audit import log_audit_event

router = APIRouter(prefix="/risk", tags=["Risk"])


@router.get("/summary", response_model=RiskSummaryResponse, summary="National Risk Analysis Summary")
def get_risk_summary(db: Session = Depends(get_db)):
    """
    Get aggregated national risk statistics for the Risk Analysis page.
    """
    total = db.query(func.count(Project.id)).scalar() or 0
    if total == 0:
        return RiskSummaryResponse(
            total_analyzed=0,
            high_risk_count=0,
            high_risk_pct=0.0,
            time_overrun_count=0,
            time_overrun_pct=0.0,
            cost_overrun_count=0,
            cost_overrun_pct=0.0,
            early_warning_count=0,
            early_warning_pct=0.0,
            low_risk_count=0,
            low_risk_pct=0.0,
            avg_risk_score=0.0,
            distribution_categories=[]
        )

    high_risk = db.query(func.count(Project.id)).filter(Project.risk_score >= 70).scalar() or 0
    time_overrun = db.query(func.count(Project.id)).filter(Project.schedule_extension_months > 0).scalar() or 0
    cost_overrun = db.query(func.count(Project.id)).filter(Project.cost_overrun_pct > 0).scalar() or 0
    early_warning = db.query(func.count(Project.id)).filter(Project.risk_score.between(50, 69)).scalar() or 0
    low_risk = db.query(func.count(Project.id)).filter(Project.risk_score < 50).scalar() or 0
    avg_score = db.query(func.avg(Project.risk_score)).scalar() or 35.0

    categories = [
        {"category": "Critical Risk (>80)", "count": db.query(func.count(Project.id)).filter(Project.risk_score >= 80).scalar() or 0, "color": "#EF4444"},
        {"category": "High Risk (70-79)", "count": db.query(func.count(Project.id)).filter(Project.risk_score.between(70, 79)).scalar() or 0, "color": "#F97316"},
        {"category": "Moderate Risk (50-69)", "count": early_warning, "color": "#EAB308"},
        {"category": "Low Risk (<50)", "count": low_risk, "color": "#22C55E"}
    ]

    return RiskSummaryResponse(
        total_analyzed=total,
        high_risk_count=high_risk,
        high_risk_pct=round(high_risk / total * 100, 1),
        time_overrun_count=time_overrun,
        time_overrun_pct=round(time_overrun / total * 100, 1),
        cost_overrun_count=cost_overrun,
        cost_overrun_pct=round(cost_overrun / total * 100, 1),
        early_warning_count=early_warning,
        early_warning_pct=round(early_warning / total * 100, 1),
        low_risk_count=low_risk,
        low_risk_pct=round(low_risk / total * 100, 1),
        avg_risk_score=round(float(avg_score), 1),
        distribution_categories=categories
    )


@router.get("/high-risk", response_model=List[ProjectResponse], summary="List High Risk Projects")
def get_high_risk_projects(limit: int = Query(20, ge=1, le=100), db: Session = Depends(get_db)):
    """Retrieve top projects with highest risk scores."""
    projects = db.query(Project).filter(Project.risk_score >= 60).order_by(desc(Project.risk_score)).limit(limit).all()
    return [format_project_response(p) for p in projects]


@router.get("/projects/{project_id}", response_model=Optional[RiskPredictionResponse], summary="Get Latest Project Risk Prediction")
def get_project_risk(project_id: str, horizon: int = Query(3, description="Forecast horizon (3 or 6 months)"), db: Session = Depends(get_db)):
    """Get stored or latest risk prediction for a project."""
    pred = db.query(RiskPrediction).filter(
        RiskPrediction.project_id == project_id,
        RiskPrediction.horizon_months == horizon
    ).order_by(desc(RiskPrediction.prediction_date)).first()

    if pred:
        return pred

    # If not stored yet, trigger on-the-fly prediction
    return predict_project_risk(project_id=project_id, horizon=horizon, db=db)


@router.post("/projects/{project_id}/predict", response_model=RiskPredictionResponse, summary="Execute ML Prediction for Project")
def predict_project_risk(project_id: str, horizon: int = Query(3, description="Forecast horizon (3 or 6)"), db: Session = Depends(get_db)):
    """
    Trigger real XGBoost ML model prediction for a project, store in database, and return results.
    """
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Project with ID '{project_id}' not found."
        )

    ml_client = get_ml_client()
    try:
        res = ml_client.predict_project(project_id=project_id)
        cost_p = res.get("cost_prediction", {}).get(f"{horizon}_month", {})
        time_p = res.get("time_prediction", {}).get(f"{horizon}_month", {})
        explanations = res.get("explanations", {})
        cost_expl = explanations.get(f"cost_{horizon}m", {})
        time_expl = explanations.get(f"time_{horizon}m", {})
        
        from src.qwen_service import get_feature_readable_info
        raw_drivers = cost_expl.get("top_risk_drivers", []) or time_expl.get("top_risk_drivers", [])
        raw_protective = cost_expl.get("top_protective_factors", []) or time_expl.get("top_protective_factors", [])
        
        top_drivers = []
        for d in raw_drivers[:5]:
            f_name = d.get("feature", "")
            info = get_feature_readable_info(f_name)
            top_drivers.append({
                "feature": f_name,
                "label": info.get("display_name", f_name.replace("_", " ").title()),
                "shap_value": d.get("shap_value", 0.0)
            })

        top_protective = []
        for p in raw_protective[:5]:
            f_name = p.get("feature", "")
            info = get_feature_readable_info(f_name)
            top_protective.append({
                "feature": f_name,
                "label": info.get("display_name", f_name.replace("_", " ").title()),
                "shap_value": p.get("shap_value", 0.0)
            })

        # Create or update prediction record in DB
        pred_record = RiskPrediction(
            project_id=project_id,
            prediction_date=datetime.utcnow(),
            horizon_months=horizon,
            risk_score=project.risk_score,
            risk_level=project.risk_level,
            cost_overrun_probability=cost_p.get("additional_escalation_probability"),
            time_overrun_probability=time_p.get("additional_delay_probability"),
            predicted_additional_overrun_pct=cost_p.get("predicted_additional_overrun_pct"),
            predicted_additional_cost_crore=cost_p.get("predicted_additional_cost_crore"),
            predicted_final_cost_overrun_pct=cost_p.get("predicted_final_cost_overrun_pct"),
            predicted_final_revised_cost_crore=cost_p.get("predicted_final_revised_cost_crore"),
            predicted_additional_delay_months=time_p.get("predicted_additional_delay_months"),
            predicted_total_schedule_extension_months=time_p.get("predicted_total_schedule_extension_months"),
            tentative_completion_date=time_p.get("tentative_completion_date"),
            estimated_time_needed=time_p.get("estimated_time_needed_completion"),
            top_risk_drivers=top_drivers,
            top_protective_factors=top_protective,
            explanation=f"Live XGBoost {horizon}M model forecast with SHAP explainability.",
            model_version="2.0.0"
        )
        db.add(pred_record)
        db.commit()
        db.refresh(pred_record)

        log_audit_event(
            db=db,
            action="GENERATE_PREDICTION",
            entity_type="risk_prediction",
            entity_id=str(pred_record.id),
            new_value={"project_id": project_id, "horizon": horizon}
        )

        return pred_record

    except Exception as e:
        logger.error(f"[ML Error] Failed to generate XGBoost prediction for project {project_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"AI prediction currently unavailable for project '{project_id}'."
        )


@router.get("/projects/{project_id}/drivers", summary="Get SHAP Risk Drivers for Project")
def get_project_drivers(project_id: str, db: Session = Depends(get_db)):
    """Retrieve top SHAP risk drivers and protective forces for a project."""
    pred = db.query(RiskPrediction).filter(RiskPrediction.project_id == project_id).order_by(desc(RiskPrediction.prediction_date)).first()
    if pred and pred.top_risk_drivers:
        return {
            "project_id": project_id,
            "top_risk_drivers": pred.top_risk_drivers,
            "top_protective_factors": pred.top_protective_factors
        }

    # Generate on the fly
    res = predict_project_risk(project_id=project_id, horizon=3, db=db)
    return {
        "project_id": project_id,
        "top_risk_drivers": res.top_risk_drivers,
        "top_protective_factors": res.top_protective_factors
    }
