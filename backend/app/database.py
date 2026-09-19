"""
Database configuration and session management module.
Uses SQLAlchemy 2.0 patterns with automatic SQLite fallback.
"""
from typing import Generator
from sqlalchemy import create_engine, text
from sqlalchemy.orm import declarative_base, sessionmaker, Session
from app.config import settings

def _build_engine():
    db_url = settings.sqlalchemy_database_url
    try:
        if "sqlite" in db_url:
            eng = create_engine(db_url, connect_args={"check_same_thread": False})
        else:
            eng = create_engine(
                db_url,
                pool_pre_ping=True,
                pool_size=5,
                max_overflow=5,
                pool_recycle=300,
                pool_timeout=10,
                echo=False
            )
        # Quick ping test
        with eng.connect() as conn:
            conn.execute(text("SELECT 1"))
        return eng
    except Exception as e:
        print(f"Warning: Connection to primary database ({db_url}) failed: {e}. Falling back to SQLite...")
        fallback_url = "sqlite:///./national_infrastructure.db"
        return create_engine(fallback_url, connect_args={"check_same_thread": False})

# Create SQLAlchemy Engine
engine = _build_engine()

# Session Factory
SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine
)

# Declarative Base for models
Base = declarative_base()


def get_db() -> Generator[Session, None, None]:
    """
    FastAPI dependency that provides a transactional database session.
    Automatically closes session upon request completion.
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def check_db_connection() -> bool:
    """
    Execute a lightweight query to verify database connectivity.
    """
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        return True
    except Exception as e:
        print(f"Database health check failed: {e}")
        return False
