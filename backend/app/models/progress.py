"""
Project Progress and Snapshot Database Model.
Captures monthly historical time-series data for projects.
"""
from datetime import datetime
from sqlalchemy import (
    Column, Integer, String, Text, Numeric, Date, DateTime, ForeignKey, Index, UniqueConstraint
)
from sqlalchemy.orm import relationship
from app.database import Base


class ProjectProgress(Base):
    __tablename__ = "project_progress"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    project_id = Column(String(100), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, index=True)
    reporting_date = Column(Date, nullable=False, index=True)
    report_month_str = Column(String(20), nullable=True)

    # Progress & Expenditure Snapshots
    physical_progress = Column(Numeric(16, 2), default=0.0, nullable=False)
    financial_progress = Column(Numeric(16, 2), default=0.0, nullable=False)
    cumulative_expenditure = Column(Numeric(18, 2), default=0.0, nullable=False)
    revised_cost = Column(Numeric(18, 2), nullable=True)
    cost_overrun_pct = Column(Numeric(16, 2), default=0.0, nullable=False)
    schedule_extension_months = Column(Numeric(14, 2), default=0.0, nullable=False)
    overdue_days = Column(Integer, default=0, nullable=False)
    schedule_status = Column(String(50), nullable=True)

    # Delays and deltas
    physical_progress_delta_1m = Column(Numeric(16, 2), nullable=True)
    cost_overrun_delta_1m = Column(Numeric(16, 2), nullable=True)
    expenditure_ratio_delta_1m = Column(Numeric(16, 2), nullable=True)
    risk_signal_count = Column(Integer, default=0, nullable=False)

    remarks = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    # Relationships
    project = relationship("Project", back_populates="progress_records")

    __table_args__ = (
        UniqueConstraint("project_id", "reporting_date", name="uq_project_reporting_date"),
        Index("ix_project_progress_date", "project_id", "reporting_date"),
    )

    def __repr__(self):
        return f"<ProjectProgress(project_id='{self.project_id}', date='{self.reporting_date}', progress={self.physical_progress}%)>"
