import React, { useState } from 'react';
import { Folder, AlertTriangle, ShieldAlert, Check, TrendingUp, Filter, CheckCircle2 } from 'lucide-react';
import './ProjectDistribution.css';
import { AnimatedCounter } from './AnimatedCounter';

interface DistributionRow {
  name: string;
  total: number;
  high: number;
  highPct: number;
  medium: number;
  mediumPct: number;
  low: number;
  lowPct: number;
  avgRisk: number;
}

export const ProjectDistribution: React.FC = () => {
  const [selectedMinistryFilter, setSelectedMinistryFilter] = useState('All');
  const [selectedSectorFilter, setSelectedSectorFilter] = useState('All');

  // Metrics Data matching mockup exactly
  const metrics = [
    {
      id: 'total',
      title: 'Total Projects',
      value: 1248,
      formatter: (val: number) => val.toLocaleString(),
      desc: 'Across all ministries & Sectors',
      icon: <Folder size={15} color="var(--color-on-track)" />,
      themeClass: 'light-theme'
    },
    {
      id: 'high',
      title: 'High Priority',
      value: 156,
      formatter: (val: number) => val.toString(),
      desc: '12.5% of total projects',
      icon: <ShieldAlert size={15} color="var(--color-accent-red)" />,
      themeClass: 'light-theme'
    },
    {
      id: 'medium',
      title: 'Medium Priority',
      value: 312,
      formatter: (val: number) => val.toString(),
      desc: '25.0% of total projects',
      icon: <AlertTriangle size={15} color="#F59E0B" />,
      themeClass: 'dark-theme' // Solid dark navy theme card
    },
    {
      id: 'low',
      title: 'Low Priority',
      value: 780,
      formatter: (val: number) => val.toString(),
      desc: '62.5% of total projects',
      icon: <Check size={15} color="#22C55E" />,
      themeClass: 'light-theme'
    },
    {
      id: 'risk',
      title: 'Avg. Risk Score',
      value: 57,
      formatter: (val: number) => `${val}%`,
      desc: 'Across all projects',
      icon: <TrendingUp size={15} color="#A855F7" />,
      themeClass: 'light-theme'
    }
  ];

  // Ministry Table Data
  const ministryData: DistributionRow[] = [
    { name: 'Ministry of Railways', total: 230, high: 36, highPct: 16, medium: 62, mediumPct: 27, low: 132, lowPct: 57, avgRisk: 65 },
    { name: 'Ministry of Road Transport & Highways', total: 210, high: 28, highPct: 13, medium: 50, mediumPct: 24, low: 132, lowPct: 63, avgRisk: 54 },
    { name: 'Ministry of Power', total: 180, high: 22, highPct: 12, medium: 45, mediumPct: 25, low: 113, lowPct: 63, avgRisk: 51 },
    { name: 'Ministry of Jal Shakti', total: 150, high: 18, highPct: 12, medium: 36, mediumPct: 24, low: 96, lowPct: 64, avgRisk: 48 },
    { name: 'Ministry of Housing & Urban Affairs', total: 120, high: 16, highPct: 13, medium: 30, mediumPct: 25, low: 74, lowPct: 62, avgRisk: 39 }
  ];

  // Sector Table Data
  const sectorData: DistributionRow[] = [
    { name: 'Transport & Connectivity', total: 430, high: 58, highPct: 14, medium: 140, mediumPct: 33, low: 232, lowPct: 54, avgRisk: 65 },
    { name: 'Energy & Power', total: 260, high: 31, highPct: 12, medium: 59, mediumPct: 23, low: 170, lowPct: 65, avgRisk: 54 },
    { name: 'Water Resources', total: 180, high: 22, highPct: 12, medium: 43, mediumPct: 24, low: 115, lowPct: 64, avgRisk: 45 },
    { name: 'Urban Development', total: 150, high: 20, highPct: 13, medium: 38, mediumPct: 25, low: 92, lowPct: 61, avgRisk: 50 },
    { name: 'Other Sectors', total: 228, high: 25, highPct: 11, medium: 55, mediumPct: 24, low: 148, lowPct: 65, avgRisk: 52 }
  ];

  const getRiskColorClass = (risk: number) => {
    if (risk >= 60) return 'font-red';
    if (risk >= 50) return 'font-orange';
    return 'font-green';
  };

  return (
    <div className="distribution-page-container animation-fade-in">
      {/* Title Header bar */}
      <div className="dist-page-header">
        <div>
          <h1 className="dist-page-title">Project Distribution Overview</h1>
          <p className="dist-page-subtitle">View projects distribution by Ministry and Sector to identify priority areas for attention and intervention.</p>
        </div>
        <div className="dist-header-filters">
          <select 
            value={selectedMinistryFilter} 
            onChange={(e) => setSelectedMinistryFilter(e.target.value)} 
            className="dist-select"
          >
            <option value="All">All Ministries</option>
            <option value="Railways">Railways</option>
            <option value="Roads">Roads & Highways</option>
            <option value="Power">Power</option>
          </select>

          <select 
            value={selectedSectorFilter} 
            onChange={(e) => setSelectedSectorFilter(e.target.value)} 
            className="dist-select"
          >
            <option value="All">All Sectors</option>
            <option value="Transport">Transport</option>
            <option value="Energy">Energy</option>
            <option value="Water">Water Resources</option>
          </select>

          <button className="dist-filter-btn" onClick={() => alert('Opening advanced distribution filters...')}>
            <Filter size={13} />
            <span>Filters</span>
          </button>
        </div>
      </div>

      {/* Row 1 Metrics: 5 cards */}
      <div className="dist-metrics-row-5">
        {metrics.map((m) => (
          <div key={m.id} className={`dist-metric-box ${m.themeClass}`}>
            <div className="dist-metric-top">
              <span className="dist-metric-lbl">{m.title}</span>
              <div className="dist-icon-circle">{m.icon}</div>
            </div>
            <div className="dist-metric-body">
              <span className="dist-metric-val">
                <AnimatedCounter value={m.value} formatter={m.formatter} />
              </span>
            </div>
            <div className="dist-metric-footer">
              <span className="dist-metric-desc">{m.desc}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Row 2: Side-by-side Tables */}
      <div className="dist-tables-grid-2">
        {/* Left Card: Distribution by Ministry */}
        <div className="card dist-table-card">
          <div className="dist-table-header">
            <div>
              <h2 className="card-title">Distribution by Ministry</h2>
            </div>
            <button className="card-link-btn" onClick={() => alert('Viewing all ministries distribution data')}>View All &gt;</button>
          </div>

          <div className="dist-table-wrapper">
            <table className="distribution-table">
              <thead>
                <tr>
                  <th style={{ width: '40%' }}>Ministry</th>
                  <th style={{ width: '12%', textAlign: 'center' }}>Total Projects</th>
                  <th style={{ width: '12%', textAlign: 'center' }}>High Priority</th>
                  <th style={{ width: '12%', textAlign: 'center' }}>Medium Priority</th>
                  <th style={{ width: '12%', textAlign: 'center' }}>Low Priority</th>
                  <th style={{ width: '12%', textAlign: 'right' }}>Avg. Risk</th>
                </tr>
              </thead>
              <tbody>
                {ministryData.map((row, idx) => (
                  <tr key={idx} className="dist-table-row">
                    <td className="bold-cell" style={{ color: 'var(--navy-dark)' }}>{row.name}</td>
                    <td className="center-text font-weight-bold">{row.total}</td>
                    <td className="center-text font-red font-weight-bold">
                      {row.high} <span className="dist-pct-tag">({row.highPct}%)</span>
                    </td>
                    <td className="center-text font-orange font-weight-bold">
                      {row.medium} <span className="dist-pct-tag">({row.mediumPct}%)</span>
                    </td>
                    <td className="center-text font-green font-weight-bold">
                      {row.low} <span className="dist-pct-tag">({row.lowPct}%)</span>
                    </td>
                    <td className={`right-text font-weight-bold ${getRiskColorClass(row.avgRisk)}`}>
                      {row.avgRisk}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right Card: Distribution by Sector (Light Blue Theme card) */}
        <div className="card dist-table-card light-blue-theme-card">
          <div className="dist-table-header">
            <div>
              <h2 className="card-title">Distribution by Sector</h2>
            </div>
            <button className="card-link-btn" onClick={() => alert('Viewing all sectors distribution data')}>View All &gt;</button>
          </div>

          <div className="dist-table-wrapper">
            <table className="distribution-table">
              <thead>
                <tr>
                  <th style={{ width: '40%' }}>Sector</th>
                  <th style={{ width: '12%', textAlign: 'center' }}>Total Projects</th>
                  <th style={{ width: '12%', textAlign: 'center' }}>High Priority</th>
                  <th style={{ width: '12%', textAlign: 'center' }}>Medium Priority</th>
                  <th style={{ width: '12%', textAlign: 'center' }}>Low Priority</th>
                  <th style={{ width: '12%', textAlign: 'right' }}>Avg. Risk</th>
                </tr>
              </thead>
              <tbody>
                {sectorData.map((row, idx) => (
                  <tr key={idx} className="dist-table-row">
                    <td className="bold-cell" style={{ color: 'var(--navy-dark)' }}>{row.name}</td>
                    <td className="center-text font-weight-bold">{row.total}</td>
                    <td className="center-text font-red font-weight-bold">
                      {row.high} <span className="dist-pct-tag">({row.highPct}%)</span>
                    </td>
                    <td className="center-text font-orange font-weight-bold">
                      {row.medium} <span className="dist-pct-tag">({row.mediumPct}%)</span>
                    </td>
                    <td className="center-text font-green font-weight-bold">
                      {row.low} <span className="dist-pct-tag">({row.lowPct}%)</span>
                    </td>
                    <td className={`right-text font-weight-bold ${getRiskColorClass(row.avgRisk)}`}>
                      {row.avgRisk}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Row 3: Bottom Cards */}
      <div className="dist-bottom-grid-4">
        {/* Card 1: Priority Recommendation */}
        <div className="card dist-recommend-card">
          <div className="recommend-icon-wrapper purple-bg">
            <AlertTriangle size={15} color="#A855F7" />
          </div>
          <h3 className="recommend-title">Priority Recommendation</h3>
          <p className="recommend-desc">
            Focus on high-risk ministries and sectors to ensure timely, targeted site interventions and reduce cumulative cost overruns & delays.
          </p>
        </div>

        {/* Card 2: Top Ministry to Prioritise (Red Outline) */}
        <div className="card dist-recommend-card red-outline-card">
          <div className="recommend-icon-wrapper red-bg">
            <ShieldAlert size={15} color="var(--color-accent-red)" />
          </div>
          <h3 className="recommend-title-top font-red">Top Ministry to Prioritise</h3>
          <h2 className="recommend-focus-name">Ministry of Railways</h2>
          
          <div className="recommend-stats-row">
            <div className="recommend-stat-col">
              <span className="stat-num">38</span>
              <span className="stat-lbl">High Priority Projects</span>
            </div>
            <div className="recommend-stat-col">
              <span className="stat-num font-red">65%</span>
              <span className="stat-lbl">Avg. Risk Score</span>
            </div>
          </div>

          <button className="recommend-cta-btn btn-red-outline" onClick={() => alert('Opening Railways Ministry details...')}>
            View Ministry Details &gt;
          </button>
        </div>

        {/* Card 3: Top Sector to Prioritise (Solid Dark Navy) */}
        <div className="card dist-recommend-card dark-navy-theme prioritised-sector-card">
          <div className="recommend-icon-wrapper dark-navy-bg">
            <Folder size={15} color="#ffffff" />
          </div>
          <h3 className="recommend-title-top text-light-blue">Top Sector to Prioritise</h3>
          <h2 className="recommend-focus-name text-white">Transport & Connectivity</h2>
          
          <div className="recommend-stats-row">
            <div className="recommend-stat-col">
              <span className="stat-num text-white">58</span>
              <span className="stat-lbl text-light-blue">High Priority Projects</span>
            </div>
            <div className="recommend-stat-col">
              <span className="stat-num text-orange-yellow">61%</span>
              <span className="stat-lbl text-light-blue">Avg. Risk Score</span>
            </div>
          </div>

          <button className="recommend-cta-btn btn-white-outline" onClick={() => alert('Opening Transport Sector details...')}>
            View Sector Details &gt;
          </button>
        </div>

        {/* Card 4: Recommended Actions */}
        <div className="card dist-recommend-card">
          <h3 className="recommend-title flex-align-center gap-6">
            <CheckCircle2 size={15} color="#22C55E" />
            <span>Recommended Actions</span>
          </h3>
          
          <div className="actions-bullet-list">
            <div className="action-bullet-item">
              <Check size={12} className="bullet-check-icon" />
              <span>Review high priority projects immediately</span>
            </div>
            <div className="action-bullet-item">
              <Check size={12} className="bullet-check-icon" />
              <span>Conduct intensive site evaluations</span>
            </div>
            <div className="action-bullet-item">
              <Check size={12} className="bullet-check-icon" />
              <span>Check expenditure vs physical progress</span>
            </div>
            <div className="action-bullet-item">
              <Check size={12} className="bullet-check-icon" />
              <span>Plan interventions to reduce delay & cost overrun</span>
            </div>
          </div>

          <button className="recommend-cta-btn btn-green-outline" onClick={() => alert('Navigating to projects selection...')}>
            View Recommended Projects &gt;
          </button>
        </div>
      </div>
    </div>
  );
};
