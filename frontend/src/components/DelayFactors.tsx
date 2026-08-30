import React, { useState, useEffect } from 'react';
import './DelayFactors.css';
import { api } from '../services/api';

interface DelayFactorItem {
  id: string;
  label: string;
  impact: string;
  percentage: number;
  color: string;
}

export const DelayFactors: React.FC = () => {
  const [mounted, setMounted] = useState(false);
  const [factors, setFactors] = useState<DelayFactorItem[] | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<boolean>(false);

  useEffect(() => {
    let isMounted = true;
    const t = setTimeout(() => setMounted(true), 80);

    api.getDashboardSummary().then((res) => {
      if (!isMounted) return;
      if (res && res.delay_factors && res.delay_factors.length > 0) {
        setFactors(res.delay_factors.map(d => ({
          id: d.id,
          label: d.label,
          impact: d.impact === 'High' ? '+26%' : (d.impact === 'Medium' ? '+14%' : '+6%'),
          percentage: d.percentage * 2, // Scale visually for bar width
          color: d.color,
        })));
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
      clearTimeout(t);
    };
  }, []);

  return (
    <div className="card delay-factors-card">
      <div className="delay-factors-header">
        <h2 className="card-title">Emerging Delay Factors</h2>
        <p className="card-subtitle">Top contributors to slippage</p>
      </div>

      <div className="factors-list">
        {loading ? (
          <div style={{ padding: '30px', textAlign: 'center', color: '#94A3B8', fontSize: '13px' }}>
            Loading delay factors...
          </div>
        ) : error || !factors ? (
          <div style={{ padding: '30px', textAlign: 'center', color: '#EF4444', fontSize: '13px' }}>
            Unable to load data from backend.
          </div>
        ) : factors.length === 0 ? (
          <div style={{ padding: '30px', textAlign: 'center', color: '#64748B', fontSize: '13px' }}>
            No emerging delay factors identified.
          </div>
        ) : (
          factors.map((factor, idx) => (
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
          ))
        )}
      </div>
    </div>
  );
};
