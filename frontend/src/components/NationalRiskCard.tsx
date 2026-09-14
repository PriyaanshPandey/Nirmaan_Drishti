import React, { useState, useEffect, useMemo, useRef } from 'react';
import './DonutChart.css';
import './NationalRiskCard.css';
import { AnimatedCounter } from './AnimatedCounter';
import { api } from '../services/api';
import { InfoButton } from './ExplainabilityInfo';

import { projectsData } from '../data/projectsData';

interface RiskSegment {
  id: string;
  name: string;
  count: number;
  color: string;
  percentage: number;
}

const totalInit = projectsData.length;
const highInit = projectsData.filter(p => (p.riskScore || 0) >= 70).length;
const medInit = projectsData.filter(p => (p.riskScore || 0) >= 50 && (p.riskScore || 0) < 70).length;
const lowInit = Math.max(0, totalInit - highInit - medInit);

const DEFAULT_RISK_DIST: RiskSegment[] = [
  { id: 'high_risk', name: 'High Risk / Critical', count: highInit, color: '#EF4444', percentage: totalInit > 0 ? parseFloat((highInit / totalInit * 100).toFixed(1)) : 0 },
  { id: 'medium_risk', name: 'Medium Risk', count: medInit, color: '#EAB308', percentage: totalInit > 0 ? parseFloat((medInit / totalInit * 100).toFixed(1)) : 0 },
  { id: 'low_risk', name: 'Low Risk', count: lowInit, color: '#22C55E', percentage: totalInit > 0 ? parseFloat((lowInit / totalInit * 100).toFixed(1)) : 0 }
];

interface NationalRiskCardProps {
  activeTab?: string;
}

export const NationalRiskCard: React.FC<NationalRiskCardProps> = ({ activeTab }) => {
  const [data, setData] = useState<RiskSegment[]>(DEFAULT_RISK_DIST);
  const [hoveredSegment, setHoveredSegment] = useState<RiskSegment | null>(null);
  const [selectedSegment, setSelectedSegment] = useState<RiskSegment | null>(null);
  const [mounted, setMounted] = useState(false);
  const chartContainerRef = useRef<HTMLDivElement>(null);

  // Click outside resets to default TOTAL state
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (chartContainerRef.current && !chartContainerRef.current.contains(e.target as Node)) {
        setSelectedSegment(null);
      }
    };

    document.addEventListener('mousedown', handleOutsideClick);
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
    };
  }, []);

  useEffect(() => {
    let isMounted = true;

    // Reset forming animation and selections whenever user switches back to dashboard
    setMounted(false);
    setSelectedSegment(null);
    setHoveredSegment(null);
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

  const radius = 58; // Increased by 8px of radius (was 50)
  const strokeWidth = 14;
  const circumference = 2 * Math.PI * radius; // ~364.42
  const popDistance = 3.5; // Radial outward distance (2-4px)

  const totalProjects = useMemo(() => data.reduce((acc, curr) => acc + curr.count, 0), [data]);

  const computedSegments = useMemo(() => {
    let acc = 0;
    return data.map((segment) => {
      const startPercent = acc;
      const segmentPercent = segment.percentage;
      const endPercent = startPercent + segmentPercent;
      const midPercent = (startPercent + endPercent) / 2;
      acc = endPercent;

      // Start angle in degrees: 0% is at 12 o'clock (-90deg), proceeding clockwise
      const startDeg = (startPercent / 100) * 360 - 90;

      // Bisector angle for radial outward translation on hover/click
      const angleRad = (midPercent / 100) * 2 * Math.PI;
      const dx = Math.sin(angleRad) * popDistance;
      const dy = -Math.cos(angleRad) * popDistance;

      const strokeLength = (segmentPercent / 100) * circumference;

      return {
        ...segment,
        startDeg,
        dx,
        dy,
        strokeLength,
      };
    });
  }, [data, circumference, popDistance]);

  // Active segment: hover takes precedence while mouse is interacting, falls back to selected
  const activeSegment = hoveredSegment || selectedSegment;

  const handleSegmentClick = (segment: RiskSegment, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedSegment((prev) => (prev?.id === segment.id ? null : segment));
  };

  return (
    <div
      ref={chartContainerRef}
      className="card donut-card national-risk-card"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          setSelectedSegment(null);
        }
      }}
    >
      <div className="card-header" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <h2 className="card-title" style={{ margin: 0 }}>National Risk Distribution</h2>
            <InfoButton
              title="Risk Level"
              summary="AI calculates how likely projects are to face future delays or budget increases, based on work velocity and past trends."
              size="sm"
            />
          </div>
          <p className="card-subtitle">By AI &amp; XGBoost risk index</p>
        </div>
      </div>

      <div className="donut-chart-container">
        <div className="donut-svg-wrapper">
          <svg viewBox="0 0 140 140" className="donut-svg">
            {/* Background track circle */}
            <circle
              cx="70"
              cy="70"
              r={radius}
              fill="none"
              stroke="#F1F5F9"
              strokeWidth={strokeWidth}
            />

            {/* Inner transparent circle to reset selection when center hole is clicked */}
            <circle
              cx="70"
              cy="70"
              r={radius - strokeWidth / 2}
              fill="transparent"
              style={{ cursor: selectedSegment ? 'pointer' : 'default', pointerEvents: 'all' }}
              onClick={(e) => {
                e.stopPropagation();
                setSelectedSegment(null);
              }}
            />

            {computedSegments.map((segment) => {
              const isActive = activeSegment?.id === segment.id;

              return (
                <g
                  key={segment.id}
                  className="donut-segment-group"
                  style={{
                    transform: isActive ? `translate(${segment.dx.toFixed(2)}px, ${segment.dy.toFixed(2)}px)` : 'translate(0px, 0px)',
                    transition: 'transform 0.28s cubic-bezier(0.16, 1, 0.3, 1)',
                  }}
                >
                  <circle
                    cx="70"
                    cy="70"
                    r={radius}
                    fill="none"
                    stroke={segment.color}
                    strokeWidth={strokeWidth}
                    strokeDasharray={`${mounted ? segment.strokeLength : 0} ${circumference}`}
                    strokeDashoffset={0}
                    className={`donut-segment${isActive ? ' donut-segment-hovered' : ''}`}
                    style={{
                      transformOrigin: '70px 70px',
                      transform: `rotate(${segment.startDeg}deg)`,
                      transition: 'stroke-dasharray 1.1s cubic-bezier(0.16, 1, 0.3, 1), filter 0.25s ease',
                      cursor: 'pointer',
                      pointerEvents: 'stroke',
                      filter: isActive ? `drop-shadow(0 0 8px ${segment.color})` : 'none',
                    }}
                    onMouseEnter={() => setHoveredSegment(segment)}
                    onMouseLeave={() => setHoveredSegment(null)}
                    onClick={(e) => handleSegmentClick(segment, e)}
                  />
                </g>
              );
            })}
          </svg>

          <div
            className="donut-center-text"
            style={{ cursor: selectedSegment ? 'pointer' : 'default' }}
            onClick={(e) => {
              e.stopPropagation();
              setSelectedSegment(null);
            }}
          >
            <span className="donut-center-value">
              <AnimatedCounter value={activeSegment ? activeSegment.count : totalProjects} resetKey={activeTab} />
            </span>
            <span className="donut-center-label">
              {activeSegment ? activeSegment.name : 'TOTAL'}
            </span>
          </div>
        </div>

        <div className="donut-legend">
          {data.map((segment) => {
            const isActive = activeSegment?.id === segment.id;
            return (
              <div
                key={segment.id}
                className={`legend-item${isActive ? ' legend-item-hovered' : ''}`}
                onMouseEnter={() => setHoveredSegment(segment)}
                onMouseLeave={() => setHoveredSegment(null)}
                onClick={(e) => handleSegmentClick(segment, e)}
              >
                <div className="legend-row-top">
                  <div className="legend-label-left">
                    <span
                      className="legend-color-dot"
                      style={{ backgroundColor: segment.color, boxShadow: isActive ? `0 0 6px ${segment.color}` : 'none' }}
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
