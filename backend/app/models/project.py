"""
Project Database Model.
Represents infrastructure projects tracked in the National Infrastructure system.
"""
from datetime import datetime
from sqlalchemy import (
    Column, Integer, String, Text, Numeric, Date, DateTime, ForeignKey, Index
)
from sqlalchemy.orm import relationship
from app.database import Base


class Project(Base):
    __tablename__ = "projects"

    id = Column(String(100), primary_key=True, index=True)
    project_code = Column(String(100), nullable=True, index=True)
    legacy_ocms_code = Column(String(100), nullable=True, index=True)
    name = Column(String(500), nullable=False, index=True)
    description = Column(Text, nullable=True)

    # Foreign Keys
    ministry_id = Column(Integer, ForeignKey("ministries.id", ondelete="SET NULL"), nullable=True, index=True)
    sector_id = Column(Integer, ForeignKey("sectors.id", ondelete="SET NULL"), nullable=True, index=True)

    # Location & Agency
    location = Column(String(500), nullable=True)
    state = Column(String(255), nullable=True, index=True)
    district = Column(String(255), nullable=True)
    implementing_agency = Column(String(255), nullable=True, index=True)
    contractor = Column(String(255), nullable=True)

    # Classification & Phase
    phase = Column(String(100), nullable=True)
    type = Column(String(100), nullable=True)
    project_status = Column(String(50), default="ACTIVE", nullable=False, index=True)
    schedule_status = Column(String(50), default="ON TRACK", nullable=False, index=True)

    # Timeline Dates
    start_date = Column(Date, nullable=True)
    original_completion_date = Column(Date, nullable=True)
    expected_completion_date = Column(Date, nullable=True)
    actual_completion_date = Column(Date, nullable=True)
    project_age_months = Column(Numeric(14, 2), nullable=True)
    schedule_extension_months = Column(Numeric(14, 2), default=0.0, nullable=False)
    delay_days = Column(Integer, default=0, nullable=False)

    # Financial / Cost (in ₹ Crore)
    original_cost = Column(Numeric(18, 2), nullable=True)
    revised_cost = Column(Numeric(18, 2), nullable=True)
    cumulative_expenditure = Column(Numeric(18, 2), default=0.0, nullable=False)
    cost_overrun_pct = Column(Numeric(16, 2), default=0.0, nullable=False)
    cost_escalation_crore = Column(Numeric(18, 2), default=0.0, nullable=False)
    expenditure_ratio_pct = Column(Numeric(16, 2), default=0.0, nullable=False)

    # Progress (in %)
    physical_progress = Column(Numeric(16, 2), default=0.0, nullable=False)
    physical_progress_target = Column(Numeric(16, 2), default=0.0, nullable=False)
    financial_progress = Column(Numeric(16, 2), default=0.0, nullable=False)

    # Risk Metrics & Scoring (0-100)
    risk_score = Column(Integer, default=30, nullable=False, index=True)
    risk_level = Column(String(50), default="Low", nullable=False, index=True)
    cost_risk = Column(Integer, default=20, nullable=False)
    time_risk = Column(Integer, default=20, nullable=False)
    impl_risk = Column(Integer, default=20, nullable=False)
    overall_risk = Column(Integer, default=20, nullable=False)

    # Metadata & Quality
    source_report = Column(String(255), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    # Relationships
    ministry = relationship("Ministry", back_populates="projects")
    sector = relationship("Sector", back_populates="projects")
    milestones = relationship("Milestone", back_populates="project", cascade="all, delete-orphan", order_by="Milestone.planned_date")
    progress_records = relationship("ProjectProgress", back_populates="project", cascade="all, delete-orphan", order_by="ProjectProgress.reporting_date")
    risk_predictions = relationship("RiskPrediction", back_populates="project", cascade="all, delete-orphan", order_by="RiskPrediction.prediction_date.desc()")

    __table_args__ = (
        Index("ix_projects_status_risk", "schedule_status", "risk_level"),
        Index("ix_projects_ministry_sector", "ministry_id", "sector_id"),
    )

    def __repr__(self):
        return f"<Project(id='{self.id}', name='{self.name}', status='{self.schedule_status}')>"
