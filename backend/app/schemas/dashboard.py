"""
Dashboard and Visualization Pydantic Schemas.
Directly maps backend calculations to frontend UI components.
"""
from typing import List, Dict, Any, Optional
from pydantic import BaseModel


class MetricCardsData(BaseModel):
    total_projects: int
    total_projects_subtext: str
    total_original_cost: float
    total_original_cost_formatted: str
    total_revised_cost: float
    total_revised_cost_formatted: str
    cost_overrun_percentage: float
    cost_overrun_formatted: str


class HealthSegment(BaseModel):
    id: str
    name: str
    count: int
    color: str
    percentage: float


class PriorityInterventionItem(BaseModel):
    id: str
    project: str
    riskScore: int
    concern: str


class DelayFactorItem(BaseModel):
    id: str
    label: str
    impact: str
    percentage: int
    color: str


class RiskTrendPoint(BaseModel):
    x: float
    y: float
    label: str
    value: str


class RiskTrendSeries(BaseModel):
    path: str
    fillPath: str
    points: List[RiskTrendPoint]


class RiskTrendData(BaseModel):
    cost: RiskTrendSeries
    time: RiskTrendSeries
    impl: RiskTrendSeries


class AIActionItem(BaseModel):
    id: str
    category: str
    detail: str


class AIActionCenterData(BaseModel):
    total_interventions_needed: int
    critical_count: int
    high_count: int
    medium_count: int
    critical_pct: float
    high_pct: float
    medium_pct: float
    actions: List[AIActionItem]


class DashboardSummary(BaseModel):
    metrics: MetricCardsData
    health_distribution: List[HealthSegment]
    priority_interventions: List[PriorityInterventionItem]
    delay_factors: List[DelayFactorItem]
    risk_trend: RiskTrendData
    ai_action_center: AIActionCenterData
    total_projects: int
    as_of_date: str
