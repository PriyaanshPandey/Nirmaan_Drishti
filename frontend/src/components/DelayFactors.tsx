import React, { useState, useEffect } from 'react';
import './DelayFactors.css';

interface DelayFactorItem {
  id: string;
  label: string;
  impact: string;
  percentage: number; // For progress bar width
  color: string;
}

export const DelayFactors: React.FC = () => {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 80);
    return () => clearTimeout(t);
  }, []);

  const factors: DelayFactorItem[] = [
    { id: 'land', label: 'Land Acquisition', impact: '+23%', percentage: 85, color: 'var(--navy-dark)' },
    { id: 'procurement', label: 'Procurement Issues', impact: '+17%', percentage: 65, color: '#1E4EBF' },
    { id: 'clearance', label: 'Clearance Delays', impact: '+14%', percentage: 55, color: 'var(--color-on-track)' },
    { id: 'contractor', label: 'Contractor Defaults', impact: '+11%', percentage: 40, color: 'var(--color-monitoring)' },
    { id: 'milestone', label: 'Milestone Slippage', impact: '+7%', percentage: 25, color: '#93C5FD' },
  ];

  return (
    <div className="card delay-factors-card">
      <div className="delay-factors-header">
        <h2 className="card-title">Emerging Delay Factors</h2>
        <p className="card-subtitle">Top contributors to slippage</p>
      </div>

      <div className="factors-list">
        {factors.map((factor, idx) => (
          <div key={factor.id} className="factor-item">
            <div className="factor-info">
              <span className="factor-label">{factor.label}</span>
              <span className="factor-impact">{factor.impact}</span>
            </div>
            <div className="factor-bar-bg">
              <div
                className="factor-bar-fill"
                style={{
                  width: mounted ? `${factor.percentage}%` : '0%',
                  backgroundColor: factor.color,
                  transition: `width 0.7s cubic-bezier(0.16, 1, 0.3, 1) ${idx * 0.1}s`,
                }}
              ></div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
