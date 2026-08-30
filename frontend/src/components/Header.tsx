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
      if (res && res.health_distribution) {
        const riskCount = res.health_distribution.reduce((acc: number, d: any) => {
          if (['critical', 'critical_delay', 'at_risk', 'at-risk'].includes(d.id)) {
            return acc + (d.count || 0);
          }
          return acc;
        }, 0);
        if (riskCount > 0) {
          setBadgeText(`AI Insight Active — ${riskCount.toLocaleString()} critical risk correlations detected.`);
        }
      }
    });
  }, []);

  return (
    <header className="dashboard-header">
      <div className="header-left">
        <h1 className="header-title">Nirmaan Dristi</h1>
        <p className="header-subtitle">National Infrastructure Early Warning &amp; Predictive Monitoring Platform</p>
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
