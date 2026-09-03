import React, { useState } from 'react';
import './Header.css';
import { BookOpen } from 'lucide-react';
import { DashboardGuideModal } from './ExplainabilityInfo';

export const Header: React.FC = () => {
  const [guideOpen, setGuideOpen] = useState(false);

  return (
    <header className="dashboard-header">
      <div className="header-left">
        <h1 className="header-title">Nirmaan Drishti</h1>
        <p className="header-subtitle">National Infrastructure Early Warning &amp; Predictive Monitoring Platform</p>
      </div>
      <div className="header-right" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <button
          type="button"
          className="header-guide-btn"
          onClick={() => setGuideOpen(true)}
          title="Learn how metrics, risk scores, and AI models work"
        >
          <BookOpen className="guide-icon" size={14} />
          <span>Methodology &amp; Guide</span>
        </button>

        <div className="insight-badge">
          <span className="badge-dot"></span>
          <span className="badge-text">July 2025 - May 2026</span>
        </div>
      </div>

      <DashboardGuideModal isOpen={guideOpen} onClose={() => setGuideOpen(false)} />
    </header>
  );
};

