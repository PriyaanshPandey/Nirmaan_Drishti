"""
Identifier Mapping Database Model.
Represents explicit mappings between official project_id and legacy OCMS codes.
Ensures deterministic resolution and zero identity fragmentation.
"""
from datetime import datetime
from sqlalchemy import Column, Integer, String, DateTime, Index
from app.database import Base


class ProjectIdentifierMapping(Base):
    __tablename__ = "project_identifier_mappings"

    id = Column(Integer, primary_key=True, autoincrement=True)
    project_id = Column(String(100), nullable=False, index=True)
    legacy_ocms_code = Column(String(100), nullable=False, unique=True, index=True)
    mapping_confidence = Column(String(50), default="HIGH_EXPLICIT", nullable=False)
    mapping_source = Column(String(255), default="Ongoing_Project_Detail.csv", nullable=False)
    mapping_status = Column(String(50), default="ACTIVE_VERIFIED", nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    __table_args__ = (
        Index("ix_mapping_pid_ocms", "project_id", "legacy_ocms_code"),
    )

    def __repr__(self):
        return f"<ProjectIdentifierMapping(project_id='{self.project_id}', legacy_ocms_code='{self.legacy_ocms_code}')>"
