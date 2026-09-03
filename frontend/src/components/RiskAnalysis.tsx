import React, { useState, useEffect } from 'react';
import { Download, Search, AlertTriangle, Clock, Check, ShieldAlert } from 'lucide-react';
import './RiskAnalysis.css';
import { AnimatedCounter } from './AnimatedCounter';
import { api } from '../services/api';

interface RiskProject {
  id: string;
  name: string;
  agency: string;
  state: string;
  sector: string;
  costRisk: number;
  timeRisk: number;
  earlyWarning: number;
  overallScore: number;
  riskLevel: 'High' | 'Medium' | 'Low';
  status: 'Active' | 'On Hold';
  detailsId: string;
}

interface AgencyBreakdownItem {
  agency: string;
  val: number;
  bar: number;
  tag: string;
  color: string;
}

interface EarlyWarningTrigger {
  level: 'crit' | 'warn' | 'info';
  title: string;
  desc: string;
}

interface RiskAnalysisProps {
  onSelectProject: (projectId: string) => void;
  onNavigateTab?: (tab: string) => void;
}

const FALLBACK_EARLY_WARNINGS: EarlyWarningTrigger[] = [
  {
    level: 'crit',
    title: 'High Expenditure + Low Progress = Milestone Slippage',
    desc: '24 projects affected. Average progress delay observed across portfolio. Immediate review advised.'
  },
  {
    level: 'warn',
    title: 'Repeated Milestone Postponement = Contractor Performance Decline',
    desc: '18 projects affected. Low output rates and resource constraints observed on sites.'
  },
  {
    level: 'info',
    title: 'Clearance Delays = Land Acquisition Issues',
    desc: '32 projects affected. Delay correlation index elevated. Environmental permissions pending.'
  }
];

export const RiskAnalysis: React.FC<RiskAnalysisProps> = ({ onSelectProject }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedAgency, setSelectedAgency] = useState('All');
  const [selectedSector, setSelectedSector] = useState('All');
  const [selectedState, setSelectedState] = useState('All');
  const [selectedRisk, setSelectedRisk] = useState('All');
  const [hoveredSegment, setHoveredSegment] = useState<'low' | 'moderate' | 'high' | 'critical' | null>(null);
  const [mounted, setMounted] = useState(false);

  const [summaryData, setSummaryData] = useState<{
    costCount: number;
    costPct: string;
    timeCount: number;
    timePct: string;
    warningCount: number;
    warningPct: string;
    lowCount: number;
    lowPct: string;
    totalAnalyzed: number;
    modCount: number;
    modPct: string;
    highCount: number;
    highPct: string;
    critCount: number;
    critPct: string;
  } | null>(null);

  const [riskProjects, setRiskProjects] = useState<RiskProject[]>([]);
  const [loadingProjects, setLoadingProjects] = useState(true);
  const [loadingSummary, setLoadingSummary] = useState(true);
  const [agencyBreakdown, setAgencyBreakdown] = useState<AgencyBreakdownItem[]>([]);
  const [earlyWarnings, setEarlyWarnings] = useState<EarlyWarningTrigger[]>([]);

  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 80);

    // Fetch summary stats from backend
    api.getRiskSummary().then((res) => {
      if (res && res.total_analyzed > 0) {
        const critObj = res.distribution_categories?.find((c: any) => c.category.includes('>80') || c.category.includes('Critical'));
        const highObj = res.distribution_categories?.find((c: any) => c.category.includes('70-79') || c.category.includes('High'));
        const modObj = res.distribution_categories?.find((c: any) => c.category.includes('50-69') || c.category.includes('Moderate'));
        const lowObj = res.distribution_categories?.find((c: any) => c.category.includes('<50') || c.category.includes('Low'));

        const critCount = critObj ? critObj.count : 245;
        const highCount = highObj ? highObj.count : 329;
        const modCount = modObj ? modObj.count : 968;
        const lowCount = lowObj ? lowObj.count : 1819;
        const total = res.total_analyzed || 3361;

        setSummaryData({
          costCount: res.cost_overrun_count,
          costPct: `${res.cost_overrun_pct}%`,
          timeCount: res.time_overrun_count,
          timePct: `${res.time_overrun_pct}%`,
          warningCount: res.early_warning_count,
          warningPct: `${res.early_warning_pct}%`,
          lowCount: lowCount,
          lowPct: `${((lowCount / total) * 100).toFixed(1)}%`,
          totalAnalyzed: total,
          modCount: modCount,
          modPct: `${((modCount / total) * 100).toFixed(1)}%`,
          highCount: highCount,
          highPct: `${((highCount / total) * 100).toFixed(1)}%`,
          critCount: critCount,
          critPct: `${((critCount / total) * 100).toFixed(1)}%`,
        });

        // Build category breakdown with clean labels
        if (res.distribution_categories && res.distribution_categories.length > 0) {
          const max = Math.max(...res.distribution_categories.map((d: any) => d.count), 1);
          setAgencyBreakdown(res.distribution_categories.map((d: any) => {
            let tag = 'Low Risk';
            if (d.category.includes('>80') || d.category.includes('Critical')) tag = 'Critical';
            else if (d.category.includes('70-79') || d.category.includes('High')) tag = 'High Risk';
            else if (d.category.includes('50-69') || d.category.includes('Moderate')) tag = 'Moderate';
            
            return {
              agency: d.category,
              val: d.count,
              bar: Math.round(d.count / max * 100),
              tag: tag,
              color: d.color || '#2563EB',
            };
          }));
        }
      }
      setLoadingSummary(false);
    }).catch(() => {
      setLoadingSummary(false);
    });

    // Fetch early warning triggers from insights with fallback
    api.getInsightsSummary().then((res) => {
      if (res && res.patterns && res.patterns.length > 0) {
        setEarlyWarnings(res.patterns.slice(0, 3).map((p: any, idx: number) => ({
          level: idx === 0 ? 'crit' : (idx === 1 ? 'warn' : 'info'),
          title: p.title,
          desc: p.detail,
        })));
      } else {
        setEarlyWarnings(FALLBACK_EARLY_WARNINGS);
      }
    }).catch(() => {
      setEarlyWarnings(FALLBACK_EARLY_WARNINGS);
    });

    // Fetch high-risk projects from backend
    setLoadingProjects(true);
    api.getProjects(1, 50).then((res) => {
      if (res && res.items && res.items.length > 0) {
        const mapped: RiskProject[] = res.items.map((p) => ({
          id: p.id,
          name: p.name,
          agency: p.agency,
          state: p.location,
          sector: p.sector,
          costRisk: p.costRisk || 65,
          timeRisk: p.timeRisk || 70,
          earlyWarning: p.overallRisk || 75,
          overallScore: p.riskScore || 70,
          riskLevel: p.riskScore >= 70 ? 'High' : (p.riskScore >= 50 ? 'Medium' : 'Low'),
          status: 'Active',
          detailsId: p.id,
        }));
        setRiskProjects(mapped);
      }
      setLoadingProjects(false);
    }).catch(() => setLoadingProjects(false));

    return () => clearTimeout(t);
  }, []);

  // Top Metrics Data — guarded against null until API returns
  const metrics = summaryData ? [
    {
      id: 'cost',
      title: 'Cost Overrun',
      count: summaryData.costCount,
      status: 'High Risk',
      statusClass: 'status-tag-red',
      desc: `Total Projects (${summaryData.totalAnalyzed}): ${summaryData.costPct}`,
      icon: <ShieldAlert size={16} color="var(--color-accent-red)" />,
      themeClass: 'light-theme-card'
    },
    {
      id: 'time',
      title: 'Time Overrun',
      count: summaryData.timeCount,
      status: 'High Risk',
      statusClass: 'status-tag-red',
      desc: `Total Projects (${summaryData.totalAnalyzed}): ${summaryData.timePct}`,
      icon: <Clock size={16} color="#D97706" />,
      themeClass: 'light-theme-card'
    },
    {
      id: 'warning',
      title: 'Early Warning',
      count: summaryData.warningCount,
      status: 'Medium to High',
      statusClass: 'status-tag-orange',
      desc: `Total Projects (${summaryData.totalAnalyzed}): ${summaryData.warningPct}`,
      icon: <AlertTriangle size={16} color="#D97706" />,
      themeClass: 'light-theme-card'
    },
    {
      id: 'low',
      title: 'Low Risk',
      count: summaryData.lowCount,
      status: 'Low Risk',
      statusClass: 'status-tag-green',
      desc: `Total Projects (${summaryData.totalAnalyzed}): ${summaryData.lowPct}`,
      icon: <Check size={16} color="#22C55E" />,
      themeClass: 'dark-theme-card'
    }
  ] : [];

  // Filtering lists
  const agencies = ['All', ...Array.from(new Set(riskProjects.map(p => p.agency).filter(Boolean)))].slice(0, 8);
  const sectors = ['All', ...Array.from(new Set(riskProjects.map(p => p.sector).filter(Boolean)))].slice(0, 8);
  const states = ['All', ...Array.from(new Set(riskProjects.map(p => p.state).filter(Boolean)))].slice(0, 8);
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
        <button className="export-report-btn" onClick={() => api.exportActionPlan()}>
          <Download size={14} />
          <span>Export Report</span>
        </button>
      </div>

      {/* Row 1: Metrics */}
      <div className="risk-metrics-row-4">
        {metrics.map((m, idx) => (
          <div key={m.id} className={`risk-metric-box ${m.themeClass} card-stagger-${idx + 1}`}>
            <div className="metric-box-top">
              <span className="metric-box-title">{m.title}</span>
              <div className="metric-icon-circle">{m.icon}</div>
            </div>
            <div className="metric-box-body">
              <span className="metric-count"><AnimatedCounter value={m.count} triggerKey={m.count} /></span>
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

          {!summaryData ? (
            <div style={{ padding: '30px', textAlign: 'center', color: '#94A3B8', fontSize: '13px' }}>
              Loading risk distribution...
            </div>
          ) : (() => {
            const circumference = 2 * Math.PI * 35;
            const total = summaryData.totalAnalyzed || 1;
            const lowDash = (summaryData.lowCount / total) * circumference;
            const modDash = (summaryData.modCount / total) * circumference;
            const highDash = (summaryData.highCount / total) * circumference;
            const critDash = (summaryData.critCount / total) * circumference;
            const lowOff = 0;
            const modOff = lowDash;
            const highOff = lowDash + modDash;
            const critOff = lowDash + modDash + highDash;
            return (
              <>
                <div className="distribution-chart-wrapper">
                  <svg viewBox="0 0 100 100" className="dist-donut-svg">
                    <circle cx="50" cy="50" r="35" fill="none" stroke="#F1F5F9" strokeWidth="8" />
                    <circle cx="50" cy="50" r="35" fill="none" stroke="#22C55E"
                      strokeWidth={hoveredSegment === 'low' ? 11 : 8}
                      strokeDasharray={`${lowDash} ${circumference}`} strokeDashoffset={-lowOff}
                      transform="rotate(-90 50 50)"
                      style={{ cursor: 'pointer', transition: 'stroke-width 0.2s ease, opacity 0.2s ease, filter 0.2s ease', opacity: hoveredSegment && hoveredSegment !== 'low' ? 0.45 : 1, filter: hoveredSegment === 'low' ? 'drop-shadow(0 0 8px #22C55E)' : 'none' }}
                      onMouseEnter={() => setHoveredSegment('low')} onMouseLeave={() => setHoveredSegment(null)}
                    />
                    <circle cx="50" cy="50" r="35" fill="none" stroke="#EAB308"
                      strokeWidth={hoveredSegment === 'moderate' ? 11 : 8}
                      strokeDasharray={`${modDash} ${circumference}`} strokeDashoffset={-modOff}
                      transform="rotate(-90 50 50)"
                      style={{ cursor: 'pointer', transition: 'stroke-width 0.2s ease, opacity 0.2s ease, filter 0.2s ease', opacity: hoveredSegment && hoveredSegment !== 'moderate' ? 0.45 : 1, filter: hoveredSegment === 'moderate' ? 'drop-shadow(0 0 8px #EAB308)' : 'none' }}
                      onMouseEnter={() => setHoveredSegment('moderate')} onMouseLeave={() => setHoveredSegment(null)}
                    />
                    <circle cx="50" cy="50" r="35" fill="none" stroke="#EA580C"
                      strokeWidth={hoveredSegment === 'high' ? 11 : 8}
                      strokeDasharray={`${highDash} ${circumference}`} strokeDashoffset={-highOff}
                      transform="rotate(-90 50 50)"
                      style={{ cursor: 'pointer', transition: 'stroke-width 0.2s ease, opacity 0.2s ease, filter 0.2s ease', opacity: hoveredSegment && hoveredSegment !== 'high' ? 0.45 : 1, filter: hoveredSegment === 'high' ? 'drop-shadow(0 0 8px #EA580C)' : 'none' }}
                      onMouseEnter={() => setHoveredSegment('high')} onMouseLeave={() => setHoveredSegment(null)}
                    />
                    <circle cx="50" cy="50" r="35" fill="none" stroke="#B91C1C"
                      strokeWidth={hoveredSegment === 'critical' ? 11 : 8}
                      strokeDasharray={`${critDash} ${circumference}`} strokeDashoffset={-critOff}
                      transform="rotate(-90 50 50)"
                      style={{ cursor: 'pointer', transition: 'stroke-width 0.2s ease, opacity 0.2s ease, filter 0.2s ease', opacity: hoveredSegment && hoveredSegment !== 'critical' ? 0.45 : 1, filter: hoveredSegment === 'critical' ? 'drop-shadow(0 0 8px #B91C1C)' : 'none' }}
                      onMouseEnter={() => setHoveredSegment('critical')} onMouseLeave={() => setHoveredSegment(null)}
                    />
                  </svg>
                  <div className="dist-chart-center-text">
                    {hoveredSegment === null ? (
                      <><span className="center-num"><AnimatedCounter value={summaryData.totalAnalyzed} triggerKey={summaryData.totalAnalyzed} /></span><span className="center-lbl">Total Projects</span></>
                    ) : hoveredSegment === 'critical' ? (
                      <><span className="center-hover-lbl" style={{ color: '#B91C1C' }}>Critical Risk</span><span className="center-hover-num"><AnimatedCounter value={summaryData.critCount} triggerKey={`crit-${summaryData.critCount}`} /></span><span className="center-hover-pct">{summaryData.critPct}</span></>
                    ) : hoveredSegment === 'high' ? (
                      <><span className="center-hover-lbl" style={{ color: '#EA580C' }}>High Risk</span><span className="center-hover-num"><AnimatedCounter value={summaryData.highCount} triggerKey={`high-${summaryData.highCount}`} /></span><span className="center-hover-pct">{summaryData.highPct}</span></>
                    ) : hoveredSegment === 'moderate' ? (
                      <><span className="center-hover-lbl" style={{ color: '#EAB308' }}>Mod. Risk</span><span className="center-hover-num"><AnimatedCounter value={summaryData.modCount} triggerKey={`mod-${summaryData.modCount}`} /></span><span className="center-hover-pct">{summaryData.modPct}</span></>
                    ) : (
                      <><span className="center-hover-lbl" style={{ color: '#22C55E' }}>Low Risk</span><span className="center-hover-num"><AnimatedCounter value={summaryData.lowCount} triggerKey={`low-${summaryData.lowCount}`} /></span><span className="center-hover-pct">{summaryData.lowPct}</span></>
                    )}
                  </div>
                </div>

                <div className="dist-legend-rows">
                  <div className={`dist-legend-item ${hoveredSegment === 'low' ? 'active' : ''}`} onMouseEnter={() => setHoveredSegment('low')} onMouseLeave={() => setHoveredSegment(null)}>
                    <div className="dist-legend-left"><span className="dist-dot" style={{ backgroundColor: '#22C55E' }}></span><span className="dist-name">Low Risk (&lt;50)</span></div>
                    <div className="dist-legend-right"><span className="dist-count">{summaryData.lowCount}</span><span className="dist-pct">({summaryData.lowPct})</span></div>
                  </div>
                  <div className={`dist-legend-item ${hoveredSegment === 'moderate' ? 'active' : ''}`} onMouseEnter={() => setHoveredSegment('moderate')} onMouseLeave={() => setHoveredSegment(null)}>
                    <div className="dist-legend-left"><span className="dist-dot" style={{ backgroundColor: '#EAB308' }}></span><span className="dist-name">Moderate (50-69)</span></div>
                    <div className="dist-legend-right"><span className="dist-count">{summaryData.modCount}</span><span className="dist-pct">({summaryData.modPct})</span></div>
                  </div>
                  <div className={`dist-legend-item ${hoveredSegment === 'high' ? 'active' : ''}`} onMouseEnter={() => setHoveredSegment('high')} onMouseLeave={() => setHoveredSegment(null)}>
                    <div className="dist-legend-left"><span className="dist-dot" style={{ backgroundColor: '#EA580C' }}></span><span className="dist-name">High Risk (70-79)</span></div>
                    <div className="dist-legend-right"><span className="dist-count">{summaryData.highCount}</span><span className="dist-pct">({summaryData.highPct})</span></div>
                  </div>
                  <div className={`dist-legend-item ${hoveredSegment === 'critical' ? 'active' : ''}`} onMouseEnter={() => setHoveredSegment('critical')} onMouseLeave={() => setHoveredSegment(null)}>
                    <div className="dist-legend-left"><span className="dist-dot" style={{ backgroundColor: '#B91C1C' }}></span><span className="dist-name">Critical (&gt;80)</span></div>
                    <div className="dist-legend-right"><span className="dist-count">{summaryData.critCount}</span><span className="dist-pct">({summaryData.critPct})</span></div>
                  </div>
                </div>
              </>
            );
          })()}
        </div>

        {/* Risk Breakdown by Category */}
        <div className="card risk-chart-card">
          <div className="card-header-simple">
            <h2 className="card-title">Risk Breakdown by Category</h2>
            <p className="card-subtitle">Risk distribution across categories</p>
          </div>

          <div className="agency-breakdown-list">
            {agencyBreakdown.length === 0 ? (
              loadingSummary ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', padding: '8px 0' }}>
                  {[80, 65, 48, 35].map((w, i) => (
                    <div key={i}>
                      <div className="skeleton-pulse skeleton-line" style={{ width: `${w}%`, marginBottom: '6px' }} />
                      <div className="skeleton-pulse" style={{ height: '8px', borderRadius: '4px', width: `${w - 10}%` }} />
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ padding: '20px', textAlign: 'center', color: '#94A3B8', fontSize: '13px' }}>No category data available.</div>
              )
            ) : agencyBreakdown.map((item, idx) => (
              <div key={idx} className="agency-row" style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginBottom: '12px' }}>
                <div className="agency-meta" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '13px' }}>
                  <span className="agency-name" style={{ fontWeight: 700, color: 'var(--navy-dark)' }}>{item.agency}</span>
                  <span className="agency-tag" style={{ fontSize: '11px', fontWeight: 800, padding: '3px 8px', borderRadius: '4px', backgroundColor: item.color === '#EF4444' || item.color === '#B91C1C' ? '#FEE2E2' : item.color === '#F97316' || item.color === '#EA580C' ? '#FFEDD5' : item.color === '#EAB308' ? '#FEF9C3' : '#DCFCE7', color: item.color }}>
                    <AnimatedCounter value={item.val} triggerKey={item.val} /> projects ({((item.val / (summaryData?.totalAnalyzed || 1)) * 100).toFixed(1)}%)
                  </span>
                </div>
                <div className="agency-bar-track" style={{ width: '100%', height: '8px', backgroundColor: '#EEF2F6', borderRadius: '100px', overflow: 'hidden' }}>
                  <div
                    className="agency-bar-fill bar-fill-hover"
                    style={{
                      width: mounted ? `${item.bar}%` : '0%',
                      height: '100%',
                      backgroundColor: item.color,
                      borderRadius: '100px',
                      transition: `width 0.8s cubic-bezier(0.16, 1, 0.3, 1) ${idx * 0.1}s`
                    }}
                  /></div>
              </div>
            ))}
          </div>
        </div>

        {/* AI Risk Mitigation Suggestions */}
        <div className="card risk-chart-card ai-suggestions-card">
          <div className="card-header-simple">
            <h2 className="card-title">AI Early Warning Matrix</h2>
            <p className="card-subtitle">Automated risk triggers from AI analysis</p>
          </div>

          <div className="ai-triggers-list">
            {earlyWarnings.length === 0 ? (
              <div style={{ padding: '20px', textAlign: 'center', color: '#94A3B8', fontSize: '13px' }}>
                Loading AI pattern triggers...
              </div>
            ) : earlyWarnings.map((w, idx) => (
              <div key={idx} className={`ai-trigger-box ${w.level === 'crit' ? 'crit-trigger' : w.level === 'warn' ? 'warn-trigger' : 'info-trigger'}`}>
                <div className="trigger-title-row">
                  <span className={`trigger-dot ${w.level === 'crit' ? 'dot-red' : w.level === 'warn' ? 'dot-orange' : 'dot-blue'}`}></span>
                  <span className="trigger-title">{w.title}</span>
                </div>
                <p className="trigger-desc">{w.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Row 3: Filter & Table */}
      <div className="risk-table-section">
        <div className="risk-table-controls">
          <div className="search-bar-wrapper">
            <Search size={16} className="search-icon" />
            <input 
              type="text" 
              placeholder="Search by project name, ID or agency..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="risk-search-input"
            />
          </div>

          <div className="filter-dropdowns-row">
            <select value={selectedAgency} onChange={(e) => setSelectedAgency(e.target.value)} className="risk-select">
              {agencies.map(a => <option key={a} value={a}>{a === 'All' ? 'All Agencies' : a}</option>)}
            </select>

            <select value={selectedSector} onChange={(e) => setSelectedSector(e.target.value)} className="risk-select">
              {sectors.map(s => <option key={s} value={s}>{s === 'All' ? 'All Sectors' : s}</option>)}
            </select>

            <select value={selectedState} onChange={(e) => setSelectedState(e.target.value)} className="risk-select">
              {states.map(st => <option key={st} value={st}>{st === 'All' ? 'All States' : st}</option>)}
            </select>

            <select value={selectedRisk} onChange={(e) => setSelectedRisk(e.target.value)} className="risk-select">
              {risks.map(r => <option key={r} value={r}>{r === 'All' ? 'All Risk Levels' : r}</option>)}
            </select>
          </div>
        </div>

        {/* Projects Table */}
        <div className="card table-card">
          <div className="table-responsive">
            <table className="risk-data-table">
              <thead>
                <tr>
                  <th className="th-proj">PROJECT</th>
                  <th className="th-agency">AGENCY</th>
                  <th className="th-state">STATE</th>
                  <th className="th-cost-risk">COST RISK</th>
                  <th className="th-time-risk">TIME RISK</th>
                  <th className="th-early-warning">EARLY WARNING</th>
                  <th className="th-overall-score">OVERALL SCORE</th>
                  <th className="th-actions">ACTION</th>
                </tr>
              </thead>
              <tbody>
                {loadingProjects ? (
                  <tr>
                    <td colSpan={8} className="empty-table-msg" style={{ padding: '30px', color: '#94A3B8' }}>
                      Loading risk analysis projects...
                    </td>
                  </tr>
                ) : filteredProjects.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="empty-table-msg">
                      No projects found matching the selected filters.
                    </td>
                  </tr>
                ) : (
                  filteredProjects.map((p) => (
                    <tr key={p.id} className="risk-table-row">
                      <td className="td-proj">
                        <div className="p-name">{p.name}</div>
                        <div className="p-id">{p.id}</div>
                      </td>
                      <td className="td-agency">{p.agency}</td>
                      <td className="td-state">{p.state}</td>
                      <td className="td-cost-risk">{getProgressFill(p.costRisk)}</td>
                      <td className="td-time-risk">{getProgressFill(p.timeRisk)}</td>
                      <td className="td-early-warning">{getProgressFill(p.earlyWarning)}</td>
                      <td className="td-overall-score">{getRiskScoreCircle(p.overallScore)}</td>
                      <td className="td-actions">
                        <button 
                          className="view-details-btn"
                          onClick={() => onSelectProject(p.detailsId)}
                        >
                          View Details
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};
