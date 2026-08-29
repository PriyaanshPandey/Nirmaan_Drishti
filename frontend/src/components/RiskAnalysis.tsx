import React, { useState, useEffect } from 'react';
import { Download, Search, AlertTriangle, Clock, Check, ShieldAlert } from 'lucide-react';
import './RiskAnalysis.css';
import { AnimatedCounter } from './AnimatedCounter';

interface RiskProject {
  id: string;
  name: string;
  agency: string;
  state: string;
  sector: string; // Added sector property
  costRisk: number;
  timeRisk: number;
  earlyWarning: number;
  overallScore: number;
  riskLevel: 'High' | 'Medium' | 'Low';
  status: 'Active' | 'On Hold';
  detailsId: string; // ID to link to ProjectDetails
}

interface RiskAnalysisProps {
  onSelectProject: (projectId: string) => void;
  onNavigateTab: (tab: string) => void;
}

export const RiskAnalysis: React.FC<RiskAnalysisProps> = ({ onSelectProject, onNavigateTab }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedAgency, setSelectedAgency] = useState('All');
  const [selectedSector, setSelectedSector] = useState('All');
  const [selectedState, setSelectedState] = useState('All');
  const [selectedRisk, setSelectedRisk] = useState('All');
  const [hoveredSegment, setHoveredSegment] = useState<'cost' | 'time' | 'warning' | 'low' | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 80);
    return () => clearTimeout(t);
  }, []);

  // Top Metrics Data
  const metrics = [
    {
      id: 'cost',
      title: 'Cost Overrun',
      count: 128,
      status: 'High Risk',
      statusClass: 'status-tag-red',
      desc: 'Total Projects (742): 17.2%',
      icon: <ShieldAlert size={16} color="var(--color-accent-red)" />,
      themeClass: 'light-theme-card'
    },
    {
      id: 'time',
      title: 'Time Overrun',
      count: 156,
      status: 'High Risk',
      statusClass: 'status-tag-red',
      desc: 'Total Projects (742): 21.0%',
      icon: <Clock size={16} color="#D97706" />,
      themeClass: 'light-theme-card'
    },
    {
      id: 'warning',
      title: 'Early Warning',
      count: 214,
      status: 'Medium to High',
      statusClass: 'status-tag-orange',
      desc: 'Total Projects (742): 28.8%',
      icon: <AlertTriangle size={16} color="#D97706" />,
      themeClass: 'light-theme-card'
    },
    {
      id: 'low',
      title: 'Low Risk',
      count: 244,
      status: 'Low Risk',
      statusClass: 'status-tag-green',
      desc: 'Total Projects (742): 32.8%',
      icon: <Check size={16} color="#22C55E" />,
      themeClass: 'dark-theme-card'
    }
  ];

  // Table Data representing the exact mockup rows
  const riskProjects: RiskProject[] = [
    {
      id: 'PRJ-92019',
      name: 'Mumbai Coastal Road Project',
      agency: 'MCGM',
      state: 'Maharashtra',
      sector: 'Roads',
      costRisk: 82,
      timeRisk: 88,
      earlyWarning: 91,
      overallScore: 82,
      riskLevel: 'High',
      status: 'Active',
      detailsId: 'mumbai-metro-3' // Links to Metro Details as representative
    },
    {
      id: 'PRJ-96257',
      name: 'Delhi-Meerut RRTS Corridor',
      agency: 'NCRTC',
      state: 'Uttar Pradesh',
      sector: 'Metro Rail',
      costRisk: 76,
      timeRisk: 92,
      earlyWarning: 89,
      overallScore: 85,
      riskLevel: 'High',
      status: 'Active',
      detailsId: 'mumbai-metro-3'
    },
    {
      id: 'PRJ-92121',
      name: 'Z-Morh Tunnel Project',
      agency: 'NHIDCL',
      state: 'Jammu & Kashmir',
      sector: 'Tunnel',
      costRisk: 85,
      timeRisk: 72,
      earlyWarning: 93,
      overallScore: 90,
      riskLevel: 'High',
      status: 'Active',
      detailsId: 'mumbai-metro-3'
    },
    {
      id: 'PRJ-18012',
      name: 'Kaleshwaram LIS Irrigation',
      agency: 'I&CAD',
      state: 'Telangana',
      sector: 'Irrigation',
      costRisk: 77,
      timeRisk: 84,
      earlyWarning: 87,
      overallScore: 84,
      riskLevel: 'High',
      status: 'Active',
      detailsId: 'mumbai-metro-3'
    },
    {
      id: 'PRJ-93563',
      name: 'Bangalore Metro Phase 2',
      agency: 'BMRCL',
      state: 'Karnataka',
      sector: 'Metro Rail',
      costRisk: 80,
      timeRisk: 89,
      earlyWarning: 76,
      overallScore: 80,
      riskLevel: 'High',
      status: 'Active',
      detailsId: 'mumbai-metro-3'
    },
    {
      id: 'PRJ-90378',
      name: 'Ahmedabad Bullet Train Station',
      agency: 'NHSRCL',
      state: 'Gujarat',
      sector: 'High Speed Rail',
      costRisk: 67,
      timeRisk: 74,
      earlyWarning: 72,
      overallScore: 70,
      riskLevel: 'Medium',
      status: 'Active',
      detailsId: 'mumbai-ahmedabad-bullet' // Links to High Speed Rail details
    }
  ];

  // Filtering lists
  const agencies = ['All', 'MCGM', 'NCRTC', 'NHIDCL', 'I&CAD', 'BMRCL', 'NHSRCL'];
  const sectors = ['All', 'Metro Rail', 'High Speed Rail', 'Roads', 'Tunnel', 'Irrigation'];
  const states = ['All', 'Maharashtra', 'Uttar Pradesh', 'Jammu & Kashmir', 'Telangana', 'Karnataka', 'Gujarat'];
  const risks = ['All', 'High', 'Medium', 'Low'];

  // Filter logic
  const filteredProjects = riskProjects.filter((p) => {
    const matchesSearch = 
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.agency.toLowerCase().includes(searchQuery.toLowerCase());
      
    const matchesAgency = selectedAgency === 'All' || p.agency === selectedAgency;
    const matchesSector = selectedSector === 'All' || p.sector === selectedSector;
    const matchesState = selectedState === 'All' || p.state === selectedState;
    const matchesRisk = selectedRisk === 'All' || p.riskLevel === selectedRisk;

    return matchesSearch && matchesAgency && matchesSector && matchesState && matchesRisk;
  });

  const getRiskScoreCircle = (score: number) => {
    let colorClass = 'score-red';
    if (score < 60) colorClass = 'score-green';
    else if (score < 80) colorClass = 'score-orange';

    return <span className={`overall-score-circle ${colorClass}`}>{score}</span>;
  };

  const getProgressFill = (pct: number) => {
    let color = 'var(--color-accent-red)';
    if (pct < 60) color = '#22C55E';
    else if (pct < 80) color = '#F59E0B';

    return (
      <div className="risk-progress-bar-wrapper">
        <div className="risk-progress-bar-fill" style={{ width: mounted ? `${pct}%` : '0%', backgroundColor: color, transition: 'width 0.7s cubic-bezier(0.16, 1, 0.3, 1)' }}></div>
      </div>
    );
  };

  return (
    <div className="risk-container animation-fade-in">
      {/* Top Title & CTA block */}
      <div className="risk-page-header">
        <div>
          <h1 className="risk-page-title">Risk Analysis</h1>
          <p className="risk-page-subtitle">AI powered risk insights across all infrastructure projects.</p>
        </div>
        <button className="export-report-btn" onClick={() => alert('Exporting Risk Report PDF...')}>
          <Download size={14} />
          <span>Export Report</span>
        </button>
      </div>

      {/* Row 1: Metrics */}
      <div className="risk-metrics-row-4">
        {metrics.map((m) => (
          <div key={m.id} className={`risk-metric-box ${m.themeClass}`}>
            <div className="metric-box-top">
              <span className="metric-box-title">{m.title}</span>
              <div className="metric-icon-circle">{m.icon}</div>
            </div>
            <div className="metric-box-body">
              <span className="metric-count"><AnimatedCounter value={m.count} /></span>
              <span className="metric-projects-lbl">Projects</span>
            </div>
            <div className="metric-box-footer">
              <span className={`metric-status-badge ${m.statusClass}`}>{m.status}</span>
              <span className="metric-percentage">{m.desc.split(': ')[1]}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Row 2: Charts Split */}
      <div className="risk-charts-grid-3">
        {/* Risk Distribution Donut */}
        <div className="card risk-chart-card">
          <div className="card-header-simple">
            <h2 className="card-title">Risk Distribution</h2>
            <p className="card-subtitle">Distribution by risk category</p>
          </div>

          <div className="distribution-chart-wrapper">
            <svg viewBox="0 0 100 100" className="dist-donut-svg">
              {/* Circular segments background */}
              <circle cx="50" cy="50" r="35" fill="none" stroke="#F1F5F9" strokeWidth="8" />
              {/* Low Risk segment (32.8%) */}
              <circle 
                cx="50" cy="50" r="35" fill="none" stroke="#22C55E" 
                strokeWidth={hoveredSegment === 'low' ? 11 : 8} 
                strokeDasharray="72 220" strokeDashoffset="0" 
                transform="rotate(-90 50 50)" 
                style={{ cursor: 'pointer', transition: 'stroke-width 0.2s ease, opacity 0.2s ease', opacity: hoveredSegment && hoveredSegment !== 'low' ? 0.45 : 1 }}
                onMouseEnter={() => setHoveredSegment('low')}
                onMouseLeave={() => setHoveredSegment(null)}
              />
              {/* Early Warning segment (28.8%) */}
              <circle 
                cx="50" cy="50" r="35" fill="none" stroke="#EAB308" 
                strokeWidth={hoveredSegment === 'warning' ? 11 : 8} 
                strokeDasharray="63 220" strokeDashoffset="-72" 
                transform="rotate(-90 50 50)" 
                style={{ cursor: 'pointer', transition: 'stroke-width 0.2s ease, opacity 0.2s ease', opacity: hoveredSegment && hoveredSegment !== 'warning' ? 0.45 : 1 }}
                onMouseEnter={() => setHoveredSegment('warning')}
                onMouseLeave={() => setHoveredSegment(null)}
              />
              {/* Time Overrun (21.0%) */}
              <circle 
                cx="50" cy="50" r="35" fill="none" stroke="#EA580C" 
                strokeWidth={hoveredSegment === 'time' ? 11 : 8} 
                strokeDasharray="46 220" strokeDashoffset="-135" 
                transform="rotate(-90 50 50)" 
                style={{ cursor: 'pointer', transition: 'stroke-width 0.2s ease, opacity 0.2s ease', opacity: hoveredSegment && hoveredSegment !== 'time' ? 0.45 : 1 }}
                onMouseEnter={() => setHoveredSegment('time')}
                onMouseLeave={() => setHoveredSegment(null)}
              />
              {/* Cost Overrun (17.2%) */}
              <circle 
                cx="50" cy="50" r="35" fill="none" stroke="#B91C1C" 
                strokeWidth={hoveredSegment === 'cost' ? 11 : 8} 
                strokeDasharray="39 220" strokeDashoffset="-181" 
                transform="rotate(-90 50 50)" 
                style={{ cursor: 'pointer', transition: 'stroke-width 0.2s ease, opacity 0.2s ease', opacity: hoveredSegment && hoveredSegment !== 'cost' ? 0.45 : 1 }}
                onMouseEnter={() => setHoveredSegment('cost')}
                onMouseLeave={() => setHoveredSegment(null)}
              />
            </svg>

            {/* Centered center text overlay */}
            <div className="dist-chart-center-text">
              {hoveredSegment === null ? (
                <>
                  <span className="center-num"><AnimatedCounter value={742} /></span>
                  <span className="center-lbl">Total Risks</span>
                </>
              ) : hoveredSegment === 'cost' ? (
                <>
                  <span className="center-hover-lbl" style={{ color: '#B91C1C' }}>Cost Overrun</span>
                  <span className="center-hover-num"><AnimatedCounter value={128} /></span>
                  <span className="center-hover-pct">17.2%</span>
                </>
              ) : hoveredSegment === 'time' ? (
                <>
                  <span className="center-hover-lbl" style={{ color: '#EA580C' }}>Time Overrun</span>
                  <span className="center-hover-num"><AnimatedCounter value={156} /></span>
                  <span className="center-hover-pct">21.0%</span>
                </>
              ) : hoveredSegment === 'warning' ? (
                <>
                  <span className="center-hover-lbl" style={{ color: '#EAB308' }}>Early Warning</span>
                  <span className="center-hover-num"><AnimatedCounter value={214} /></span>
                  <span className="center-hover-pct">28.8%</span>
                </>
              ) : (
                <>
                  <span className="center-hover-lbl" style={{ color: '#22C55E' }}>Low Risk</span>
                  <span className="center-hover-num"><AnimatedCounter value={244} /></span>
                  <span className="center-hover-pct">32.9%</span>
                </>
              )}
            </div>
          </div>

          <div className="dist-legend-rows">
            <div 
              className={`dist-legend-item ${hoveredSegment === 'cost' ? 'active-legend' : ''}`}
              onMouseEnter={() => setHoveredSegment('cost')}
              onMouseLeave={() => setHoveredSegment(null)}
              style={{ cursor: 'pointer', transition: 'opacity 0.2s ease', opacity: hoveredSegment && hoveredSegment !== 'cost' ? 0.5 : 1 }}
            >
              <span className="legend-dot bg-red"></span>Cost Overrun (128)
            </div>
            <div 
              className={`dist-legend-item ${hoveredSegment === 'time' ? 'active-legend' : ''}`}
              onMouseEnter={() => setHoveredSegment('time')}
              onMouseLeave={() => setHoveredSegment(null)}
              style={{ cursor: 'pointer', transition: 'opacity 0.2s ease', opacity: hoveredSegment && hoveredSegment !== 'time' ? 0.5 : 1 }}
            >
              <span className="legend-dot bg-orange"></span>Time Overrun (156)
            </div>
            <div 
              className={`dist-legend-item ${hoveredSegment === 'warning' ? 'active-legend' : ''}`}
              onMouseEnter={() => setHoveredSegment('warning')}
              onMouseLeave={() => setHoveredSegment(null)}
              style={{ cursor: 'pointer', transition: 'opacity 0.2s ease', opacity: hoveredSegment && hoveredSegment !== 'warning' ? 0.5 : 1 }}
            >
              <span className="legend-dot bg-yellow"></span>Early Warning (214)
            </div>
            <div 
              className={`dist-legend-item ${hoveredSegment === 'low' ? 'active-legend' : ''}`}
              onMouseEnter={() => setHoveredSegment('low')}
              onMouseLeave={() => setHoveredSegment(null)}
              style={{ cursor: 'pointer', transition: 'opacity 0.2s ease', opacity: hoveredSegment && hoveredSegment !== 'low' ? 0.5 : 1 }}
            >
              <span className="legend-dot bg-green"></span>Low Risk (244)
            </div>
          </div>
        </div>

        {/* Risk Trend Multi-line Graph */}
        <div className="card risk-chart-card wide-chart">
          <div className="card-header-simple">
            <h2 className="card-title">Risk Trend <span className="title-sub">(Cost & Schedule)</span></h2>
          </div>

          <div className="risk-trend-svg-area">
            <svg viewBox="0 0 450 140" className="risk-trend-svg">
              {/* Grid guidelines */}
              <line x1="20" y1="120" x2="430" y2="120" stroke="#E2E8F0" strokeWidth="0.75" />
              <line x1="20" y1="70" x2="430" y2="70" stroke="#F1F5F9" strokeWidth="0.75" />
              <line x1="20" y1="20" x2="430" y2="20" stroke="#F1F5F9" strokeWidth="0.75" />

              {/* Line 1: Cost Overrun (Red) */}
              <path d="M 20 100 C 100 95, 200 90, 300 88 C 370 86, 400 85, 430 84" fill="none" stroke="var(--color-accent-red)" strokeWidth="2.5" className="graph-path-animate" />
              <circle cx="430" cy="84" r="3" fill="#ffffff" stroke="var(--color-accent-red)" strokeWidth="1.5" />

              {/* Line 2: Time Overrun (Orange) */}
              <path d="M 20 80 C 100 72, 200 68, 300 64 C 370 60, 400 58, 430 55" fill="none" stroke="#F59E0B" strokeWidth="2.5" className="graph-path-animate" />
              <circle cx="430" cy="55" r="3" fill="#ffffff" stroke="#F59E0B" strokeWidth="1.5" />

              {/* Line 3: Early Warning (Yellow) */}
              <path d="M 20 50 C 100 45, 200 42, 300 38 C 370 34, 400 32, 430 30" fill="none" stroke="#FBBF24" strokeWidth="2.5" className="graph-path-animate" />
              <circle cx="430" cy="30" r="3" fill="#ffffff" stroke="#FBBF24" strokeWidth="1.5" />
            </svg>
            <div className="x-axis-labels">
              <span className="x-label">Jan '26</span>
              <span className="x-label">Mar '26</span>
              <span className="x-label">May '26</span>
              <span className="x-label">Jul '26</span>
            </div>

            <div className="risk-trend-legend">
              <div className="trend-lbl-item"><span className="legend-line bg-red"></span>Cost Overrun</div>
              <div className="trend-lbl-item"><span className="legend-line bg-orange"></span>Time Overrun</div>
              <div className="trend-lbl-item"><span className="legend-line bg-yellow"></span>Early Warning</div>
            </div>
          </div>
        </div>

        {/* Projects By Risk Level Bars */}
        <div className="card risk-chart-card">
          <div className="card-header-simple">
            <h2 className="card-title">Projects By Risk Level</h2>
          </div>

          <div className="risk-level-bars-stack">
            <div className="level-bar-item">
              <div className="level-bar-info">
                <span className="level-lbl">High Risk</span>
                <span className="level-pct">38.2%</span>
              </div>
              <div className="level-track"><div className="level-fill bg-red" style={{ width: '38.2%' }}></div></div>
            </div>

            <div className="level-bar-item">
              <div className="level-bar-info">
                <span className="level-lbl">Medium to High</span>
                <span className="level-pct">28.8%</span>
              </div>
              <div className="level-track"><div className="level-fill bg-orange" style={{ width: '28.8%' }}></div></div>
            </div>

            <div className="level-bar-item">
              <div className="level-bar-info">
                <span className="level-lbl">Low Risk</span>
                <span className="level-pct">32.8%</span>
              </div>
              <div className="level-track"><div className="level-fill bg-green" style={{ width: '32.8%' }}></div></div>
            </div>
          </div>

          <div className="risk-level-total-footer">
            <div className="total-desc-lbl">Total Projects</div>
            <div className="total-count-val">742</div>
          </div>
        </div>
      </div>

      {/* Row 3: Filter & Search Bar */}
      <div className="risk-filter-bar-card">
        <div className="risk-dropdown-selectors">
          <select value={selectedAgency} onChange={(e) => setSelectedAgency(e.target.value)} className="risk-select">
            <option value="All">All Agencies</option>
            {agencies.filter(a => a !== 'All').map(a => <option key={a} value={a}>{a}</option>)}
          </select>

          <select value={selectedSector} onChange={(e) => setSelectedSector(e.target.value)} className="risk-select">
            <option value="All">All Sectors</option>
            {sectors.filter(s => s !== 'All').map(s => <option key={s} value={s}>{s}</option>)}
          </select>

          <select value={selectedState} onChange={(e) => setSelectedState(e.target.value)} className="risk-select">
            <option value="All">All States</option>
            {states.filter(s => s !== 'All').map(s => <option key={s} value={s}>{s}</option>)}
          </select>

          <select value={selectedRisk} onChange={(e) => setSelectedRisk(e.target.value)} className="risk-select">
            <option value="All">All Risk Levels</option>
            {risks.filter(r => r !== 'All').map(r => <option key={r} value={r}>{r} Risk</option>)}
          </select>
        </div>

        <div className="risk-search-box-wrapper">
          <Search size={14} className="risk-search-icon" />
          <input 
            type="text" 
            placeholder="Search project name, ID, agency..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="risk-search-input"
          />
        </div>
      </div>

      {/* Row 4: Risk Table */}
      <div className="table-card">
        <div className="portfolio-table-wrapper">
          <table className="portfolio-table">
            <thead>
              <tr>
                <th style={{ width: '10%' }}>PROJECT ID</th>
                <th style={{ width: '25%' }}>PROJECT NAME</th>
                <th style={{ width: '10%' }}>AGENCY</th>
                <th style={{ width: '12%' }}>STATE</th>
                <th style={{ width: '10%' }}>COST RISK</th>
                <th style={{ width: '10%' }}>TIME RISK</th>
                <th style={{ width: '10%' }}>EARLY WARNING</th>
                <th style={{ width: '5%', textAlign: 'center' }}>OVERALL</th>
                <th style={{ width: '8%' }}>RISK LEVEL</th>
                <th style={{ width: '8%' }}>STATUS</th>
                <th style={{ width: '12%', textAlign: 'right' }}>ACTION</th>
              </tr>
            </thead>
            <tbody>
              {filteredProjects.length > 0 ? (
                filteredProjects.map((p) => (
                  <tr key={p.id} className="portfolio-row">
                    <td className="bold-cell-id" style={{ color: 'var(--color-on-track)', fontWeight: 800 }}>{p.id}</td>
                    <td className="project-name-primary" style={{ fontWeight: 800 }}>{p.name}</td>
                    <td className="td-ministry-text">{p.agency}</td>
                    <td className="td-ministry-text">{p.state}</td>
                    <td>
                      <div className="risk-pct-cell">
                        <span className="risk-pct-num">{p.costRisk}%</span>
                        {getProgressFill(p.costRisk)}
                      </div>
                    </td>
                    <td>
                      <div className="risk-pct-cell">
                        <span className="risk-pct-num">{p.timeRisk}%</span>
                        {getProgressFill(p.timeRisk)}
                      </div>
                    </td>
                    <td>
                      <div className="risk-pct-cell">
                        <span className="risk-pct-num">{p.earlyWarning}%</span>
                        {getProgressFill(p.earlyWarning)}
                      </div>
                    </td>
                    <td style={{ textAlign: 'center', verticalAlign: 'middle' }}>
                      {getRiskScoreCircle(p.overallScore)}
                    </td>
                    <td className={`font-weight-bold ${p.riskLevel === 'High' ? 'font-red' : 'font-orange'}`} style={{ fontWeight: 800 }}>
                      {p.riskLevel}
                    </td>
                    <td className="font-green" style={{ color: '#22C55E', fontWeight: 850 }}>
                      {p.status}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <button 
                        className="review-btn" 
                        onClick={() => {
                          onSelectProject(p.detailsId);
                          onNavigateTab('projects');
                        }}
                      >
                        View Project
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={11} className="table-empty-state">
                    No infrastructure project records match the active filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
