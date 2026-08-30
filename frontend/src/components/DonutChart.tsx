import React, { useState, useEffect } from 'react';
import './DonutChart.css';
import { AnimatedCounter } from './AnimatedCounter';
import { api } from '../services/api';

interface ChartSegment {
  id: string;
  name: string;
  count: number;
  color: string;
  percentage: number;
}

export const DonutChart: React.FC = () => {
  const [data, setData] = useState<ChartSegment[] | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<boolean>(false);
  const [hoveredSegment, setHoveredSegment] = useState<ChartSegment | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    let isMounted = true;
    const t = setTimeout(() => setMounted(true), 100);

    api.getDashboardSummary().then((res) => {
      if (!isMounted) return;
      if (res && res.health_distribution && res.health_distribution.length > 0) {
        setData(res.health_distribution.map(d => ({
          id: d.id,
          name: d.name,
          count: d.count,
          color: d.color,
          percentage: d.percentage,
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

  // Circle dimensions
  const radius = 50;
  const strokeWidth = 14;
  const circumference = 2 * Math.PI * radius; // ~314.159

  if (loading) {
    return (
      <div className="card donut-card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '320px', gap: '20px' }}>
        {/* Skeleton shimmer donut ring */}
        <div style={{ position: 'relative', width: '120px', height: '120px' }}>
          <div className="skeleton-pulse skeleton-circle" style={{ width: '120px', height: '120px', position: 'absolute' }} />
          <div style={{ position: 'absolute', top: '14px', left: '14px', width: '92px', height: '92px', borderRadius: '50%', backgroundColor: '#fff' }} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', width: '80%' }}>
          <div className="skeleton-pulse skeleton-line" style={{ width: '60%' }} />
          <div className="skeleton-pulse skeleton-line" style={{ width: '80%' }} />
          <div className="skeleton-pulse skeleton-line" style={{ width: '50%' }} />
        </div>
      </div>
    );
  }

  if (error || !data || data.length === 0) {
    return (
      <div className="card donut-card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '320px' }}>
        <h2 className="card-title" style={{ marginBottom: '8px' }}>Project Health Distribution</h2>
        <div style={{ color: '#EF4444', fontSize: '13px' }}>Unable to load data from backend.</div>
      </div>
    );
  }
  
  let accumulatedPercentage = 0;
  const totalProjects = data.reduce((acc, curr) => acc + curr.count, 0);

  return (
    <div className="card donut-card">
      <div className="card-header">
        <h2 className="card-title">Project Health Distribution</h2>
        <p className="card-subtitle">By project status</p>
      </div>

      <div className="donut-chart-container">
        <div className="donut-svg-wrapper">
          <svg viewBox="0 0 140 140" className="donut-svg">
            {/* Base track circle */}
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

          {/* Central Counter Display - cleanly centered inside the hole */}
          <div className="donut-center-text">
            <span className="donut-center-value">
              <AnimatedCounter value={hoveredSegment ? hoveredSegment.count : totalProjects} />
            </span>
            <span className="donut-center-label">
              {hoveredSegment ? hoveredSegment.name : 'TOTAL'}
            </span>
          </div>
        </div>

        {/* Legend cleanly formatted */}
        <div className="donut-legend">
          {data.map((segment) => {
            const isHovered = hoveredSegment?.id === segment.id;
            return (
              <div 
                key={segment.id} 
                className={`legend-item ${isHovered ? 'active' : ''}`}
                onMouseEnter={() => setHoveredSegment(segment)}
                onMouseLeave={() => setHoveredSegment(null)}
              >
                <div className="legend-indicator" style={{ backgroundColor: segment.color }} />
                <div className="legend-info">
                  <div className="legend-name-row">
                    <span className="legend-name">{segment.name}</span>
                    <div className="legend-stats">
                      <span className="legend-count">{segment.count.toLocaleString()}</span>
                      <span className="legend-pct">({segment.percentage.toFixed(1)}%)</span>
                    </div>
                  </div>
                  <div className="legend-bar-bg">
                    <div 
                      className="legend-bar-fill" 
                      style={{ 
                        width: mounted ? `${segment.percentage}%` : '0%',
                        backgroundColor: segment.color 
                      }} 
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
