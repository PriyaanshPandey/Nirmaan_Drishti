import React, { useState, useEffect } from 'react';
import './DonutChart.css';
import { AnimatedCounter } from './AnimatedCounter';

interface ChartSegment {
  id: string;
  name: string;
  count: number;
  color: string;
  percentage: number;
}

export const DonutChart: React.FC = () => {
  const data: ChartSegment[] = [
    { id: 'on-track', name: 'On Track', count: 1090, color: 'var(--color-on-track)', percentage: 55.0 },
    { id: 'monitoring', name: 'Monitoring', count: 376, color: 'var(--color-monitoring)', percentage: 19.0 },
    { id: 'at-risk', name: 'At Risk', count: 247, color: 'var(--color-at-risk)', percentage: 12.5 },
    { id: 'critical', name: 'Critical Delay', count: 268, color: 'var(--color-critical-dark)', percentage: 13.5 },
  ];

  const [hoveredSegment, setHoveredSegment] = useState<ChartSegment | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 100);
    return () => clearTimeout(t);
  }, []);

  // Circle dimensions
  const radius = 50;
  const strokeWidth = 14;
  const circumference = 2 * Math.PI * radius; // ~314.159
  
  let accumulatedPercentage = 0;
  const totalProjects = 1981;

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
            
            {data.map((segment, idx) => {
              const strokeLength = (segment.percentage / 100) * circumference;
              const strokeOffset = circumference - (accumulatedPercentage / 100) * circumference;
              
              accumulatedPercentage += segment.percentage;
              
              const isHovered = hoveredSegment?.id === segment.id;
              // Animate from full circumference (hidden) → target offset
              const animatedOffset = mounted ? strokeOffset : circumference;
              
              return (
                <circle
                  key={segment.id}
                  cx="70"
                  cy="70"
                  r={radius}
                  fill="transparent"
                  stroke={segment.color}
                  strokeWidth={isHovered ? strokeWidth + 3 : strokeWidth}
                  strokeDasharray={`${strokeLength} ${circumference - strokeLength}`}
                  strokeDashoffset={animatedOffset}
                  transform="rotate(-90 70 70)"
                  className="donut-segment"
                  style={{
                    transition: `stroke-dashoffset 0.9s cubic-bezier(0.16, 1, 0.3, 1) ${idx * 0.12}s, stroke-width 0.25s cubic-bezier(0.16, 1, 0.3, 1), stroke 0.2s ease`,
                    opacity: hoveredSegment && !isHovered ? 0.5 : 1,
                  }}
                  onMouseEnter={() => setHoveredSegment(segment)}
                  onMouseLeave={() => setHoveredSegment(null)}
                />
              );
            })}
          </svg>

          {/* Interactive center hole label (adds high character) */}
          <div className="donut-center-label">
            {hoveredSegment ? (
              <>
                <span className="center-value" style={{ color: hoveredSegment.color }}>
                  {hoveredSegment.percentage}%
                </span>
                <span className="center-text">{hoveredSegment.name}</span>
              </>
            ) : (
              <>
                <span className="center-value">
                  <AnimatedCounter value={totalProjects} />
                </span>
                <span className="center-text">Total Projects</span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* 2x2 Legend Grid */}
      <div className="donut-legend-grid">
        {data.map((item) => {
          const isDimmed = hoveredSegment && hoveredSegment.id !== item.id;
          return (
            <div 
              key={item.id} 
              className={`legend-item ${isDimmed ? 'dimmed' : ''}`}
              onMouseEnter={() => setHoveredSegment(item)}
              onMouseLeave={() => setHoveredSegment(null)}
            >
              <span className="legend-dot" style={{ backgroundColor: item.color }}></span>
              <div className="legend-info">
                <span className="legend-name">{item.name}</span>
                <span className="legend-value">{item.count.toLocaleString()}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

