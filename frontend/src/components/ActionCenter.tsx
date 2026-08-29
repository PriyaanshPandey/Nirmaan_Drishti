import React, { useState, useEffect } from 'react';
import { Download, Search, ShieldAlert, ArrowRight, AlertTriangle, Link, Clock } from 'lucide-react';
import './ActionCenter.css';
import { AnimatedCounter } from './AnimatedCounter';

interface ActionItem {
  project: string;
  projectId: string;
  ministry: string;
  riskEvent: string;
  severity: 'Critical' | 'High' | 'Medium';
  priorityScore: number;
  financialExposure: string;
  delayExposure: string;
  overdue: string;
  dueDate: string;
  status: 'Open' | 'In Progress' | 'Pending';
}

interface SimulatorScenario {
  currentDelay: string;
  currentCost: string;
  projDelay: string;
  projDelayReduction: string;
  projSaving: string;
  confidence: number;
}

interface ActionCenterProps {
  onSelectProject: (projectId: string) => void;
  onNavigateTab: (tab: string) => void;
}

export const ActionCenter: React.FC<ActionCenterProps> = ({ onSelectProject, onNavigateTab }) => {
  const [activeFilterTab, setActiveFilterTab] = useState<'all' | 'critical' | 'high' | 'medium'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSimCategory, setSelectedSimCategory] = useState<string>('land');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 80);
    return () => clearTimeout(t);
  }, []);

  // Simulator configurations matching mockup text exactly
  const simulatorScenarios: Record<string, SimulatorScenario> = {
    land: {
      currentDelay: '7.2 months',
      currentCost: '₹4,800 Cr',
      projDelay: '3.8 months',
      projDelayReduction: '3.4 months',
      projSaving: '₹2,100 Cr',
      confidence: 82
    },
    procurement: {
      currentDelay: '5.2 months',
      currentCost: '₹3,200 Cr',
      projDelay: '2.8 months',
      projDelayReduction: '2.4 months',
      projSaving: '₹1,200 Cr',
      confidence: 75
    },
    contractor: {
      currentDelay: '4.8 months',
      currentCost: '₹2,100 Cr',
      projDelay: '3.2 months',
      projDelayReduction: '1.6 months',
      projSaving: '₹850 Cr',
      confidence: 70
    },
    milestone: {
      currentDelay: '3.8 months',
      currentCost: '₹1,850 Cr',
      projDelay: '2.0 months',
      projDelayReduction: '1.8 months',
      projSaving: '₹600 Cr',
      confidence: 65
    },
    clearance: {
      currentDelay: '4.4 months',
      currentCost: '₹1,200 Cr',
      projDelay: '2.4 months',
      projDelayReduction: '2.0 months',
      projSaving: '₹500 Cr',
      confidence: 68
    }
  };

  const currentSim = simulatorScenarios[selectedSimCategory] || simulatorScenarios.land;

  // Horizontal Weight priorities matching exact mockup text
  const weights = [
    { label: 'Risk Severity', pct: 88, color: 'var(--color-accent-red)' },
    { label: 'Financial Exposure', pct: 82, color: 'var(--color-accent-red)' },
    { label: 'Delay Exposure', pct: 74, color: '#F59E0B' },
    { label: 'Project/Network Criticality', pct: 58, color: 'var(--color-on-track)' },
    { label: 'Urgency', pct: 45, color: 'var(--color-on-track)' },
    { label: 'Dependencies', pct: 32, color: '#94A3B8' }
  ];

  // Action Items list (matching the mockup exactly)
  const actionItems: ActionItem[] = [
    {
      project: 'Mumbai Metro Phase III',
      projectId: 'mumbai-metro-3',
      ministry: 'Ministry of Housing & Urban Affairs',
      riskEvent: 'Land Acquisition',
      severity: 'Critical',
      priorityScore: 94,
      financialExposure: '₹4,850 Cr',
      delayExposure: '7.2 mo',
      overdue: 'Expedite permit clearances',
      dueDate: '15 Sep 2026',
      status: 'Open'
    },
    {
      project: 'Eastern Freight Corridor',
      projectId: 'eastern-dedicated-freight',
      ministry: 'Ministry of Railways',
      riskEvent: 'Procurement',
      severity: 'High',
      priorityScore: 87,
      financialExposure: '₹3,200 Cr',
      delayExposure: '5.2 mo',
      overdue: 'Review vendor red flagging',
      dueDate: '12 Sep 2026',
      status: 'In Progress'
    },
    {
      project: 'Solar Park X',
      projectId: 'mumbai-metro-3', // representative
      ministry: 'Ministry of New & Renewable Energy',
      riskEvent: 'Milestones',
      severity: 'High',
      priorityScore: 78,
      financialExposure: '₹2,450 Cr',
      delayExposure: '4.7 mo',
      overdue: 'Resolve milestone delays',
      dueDate: '20 Sep 2026',
      status: 'Open'
    },
    {
      project: 'National Highway Y',
      projectId: 'mumbai-metro-3',
      ministry: 'Ministry of Road Transport & Highways',
      riskEvent: 'Contractor Performance',
      severity: 'Medium',
      priorityScore: 72,
      financialExposure: '₹1,800 Cr',
      delayExposure: '3.3 mo',
      overdue: 'Evaluate contractor capabilities',
      dueDate: '25 Sep 2026',
      status: 'In Progress'
    },
    {
      project: 'Water Supply Project',
      projectId: 'mumbai-metro-3',
      ministry: 'Ministry of Water',
      riskEvent: 'Clearance',
      severity: 'Medium',
      priorityScore: 68,
      financialExposure: '₹1,200 Cr',
      delayExposure: '2.6 mo',
      overdue: 'Expedite environmental clearance',
      dueDate: '28 Sep 2026',
      status: 'Pending'
    }
  ];

  // Filtering list based on tab & search
  const filteredActions = actionItems.filter((item) => {
    const matchesSearch = 
      item.project.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.riskEvent.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.ministry.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesTab = 
      activeFilterTab === 'all' || 
      item.severity.toLowerCase() === activeFilterTab;

    return matchesSearch && matchesTab;
  });

  const getSeverityTag = (severity: ActionItem['severity']) => {
    let cls = 'p-tag-red';
    if (severity === 'High') cls = 'p-tag-orange';
    else if (severity === 'Medium') cls = 'p-tag-blue';

    return <span className={`priority-tag ${cls}`}>{severity}</span>;
  };

  const getStatusBadge = (status: ActionItem['status']) => {
    switch (status) {
      case 'Open':
        return <span className="action-status-badge status-open">Open</span>;
      case 'In Progress':
        return <span className="action-status-badge status-inprogress">In Progress</span>;
      case 'Pending':
        return <span className="action-status-badge status-pending">Pending</span>;
      default:
        return null;
    }
  };

  const renderSimDial = (pct: number) => {
    const r = 18;
    const circum = 2 * Math.PI * r;
    const offset = circum - (pct / 100) * circum;

    return (
      <div className="sim-radial-wrapper">
        <svg viewBox="0 0 44 44" className="sim-radial-svg">
          <circle cx="22" cy="22" r={r} fill="none" stroke="#F1F5F9" strokeWidth="3.5" />
          <circle 
            cx="22" 
            cy="22" 
            r={r} 
            fill="none" 
            stroke="#22C55E" 
            strokeWidth="3.5" 
            strokeDasharray={circum}
            strokeDashoffset={offset}
            transform="rotate(-90 22 22)"
            strokeLinecap="round"
          />
        </svg>
        <div className="sim-pct-text">{pct}%</div>
      </div>
    );
  };

  return (
    <div className="action-center-container animation-fade-in">
      {/* Title Header bar */}
      <div className="action-page-header">
        <div>
          <h1 className="action-page-title">Action Center</h1>
          <p className="action-page-subtitle">Prioritised actions for faster, smarter intervention.</p>
        </div>
        <div className="header-block-right">
          <div className="insights-date-group">
            <span className="insights-date-indicator">31 July 2026</span>
            <span className="insights-update-sub">Last updated 12m ago</span>
          </div>

          <div className="ai-dropdown-badge action-recommendations-btn">
            <div className="action-btn-text-stack">
              <span className="ai-dropdown-txt">AI Powered Recommendations</span>
              <span className="ai-dropdown-subtext-btn">12 actions require intervention</span>
            </div>
            <ArrowRight size={13} className="ai-chevron-right" />
          </div>
        </div>
      </div>

      {/* Row 1 Metrics: Interventions banner card */}
      <div className="card unified-interventions-banner-card">
        <div className="banner-left-section">
          <div className="banner-alert-circle">
            <AlertTriangle size={20} color="#B91C1C" />
          </div>
          <div className="banner-alert-details">
            <h2 className="banner-headline font-red"><AnimatedCounter value={126} /> projects require intervention</h2>
            <p className="banner-subtext">Immediate attention needed to avoid further delays and cost overruns.</p>
          </div>
        </div>

        <div className="banner-middle-distribution">
          <span className="dist-section-lbl">Severity Distribution</span>
          <div className="distribution-row-elements">
            <div className="dist-item"><span className="dot bg-red"></span><strong><AnimatedCounter value={38} /></strong> <span className="lbl-grey">Critical</span></div>
            <div className="dist-item"><span className="dot bg-orange"></span><strong><AnimatedCounter value={51} /></strong> <span className="lbl-grey">High</span></div>
            <div className="dist-item"><span className="dot bg-yellow"></span><strong><AnimatedCounter value={37} /></strong> <span className="lbl-grey">Medium</span></div>
          </div>
        </div>

        <div className="banner-metric-block-with-icon">
          <div className="banner-metric-icon-wrapper bg-blue-light">
            <Link size={16} color="#2F6BF4" />
          </div>
          <div className="banner-metric-details">
            <span className="banner-metric-lbl">Total Financial Exposure</span>
            <div className="banner-metric-val">
              <AnimatedCounter value={24680} formatter={(val) => `₹ ${val.toLocaleString()} Cr`} />
            </div>
            <span className="banner-subtext-caption">Potential cost overrun</span>
          </div>
        </div>

        <div className="banner-metric-block-with-icon">
          <div className="banner-metric-icon-wrapper bg-orange-light">
            <Clock size={16} color="#F59E0B" />
          </div>
          <div className="banner-metric-details">
            <span className="banner-metric-lbl">Potential Delay Exposure</span>
            <div className="banner-metric-val font-orange">
              <AnimatedCounter value={486} formatter={(val) => `${(val / 10).toFixed(1)} months`} />
            </div>
            <span className="banner-subtext-caption">Across all action items</span>
          </div>
        </div>
      </div>

      {/* Row 2: Grid row (Priority Action Queue, simulator, prioritisation reasons) */}
      <div className="action-grid-3">
        {/* Priority Action Queue */}
        <div className="card priority-issues-card">
          <div className="priority-queue-header">
            <div>
              <h2 className="card-title">Priority Action Queue</h2>
              <p className="card-subtitle">Top active issues based on risk severity, financial exposure, delay impact and historical patterns.</p>
            </div>
            <button className="card-link-btn" onClick={() => alert('View all active actions')}>View All Actions &gt;</button>
          </div>

          {/* Priority queue table block */}
          <div className="priority-queue-table-wrapper">
            <table className="priority-queue-table">
              <thead>
                <tr>
                  <th style={{ width: '6%' }}>#</th>
                  <th style={{ width: '40%' }}>Priority Active Issues</th>
                  <th style={{ width: '12%' }}>Projects</th>
                  <th style={{ width: '20%' }}>Financial Exposure</th>
                  <th style={{ width: '14%' }}>Delay Exposure</th>
                  <th style={{ width: '8%', textAlign: 'right' }}>Priority Score</th>
                </tr>
              </thead>
              <tbody>
                {/* Issue 1 */}
                <tr 
                  className={`priority-queue-row clickable-row ${selectedSimCategory === 'land' ? 'active-row' : ''}`}
                  onClick={() => setSelectedSimCategory('land')}
                >
                  <td className="queue-num">1</td>
                  <td>
                    <div className="issue-primary-cell">
                      <span className="issue-main-lbl">Land Acquisition</span>
                      <span className="issue-sub-desc">Pending approvals from state forest dept. and regulatory permits.</span>
                    </div>
                  </td>
                  <td className="center-text font-weight-bold">17</td>
                  <td className="bold-cell">₹ 4,850 Cr</td>
                  <td className="font-orange">8.4 months</td>
                  <td style={{ textAlign: 'right' }}>
                    <div className="score-badge-col">
                      <span className="score-badge-val">94/100</span>
                      <span className="score-badge-lvl font-red">Critical</span>
                    </div>
                  </td>
                </tr>

                {/* Issue 2 */}
                <tr 
                  className={`priority-queue-row clickable-row ${selectedSimCategory === 'procurement' ? 'active-row' : ''}`}
                  onClick={() => setSelectedSimCategory('procurement')}
                >
                  <td className="queue-num">2</td>
                  <td>
                    <div className="issue-primary-cell">
                      <span className="issue-main-lbl">Procurement Delays</span>
                      <span className="issue-sub-desc">Review supply contracts and contractor bidding processes.</span>
                    </div>
                  </td>
                  <td className="center-text font-weight-bold">12</td>
                  <td className="bold-cell">₹ 3,200 Cr</td>
                  <td className="font-orange">6.5 months</td>
                  <td style={{ textAlign: 'right' }}>
                    <div className="score-badge-col">
                      <span className="score-badge-val">87/100</span>
                      <span className="score-badge-lvl font-red">High</span>
                    </div>
                  </td>
                </tr>

                {/* Issue 3 */}
                <tr 
                  className={`priority-queue-row clickable-row ${selectedSimCategory === 'contractor' ? 'active-row' : ''}`}
                  onClick={() => setSelectedSimCategory('contractor')}
                >
                  <td className="queue-num">3</td>
                  <td>
                    <div className="issue-primary-cell">
                      <span className="issue-main-lbl">Contractor Performance</span>
                      <span className="issue-sub-desc">Low performance and contractor capacity issues on sites.</span>
                    </div>
                  </td>
                  <td className="center-text font-weight-bold">9</td>
                  <td className="bold-cell">₹ 2,100 Cr</td>
                  <td className="font-orange">5.2 months</td>
                  <td style={{ textAlign: 'right' }}>
                    <div className="score-badge-col">
                      <span className="score-badge-val">78/100</span>
                      <span className="score-badge-lvl font-orange">High</span>
                    </div>
                  </td>
                </tr>

                {/* Issue 4 */}
                <tr 
                  className={`priority-queue-row clickable-row ${selectedSimCategory === 'milestone' ? 'active-row' : ''}`}
                  onClick={() => setSelectedSimCategory('milestone')}
                >
                  <td className="queue-num">4</td>
                  <td>
                    <div className="issue-primary-cell">
                      <span className="issue-main-lbl">Milestone Slippage</span>
                      <span className="issue-sub-desc">Sectoral construction bottlenecks and delays.</span>
                    </div>
                  </td>
                  <td className="center-text font-weight-bold">8</td>
                  <td className="bold-cell">₹ 1,850 Cr</td>
                  <td className="font-orange">3.8 months</td>
                  <td style={{ textAlign: 'right' }}>
                    <div className="score-badge-col">
                      <span className="score-badge-val">72/100</span>
                      <span className="score-badge-lvl font-orange">Medium</span>
                    </div>
                  </td>
                </tr>

                {/* Issue 5 */}
                <tr 
                  className={`priority-queue-row clickable-row ${selectedSimCategory === 'clearance' ? 'active-row' : ''}`}
                  onClick={() => setSelectedSimCategory('clearance')}
                >
                  <td className="queue-num">5</td>
                  <td>
                    <div className="issue-primary-cell">
                      <span className="issue-main-lbl">Clearance Delays</span>
                      <span className="issue-sub-desc">Environmental & regulatory clearance delays.</span>
                    </div>
                  </td>
                  <td className="center-text font-weight-bold">6</td>
                  <td className="bold-cell">₹ 1,200 Cr</td>
                  <td className="font-orange">4.4 months</td>
                  <td style={{ textAlign: 'right' }}>
                    <div className="score-badge-col">
                      <span className="score-badge-val">68/100</span>
                      <span className="score-badge-lvl font-orange">Medium</span>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Intervention Impact Simulator */}
        <div className="card simulator-card">
          <div className="card-header-simple">
            <h2 className="card-title">Intervention Impact Simulator</h2>
            <p className="card-subtitle">See the potential impact of recommended actions.</p>
          </div>

          {/* Simulator Controls */}
          <div className="simulator-dropdown-wrapper">
            <select 
              value={selectedSimCategory} 
              onChange={(e) => setSelectedSimCategory(e.target.value)} 
              className="sim-category-select"
            >
              <option value="land">Land Acquisition</option>
              <option value="procurement">Procurement Delays</option>
              <option value="contractor">Contractor Performance</option>
              <option value="milestone">Milestone Slippage</option>
              <option value="clearance">Clearance Delays</option>
            </select>
          </div>

          <div className="simulator-metrics-grid">
            <div className="sim-metric-box current-trajectory-box">
              <span className="sim-lbl">Current Trajectory</span>
              
              <div className="sim-detail-row">
                <span className="sim-sub-lbl">Projected Delay</span>
                <div className="sim-val-navy">{currentSim.currentDelay}</div>
              </div>
              
              <div className="sim-detail-row">
                <span className="sim-sub-lbl">Cost Exposure</span>
                <div className="sim-val-navy">{currentSim.currentCost}</div>
              </div>
            </div>

            <div className="sim-metric-box green-highlight recommended-trajectory-box">
              <span className="sim-lbl">With Recommended Action</span>
              
              <div className="sim-detail-row">
                <span className="sim-sub-lbl">Projected Delay</span>
                <div className="sim-val-navy">{currentSim.projDelay}</div>
              </div>
              
              <div className="sim-detail-row">
                <span className="sim-sub-lbl green-text">Potential Delay Avoided</span>
                <div className="sim-val-navy-small">{currentSim.projDelayReduction}</div>
              </div>
              
              <div className="sim-detail-row">
                <span className="sim-sub-lbl green-text">Potential Cost Reduction</span>
                <div className="sim-val-navy-small">{currentSim.projSaving}</div>
              </div>
            </div>
          </div>

          {/* Confidence Indicator */}
          <div className="simulator-confidence-panel">
            {renderSimDial(currentSim.confidence)}
            <div className="confidence-details">
              <div className="confidence-title">Confidence Level</div>
              <div className="confidence-desc">Based on historical success patterns and current project status.</div>
            </div>
          </div>

          <button className="sim-action-cta-btn" onClick={() => alert('Opening detailed analytical simulator page...')}>
            <span>View Detailed Analysis</span>
            <ArrowRight size={14} />
          </button>
        </div>

        {/* Why Actions Prioritized */}
        <div className="card prioritized-reasons-card">
          <div className="card-header-simple">
            <h2 className="card-title">Why These Actions Are Prioritized?</h2>
            <p className="card-subtitle">Key drivers and parameters used to evaluate priorities.</p>
          </div>

          <div className="weights-progress-list">
            {weights.map((w, idx) => (
              <div key={idx} className="weight-row-item">
                <div className="weight-info-labels">
                  <span className="weight-lbl">{w.label}</span>
                  <span className="weight-pct">{w.pct}%</span>
                </div>
                <div className="weight-track">
                  <div className="weight-fill" style={{ width: mounted ? `${w.pct}%` : '0%', backgroundColor: w.color, transition: `width 0.7s cubic-bezier(0.16, 1, 0.3, 1) ${idx * 0.1}s` }}></div>
                </div>
              </div>
            ))}
          </div>

          <div className="priority-footer-score-panel">
            <div className="score-desc-group-priorities">
              <span className="score-desc-lbl">Priority Score</span>
              <span className="score-desc-details-small">Highly Priority based on combined risk and impact.</span>
            </div>
            <div className="score-count-val">
              <AnimatedCounter value={94} />/100
            </div>
          </div>
        </div>
      </div>

      {/* Row 3: All Action Items List */}
      <div className="card all-actions-list-card">
        {/* Table Filters header */}
        <div className="actions-table-filters-row">
          <div className="table-header-title-block flex-align-center gap-10">
            <div className="plane-icon-circle-alert">
              <ShieldAlert size={14} color="var(--color-on-track)" />
            </div>
            <div>
              <h2 className="card-title">All Action Items</h2>
              <p className="card-subtitle">Complete list of projects requiring intervention with detailed summaries.</p>
            </div>
          </div>

          <div className="right-table-filters">
            <select className="risk-select select-small">
              <option>Ministry</option>
            </select>
            <select className="risk-select select-small">
              <option>Sector</option>
            </select>
            <select className="risk-select select-small">
              <option>State</option>
            </select>

            <div className="table-search-box">
              <Search size={14} className="table-search-icon" />
              <input 
                type="text" 
                placeholder="Search actions, projects..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="table-search-input"
              />
            </div>
            <button className="table-export-btn" onClick={() => alert('Exporting active alerts CSV...')}>
              <Download size={14} />
              <span>Export</span>
            </button>
          </div>
        </div>

        {/* Tabs Row */}
        <div className="actions-tabs-subrow">
          <div className="left-table-tabs">
            <button 
              className={`table-filter-tab-btn ${activeFilterTab === 'all' ? 'active' : ''}`}
              onClick={() => setActiveFilterTab('all')}
            >
              All (126)
            </button>
            <button 
              className={`table-filter-tab-btn ${activeFilterTab === 'critical' ? 'active' : ''}`}
              onClick={() => setActiveFilterTab('critical')}
            >
              <span className="dot bg-red"></span>Critical (38)
            </button>
            <button 
              className={`table-filter-tab-btn ${activeFilterTab === 'high' ? 'active' : ''}`}
              onClick={() => setActiveFilterTab('high')}
            >
              <span className="dot bg-orange"></span>High (51)
            </button>
            <button 
              className={`table-filter-tab-btn ${activeFilterTab === 'medium' ? 'active' : ''}`}
              onClick={() => setActiveFilterTab('medium')}
            >
              <span className="dot bg-grey"></span>Medium (37)
            </button>
          </div>

          <button className="card-link-btn view-actions-btn" onClick={() => alert('Viewing detailed action logs')}>View Actions</button>
        </div>

        {/* Table data */}
        <div className="portfolio-table-wrapper">
          <table className="portfolio-table">
            <thead>
              <tr>
                <th style={{ width: '18%' }}>PROJECT</th>
                <th style={{ width: '14%' }}>MINISTRY</th>
                <th style={{ width: '12%' }}>RISK EVENT</th>
                <th style={{ width: '8%' }}>SEVERITY</th>
                <th style={{ width: '6%', textAlign: 'center' }}>PRIORITY SCORE</th>
                <th style={{ width: '12%' }}>FINANCIAL EXPOSURE</th>
                <th style={{ width: '10%' }}>DELAY EXPOSURE</th>
                <th style={{ width: '15%' }}>OVERDUE</th>
                <th style={{ width: '10%' }}>DUE DATE</th>
                <th style={{ width: '8%' }}>STATUS</th>
                <th style={{ width: '5%', textAlign: 'right' }}></th>
              </tr>
            </thead>
            <tbody>
              {filteredActions.length > 0 ? (
                filteredActions.map((alertItem, idx) => (
                  <tr 
                    key={idx} 
                    className="portfolio-row" 
                    onClick={() => {
                      onSelectProject(alertItem.projectId);
                      onNavigateTab('projects');
                    }}
                  >
                    <td className="project-name-primary" style={{ fontWeight: 800 }}>{alertItem.project}</td>
                    <td className="td-ministry-text">{alertItem.ministry}</td>
                    <td className="td-alert-type" style={{ fontWeight: 700 }}>{alertItem.riskEvent}</td>
                    <td>{getSeverityTag(alertItem.severity)}</td>
                    <td style={{ textAlign: 'center', fontWeight: 800 }}>{alertItem.priorityScore}</td>
                    <td className="bold-cell" style={{ color: 'var(--navy-dark)' }}>{alertItem.financialExposure}</td>
                    <td className="font-orange" style={{ fontWeight: 800 }}>{alertItem.delayExposure}</td>
                    <td className="td-ministry-text" style={{ fontSize: '12px' }}>{alertItem.overdue}</td>
                    <td className="td-ministry-text" style={{ fontSize: '12px', whiteSpace: 'nowrap' }}>{alertItem.dueDate}</td>
                    <td>{getStatusBadge(alertItem.status)}</td>
                    <td style={{ textAlign: 'right' }}>
                      <div className="table-arrow-outline-btn">
                        <ArrowRight size={12} className="row-navigation-arrow" style={{ color: 'var(--color-on-track)' }} />
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={11} className="table-empty-state">
                    No active action items match the active tabs/filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Row 4 Bottom split layout */}
      <div className="action-grid-bottom-split">
        {/* Insights cards */}
        <div className="card insights-bottom-row-card">
          <div className="card-header-simple">
            <h2 className="card-title flex-align-center gap-10">
              <ShieldAlert size={14} color="var(--color-on-track)" />
              <span>Action Center Insights</span>
            </h2>
            <p className="card-subtitle">Key insights from AI analytics to support decision-making.</p>
          </div>

          <div className="insights-bottom-cards-row">
            {/* Card 1 */}
            <div className="insight-split-box" onClick={() => alert('Opening details...')}>
              <h4 className="insight-split-title font-red">Land acquisition delays are increasing</h4>
              <p className="insight-split-desc">+12% spike in land acquisition delays across active projects.</p>
              <button className="insight-split-link link-red">View Details →</button>
            </div>

            {/* Card 2 */}
            <div className="insight-split-box" onClick={() => alert('Opening details...')}>
              <h4 className="insight-split-title font-orange">Procurement delays affecting</h4>
              <p className="insight-split-desc">Transport, Railways and Power Sectors. 17 projects impacted.</p>
              <button className="insight-split-link link-orange">View Details →</button>
            </div>

            {/* Card 3 */}
            <div className="insight-split-box" onClick={() => alert('Opening details...')}>
              <h4 className="insight-split-title font-blue">High risk pattern detected</h4>
              <p className="insight-split-desc">High expenditure + low progress in milestone slippage (34 projects).</p>
              <button className="insight-split-link link-blue">View Details →</button>
            </div>

            {/* Card 4 */}
            <div className="insight-split-box" onClick={() => alert('Opening details...')}>
              <h4 className="insight-split-title font-green">Proactive opportunity</h4>
              <p className="insight-split-desc">Mitigation scenarios show 2.4 months saving for Metro Rail.</p>
              <button className="insight-split-link link-green">View Details →</button>
            </div>
          </div>
        </div>

        {/* Quick Actions (solid navy) */}
        <div className="card quick-actions-navy-card dark-navy-theme">
          <div className="card-header-simple">
            <h2 className="card-title flex-align-center gap-10">
              <ShieldAlert size={14} color="rgba(255, 255, 255, 0.7)" />
              <span>Quick Actions</span>
            </h2>
            <p className="card-subtitle">Common intervention playbooks for resolving issues.</p>
          </div>

          <div className="quick-actions-pills-list">
            <div className="quick-action-pill-item" onClick={() => alert('Opening Land acquisition batch actions...')}>
              <span>Land Acquisition (17 projects)</span>
              <ArrowRight size={14} />
            </div>

            <div className="quick-action-pill-item" onClick={() => alert('Opening Procurement batch actions...')}>
              <span>Procurement (12 projects)</span>
              <ArrowRight size={14} />
            </div>

            <div className="quick-action-pill-item" onClick={() => alert('Opening Contractor batch actions...')}>
              <span>Contractor Performance (9 projects)</span>
              <ArrowRight size={14} />
            </div>

            <div className="quick-action-pill-item" onClick={() => alert('Opening Milestone batch actions...')}>
              <span>Milestone Slippage (8 projects)</span>
              <ArrowRight size={14} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
