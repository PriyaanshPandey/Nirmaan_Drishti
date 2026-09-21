export type ProjectStatusType = 'CRITICAL' | 'DELAYED' | 'IN REVIEW' | 'ON TRACK';

/**
 * Universal project display status resolver.
 * Accurately categorizes projects into the 4 official portfolio tiers:
 * - CRITICAL: High risk score (>= 75), explicit critical tier, or overdue
 * - DELAYED: Explicitly delayed or extended schedule
 * - IN REVIEW: Projects under review/monitoring (active construction with moderate risk/monitoring flags)
 * - ON TRACK: Successfully progressing on schedule without elevated risk
 */
export function getProjectDisplayStatus(p: {
  scheduleStatus?: string;
  riskLevel?: string;
  riskScore?: number;
  progressPhysical?: number;
}): ProjectStatusType {
  if (p.scheduleStatus === 'CRITICAL' || p.riskLevel === 'Critical' || (p.riskScore !== undefined && p.riskScore >= 75)) {
    return 'CRITICAL';
  }
  const stat = (p.scheduleStatus || '').toUpperCase();
  if (stat.includes('CRIT') || stat.includes('OVERDUE')) {
    return 'CRITICAL';
  }
  if (stat.includes('DELAY') || stat.includes('EXTEND')) {
    return 'DELAYED';
  }
  if (
    stat === 'IN REVIEW' ||
    stat === 'IN PROGRESS' ||
    stat.includes('REVIEW') ||
    stat.includes('PROGRESS') ||
    stat.includes('MONITOR') ||
    (stat === 'ON TRACK' && (p.progressPhysical ?? 0) > 0 && (p.progressPhysical ?? 0) < 100 && (((p.riskScore ?? 0) >= 25) || p.riskLevel === 'Medium'))
  ) {
    return 'IN REVIEW';
  }
  return 'ON TRACK';
}

export function getStatusThemeColor(status: ProjectStatusType): string {
  switch (status) {
    case 'CRITICAL':
      return '#DC2626';
    case 'DELAYED':
      return '#F59E0B';
    case 'IN REVIEW':
      return '#2563EB';
    case 'ON TRACK':
    default:
      return '#16A34A';
  }
}

export type RiskCategoryType = 'Critical' | 'High' | 'Medium' | 'Low';

export function getProjectRiskCategory(p: {
  riskScore?: number | null;
  risk_score?: number | null;
  riskLevel?: string | null;
  risk_level?: string | null;
  scheduleStatus?: string | null;
  schedule_status?: string | null;
  costOverrunPct?: string | null;
  cost_overrun_pct?: number | null;
  timeOverrunMonths?: number | null;
  time_overrun_months?: number | null;
}): RiskCategoryType {
  const score = p.riskScore ?? p.risk_score ?? (
    (p.scheduleStatus || p.schedule_status) === 'CRITICAL' ? 82 :
    (p.scheduleStatus || p.schedule_status) === 'DELAYED' ? 68 :
    (p.scheduleStatus || p.schedule_status) === 'IN REVIEW' ? 48 : 22
  );

  const rLvl = (p.riskLevel || p.risk_level || '').trim();
  if (rLvl === 'Critical' || score >= 75) {
    return 'Critical';
  }
  if (rLvl === 'High' || (score >= 60 && score < 75)) {
    return 'High';
  }
  if (rLvl === 'Medium' || (score >= 35 && score < 60)) {
    return 'Medium';
  }
  return 'Low';
}

