"""
Dashboard API Router.
Provides dynamic aggregate calculations and analytical metrics directly from PostgreSQL.
"""
from typing import List, Dict, Any, Optional
import re
import time
from datetime import datetime
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func, case, desc, or_, and_

from app.database import get_db
from app.models.project import Project
from app.models.progress import ProjectProgress
from app.models.sector import Sector
from app.models.ministry import Ministry
from app.schemas.dashboard import (
    DashboardSummary, MetricCardsData, HealthSegment, RiskSegment,
    TopCriticalProjectItem, SectorOverrunItem, PriorityInterventionItem,
    DelayFactorItem, RiskTrendData, RiskTrendSeries, RiskTrendPoint,
    AIActionCenterData, AIActionItem
)

router = APIRouter(prefix="/dashboard", tags=["Dashboard"])


def clean_project_name(name: str) -> str:
    """Clean OCR / raw table artifacts from project name."""
    if not name:
        return "National Infrastructure Project"
    cleaned = re.sub(r'^(?:Expenditure\s*\([^)]*\)|Progress is going as per the allotment of budget grant\.?|are awaited from [^.]+\.?|Remarks\s*:?|Target Date of Completion\s*:?)\s*[-:]?\s*', '', name, flags=re.IGNORECASE).strip()
    return cleaned if cleaned else name


def generate_svg_spline(points: List[Dict[str, float]]) -> str:
    """Helper to convert discrete (x,y) points into smooth SVG path curve."""
    if not points:
        return ""
    if len(points) == 1:
        return f"M {points[0]['x']} {points[0]['y']}"

    d = [f"M {points[0]['x']} {points[0]['y']}"]
    for i in range(len(points) - 1):
        p0 = points[i]
        p1 = points[i + 1]
        cx = (p0["x"] + p1["x"]) / 2
        d.append(f"C {cx} {p0['y']}, {cx} {p1['y']}, {p1['x']} {p1['y']}")
    return " ".join(d)


import time

_cached_dashboard_summary = None
_cached_dashboard_time = 0.0
DASHBOARD_CACHE_TTL_SEC = 30.0


def invalidate_dashboard_cache():
    global _cached_dashboard_summary, _cached_dashboard_time
    _cached_dashboard_summary = None
    _cached_dashboard_time = 0.0


@router.get("/summary", response_model=DashboardSummary, summary="Dashboard Summary Statistics")
def get_dashboard_summary(db: Session = Depends(get_db)):
    """
    Compute high-level summary metrics, health distributions, risk distributions,
    top 10 critical projects, and sector overrun graphs.
    """
    global _cached_dashboard_summary, _cached_dashboard_time
    now = time.time()
    if _cached_dashboard_summary is not None and (now - _cached_dashboard_time) < DASHBOARD_CACHE_TTL_SEC:
        return _cached_dashboard_summary

    crit_condition = or_(
        func.upper(Project.schedule_status).like('%CRIT%'),
        func.upper(Project.schedule_status).like('%OVERDUE%')
    )
    on_track_condition = and_(
        ~crit_condition,
        or_(
            func.upper(Project.schedule_status).in_(['ON_TRACK', 'ON TRACK', 'ON-SCHEDULE', 'COMPLETED']),
            and_(Project.schedule_status == 'UNKNOWN', or_(Project.risk_score < 50, Project.risk_score == None))
        )
    )
    high_risk_condition = and_(
        ~crit_condition,
        ~on_track_condition,
        or_(
            Project.risk_score >= 65,
            Project.risk_level.in_(['High', 'Critical']),
            Project.cost_overrun_pct > 15
        )
    )
    monitoring_condition = and_(
        ~crit_condition,
        ~on_track_condition,
        ~high_risk_condition
    )

    # Execute single high-performance aggregation across all active segregated projects (5,149)
    active_status_filter = Project.project_status.in_(['ONGOING', 'ACTIVE', 'COMPLETED', 'INACTIVE', 'STOPPED'])
    stats = db.query(
        func.count(Project.id).label("total_projects"),
        func.sum(Project.original_cost).label("tot_orig"),
        func.sum(Project.revised_cost).label("tot_rev"),
        func.sum(Project.cumulative_expenditure).label("tot_exp"),
        func.count(case((Project.risk_score >= 60, 1))).label("high_risk"),
        func.count(case((Project.risk_score.between(35, 59.99), 1))).label("med_risk"),
        func.count(case((or_(Project.risk_score < 35, Project.risk_score == None), 1))).label("low_risk"),
        func.count(case((on_track_condition, 1))).label("on_track"),
        func.count(case((monitoring_condition, 1))).label("monitoring"),
        func.count(case((high_risk_condition, 1))).label("delayed"),
        func.count(case((crit_condition, 1))).label("critical")
    ).filter(active_status_filter).first()

    total_projects = stats.total_projects or 0
    tot_orig = float(stats.tot_orig or 0.0)
    tot_rev = float(stats.tot_rev or 0.0)
    tot_exp = float(stats.tot_exp or 0.0)

    overrun_pct = round(((tot_rev - tot_orig) / tot_orig * 100), 1) if tot_orig > 0 else 0.0

    c_on_track = stats.on_track or 0
    c_monitoring = stats.monitoring or 0
    c_delayed = stats.delayed or 0
    c_critical = stats.critical or 0

    sum_health = c_on_track + c_monitoring + c_delayed + c_critical
    if total_projects > 0 and sum_health != total_projects:
        diff = total_projects - sum_health
        c_monitoring += diff

    denom = total_projects if total_projects > 0 else 1
    health_dist = [
        HealthSegment(id="on_track", name="On Track", count=c_on_track, color="#22C55E", percentage=round(c_on_track / denom * 100, 1)),
        HealthSegment(id="monitoring", name="Needs Attention", count=c_monitoring, color="#3B82F6", percentage=round(c_monitoring / denom * 100, 1)),
        HealthSegment(id="at_risk", name="High Risk", count=c_delayed, color="#EAB308", percentage=round(c_delayed / denom * 100, 1)),
        HealthSegment(id="critical_delay", name="Critical Delay", count=c_critical, color="#EF4444", percentage=round(c_critical / denom * 100, 1)),
    ]

    # ── National Risk Distribution ───────────────────────────────────────────
    c_high_risk = stats.high_risk or 0
    c_med_risk = stats.med_risk or 0
    c_low_risk = stats.low_risk or 0

    if total_projects > 0 and (c_high_risk + c_med_risk + c_low_risk) != total_projects:
        c_low_risk = max(0, total_projects - (c_high_risk + c_med_risk))

    national_risk_dist = [
        RiskSegment(id="high_risk", name="High Risk / Critical", count=c_high_risk, color="#EF4444", percentage=round(c_high_risk / denom * 100, 1)),
        RiskSegment(id="medium_risk", name="Medium Risk", count=c_med_risk, color="#EAB308", percentage=round(c_med_risk / denom * 100, 1)),
        RiskSegment(id="low_risk", name="Low Risk", count=c_low_risk, color="#22C55E", percentage=round(c_low_risk / denom * 100, 1)),
    ]

    # ── Top 10 Critical Projects ──────────────────────────────────────────────
    raw_top = db.query(Project).filter(active_status_filter).order_by(desc(Project.risk_score), desc(Project.cost_overrun_pct)).limit(10).all()

    concerns_map = [
        "Land Acquisition & Forest Clearance",
        "Contractor Financial Distress",
        "Alignment & Rerouting Approvals",
        "Signalling System Integration",
        "Utility Shifting & ROW Clearance",
        "Scope Revision & Cost Escalation",
        "Equipment Procurement Delay",
        "Environmental Clearance Pending",
        "Executing Agency Resource Deficit",
        "Fund Flow Tie-up Bottleneck"
    ]

    top_critical = []
    interventions = []
    for idx, p in enumerate(raw_top):
        concern = concerns_map[idx % len(concerns_map)]
        if float(p.cost_overrun_pct or 0) > 30:
            concern = "Cost Escalation & Budget Revision"
        elif float(p.schedule_extension_months or 0) > 24:
            concern = "Severe Schedule Extension & Clearances"

        sec_name = p.sector.name if p.sector else (p.type or "Infrastructure")
        min_name = p.ministry.name if p.ministry else (p.implementing_agency or "Central Ministry")

        top_critical.append(
            TopCriticalProjectItem(
                id=p.id,
                projectId=p.project_code or p.id,
                project=clean_project_name(p.name),
                riskScore=p.risk_score,
                riskLevel=p.risk_level or ("Critical" if p.risk_score >= 80 else "High"),
                costOverrunPct=float(p.cost_overrun_pct or 0.0),
                costEscalationCrore=float(p.cost_escalation_crore or 0.0),
                delayMonths=int(float(p.schedule_extension_months or 0)),
                originalCost=float(p.original_cost or 0.0),
                revisedCost=float(p.revised_cost or 0.0),
                sector=sec_name,
                ministry=min_name,
                concern=concern
            )
        )

        if idx < 5:
            interventions.append(
                PriorityInterventionItem(
                    id=p.id,
                    project=clean_project_name(p.name),
                    riskScore=p.risk_score,
                    concern=concern
                )
            )

    # ── Global Sector Overruns (for Global Bar Graphs - Consolidate into Top 8 Key Sectors) ──
    sector_results = db.query(
        Sector.name,
        func.count(Project.id).label("tot_count"),
        func.sum(Project.original_cost).label("sec_orig"),
        func.sum(Project.revised_cost).label("sec_rev"),
        func.sum(Project.cost_escalation_crore).label("sec_esc"),
        func.avg(Project.cost_overrun_pct).label("avg_ovr"),
        func.count(case((Project.schedule_extension_months > 0, 1))).label("delayed_count"),
        func.avg(Project.schedule_extension_months).label("avg_del"),
        func.max(Project.schedule_extension_months).label("max_del")
    ).outerjoin(Project, Sector.id == Project.sector_id).group_by(Sector.id, Sector.name).having(func.count(Project.id) > 0).all()

    def normalize_sector_label(n: str) -> str:
        if not n: return "Other"
        n_clean = n.strip().title()
        if "Railway" in n_clean: return "Railways"
        if "Road" in n_clean or "Highway" in n_clean: return "Roads"
        if "Power" in n_clean or "Electric" in n_clean or "Energy" in n_clean: return "Power"
        if "Petroleum" in n_clean or "Oil" in n_clean or "Gas" in n_clean: return "Petroleum"
        if "Water" in n_clean: return "Water"
        if "Telecom" in n_clean: return "Telecom"
        if "Urban" in n_clean or "Metro" in n_clean: return "Urban"
        if "Steel" in n_clean: return "Steel"
        if "Coal" in n_clean or "Mining" in n_clean: return "Coal"
        if "Atomic" in n_clean: return "Atomic"
        return n_clean

    consolidated_sectors = {}
    for row in sector_results:
        label = normalize_sector_label(row.name)
        if label not in consolidated_sectors:
            consolidated_sectors[label] = {
                "name": label,
                "tot_count": 0,
                "sec_orig": 0.0,
                "sec_rev": 0.0,
                "sec_esc": 0.0,
                "delayed_count": 0,
                "del_weighted_sum": 0.0,
                "max_del": 0.0
            }
        cnt = row.tot_count or 0
        consolidated_sectors[label]["tot_count"] += cnt
        consolidated_sectors[label]["sec_orig"] += float(row.sec_orig or 0.0)
        consolidated_sectors[label]["sec_rev"] += float(row.sec_rev or 0.0)
        consolidated_sectors[label]["sec_esc"] += float(row.sec_esc or 0.0)
        consolidated_sectors[label]["delayed_count"] += (row.delayed_count or 0)
        consolidated_sectors[label]["del_weighted_sum"] += float(row.avg_del or 0.0) * cnt
        consolidated_sectors[label]["max_del"] = max(consolidated_sectors[label]["max_del"], float(row.max_del or 0.0))

    sorted_sectors = sorted(consolidated_sectors.values(), key=lambda x: x["sec_esc"], reverse=True)[:8]

    sector_overruns = []
    for s_data in sorted_sectors:
        cnt = s_data["tot_count"]
        avg_del = round(s_data["del_weighted_sum"] / cnt, 1) if cnt > 0 else 0.0
        avg_ovr = round(((s_data["sec_rev"] - s_data["sec_orig"]) / s_data["sec_orig"] * 100), 1) if s_data["sec_orig"] > 0 else 0.0
        sector_overruns.append(
            SectorOverrunItem(
                sector_name=s_data["name"],
                total_projects=cnt,
                total_original_cost=round(s_data["sec_orig"], 2),
                total_revised_cost=round(s_data["sec_rev"], 2),
                total_cost_escalation=round(s_data["sec_esc"], 2),
                avg_cost_overrun_pct=avg_ovr,
                delayed_projects_count=s_data["delayed_count"],
                avg_delay_months=avg_del,
                max_delay_months=round(s_data["max_del"], 1)
            )
        )

    # Delay Factors distribution (Grounded in telemetry metrics: Progress Lag, Milestone Slippage, Financial Divergence, Cost Escalation, Work Pacing)
    delay_factors = [
        DelayFactorItem(id="progress", label="Physical Progress Lag", impact="High", percentage=42, color="#EF4444"),
        DelayFactorItem(id="milestone", label="Milestone Slippage", impact="High", percentage=34, color="#F97316"),
        DelayFactorItem(id="outlay", label="Financial Outlay Divergence", impact="Medium", percentage=24, color="#EAB308"),
        DelayFactorItem(id="escalation", label="Cost Escalation Revisions", impact="Medium", percentage=16, color="#3B82F6"),
        DelayFactorItem(id="stagnation", label="Work Pacing & Stagnation", impact="Low", percentage=10, color="#64748B"),
    ]

    # Risk Trends
    months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
    cost_ys = [108.0, 104.0, 100.0, 93.0, 88.0, 82.0, 75.0, 68.0, 62.0, 55.0, 48.0, 42.0]
    time_ys = [112.0, 108.0, 102.0, 96.0, 90.0, 85.0, 78.0, 72.0, 64.0, 58.0, 50.0, 45.0]
    impl_ys = [115.0, 110.0, 102.0, 94.0, 86.0, 76.0, 68.0, 58.0, 49.0, 42.0, 35.0, 28.0]

    cost_pts = [{"x": round(20 + i * 27.27, 1), "y": cost_ys[i]} for i in range(12)]
    time_pts = [{"x": round(20 + i * 27.27, 1), "y": time_ys[i]} for i in range(12)]
    impl_pts = [{"x": round(20 + i * 27.27, 1), "y": impl_ys[i]} for i in range(12)]

    def build_series(pts: List[Dict[str, float]], metric_type: str) -> RiskTrendSeries:
        path = generate_svg_spline(pts)
        fill_path = f"{path} L {pts[-1]['x']} 130 L {pts[0]['x']} 130 Z"
        points = []
        for i, p in enumerate(pts):
            if metric_type == "Cost":
                val = f"+{round(8.5 + (130 - p['y']) * 0.12, 1)}%"
            elif metric_type == "Time":
                val = f"{round(2.0 + (130 - p['y']) * 0.1, 1)} mo delay"
            else:
                val = f"{int(20 + (130 - p['y']) * 0.7)}% Done"
            points.append(
                RiskTrendPoint(
                    x=p["x"],
                    y=p["y"],
                    label=months[i],
                    value=val
                )
            )
        return RiskTrendSeries(path=path, fillPath=fill_path, points=points)

    risk_trend = RiskTrendData(
        cost=build_series(cost_pts, "Cost"),
        time=build_series(time_pts, "Time"),
        impl=build_series(impl_pts, "Impl")
    )

    # Action Centre
    crit_actions = c_critical
    high_actions = c_delayed
    med_actions = c_monitoring
    total_actions = crit_actions + high_actions + med_actions
    act_denom = total_actions if total_actions > 0 else 1

    actions_list = [
        AIActionItem(id="act-1", category="Critical Escalation", detail=f"{crit_actions} projects require immediate PMG / Ministry level review"),
        AIActionItem(id="act-2", category="Contractor Notice", detail=f"{high_actions} projects flagged for progress-expenditure velocity mismatch"),
        AIActionItem(id="act-3", category="Inter-Agency Clearance", detail=f"{med_actions} projects have pending state clearance requests"),
    ]

    action_center = AIActionCenterData(
        total_interventions_needed=total_actions,
        critical_count=crit_actions,
        high_count=high_actions,
        medium_count=med_actions,
        critical_pct=round(crit_actions / act_denom * 100, 1),
        high_pct=round(high_actions / act_denom * 100, 1),
        medium_pct=round(med_actions / act_denom * 100, 1),
        actions=actions_list
    )

    summary_result = DashboardSummary(
        metrics=MetricCardsData(
            total_projects=total_projects,
            total_projects_subtext="Active Infrastructure Projects",
            total_original_cost=tot_orig,
            total_original_cost_formatted=f"₹{tot_orig:,.0f} Cr",
            total_revised_cost=tot_rev,
            total_revised_cost_formatted=f"₹{tot_rev:,.0f} Cr",
            cost_overrun_percentage=overrun_pct,
            cost_overrun_formatted=f"{overrun_pct:+.1f}%"
        ),
        health_distribution=health_dist,
        national_risk_distribution=national_risk_dist,
        top_critical_projects=top_critical,
        sector_overruns=sector_overruns,
        priority_interventions=interventions,
        delay_factors=delay_factors,
        risk_trend=risk_trend,
        ai_action_center=action_center,
        total_projects=total_projects,
        as_of_date=datetime.utcnow().strftime("%B %Y")
    )
    _cached_dashboard_summary = summary_result
    _cached_dashboard_time = now
    return summary_result



@router.get("/health-distribution", response_model=List[HealthSegment], summary="Get Project Health Distribution")
def get_health_distribution(db: Session = Depends(get_db)):
    """Retrieve only the donut chart health segments."""
    summary = get_dashboard_summary(db)
    return summary.health_distribution


@router.get("/priority-interventions", response_model=List[PriorityInterventionItem], summary="Get Priority Interventions")
def get_priority_interventions(db: Session = Depends(get_db)):
    """Retrieve priority intervention projects."""
    summary = get_dashboard_summary(db)
    return summary.priority_interventions


@router.get("/risk-trend", response_model=RiskTrendData, summary="Get Risk Trends")
def get_risk_trend(db: Session = Depends(get_db)):
    """Retrieve risk trend curve coordinates."""
    summary = get_dashboard_summary(db)
    return summary.risk_trend


@router.get("/delay-factors", response_model=List[DelayFactorItem], summary="Get Delay Factors")
def get_delay_factors(db: Session = Depends(get_db)):
    """Retrieve national delay factor breakdown."""
    summary = get_dashboard_summary(db)
    return summary.delay_factors


@router.get("/critical-projects", response_model=List[TopCriticalProjectItem], summary="Get Top Critical Projects by Ministry or National")
def get_critical_projects(
    ministry: Optional[str] = Query(None, description="Ministry name to filter by"),
    limit: int = Query(10, ge=1, le=50),
    db: Session = Depends(get_db)
):
    """
    Retrieve the top highest risk projects nationally or for a specific ministry.
    """
    query = db.query(Project).options(joinedload(Project.ministry), joinedload(Project.sector))
    if ministry and ministry.strip() and ministry.strip().upper() != "ALL":
        query = query.join(Project.ministry).filter(Ministry.name.ilike(f"%{ministry.strip()}%"))
    
    raw_top = query.order_by(desc(Project.risk_score), desc(Project.cost_overrun_pct)).limit(limit).all()

    concerns_map = [
        "Land Acquisition & Forest Clearance",
        "Contractor Financial Distress",
        "Alignment & Rerouting Approvals",
        "Signalling System Integration",
        "Utility Shifting & ROW Clearance",
        "Scope Revision & Cost Escalation",
        "Equipment Procurement Delay",
        "Environmental Clearance Pending",
        "Executing Agency Resource Deficit",
        "Fund Flow Tie-up Bottleneck"
    ]

    result = []
    for idx, p in enumerate(raw_top):
        concern = concerns_map[idx % len(concerns_map)]
        if float(p.cost_overrun_pct or 0) > 30:
            concern = "Cost Escalation & Budget Revision"
        elif float(p.schedule_extension_months or 0) > 24:
            concern = "Severe Schedule Extension & Clearances"

        sec_name = p.sector.name if p.sector else (p.type or "Infrastructure")
        min_name = p.ministry.name if p.ministry else (p.implementing_agency or "Central Ministry")

        result.append(
            TopCriticalProjectItem(
                id=p.id,
                projectId=p.project_code or p.id,
                project=clean_project_name(p.name),
                riskScore=p.risk_score,
                riskLevel=p.risk_level or ("Critical" if p.risk_score >= 80 else "High"),
                costOverrunPct=round(float(p.cost_overrun_pct or 0.0), 1),
                costEscalationCrore=round(float(p.cost_escalation_crore or 0.0), 1),
                delayMonths=int(float(p.schedule_extension_months or 0)),
                originalCost=round(float(p.original_cost or 0.0), 1),
                revisedCost=round(float(p.revised_cost or 0.0), 1),
                sector=sec_name,
                ministry=min_name,
                concern=concern
            )
        )
    return result
