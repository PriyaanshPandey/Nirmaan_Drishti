import React, { useState, useEffect, useMemo, useRef } from 'react';
import './DonutChart.css';
import { AnimatedCounter } from './AnimatedCounter';
import { api } from '../services/api';
import { InfoButton } from './ExplainabilityInfo';
import { StatusIndicator } from './StatusIndicator';
import { summarizeRiskDistribution } from './chartSummaries';

import { projectsData } from '../data/projectsData';

interface ChartSegment {
  id: string;
  name: string;
  count: number;
  color: string;
  percentage: number;
}

const totalInitHealth = projectsData.length;
const critInit = projectsData.filter(p => {
  const s = (p.scheduleStatus || '').toUpperCase();
  return s.includes('CRIT') || s.includes('OVERDUE');
}).length;
const onTrackInit = projectsData.filter(p => {
  const s = (p.scheduleStatus || '').toUpperCase();
  return !s.includes('CRIT') && !s.includes('OVERDUE') && (s.includes('ON TRACK') || s.includes('COMPLET') || s.includes('SCHEDULE'));
}).length;
const highRiskInit = projectsData.filter(p => {
  const s = (p.scheduleStatus || '').toUpperCase();
  const isCrit = s.includes('CRIT') || s.includes('OVERDUE');
  const isOnTrack = s.includes('ON TRACK') || s.includes('COMPLET') || s.includes('SCHEDULE');
  const overVal = parseFloat((p.costOverrunPct || '0').replace(/[^0-9.-]/g, '')) || 0;
  return !isCrit && !isOnTrack && ((p.riskScore || 0) >= 65 || p.riskLevel === 'High' || p.riskLevel === 'Critical' || overVal > 15);
}).length;
const monitoringInit = Math.max(0, totalInitHealth - onTrackInit - highRiskInit - critInit);

const DEFAULT_HEALTH_DIST: ChartSegment[] = [
  { id: 'on-track', name: 'On Track', count: onTrackInit, color: '#15803D', percentage: totalInitHealth > 0 ? parseFloat((onTrackInit / totalInitHealth * 100).toFixed(1)) : 0 },
  ...(monitoringInit > 0 ? [{ id: 'monitoring', name: 'Monitoring', count: monitoringInit, color: '#3B82F6', percentage: totalInitHealth > 0 ? parseFloat((monitoringInit / totalInitHealth * 100).toFixed(1)) : 0 }] : []),
  { id: 'at-risk', name: 'At Risk', count: highRiskInit, color: '#B45309', percentage: totalInitHealth > 0 ? parseFloat((highRiskInit / totalInitHealth * 100).toFixed(1)) : 0 },
  { id: 'critical', name: 'Critical Delay', count: critInit, color: '#B91C1C', percentage: totalInitHealth > 0 ? parseFloat((critInit / totalInitHealth * 100).toFixed(1)) : 0 }
];

interface DonutChartProps {
  activeTab?: string;
}

export const DonutChart: React.FC<DonutChartProps> = ({ activeTab }) => {
  const [data, setData] = useState<ChartSegment[]>(DEFAULT_HEALTH_DIST);
  const [hoveredSegment, setHoveredSegment] = useState<ChartSegment | null>(null);
  const [selectedSegment, setSelectedSegment] = useState<ChartSegment | null>(null);
  const [mounted, setMounted] = useState(false);
  const chartContainerRef = useRef<HTMLDivElement>(null);

  // Click outside the chart resets selection to default TOTAL state
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

  // Active segment: hover takes precedence during active mouse interaction, falls back to selected
  const activeSegment = hoveredSegment || selectedSegment;
  const getSegmentColor = (segment: ChartSegment) => {
    const sId = (segment.id || '').toLowerCase().replace(/_/g, '-');
    const sName = (segment.name || '').toLowerCase();
    if (sId.includes('crit') || sId.includes('delay') || sName.includes('crit') || sName.includes('delay')) return '#B91C1C';
    if (sId.includes('risk') || sName.includes('risk')) return '#B45309';
    if (sId.includes('monitor') || sName.includes('monitor') || sId.includes('attention') || sName.includes('attention')) return '#3B82F6';
    if (sId.includes('track') || sId.includes('low') || sName.includes('track') || sName.includes('low')) return '#15803D';
    return segment.color || '#15803D';
  };

  useEffect(() => {
    let isMounted = true;

    // Reset forming animation and selections whenever user switches back to dashboard
    setMounted(false);
    setSelectedSegment(null);
    setHoveredSegment(null);
    const t = setTimeout(() => setMounted(true), 60);

    api.getDashboardSummary().then((res) => {
      if (!isMounted) return;
      if (res && res.health_distribution && res.health_distribution.length > 0) {
        const nonZero = res.health_distribution.filter(d => d.count > 0);
        const toUse = nonZero.length > 0 ? nonZero : res.health_distribution;
        const total = toUse.reduce((a, b) => a + b.count, 0);
        if (total > 0) {
          setData(toUse.map(d => ({
            id: d.id,
            name: d.name === 'High Risk' ? 'At Risk' : d.name,
            count: d.count,
            color: getSegmentColor(d as ChartSegment),
            percentage: total > 0 ? parseFloat((d.count / total * 100).toFixed(1)) : d.percentage,
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

  const radius = 58; // Increased by 8px of radius (was 50)
  const strokeWidth = 14;
  const circumference = 2 * Math.PI * radius; // ~364.42
  const popDistance = 3.5; // Radial outward distance (2-4px)

  const totalProjects = useMemo(() => data.reduce((acc, curr) => acc + curr.count, 0), [data]);

  // Pre-calculate geometry and radial angles for each segment
  const computedSegments = useMemo(() => {
    let acc = 0;
    const totalCount = data.reduce((sum, curr) => sum + curr.count, 0);
    return data.map((segment) => {
      const startPercent = acc;
      const segmentPercent = totalCount > 0 ? (segment.count / totalCount) * 100 : segment.percentage;
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


  const handleSegmentClick = (segment: ChartSegment, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedSegment((prev) => (prev?.id === segment.id ? null : segment));
  };

  const handleSegmentKeyDown = (segment: ChartSegment, e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleSegmentClick(segment, e as unknown as React.MouseEvent);
    }
  };

  return (
    <div
      ref={chartContainerRef}
      className="card donut-card"
      onClick={(e) => {
        // Clicking empty space within card resets selection
        if (e.target === e.currentTarget) {
          setSelectedSegment(null);
        }
      }}
    >
      <div className="card-header" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <h2 className="card-title" style={{ margin: 0 }}>Project Health Distribution</h2>
            <InfoButton
              title="Project Health"
              summary="Shows how projects are performing. Green means on schedule, yellow means slightly delayed, and red means major delays or budget overruns."
              dataSummary={summarizeRiskDistribution(data)}
              size="sm"
            />
          </div>
          <p className="card-subtitle">By project status</p>
        </div>
      </div>

      <div className="donut-chart-container">
        <p className="sr-only">Project health distribution: {data.map((segment) => `${segment.name}: ${segment.count} projects, ${segment.percentage} percent`).join('; ')}.</p>
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
                aria-label={`${segment.name}: ${segment.count} projects, ${segment.percentage}%`}
                aria-pressed={isActive}
              >
                <div className="legend-row-top">
                  <div className="legend-label-left">
                    <span
                      className="legend-color-dot"
                      style={{ backgroundColor: getSegmentColor(segment), boxShadow: isActive ? `0 0 6px ${getSegmentColor(segment)}` : 'none' }}
                    />
                    <StatusIndicator
                      kind={(() => {
                        const sId = (segment.id || '').toLowerCase().replace(/_/g, '-');
                        if (sId.includes('crit') || sId.includes('delay')) return 'critical';
                        if (sId.includes('risk')) return 'high';
                        if (sId.includes('monitor') || sId.includes('attention')) return 'medium';
                        return 'on-track';
                      })()}
                      label={segment.name.toUpperCase()}
                      className="legend-name"
                    />
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
