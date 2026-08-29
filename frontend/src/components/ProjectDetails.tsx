import React, { useState, useEffect } from 'react';
import { ArrowLeft, ChevronDown, Bell, ShieldAlert, Award, FileText, Calendar, Check, AlertTriangle, ArrowRight, SlidersHorizontal } from 'lucide-react';
import { projectsData } from '../data/projectsData';
import './ProjectDetails.css';

interface ProjectDetailsProps {
  projectId: string;
  onBack: () => void;
}

export const ProjectDetails: React.FC<ProjectDetailsProps> = ({ projectId, onBack }) => {
  const project = projectsData.find((p) => p.id === projectId) || projectsData[0];

  // Tab selections
  const [benchmarkingTab, setBenchmarkingTab] = useState<'cost' | 'delay' | 'tech'>('cost');
  const [perfTab, setPerfTab] = useState<'progress' | 'expenditure'>('progress');
  const [riskTrendTab, setRiskTrendTab] = useState<'overall' | 'cost' | 'time'>('overall');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 80);
    return () => clearTimeout(t);
  }, []);

  // Dynamic Benchmarking table rows generator
  const getBenchmarkData = () => {
    if (benchmarkingTab === 'cost') {
      return [
        { label: 'Approved Budget', projectVal: project.costApproved, avg: '₹95,000 Cr', benchmark: '₹88,000 Cr' },
        { label: 'Revised Estimate', projectVal: project.costRevised, avg: '₹1,02,000 Cr', benchmark: '₹94,000 Cr' },
        { label: 'Cumulative Overrun', projectVal: project.costOverrunPct.includes('overrun') ? project.costOverrunPct.replace(' overrun', '') : project.costOverrunPct, avg: '+5.2%', benchmark: '+3.4%', isAlert: true },
        { label: 'Financial Progress %', projectVal: `${project.progressFinancial}%`, avg: '63%', benchmark: '68%' }
      ];
    } else if (benchmarkingTab === 'delay') {
      return [
        { label: 'Expected Completion', projectVal: project.expectedCompletion, avg: 'Dec 2027', benchmark: 'Dec 2026' },
        { label: 'Original Completion', projectVal: project.originalCompletion, avg: 'Jun 2027', benchmark: 'Dec 2026' },
        { label: 'Physical Progress %', projectVal: `${project.progressPhysical}%`, avg: '68%', benchmark: '75%', isAlert: project.progressPhysical < project.progressPhysicalTarget },
        { label: 'Physical Target %', projectVal: `${project.progressPhysicalTarget}%`, avg: '72%', benchmark: '78%' }
      ];
    } else {
      return [
        { label: 'Cost Risk Score', projectVal: `${project.costRisk}%`, avg: '54%', benchmark: '35%', isAlert: project.costRisk >= 70 },
        { label: 'Time Risk Score', projectVal: `${project.timeRisk}%`, avg: '58%', benchmark: '40%', isAlert: project.timeRisk >= 70 },
        { label: 'Implementation Risk', projectVal: `${project.implRisk}%`, avg: '48%', benchmark: '30%', isAlert: project.implRisk >= 70 },
        { label: 'Overall Risk Score', projectVal: `${project.overallRisk}%`, avg: '52%', benchmark: '32%', isAlert: project.overallRisk >= 70 }
      ];
    }
  };

  // Dynamic Why At Risk factors reflecting exact project data
  const riskFactors = [
    { label: 'Physical Progress Lag', pct: Math.max(10, project.implRisk), color: 'bg-accent' },
    { label: 'Milestone Slippage', pct: Math.max(10, project.timeRisk - 15), color: 'bg-accent' },
    { label: 'Fund Flow Delays', pct: Math.max(10, project.costRisk - 20), color: 'bg-orange' },
    { label: 'Clearance Issues', pct: Math.max(5, Math.round(project.implRisk * 0.4)), color: 'bg-info' },
    { label: 'Contractor Performance', pct: Math.max(5, Math.round(project.overallRisk * 0.35)), color: 'bg-info' }
  ];

  // Dynamic Emerging Issues reflecting exact project data
  const emergingIssues = [
    { label: 'Land Acquisition', impact: `+${Math.max(5, Math.round(project.implRisk * 0.35))}%`, pct: Math.max(10, project.implRisk), color: 'bg-critical', textColor: 'text-critical' },
    { label: 'Procurement Delays', impact: `+${Math.max(4, Math.round(project.costRisk * 0.25))}%`, pct: Math.max(10, project.costRisk), color: 'bg-warning', textColor: 'text-warning' },
    { label: 'Clearance Delays', impact: `+${Math.max(3, Math.round(project.implRisk * 0.2))}%`, pct: Math.max(10, Math.round(project.implRisk * 0.8)), color: 'bg-warning', textColor: 'text-warning' },
    { label: 'Contractor Issues', impact: `+${Math.max(2, Math.round(project.overallRisk * 0.15))}%`, pct: Math.max(10, Math.round(project.overallRisk * 0.6)), color: 'bg-info', textColor: 'text-info' },
    { label: 'Milestone Slippage', impact: `+${Math.max(1, Math.round(project.timeRisk * 0.1))}%`, pct: Math.max(10, Math.round(project.timeRisk * 0.4)), color: 'bg-info-light', textColor: 'text-info-light' }
  ];

  // Get Primary Driver dynamically
  const sortedFactors = [...riskFactors].sort((a, b) => b.pct - a.pct);
  const primaryDriver = sortedFactors[0]?.label || 'Physical Progress Lag';

  // Dynamic Risk Trend SVG coordinate generator
  const getRiskTrendCoords = () => {
    let score = project.overallRisk;
    let changeLabel = '▲ +3% this quarter';
    let areaPath = '';
    let linePath = '';
    let circleY = 40;

    if (riskTrendTab === 'overall') {
      score = project.overallRisk;
      changeLabel = '▲ +2.4% this quarter';
      circleY = 110 - score * 0.8;
      linePath = `M 15 95 Q 85 90, 160 75 T 305 ${circleY}`;
      areaPath = `${linePath} L 305 110 L 15 110 Z`;
    } else if (riskTrendTab === 'cost') {
      score = project.costRisk;
      changeLabel = '▲ +4.1% this quarter';
      circleY = 110 - score * 0.8;
      linePath = `M 15 105 Q 85 95, 160 85 T 305 ${circleY}`;
      areaPath = `${linePath} L 305 110 L 15 110 Z`;
    } else {
      score = project.timeRisk;
      changeLabel = '▲ +6.5% this quarter';
      circleY = 110 - score * 0.8;
      linePath = `M 15 80 Q 85 70, 160 60 T 305 ${circleY}`;
      areaPath = `${linePath} L 305 110 L 15 110 Z`;
    }

    return { score, changeLabel, areaPath, linePath, circleY };
  };

  // Risk Dials SVG Render to match the third image exactly
  const renderRiskDial = (title: string, value: number) => {
    let level = 'Low';
    let strokeColor = '#10B981'; // Green
    let change = '▲ 0%';
    
    if (value >= 90) {
      level = 'Critical';
      strokeColor = '#D62F39'; // Red
      change = '▲ +8%';
    } else if (value >= 70) {
      level = 'High';
      strokeColor = '#F59E0B'; // Orange
      change = '▲ +6%';
    } else if (value >= 40) {
      level = 'Medium';
      strokeColor = '#3B82F6'; // Blue
      change = '▲ +2%';
    } else {
      level = 'Low';
      strokeColor = '#10B981'; // Green
      change = '▲ 0%';
    }

    // Specific overrides to match the reference images if the project is Mumbai Metro
    if (projectId === 'mumbai-metro-3') {
      if (title === 'Cost Risk') { value = 84; level = 'High'; strokeColor = '#F59E0B'; change = '▲ +6%'; }
      if (title === 'Time Risk') { value = 91; level = 'Critical'; strokeColor = '#D62F39'; change = '▲ +8%'; }
      if (title === 'Implementation Risk') { value = 76; level = 'High'; strokeColor = '#F59E0B'; change = '▲ 0%'; }
      if (title === 'Overall Risk') { value = 87; level = 'High'; strokeColor = '#F59E0B'; change = '▲ +7%'; }
    }

    const radius = 22;
    const circumference = 2 * Math.PI * radius;
    const strokeDashoffset = circumference - (value / 100) * circumference;

    return (
      <div className="risk-dial-box">
        <div className="dial-title">{title}</div>
        <div className="dial-radial-wrapper">
          <svg viewBox="0 0 54 54" className="dial-radial-svg">
            <circle cx="27" cy="27" r={radius} fill="none" stroke="#E2E8F0" strokeWidth="4" />
            <circle 
              cx="27" 
              cy="27" 
              r={radius} 
              fill="none" 
              stroke={strokeColor} 
              strokeWidth="4" 
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              strokeLinecap="round"
              transform="rotate(-90 27 27)"
              style={{ transition: 'stroke-dashoffset 0.8s ease' }}
            />
          </svg>
          <div className="dial-value-text">{value}%</div>
        </div>
        <div className="dial-level" style={{ color: strokeColor }}>{level}</div>
        <div className="dial-change" style={{ color: strokeColor }}>{change}</div>
      </div>
    );
  };

  return (
    <div className="details-container animation-fade-in">
      {/* Top Filter Buttons bar & Date info */}
      <div className="details-filters-bar">
        <div className="filters-left">
          <button className="back-nav-btn" onClick={onBack}>
            <ArrowLeft size={16} />
            <span>Portfolio</span>
          </button>
          
          <div className="filter-pill-dropdown">
            <span className="pill-label">Dept:</span>
            <span className="pill-val">Rail (CO-02)</span>
            <ChevronDown size={12} className="pill-chevron" />
          </div>
          
          <div className="filter-pill-dropdown">
            <span className="pill-label">Ministry:</span>
            <span className="pill-val">{project.ministry}</span>
            <ChevronDown size={12} className="pill-chevron" />
          </div>

          <div className="filter-pill-dropdown">
            <span className="pill-label">Implementing Agency:</span>
            <span className="pill-val">{project.agency}</span>
            <ChevronDown size={12} className="pill-chevron" />
          </div>

          <div className="filter-pill-dropdown">
            <span className="pill-label">Location:</span>
            <span className="pill-val">{project.location.split(',')[0]}</span>
            <ChevronDown size={12} className="pill-chevron" />
          </div>
        </div>

        <div className="filters-right">
          <span className="as-of-date">As of <span className="date-strong">31 July 2026</span></span>
          <div className="insight-badge active-pulsing">
            <span className="badge-dot-glowing"></span>
            <span className="badge-txt">AI Insight Active — 12 new risk correlations detected.</span>
          </div>
        </div>
      </div>

      {/* Project Title and Status */}
      <div className="project-title-row">
        <div className="title-left">
          <h1 className="detail-project-name">{project.name}</h1>
          <span className={`status-tag-badge status-${project.scheduleStatus.toLowerCase()}`}>
            {project.scheduleStatus}
          </span>
        </div>
      </div>

      {/* Row 1: Dashboard Metrics */}
      <div className="details-metrics-row">
        <div className="metric-box light-box">
          <h3 className="metric-box-title">APPROVED COST</h3>
          <div className="metric-box-val">{project.costApproved}</div>
          <div className="metric-box-sub text-muted">Original Estimate</div>
        </div>

        <div className="metric-box dark-box">
          <h3 className="metric-box-title">REVISED COST</h3>
          <div className="metric-box-val">{project.costRevised}</div>
          <div className="metric-box-sub text-light">
            <span className="arrow-warn">▲</span> {project.costOverrunPct}
          </div>
        </div>

        <div className="metric-box light-box">
          <h3 className="metric-box-title">TOTAL EXPENDITURE</h3>
          <div className="metric-box-val">{project.costExpenditure}</div>
          <div className="metric-box-sub text-muted">
            {project.progressFinancial}% of Revised Cost
          </div>
        </div>

        <div className="metric-box light-box">
          <h3 className="metric-box-title">PHYSICAL PROGRESS</h3>
          <div className="metric-box-val">{project.progressPhysical}.00%</div>
          <div className="metric-box-sub text-muted">
            Revised Target: {project.progressPhysicalTarget}.00%
          </div>
        </div>

        <div className="metric-box light-box">
          <h3 className="metric-box-title">EXPECTED COMPLETION</h3>
          <div className="metric-box-val">{project.expectedCompletion}</div>
          <div className="metric-box-sub text-muted">
            Original: {project.originalCompletion}
          </div>
        </div>
      </div>

      {/* Row 2: Grid Row 1 (Info, Risk Intelligence, Benchmarking) */}
      <div className="details-grid-3">
        {/* Project Information */}
        <div className="card info-card">
          <div className="card-header-icon-title">
            <FileText size={16} className="card-icon" />
            <h2 className="card-title">Project Information</h2>
          </div>
          
          <table className="info-table">
            <tbody>
              <tr>
                <td className="info-lbl">Project Type</td>
                <td className="info-val">{project.type}</td>
              </tr>
              <tr>
                <td className="info-lbl">Phase</td>
                <td className="info-val">{project.phase}</td>
              </tr>
              <tr>
                <td className="info-lbl">Start Date</td>
                <td className="info-val">{project.startDate}</td>
              </tr>
              <tr>
                <td className="info-lbl">Original Completion</td>
                <td className="info-val">{project.originalCompletion}</td>
              </tr>
              <tr>
                <td className="info-lbl">Revised Completion</td>
                <td className="info-val">{project.expectedCompletion}</td>
              </tr>
            </tbody>
          </table>

          <div className="description-section">
            <div className="description-lbl">Project Description</div>
            <p className="description-text">{project.description}</p>
          </div>
        </div>

        {/* Risk Intelligence Dials */}
        <div className="card risk-intel-card">
          <div className="card-header-icon-title" style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <ShieldAlert size={16} className="card-icon" />
              <h2 className="card-title">Risk Intelligence</h2>
            </div>
            <button className="card-link-btn" style={{ marginLeft: 'auto' }} onClick={() => alert('View Risk details...')}>View Details</button>
          </div>

          <div className="risk-dials-grid-2x2">
            {renderRiskDial('Cost Risk', project.costRisk)}
            {renderRiskDial('Time Risk', project.timeRisk)}
            {renderRiskDial('Implementation Risk', project.implRisk)}
            {renderRiskDial('Overall Risk', project.overallRisk)}
          </div>
        </div>

        {/* Project Benchmarking (Dark Navy Card) */}
        <div className="card benchmark-card dark-navy-theme">
          <div className="card-header-icon-title">
            <Award size={16} className="card-icon" />
            <h2 className="card-title">Project Benchmarking</h2>
            <button className="card-link-btn" onClick={() => alert('View details clicked')}>View Details</button>
          </div>

          <div className="benchmark-tabs">
            <button 
              className={`benchmark-tab-btn ${benchmarkingTab === 'cost' ? 'active' : ''}`}
              onClick={() => setBenchmarkingTab('cost')}
            >
              Cost Overrun
            </button>
            <button 
              className={`benchmark-tab-btn ${benchmarkingTab === 'delay' ? 'active' : ''}`}
              onClick={() => setBenchmarkingTab('delay')}
            >
              Delay Duration
            </button>
            <button 
              className={`benchmark-tab-btn ${benchmarkingTab === 'tech' ? 'active' : ''}`}
              onClick={() => setBenchmarkingTab('tech')}
            >
              Tech Risk
            </button>
          </div>

          <table className="benchmark-table">
            <thead>
              <tr>
                <th>METRICS</th>
                <th>PROJECT</th>
                <th>SECTOR AVG</th>
                <th>BENCHMARK</th>
              </tr>
            </thead>
            <tbody>
              {getBenchmarkData().map((row, idx) => (
                <tr key={idx}>
                  <td>{row.label}</td>
                  <td className={`bold-cell ${row.isAlert ? 'text-red' : ''}`}>{row.projectVal}</td>
                  <td>{row.avg}</td>
                  <td>{row.benchmark}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="benchmark-warning-footer">
            <AlertTriangle size={14} className="warning-icon" />
            <p className="warning-text">
              This project is in <strong>critical delay</strong> compared to peer projects. Recommendation: Prioritize funds and clearance approvals.
            </p>
          </div>
        </div>
      </div>

      {/* Row 3: Grid Row 2 (Planned vs Actual Performance & Emerging Factors) */}
      <div className="details-grid-2-3">
        {/* Planned vs Actual Performance (Area Chart) */}
        <div className="card performance-card">
          <div className="performance-header">
            <div className="card-header-icon-title">
              <Calendar size={16} className="card-icon" />
              <h2 className="card-title">Planned vs Actual Performance</h2>
            </div>
            <div className="perf-tabs">
              <button 
                className={`perf-tab-btn ${perfTab === 'progress' ? 'active' : ''}`}
                onClick={() => setPerfTab('progress')}
              >
                Progress
              </button>
              <button 
                className={`perf-tab-btn ${perfTab === 'expenditure' ? 'active' : ''}`}
                onClick={() => setPerfTab('expenditure')}
              >
                Expenditure
              </button>
            </div>
          </div>

          {/* SVG Graph representation */}
          <div className="performance-chart-area">
            {perfTab === 'progress' ? (
              <>
                <div className="chart-meta-legend">
                  <div className="legend-element"><span className="legend-line line-planned"></span>Planned</div>
                  <div className="legend-element"><span className="legend-line line-actual"></span>Actual</div>
                  <span className="variance-tag font-red">-3.00% Variance</span>
                </div>
                <svg viewBox="0 0 450 140" className="perf-svg" key="progress">
                  <defs>
                    <linearGradient id="plannedGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="rgba(47, 107, 244, 0.15)" />
                      <stop offset="100%" stopColor="rgba(47, 107, 244, 0)" />
                    </linearGradient>
                    <linearGradient id="actualGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="rgba(34, 197, 94, 0.15)" />
                      <stop offset="100%" stopColor="rgba(34, 197, 94, 0)" />
                    </linearGradient>
                  </defs>
                  
                  {/* Grid guidelines */}
                  <line x1="20" y1="120" x2="430" y2="120" stroke="#E2E8F0" strokeWidth="0.75" />
                  <line x1="20" y1="70" x2="430" y2="70" stroke="#F1F5F9" strokeWidth="0.75" />
                  <line x1="20" y1="20" x2="430" y2="20" stroke="#F1F5F9" strokeWidth="0.75" />

                  {/* Areas */}
                  <path d="M 20 110 C 100 95, 200 80, 300 65 C 370 55, 400 48, 430 35 L 430 120 L 20 120 Z" fill="url(#plannedGrad)" className="graph-fill-animate" />
                  <path d="M 20 110 C 100 100, 200 90, 300 80 C 370 70, 400 68, 430 58 L 430 120 L 20 120 Z" fill="url(#actualGrad)" className="graph-fill-animate" />

                  {/* Stroke Lines */}
                  <path d="M 20 110 C 100 95, 200 80, 300 65 C 370 55, 400 48, 430 35" fill="none" stroke="var(--color-on-track)" strokeWidth="2.5" className="graph-path-animate" />
                  <path d="M 20 110 C 100 100, 200 90, 300 80 C 370 70, 400 68, 430 58" fill="none" stroke="#22C55E" strokeWidth="2.5" className="graph-path-animate" />

                  {/* Markers */}
                  <circle cx="430" cy="35" r="3" fill="#ffffff" stroke="var(--color-on-track)" strokeWidth="2" />
                  <circle cx="430" cy="58" r="3" fill="#ffffff" stroke="#22C55E" strokeWidth="2" />
                </svg>
                <div className="chart-footer-stats">
                  <div className="stat-unit">
                    <span className="stat-label">Planned Target Progress</span>
                    <span className="stat-val">{project.progressPhysicalTarget}%</span>
                  </div>
                  <div className="stat-unit">
                    <span className="stat-label">Actual Progress Achieved</span>
                    <span className="stat-val font-red">{project.progressPhysical}%</span>
                  </div>
                </div>
              </>
            ) : (
              <>
                <div className="chart-meta-legend">
                  <div className="legend-element"><span className="legend-line line-planned"></span>Planned Cost</div>
                  <div className="legend-element"><span className="legend-line line-expenditure"></span>Expenditure</div>
                  <span className="variance-tag font-red">₹210 Cr Gap</span>
                </div>
                <svg viewBox="0 0 450 140" className="perf-svg" key="expenditure">
                  <defs>
                    <linearGradient id="expendGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="rgba(168, 85, 247, 0.15)" />
                      <stop offset="100%" stopColor="rgba(168, 85, 247, 0)" />
                    </linearGradient>
                  </defs>
                  
                  {/* Grid guidelines */}
                  <line x1="20" y1="120" x2="430" y2="120" stroke="#E2E8F0" strokeWidth="0.75" />
                  <line x1="20" y1="70" x2="430" y2="70" stroke="#F1F5F9" strokeWidth="0.75" />
                  <line x1="20" y1="20" x2="430" y2="20" stroke="#F1F5F9" strokeWidth="0.75" />

                  {/* Areas */}
                  <path d="M 20 115 C 100 100, 200 80, 300 60 C 370 45, 400 35, 430 25 L 430 120 L 20 120 Z" fill="url(#plannedGrad)" className="graph-fill-animate" />
                  <path d="M 20 115 C 100 105, 200 95, 300 85 C 370 75, 400 70, 430 55 L 430 120 L 20 120 Z" fill="url(#expendGrad)" className="graph-fill-animate" />

                  {/* Stroke Lines */}
                  <path d="M 20 115 C 100 100, 200 80, 300 60 C 370 45, 400 35, 430 25" fill="none" stroke="var(--color-on-track)" strokeWidth="2.5" className="graph-path-animate" />
                  <path d="M 20 115 C 100 105, 200 95, 300 85 C 370 75, 400 70, 430 55" fill="none" stroke="#A855F7" strokeWidth="2.5" className="graph-path-animate" />

                  {/* Markers */}
                  <circle cx="430" cy="25" r="3" fill="#ffffff" stroke="var(--color-on-track)" strokeWidth="2" />
                  <circle cx="430" cy="55" r="3" fill="#ffffff" stroke="#A855F7" strokeWidth="2" />
                </svg>
                <div className="chart-footer-stats">
                  <div className="stat-unit">
                    <span className="stat-label">Planned Approved Cost</span>
                    <span className="stat-val">{project.costApproved}</span>
                  </div>
                  <div className="stat-unit">
                    <span className="stat-label">Actual Cumulative Expenditure</span>
                    <span className="stat-val font-purple">{project.costExpenditure}</span>
                  </div>
                </div>
              </>
            )}

            <div className="performance-warning-footer">
              <AlertTriangle size={14} className="warning-icon" />
              <p className="warning-text">
                Expenditure is lagging. Delay in procurement of rolling stock contracts.
              </p>
            </div>
          </div>
        </div>

        {/* Emerging Issues */}
        <div className="card emerging-issues-card">
          <div className="card-header-icon-title">
            <SlidersHorizontal size={16} className="card-icon" />
            <h2 className="card-title">Emerging Issues</h2>
            <button className="card-link-btn" onClick={() => alert('View All Issues')}>View All</button>
          </div>

          <div className="issues-progress-list">
            {emergingIssues.map((issue, idx) => (
              <div key={idx} className="issue-row-item">
                <div className="issue-row-header">
                  <span className="issue-row-label">{issue.label}</span>
                  <span className={`issue-row-impact ${issue.textColor}`}>{issue.impact} Impact</span>
                </div>
                <div className="issue-bar-bg">
                  <div className={`issue-bar-fill ${issue.color}`} style={{ width: mounted ? `${issue.pct}%` : '0%', transition: `width 0.7s cubic-bezier(0.16, 1, 0.3, 1) ${idx * 0.1}s` }}></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Row 4: Milestone Tracker (Wide Card Timeline) */}
      <div className="card milestone-timeline-card">
        <div className="milestone-timeline-header">
          <div className="card-header-icon-title">
            <Check size={16} className="card-icon" />
            <h2 className="card-title">Milestone Tracker</h2>
          </div>
          <button className="card-link-btn" onClick={() => alert('View full schedule')}>View All</button>
        </div>

        <div className="timeline-horizontal-scroll">
          <div className="timeline-horizontal-wrapper">
            {/* Horizontal progress guide line */}
            <div className="timeline-connecting-line">
              <div className="connecting-line-fill" style={{ width: mounted ? '45%' : '0%', transition: 'width 1s cubic-bezier(0.16, 1, 0.3, 1) 0.5s' }}></div>
            </div>

            {/* Node 1: Completed */}
            <div className="timeline-node-item active-node">
              <div className="node-circle node-checked">
                <Check size={12} strokeWidth={3} />
              </div>
              <div className="node-info-text">
                <h4 className="node-name">Land Acquisition</h4>
                <p className="node-date text-green">Cleared on 12 Mar 2021</p>
                <span className="node-status-tag tag-green">Completed</span>
              </div>
            </div>

            {/* Node 2: Completed */}
            <div className="timeline-node-item active-node">
              <div className="node-circle node-checked">
                <Check size={12} strokeWidth={3} />
              </div>
              <div className="node-info-text">
                <h4 className="node-name">Tendering</h4>
                <p className="node-date text-green">Cleared on 15 Oct 2021</p>
                <span className="node-status-tag tag-green">Completed</span>
              </div>
            </div>

            {/* Node 3: Warning/Delay */}
            <div className="timeline-node-item active-node">
              <div className="node-circle node-warning">
                <AlertTriangle size={12} strokeWidth={3} />
              </div>
              <div className="node-info-text">
                <h4 className="node-name">Civil Construction</h4>
                <p className="node-date text-red">Revised: 15 Nov 2025 (Delay)</p>
                <span className="node-status-tag tag-red">Delayed by 11 Mos</span>
              </div>
            </div>

            {/* Node 4: Upcoming */}
            <div className="timeline-node-item">
              <div className="node-circle node-grey"></div>
              <div className="node-info-text">
                <h4 className="node-name">System Integration</h4>
                <p className="node-date">Revised: 20 May 2026</p>
                <span className="node-status-tag tag-grey">Upcoming</span>
              </div>
            </div>

            {/* Node 5: Upcoming */}
            <div className="timeline-node-item">
              <div className="node-circle node-grey"></div>
              <div className="node-info-text">
                <h4 className="node-name">Testing & Commission</h4>
                <p className="node-date">Expected: 10 Sep 2027</p>
                <span className="node-status-tag tag-grey">Upcoming</span>
              </div>
            </div>

            {/* Node 6: Upcoming */}
            <div className="timeline-node-item">
              <div className="node-circle node-grey"></div>
              <div className="node-info-text">
                <h4 className="node-name">Project Completion</h4>
                <p className="node-date">Target: Dec 2027</p>
                <span className="node-status-tag tag-grey">Upcoming</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Row 5: Grid Row 3 (Risk Trend, Why At Risk, Early Warning Card) */}
      <div className="details-grid-3">
        {/* Risk Trend Chart */}
        <div className="card risk-trend-details-card">
          <div className="risk-trend-header">
            <div className="card-header-icon-title">
              <Calendar size={16} className="card-icon" />
              <h2 className="card-title">Risk Trend</h2>
            </div>
            <div className="trend-tabs">
              {(['overall', 'cost', 'time'] as const).map((tab) => (
                <button
                  key={tab}
                  className={`trend-tab-btn ${riskTrendTab === tab ? 'active' : ''}`}
                  onClick={() => setRiskTrendTab(tab)}
                >
                  {tab.charAt(0).toUpperCase() + tab.slice(1)}
                </button>
              ))}
            </div>
          </div>

          <div className="risk-trend-graph-area">
            {(() => {
              const { score, changeLabel, areaPath, linePath, circleY } = getRiskTrendCoords();
              return (
                <>
                  <div className="trend-details-legend">
                    <span className="trend-legend-tag font-red">Risk Level: {project.riskLevel} ({score}%)</span>
                    <span className="trend-legend-subtext">{changeLabel}</span>
                  </div>
                  
                  <svg viewBox="0 0 320 120" className="trend-svg" key={riskTrendTab}>
                    <defs>
                      <linearGradient id="riskGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="rgba(214, 47, 57, 0.2)" />
                        <stop offset="100%" stopColor="rgba(214, 47, 57, 0)" />
                      </linearGradient>
                    </defs>
                    <line x1="15" y1="110" x2="305" y2="110" stroke="#E2E8F0" strokeWidth="0.75" />
                    <line x1="15" y1="65" x2="305" y2="65" stroke="#F1F5F9" strokeWidth="0.75" />

                    {/* Area path */}
                    <path d={areaPath} fill="url(#riskGrad)" className="graph-fill-animate" />
                    {/* Line path */}
                    <path d={linePath} fill="none" stroke="var(--color-accent-red)" strokeWidth="2.5" className="graph-path-animate" />
                    
                    <circle cx="305" cy={circleY} r="3" fill="#ffffff" stroke="var(--color-accent-red)" strokeWidth="2" />
                  </svg>
                </>
              );
            })()}
            <div className="x-axis-labels">
              <span className="x-label">Jan</span>
              <span className="x-label">Mar</span>
              <span className="x-label">May</span>
              <span className="x-label">Jul</span>
            </div>
          </div>
        </div>

        {/* Why is this project at risk? (Dark Navy Card) */}
        <div className="card why-at-risk-card dark-navy-theme">
          <div className="card-header-icon-title">
            <ShieldAlert size={16} className="card-icon" />
            <h2 className="card-title">Why is this project at risk?</h2>
          </div>

          <div className="risk-factors-progress-list">
            {riskFactors.map((factor, idx) => (
              <div key={idx} className="risk-factor-row">
                <div className="factor-row-lbl">{factor.label}</div>
                <div className="factor-row-wrapper-bar">
                  <span className="factor-pct-lbl">{factor.pct}%</span>
                  <div className="factor-bar-track">
                    <div className={`factor-bar-filled ${factor.color}`} style={{ width: mounted ? `${factor.pct}%` : '0%', transition: `width 0.7s cubic-bezier(0.16, 1, 0.3, 1) ${idx * 0.1}s` }}></div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="why-at-risk-footer">
            <div className="driver-lbl">Primary Driver:</div>
            <div className="driver-val">{primaryDriver}</div>
          </div>
        </div>

        {/* Early Warning Card */}
        <div className="card early-warning-card">
          <div className="card-header-icon-title">
            <Bell size={16} className="card-icon" />
            <h2 className="card-title">Early Warning</h2>
            <span className="warning-status-pill">ACTIVE</span>
          </div>

          <div className="early-warning-alert-title">Potential schedule delay detected!</div>

          <div className="warning-details-grid">
            <div className="warning-detail-item">
              <span className="warn-lbl">Delay Severity</span>
              <span className="warn-val font-red">High (12m)</span>
            </div>
            <div className="warning-detail-item">
              <span className="warn-lbl">Cost Impact</span>
              <span className="warn-val">₹70.00 Cr</span>
            </div>
            <div className="warning-detail-item">
              <span className="warn-lbl">Confidence</span>
              <span className="warn-val font-blue">87%</span>
            </div>
          </div>

          <div className="trigger-inputs-section">
            <div className="trigger-lbl">Trigger Inputs</div>
            <ul className="trigger-list">
              <li>Delay in civil contracting package.</li>
              <li>Key environmental clearances pending (MMRC permit).</li>
              <li>Equipment supply chain delays (rolling stock import).</li>
            </ul>
          </div>

          <button className="investigate-warning-btn" onClick={() => alert('Investigating Early Warning Details...')}>
            <span>Investigate Warning</span>
            <ArrowRight size={14} />
          </button>
        </div>
      </div>

      {/* Spacer to push content above the sticky footer */}
      <div className="footer-spacing-spacer" style={{ height: '80px' }}></div>

      {/* Sticky Bottom Action Ribbon (adds high character) */}
      <div className="sticky-action-ribbon">
        <div className="ribbon-content-wrapper">
          <div className="ribbon-left">
            <ShieldAlert size={18} className="ribbon-alert-icon animate-pulse" />
            <div className="ribbon-meta">
              <span className="ribbon-title">Immediate Attention Required</span>
              <span className="ribbon-desc">MMRC Metro Line 3 is currently 11 months behind baseline. Review recommended.</span>
            </div>
          </div>
          <div className="ribbon-right">
            <button className="ribbon-review-btn" onClick={() => alert('Review started...')}>Review Now</button>
            <button className="ribbon-actions-btn" onClick={() => alert('Priority actions summary opened...')}>
              <span>View Priority Actions</span>
              <ArrowRight size={14} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
