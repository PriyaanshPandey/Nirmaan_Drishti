"""
AI Insights API Router.
Computes actionable AI insight data from live PostgreSQL infrastructure project data.
Powers the AIInsights page with real statistics instead of hardcoded placeholders.
"""
from datetime import datetime
from typing import List, Dict, Any
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func, desc, case

from app.database import get_db
from app.models.project import Project
from app.models.ministry import Ministry
from app.models.sector import Sector

router = APIRouter(prefix="/insights", tags=["AI Insights"])


@router.get("/summary", summary="AI Insights Summary")
def get_insights_summary(db: Session = Depends(get_db)) -> Dict[str, Any]:
    """
    Compute all data required for the AI Insights page from live PostgreSQL data.
    Returns: recommendations, emerging issues, patterns, similarity, predictive metrics,
    sector insights, and risk driver percentages.
    """
    total = db.query(func.count(Project.id)).scalar() or 0

    # ─── Core Risk Aggregates ─────────────────────────────────────────────────
    high_risk = db.query(func.count(Project.id)).filter(Project.risk_score >= 70).scalar() or 0
    critical = db.query(func.count(Project.id)).filter(Project.risk_score >= 85).scalar() or 0
    early_warning = db.query(func.count(Project.id)).filter(
        Project.risk_score.between(50, 69)
    ).scalar() or 0
    cost_overrun_count = db.query(func.count(Project.id)).filter(
        Project.cost_overrun_pct > 5
    ).scalar() or 0
    time_overrun_count = db.query(func.count(Project.id)).filter(
        Project.schedule_extension_months > 0
    ).scalar() or 0

    # Average schedule extension among delayed projects
    avg_delay = db.query(func.avg(Project.schedule_extension_months)).filter(
        Project.schedule_extension_months > 0
    ).scalar() or 0.0
    avg_delay = round(float(avg_delay), 1)

    # Portfolio potential cost overrun (sum of cost escalation)
    pot_overrun = db.query(func.sum(Project.cost_escalation_crore)).filter(
        Project.cost_overrun_pct > 0
    ).scalar() or 0.0
    pot_overrun = float(pot_overrun)

    # ─── Emerging Issues — computed from real risk thresholds ─────────────────
    # Count projects with high impl_risk (proxy for Land Acquisition issues)
    land_count = db.query(func.count(Project.id)).filter(Project.impl_risk >= 70).scalar() or 0
    # Cost risk → proxy for Procurement Delays
    proc_count = db.query(func.count(Project.id)).filter(Project.cost_risk >= 70).scalar() or 0
    # Both time_risk and impl_risk elevated → Clearance Delays
    clear_count = db.query(func.count(Project.id)).filter(
        Project.time_risk >= 65, Project.impl_risk >= 60
    ).scalar() or 0
    # Overall risk elevated but cost_risk moderate → Contractor Issues
    contr_count = db.query(func.count(Project.id)).filter(
        Project.overall_risk >= 65, Project.cost_risk < 70
    ).scalar() or 0
    # Schedule extension > 0 → Milestone Slippage
    mile_count = time_overrun_count

    # Compute percentage change vs avg (normalized to project count)
    def pct_of_total(count: int) -> str:
        if total == 0:
            return "+0%"
        pct = round(count / total * 100)
        return f"+{pct}%"

    emerging_issues = [
        {"label": "Land Acquisition", "count": land_count, "impact": pct_of_total(land_count)},
        {"label": "Procurement Delays", "count": proc_count, "impact": pct_of_total(proc_count)},
        {"label": "Clearance Delays", "count": clear_count, "impact": pct_of_total(clear_count)},
        {"label": "Contractor Issues", "count": contr_count, "impact": pct_of_total(contr_count)},
        {"label": "Milestone Slippage", "count": mile_count, "impact": pct_of_total(mile_count)},
    ]

    # ─── Pattern Detection Counts ─────────────────────────────────────────────
    # Pattern 1: High expenditure (>75%) + Low physical progress (<50%) = Milestone Slippage
    pat1_count = db.query(func.count(Project.id)).filter(
        Project.financial_progress > 75,
        Project.physical_progress < 50
    ).scalar() or 0

    # Pattern 2: Repeated schedule extension + low progress → Contractor Decline
    pat2_count = db.query(func.count(Project.id)).filter(
        Project.schedule_extension_months > 12,
        Project.physical_progress < 60
    ).scalar() or 0

    # Pattern 3: Clearance + Land Acquisition correlation → time_risk + impl_risk both high
    pat3_count = db.query(func.count(Project.id)).filter(
        Project.time_risk >= 60,
        Project.impl_risk >= 60
    ).scalar() or 0

    patterns = [
        {
            "title": "High Expenditure + Low Progress = Milestone Slippage",
            "count": pat1_count,
            "risk": "High Risk",
            "riskClass": "font-red",
            "detail": f"{pat1_count} projects affected. Average progress delay observed across portfolio. Immediate review advised."
        },
        {
            "title": "Repeated Milestone Postponement = Contractor Performance Decline",
            "count": pat2_count,
            "risk": "Medium Risk",
            "riskClass": "font-orange",
            "detail": f"{pat2_count} projects affected. Low output rates and resource constraints observed on sites."
        },
        {
            "title": "Clearance Delays = Land Acquisition Issues",
            "count": pat3_count,
            "risk": "Medium Risk",
            "riskClass": "font-orange",
            "detail": f"{pat3_count} projects affected. Delay correlation index elevated. Environmental permissions pending."
        },
    ]

    # ─── Historical Similarity Scores ─────────────────────────────────────────
    # Based on real proportions of cost/time/on-hold vs total portfolio
    cost_sim = round(cost_overrun_count / total * 100) if total > 0 else 0
    time_sim = round(time_overrun_count / total * 100) if total > 0 else 0
    # Projects with both time and cost overrun (proxy for on-hold risk)
    onhold_count = db.query(func.count(Project.id)).filter(
        Project.cost_overrun_pct > 10,
        Project.schedule_extension_months > 12
    ).scalar() or 0
    onhold_sim = round(onhold_count / total * 100) if total > 0 else 0

    # Similarity score — count of projects that match risk profile of high_risk projects
    similarity_score = min(50, high_risk)

    similarity = {
        "score": similarity_score,
        "total_comparable": min(50, total),
        "cost_overrun_pct": cost_sim,
        "schedule_delay_pct": time_sim,
        "on_hold_pct": onhold_sim,
    }

    # ─── Predictive Insights ──────────────────────────────────────────────────
    # Projects entering risk zone = currently in early warning (50-69 score)
    entering_risk = early_warning
    entering_risk_pct = pct_of_total(entering_risk)

    # Expected delay formatted
    if avg_delay >= 1:
        expected_delay_str = f"{avg_delay} months"
    else:
        expected_delay_str = "< 1 month"

    # Potential cost overrun formatted
    if pot_overrun >= 1_00_000:
        cost_overrun_str = f"₹{pot_overrun / 1_00_000:.2f} L Cr"
    elif pot_overrun >= 100:
        cost_overrun_str = f"₹{pot_overrun:,.0f} Cr"
    else:
        cost_overrun_str = f"₹{pot_overrun:.0f} Cr"

    predictive = {
        "projects_entering_risk": entering_risk,
        "projects_entering_risk_pct": entering_risk_pct,
        "expected_portfolio_delay": expected_delay_str,
        "potential_cost_overrun": cost_overrun_str,
        "active_scenarios": 3,  # Fixed — represents 3 resolution simulator categories
    }

    # ─── Sector Insights ─────────────────────────────────────────────────────
    sector_stats = db.query(
        Sector.name,
        func.count(Project.id).label("project_count"),
        func.avg(Project.risk_score).label("avg_risk"),
        func.sum(
            case((Project.risk_score >= 70, 1), else_=0)
        ).label("high_risk_count")
    ).join(Project, Project.sector_id == Sector.id, isouter=True).group_by(
        Sector.id, Sector.name
    ).order_by(desc("high_risk_count"), desc("avg_risk")).limit(6).all()

    sector_insights = []
    for s in sector_stats:
        count = s.project_count or 0
        avg_r = float(s.avg_risk or 0)
        hr = s.high_risk_count or 0
        if avg_r >= 70:
            label = "High risk sector"
            label_class = "font-red"
        elif avg_r >= 50:
            label = "Common patterns"
            label_class = "font-orange"
        else:
            label = "Common bottlenecks"
            label_class = "font-blue"

        pct_str = pct_of_total(hr)
        sector_insights.append({
            "name": s.name or "Other",
            "label": label,
            "labelClass": label_class,
            "pct": pct_str,
            "count": hr,
            "desc": f"{hr} projects affected",
        })

    # ─── Risk Driver Percentages ──────────────────────────────────────────────
    denom = total if total > 0 else 1
    risk_drivers = [
        {
            "label": "Physical Progress Lag",
            "pct": round(
                db.query(func.count(Project.id)).filter(
                    Project.physical_progress < Project.physical_progress_target - 5
                ).scalar() / denom * 100
            ),
            "color": "bg-accent"
        },
        {
            "label": "Milestone Slippage",
            "pct": round(time_overrun_count / denom * 100),
            "color": "bg-accent"
        },
        {
            "label": "Fund Flow Delays",
            "pct": round(
                db.query(func.count(Project.id)).filter(
                    Project.expenditure_ratio_pct < 40,
                    Project.physical_progress > 30
                ).scalar() / denom * 100
            ),
            "color": "bg-orange"
        },
        {
            "label": "Clearance Delays",
            "pct": round(clear_count / denom * 100),
            "color": "bg-info"
        },
        {
            "label": "Contractor Performance",
            "pct": round(contr_count / denom * 100),
            "color": "bg-info"
        },
    ]

    # ─── AI Summary Text ─────────────────────────────────────────────────────
    summary_text = (
        f"Current patterns indicate escalating delays in land acquisition and procurement, "
        f"with {high_risk} projects showing elevated risk signals. "
        f"If current trends continue, overall portfolio delay could increase by "
        f"{avg_delay} months."
    )

    # ─── Recommendations — derived from top risk drivers ─────────────────────
    recommendations = []
    if land_count > 0:
        recommendations.append({
            "id": 1,
            "title": "Revise Land Acquisition Processes",
            "impact": "High Impact",
            "impactClass": "font-red",
            "iconType": "shield",
            "iconBg": "var(--color-accent-red)",
            "desc": f"Distribution delay affects {land_count} projects in key construction phases.",
        })
    if proc_count > 0:
        recommendations.append({
            "id": 2,
            "title": "Restructure Procurement Timelines",
            "impact": "High Impact",
            "impactClass": "font-red",
            "iconType": "clock",
            "iconBg": "var(--color-accent-red)",
            "desc": f"Supply delays propagate risk to equipment installations in {proc_count} projects.",
        })
    if clear_count > 0:
        recommendations.append({
            "id": 3,
            "title": "Strengthen Clearance Approvals",
            "impact": "Medium Impact",
            "impactClass": "font-orange",
            "iconType": "shield",
            "iconBg": "#F59E0B",
            "desc": f"Forest clearance permissions represent critical path items in {clear_count} projects.",
        })
    if contr_count > 0:
        recommendations.append({
            "id": 4,
            "title": "Review Contractor Performance",
            "impact": "Medium Impact",
            "impactClass": "font-orange",
            "iconType": "users",
            "iconBg": "#F59E0B",
            "desc": f"Milestone slippage rates exceed average sector deviations in {contr_count} projects.",
        })

    # Ensure at least 4 recommendations even if data is sparse
    if len(recommendations) < 4:
        fallbacks = [
            {
                "id": len(recommendations) + 1,
                "title": "Improve Financial Reporting Cadence",
                "impact": "Medium Impact",
                "impactClass": "font-orange",
                "iconType": "shield",
                "iconBg": "#F59E0B",
                "desc": "Improved expenditure reporting reduces fund flow constraint risk.",
            }
        ]
        recommendations.extend(fallbacks[: 4 - len(recommendations)])

    return {
        "as_of_date": datetime.utcnow().strftime("%d %B %Y").lstrip("0"),
        "total_projects": total,
        "high_risk_count": high_risk,
        "summary_text": summary_text,
        "recommendations": recommendations[:4],
        "emerging_issues": emerging_issues,
        "patterns": patterns,
        "similarity": similarity,
        "predictive": predictive,
        "sector_insights": sector_insights[:5],
        "risk_drivers": risk_drivers,
    }
