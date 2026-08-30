"""
Schemas Package Initialization.
"""
from app.schemas.common import PaginatedResponse, MessageResponse, HealthResponse
from app.schemas.milestone import MilestoneCreate, MilestoneUpdate, MilestoneResponse
from app.schemas.progress import ProgressCreate, ProgressResponse
from app.schemas.project import (
    ProjectCreate, ProjectUpdate, ProjectResponse, ProjectDetailResponse,
    MinistryResponse, SectorResponse
)
from app.schemas.risk import RiskPredictionResponse, RiskSummaryResponse
from app.schemas.dashboard import DashboardSummary
from app.schemas.alert import ActionCenterSummary
from app.schemas.benchmark import ProjectBenchmarkResponse

__all__ = [
    "PaginatedResponse",
    "MessageResponse",
    "HealthResponse",
    "MilestoneCreate",
    "MilestoneUpdate",
    "MilestoneResponse",
    "ProgressCreate",
    "ProgressResponse",
    "ProjectCreate",
    "ProjectUpdate",
    "ProjectResponse",
    "ProjectDetailResponse",
    "MinistryResponse",
    "SectorResponse",
    "RiskPredictionResponse",
    "RiskSummaryResponse",
    "DashboardSummary",
    "ActionCenterSummary",
    "ProjectBenchmarkResponse",
]
