"""
Project Pydantic Schemas.
"""
from typing import Optional, List
from datetime import date, datetime
from pydantic import BaseModel, ConfigDict
from app.schemas.milestone import MilestoneResponse
from app.schemas.progress import ProgressResponse


class MinistrySimple(BaseModel):
    id: int
    name: str
    code: Optional[str] = None
    model_config = ConfigDict(from_attributes=True)


class SectorSimple(BaseModel):
    id: int
    name: str
    code: Optional[str] = None
    model_config = ConfigDict(from_attributes=True)


class ProjectBase(BaseModel):
    name: str
    project_code: Optional[str] = None
    description: Optional[str] = None
    ministry_id: Optional[int] = None
    sector_id: Optional[int] = None
    location: Optional[str] = None
    state: Optional[str] = None
    district: Optional[str] = None
    implementing_agency: Optional[str] = None
    contractor: Optional[str] = None
    phase: Optional[str] = "Construction"
    type: Optional[str] = None
    project_status: str = "ACTIVE"
    schedule_status: str = "ON TRACK"
    start_date: Optional[date] = None
    original_completion_date: Optional[date] = None
    expected_completion_date: Optional[date] = None
    actual_completion_date: Optional[date] = None
    original_cost: Optional[float] = None
    revised_cost: Optional[float] = None
    cumulative_expenditure: float = 0.0
    cost_overrun_pct: float = 0.0
    cost_escalation_crore: float = 0.0
    physical_progress: float = 0.0
    physical_progress_target: float = 0.0
    financial_progress: float = 0.0
    schedule_extension_months: float = 0.0
    delay_days: int = 0
    risk_score: int = 30
    risk_level: str = "Low"
    cost_risk: int = 20
    time_risk: int = 20
    impl_risk: int = 20
    overall_risk: int = 20


class ProjectCreate(ProjectBase):
    id: str


class ProjectUpdate(BaseModel):
    name: Optional[str] = None
    project_code: Optional[str] = None
    description: Optional[str] = None
    ministry_id: Optional[int] = None
    sector_id: Optional[int] = None
    location: Optional[str] = None
    state: Optional[str] = None
    district: Optional[str] = None
    implementing_agency: Optional[str] = None
    contractor: Optional[str] = None
    phase: Optional[str] = None
    type: Optional[str] = None
    project_status: Optional[str] = None
    schedule_status: Optional[str] = None
    start_date: Optional[date] = None
    original_completion_date: Optional[date] = None
    expected_completion_date: Optional[date] = None
    actual_completion_date: Optional[date] = None
    original_cost: Optional[float] = None
    revised_cost: Optional[float] = None
    cumulative_expenditure: Optional[float] = None
    cost_overrun_pct: Optional[float] = None
    physical_progress: Optional[float] = None
    physical_progress_target: Optional[float] = None
    financial_progress: Optional[float] = None
    risk_score: Optional[int] = None
    risk_level: Optional[str] = None


class ProjectResponse(ProjectBase):
    id: str
    created_at: datetime
    updated_at: datetime

    # Associated nested objects
    ministry: Optional[MinistrySimple] = None
    sector: Optional[SectorSimple] = None

    # Frontend UI formatted helper properties
    costApproved: Optional[str] = None
    costRevised: Optional[str] = None
    costExpenditure: Optional[str] = None
    costOverrunFormatted: Optional[str] = None
    costLabel: Optional[str] = None
    costSubtext: Optional[str] = None
    startDateFormatted: Optional[str] = None
    expectedCompletionFormatted: Optional[str] = None
    originalCompletionFormatted: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class ProjectDetailResponse(ProjectResponse):
    milestones: List[MilestoneResponse] = []
    progress_records: List[ProgressResponse] = []


class MinistryResponse(MinistrySimple):
    description: Optional[str] = None
    total_projects: Optional[int] = 0
    created_at: datetime
    updated_at: datetime


class SectorResponse(SectorSimple):
    description: Optional[str] = None
    total_projects: Optional[int] = 0
    created_at: datetime
    updated_at: datetime
