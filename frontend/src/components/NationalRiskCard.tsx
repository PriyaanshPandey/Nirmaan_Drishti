import React, { useState, useEffect, useMemo, useRef } from 'react';
import './DonutChart.css';
import './NationalRiskCard.css';
import { AnimatedCounter } from './AnimatedCounter';
import { api } from '../services/api';

import { InfoButton } from './ExplainabilityInfo';

interface RiskSegment {
  id: string;
  name: string;
  count: number;
  color: string;
  percentage: number;
}

const DEFAULT_RISK_DIST: RiskSegment[] = [
  { id: 'high_risk', name: 'High Risk / Critical', count: 878, color: '#EF4444', percentage: 13.4 },
  { id: 'medium_risk', name: 'Medium Risk', count: 1448, color: '#EAB308', percentage: 22.0 },
  { id: 'low_risk', name: 'Low Risk', count: 4242, color: '#22C55E', percentage: 64.6 }
];

interface NationalRiskCardProps {
  activeTab?: string;
  onSelectRiskLevel?: (risk: string) => void;
}

export const NationalRiskCard: React.FC<NationalRiskCardProps> = ({ activeTab, onSelectRiskLevel }) => {
  const [data, setData] = useState<RiskSegment[]>(DEFAULT_RISK_DIST);
  const [hoveredSegment, setHoveredSegment] = useState<RiskSegment | null>(null);
  const [selectedSegment, setSelectedSegment] = useState<RiskSegment | null>(null);
  const [mounted, setMounted] = useState(false);
  const chartContainerRef = useRef<HTMLDivElement>(null);

  // Click outside resets to default state
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

  const activeSegment = hoveredSegment || selectedSegment;

  const getSegmentColor = (segment: RiskSegment | { id?: string; color?: string }) => {
    if (segment.id === 'high_risk') return '#EF4444';
    if (segment.id === 'medium_risk') return '#EAB308';
    return '#22C55E';
  };

  useEffect(() => {
    let isMounted = true;
    setMounted(false);
    setSelectedSegment(null);
    setHoveredSegment(null);
    const t = setTimeout(() => setMounted(true), 60);

    api.getDashboardSummary().then((res) => {
      if (!isMounted) return;
      if (res && res.national_risk_distribution && res.national_risk_distribution.length > 0) {
        const total = res.national_risk_distribution.reduce((a, b) => a + b.count, 0);
        if (total > 0) {
          setData(res.national_risk_distribution.map(d => ({
            ...d,
            color: getSegmentColor(d)
          })));
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

  const radius = 58;
  const strokeWidth = 14;
  const circumference = 2 * Math.PI * radius;
  const popDistance = 3.5;

  const totalProjects = useMemo(() => data.reduce((acc, curr) => acc + curr.count, 0), [data]);

  const computedSegments = useMemo(() => {
    let acc = 0;
    const totalCount = data.reduce((sum, curr) => sum + curr.count, 0);
    return data.map((segment) => {
      const startPercent = acc;
      const segmentPercent = totalCount > 0 ? (segment.count / totalCount) * 100 : segment.percentage;
      const endPercent = startPercent + segmentPercent;
      const midPercent = (startPercent + endPercent) / 2;
      acc = endPercent;

      const startDeg = (startPercent / 100) * 360 - 90;
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

  const handleSegmentClick = (segment: RiskSegment, e: React.MouseEvent) => {
    e.stopPropagation();
    if (onSelectRiskLevel) {
      onSelectRiskLevel(segment.name);
    } else {
      setSelectedSegment((prev) => (prev?.id === segment.id ? null : segment));
    }
  };

  const handleSegmentKeyDown = (segment: RiskSegment, e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleSegmentClick(segment, e as unknown as React.MouseEvent);
    }
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
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'space-between', marginBottom: '4px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <h2 className="card-title" style={{ margin: 0 }}>National Risk Distribution</h2>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '24px' }}>
            <p className="card-subtitle" style={{ margin: 0 }}>By AI &amp; XGBoost risk index</p>
          </div>
        </div>
        <InfoButton
          title="National Risk Score & Categorization Criteria"
          summary="Categorizes all ongoing infrastructure projects into Critical, Medium, and Low risk buckets based on PAIMANA XGBoost predictive models evaluating cost overruns, time delays, and physical progress velocity."
          dataSummary={{
            items: [
              { label: 'Critical Risk (>= 75%)', value: 'Cost drift > 20% or delay > 12 mos' },
              { label: 'Medium Risk (30–74%)', value: 'Minor delay (3–12 mos)' },
              { label: 'Low Risk (< 30%)', value: 'On track with expenditure' }
            ],
            insight: 'Projects with critical risk require immediate policy-aware officer directives to clear land/approval bottlenecks.'
          }}
          theme="light"
          size="sm"
        />
      </div>

      <div className="donut-chart-container">
        <p className="sr-only">National risk distribution: {data.map((segment) => `${segment.name}: ${segment.count} projects, ${segment.percentage} percent`).join('; ')}.</p>
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
                    stroke={getSegmentColor(segment)}
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
                      filter: isActive ? `drop-shadow(0 0 8px ${getSegmentColor(segment)})` : 'none',
                    }}
                    onMouseEnter={() => setHoveredSegment(segment)}
                    onMouseLeave={() => setHoveredSegment(null)}
                    onClick={(e) => handleSegmentClick(segment, e)}
                    onKeyDown={(e) => handleSegmentKeyDown(segment, e)}
                    tabIndex={0}
                    role="button"
                    aria-label={`${segment.name}: ${segment.count} projects, ${segment.percentage}%`}
                    aria-pressed={isActive}
                  >
                    <title>{`Click to view ${segment.name} projects`}</title>
                  </circle>
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
            const segmentPct = totalProjects > 0 ? (segment.count / totalProjects) * 100 : segment.percentage;
            const segmentPctFormatted = segmentPct.toFixed(1);
            return (
              <div
                key={segment.id}
                className={`legend-item${isActive ? ' legend-item-hovered' : ''}`}
                onMouseEnter={() => setHoveredSegment(segment)}
                onMouseLeave={() => setHoveredSegment(null)}
                onClick={(e) => handleSegmentClick(segment, e)}
                onKeyDown={(e) => handleSegmentKeyDown(segment, e)}
                tabIndex={0}
                role="button"
                title={`Click to view ${segment.name} projects`}
                aria-label={`${segment.name}: ${segment.count} projects, ${segment.percentage}%`}
                aria-pressed={isActive}
              >
                <div className="legend-row-top">
                  <div className="legend-label-left">
                    <span
                      className="legend-color-dot"
                      style={{ backgroundColor: getSegmentColor(segment), boxShadow: isActive ? `0 0 6px ${getSegmentColor(segment)}` : 'none' }}
                    />
                    <span className="legend-name">{segment.name}</span>
                  </div>
                  <div className="legend-stats-right">
                    <span className="legend-count">
                      <AnimatedCounter value={segment.count} resetKey={activeTab} />
                    </span>
                    <span className="legend-percentage">({segmentPctFormatted}%)</span>
                  </div>
                </div>

                <div className="legend-bar-bg">
                  <div
                    className="legend-bar-fill"
                    style={{
                      width: `${mounted ? segmentPct : 0}%`,
                      backgroundColor: getSegmentColor(segment)
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
