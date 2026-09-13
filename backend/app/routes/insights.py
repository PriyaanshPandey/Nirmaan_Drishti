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

    # ─── Emerging Issues — computed strictly from real dataset fields ─────────
    cost_ov_count = cost_overrun_count
    time_ov_count = time_overrun_count
    fin_lead_count = db.query(func.count(Project.id)).filter(
        (Project.financial_progress - Project.physical_progress) > 15
    ).scalar() or 0
    critical_delay_count = db.query(func.count(Project.id)).filter(
        Project.schedule_extension_months >= 24
    ).scalar() or 0
    high_cap_risk_count = db.query(func.count(Project.id)).filter(
        Project.revised_cost >= 500,
        Project.risk_score >= 70
    ).scalar() or 0

    # Compute percentage change vs avg (normalized to project count)
    def pct_of_total(count: int) -> str:
        if total == 0:
            return "+0%"
        pct = round(count / total * 100)
        return f"+{pct}%"

    emerging_issues = [
        {"label": "Schedule Overrun Exposure", "count": time_ov_count, "impact": pct_of_total(time_ov_count)},
        {"label": "Cost Overrun Exposure", "count": cost_ov_count, "impact": pct_of_total(cost_ov_count)},
        {"label": "Financial-Physical Divergence", "count": fin_lead_count, "impact": pct_of_total(fin_lead_count)},
        {"label": "Critical Delay Zone (>24M)", "count": critical_delay_count, "impact": pct_of_total(critical_delay_count)},
        {"label": "Major Budget Escalation (>500 Cr)", "count": high_cap_risk_count, "impact": pct_of_total(high_cap_risk_count)},
    ]

    # ─── Pattern Detection Counts — grounded in actual physical/cost telemetry ─
    pat1_count = db.query(func.count(Project.id)).filter(
        Project.financial_progress > 75,
        Project.physical_progress < 50
    ).scalar() or 0

    pat2_count = db.query(func.count(Project.id)).filter(
        Project.cost_overrun_pct > 10,
        Project.schedule_extension_months > 12
    ).scalar() or 0

    pat3_count = db.query(func.count(Project.id)).filter(
        Project.physical_progress < 60,
        Project.schedule_extension_months > 12
    ).scalar() or 0

    patterns = [
        {
            "title": "High Expenditure Pacing vs Lagging Physical Completion",
            "count": pat1_count,
            "risk": "High Risk",
            "riskClass": "font-red",
            "detail": f"{pat1_count} projects affected. Financial disbursement significantly outpaces certified on-site delivery. Immediate reconciliation recommended."
        },
        {
            "title": "Compounded Cost Overrun & Milestone Slippage",
            "count": pat2_count,
            "risk": "High Risk",
            "riskClass": "font-red",
            "detail": f"{pat2_count} projects affected. Concurrent timeline extension (>12M) and budget overrun (>10%)."
        },
        {
            "title": "Low Physical Velocity on Extended Infrastructure Corridors",
            "count": pat3_count,
            "risk": "Medium Risk",
            "riskClass": "font-orange",
            "detail": f"{pat3_count} projects affected. Sub-60% physical completion coupled with over 12 months of accumulated schedule slippage."
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
    phys_lag_count = db.query(func.count(Project.id)).filter(
        (Project.physical_progress < Project.physical_progress_target - 5) |
        ((Project.schedule_extension_months > 0) & (Project.physical_progress < 80))
    ).scalar() or 0
    
    cost_escalation_count = cost_overrun_count
    mile_slippage_count = time_overrun_count
    
    financial_gap_count = db.query(func.count(Project.id)).filter(
        (Project.financial_progress - Project.physical_progress) > 15
    ).scalar() or 0
    
    stagnation_count = db.query(func.count(Project.id)).filter(
        Project.physical_progress < 50,
        Project.schedule_extension_months > 12
    ).scalar() or 0

    risk_drivers = [
        {
            "label": "Physical Progress Lag",
            "pct": round(phys_lag_count / denom * 100),
            "color": "bg-accent"
        },
        {
            "label": "Milestone Slippage",
            "pct": round(mile_slippage_count / denom * 100),
            "color": "bg-accent"
        },
        {
            "label": "Cost Escalation",
            "pct": round(cost_escalation_count / denom * 100),
            "color": "bg-accent" if (cost_escalation_count / denom * 100) >= 30 else "bg-orange"
        },
        {
            "label": "Financial Outlay Divergence",
            "pct": round(financial_gap_count / denom * 100),
            "color": "bg-orange"
        },
        {
            "label": "Work Stagnation Risk",
            "pct": round(stagnation_count / denom * 100),
            "color": "bg-info"
        },
    ]

    # ─── AI Summary Text ─────────────────────────────────────────────────────
    summary_text = (
        f"Portfolio telemetry indicates active risk concentration in physical milestone execution and timeline slippage, "
        f"with {high_risk} projects showing elevated risk signals. "
        f"Across active projects with timeline extensions, the average recorded schedule extension is "
        f"{avg_delay} months."
    )

    # ─── Recommendations — derived from verified portfolio risk drivers ─────
    recommendations = [
        {
            "id": 1,
            "title": "Establish Milestone Recovery Protocols",
            "impact": "High Impact",
            "impactClass": "font-red",
            "iconType": "clock",
            "iconBg": "var(--color-accent-red)",
            "desc": f"Timeline slippage affects {mile_slippage_count} projects across central sector portfolios.",
        },
        {
            "id": 2,
            "title": "Enforce Strict Physical-Financial Reconciliation",
            "impact": "High Impact",
            "impactClass": "font-red",
            "iconType": "shield",
            "iconBg": "var(--color-accent-red)",
            "desc": f"Financial disbursement exceeds certified physical delivery by >15% in {financial_gap_count} projects.",
        },
        {
            "id": 3,
            "title": "Conduct Capital Outlay Audits for Overrun Projects",
            "impact": "Medium Impact",
            "impactClass": "font-orange",
            "iconType": "shield",
            "iconBg": "#F59E0B",
            "desc": f"Budget revisions recorded in {cost_escalation_count} projects requiring enhanced expenditure controls.",
        },
        {
            "id": 4,
            "title": "Fast-Track Stagnant Project Work Packages",
            "impact": "Medium Impact",
            "impactClass": "font-orange",
            "iconType": "users",
            "iconBg": "#F59E0B",
            "desc": f"Zero or sluggish progress advancement observed in {stagnation_count} extended infrastructure corridors.",
        }
    ]

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
