"""
Health check route.
"""
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import text
from app.database import get_db

router = APIRouter(prefix="/health", tags=["Health"])


@router.get("", summary="System and Database Health Check")
def get_health(db: Session = Depends(get_db)):
    """
    Check if FastAPI server is responsive and PostgreSQL is connected.
    """
    db_status = "disconnected"
    try:
        db.execute(text("SELECT 1"))
        db_status = "connected"
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Database connection failed: {str(e)}"
        )

    return {
        "status": "ok",
        "database": db_status,
        "version": "1.0.0",
        "timestamp": datetime.utcnow().isoformat()
    }
