import React, { useState, useEffect } from 'react';
import './MetricCards.css';
import { AnimatedCounter } from './AnimatedCounter';
import { api, type DashboardSummaryData } from '../services/api';

const DEFAULT_METRICS: DashboardSummaryData['metrics'] = {
  total_projects: 6568,
  total_projects_subtext: 'Active Infrastructure Projects',
  total_original_cost: 9435085,
  total_original_cost_formatted: '₹94.35 L Cr',
  total_revised_cost: 10651916,
  total_revised_cost_formatted: '₹106.52 L Cr',
  cost_overrun_percentage: 12.9,
  cost_overrun_formatted: '+12.9% overrun'
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
        setMetrics({
          ...res.metrics,
          total_projects_subtext: 'Active Infrastructure Projects'
        });
      }
    }).catch(() => {
      // keep dynamic fallback metrics
    });

    return () => {
      isMounted = false;
    };
  }, []);

  const origCostCr = metrics.total_original_cost || 9435085;
  const revCostCr = metrics.total_revised_cost || 10651916;
  const overrunPct = metrics.cost_overrun_percentage ?? 12.9;
  const totalProjects = metrics.total_projects || 6568;

  return (
    <div className="metrics-column">
      {/* Total Projects Card - Dark Navy Theme */}
      <div className="metric-card dark-theme">
        <div className="card-decor-pattern">
          <svg aria-hidden="true" width="100" height="60" viewBox="0 0 100 60" fill="none" opacity="0.15">
            <path d="M 0 50 Q 20 20, 40 40 T 80 10 T 100 30" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" />
            <circle cx="80" cy="10" r="3" fill="#ffffff" />
          </svg>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', zIndex: 1 }}>
          <h3 className="metric-title" style={{ margin: 0 }}>TOTAL PROJECTS</h3>
        </div>
        <div className="metric-value">
          <AnimatedCounter value={totalProjects} resetKey={activeTab} />
        </div>
        <div className="metric-subtext">{metrics.total_projects_subtext || 'Active Infrastructure Projects'}</div>
      </div>

      {/* Total Cost Card - Light Theme */}
      <div className="metric-card light-theme">
        <div className="card-decor-pattern">
          <svg aria-hidden="true" width="100" height="60" viewBox="0 0 100 60" fill="none" opacity="0.08">
            <path d="M 0 40 L 30 40 L 50 15 L 70 50 L 100 30" stroke="var(--navy-dark)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', zIndex: 1 }}>
          <h3 className="metric-title" style={{ margin: 0 }}>TOTAL COST</h3>
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
          <svg aria-hidden="true" width="100" height="60" viewBox="0 0 100 60" fill="none" opacity="0.1">
            <path d="M 0 50 L 25 45 L 50 25 L 75 28 L 100 5" stroke="var(--color-accent-red)" strokeWidth="2.5" strokeLinecap="round" />
            <circle cx="100" cy="5" r="4" fill="var(--color-accent-red)" />
          </svg>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', zIndex: 1 }}>
          <h3 className="metric-title" style={{ margin: 0 }}>REVISED COST</h3>
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

