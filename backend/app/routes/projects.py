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

router = APIRouter(prefix="/projects", tags=["Projects"])


def format_project_response(p: Project) -> dict:
    """Helper to format numeric fields and dates for frontend consumption."""
    orig_cost = float(p.original_cost) if p.original_cost is not None else 0.0
    rev_cost = float(p.revised_cost) if p.revised_cost is not None else orig_cost
    cum_exp = float(p.cumulative_expenditure) if p.cumulative_expenditure is not None else 0.0
    overrun_pct = float(p.cost_overrun_pct) if p.cost_overrun_pct is not None else 0.0

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
        "physical_progress": float(p.physical_progress) if p.physical_progress is not None else 0.0,
        "physical_progress_target": float(p.physical_progress_target) if p.physical_progress_target is not None else 0.0,
        "financial_progress": float(p.financial_progress) if p.financial_progress is not None else 0.0,
        "schedule_extension_months": float(p.schedule_extension_months) if p.schedule_extension_months is not None else 0.0,
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
        "costApproved": f"₹{orig_cost:,.2f} Cr" if orig_cost else "N/A",
        "costRevised": f"₹{rev_cost:,.2f} Cr" if rev_cost else "N/A",
        "costExpenditure": f"₹{cum_exp:,.2f} Cr" if cum_exp else "N/A",
        "costOverrunFormatted": f"{overrun_pct:+.1f}%" if overrun_pct != 0 else "0.0%",
        "costLabel": f"₹{rev_cost:,.0f} Cr" if rev_cost else "₹0 Cr",
        "costSubtext": f"Approved: ₹{orig_cost:,.0f} Cr ({overrun_pct:+.1f}%)" if orig_cost else "",
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
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Project with ID '{project_id}' not found."
        )

    db.delete(project)
    db.commit()

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
