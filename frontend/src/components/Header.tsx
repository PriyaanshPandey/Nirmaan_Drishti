import React from 'react';
import './Header.css';

export const Header: React.FC = () => {
  return (
    <header className="dashboard-header">
      <div className="header-left">
        <h1 className="header-title">Nirmaan Drishti</h1>
        <p className="header-subtitle">National Infrastructure Early Warning &amp; Predictive Monitoring Platform</p>
      </div>
      <div className="header-right">
        <div className="insight-badge">
          <span className="badge-dot"></span>
          <span className="badge-text">July 2025 - May 2026</span>
        </div>
      </div>
    </header>
  );
};


