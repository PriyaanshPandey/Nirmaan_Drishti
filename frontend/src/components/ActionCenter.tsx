import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
  ShieldAlert, Activity, ArrowLeft, ArrowRight, Building2, MapPin,
  ChevronDown, Sliders, CheckCircle2, FileText, Send, Sparkles,
  Info, Landmark, ChevronRight, ChevronLeft, ArrowUp, Search
} from 'lucide-react';
import './ActionCenter.css';
import { projectsData } from '../data/projectsData';
import { InfoButton } from './ExplainabilityInfo';

export interface ActionCenterProps {
  activeTab?: string;
  selectedProjectId?: string | null;
  onSelectProject: (projectId: string, initialSection?: string) => void;
  onNavigateTab?: (tab: string) => void;
  onTakeAction?: (projectId: string) => void;
  onClearSelectedProject?: () => void;
}

type ActionSidebarSection = 'actions' | 'simulator' | 'routing';

export const ActionCenter: React.FC<ActionCenterProps> = ({
  activeTab,
  selectedProjectId,
  onSelectProject,
  onClearSelectedProject
}) => {
  // State A: Filters & Controls
  const [countLimit, setCountLimit] = useState<5 | 10 | 999>(5);
  const [selectedMinistry, setSelectedMinistry] = useState<string>('All');
  const [selectedSector, setSelectedSector] = useState<string>('All');
  const [selectedAgency, setSelectedAgency] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // State B: Active Action Target Project
  const [internalTargetId, setInternalTargetId] = useState<string | null>(null);
  const activeProjectId = selectedProjectId || internalTargetId;

  // State B Sidebar Navigation
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(true);
  const [activeSection, setActiveSection] = useState<ActionSidebarSection>('actions');

  // Interactive What-If Simulator Sliders (State B)
  const [sliderOutlay, setSliderOutlay] = useState<number>(15); // +0% to +50%
  const [sliderWorkforce, setSliderWorkforce] = useState<number>(30); // +0% to +100%
  const [sliderClearance, setSliderClearance] = useState<number>(60); // 0 to 180 days
  const [sliderVendor, setSliderVendor] = useState<number>(20); // +0% to +50%

  // Toast / Modal Feedback State
  const [actionToast, setActionToast] = useState<string | null>(null);

  const triggerToast = (msg: string) => {
    setActionToast(msg);
    setTimeout(() => setActionToast(null), 3500);
  };

  // Reset simulator sliders when project changes
  useEffect(() => {
    setSliderOutlay(15);
    setSliderWorkforce(30);
    setSliderClearance(60);
    setSliderVendor(20);
  }, [activeProjectId]);

  // Extract unique Ministries, Sectors, and Agencies
  const { allMinistries, allSectors, allAgencies } = useMemo(() => {
    const minSet = new Set<string>();
    const secSet = new Set<string>();
    const agnSet = new Set<string>();

    projectsData.forEach(p => {
      if (p.ministry) minSet.add(p.ministry.trim());
      if (p.sector) secSet.add(p.sector.trim());
      if (p.agency) agnSet.add(p.agency.trim());
    });

    return {
      allMinistries: Array.from(minSet).sort(),
      allSectors: Array.from(secSet).sort(),
      allAgencies: Array.from(agnSet).sort()
    };
  }, []);

  // Filtered & Ranked Projects List for State A
  const filteredProjects = useMemo(() => {
    return projectsData
      .filter(p => {
        if (selectedMinistry !== 'All' && p.ministry?.trim() !== selectedMinistry) return false;
        if (selectedSector !== 'All' && p.sector?.trim() !== selectedSector) return false;
        if (selectedAgency !== 'All' && p.agency?.trim() !== selectedAgency) return false;
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          const matchName = p.name.toLowerCase().includes(q);
          const matchId = p.id.toLowerCase().includes(q);
          const matchMin = (p.ministry || '').toLowerCase().includes(q);
          if (!matchName && !matchId && !matchMin) return false;
        }
        return true;
      })
      .sort((a, b) => {
        const rA = a.riskScore ?? 50;
        const rB = b.riskScore ?? 50;
        if (rB !== rA) return rB - rA;

        const origA = parseFloat(a.costApproved.replace(/[^0-9.]/g, '')) || 0;
        const revA = parseFloat(a.costRevised.replace(/[^0-9.]/g, '')) || 0;
        const deltaA = revA - origA;

        const origB = parseFloat(b.costApproved.replace(/[^0-9.]/g, '')) || 0;
        const revB = parseFloat(b.costRevised.replace(/[^0-9.]/g, '')) || 0;
        const deltaB = revB - origB;

        return deltaB - deltaA;
      });
  }, [selectedMinistry, selectedSector, selectedAgency, searchQuery]);

  const displayedProjects = useMemo(() => {
    if (countLimit === 999) return filteredProjects;
    return filteredProjects.slice(0, countLimit);
  }, [filteredProjects, countLimit]);

  // Active Project Data for State B
  const activeProj = useMemo(() => {
    if (!activeProjectId) return null;
    return projectsData.find(p => p.id === activeProjectId) || projectsData[0];
  }, [activeProjectId]);

  // Calculate Real-Time Dynamic What-If Simulation Results for activeProj
  const simResults = useMemo(() => {
    if (!activeProj) {
      return {
        baseOutlay: 0,
        simOutlay: 0,
        deltaOutlay: 0,
        baseDelay: 0,
        simDelay: 0,
        monthsSaved: 0,
        baseRisk: 50,
        simRisk: 30,
        exposureSavedCr: 0
      };
    }

    const origCost = parseFloat(activeProj.costApproved.replace(/[^0-9.]/g, '')) || 0;
    const baseOutlay = parseFloat(activeProj.costRevised.replace(/[^0-9.]/g, '')) || origCost || 1000;
    const baseDelay = activeProj.timeOverrunMonths ?? 18;
    const baseRisk = activeProj.riskScore ?? 75;

    // Sliders effect:
    const deltaOutlayCr = Math.round(baseOutlay * (sliderOutlay / 100));
    const simOutlayCr = Math.round(baseOutlay + deltaOutlayCr);

    const workforceSavedMo = (sliderWorkforce / 100) * 0.25 * baseDelay;
    const clearanceSavedMo = sliderClearance / 30;
    const vendorSavedMo = (sliderVendor / 100) * 0.2 * baseDelay;

    const rawMonthsSaved = workforceSavedMo + clearanceSavedMo + vendorSavedMo;
    const monthsSaved = Math.min(Math.round(baseDelay * 0.85), parseFloat(rawMonthsSaved.toFixed(1)));
    const simDelay = Math.max(0, Math.round(baseDelay - monthsSaved));

    const riskDrop = (monthsSaved / (baseDelay || 1)) * 38 + (sliderOutlay / 100) * 12;
    const simRisk = Math.max(18, Math.round(baseRisk - riskDrop));

    const exposureSavedCr = Math.round(baseOutlay * 0.006 * monthsSaved + deltaOutlayCr * 0.15);

    return {
      baseOutlay,
      simOutlay: simOutlayCr,
      deltaOutlay: deltaOutlayCr,
      baseDelay,
      simDelay,
      monthsSaved,
      baseRisk,
      simRisk,
      exposureSavedCr
    };
  }, [activeProj, sliderOutlay, sliderWorkforce, sliderClearance, sliderVendor]);

  // Calculate Policy-Aware Authority Routing Tier for activeProj
  const authorityRouting = useMemo(() => {
    if (!activeProj) return { tierNum: 2, title: 'SCOC Committee', code: 'TIER-2' };
    const outlay = simResults.baseOutlay;
    const delay = activeProj.timeOverrunMonths ?? 12;

    if (outlay >= 1000 || delay >= 12) {
      return {
        tierNum: 4,
        title: 'Cabinet Committee on Economic Affairs (CCEA) & PMG Secretariat',
        code: 'GOVT-TIER-4-CCEA',
        body: 'Highest Apex Executive Authority (Chaired by Prime Minister / Cabinet Secretary). Mandatory for projects exceeding ₹1,000 Cr outlay or >12 months time slippage.',
        officials: 'Cabinet Secretary, Secretary DPIIT, PMG Cell Lead',
        mandate: 'CCEA Revised Cost Estimate (RCE-II) Approval & Inter-Ministerial Fast-Track Directive'
      };
    } else if (outlay >= 150 || delay >= 3) {
      return {
        tierNum: 2,
        title: 'Standing Committee on Time & Cost Overruns (SCOC)',
        code: 'GOVT-TIER-2-SCOC',
        body: 'Departmental Oversight Body (Chaired by Additional Secretary / Joint Secretary). Empowered to authorize scope realignments up to 20% and approve revised schedules.',
        officials: 'Additional Secretary (Infrastructure), Financial Advisor, NITI Aayog Representative',
        mandate: 'SCOC Direct Administrative Order & Supplemental Outlay Clearance'
      };
    } else {
      return {
        tierNum: 1,
        title: 'Project Implementation Unit (PIU) & Project Director',
        code: 'GOVT-TIER-1-PIU',
        body: 'Executive Field Level Authority. Responsible for daily site facilitation, contractor mobilization notices, and regional administrative coordination.',
        officials: 'Chief Engineer / Project Director, Zonal General Manager',
        mandate: 'PIU On-Site Acceleration Directive & Contractor Performance Notice'
      };
    }
  }, [activeProj, simResults.baseOutlay]);

  // Helper to format cost strings
  const formatCostClean = (val: string) => {
    if (!val) return '0.00';
    return val.replace(/Cr/gi, '').trim();
  };

  // Smooth scroll handler inside State B
  const scrollToSection = useCallback((secId: ActionSidebarSection) => {
    setActiveSection(secId);
    const el = document.getElementById(`ac-sec-${secId}`);
    if (el) {
      const headerOffset = 88;
      const elementTop = el.getBoundingClientRect().top + window.scrollY;
      window.scrollTo({ top: elementTop - headerOffset, behavior: 'smooth' });
    }
  }, []);

  return (
    <div className="ac-page-layout animation-fade-in">
      {/* Toast Notification Banner */}
      {actionToast && (
        <div className="ac-toast-banner">
          <CheckCircle2 size={16} color="#10B981" />
          <span>{actionToast}</span>
        </div>
      )}

      {/* ── STATE B: SINGLE PROJECT ACTION WORKSPACE ── */}
      {activeProj ? (
        <div className="ac-workspace-container">
          {/* Portaled Navigation Sidebar for Action Center State B */}
          {activeTab === 'action-centre' && typeof document !== 'undefined' && createPortal(
            <aside className={`pnav ${sidebarCollapsed ? 'pnav--collapsed' : ''}`} aria-label="Action Navigation">
              <div className="pnav__card">
                {/* Header */}
                <div className="pnav__brand">
                  {!sidebarCollapsed && (
                    <div className="pnav__brand-text">
                      <ShieldAlert size={14} className="pnav__brand-icon" />
                      <span>Action Navigation</span>
                    </div>
                  )}
                  <button
                    className="pnav__toggle"
                    onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
                    title={sidebarCollapsed ? "Expand Navigation" : "Collapse Navigation"}
                  >
                    {sidebarCollapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
                  </button>
                </div>

                {/* Risk score gauge */}
                {!sidebarCollapsed && (
                  <div className="pnav__gauge">
                    <div className="pnav__gauge-row">
                      <span className="pnav__gauge-label">ML Risk Score</span>
                      <span className="pnav__gauge-val" style={{ color: activeProj.riskScore >= 75 ? '#DC2626' : '#D97706' }}>
                        {activeProj.riskScore >= 75 ? 'Critical' : 'High'}
                      </span>
                    </div>
                    <div className="pnav__gauge-num" style={{ color: activeProj.riskScore >= 75 ? '#DC2626' : '#D97706' }}>
                      {activeProj.riskScore}
                      <span className="pnav__gauge-denom">/100</span>
                    </div>
                    <div className="pnav__gauge-track">
                      <div className="pnav__gauge-fill" style={{ width: `${activeProj.riskScore}%`, background: activeProj.riskScore >= 75 ? '#DC2626' : '#D97706' }} />
                    </div>
                  </div>
                )}

                <div className="pnav__sep" />

                {/* Nav Items */}
                <nav className="pnav__nav">
                  {[
                    { id: 'actions' as ActionSidebarSection, label: 'Recommended Actions', desc: 'AI Interventions', num: '01', icon: ShieldAlert },
                    { id: 'simulator' as ActionSidebarSection, label: 'What-If Simulator', desc: 'Counterfactual Model', num: '02', icon: Sliders },
                    { id: 'routing' as ActionSidebarSection, label: 'Authority Routing', desc: 'Govt Governance Matrix', num: '03', icon: Landmark }
                  ].map((sec) => {
                    const isActive = activeSection === sec.id;
                    const Icon = sec.icon;
                    return (
                      <button
                        key={sec.id}
                        className={`pnav__item ${isActive ? 'pnav__item--active' : ''}`}
                        onClick={() => scrollToSection(sec.id)}
                        title={sidebarCollapsed ? sec.label : undefined}
                      >
                        <span className="pnav__pill" />
                        {!sidebarCollapsed && <span className="pnav__num">{sec.num}</span>}
                        <span className={`pnav__icon ${isActive ? 'pnav__icon--active' : ''}`}>
                          <Icon size={15} strokeWidth={isActive ? 2.5 : 1.75} />
                        </span>
                        {!sidebarCollapsed && (
                          <span className="pnav__text">
                            <span className="pnav__label">{sec.label}</span>
                            {isActive && <span className="pnav__desc pnav__desc--in">{sec.desc}</span>}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </nav>

                <div className="pnav__sep" style={{ marginTop: 'auto' }} />

                {/* Footer */}
                <div className="pnav__footer">
                  <button className="pnav__ftr-btn" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} title="Back to Top">
                    <ArrowUp size={13} />
                    {!sidebarCollapsed && <span>Top</span>}
                  </button>
                </div>
              </div>
            </aside>,
            document.body
          )}

          {/* Top Back & Action Target Banner */}
          <div className="ac-target-header-banner">
            <button
              type="button"
              className="ac-back-btn"
              onClick={() => {
                if (onClearSelectedProject) onClearSelectedProject();
                setInternalTargetId(null);
              }}
            >
              <ArrowLeft size={15} />
              <span>Back to Action Targets</span>
            </button>

            <div className="ac-target-title-block">
              <div className="ac-target-badge-row">
                <span className="ac-id-badge">#{activeProj.id}</span>
                <span className="ac-meta-tag"><Building2 size={12} /> {activeProj.sector}</span>
                <span className="ac-meta-tag"><Landmark size={12} /> {activeProj.ministry}</span>
                <span className="ac-meta-tag"><MapPin size={12} /> {activeProj.location?.split('\r\n')[0]}</span>
              </div>
              <h1 className="ac-target-name">{activeProj.name}</h1>
            </div>

            <div className="ac-target-stats-row">
              <div className="ac-stat-box">
                <span className="ac-stat-lbl">Revised Outlay</span>
                <span className="ac-stat-val">₹{formatCostClean(activeProj.costRevised)} Cr</span>
              </div>
              <div className="ac-stat-box">
                <span className="ac-stat-lbl">ML Risk Score</span>
                <span className="ac-stat-val text-red">{activeProj.riskScore}/100</span>
              </div>
              <div className="ac-stat-box">
                <span className="ac-stat-lbl">Physical Progress</span>
                <span className="ac-stat-val text-blue">{activeProj.progressPhysical || 0}%</span>
              </div>
            </div>
          </div>

          {/* ════════════════════════════════════════════════════════════════
             SECTION 1: RECOMMENDED ACTIONS FOR SELECTED ASSET
             ════════════════════════════════════════════════════════════════ */}
          <section id="ac-sec-actions" className="ac-section">
            <div className="ac-panel-card">
              <div className="ac-panel-head">
                <div className="ac-title-group">
                  <span className="ac-sec-badge badge-red">01</span>
                  <div>
                    <h2 className="ac-sec-title">Recommended Interventions &amp; Fast-Track Actions</h2>
                    <p className="ac-sec-sub">
                      AI-generated operational actions tailored to halt cost escalation and schedule slippage.
                    </p>
                  </div>
                </div>

                {/* "Why these actions?" Button -> Redirection to Escalation Drivers in ProjectDetails */}
                <button
                  type="button"
                  className="ac-why-actions-btn"
                  onClick={() => onSelectProject(activeProj.id, 'escalation')}
                  title="View SHAP attributions and NLP root causes in Escalation Drivers"
                >
                  <Sparkles size={14} />
                  <span>Why these actions?</span>
                  <ArrowRight size={14} />
                </button>
              </div>

              {/* Recommended Actions Grid */}
              <div className="ac-actions-grid">
                {/* Card 1 */}
                <div className="ac-action-card">
                  <div className="action-card-top">
                    <span className="action-priority-tag tag-urgent">URGENT</span>
                    <span className="action-saving-chip">Est. Time Saved: 3.5 Months</span>
                  </div>
                  <h3 className="action-card-title">Statutory Environmental &amp; Forest Clearance Fast-Track</h3>
                  <p className="action-card-desc">
                    Issue administrative mandate to State Nodal Environment Officer to expedite Stage-II Forest Conservation clearance for the main alignment package.
                  </p>
                  <div className="action-card-footer">
                    <button
                      type="button"
                      className="action-dispatch-btn"
                      onClick={() => triggerToast(`Fast-Track Clearance Facilitation Directive dispatched for #${activeProj.id}`)}
                    >
                      <Send size={13} />
                      <span>Dispatch Directive</span>
                    </button>
                  </div>
                </div>

                {/* Card 2 */}
                <div className="ac-action-card">
                  <div className="action-card-top">
                    <span className="action-priority-tag tag-high">HIGH IMPACT</span>
                    <span className="action-saving-chip">Est. Cost Recovery: ₹145 Cr</span>
                  </div>
                  <h3 className="action-card-title">SCOC Outlay Realignment &amp; Mobilization Advance Release</h3>
                  <p className="action-card-desc">
                    Sanction 15% mobilization advance under SCOC guidelines to resolve contractor liquidity constraint and accelerate heavy machinery deployment on site.
                  </p>
                  <div className="action-card-footer">
                    <button
                      type="button"
                      className="action-dispatch-btn"
                      onClick={() => triggerToast(`SCOC Outlay Realignment Memo issued for #${activeProj.id}`)}
                    >
                      <Send size={13} />
                      <span>Authorize Release</span>
                    </button>
                  </div>
                </div>

                {/* Card 3 */}
                <div className="ac-action-card">
                  <div className="action-card-top">
                    <span className="action-priority-tag tag-medium">MEDIUM</span>
                    <span className="action-saving-chip">Est. Progress Boost: +18%</span>
                  </div>
                  <h3 className="action-card-title">Site Workforce &amp; Heavy Equipment Augmentation</h3>
                  <p className="action-card-desc">
                    Mandate 2-shift 24x7 work pacing with 35% additional skilled manpower and specialized tunneling/paving machinery.
                  </p>
                  <div className="action-card-footer">
                    <button
                      type="button"
                      className="action-dispatch-btn"
                      onClick={() => triggerToast(`Workforce Augmentation Order sent to Project Director for #${activeProj.id}`)}
                    >
                      <Send size={13} />
                      <span>Issue Notice</span>
                    </button>
                  </div>
                </div>

                {/* Card 4 */}
                <div className="ac-action-card">
                  <div className="action-card-top">
                    <span className="action-priority-tag tag-high">HIGH IMPACT</span>
                    <span className="action-saving-chip">Est. Time Saved: 2.0 Months</span>
                  </div>
                  <h3 className="action-card-title">Inter-Ministerial Right-of-Way Facilitation Directive</h3>
                  <p className="action-card-desc">
                    Convene PMG joint dispute resolution cell with Ministry of Railways and Defense for utility shifting and land handover.
                  </p>
                  <div className="action-card-footer">
                    <button
                      type="button"
                      className="action-dispatch-btn"
                      onClick={() => triggerToast(`Inter-Ministerial Facilitation Cell established for #${activeProj.id}`)}
                    >
                      <Send size={13} />
                      <span>Convene Cell</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* ════════════════════════════════════════════════════════════════
             SECTION 2: IMPACT SECTION (INTERACTIVE WHAT-IF SIMULATOR)
             ════════════════════════════════════════════════════════════════ */}
          <section id="ac-sec-simulator" className="ac-section">
            <div className="ac-panel-card">
              <div className="ac-panel-head">
                <div className="ac-title-group">
                  <span className="ac-sec-badge badge-blue">02</span>
                  <div>
                    <h2 className="ac-sec-title">What-If Counterfactual Policy Simulator</h2>
                    <p className="ac-sec-sub">
                      Adjust intervention sliders to simulate dynamic real-time changes in Outlay, Schedule Delay, and ML Composite Risk Index.
                    </p>
                  </div>
                </div>
                <span className="ac-head-pill pill-ai">
                  <Sparkles size={13} /> Real-Time Simulation Engine
                </span>
              </div>

              {/* CUF Disclaimer Note */}
              <div className="ac-cuf-disclaimer-box">
                <Info size={16} className="cuf-info-icon" />
                <span>
                  <strong>Data Constraint Note:</strong> This feature is indicative due to CUF (Capacity Utilization Factor) data constraints. It operates at peak mathematical precision with optimized CUF telemetry data.
                </span>
              </div>

              {/* Simulator Main Body (Sliders Left, Dynamic Results Right) */}
              <div className="ac-simulator-body">
                {/* Sliders Column */}
                <div className="ac-sliders-col">
                  {/* Slider 1 */}
                  <div className="sim-slider-group">
                    <div className="slider-label-row">
                      <span className="slider-lbl">1. Budget Acceleration / Outlay Release</span>
                      <span className="slider-val text-blue">+{sliderOutlay}% (+₹{simResults.deltaOutlay} Cr)</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="50"
                      step="1"
                      value={sliderOutlay}
                      onChange={(e) => setSliderOutlay(parseFloat(e.target.value))}
                      className="ac-range-input"
                    />
                    <div className="slider-minmax">
                      <span>Baseline Outlay</span>
                      <span>+50% Supplemental Release</span>
                    </div>
                  </div>

                  {/* Slider 2 */}
                  <div className="sim-slider-group">
                    <div className="slider-label-row">
                      <span className="slider-lbl">2. Workforce &amp; Machinery Augmentation</span>
                      <span className="slider-val text-blue">+{sliderWorkforce}% Manpower</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      step="5"
                      value={sliderWorkforce}
                      onChange={(e) => setSliderWorkforce(parseFloat(e.target.value))}
                      className="ac-range-input"
                    />
                    <div className="slider-minmax">
                      <span>Standard Shift</span>
                      <span>+100% (24x7 3-Shift Pacing)</span>
                    </div>
                  </div>

                  {/* Slider 3 */}
                  <div className="sim-slider-group">
                    <div className="slider-label-row">
                      <span className="slider-lbl">3. Statutory Clearance Acceleration</span>
                      <span className="slider-val text-blue">{sliderClearance} Days Saved</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="180"
                      step="10"
                      value={sliderClearance}
                      onChange={(e) => setSliderClearance(parseFloat(e.target.value))}
                      className="ac-range-input"
                    />
                    <div className="slider-minmax">
                      <span>Standard Timeline</span>
                      <span>180 Days Fast-Track</span>
                    </div>
                  </div>

                  {/* Slider 4 */}
                  <div className="sim-slider-group">
                    <div className="slider-label-row">
                      <span className="slider-lbl">4. Vendor Resource Expediting Rate</span>
                      <span className="slider-val text-blue">+{sliderVendor}% Supply Pacing</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="50"
                      step="5"
                      value={sliderVendor}
                      onChange={(e) => setSliderVendor(parseFloat(e.target.value))}
                      className="ac-range-input"
                    />
                    <div className="slider-minmax">
                      <span>Baseline Supply</span>
                      <span>+50% Priority Material Delivery</span>
                    </div>
                  </div>
                </div>

                {/* Dynamic Results Column */}
                <div className="ac-sim-results-col">
                  <h3 className="sim-results-heading">Simulated Counterfactual Impact</h3>

                  {/* Result Metric 1: Schedule Delay */}
                  <div className="sim-metric-card card-delay">
                    <div className="sim-metric-top">
                      <span className="sim-metric-title">Projected Schedule Delay</span>
                      <span className="sim-badge badge-green">▼ {simResults.monthsSaved} Months Saved</span>
                    </div>
                    <div className="sim-metric-val-row">
                      <div className="sim-val-block">
                        <span className="sim-val-sub">Baseline Delay</span>
                        <span className="sim-val-num muted">+{simResults.baseDelay} Mo</span>
                      </div>
                      <span className="sim-arrow">→</span>
                      <div className="sim-val-block">
                        <span className="sim-val-sub">Post-Action Delay</span>
                        <span className="sim-val-num text-blue">+{simResults.simDelay} Mo</span>
                      </div>
                    </div>
                    <div className="sim-track">
                      <div className="sim-fill bg-blue" style={{ width: `${Math.max(10, (simResults.simDelay / (simResults.baseDelay || 1)) * 100)}%` }} />
                    </div>
                  </div>

                  {/* Result Metric 2: ML Composite Risk Score */}
                  <div className="sim-metric-card card-risk">
                    <div className="sim-metric-top">
                      <span className="sim-metric-title">ML Composite Risk Score</span>
                      <span className="sim-badge badge-emerald">▼ {simResults.baseRisk - simResults.simRisk} Pts Lower Risk</span>
                    </div>
                    <div className="sim-metric-val-row">
                      <div className="sim-val-block">
                        <span className="sim-val-sub">Baseline Risk</span>
                        <span className="sim-val-num text-red">{simResults.baseRisk}/100</span>
                      </div>
                      <span className="sim-arrow">→</span>
                      <div className="sim-val-block">
                        <span className="sim-val-sub">Simulated Risk</span>
                        <span className="sim-val-num text-green">{simResults.simRisk}/100</span>
                      </div>
                    </div>
                    <div className="sim-track">
                      <div className="sim-fill bg-green" style={{ width: `${simResults.simRisk}%` }} />
                    </div>
                  </div>

                  {/* Result Metric 3: Financial Exposure Saved */}
                  <div className="sim-metric-card card-outlay">
                    <div className="sim-metric-top">
                      <span className="sim-metric-title">Financial Exposure Saved</span>
                      <span className="sim-badge badge-blue">₹{simResults.exposureSavedCr.toLocaleString()} Cr Recovered</span>
                    </div>
                    <div className="sim-metric-val-row">
                      <div className="sim-val-block">
                        <span className="sim-val-sub">Baseline Outlay</span>
                        <span className="sim-val-num">₹{simResults.baseOutlay.toLocaleString()} Cr</span>
                      </div>
                      <span className="sim-arrow">→</span>
                      <div className="sim-val-block">
                        <span className="sim-val-sub">Simulated Outlay</span>
                        <span className="sim-val-num text-blue">₹{simResults.simOutlay.toLocaleString()} Cr</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* ════════════════════════════════════════════════════════════════
             SECTION 3: POLICY-AWARE AUTHORITY ROUTING (GOVT FRAMEWORK INTEGRATION)
             ════════════════════════════════════════════════════════════════ */}
          <section id="ac-sec-routing" className="ac-section">
            <div className="ac-panel-card">
              <div className="ac-panel-head">
                <div className="ac-title-group">
                  <span className="ac-sec-badge badge-purple">03</span>
                  <div>
                    <h2 className="ac-sec-title">Policy-Aware Authority Routing Matrix</h2>
                    <p className="ac-sec-sub">
                      Indian Government Infrastructure Framework Integration (MoSPI, PAIMANA, PIB/EFC &amp; CCEA Guidelines).
                    </p>
                  </div>
                </div>
                <span className="ac-head-pill pill-purple">
                  <Landmark size={13} /> {authorityRouting.code}
                </span>
              </div>

              {/* Active Governing Tier Highlight Banner */}
              <div className="ac-active-routing-banner">
                <div className="routing-banner-left">
                  <div className="routing-tier-badge">ACTIVE GOVERNING TIER #{authorityRouting.tierNum}</div>
                  <h3 className="routing-tier-title">{authorityRouting.title}</h3>
                  <p className="routing-tier-desc">{authorityRouting.body}</p>
                </div>
                <div className="routing-banner-right">
                  <div className="routing-officials-box">
                    <span className="officials-lbl">Designated Responsible Authorities:</span>
                    <span className="officials-val">{authorityRouting.officials}</span>
                  </div>
                </div>
              </div>

              {/* Official Government Escalation Matrix Cards */}
              <div className="ac-routing-tiers-grid">
                {/* Tier 1 */}
                <div className={`ac-tier-card ${authorityRouting.tierNum === 1 ? 'tier-active' : ''}`}>
                  <div className="tier-head">
                    <span className="tier-num">TIER 1</span>
                    <span className="tier-scope">&lt; ₹150 Cr Outlay</span>
                  </div>
                  <h4 className="tier-title">Project Implementation Unit (PIU)</h4>
                  <p className="tier-sub">Project Director &amp; Zonal Chief Engineer level field execution facilitation.</p>
                </div>

                {/* Tier 2 */}
                <div className={`ac-tier-card ${authorityRouting.tierNum === 2 ? 'tier-active' : ''}`}>
                  <div className="tier-head">
                    <span className="tier-num">TIER 2</span>
                    <span className="tier-scope">₹150 Cr – ₹1,000 Cr</span>
                  </div>
                  <h4 className="tier-title">Standing Committee on Time &amp; Cost Overruns (SCOC)</h4>
                  <p className="tier-sub">Departmental committee chaired by Additional Secretary / Joint Secretary.</p>
                </div>

                {/* Tier 3 */}
                <div className={`ac-tier-card ${authorityRouting.tierNum === 3 ? 'tier-active' : ''}`}>
                  <div className="tier-head">
                    <span className="tier-num">TIER 3</span>
                    <span className="tier-scope">Central Sector Monitoring</span>
                  </div>
                  <h4 className="tier-title">MoSPI Central Infrastructure Cell (PAIMANA)</h4>
                  <p className="tier-sub">Quarterly milestone divergence tracking &amp; inter-ministerial bottleneck reporting.</p>
                </div>

                {/* Tier 4 */}
                <div className={`ac-tier-card ${authorityRouting.tierNum === 4 ? 'tier-active' : ''}`}>
                  <div className="tier-head">
                    <span className="tier-num">TIER 4</span>
                    <span className="tier-scope">&gt; ₹1,000 Cr / &gt; 12 Mo</span>
                  </div>
                  <h4 className="tier-title">Cabinet Committee on Economic Affairs (CCEA) / PMG</h4>
                  <p className="tier-sub">Apex Cabinet Secretariat level executive decision &amp; fast-track mandate.</p>
                </div>
              </div>

              {/* Action Dispatch Toolbar */}
              <div className="ac-routing-actions-bar">
                <div className="routing-mandate-info">
                  <span className="mandate-lbl">Recommended Official Mandate:</span>
                  <span className="mandate-val">{authorityRouting.mandate}</span>
                </div>
                <div className="routing-btn-group">
                  <button
                    type="button"
                    className="ac-gov-btn btn-cabinet"
                    onClick={() => triggerToast(`Official Cabinet Escalation Memo generated for #${activeProj.id}`)}
                  >
                    <Landmark size={14} />
                    <span>Generate Cabinet Memo</span>
                  </button>

                  <button
                    type="button"
                    className="ac-gov-btn btn-scoc"
                    onClick={() => triggerToast(`SCOC Direct Administrative Order drafted for #${activeProj.id}`)}
                  >
                    <FileText size={14} />
                    <span>Issue SCOC Direct Order</span>
                  </button>
                </div>
              </div>
            </div>
          </section>
        </div>
      ) : (
        /* ── STATE A: ALL ACTION TARGETS STACKED LIST ── */
        <div className="ac-targets-container">
          {/* Header Banner */}
          <div className="ac-page-header">
            <div className="ac-header-left">
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <h1 className="ac-page-title">Action Centre Targets</h1>
                <InfoButton
                  title="Action Centre Console"
                  summary="Executive operational hub to triage high-risk national infrastructure assets, trigger policy actions, and simulate resolution scenarios."
                  size="md"
                />
              </div>
              <p className="ac-page-subtitle">
                Priority intervention queue ranked by ML Risk Score and cost/schedule escalation urgency.
              </p>
            </div>
            <div className="ac-header-badge">
              <span className="ac-pulse-dot" />
              <span>{filteredProjects.length} Active Targets Identified</span>
            </div>
          </div>

          {/* Filters & Control Panel Card */}
          <div className="ac-controls-card">
            <div className="ac-controls-row">
              {/* Count Limit Toggle Pills */}
              <div className="dist-toggle-pill">
                <button
                  type="button"
                  className={`dist-toggle-btn ${countLimit === 5 ? 'active' : ''}`}
                  onClick={() => setCountLimit(5)}
                >
                  Top 5
                </button>
                <button
                  type="button"
                  className={`dist-toggle-btn ${countLimit === 10 ? 'active' : ''}`}
                  onClick={() => setCountLimit(10)}
                >
                  Top 10
                </button>
                <button
                  type="button"
                  className={`dist-toggle-btn ${countLimit === 999 ? 'active' : ''}`}
                  onClick={() => setCountLimit(999)}
                >
                  All Projects ({filteredProjects.length})
                </button>
              </div>

              {/* Dropdowns */}
              <div className="ac-dropdowns-group">
                {/* Ministry */}
                <div className="dist-dropdown-wrapper">
                  <select
                    className="dist-select"
                    value={selectedMinistry}
                    onChange={(e) => setSelectedMinistry(e.target.value)}
                  >
                    <option value="All">All Ministries</option>
                    {allMinistries.map(m => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                  <ChevronDown size={14} className="dist-dropdown-arrow" />
                </div>

                {/* Sector */}
                <div className="dist-dropdown-wrapper">
                  <select
                    className="dist-select"
                    value={selectedSector}
                    onChange={(e) => setSelectedSector(e.target.value)}
                  >
                    <option value="All">All Sectors</option>
                    {allSectors.map(s => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                  <ChevronDown size={14} className="dist-dropdown-arrow" />
                </div>

                {/* Agency */}
                <div className="dist-dropdown-wrapper">
                  <select
                    className="dist-select"
                    value={selectedAgency}
                    onChange={(e) => setSelectedAgency(e.target.value)}
                  >
                    <option value="All">All Agencies</option>
                    {allAgencies.map(a => (
                      <option key={a} value={a}>{a}</option>
                    ))}
                  </select>
                  <ChevronDown size={14} className="dist-dropdown-arrow" />
                </div>

                {/* Search Input Box */}
                <div className="dist-dropdown-wrapper" style={{ minWidth: '200px' }}>
                  <Search size={14} className="dist-dropdown-icon" />
                  <input
                    type="text"
                    className="dist-select"
                    style={{ paddingLeft: '34px' }}
                    placeholder="Search target project..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Stacked 1-Column Projects List (Dashboard Aesthetic) */}
          <div className="ac-stacked-targets-list">
            {displayedProjects.length === 0 ? (
              <div className="dist-empty-state">
                <ShieldAlert size={36} color="#94A3B8" />
                <p>No high-risk action targets found matching the selected filters.</p>
              </div>
            ) : (
              displayedProjects.map((proj, idx) => {
                const origCost = parseFloat(proj.costApproved.replace(/[^0-9.]/g, '')) || 0;
                const revCost = parseFloat(proj.costRevised.replace(/[^0-9.]/g, '')) || 0;
                const deltaCr = revCost - origCost;
                const riskVal = proj.riskScore ?? 50;
                const isCrit = riskVal >= 75 || proj.scheduleStatus === 'CRITICAL';
                const statusColor = isCrit ? '#DC2626' : proj.scheduleStatus === 'DELAYED' ? '#D97706' : '#2563EB';

                return (
                  <div key={proj.id} className="ac-stacked-card">
                    {/* Top Info Bar */}
                    <div className="stacked-card-top">
                      <div className="stacked-rank-group">
                        <span className="rank-num">#{String(idx + 1).padStart(2, '0')}</span>
                        <span className="item-project-id">#{proj.id}</span>
                        <span className="item-meta-tag"><Building2 size={12} /> {proj.sector}</span>
                        <span className="item-meta-tag"><Landmark size={12} /> {proj.ministry}</span>
                        <span className="item-meta-tag"><MapPin size={12} /> {proj.location?.split('\r\n')[0]}</span>
                      </div>
                      <div className="item-risk-pill" style={{ color: statusColor, borderColor: `${statusColor}44`, backgroundColor: `${statusColor}10` }}>
                        <span>ML Risk Index: {riskVal}/100</span>
                      </div>
                    </div>

                    {/* Title */}
                    <h3 className="stacked-project-title">{proj.name}</h3>

                    {/* Metrics Grid */}
                    <div className="item-metrics-grid">
                      <div className="item-metric-col">
                        <span className="metric-lbl">Revised Outlay</span>
                        <span className="metric-val">₹{formatCostClean(proj.costRevised)} Cr</span>
                      </div>
                      <div className="item-metric-col">
                        <span className="metric-lbl">Cost Overrun</span>
                        <span className="metric-val text-red">
                          {deltaCr > 0 ? `+₹${Math.round(deltaCr)} Cr` : 'On Baseline'}
                        </span>
                      </div>
                      <div className="item-metric-col">
                        <span className="metric-lbl">Physical Progress</span>
                        <span className="metric-val">{proj.progressPhysical || 0}%</span>
                      </div>
                      <div className="item-metric-col">
                        <span className="metric-lbl">Schedule Delay</span>
                        <span className="metric-val text-red">+{proj.timeOverrunMonths || 0} Months</span>
                      </div>
                    </div>

                    {/* Progress Bar Track */}
                    <div className="item-progress-track">
                      <div
                        className="item-progress-fill"
                        style={{ width: `${proj.progressPhysical || 0}%`, background: statusColor }}
                      />
                    </div>

                    {/* CTA Actions Row */}
                    <div className="stacked-actions-row">
                      <button
                        type="button"
                        className="item-inspect-btn"
                        onClick={() => onSelectProject(proj.id)}
                      >
                        <Activity size={13} />
                        <span>Inspect Telemetry</span>
                        <ArrowRight size={13} />
                      </button>

                      <button
                        type="button"
                        className="item-action-btn"
                        onClick={() => setInternalTargetId(proj.id)}
                      >
                        <ShieldAlert size={13} />
                        <span>Take Action</span>
                        <ArrowRight size={13} />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
};
