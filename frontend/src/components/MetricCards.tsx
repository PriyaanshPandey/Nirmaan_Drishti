import React, { useState, useEffect } from 'react';
import './MetricCards.css';
import { AnimatedCounter } from './AnimatedCounter';
import { api, type DashboardSummaryData } from '../services/api';
import { InfoButton } from './ExplainabilityInfo';

const DEFAULT_METRICS: DashboardSummaryData['metrics'] = {
  total_projects: 3361,
  total_projects_subtext: '+124 this quarter',
  total_original_cost: 3713000,
  total_original_cost_formatted: '₹37.13 L Cr',
  total_revised_cost: 4278000,
  total_revised_cost_formatted: '₹42.78 L Cr',
  cost_overrun_percentage: 15.2,
  cost_overrun_formatted: '+15.2% overrun'
};

interface MetricCardsProps {
  activeTab?: string;
}

export const MetricCards: React.FC<MetricCardsProps> = ({ activeTab }) => {
  const [metrics, setMetrics] = useState<DashboardSummaryData['metrics']>(DEFAULT_METRICS);

  useEffect(() => {
    let isMounted = true;
    api.getDashboardSummary().then((res) => {
      if (!isMounted) return;
      if (res && res.metrics && res.metrics.total_projects > 0) {
        setMetrics(res.metrics);
      }
    }).catch(() => {
      // keep default fallback metrics
    });

    return () => {
      isMounted = false;
    };
  }, []);

  const origCostCr = metrics.total_original_cost || 3713000;
  const revCostCr = metrics.total_revised_cost || 4278000;
  const overrunPct = metrics.cost_overrun_percentage || 15.2;
  const totalProjects = metrics.total_projects || 3361;

  return (
    <div className="metrics-column">
      {/* Total Projects Card - Dark Navy Theme */}
      <div className="metric-card dark-theme">
        <div className="card-decor-pattern">
          <svg width="100" height="60" viewBox="0 0 100 60" fill="none" opacity="0.15">
            <path d="M 0 50 Q 20 20, 40 40 T 80 10 T 100 30" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" />
            <circle cx="80" cy="10" r="3" fill="#ffffff" />
          </svg>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', zIndex: 1 }}>
          <h3 className="metric-title" style={{ margin: 0 }}>TOTAL PROJECTS</h3>
          <InfoButton
            title="Total Projects"
            summary="Total number of major national infrastructure projects being tracked across all ministries in India."
            theme="dark"
            size="sm"
          />
        </div>
        <div className="metric-value">
          <AnimatedCounter value={totalProjects} resetKey={activeTab} />
        </div>
        <div className="metric-subtext">{metrics.total_projects_subtext || '+124 this quarter'}</div>
      </div>

      {/* Total Cost Card - Light Theme */}
      <div className="metric-card light-theme">
        <div className="card-decor-pattern">
          <svg width="100" height="60" viewBox="0 0 100 60" fill="none" opacity="0.08">
            <path d="M 0 40 L 30 40 L 50 15 L 70 50 L 100 30" stroke="var(--navy-dark)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', zIndex: 1 }}>
          <h3 className="metric-title" style={{ margin: 0 }}>TOTAL COST</h3>
          <InfoButton
            title="Original Budget"
            summary="The starting budget officially approved for all these projects before construction began."
            theme="light"
            size="sm"
          />
        </div>
        <div className="metric-value">
          <AnimatedCounter 
            value={origCostCr}
            resetKey={activeTab}
            formatter={(val) => val >= 100000 ? `₹${(val / 100000).toFixed(2)} L Cr` : `₹${Math.round(val).toLocaleString()} Cr`} 
          />
        </div>
        <div className="metric-subtext">Original Estimate</div>
      </div>

      {/* Revised Cost Card - Light Theme with Overrun Warning */}
      <div className="metric-card light-theme alert-card">
        <div className="card-decor-pattern">
          <svg width="100" height="60" viewBox="0 0 100 60" fill="none" opacity="0.1">
            <path d="M 0 50 L 25 45 L 50 25 L 75 28 L 100 5" stroke="var(--color-accent-red)" strokeWidth="2.5" strokeLinecap="round" />
            <circle cx="100" cy="5" r="4" fill="var(--color-accent-red)" />
          </svg>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', zIndex: 1 }}>
          <h3 className="metric-title" style={{ margin: 0 }}>REVISED COST</h3>
          <InfoButton
            title="Current Updated Cost"
            summary="The latest estimated total cost. The percentage shows how much costs have risen above the original budget."
            theme="light"
            size="sm"
          />
        </div>
        <div className="metric-value text-red">
          <AnimatedCounter 
            value={revCostCr}
            resetKey={activeTab}
            formatter={(val) => val >= 100000 ? `₹${(val / 100000).toFixed(2)} L Cr` : `₹${Math.round(val).toLocaleString()} Cr`} 
          />
        </div>
        <div className="metric-footer-badge">
          <span className="badge-pulse-dot" />
          <span>+<AnimatedCounter value={Math.round(overrunPct * 10)} resetKey={activeTab} formatter={(val) => (val / 10).toFixed(1)} />% overrun</span>
        </div>
      </div>
    </div>
  );
};

