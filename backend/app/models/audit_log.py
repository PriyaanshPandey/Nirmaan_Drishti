"""
Audit Log Database Model.
Tracks administrative modifications, prediction executions, and data imports.
"""
from datetime import datetime
from sqlalchemy import Column, Integer, String, DateTime, JSON
from app.database import Base


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    user_id = Column(Integer, nullable=True) # Optional reference
    action = Column(String(100), nullable=False, index=True) # e.g. IMPORT_DATA, UPDATE_PROJECT, GENERATE_PREDICTION
    entity_type = Column(String(100), nullable=False, index=True) # e.g. project, progress, prediction
    entity_id = Column(String(100), nullable=True, index=True)
    old_value = Column(JSON, nullable=True)
    new_value = Column(JSON, nullable=True)
    ip_address = Column(String(50), nullable=True)
    timestamp = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)

    def __repr__(self):
        return f"<AuditLog(action='{self.action}', entity='{self.entity_type}:{self.entity_id}', time='{self.timestamp}')>"
