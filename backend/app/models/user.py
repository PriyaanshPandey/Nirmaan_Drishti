"""
User Authentication Model.
Full auth-capable user entity with username, bcrypt password hash, and role.
Existing columns (name, email, department) preserved for backward compatibility
with any audit attribution references; they are now nullable.
"""
from datetime import datetime
from sqlalchemy import Column, Integer, String, DateTime, Boolean
from app.database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)

    # --- Authentication fields (added via migration) ---
    username = Column(String(100), unique=True, index=True, nullable=True)  # nullable until migration runs
    password_hash = Column(String(255), nullable=True)
    role = Column(String(100), default="viewer", nullable=False)  # "impd_officer" | "ministry_officer" | "viewer"
    full_name = Column(String(255), nullable=True)
    is_active = Column(Boolean, default=True, nullable=False)

    # --- Legacy reference fields (kept for backward compatibility) ---
    name = Column(String(255), nullable=True)
    email = Column(String(255), nullable=True, unique=True, index=True)
    department = Column(String(255), nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    def __repr__(self):
        return f"<User(id={self.id}, username='{self.username}', role='{self.role}')>"
