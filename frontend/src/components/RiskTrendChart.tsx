import React, { useState } from 'react';
import './RiskTrendChart.css';

type MetricTab = 'cost' | 'time' | 'impl';

interface Point {
  x: number;
  y: number;
  label: string;
  value: string;
}

interface ChartData {
  path: string;
  fillPath: string;
  points: Point[];
}

export const RiskTrendChart: React.FC = () => {
  const [activeTab, setActiveTab] = useState<MetricTab>('cost');
  const [hoveredPointIdx, setHoveredPointIdx] = useState<number | null>(null);

  // Exact coordinates for different tabs (viewBox="0 0 320 120")
  const chartData: Record<MetricTab, ChartData> = {
    cost: {
      // Upward trend
      path: 'M 15 100 C 60 98, 90 92, 135 88 C 180 84, 210 70, 255 60 C 275 55, 290 48, 305 38',
      fillPath: 'M 15 100 C 60 98, 90 92, 135 88 C 180 84, 210 70, 255 60 C 275 55, 290 48, 305 38 L 305 110 L 15 110 Z',
      points: [
        { x: 15, y: 100, label: 'Q1', value: '₹12.0 L Cr' },
        { x: 88, y: 94, label: 'Q2', value: '₹17.5 L Cr' },
        { x: 160, y: 86, label: 'Q3', value: '₹25.0 L Cr' },
        { x: 232, y: 65, label: 'Q4', value: '₹34.8 L Cr' },
        { x: 305, y: 38, label: 'Q1 \'26', value: '₹42.78 L Cr' },
      ],
    },
    time: {
      // Wave shape
      path: 'M 15 80 C 60 40, 90 100, 135 70 C 180 40, 210 30, 255 50 C 275 60, 290 45, 305 30',
      fillPath: 'M 15 80 C 60 40, 90 100, 135 70 C 180 40, 210 30, 255 50 C 275 60, 290 45, 305 30 L 305 110 L 15 110 Z',
      points: [
        { x: 15, y: 80, label: 'Q1', value: '2mo delay' },
        { x: 88, y: 82, label: 'Q2', value: '4mo delay' },
        { x: 160, y: 55, label: 'Q3', value: '5mo delay' },
        { x: 232, y: 48, label: 'Q4', value: '9mo delay' },
        { x: 305, y: 30, label: 'Q1 \'26', value: '12mo delay' },
      ],
    },
    impl: {
      // Steady progress
      path: 'M 15 95 C 60 85, 90 75, 135 65 C 180 55, 210 45, 255 35 C 275 30, 290 25, 305 20',
      fillPath: 'M 15 95 C 60 85, 90 75, 135 65 C 180 55, 210 45, 255 35 C 275 30, 290 25, 305 20 L 305 110 L 15 110 Z',
      points: [
        { x: 15, y: 95, label: 'Q1', value: '15% Done' },
        { x: 88, y: 78, label: 'Q2', value: '32% Done' },
        { x: 160, y: 60, label: 'Q3', value: '50% Done' },
        { x: 232, y: 40, label: 'Q4', value: '68% Done' },
        { x: 305, y: 20, label: 'Q1 \'26', value: '85% Done' },
      ],
    },
  };

  const currentData = chartData[activeTab];

  return (
    <div className="card risk-trend-card">
      <div className="risk-trend-header">
        <div>
          <h2 className="card-title">National Risk Trend</h2>
          <p className="card-subtitle">Graphical representation</p>
        </div>
        <div className="trend-tabs">
          {(['cost', 'time', 'impl'] as MetricTab[]).map((tab) => (
            <button
              key={tab}
              className={`trend-tab-btn ${activeTab === tab ? 'active' : ''}`}
              onClick={() => {
                setActiveTab(tab);
                setHoveredPointIdx(null);
              }}
            >
              {tab === 'impl' ? 'Impl.' : tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>
      </div>

      <div className="chart-wrapper">
        <svg viewBox="0 0 320 120" className="trend-svg" key={activeTab}>
          <defs>
            <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="rgba(47, 107, 244, 0.3)" />
              <stop offset="100%" stopColor="rgba(47, 107, 244, 0.0)" />
            </linearGradient>
            
            <filter id="shadow" x="-5%" y="-5%" width="110%" height="110%">
              <feDropShadow dx="0" dy="4" stdDeviation="2.5" floodColor="#0A0D30" floodOpacity="0.1" />
            </filter>
          </defs>

          {/* Grid lines */}
          <line x1="15" y1="110" x2="305" y2="110" stroke="#E2E8F0" strokeWidth="0.75" />
          <line x1="15" y1="65" x2="305" y2="65" stroke="#F1F5F9" strokeWidth="0.75" />
          <line x1="15" y1="20" x2="305" y2="20" stroke="#F1F5F9" strokeWidth="0.75" />

          {/* Interactive Guide Line on Hover */}
          {hoveredPointIdx !== null && (
            <line
              x1={currentData.points[hoveredPointIdx].x}
              y1="10"
              x2={currentData.points[hoveredPointIdx].x}
              y2="110"
              stroke="rgba(47, 107, 244, 0.35)"
              strokeWidth="1.5"
              strokeDasharray="3 3"
              className="vertical-guide-line"
            />
          )}

          {/* Area fill path */}
          <path
            d={currentData.fillPath}
            fill="url(#chartGradient)"
            className="chart-area-path graph-fill-animate"
          />

          {/* Main stroke line */}
          <path
            d={currentData.path}
            fill="none"
            stroke="#0A0D30"
            strokeWidth="2.5"
            strokeLinecap="round"
            filter="url(#shadow)"
            className="chart-stroke-path graph-path-animate"
          />

          {/* Interactive data dots */}
          {currentData.points.map((pt, idx) => {
            const isHovered = hoveredPointIdx === idx;
            return (
              <g
                key={idx}
                className="chart-dot-group"
                onMouseEnter={() => setHoveredPointIdx(idx)}
                onMouseLeave={() => setHoveredPointIdx(null)}
              >
                {/* Large invisible catch circle for better hover interaction */}
                <circle
                  cx={pt.x}
                  cy={pt.y}
                  r="12"
                  fill="transparent"
                  style={{ cursor: 'pointer' }}
                />
                
                <circle
                  cx={pt.x}
                  cy={pt.y}
                  r={isHovered ? 4.5 : 3}
                  fill="#ffffff"
                  stroke={isHovered ? "var(--color-on-track)" : "#0A0D30"}
                  strokeWidth={isHovered ? 2.5 : 1.5}
                  className="chart-dot"
                  style={{ transition: 'all 0.2s ease' }}
                />
                <circle
                  cx={pt.x}
                  cy={pt.y}
                  r="7"
                  fill="rgba(10, 13, 48, 0.15)"
                  className="chart-dot-pulse"
                  style={{
                    transform: isHovered ? 'scale(1.4)' : 'scale(1)',
                    opacity: isHovered ? 0.8 : 0,
                    transition: 'all 0.2s ease',
                  }}
                />
              </g>
            );
          })}
        </svg>

        {/* Floating Tooltip Div inside Chart Container (high-quality interaction!) */}
        {hoveredPointIdx !== null && (
          <div
            className="chart-floating-tooltip"
            style={{
              left: `${(currentData.points[hoveredPointIdx].x / 320) * 100}%`,
              top: `${(currentData.points[hoveredPointIdx].y / 120) * 100 - 32}%`,
              transform: 'translateX(-50%)',
            }}
          >
            <div className="tooltip-value">{currentData.points[hoveredPointIdx].value}</div>
            <div className="tooltip-label">{currentData.points[hoveredPointIdx].label}</div>
          </div>
        )}
      </div>

      {/* X Axis Labels */}
      <div className="x-axis-labels">
        {currentData.points.map((pt, idx) => (
          <span
            key={idx}
            className={`x-label ${hoveredPointIdx === idx ? 'active' : ''}`}
            onMouseEnter={() => setHoveredPointIdx(idx)}
            onMouseLeave={() => setHoveredPointIdx(null)}
          >
            {pt.label}
          </span>
        ))}
      </div>
    </div>
  );
};
