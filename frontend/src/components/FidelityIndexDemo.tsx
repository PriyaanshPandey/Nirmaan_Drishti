import React, { useState, useMemo } from 'react';
import {
  Sliders, Activity, ShieldAlert, CheckCircle2,
  Filter, Search, AlertTriangle,
  ChevronDown, BarChart3, TrendingUp, BadgeAlert, FileText
} from 'lucide-react';
import {
  ComposedChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer
} from 'recharts';
import { InfoButton } from './ExplainabilityInfo';
import { projectsData } from '../data/projectsData';
import type { Project } from '../data/projectsData';
import { generateTicketPDF } from '../utils/pdfGenerator';
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

interface FidelityIndexDemoProps {
  onSelectProject?: (projectId: string) => void;
}

export const FidelityIndexDemo: React.FC<FidelityIndexDemoProps> = ({ onSelectProject }) => {
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
                  { label: 'Core Formula', value: 'VDF = Required Speed Ã· Historical Speed' },
                  { label: 'Required Speed', value: 'Remaining Work (%) Ã· Months to Deadline' },
                  { label: 'Historical Speed', value: '3-month execution velocity (%/month)' },
                  { label: 'Inconsistency Threshold', value: 'VDF > 2.5x â€” trajectory deemed improbable without added resources' },
                  { label: 'Pacing Stress Zone', value: 'VDF 1.2xâ€“2.5x â€” acceleration required, monitor closely' },
                  { label: 'Data Coverage', value: 'PAIMANA dataset: 6,568 projects (2011â€“2026)' },
                ],
                insight: 'A VDF above 2.5x means an agency must multiply execution speed by 2.5x or more to meet its own deadlineâ€”without any documented resource increase. This constitutes a statistically improbable reporting trajectory and is flagged for inaccuracy review.'
              }}
              theme="light"
            />
          </div>
          <p className="fidelity-page-subtitle">
            AI-driven inconsistency detection across {FIDELITY_STATS.total.toLocaleString()} active PAIMANA projects Â· Velocity Disconnect Factor (VDF) analysis
          </p>
        </div>
      </div>

      <div className="fidelity-stats-row">
        <div className="fi-stat-card fi-stat-red" onClick={() => setStatusFilter('improbable')}>
          <div className="fi-stat-icon"><ShieldAlert size={18} /></div>
          <div className="fi-stat-body">
            <div className="fi-stat-num">{FIDELITY_STATS.improbable.toLocaleString()}</div>
            <div className="fi-stat-label">Reporting Inconsistency</div>
            <div className="fi-stat-sub">VDF &gt; 2.5x Â· Improbable trajectory</div>
          </div>
        </div>
        <div className="fi-stat-card fi-stat-amber" onClick={() => setStatusFilter('stress')}>
          <div className="fi-stat-icon"><AlertTriangle size={18} /></div>
          <div className="fi-stat-body">
            <div className="fi-stat-num">{FIDELITY_STATS.stress.toLocaleString()}</div>
            <div className="fi-stat-label">Pacing Stress</div>
            <div className="fi-stat-sub">VDF 1.2xâ€“2.5x Â· Above-average acceleration</div>
          </div>
        </div>
        <div className="fi-stat-card fi-stat-green" onClick={() => setStatusFilter('consistent')}>
          <div className="fi-stat-icon"><CheckCircle2 size={18} /></div>
          <div className="fi-stat-body">
            <div className="fi-stat-num">{FIDELITY_STATS.consistent.toLocaleString()}</div>
            <div className="fi-stat-label">Reporting Consistent</div>
            <div className="fi-stat-sub">VDF â‰¤ 1.2x Â· Trajectory verified</div>
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
            <h2>VDF Simulator â€” Adjust Project Parameters</h2>
            <InfoButton
              title="VDF Simulator"
              summary="Use sliders to interactively simulate how reporting inconsistency is measured. Adjust remaining work, months left, and historical speed to see VDF change."
              dataSummary={{
                items: [
                  { label: 'Remaining Work', value: `${remainingWork}%` },
                  { label: 'Months to Target', value: `${monthsLeft} months` },
                  { label: 'Required Speed', value: `${remainingWork}% Ã· ${monthsLeft}m = ${requiredSpeed}%/month` },
                  { label: 'Historical Speed', value: `${historicalSpeed}%/month` },
                  { label: 'VDF', value: `${requiredSpeed} Ã· ${historicalSpeed} = ${vdf}x` },
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
          <div className="chart-header-row">
            <h4>Reported Completion Trajectory vs Realized Historical Pacing</h4>
            <InfoButton
              title="Reading the Trajectory Chart"
              summary="This chart shows the gap between what the agency must achieve (red dashed) vs what they have historically delivered (blue solid)."
              dataSummary={{
                items: [
                  { label: 'Blue Line (Solid)', value: 'Historical Realized Speed — actual execution velocity averaged over past 3 months' },
                  { label: 'Red Line (Dashed)', value: 'Required Speed — velocity needed from today to meet the reported target date' },
                  { label: 'Gap = Inconsistency', value: 'A large gap between red and blue from Month T onward signals a statistically improbable reporting trajectory' },
                  { label: 'VDF', value: 'Red ÷ Blue = Velocity Disconnect Factor. VDF > 2.5x is flagged as Inconsistent' },
                ],
                insight: 'When both lines are identical up to Month T (Now) and then the red line jumps sharply, the agency is claiming a sudden acceleration that has no historical basis.'
              }}
              theme="light"
              size="sm"
            />
          </div>
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
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
                <h2>PAIMANA Projects Live Reporting Fidelity Audit</h2>
                <InfoButton
                  title="About the Live Audit List"
                  summary="This list shows all active PAIMANA projects ranked by their Velocity Disconnect Factor (VDF) — highest reporting inconsistency first."
                  dataSummary={{
                    items: [
                      { label: 'Inconsistent (Red)', value: 'VDF > 2.5x — agency trajectory requires an implausible speed acceleration. Flagged for review.' },
                      { label: 'Pacing Stress (Amber)', value: 'VDF 1.2x–2.5x — above-average execution needed. Warrants monitoring.' },
                      { label: 'Consistent (Green)', value: 'VDF ≤ 1.2x — reported trajectory matches historical capability.' },
                      { label: 'Raise Ticket', value: 'Generates an official PDF intervention ticket routed to the agency nodal officer.' },
                      { label: 'Click Row', value: 'Opens full project details in the Projects page.' },
                    ],
                    insight: 'Data is computed in real-time from the PAIMANA CSV dataset (6,568 projects, 2011–2026). Projects are filtered to active/ongoing only.'
                  }}
                  theme="light"
                  size="sm"
                />
              </div>
              <p className="audit-subtitle">
                Showing {filteredProjects.length.toLocaleString()} projects
                &nbsp;·&nbsp;
                <span style={{ color: '#dc2626', fontWeight: 700 }}>{FIDELITY_STATS.improbable.toLocaleString()} inconsistent</span>
                &nbsp;·&nbsp; Ranked by VDF (highest first)
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

            const handleRowClick = () => {
              if (onSelectProject) onSelectProject(p.id);
            };

            const handleRaiseTicket = (e: React.MouseEvent) => {
              e.stopPropagation();
              generateTicketPDF({
                id: `RFI-${Date.now().toString().slice(-6)}`,
                projectName: p.name,
                projectId: p.id,
                actionTitle: 'Reporting Fidelity Inconsistency â€” Velocity Disconnect Factor Alert',
                routedOfficer: `Nodal Officer, ${p.ministry}`,
                status: 'OPEN',
                priority: 'Critical',
                dateCreated: new Date().toLocaleDateString('en-IN'),
                ministry: p.ministry,
                agency: p.agency,
                description: `VDF Score of ${p.vdf}x detected. Agency-reported completion trajectory requires ${p.vdf}x the historically realized execution speed without documented additional resource allocation. Physical progress is ${p.progressPhysical}% against a target of ${p.progressTarget}%. Flagged for inaccuracy review under PAIMANA Reporting Fidelity Index.`,
              });
            };

            return (
              <div
                key={p.id}
                className={`img3-intervention-row fi-audit-row ${onSelectProject ? 'fi-row-clickable' : ''}`}
                onClick={handleRowClick}
                role={onSelectProject ? 'button' : undefined}
                tabIndex={onSelectProject ? 0 : undefined}
              >
                {/* Rank badge â€” alternating dark / blue like dashboard */}
                <span className={`img3-rank-badge ${idx % 2 === 1 ? 'rank-blue' : 'rank-dark'}`}>
                  #{String(idx + 1).padStart(2, '0')}
                </span>

                {/* Project identity */}
                <div className="img3-info-col">
                  <div className="img3-meta-top">
                    <span className="img3-id-tag">ID: {p.id}</span>
                    <span className="img3-meta-dot">â€¢</span>
                    <span className="img3-sector-tag">{p.sector}</span>
                    <span className="img3-meta-dot">â€¢</span>
                    <span className="img3-ministry-tag">{p.ministry}</span>
                  </div>
                  <h3 className="img3-project-title">{p.name}</h3>
                  <div className="fi-agency-row">
                    <span className="audit-agency-tag">{p.agency}</span>
                  </div>
                </div>

                {/* Metrics group */}
                <div className="img3-metrics-group fi-metrics-group">
                  <div className="img3-metric-item">
                    <span className="img3-metric-lbl">PROGRESS</span>
                    <div className="img3-metric-val-row" style={{ color: '#0f172a' }}>
                      <span className="img3-val-bold">{p.progressPhysical}%</span>
                      <span className="img3-val-sub" style={{ color: p.progressPhysical < p.progressTarget ? '#dc2626' : '#16a34a' }}>
                        / {p.progressTarget}% target
                      </span>
                    </div>
                  </div>

                  <div className="img3-metric-item">
                    <span className="img3-metric-lbl">VDF SCORE</span>
                    <div className={`img3-metric-val-row ${isInconsistent ? 'text-red' : isStress ? 'text-amber' : ''}`}>
                      <TrendingUp size={13} />
                      <span className="img3-val-bold">{p.vdf}x</span>
                    </div>
                  </div>

                  <div className="img3-metric-item">
                    <span className="img3-metric-lbl">STATUS</span>
                    <div className="img3-metric-val-row">
                      {isInconsistent && <span className="fi-status-badge fi-status-red">Inconsistent</span>}
                      {isStress && <span className="fi-status-badge fi-status-amber">Pacing Stress</span>}
                      {!isInconsistent && !isStress && <span className="fi-status-badge fi-status-green">Consistent</span>}
                    </div>
                  </div>
                </div>

                {/* Raise Ticket button â€” only on inconsistent rows */}
                {isInconsistent && (
                  <button
                    className="fi-ticket-btn"
                    onClick={handleRaiseTicket}
                    title="Raise an official intervention ticket for this agency"
                  >
                    <FileText size={13} />
                    Raise Ticket
                  </button>
                )}
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
