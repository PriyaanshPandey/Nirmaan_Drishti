"""
Project Progress Pydantic Schemas.
"""
from typing import Optional
from datetime import date, datetime
from pydantic import BaseModel, ConfigDict


class ProgressBase(BaseModel):
    reporting_date: date
    report_month_str: Optional[str] = None
    physical_progress: float = 0.0
    financial_progress: float = 0.0
    cumulative_expenditure: float = 0.0
    revised_cost: Optional[float] = None
    cost_overrun_pct: float = 0.0
    schedule_extension_months: float = 0.0
    overdue_days: int = 0
    schedule_status: Optional[str] = None
    remarks: Optional[str] = None


class ProgressCreate(ProgressBase):
    project_id: str


class ProgressResponse(ProgressBase):
    id: int
    project_id: str
    physical_progress_delta_1m: Optional[float] = None
    cost_overrun_delta_1m: Optional[float] = None
    expenditure_ratio_delta_1m: Optional[float] = None
    risk_signal_count: int = 0
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
