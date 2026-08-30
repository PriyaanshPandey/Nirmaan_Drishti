import React, { useState, useEffect } from 'react';
import { Zap, ArrowRight } from 'lucide-react';
import './AIActionCenter.css';
import { api, type DashboardSummaryData } from '../services/api';

interface AIActionCenterProps {
  onNavigateTab?: (tab: string) => void;
}

export const AIActionCenter: React.FC<AIActionCenterProps> = ({ onNavigateTab }) => {
  const [data, setData] = useState<DashboardSummaryData['ai_action_center'] | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<boolean>(false);

  useEffect(() => {
    let isMounted = true;
    api.getDashboardSummary().then((res) => {
      if (!isMounted) return;
      if (res && res.ai_action_center) {
        setData(res.ai_action_center);
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

  return (
    <div className="card ai-action-card">
      {/* Header section with icon */}
      <div className="ai-header">
        <Zap size={14} className="zap-icon" fill="var(--color-monitoring)" color="var(--color-monitoring)" />
        <span className="ai-header-tag">AI Action Center</span>
      </div>

      {loading ? (
        <div style={{ padding: '30px', textAlign: 'center', color: '#94A3B8', fontSize: '13px' }}>
          Analyzing AI action priorities...
        </div>
      ) : error || !data ? (
        <div style={{ padding: '30px', textAlign: 'center', color: '#EF4444', fontSize: '13px' }}>
          Unable to load data from backend.
        </div>
      ) : (
        <>
          <h2 className="ai-headline">
            {data.total_interventions_needed ?? (data.critical_count + data.high_count + data.medium_count)} projects require immediate intervention
          </h2>

          {/* Status counts */}
          <div className="ai-status-summary">
            <div className="status-indicator">
              <span className="dot dot-critical"></span>
              <span className="label">Critical ({data.critical_count})</span>
            </div>
            <div className="status-indicator">
              <span className="dot dot-high"></span>
              <span className="label">High ({data.high_count})</span>
            </div>
            <div className="status-indicator">
              <span className="dot dot-medium"></span>
              <span className="label">Medium ({data.medium_count})</span>
            </div>
          </div>

          {/* Segmented Progress Bar */}
          <div className="segmented-bar">
            <div className="segment seg-critical" style={{ width: `${data.critical_pct}%` }}></div>
            <div className="segment seg-high" style={{ width: `${data.high_pct}%` }}></div>
            <div className="segment seg-medium" style={{ width: `${data.medium_pct}%` }}></div>
          </div>

          {/* Action grid (2x2) */}
          <div className="action-grid">
            {data.actions.map((act) => (
              <div key={act.id} className="action-grid-item">
                <h4 className="action-item-category">{act.category}</h4>
                <p className="action-item-detail">{act.detail}</p>
              </div>
            ))}
          </div>

          {/* Bottom Action CTA */}
          <button className="ai-cta-btn" onClick={() => onNavigateTab ? onNavigateTab('action-centre') : undefined}>
            <span>View All Priority Actions</span>
            <ArrowRight size={14} />
          </button>
        </>
      )}
    </div>
  );
};
