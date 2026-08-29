import React from 'react';
import './Header.css';

export const Header: React.FC = () => {
  return (
    <header className="dashboard-header">
      <div className="header-left">
        <h1 className="header-title">National Infrastructure Intelligence</h1>
        <p className="header-subtitle">Monitor. Predict. Prioritize. Build a stronger tomorrow.</p>
      </div>
      <div className="header-right">
        <div className="date-indicator">
          As of <span className="date-highlight">31 July 2026</span>
        </div>
        <div className="insight-badge">
          <span className="badge-dot"></span>
          <span className="badge-text">AI Insight Active — 12 new risk correlations detected.</span>
        </div>
      </div>
    </header>
  );
};
