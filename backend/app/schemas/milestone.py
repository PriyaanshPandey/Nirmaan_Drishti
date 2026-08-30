"""
Milestone Pydantic Schemas.
"""
from typing import Optional
from datetime import date, datetime
from pydantic import BaseModel, ConfigDict


class MilestoneBase(BaseModel):
    name: str
    description: Optional[str] = None
    planned_date: Optional[date] = None
    actual_date: Optional[date] = None
    status: str = "pending"
    completion_percentage: float = 0.0


class MilestoneCreate(MilestoneBase):
    project_id: str


class MilestoneUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    planned_date: Optional[date] = None
    actual_date: Optional[date] = None
    status: Optional[str] = None
    completion_percentage: Optional[float] = None


class MilestoneResponse(MilestoneBase):
    id: int
    project_id: str
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)
