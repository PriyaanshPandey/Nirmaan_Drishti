"""
What-If Simulator & Scenario Analysis Pydantic Schemas.
"""
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field, ConfigDict


class WhatIfRequest(BaseModel):
    additional_cost: float = Field(
        0.0,
        ge=0.0,
        description="Additional project cost in ₹ Crore (non-negative)"
    )
    additional_delay_months: float = Field(
        0.0,
        ge=0.0,
        description="Additional project schedule delay in months (non-negative)"
    )
    monthly_expenditure: Optional[float] = Field(
        None,
        ge=0.0,
        description="Monthly expenditure burn rate in ₹ Crore/month. Defaults to baseline if None."
    )


class WhatIfMetricItem(BaseModel):
    cost: float = Field(..., description="Sanctioned/revised total cost in ₹ Crore")
    project_cost: Optional[float] = Field(None, description="Alias for cost in ₹ Crore")
    remaining_months: float = Field(..., description="Estimated/planned remaining months to completion")
    monthly_expenditure: float = Field(..., description="Monthly expenditure velocity in ₹ Crore/month")
    predicted_cost_overrun: float = Field(..., description="Predicted total cost overrun percentage (%)")
    predicted_schedule_delay: float = Field(..., description="Predicted total schedule extension in months")
    risk_score: float = Field(..., description="Composite 0-100 Risk Score from centralized risk engine")
    risk_level: str = Field(..., description="Risk tier: Low, Medium, High, Critical")
    cost_risk_component: float = Field(..., description="Normalized 0-100 Cost Risk component")
    schedule_risk_component: float = Field(..., description="Normalized 0-100 Schedule Risk component")
    estimated_months_to_complete: Optional[float] = Field(
        None,
        description="Calculated operational metric: remaining budget / monthly expenditure"
    )

    model_config = ConfigDict(from_attributes=True)


class WhatIfImpactItem(BaseModel):
    cost_change: float = Field(0.0, description="Change in total cost (₹ Crore)")
    cost: Optional[float] = Field(None, description="Alias for cost change (₹ Crore)")
    remaining_months_change: float = Field(0.0, description="Change in remaining duration (months)")
    remaining_months: Optional[float] = Field(None, description="Alias for remaining duration change (months)")
    expenditure_change: float = Field(0.0, description="Change in monthly expenditure (₹ Crore/month)")
    monthly_expenditure: Optional[float] = Field(None, description="Alias for expenditure change (₹ Crore/month)")
    cost_overrun_change: float = Field(0.0, description="Change in predicted cost overrun (percentage points)")
    cost_overrun: Optional[float] = Field(None, description="Alias for cost overrun change (pp)")
    schedule_delay_change: float = Field(0.0, description="Change in predicted schedule delay (months)")
    schedule_delay: Optional[float] = Field(None, description="Alias for schedule delay change (months)")
    risk_score_change: float = Field(0.0, description="Change in composite Risk Score points")
    risk_score: Optional[float] = Field(None, description="Alias for risk score change (points)")

    model_config = ConfigDict(from_attributes=True)


class PDPPoint(BaseModel):
    x: float
    y: float


class PDPCurve(BaseModel):
    feature_name: str
    x_label: str
    y_label: str
    points: List[PDPPoint]
    baseline_point: PDPPoint
    scenario_point: PDPPoint


class WhatIfResponse(BaseModel):
    project_id: str
    project_name: str
    baseline: WhatIfMetricItem
    scenario: WhatIfMetricItem
    impact: WhatIfImpactItem
    change: Optional[WhatIfImpactItem] = None
    pdp_cost: PDPCurve
    pdp_schedule: PDPCurve
    narrative_insight: str

    model_config = ConfigDict(from_attributes=True)
