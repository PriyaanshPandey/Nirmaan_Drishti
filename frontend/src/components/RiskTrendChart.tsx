import React, { useState, useEffect } from 'react';
import './RiskTrendChart.css';
import { api } from '../services/api';

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
  const [chartData, setChartData] = useState<Record<MetricTab, ChartData> | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<boolean>(false);

  useEffect(() => {
    let isMounted = true;
    api.getDashboardSummary().then((res) => {
      if (!isMounted) return;
      if (res && res.risk_trend) {
        setChartData({
          cost: res.risk_trend.cost,
          time: res.risk_trend.time,
          impl: res.risk_trend.impl,
        });
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
    };
  }, []);

  const currentData = chartData ? chartData[activeTab] : null;

  return (
    <div className="card risk-trend-card">
      <div className="trend-header">
        <div>
          <h2 className="card-title">National Risk Trend</h2>
          <p className="card-subtitle">Trajectory Analysis (Trailing 12 Mo)</p>
        </div>

        {/* Tab Selection */}
        <div className="trend-tabs">
          <button
            className={`trend-tab-btn ${activeTab === 'cost' ? 'active' : ''}`}
            onClick={() => {
              setActiveTab('cost');
              setHoveredPointIdx(null);
            }}
          >
            Cost
          </button>
          <button
            className={`trend-tab-btn ${activeTab === 'time' ? 'active' : ''}`}
            onClick={() => {
              setActiveTab('time');
              setHoveredPointIdx(null);
            }}
          >
            Time
          </button>
          <button
            className={`trend-tab-btn ${activeTab === 'impl' ? 'active' : ''}`}
            onClick={() => {
              setActiveTab('impl');
              setHoveredPointIdx(null);
            }}
          >
            Impl.
          </button>
        </div>
      </div>

      <div className="trend-chart-container">
        {loading ? (
          <div style={{ padding: '40px', textAlign: 'center', color: '#94A3B8', fontSize: '13px' }}>
            Loading trend data...
          </div>
        ) : error || !currentData ? (
          <div style={{ padding: '40px', textAlign: 'center', color: '#EF4444', fontSize: '13px' }}>
            Unable to load data from backend.
          </div>
        ) : (
          <>
            <svg viewBox="0 0 320 120" className="trend-svg">
              <defs>
                <linearGradient id="trendGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor="#2563EB" stopOpacity="0.25" />
                  <stop offset="100%" stopColor="#2563EB" stopOpacity="0.0" />
                </linearGradient>
              </defs>

              {/* Grid lines */}
              <line x1="15" y1="20" x2="305" y2="20" stroke="#F1F5F9" strokeWidth="1" strokeDasharray="3 3" />
              <line x1="15" y1="55" x2="305" y2="55" stroke="#F1F5F9" strokeWidth="1" strokeDasharray="3 3" />
              <line x1="15" y1="90" x2="305" y2="90" stroke="#F1F5F9" strokeWidth="1" strokeDasharray="3 3" />
              <line x1="15" y1="110" x2="305" y2="110" stroke="#E2E8F0" strokeWidth="1" />

              {/* Gradient Fill under curve */}
              <path d={currentData.fillPath} fill="url(#trendGradient)" />

              {/* Main trend line path */}
              <path
                d={currentData.path}
                fill="none"
                stroke="#2563EB"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />

              {/* Data Points and Interactivity */}
              {currentData.points.map((pt, idx) => {
                const isHovered = hoveredPointIdx === idx;
                return (
                  <g key={idx}>
                    {/* Vertical hover marker line */}
                    {isHovered && (
                      <line
                        x1={pt.x}
                        y1={pt.y}
                        x2={pt.x}
                        y2="110"
                        stroke="#94A3B8"
                        strokeWidth="1"
                        strokeDasharray="2 2"
                      />
                    )}

                    {/* Point circle */}
                    <circle
                      cx={pt.x}
                      cy={pt.y}
                      r={isHovered ? 5 : 3.5}
                      fill="#ffffff"
                      stroke="#2563EB"
                      strokeWidth={isHovered ? 2.5 : 2}
                      style={{ transition: 'all 0.15s ease', cursor: 'pointer' }}
                    />

                    {/* Larger transparent hover target for ease of use */}
                    <circle
                      cx={pt.x}
                      cy={pt.y}
                      r="12"
                      fill="transparent"
                      onMouseEnter={() => setHoveredPointIdx(idx)}
                      onMouseLeave={() => setHoveredPointIdx(null)}
                      style={{ cursor: 'pointer' }}
                    />

                    {/* X-axis labels */}
                    <text
                      x={pt.x}
                      y="120"
                      textAnchor="middle"
                      fontSize="8.5"
                      fill={isHovered ? '#0F172A' : '#94A3B8'}
                      fontWeight={isHovered ? '600' : 'normal'}
                    >
                      {pt.label}
                    </text>
                  </g>
                );
              })}
            </svg>

            {/* Floating Tooltip positioned over the hovered point */}
            {hoveredPointIdx !== null && currentData.points[hoveredPointIdx] && (
              <div
                className="trend-tooltip"
                style={{
                  left: `${(currentData.points[hoveredPointIdx].x / 320) * 100}%`,
                  top: `${(currentData.points[hoveredPointIdx].y / 120) * 100}%`,
                }}
              >
                <div className="tooltip-value">{currentData.points[hoveredPointIdx].value}</div>
                <div className="tooltip-label">{currentData.points[hoveredPointIdx].label}</div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};
