"""
Project Distribution API Router.
Computes sectoral and geographical distribution metrics directly from PostgreSQL.
"""
from typing import List, Dict, Any
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func, case

from app.database import get_db
from app.models.project import Project
from app.models.sector import Sector
from app.models.ministry import Ministry

router = APIRouter(prefix="/distribution", tags=["Distribution"])


@router.get("/summary", summary="Get Project Distribution Summary")
def get_distribution_summary(db: Session = Depends(get_db)) -> Dict[str, Any]:
    """
    Computes overall distribution statistics and per-sector risk breakdown directly from PostgreSQL.
    """
    total = db.query(func.count(Project.id)).scalar() or 0
    if total == 0:
        return {
            "total": 0,
            "high": 0,
            "highPct": "0%",
            "medium": 0,
            "mediumPct": "0%",
            "low": 0,
            "lowPct": "0%",
            "sectors": []
        }

    high = db.query(func.count(Project.id)).filter(Project.risk_score >= 60).scalar() or 0
    medium = db.query(func.count(Project.id)).filter(Project.risk_score.between(35, 59.99)).scalar() or 0
    low = db.query(func.count(Project.id)).filter(Project.risk_score < 35).scalar() or 0

    # Sector breakdown
    sector_results = db.query(
        Sector.name,
        func.count(Project.id).label("total_count"),
        func.count(case((Project.risk_score >= 60, 1))).label("high_count"),
        func.count(case((Project.risk_score.between(35, 59.99), 1))).label("med_count"),
        func.count(case((Project.risk_score < 35, 1))).label("low_count"),
        func.avg(Project.risk_score).label("avg_risk")
    ).outerjoin(Project, Sector.id == Project.sector_id).group_by(Sector.id, Sector.name).having(func.count(Project.id) > 0).order_by(func.count(Project.id).desc()).all()

    sector_rows = []
    for row in sector_results:
        sec_tot = row.total_count or 0
        h_cnt = row.high_count or 0
        m_cnt = row.med_count or 0
        l_cnt = row.low_count or 0
        avg_r = round(float(row.avg_risk or 0))

        sector_rows.append({
            "name": row.name,
            "total": sec_tot,
            "high": h_cnt,
            "highPct": round(h_cnt / sec_tot * 100, 1) if sec_tot > 0 else 0,
            "medium": m_cnt,
            "mediumPct": round(m_cnt / sec_tot * 100, 1) if sec_tot > 0 else 0,
            "low": l_cnt,
            "lowPct": round(l_cnt / sec_tot * 100, 1) if sec_tot > 0 else 0,
            "avgRisk": avg_r
        })

    return {
        "total": total,
        "high": high,
        "highPct": f"{round(high / total * 100, 1)}%",
        "medium": medium,
        "mediumPct": f"{round(medium / total * 100, 1)}%",
        "low": low,
        "lowPct": f"{round(low / total * 100, 1)}%",
        "sectors": sector_rows
    }
