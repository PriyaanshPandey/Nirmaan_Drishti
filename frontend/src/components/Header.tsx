import React, { useState, useEffect } from 'react';
import './Header.css';
import { api } from '../services/api';

export const Header: React.FC = () => {
  const todayStr = new Date().toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
  const [badgeText, setBadgeText] = useState('AI Insight Active — analyzing portfolio risk.');

  useEffect(() => {
    api.getDashboardSummary().then((res) => {
      if (res && res.metrics) {
        const highRisk = res.health_distribution?.find((d: any) => d.id === 'critical_delay' || d.id === 'at_risk');
        const count = highRisk?.count || 0;
        if (count > 0) {
          setBadgeText(`AI Insight Active — ${count} critical risk correlations detected.`);
        }
      }
    });
  }, []);

  return (
    <header className="dashboard-header">
      <div className="header-left">
        <h1 className="header-title">National Infrastructure Intelligence</h1>
        <p className="header-subtitle">Monitor. Predict. Prioritize. Build a stronger tomorrow.</p>
      </div>
      <div className="header-right">
        <div className="date-indicator">
          As of <span className="date-highlight">{todayStr}</span>
        </div>
        <div className="insight-badge">
          <span className="badge-dot"></span>
          <span className="badge-text">{badgeText}</span>
        </div>
      </div>
    </header>
  );
};
