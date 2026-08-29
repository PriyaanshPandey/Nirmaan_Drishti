import React from 'react';
import './MetricCards.css';
import { AnimatedCounter } from './AnimatedCounter';

export const MetricCards: React.FC = () => {
  return (
    <div className="metrics-column">
      {/* Total Projects Card - Dark Navy Theme */}
      <div className="metric-card dark-theme">
        {/* Decorative background grid pattern for visual character */}
        <div className="card-decor-pattern">
          <svg width="100" height="60" viewBox="0 0 100 60" fill="none" opacity="0.15">
            <path d="M 0 50 Q 20 20, 40 40 T 80 10 T 100 30" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" />
            <circle cx="80" cy="10" r="3" fill="#ffffff" />
          </svg>
        </div>
        <h3 className="metric-title">TOTAL PROJECTS</h3>
        <div className="metric-value">
          <AnimatedCounter value={1981} />
        </div>
        <div className="metric-subtext">+124 this quarter</div>
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
          <AnimatedCounter value={3713} formatter={(val) => `₹${(val / 100).toFixed(2)} L Cr`} />
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
          <AnimatedCounter value={4278} formatter={(val) => `₹${(val / 100).toFixed(2)} L Cr`} />
        </div>
        <div className="metric-subtext overrun">
          <span className="overrun-arrow-pulsing">▲</span> +15.2% overrun
        </div>
      </div>
    </div>
  );
};
