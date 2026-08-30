"""
Alerts and Action Centre Pydantic Schemas.
"""
from typing import List, Dict, Any, Optional
from pydantic import BaseModel


class ActionQueueItem(BaseModel):
    id: int
    project: str
    projectId: str
    ministry: str
    riskEvent: str
    severity: str # Critical, High, Medium
    priorityScore: int
    financialExposure: str
    delayExposure: str
    overdue: str
    dueDate: str
    status: str # Open, In Progress, Pending


class SimulatorScenario(BaseModel):
    currentDelay: str
    currentCost: str
    projDelay: str
    projDelayReduction: str
    projSaving: str
    confidence: int


class ActionWeight(BaseModel):
    label: str
    pct: int
    color: str


class ActionCenterSummary(BaseModel):
    total_projects_requiring_intervention: int
    critical_count: int
    high_count: int
    medium_count: int
    total_financial_exposure_formatted: str
    total_delay_exposure_formatted: str
    action_items: List[ActionQueueItem]
    simulator_scenarios: Dict[str, SimulatorScenario]
    prioritization_weights: List[ActionWeight]
