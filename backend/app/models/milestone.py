"""
Milestone Database Model.
"""
from datetime import datetime
from sqlalchemy import Column, Integer, String, Text, Numeric, Date, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from app.database import Base


class Milestone(Base):
    __tablename__ = "milestones"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    project_id = Column(String(100), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, index=True)
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    planned_date = Column(Date, nullable=True)
    actual_date = Column(Date, nullable=True)
    status = Column(String(50), default="pending", nullable=False) # pending, in_progress, completed, delayed, cancelled
    completion_percentage = Column(Numeric(5, 2), default=0.0, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    # Relationships
    project = relationship("Project", back_populates="milestones")

    def __repr__(self):
        return f"<Milestone(id={self.id}, project_id='{self.project_id}', name='{self.name}', status='{self.status}')>"
