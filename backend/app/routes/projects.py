"""
Projects API Router.
Provides complete CRUD, filtering, pagination, and nested entity management.
"""
from typing import Optional, List
import math
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func, or_, desc, asc

from app.database import get_db
from app.models.project import Project
from app.models.ministry import Ministry
from app.models.sector import Sector
from app.models.milestone import Milestone
from app.models.progress import ProjectProgress
from app.schemas.project import (
    ProjectCreate, ProjectUpdate, ProjectResponse, ProjectDetailResponse,
    MinistryResponse, SectorResponse
)
from app.schemas.milestone import MilestoneCreate, MilestoneResponse
from app.schemas.progress import ProgressCreate, ProgressResponse
from app.schemas.common import PaginatedResponse, MessageResponse
from app.audit import log_audit_event
from app.services.ai_engine_service import ai_engine
from app.schemas.prediction_extended import (
    FullProjectPredictionResponse, CostHorizonPrediction, TimeHorizonPrediction,
    ModelRiskMetrics, ShapContribution, EnrichedCostDriver,
    ShapExplanationResponse, CostDriverHorizon, CostDriverAnalysisResponse,
    AISummaryResponse, EarlyWarningItem, ProjectEarlyWarningsResponse,
    RecommendationItem, ProjectRecommendationsResponse,
    ModelExplanationItem, ProjectModelExplanationsResponse,
    ChatRequest, ChatResponse
)

router = APIRouter(prefix="/projects", tags=["Projects"])


def _clean_cr_str(val: float) -> str:
    if not val:
        return "N/A"
    if val % 1 == 0:
        return f"₹{int(val):,} Cr"
    return f"₹{val:,.2f} Cr".replace(".00 Cr", " Cr")


def format_project_response(p: Project) -> dict:
    """Helper to format numeric fields and dates for frontend consumption."""
    orig_cost = float(p.original_cost) if p.original_cost is not None else 0.0
    rev_cost = float(p.revised_cost) if p.revised_cost is not None else orig_cost
    cum_exp = float(p.cumulative_expenditure) if p.cumulative_expenditure is not None else 0.0
    overrun_pct = round(float(p.cost_overrun_pct), 1) if p.cost_overrun_pct is not None else 0.0

    return {
        "id": p.id,
        "name": p.name,
        "project_code": p.project_code,
        "description": p.description,
        "ministry_id": p.ministry_id,
        "sector_id": p.sector_id,
        "location": p.location,
        "state": p.state,
        "district": p.district,
        "implementing_agency": p.implementing_agency,
        "contractor": p.contractor,
        "phase": p.phase,
        "type": p.type,
        "project_status": p.project_status,
        "schedule_status": p.schedule_status,
        "start_date": p.start_date,
        "original_completion_date": p.original_completion_date,
        "expected_completion_date": p.expected_completion_date,
        "actual_completion_date": p.actual_completion_date,
        "original_cost": orig_cost,
        "revised_cost": rev_cost,
        "cumulative_expenditure": cum_exp,
        "cost_overrun_pct": overrun_pct,
        "cost_escalation_crore": float(p.cost_escalation_crore) if p.cost_escalation_crore is not None else 0.0,
        "physical_progress": round(float(p.physical_progress), 1) if p.physical_progress is not None else 0.0,
        "physical_progress_target": round(float(p.physical_progress_target), 1) if p.physical_progress_target is not None else 0.0,
        "financial_progress": round(float(p.financial_progress), 1) if p.financial_progress is not None else 0.0,
        "schedule_extension_months": round(float(p.schedule_extension_months), 1) if p.schedule_extension_months is not None else 0.0,
        "delay_days": p.delay_days,
        "risk_score": p.risk_score,
        "risk_level": p.risk_level,
        "cost_risk": p.cost_risk,
        "time_risk": p.time_risk,
        "impl_risk": p.impl_risk,
        "overall_risk": p.overall_risk,
        "created_at": p.created_at,
        "updated_at": p.updated_at,
        "ministry": {"id": p.ministry.id, "name": p.ministry.name, "code": p.ministry.code} if p.ministry else None,
        "sector": {"id": p.sector.id, "name": p.sector.name, "code": p.sector.code} if p.sector else None,
        # Formatted fields matching UI expectations
        "costApproved": _clean_cr_str(orig_cost),
        "costRevised": _clean_cr_str(rev_cost),
        "costExpenditure": _clean_cr_str(cum_exp),
        "costOverrunFormatted": f"{overrun_pct:+.1f}%" if overrun_pct != 0 else "0.0%",
        "costLabel": _clean_cr_str(rev_cost) if rev_cost else "₹0 Cr",
        "costSubtext": f"Approved: {_clean_cr_str(orig_cost)} ({overrun_pct:+.1f}%)" if orig_cost else "",
        "startDateFormatted": p.start_date.strftime("%b %Y") if p.start_date else "N/A",
        "expectedCompletionFormatted": p.expected_completion_date.strftime("%b %Y") if p.expected_completion_date else "N/A",
        "originalCompletionFormatted": p.original_completion_date.strftime("%b %Y") if p.original_completion_date else "N/A",
    }


@router.get("", response_model=PaginatedResponse[ProjectResponse], summary="List and Filter Projects")
def get_projects(
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(20, ge=1, le=200, description="Items per page"),
    search: Optional[str] = Query(None, description="Search by name, ID, agency, or state"),
    ministry_id: Optional[int] = Query(None, description="Filter by Ministry ID"),
    sector_id: Optional[int] = Query(None, description="Filter by Sector ID"),
    ministry: Optional[str] = Query(None, description="Filter by Ministry name"),
    sector: Optional[str] = Query(None, description="Filter by Sector name"),
    schedule_status: Optional[str] = Query(None, description="Filter by status (ON TRACK, DELAYED, CRITICAL, EXTENDED)"),
    risk_level: Optional[str] = Query(None, description="Filter by risk level (Low, Medium, High, Critical)"),
    state: Optional[str] = Query(None, description="Filter by State"),
    sort_by: str = Query("risk_score", description="Field to sort by"),
    sort_order: str = Query("desc", description="Sort direction (asc, desc)"),
    db: Session = Depends(get_db)
):
    """
    Get a paginated and filtered list of infrastructure projects.
    """
    query = db.query(Project).options(joinedload(Project.ministry), joinedload(Project.sector))

    # Apply search filter across name, ID, agency, state, location, and project code
    if search and search.strip():
        search_fmt = f"%{search.strip()}%"
        query = query.filter(
            or_(
                Project.name.ilike(search_fmt),
                Project.id.ilike(search_fmt),
                Project.implementing_agency.ilike(search_fmt),
                Project.state.ilike(search_fmt),
                Project.location.ilike(search_fmt),
                Project.project_code.ilike(search_fmt)
            )
        )

    # Apply direct ministry filters (by ID or name)
    if ministry_id is not None:
        query = query.filter(Project.ministry_id == ministry_id)
    elif ministry and ministry.strip() and ministry.strip().upper() != "ALL":
        query = query.join(Project.ministry).filter(Ministry.name.ilike(f"%{ministry.strip()}%"))

    # Apply direct sector filters (by ID or name)
    if sector_id is not None:
        query = query.filter(Project.sector_id == sector_id)
    elif sector and sector.strip() and sector.strip().upper() != "ALL":
        query = query.join(Project.sector).filter(Sector.name.ilike(f"%{sector.strip()}%"))

    # Apply smart schedule status filter
    if schedule_status and schedule_status.strip() and schedule_status.strip().upper() != "ALL":
        stat = schedule_status.strip().upper()
        if "ON" in stat or "TRACK" in stat:
            query = query.filter(or_(Project.schedule_status.ilike("%ON%TRACK%"), Project.schedule_status.ilike("%COMPLETED%")))
        elif "DELAY" in stat:
            query = query.filter(or_(Project.schedule_status.ilike("%DELAY%"), Project.schedule_status.ilike("%EXTENDED%")))
        elif "CRIT" in stat or "OVERDUE" in stat:
            query = query.filter(or_(Project.schedule_status.ilike("%CRIT%"), Project.schedule_status.ilike("%OVERDUE%")))
        else:
            query = query.filter(Project.schedule_status.ilike(f"%{stat}%"))

    if risk_level and risk_level.strip() and risk_level.strip().upper() != "ALL":
        query = query.filter(Project.risk_level.ilike(risk_level.strip()))
    if state and state.strip() and state.strip().upper() != "ALL":
        query = query.filter(Project.state.ilike(f"%{state.strip()}%"))

    # Sorting
    sort_column = getattr(Project, sort_by, Project.risk_score)
    if sort_order.lower() == "asc":
        query = query.order_by(asc(sort_column))
    else:
        query = query.order_by(desc(sort_column))

    total = query.count()
    total_pages = math.ceil(total / page_size) if total > 0 else 1
    projects = query.offset((page - 1) * page_size).limit(page_size).all()

    items = [format_project_response(p) for p in projects]

    return PaginatedResponse(
        items=items,
        total=total,
        page=page,
        page_size=page_size,
        total_pages=total_pages
    )


@router.get("/ministries", response_model=List[MinistryResponse], summary="List all Ministries")
def get_ministries(db: Session = Depends(get_db)):
    """Retrieve all ministries with project counts."""
    ministries = db.query(
        Ministry,
        func.count(Project.id).label("total_projects")
    ).outerjoin(Project, Ministry.id == Project.ministry_id).group_by(Ministry.id).order_by(Ministry.name).all()

    result = []
    for m, count in ministries:
        result.append({
            "id": m.id,
            "name": m.name,
            "code": m.code,
            "description": m.description,
            "total_projects": count,
            "created_at": m.created_at,
            "updated_at": m.updated_at
        })
    return result


@router.get("/sectors", response_model=List[SectorResponse], summary="List all Sectors")
def get_sectors(db: Session = Depends(get_db)):
    """Retrieve all sectors with project counts."""
    sectors = db.query(
        Sector,
        func.count(Project.id).label("total_projects")
    ).outerjoin(Project, Sector.id == Project.sector_id).group_by(Sector.id).order_by(Sector.name).all()

    result = []
    for s, count in sectors:
        result.append({
            "id": s.id,
            "name": s.name,
            "code": s.code,
            "description": s.description,
            "total_projects": count,
            "created_at": s.created_at,
            "updated_at": s.updated_at
        })
    return result


@router.get("/{project_id}", response_model=ProjectDetailResponse, summary="Get Project Details")
def get_project_by_id(project_id: str, db: Session = Depends(get_db)):
    """
    Retrieve full details for a single project including milestones and progress records.
    """
    project = db.query(Project).options(
        joinedload(Project.ministry),
        joinedload(Project.sector),
        joinedload(Project.milestones),
        joinedload(Project.progress_records)
    ).filter(Project.id == project_id).first()

    if not project:
        try:
            pred = ai_engine.get_full_project_prediction(project_id)
            if pred:
                info = pred.get("project_info", {})
                curr = pred.get("current_status", {})
                cost = pred.get("cost_data", {})
                return {
                    "id": str(project_id),
                    "name": info.get("project_name", f"Project {project_id}"),
                    "project_code": f"PRJ-{project_id}",
                    "description": f"National central sector infrastructure project under {info.get('ministry_department', 'Government of India')}.",
                    "sector_id": "SEC-GEN",
                    "ministry_id": "MIN-GEN",
                    "original_cost": cost.get("original_cost_crore", 1000.0),
                    "revised_cost": cost.get("revised_cost_crore", 1000.0),
                    "cumulative_expenditure": cost.get("cumulative_expenditure_crore", 500.0),
                    "cost_overrun_pct": round(float(cost.get("cost_overrun_pct", 0.0)), 1),
                    "start_date": None,
                    "original_completion_date": None,
                    "revised_completion_date": None,
                    "physical_progress": round(float(curr.get("physical_progress_pct", 50.0)), 1),
                    "financial_progress": round(float(cost.get("expenditure_ratio_pct", 50.0)), 1),
                    "schedule_status": curr.get("schedule_status", "DELAYED"),
                    "risk_score": 50,
                    "risk_level": "Medium",
                    "state": "National",
                    "implementing_agency": info.get("agency", "Executing Agency"),
                    "milestones": [],
                    "progress_records": [],
                    "costApproved": _clean_cr_str(float(cost.get("original_cost_crore", 1000.0))),
                    "costRevised": _clean_cr_str(float(cost.get("revised_cost_crore", 1000.0))),
                    "costExpenditure": _clean_cr_str(float(cost.get("cumulative_expenditure_crore", 500.0))),
                    "costOverrunFormatted": f"{round(float(cost.get('cost_overrun_pct', 0.0)), 1):+.1f}%",
                }
        except Exception:
            pass

        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Project with ID '{project_id}' not found."
        )

    res = format_project_response(project)
    res["milestones"] = project.milestones
    res["progress_records"] = project.progress_records
    return res


@router.post("", response_model=ProjectResponse, status_code=status.HTTP_201_CREATED, summary="Create Project")
def create_project(payload: ProjectCreate, db: Session = Depends(get_db)):
    """Create a new project record."""
    from app.routes.dashboard import invalidate_dashboard_cache
    existing = db.query(Project).filter(Project.id == payload.id).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Project with ID '{payload.id}' already exists."
        )

    project_data = payload.model_dump()
    new_project = Project(**project_data)
    db.add(new_project)
    db.commit()
    db.refresh(new_project)

    invalidate_dashboard_cache()

    log_audit_event(
        db=db,
        action="CREATE_PROJECT",
        entity_type="project",
        entity_id=new_project.id,
        new_value=project_data
    )

    return format_project_response(new_project)


@router.patch("/{project_id}", response_model=ProjectResponse, summary="Update Project")
def update_project(project_id: str, payload: ProjectUpdate, db: Session = Depends(get_db)):
    """Update fields on an existing project."""
    from app.routes.dashboard import invalidate_dashboard_cache
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Project with ID '{project_id}' not found."
        )

    update_data = payload.model_dump(exclude_unset=True)
    old_data = {c.name: getattr(project, c.name) for c in project.__table__.columns if c.name in update_data}

    for key, value in update_data.items():
        setattr(project, key, value)

    db.commit()
    db.refresh(project)

    invalidate_dashboard_cache()

    log_audit_event(
        db=db,
        action="UPDATE_PROJECT",
        entity_type="project",
        entity_id=project.id,
        old_value=old_data,
        new_value=update_data
    )

    return format_project_response(project)


@router.delete("/{project_id}", response_model=MessageResponse, summary="Delete Project")
def delete_project(project_id: str, db: Session = Depends(get_db)):
    """Delete a project and its associated records."""
    from app.routes.dashboard import invalidate_dashboard_cache
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Project with ID '{project_id}' not found."
        )

    db.delete(project)
    db.commit()

    invalidate_dashboard_cache()

    log_audit_event(
        db=db,
        action="DELETE_PROJECT",
        entity_type="project",
        entity_id=project_id
    )

    return MessageResponse(message=f"Project '{project_id}' successfully deleted.")


@router.get("/{project_id}/milestones", response_model=List[MilestoneResponse], summary="Get Project Milestones")
def get_milestones(project_id: str, db: Session = Depends(get_db)):
    """Get all milestones for a project."""
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Project with ID '{project_id}' not found."
        )
    return db.query(Milestone).filter(Milestone.project_id == project_id).order_by(Milestone.planned_date).all()


@router.post("/{project_id}/milestones", response_model=MilestoneResponse, status_code=status.HTTP_201_CREATED, summary="Add Project Milestone")
def add_milestone(project_id: str, payload: MilestoneCreate, db: Session = Depends(get_db)):
    """Add a new milestone to a project."""
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Project with ID '{project_id}' not found."
        )

    m_data = payload.model_dump()
    m_data["project_id"] = project_id
    milestone = Milestone(**m_data)
    db.add(milestone)
    db.commit()
    db.refresh(milestone)
    return milestone


@router.get("/{project_id}/progress", response_model=List[ProgressResponse], summary="Get Project Progress Time-Series")
def get_progress_records(project_id: str, db: Session = Depends(get_db)):
    """Get time-series historical progress snapshots for a project."""
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Project with ID '{project_id}' not found."
        )
    return db.query(ProjectProgress).filter(ProjectProgress.project_id == project_id).order_by(ProjectProgress.reporting_date.asc()).all()


def _calculate_risk_tier(prob: Optional[float]) -> str:
    if prob is None:
        return "UNKNOWN"
    if prob < 0.25:
        return "LOW"
    elif prob < 0.50:
        return "MODERATE"
    elif prob < 0.75:
        return "HIGH"
    else:
        return "CRITICAL"


@router.get("/{project_id}/prediction", response_model=FullProjectPredictionResponse, summary="Get Full Project Predictions")
def get_project_prediction_endpoint(project_id: str):
    """
    Run multi-horizon (3M & 6M) incremental cost and schedule predictions.
    Derived final totals maintain strict mathematical consistency.
    """
    try:
        raw_pred = ai_engine.get_full_project_prediction(project_id)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Prediction error: {e}")

    cost_pred_dict = {}
    for h, data in raw_pred.get("cost_prediction", {}).items():
        prob = data.get("additional_escalation_probability")
        cost_pred_dict[h] = CostHorizonPrediction(
            additional_escalation_probability=prob,
            predicted_additional_overrun_pct=data.get("predicted_additional_overrun_pct"),
            predicted_additional_cost_crore=data.get("predicted_additional_cost_crore"),
            predicted_final_cost_overrun_pct=data.get("predicted_final_cost_overrun_pct"),
            predicted_final_cost_escalation_crore=data.get("predicted_final_cost_escalation_crore"),
            predicted_final_revised_cost_crore=data.get("predicted_final_revised_cost_crore"),
            risk_tier=_calculate_risk_tier(prob) if prob is not None else None
        )

    time_pred_dict = {}
    for h, data in raw_pred.get("time_prediction", {}).items():
        prob = data.get("additional_delay_probability")
        time_pred_dict[h] = TimeHorizonPrediction(
            additional_delay_probability=prob,
            predicted_additional_delay_months=data.get("predicted_additional_delay_months"),
            predicted_total_schedule_extension_months=data.get("predicted_total_schedule_extension_months"),
            predicted_additional_delay=data.get("predicted_additional_delay"),
            tentative_completion_date=data.get("tentative_completion_date"),
            tentative_completion_date_iso=data.get("tentative_completion_date_iso"),
            estimated_time_needed_completion=data.get("estimated_time_needed_completion"),
            risk_tier=_calculate_risk_tier(prob) if prob is not None else None
        )

    c3m_prob = cost_pred_dict.get("3_month", CostHorizonPrediction()).additional_escalation_probability
    c6m_prob = cost_pred_dict.get("6_month", CostHorizonPrediction()).additional_escalation_probability
    t3m_prob = time_pred_dict.get("3_month", TimeHorizonPrediction()).additional_delay_probability
    t6m_prob = time_pred_dict.get("6_month", TimeHorizonPrediction()).additional_delay_probability

    risk_metrics = ModelRiskMetrics(
        cost_escalation_risk_3m_pct=round(c3m_prob * 100, 1) if c3m_prob is not None else None,
        cost_escalation_risk_6m_pct=round(c6m_prob * 100, 1) if c6m_prob is not None else None,
        schedule_delay_risk_3m_pct=round(t3m_prob * 100, 1) if t3m_prob is not None else None,
        schedule_delay_risk_6m_pct=round(t6m_prob * 100, 1) if t6m_prob is not None else None,
        cost_risk_tier_3m=_calculate_risk_tier(c3m_prob) if c3m_prob is not None else None,
        cost_risk_tier_6m=_calculate_risk_tier(c6m_prob) if c6m_prob is not None else None,
        delay_risk_tier_3m=_calculate_risk_tier(t3m_prob) if t3m_prob is not None else None,
        delay_risk_tier_6m=_calculate_risk_tier(t6m_prob) if t6m_prob is not None else None,
    )

    return FullProjectPredictionResponse(
        project_id=str(raw_pred.get("project_id", project_id)),
        project_name=raw_pred.get("project_name", ""),
        as_of_month=raw_pred.get("as_of_month"),
        is_completed=raw_pred.get("is_completed", False),
        completed_summary=raw_pred.get("completed_summary"),
        current_status=raw_pred.get("current_status", {}),
        timeline=raw_pred.get("timeline", {}),
        cost_prediction=cost_pred_dict,
        time_prediction=time_pred_dict,
        risk_metrics=risk_metrics,
        project_info=raw_pred.get("project_info", {})
    )


@router.get("/{project_id}/shap", response_model=ShapExplanationResponse, summary="Get Project TreeSHAP Explanation")
def get_project_shap_endpoint(
    project_id: str,
    model_name: str = Query("cost_3m", description="One of: cost_3m, cost_6m, time_3m, time_6m")
):
    """
    Retrieve TreeSHAP additive feature contributions for a specific model & horizon.
    """
    try:
        raw_shap = ai_engine.get_project_shap_explanation(project_id, model_key=model_name)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"SHAP explanation error: {e}")

    top_risk = [ShapContribution(**d) for d in raw_shap.get("top_risk_drivers", [])]
    top_protect = [ShapContribution(**d) for d in raw_shap.get("top_protective_factors", [])]
    all_contrib = [ShapContribution(**d) for d in raw_shap.get("all_contributions", [])]

    return ShapExplanationResponse(
        model_name=model_name,
        base_value=raw_shap.get("base_value", 0.5),
        top_risk_drivers=top_risk,
        top_protective_factors=top_protect,
        all_contributions=all_contrib
    )


@router.get("/{project_id}/cost-drivers", response_model=CostDriverAnalysisResponse, summary="Cost Escalation Driver Analysis")
def get_cost_driver_analysis_endpoint(project_id: str):
    """
    Dedicated Cost Escalation Driver Analysis module.
    Translates technical TreeSHAP attributions into domain-meaningful financial drivers.
    """
    try:
        data = ai_engine.get_cost_driver_analysis(project_id)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Cost driver analysis error: {e}")

    h3m = data.get("horizon_3m", {})
    h6m = data.get("horizon_6m", {})

    return CostDriverAnalysisResponse(
        project_id=data["project_id"],
        project_name=data["project_name"],
        horizon_3m=CostDriverHorizon(
            top_cost_escalation_drivers=[EnrichedCostDriver(**d) for d in h3m.get("top_cost_escalation_drivers", [])],
            mitigating_factors=[EnrichedCostDriver(**d) for d in h3m.get("mitigating_factors", [])],
            base_value=h3m.get("base_value", 0.0)
        ),
        horizon_6m=CostDriverHorizon(
            top_cost_escalation_drivers=[EnrichedCostDriver(**d) for d in h6m.get("top_cost_escalation_drivers", [])],
            mitigating_factors=[EnrichedCostDriver(**d) for d in h6m.get("mitigating_factors", [])],
            base_value=h6m.get("base_value", 0.0)
        )
    )


@router.get("/{project_id}/ai-summary", response_model=AISummaryResponse, summary="AI Executive Project Summary")
def get_project_ai_summary_endpoint(project_id: str):
    """
    Generate natural language executive project summary using Qwen / grounded fallback.
    Answers: 'What is happening with this project?'
    """
    try:
        res = ai_engine.get_ai_project_summary(project_id)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"AI Summary generation error: {e}")

    return AISummaryResponse(
        project_id=project_id,
        project_name=res.get("project_name", f"Project {project_id}"),
        stage_case=res.get("stage_case", "Active Monitoring"),
        summary=res.get("summary", "AI summary unavailable."),
        alerts_title=res.get("alerts_title"),
        key_alerts=res.get("key_alerts", []),
        source=res.get("source", "Grounded AI Engine")
    )


@router.get("/{project_id}/model-explanations", response_model=ProjectModelExplanationsResponse, summary="Model-Specific Explanations")
def get_project_model_explanations_endpoint(project_id: str):
    """
    Generate model-specific natural language explanations using Qwen3-8B / fallback engine.
    Answers: 'Why did the model predict this?' across 3M/6M Schedule and 3M/6M Cost.
    """
    try:
        res = ai_engine.get_ai_model_explanations(project_id)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Model explanations generation error: {e}")

    exp_map = {}
    for k, v in res.get("explanations", {}).items():
        exp_map[k] = ModelExplanationItem(**v)

    return ProjectModelExplanationsResponse(
        project_id=project_id,
        project_name=res.get("project_name", f"Project {project_id}"),
        explanations=exp_map
    )


@router.get("/{project_id}/warnings", response_model=ProjectEarlyWarningsResponse, summary="AI Early Warnings")
def get_project_early_warnings_endpoint(project_id: str):
    """
    Dedicated AI Early Warnings section for project anomaly alerts.
    """
    try:
        res = ai_engine.get_ai_early_warnings(project_id)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Early warnings generation error: {e}")

    return ProjectEarlyWarningsResponse(
        project_id=res["project_id"],
        project_name=res["project_name"],
        section_title=res["section_title"],
        stage_case=res["stage_case"],
        total_warnings=res["total_warnings"],
        warnings=[EarlyWarningItem(**w) for w in res["warnings"]]
    )


@router.get("/{project_id}/recommendations", response_model=ProjectRecommendationsResponse, summary="AI Recommendations")
def get_project_recommendations_endpoint(project_id: str):
    """
    Generate prioritized actionable recommendations based on identified risk drivers.
    """
    try:
        res = ai_engine.get_ai_recommendations(project_id)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Recommendations generation error: {e}")

    return ProjectRecommendationsResponse(
        project_id=res["project_id"],
        project_name=res["project_name"],
        total_recommendations=res["total_recommendations"],
        recommendations=[RecommendationItem(**r) for r in res["recommendations"]]
    )


@router.post("/{project_id}/chat", response_model=ChatResponse, summary="Grounded Project AI Chat Assistant")
def chat_with_project_assistant_endpoint(project_id: str, req: ChatRequest):
    """
    Ask interactive grounded questions to the Project AI Assistant.
    """
    try:
        hist = [{"role": m.role, "content": m.content} for m in req.history] if req.history else []
        ans = ai_engine.answer_project_chat(project_id, req.question, hist)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Chat assistant error: {e}")

    return ChatResponse(
        project_id=project_id,
        question=req.question,
        answer=ans
    )
