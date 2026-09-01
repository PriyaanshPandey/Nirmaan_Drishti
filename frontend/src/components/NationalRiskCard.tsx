import React, { useState, useEffect } from 'react';
import './DonutChart.css';
import './NationalRiskCard.css';
import { AnimatedCounter } from './AnimatedCounter';
import { api } from '../services/api';

interface RiskSegment {
  id: string;
  name: string;
  count: number;
  color: string;
  percentage: number;
}

const DEFAULT_RISK_DIST: RiskSegment[] = [
  { id: 'high_risk', name: 'High Risk / Critical', count: 455, color: '#EF4444', percentage: 13.5 },
  { id: 'medium_risk', name: 'Medium Risk', count: 1058, color: '#EAB308', percentage: 31.5 },
  { id: 'low_risk', name: 'Low Risk', count: 1848, color: '#22C55E', percentage: 55.0 }
];

interface NationalRiskCardProps {
  activeTab?: string;
}

export const NationalRiskCard: React.FC<NationalRiskCardProps> = ({ activeTab }) => {
  const [data, setData] = useState<RiskSegment[]>(DEFAULT_RISK_DIST);
  const [hoveredSegment, setHoveredSegment] = useState<RiskSegment | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    let isMounted = true;

    // Reset forming animation whenever user switches back to dashboard
    setMounted(false);
    const t = setTimeout(() => setMounted(true), 60);

    api.getDashboardSummary().then((res) => {
      if (!isMounted) return;
      if (res && res.national_risk_distribution && res.national_risk_distribution.length > 0) {
        const total = res.national_risk_distribution.reduce((a, b) => a + b.count, 0);
        if (total > 0) {
          setData(res.national_risk_distribution);
        }
      }
    }).catch(() => {
      // keep fallback
    });

    return () => {
      isMounted = false;
      clearTimeout(t);
    };
  }, [activeTab]);

  const radius = 50;
  const strokeWidth = 14;
  const circumference = 2 * Math.PI * radius; // ~314.159

  let accumulatedPercentage = 0;
  const totalProjects = data.reduce((acc, curr) => acc + curr.count, 0);

  return (
    <div className="card donut-card national-risk-card">
      <div className="card-header">
        <h2 className="card-title">National Risk Distribution</h2>
        <p className="card-subtitle">By AI &amp; XGBoost risk index</p>
      </div>

      <div className="donut-chart-container">
        <div className="donut-svg-wrapper">
          <svg viewBox="0 0 140 140" className="donut-svg">
            <circle
              cx="70"
              cy="70"
              r={radius}
              fill="transparent"
              stroke="#F1F5F9"
              strokeWidth={strokeWidth}
            />

            {data.map((segment) => {
              const strokeLength = (segment.percentage / 100) * circumference;
              const strokeOffset = circumference - (accumulatedPercentage / 100) * circumference;

              accumulatedPercentage += segment.percentage;
              const isHovered = hoveredSegment?.id === segment.id;

              return (
                <circle
                  key={segment.id}
                  cx="70"
                  cy="70"
                  r={radius}
                  fill="transparent"
                  stroke={segment.color}
                  strokeWidth={isHovered ? strokeWidth + 4 : strokeWidth}
                  strokeDasharray={`${mounted ? strokeLength : 0} ${circumference}`}
                  strokeDashoffset={strokeOffset}
                  className={`donut-segment${isHovered ? ' donut-segment-hovered' : ''}`}
                  style={{
                    transformOrigin: 'center',
                    transform: 'rotate(-90deg)',
                    transition: 'stroke-dasharray 1.1s cubic-bezier(0.16, 1, 0.3, 1), stroke-width 0.25s ease, filter 0.25s ease',
                    cursor: 'pointer',
                    filter: isHovered ? `drop-shadow(0 0 8px ${segment.color})` : 'none',
                  }}
                  onMouseEnter={() => setHoveredSegment(segment)}
                  onMouseLeave={() => setHoveredSegment(null)}
                />
              );
            })}
          </svg>

          <div className="donut-center-text">
            <span className="donut-center-value">
              <AnimatedCounter value={hoveredSegment ? hoveredSegment.count : totalProjects} resetKey={activeTab} />
            </span>
            <span className="donut-center-label">
              {hoveredSegment ? hoveredSegment.name : 'TOTAL'}
            </span>
          </div>
        </div>

        <div className="donut-legend">
          {data.map((segment) => {
            const isHovered = hoveredSegment?.id === segment.id;
            return (
              <div
                key={segment.id}
                className={`legend-item${isHovered ? ' legend-item-hovered' : ''}`}
                onMouseEnter={() => setHoveredSegment(segment)}
                onMouseLeave={() => setHoveredSegment(null)}
              >
                <div className="legend-row-top">
                  <div className="legend-label-left">
                    <span
                      className="legend-color-dot"
                      style={{ backgroundColor: segment.color, boxShadow: isHovered ? `0 0 6px ${segment.color}` : 'none' }}
                    />
                    <span className="legend-name">{segment.name}</span>
                  </div>
                  <div className="legend-stats-right">
                    <span className="legend-count">
                      <AnimatedCounter value={segment.count} resetKey={activeTab} />
                    </span>
                    <span className="legend-percentage">({segment.percentage}%)</span>
                  </div>
                </div>

                <div className="legend-bar-bg">
                  <div
                    className="legend-bar-fill"
                    style={{
                      width: `${mounted ? segment.percentage : 0}%`,
                      backgroundColor: segment.color
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
