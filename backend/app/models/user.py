"""
User Reference Model (Simple Data Entity - No Authentication).
Maintained for audit attribution and data ownership references.
"""
from datetime import datetime
from sqlalchemy import Column, Integer, String, DateTime
from app.database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    name = Column(String(255), nullable=False)
    email = Column(String(255), nullable=True, unique=True, index=True)
    department = Column(String(255), nullable=True)
    role = Column(String(100), default="viewer", nullable=False) # Informational only
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    def __repr__(self):
        return f"<User(id={self.id}, name='{self.name}', role='{self.role}')>"
