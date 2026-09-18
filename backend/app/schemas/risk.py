"""
Risk and Prediction Pydantic Schemas.
"""
from typing import Optional, List, Dict, Any
from datetime import datetime, date
from pydantic import BaseModel, ConfigDict


class SHAPDriverItem(BaseModel):
    feature: str
    label: Optional[str] = None
    actual_value: Optional[str] = None
    shap_value: float


class RiskPredictionResponse(BaseModel):
    id: Optional[int] = None
    project_id: str
    prediction_date: datetime
    horizon_months: int
    risk_score: Optional[float] = None
    risk_level: Optional[str] = None
    cost_risk_component: Optional[float] = None
    schedule_risk_component: Optional[float] = None
    predicted_cost_overrun: Optional[float] = None
    predicted_schedule_delay: Optional[float] = None
    cost_overrun_probability: Optional[float] = None
    time_overrun_probability: Optional[float] = None
    predicted_additional_overrun_pct: Optional[float] = None
    predicted_additional_cost_crore: Optional[float] = None
    predicted_final_cost_overrun_pct: Optional[float] = None
    predicted_final_revised_cost_crore: Optional[float] = None
    predicted_additional_delay_months: Optional[float] = None
    predicted_total_schedule_extension_months: Optional[float] = None
    tentative_completion_date: Optional[str] = None
    estimated_time_needed: Optional[str] = None
    top_risk_drivers: Optional[List[Dict[str, Any]]] = None
    top_protective_factors: Optional[List[Dict[str, Any]]] = None
    explanation: Optional[str] = None
    model_version: str = "2.0.0"

    model_config = ConfigDict(from_attributes=True)


class RiskSummaryResponse(BaseModel):
    total_analyzed: int
    high_risk_count: int
    high_risk_pct: float
    time_overrun_count: int
    time_overrun_pct: float
    cost_overrun_count: int
    cost_overrun_pct: float
    early_warning_count: int
    early_warning_pct: float
    low_risk_count: int
    low_risk_pct: float
    avg_risk_score: float
    distribution_categories: List[Dict[str, Any]]
