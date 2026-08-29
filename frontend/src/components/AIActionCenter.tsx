import React from 'react';
import { Zap, ArrowRight } from 'lucide-react';
import './AIActionCenter.css';

interface ActionItem {
  id: string;
  category: string;
  detail: string;
}

export const AIActionCenter: React.FC = () => {
  const actions: ActionItem[] = [
    { id: 'land', category: 'Land Acquisition', detail: '42 projects blocked' },
    { id: 'procurement', category: 'Procurement', detail: '25 tenders delayed' },
    { id: 'clearance', category: 'Clearance', detail: '13 env. permits pending' },
    { id: 'contractor', category: 'Contractor', detail: '15 performance issues' },
  ];

  return (
    <div className="card ai-action-card">
      {/* Header section with icon */}
      <div className="ai-header">
        <Zap size={14} className="zap-icon" fill="var(--color-monitoring)" color="var(--color-monitoring)" />
        <span className="ai-header-tag">AI Action Center</span>
      </div>

      <h2 className="ai-headline">126 projects require immediate intervention</h2>

      {/* Status counts */}
      <div className="ai-status-summary">
        <div className="status-indicator">
          <span className="dot dot-critical"></span>
          <span className="label">Critical (38)</span>
        </div>
        <div className="status-indicator">
          <span className="dot dot-high"></span>
          <span className="label">High (51)</span>
        </div>
        <div className="status-indicator">
          <span className="dot dot-medium"></span>
          <span className="label">Medium (37)</span>
        </div>
      </div>

      {/* Segmented Progress Bar */}
      <div className="segmented-bar">
        <div className="segment seg-critical" style={{ width: '30.1%' }}></div>
        <div className="segment seg-high" style={{ width: '40.5%' }}></div>
        <div className="segment seg-medium" style={{ width: '29.4%' }}></div>
      </div>

      {/* Action grid (2x2) */}
      <div className="action-grid">
        {actions.map((act) => (
          <div key={act.id} className="action-grid-item">
            <h4 className="action-item-category">{act.category}</h4>
            <p className="action-item-detail">{act.detail}</p>
          </div>
        ))}
      </div>

      {/* Bottom Action CTA */}
      <button className="ai-cta-btn" onClick={() => alert('View All Priority Actions clicked')}>
        <span>View All Priority Actions</span>
        <ArrowRight size={14} />
      </button>
    </div>
  );
};
