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

