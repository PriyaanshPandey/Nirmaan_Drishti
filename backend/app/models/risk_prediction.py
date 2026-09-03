"""
Risk Prediction Database Model.
Stores AI/ML predictions, cost escalation risks, schedule delays, and SHAP drivers.
"""
from datetime import datetime
from sqlalchemy import (
    Column, Integer, String, Text, Numeric, Date, DateTime, ForeignKey, JSON
)
from sqlalchemy.orm import relationship
from app.database import Base


class RiskPrediction(Base):
    __tablename__ = "risk_predictions"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    project_id = Column(String(100), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, index=True)
    prediction_date = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)
    as_of_month = Column(Date, nullable=True)
    horizon_months = Column(Integer, default=3, nullable=False)

    # Risk Probabilities (0.0 to 1.0) and Levels
    risk_score = Column(Integer, nullable=True)
    risk_level = Column(String(50), nullable=True)
    cost_overrun_probability = Column(Numeric(8, 4), nullable=True)
    time_overrun_probability = Column(Numeric(8, 4), nullable=True)

    # Cost Overrun Predictions
    predicted_additional_overrun_pct = Column(Numeric(16, 2), nullable=True)
    predicted_additional_cost_crore = Column(Numeric(18, 2), nullable=True)
    predicted_final_cost_overrun_pct = Column(Numeric(16, 2), nullable=True)
    predicted_final_revised_cost_crore = Column(Numeric(18, 2), nullable=True)

    # Schedule Delay Predictions
    predicted_additional_delay_months = Column(Numeric(14, 2), nullable=True)
    predicted_total_schedule_extension_months = Column(Numeric(14, 2), nullable=True)
    tentative_completion_date = Column(String(50), nullable=True)
    estimated_time_needed = Column(String(100), nullable=True)

    # SHAP and LLM Explainability
    top_risk_drivers = Column(JSON, nullable=True)
    top_protective_factors = Column(JSON, nullable=True)
    explanation = Column(Text, nullable=True)
    model_version = Column(String(50), default="2.0.0", nullable=False)

    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    # Relationships
    project = relationship("Project", back_populates="risk_predictions")

    def __repr__(self):
        return f"<RiskPrediction(project_id='{self.project_id}', horizon={self.horizon_months}m, cost_prob={self.cost_overrun_probability})>"
