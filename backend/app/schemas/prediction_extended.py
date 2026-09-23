"""
Extended Pydantic schemas for Model Prediction, SHAP Explainability,
AI Summaries, Early Warnings, Recommendations, and Chat Assistant.

Matches the superior Nirmaan Drishti schemas without fabricating unified 0-100 scores.
"""

from typing import Optional, Dict, Any, List
from pydantic import BaseModel


class CostHorizonPrediction(BaseModel):
    additional_escalation_probability: Optional[float] = None
    predicted_additional_overrun_pct: Optional[float] = None
    predicted_additional_cost_crore: Optional[float] = None
    predicted_final_cost_overrun_pct: Optional[float] = None
    predicted_final_cost_escalation_crore: Optional[float] = None
    predicted_final_revised_cost_crore: Optional[float] = None
    risk_tier: Optional[str] = None  # "LOW", "MODERATE", "HIGH", "CRITICAL"


class TimeHorizonPrediction(BaseModel):
    additional_delay_probability: Optional[float] = None
    predicted_additional_delay_months: Optional[float] = None
    predicted_total_schedule_extension_months: Optional[float] = None
    predicted_additional_delay: Optional[str] = None
    tentative_completion_date: Optional[str] = None
    tentative_completion_date_iso: Optional[str] = None
    estimated_time_needed_completion: Optional[str] = None
    risk_tier: Optional[str] = None  # "LOW", "MODERATE", "HIGH", "CRITICAL"


class ModelRiskMetrics(BaseModel):
    cost_escalation_risk_3m_pct: Optional[float] = None
    schedule_delay_risk_3m_pct: Optional[float] = None
    cost_risk_tier_3m: Optional[str] = None
    delay_risk_tier_3m: Optional[str] = None


class FullProjectPredictionResponse(BaseModel):
    project_id: str
    project_name: str
    as_of_month: Optional[str] = None
    is_completed: bool = False
    completed_summary: Optional[Dict[str, Any]] = None
    current_status: Dict[str, Any]
    timeline: Dict[str, Any]
    cost_prediction: Dict[str, CostHorizonPrediction]
    time_prediction: Dict[str, TimeHorizonPrediction]
    risk_metrics: ModelRiskMetrics
    project_info: Dict[str, Any]


class ShapContribution(BaseModel):
    feature: str
    shap_value: float


class EnrichedCostDriver(BaseModel):
    feature_col: str
    display_name: str
    shap_value: float
    direction: str  # "INCREASING_RISK" | "MITIGATING_RISK"
    actual_value: str
    unit: str
    description: str


class ShapExplanationResponse(BaseModel):
    model_name: str
    base_value: float
    top_risk_drivers: List[ShapContribution]
    top_protective_factors: List[ShapContribution]
    all_contributions: List[ShapContribution]


class CostDriverHorizon(BaseModel):
    top_cost_escalation_drivers: List[EnrichedCostDriver]
    mitigating_factors: List[EnrichedCostDriver]
    base_value: float


class CostDriverAnalysisResponse(BaseModel):
    project_id: str
    project_name: str
    horizon_3m: CostDriverHorizon


class AISummaryResponse(BaseModel):
    project_id: str
    project_name: str
    stage_case: str
    summary: str
    alerts_title: Optional[str] = None
    key_alerts: List[Dict[str, Any]] = []
    source: str = "Grounded AI Engine"


class EarlyWarningItem(BaseModel):
    id: str
    title: str
    severity: str  # "HIGH", "MEDIUM", "LOW"
    evidence: str
    impact: str
    detected_date: Optional[str] = None


class ProjectEarlyWarningsResponse(BaseModel):
    project_id: str
    project_name: str
    section_title: str
    stage_case: str
    total_warnings: int
    warnings: List[EarlyWarningItem]


class RecommendationItem(BaseModel):
    id: str
    priority: str  # "HIGH", "MEDIUM", "LOW"
    title: str
    recommendation: str
    reason: str
    expected_impact: str


class ProjectRecommendationsResponse(BaseModel):
    project_id: str
    project_name: str
    total_recommendations: int
    recommendations: List[RecommendationItem]


class ModelExplanationItem(BaseModel):
    model_key: str
    model_label: str
    forecast_type: str
    horizon: str
    risk_level: str
    probability_pct: Optional[float] = None
    predicted_incremental_change: Optional[str] = None
    summary: str
    primary_reasons: List[str] = []
    supporting_factors: List[str] = []
    risk_reducing_factors: List[str] = []
    provider: str


class ProjectModelExplanationsResponse(BaseModel):
    project_id: str
    project_name: str
    explanations: Dict[str, ModelExplanationItem]


class ChatMessagePayload(BaseModel):
    role: str
    content: str


class ChatRequest(BaseModel):
    question: str
    history: List[ChatMessagePayload] = []
    language: str = "en"  # "en" for English, "hi" for Hindi


class ChatResponse(BaseModel):
    project_id: str
    question: str
    answer: str
