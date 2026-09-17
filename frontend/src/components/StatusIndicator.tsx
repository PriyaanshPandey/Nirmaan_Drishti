import React from 'react';
import { AlertTriangle, CheckCircle2, Circle, Clock, ShieldAlert } from 'lucide-react';
import './StatusIndicator.css';

type StatusIndicatorKind = 'critical' | 'high' | 'medium' | 'low' | 'delayed' | 'on-track';

interface StatusIndicatorProps {
  kind: StatusIndicatorKind;
  label: string;
  className?: string;
}

const ICONS = {
  critical: ShieldAlert,
  high: AlertTriangle,
  medium: Circle,
  low: CheckCircle2,
  delayed: Clock,
  'on-track': CheckCircle2,
};

export const StatusIndicator: React.FC<StatusIndicatorProps> = ({ kind, label, className = '' }) => {
  const Icon = ICONS[kind];

  return (
    <span className={`status-indicator status-indicator-${kind} ${className}`}>
      <Icon size={13} strokeWidth={2.5} aria-hidden="true" />
      <span>{label}</span>
    </span>
  );
};
