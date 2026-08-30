import React, { useState, useEffect } from 'react';
import './MetricCards.css';
import { AnimatedCounter } from './AnimatedCounter';
import { api, type DashboardSummaryData } from '../services/api';

export const MetricCards: React.FC = () => {
  const [metrics, setMetrics] = useState<DashboardSummaryData['metrics'] | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<boolean>(false);

  useEffect(() => {
    let isMounted = true;
    api.getDashboardSummary().then((res) => {
      if (!isMounted) return;
      if (res && res.metrics) {
        setMetrics(res.metrics);
        setError(false);
      } else {
        setError(true);
      }
      setLoading(false);
    }).catch(() => {
      if (isMounted) {
        setError(true);
        setLoading(false);
      }
    });

    return () => {
      isMounted = false;
    };
  }, []);

  if (loading) {
    return (
      <div className="metrics-column">
        <div className="metric-card dark-theme" style={{ minHeight: '110px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ color: '#94A3B8', fontSize: '13px' }}>Loading projects...</span>
        </div>
        <div className="metric-card light-theme" style={{ minHeight: '110px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ color: '#94A3B8', fontSize: '13px' }}>Loading cost...</span>
        </div>
        <div className="metric-card light-theme" style={{ minHeight: '110px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ color: '#94A3B8', fontSize: '13px' }}>Loading overrun...</span>
        </div>
      </div>
    );
  }

  if (error || !metrics) {
    return (
      <div className="metrics-column">
        <div className="metric-card dark-theme" style={{ minHeight: '110px', padding: '16px' }}>
          <h3 className="metric-title">TOTAL PROJECTS</h3>
          <div style={{ color: '#F87171', fontSize: '12px', marginTop: '8px' }}>Unable to load data from backend.</div>
        </div>
        <div className="metric-card light-theme" style={{ minHeight: '110px', padding: '16px' }}>
          <h3 className="metric-title">TOTAL COST</h3>
          <div style={{ color: '#EF4444', fontSize: '12px', marginTop: '8px' }}>Unable to load data from backend.</div>
        </div>
        <div className="metric-card light-theme alert-card" style={{ minHeight: '110px', padding: '16px' }}>
          <h3 className="metric-title">REVISED COST</h3>
          <div style={{ color: '#EF4444', fontSize: '12px', marginTop: '8px' }}>Unable to load data from backend.</div>
        </div>
      </div>
    );
  }

  const origCostCr = metrics.total_original_cost;
  const revCostCr = metrics.total_revised_cost;
  const overrunPct = metrics.cost_overrun_percentage;

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
        <h3 className="metric-title">TOTAL PROJECTS</h3>
        <div className="metric-value">
          <AnimatedCounter value={metrics.total_projects} />
        </div>
        <div className="metric-subtext">{metrics.total_projects_subtext || 'Active Infrastructure Projects'}</div>
      </div>

      {/* Total Cost Card - Light Theme */}
      <div className="metric-card light-theme">
        <div className="card-decor-pattern">
          <svg width="100" height="60" viewBox="0 0 100 60" fill="none" opacity="0.08">
            <path d="M 0 40 L 30 40 L 50 15 L 70 50 L 100 30" stroke="var(--navy-dark)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <h3 className="metric-title">TOTAL COST</h3>
        <div className="metric-value">
          <AnimatedCounter 
            value={origCostCr} 
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
        <h3 className="metric-title">REVISED COST</h3>
        <div className="metric-value">
          <AnimatedCounter 
            value={revCostCr} 
            formatter={(val) => val >= 100000 ? `₹${(val / 100000).toFixed(2)} L Cr` : `₹${Math.round(val).toLocaleString()} Cr`} 
          />
        </div>
        <div className="metric-subtext overrun">
          <span className="overrun-arrow-pulsing">▲</span> {overrunPct > 0 ? `+${overrunPct}%` : `${overrunPct}%`} overrun
        </div>
      </div>
    </div>
  );
};
