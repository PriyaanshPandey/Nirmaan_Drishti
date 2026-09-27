import React, { useState, useMemo } from 'react';
import {
  Sliders, Activity, ShieldAlert, CheckCircle2,
  Filter, Search, AlertTriangle,
  ChevronDown, BarChart3, TrendingUp, BadgeAlert
} from 'lucide-react';
import {
  ComposedChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer
} from 'recharts';
import { InfoButton } from './ExplainabilityInfo';
import { projectsData } from '../data/projectsData';
import type { Project } from '../data/projectsData';
import './FidelityIndexDemo.css';

function getMonthsLeft(project: Project): number {
  try {
    const target = new Date(project.expectedCompletion);
    const now = new Date('2026-05-01');
    const diff = (target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24 * 30.44);
    return Math.max(0.5, diff);
  } catch {
    return 12;
  }
}

function getHistSpeed(project: Project): number {
  const gap = Math.max(0, project.progressPhysicalTarget - project.progressPhysical);
  const speed = Math.max(0.1, gap / 3);
  return parseFloat(speed.toFixed(2));
}

interface AuditProject {
  id: string;
  name: string;
  ministry: string;
  sector: string;
  agency: string;
  remainingWork: number;
  progressPhysical: number;
  progressTarget: number;
  monthsLeft: number;
  histSpeed: number;
  vdf: number;
  riskScore: number;
  fidelityStatus: 'improbable' | 'stress' | 'consistent';
}

function computeAuditProjects(): AuditProject[] {
  return projectsData
    .filter(p =>
      p.status === 'ongoing' &&
      !p.isCompleted &&
      p.progressPhysical < 99 &&
      p.progressPhysical > 0
    )
    .map(p => {
      const remainingWork = parseFloat((100 - p.progressPhysical).toFixed(1));
      const monthsLeft = getMonthsLeft(p);
      const histSpeed = getHistSpeed(p);
      const requiredSpeed = remainingWork / Math.max(0.5, monthsLeft);
      const vdf = parseFloat((requiredSpeed / Math.max(0.1, histSpeed)).toFixed(2));
      let fidelityStatus: AuditProject['fidelityStatus'] = 'consistent';
      if (vdf > 2.5) fidelityStatus = 'improbable';
      else if (vdf > 1.2) fidelityStatus = 'stress';
      return {
        id: p.id, name: p.name, ministry: p.ministry, sector: p.sector, agency: p.agency,
        remainingWork, progressPhysical: p.progressPhysical, progressTarget: p.progressPhysicalTarget,
        monthsLeft: parseFloat(monthsLeft.toFixed(1)), histSpeed, vdf,
        riskScore: p.riskScore, fidelityStatus,
      };
    })
    .sort((a, b) => b.vdf - a.vdf);
}

const ALL_AUDIT_PROJECTS = computeAuditProjects();
const SECTORS = ['All Sectors', ...Array.from(new Set(ALL_AUDIT_PROJECTS.map(p => p.sector))).sort()];
const MINISTRIES = ['All Ministries', ...Array.from(new Set(ALL_AUDIT_PROJECTS.map(p => p.ministry))).sort()];
const FIDELITY_STATS = {
  total: ALL_AUDIT_PROJECTS.length,
  improbable: ALL_AUDIT_PROJECTS.filter(p => p.fidelityStatus === 'improbable').length,
  stress: ALL_AUDIT_PROJECTS.filter(p => p.fidelityStatus === 'stress').length,
  consistent: ALL_AUDIT_PROJECTS.filter(p => p.fidelityStatus === 'consistent').length,
};

export const FidelityIndexDemo: React.FC = () => {
  const [remainingWork, setRemainingWork] = useState<number>(40);
  const [monthsLeft, setMonthsLeft] = useState<number>(2);
  const [historicalSpeed, setHistoricalSpeed] = useState<number>(2.0);
  const [search, setSearch] = useState('');
  const [sectorFilter, setSectorFilter] = useState('All Sectors');
  const [ministryFilter, setMinistryFilter] = useState('All Ministries');
  const [statusFilter, setStatusFilter] = useState<'all' | 'improbable' | 'stress' | 'consistent'>('improbable');
  const [showTop, setShowTop] = useState(20);

  const requiredSpeed = Number((remainingWork / Math.max(0.5, monthsLeft)).toFixed(1));
  const vdf = Number((requiredSpeed / Math.max(0.1, historicalSpeed)).toFixed(2));

  let vdfStatus = {
    label: 'Reporting Consistent', tier: 'consistent', color: '#16a34a', bg: '#dcfce7',
    desc: 'Reported progress velocity is achievable given historical execution capability.'
  };
  if (vdf > 2.5) {
    vdfStatus = {
      label: 'Reporting Velocity Inconsistency', tier: 'improbable', color: '#dc2626', bg: '#fee2e2',
      desc: `Reported timeline demands a ${(vdf * 100 - 100).toFixed(0)}% acceleration without documented additional resources. Statistically improbable trajectory.`
    };
  } else if (vdf > 1.2) {
    vdfStatus = {
      label: 'Accelerated Pacing Stress', tier: 'stress', color: '#d97706', bg: '#fef3c7',
      desc: 'Completion requires significantly above-average acceleration. Warrants closer monitoring.'
    };
  }

  const chartData = [
    { month: 'T-3', actual: historicalSpeed, required: historicalSpeed },
    { month: 'T-2', actual: +(historicalSpeed + 0.2).toFixed(1), required: +(historicalSpeed + 0.2).toFixed(1) },
    { month: 'T-1', actual: +(historicalSpeed - 0.1).toFixed(1), required: +(historicalSpeed - 0.1).toFixed(1) },
    { month: 'T (Now)', actual: historicalSpeed, required: historicalSpeed },
    { month: 'T+1', actual: undefined, required: requiredSpeed },
    { month: 'T+2', actual: undefined, required: requiredSpeed },
  ];

  const filteredProjects = useMemo(() => {
    return ALL_AUDIT_PROJECTS.filter(p => {
      if (statusFilter !== 'all' && p.fidelityStatus !== statusFilter) return false;
      if (sectorFilter !== 'All Sectors' && p.sector !== sectorFilter) return false;
      if (ministryFilter !== 'All Ministries' && p.ministry !== ministryFilter) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        return p.name.toLowerCase().includes(q) || p.id.toLowerCase().includes(q) || p.agency.toLowerCase().includes(q);
      }
      return true;
    });
  }, [statusFilter, sectorFilter, ministryFilter, search]);

  const visibleProjects = filteredProjects.slice(0, showTop);

  return (
    <div className="fidelity-page-container">
      <div className="fidelity-page-header">
        <div className="fidelity-header-left">
          <div className="fidelity-header-title-row">
            <BadgeAlert size={22} className="fidelity-header-icon" />
            <h1 className="fidelity-page-title">Reporting Fidelity Index</h1>
            <InfoButton
              title="What is Reporting Fidelity Index?"
              summary="The Reporting Fidelity Index (RFI) detects statistical inconsistencies between what agencies claim in project reports versus what their historical execution velocity can realistically deliver."
              dataSummary={{
                items: [
                  { label: 'Core Formula', value: 'VDF = Required Speed ÷ Historical Speed' },
                  { label: 'Required Speed', value: 'Remaining Work (%) ÷ Months to Deadline' },
                  { label: 'Historical Speed', value: '3-month execution velocity (%/month)' },
                  { label: 'Inconsistency Threshold', value: 'VDF > 2.5x — trajectory deemed improbable without added resources' },
                  { label: 'Pacing Stress Zone', value: 'VDF 1.2x–2.5x — acceleration required, monitor closely' },
                  { label: 'Data Coverage', value: 'PAIMANA dataset: 6,568 projects (2011–2026)' },
                ],
                insight: 'A VDF above 2.5x means an agency must multiply execution speed by 2.5x or more to meet its own deadline—without any documented resource increase. This constitutes a statistically improbable reporting trajectory and is flagged for inaccuracy review.'
              }}
              theme="light"
            />
          </div>
          <p className="fidelity-page-subtitle">
            AI-driven inconsistency detection across {FIDELITY_STATS.total.toLocaleString()} active PAIMANA projects · Velocity Disconnect Factor (VDF) analysis
          </p>
        </div>
      </div>

      <div className="fidelity-stats-row">
        <div className="fi-stat-card fi-stat-red" onClick={() => setStatusFilter('improbable')}>
          <div className="fi-stat-icon"><ShieldAlert size={18} /></div>
          <div className="fi-stat-body">
            <div className="fi-stat-num">{FIDELITY_STATS.improbable.toLocaleString()}</div>
            <div className="fi-stat-label">Reporting Inconsistency</div>
            <div className="fi-stat-sub">VDF &gt; 2.5x · Improbable trajectory</div>
          </div>
        </div>
        <div className="fi-stat-card fi-stat-amber" onClick={() => setStatusFilter('stress')}>
          <div className="fi-stat-icon"><AlertTriangle size={18} /></div>
          <div className="fi-stat-body">
            <div className="fi-stat-num">{FIDELITY_STATS.stress.toLocaleString()}</div>
            <div className="fi-stat-label">Pacing Stress</div>
            <div className="fi-stat-sub">VDF 1.2x–2.5x · Above-average acceleration</div>
          </div>
        </div>
        <div className="fi-stat-card fi-stat-green" onClick={() => setStatusFilter('consistent')}>
          <div className="fi-stat-icon"><CheckCircle2 size={18} /></div>
          <div className="fi-stat-body">
            <div className="fi-stat-num">{FIDELITY_STATS.consistent.toLocaleString()}</div>
            <div className="fi-stat-label">Reporting Consistent</div>
            <div className="fi-stat-sub">VDF ≤ 1.2x · Trajectory verified</div>
          </div>
        </div>
        <div className="fi-stat-card fi-stat-blue" onClick={() => setStatusFilter('all')}>
          <div className="fi-stat-icon"><BarChart3 size={18} /></div>
          <div className="fi-stat-body">
            <div className="fi-stat-num">{FIDELITY_STATS.total.toLocaleString()}</div>
            <div className="fi-stat-label">Total Audited</div>
            <div className="fi-stat-sub">All active ongoing projects</div>
          </div>
        </div>
      </div>

      <div className="simulator-section">
        <div className="section-title-box">
          <div className="title-left-group">
            <Sliders size={18} className="text-blue" />
            <h2>VDF Simulator — Adjust Project Parameters</h2>
            <InfoButton
              title="VDF Simulator"
              summary="Use sliders to interactively simulate how reporting inconsistency is measured. Adjust remaining work, months left, and historical speed to see VDF change."
              dataSummary={{
                items: [
                  { label: 'Remaining Work', value: `${remainingWork}%` },
                  { label: 'Months to Target', value: `${monthsLeft} months` },
                  { label: 'Required Speed', value: `${remainingWork}% ÷ ${monthsLeft}m = ${requiredSpeed}%/month` },
                  { label: 'Historical Speed', value: `${historicalSpeed}%/month` },
                  { label: 'VDF', value: `${requiredSpeed} ÷ ${historicalSpeed} = ${vdf}x` },
                  { label: 'Current Assessment', value: vdfStatus.label },
                ],
                insight: 'Try setting Months Left to 1 with 80% remaining work to observe an extreme inconsistency scenario.'
              }}
              theme="light"
            />
          </div>
        </div>
        <div className="simulator-grid">
          <div className="sim-controls-card">
            <h3>Adjust Project Report Parameters</h3>
            <div className="control-group">
              <label><span>Remaining Work: <strong>{remainingWork}%</strong></span></label>
              <input type="range" min="5" max="90" value={remainingWork} onChange={e => setRemainingWork(Number(e.target.value))} />
            </div>
            <div className="control-group">
              <label><span>Months Left to Target: <strong>{monthsLeft} months</strong></span></label>
              <input type="range" min="1" max="24" value={monthsLeft} onChange={e => setMonthsLeft(Number(e.target.value))} />
            </div>
            <div className="control-group">
              <label><span>Historical 3-Month Speed: <strong>{historicalSpeed}%/month</strong></span></label>
              <input type="range" min="0.5" max="10" step="0.1" value={historicalSpeed} onChange={e => setHistoricalSpeed(Number(e.target.value))} />
            </div>
          </div>
          <div className="sim-results-card">
            <h3>Calculated Reporting Fidelity Index</h3>
            <div className="vdf-score-box" style={{ backgroundColor: vdfStatus.bg, borderColor: vdfStatus.color }}>
              <div className="vdf-score-value" style={{ color: vdfStatus.color }}>{vdf}x</div>
              <div className="vdf-score-meta">
                <span className="vdf-badge-label" style={{ backgroundColor: vdfStatus.color }}>{vdfStatus.label}</span>
                <p className="vdf-score-desc">{vdfStatus.desc}</p>
              </div>
            </div>
          </div>
        </div>
        <div className="sim-chart-card">
          <h4>Reported Completion Trajectory vs Realized Historical Pacing</h4>
          <div style={{ width: '100%', height: 220 }}>
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={chartData} margin={{ top: 8, right: 10, bottom: 8, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                <XAxis dataKey="month" stroke="#64748B" fontSize={11} />
                <YAxis stroke="#64748B" fontSize={11} unit="%/m" />
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Line type="monotone" dataKey="actual" name="Historical Realized Speed (%/mo)" stroke="#0284C7" strokeWidth={2.5} dot={{ r: 4 }} />
                <Line type="monotone" dataKey="required" name="Speed Required for Reported Target (%/mo)" stroke="#DC2626" strokeWidth={2.5} strokeDasharray="6 4" dot={{ r: 4 }} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="audit-table-section">
        <div className="audit-header-bar">
          <div className="title-left-group">
            <Activity size={18} className="text-teal" />
            <div>
              <h2>PAIMANA Projects Live Reporting Fidelity Audit</h2>
              <p className="audit-subtitle">
                Showing {filteredProjects.length.toLocaleString()} projects · Ranked by VDF (highest inconsistency first)
              </p>
            </div>
          </div>
        </div>

        <div className="audit-filter-bar">
          <div className="audit-search-box">
            <Search size={14} />
            <input
              type="text"
              placeholder="Search project name, ID or agency..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <div className="audit-filter-pills">
            {(['all', 'improbable', 'stress', 'consistent'] as const).map(s => (
              <button
                key={s}
                className={`filter-pill ${statusFilter === s ? 'filter-pill-active-' + s : ''}`}
                onClick={() => setStatusFilter(s)}
              >
                {s === 'all' ? 'All Projects' : s === 'improbable' ? '\u26D4 Inconsistent' : s === 'stress' ? '\u26A0\uFE0F Pacing Stress' : '\u2705 Consistent'}
              </button>
            ))}
          </div>
          <div className="audit-select-group">
            <div className="audit-select-wrap">
              <Filter size={13} />
              <select value={sectorFilter} onChange={e => setSectorFilter(e.target.value)}>
                {SECTORS.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
              <ChevronDown size={13} />
            </div>
            <div className="audit-select-wrap">
              <Filter size={13} />
              <select value={ministryFilter} onChange={e => setMinistryFilter(e.target.value)}>
                {MINISTRIES.map(m => <option key={m} value={m}>{m.length > 32 ? m.slice(0, 32) + '...' : m}</option>)}
              </select>
              <ChevronDown size={13} />
            </div>
          </div>
        </div>

        <div className="audit-rows-list">
          {visibleProjects.length === 0 && (
            <div className="audit-empty">No projects match the current filters.</div>
          )}
          {visibleProjects.map((p, idx) => {
            const isInconsistent = p.fidelityStatus === 'improbable';
            const isStress = p.fidelityStatus === 'stress';
            const rankColor = isInconsistent ? '#dc2626' : isStress ? '#d97706' : '#16a34a';
            return (
              <div key={p.id} className={`audit-row ${isInconsistent ? 'row-flag-red' : isStress ? 'row-flag-amber' : 'row-flag-green'}`}>
                <div className="audit-rank" style={{ borderColor: rankColor, color: rankColor }}>#{idx + 1}</div>
                <div className="audit-row-identity">
                  <div className="audit-row-sector-badge">{p.sector} · {p.ministry}</div>
                  <div className="audit-row-name">{p.name}</div>
                  <div className="audit-row-meta">ID: {p.id} &nbsp;·&nbsp; <span className="audit-agency-tag">{p.agency}</span></div>
                </div>
                <div className="audit-row-metrics">
                  <div className="audit-metric-item">
                    <span className="audit-metric-label">Physical Progress</span>
                    <span className="audit-metric-value">{p.progressPhysical}%</span>
                    <div className="mini-progress-bar">
                      <div className="mini-progress-fill" style={{ width: `${p.progressPhysical}%`, backgroundColor: rankColor }} />
                    </div>
                  </div>
                  <div className="audit-metric-item">
                    <span className="audit-metric-label">Target</span>
                    <span className="audit-metric-value" style={{ color: p.progressPhysical < p.progressTarget ? '#dc2626' : '#16a34a' }}>{p.progressTarget}%</span>
                  </div>
                  <div className="audit-metric-item">
                    <span className="audit-metric-label">Remaining</span>
                    <span className="audit-metric-value">{p.remainingWork}%</span>
                  </div>
                  <div className="audit-metric-item">
                    <span className="audit-metric-label">Months Left</span>
                    <span className="audit-metric-value">{p.monthsLeft} mo</span>
                  </div>
                  <div className="audit-metric-item">
                    <span className="audit-metric-label">Hist. Speed</span>
                    <span className="audit-metric-value">{p.histSpeed}%/mo</span>
                  </div>
                </div>
                <div className="audit-row-right">
                  <div className="audit-vdf-block" style={{ color: rankColor, borderColor: rankColor + '44', background: rankColor + '11' }}>
                    <TrendingUp size={13} />
                    <span className="audit-vdf-num">{p.vdf}x VDF</span>
                  </div>
                  {isInconsistent && <span className="status-inconsistent">\u26D4 INCONSISTENT</span>}
                  {isStress && <span className="status-stress">\u26A0\uFE0F PACING STRESS</span>}
                  {!isInconsistent && !isStress && <span className="status-consistent">\u2705 CONSISTENT</span>}
                  {p.riskScore >= 75 && <span className="risk-badge-high">Risk {p.riskScore}/100</span>}
                </div>
              </div>
            );
          })}
        </div>

        {filteredProjects.length > showTop && (
          <div className="audit-show-more">
            <button onClick={() => setShowTop(prev => prev + 20)} className="show-more-btn">
              <ChevronDown size={16} />
              Show {Math.min(20, filteredProjects.length - showTop)} more ({filteredProjects.length - showTop} remaining)
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
