import React, { useState, useMemo, useEffect, useCallback } from 'react';
import {
  ShieldAlert, ArrowLeft, ArrowRight, Building2, MapPin,
  ChevronDown, Sliders, CheckCircle2, FileText, Send, Sparkles,
  Info, Landmark, Search,
  TrendingUp, Clock, ExternalLink, RotateCcw, Play, Loader2
} from 'lucide-react';
import './ActionCenter.css';
import { projectsData } from '../data/projectsData';
import { InfoButton } from './ExplainabilityInfo';
import { api, type WhatIfResponse } from '../services/api';
import { generateTicketPDF, generateMemoPDF, type TicketData } from '../utils/pdfGenerator';

export interface ActionCenterProps {
  activeTab?: string;
  selectedProjectId?: string | null;
  onSelectProject: (projectId: string, initialSection?: string) => void;
  onNavigateTab?: (tab: string) => void;
  onTakeAction?: (projectId: string) => void;
  onClearSelectedProject?: () => void;
  onCreateTicket?: (ticket: TicketData) => void;
  targetMinistry?: string;
  targetAgency?: string;
}

type ActionSidebarSection = 'actions' | 'simulator' | 'routing';

export const ActionCenter: React.FC<ActionCenterProps> = ({
  selectedProjectId,
  onSelectProject,
  onClearSelectedProject,
  onCreateTicket,
  targetMinistry,
  targetAgency
}) => {
  // State A: Filters & Controls
  const [countLimit, setCountLimit] = useState<5 | 10 | 999>(5);
  const [selectedMinistry, setSelectedMinistry] = useState<string>(targetMinistry || 'All');
  const [selectedSector, setSelectedSector] = useState<string>('All');
  const [selectedAgency, setSelectedAgency] = useState<string>(targetAgency || 'All');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // State B: Active Action Target Project
  const [internalTargetId, setInternalTargetId] = useState<string | null>(null);
  const activeProjectId = selectedProjectId || internalTargetId;

  // State B Navigation Section
  const [activeSection, setActiveSection] = useState<ActionSidebarSection>('actions');

  // ML-Driven What-If Simulator State (3 Counterfactual Inputs)
  const [additionalCost, setAdditionalCost] = useState<number>(0); // ₹ Crore (default 0)
  const [additionalDelayMonths, setAdditionalDelayMonths] = useState<number>(0); // Months (default 0)
  const [monthlyExpenditure, setMonthlyExpenditure] = useState<number>(0); // ₹ Cr/mo (default: project's baseline velocity)

  // What-If Backend API State
  const [simLoading, setSimLoading] = useState<boolean>(false);
  const [whatIfData, setWhatIfData] = useState<WhatIfResponse | null>(null);
  const [baselineData, setBaselineData] = useState<WhatIfResponse | null>(null);

  // Toast / Modal Feedback State
  const [actionToast, setActionToast] = useState<string | null>(null);

  const triggerToast = (msg: string) => {
    setActionToast(msg);
    setTimeout(() => setActionToast(null), 3500);
  };

  // Fetch real model-driven baseline when selected project changes
  useEffect(() => {
    setAdditionalCost(0);
    setAdditionalDelayMonths(0);
    setWhatIfData(null);

    if (!activeProjectId) {
      setBaselineData(null);
      return;
    }

    let isMounted = true;
    setSimLoading(true);

    api.simulateWhatIf(activeProjectId, {
      additional_cost: 0,
      additional_delay_months: 0
    })
      .then((res) => {
        if (!isMounted) return;
        setBaselineData(res);
        setMonthlyExpenditure(res.baseline.monthly_expenditure);
      })
      .catch((err) => {
        if (!isMounted) return;
        console.warn('Failed to load baseline for simulation:', err);
      })
      .finally(() => {
        if (isMounted) setSimLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [activeProjectId]);

  // Execute real counterfactual simulation via XGBoost pipeline
  const handleRunSimulation = async () => {
    if (!activeProjectId) return;
    setSimLoading(true);
    try {
      const res = await api.simulateWhatIf(activeProjectId, {
        additional_cost: Math.max(0, Number(additionalCost) || 0),
        additional_delay_months: Math.max(0, Number(additionalDelayMonths) || 0),
        monthly_expenditure: monthlyExpenditure !== undefined && monthlyExpenditure !== null ? Number(monthlyExpenditure) : undefined
      });
      setWhatIfData(res);
    } catch (err: any) {
      console.warn('Simulation error:', err);
    } finally {
      setSimLoading(false);
    }
  };

  // Reset inputs and scenario back to pristine model baseline
  const handleResetSimulation = () => {
    setAdditionalCost(0);
    setAdditionalDelayMonths(0);
    if (baselineData) {
      setMonthlyExpenditure(baselineData.baseline.monthly_expenditure);
    }
    setWhatIfData(null);
  };

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
          const matchId = p.id.toLowerCase().includes(q) || 
                          (p.legacyOcmsCode && p.legacyOcmsCode.toLowerCase().includes(q)) || 
                          ((p as any).legacy_ocms_code && String((p as any).legacy_ocms_code).toLowerCase().includes(q));
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

  // Policy-Aware Authority Routing Tier for activeProj (Based on Official MoSPI, PIB & CCEA Guidelines)
  const authorityRouting = useMemo(() => {
    if (!activeProj) {
      return {
        tierNum: 2,
        title: 'Standing Committee on Time & Cost Overruns (SCOC)',
        code: 'GOVT-TIER-2-SCOC',
        body: 'Departmental Oversight Body chaired by Additional Secretary / Joint Secretary of the Administrative Ministry. Empowered for project cost realignments up to ₹500 Cr or cost overrun up to 20%.',
        officials: 'Additional Secretary (Infrastructure), Financial Advisor, NITI Aayog Representative',
        mandate: 'SCOC Direct Administrative Order & Revised Cost Estimate (RCE-I) Approval'
      };
    }

    const origCost = parseFloat(activeProj.costApproved.replace(/[^0-9.]/g, '')) || 0;
    const outlay = parseFloat(activeProj.costRevised.replace(/[^0-9.]/g, '')) || origCost || 1000;
    const delay = activeProj.timeOverrunMonths ?? 12;
    const overrunPct = origCost > 0 ? ((outlay - origCost) / origCost) * 100 : 0;

    if (outlay >= 1000 || delay >= 12 || overrunPct >= 50) {
      return {
        tierNum: 4,
        title: 'Cabinet Committee on Economic Affairs (CCEA) & PMG Secretariat',
        code: 'GOVT-TIER-4-CCEA',
        body: 'Apex Executive Cabinet Authority (Chaired by the Prime Minister / Cabinet Secretary). Mandatory appraisal for all Central Sector projects exceeding ₹1,000 Cr outlay or >12 months time overrun (Revised Cost Estimate RCE-III).',
        officials: 'Cabinet Secretary, Secretary DPIIT, PMG Secretariat Lead, Secretary MoSPI',
        mandate: 'CCEA Cabinet Note Approval & Inter-Ministerial Fast-Track Clearance Directive'
      };
    } else if (outlay >= 500 || overrunPct >= 20) {
      return {
        tierNum: 3,
        title: 'Public Investment Board (PIB) / Expenditure Finance Committee (EFC)',
        code: 'GOVT-TIER-3-PIB-EFC',
        body: 'Ministry of Finance Appraisal Body (Chaired by Secretary Expenditure). Required for project outlay revisions between ₹500 Cr – ₹1,000 Cr or cost escalation >20% (Revised Cost Estimate RCE-II).',
        officials: 'Secretary (Expenditure), NITI Aayog Advisor, Administrative Ministry Secretary',
        mandate: 'PIB/EFC Formal Appraisal Clearance & Financial Restructuring Mandate'
      };
    } else if (outlay >= 150 || delay >= 3) {
      return {
        tierNum: 2,
        title: 'Standing Committee on Time & Cost Overruns (SCOC)',
        code: 'GOVT-TIER-2-SCOC',
        body: 'Departmental Nodal Oversight Body (Chaired by Additional Secretary / Joint Secretary). Empowered to sanction scope realignments up to 20% cost overrun and authorize mobilization advances (RCE-I).',
        officials: 'Additional Secretary (Infrastructure), Financial Advisor, Joint Secretary (Nodal)',
        mandate: 'SCOC Direct Administrative Order & Supplemental Outlay Clearance'
      };
    } else {
      return {
        tierNum: 1,
        title: 'Project Implementation Unit (PIU) & Project Director',
        code: 'GOVT-TIER-1-PIU',
        body: 'Executive Field Operations Authority. Responsible for daily on-site milestone pacing, contractor mobilization notices, and local administrative coordination.',
        officials: 'Chief Engineer / Project Director, Zonal General Manager',
        mandate: 'PIU On-Site Acceleration Directive & Contractor Performance Notice'
      };
    }
  }, [activeProj]);

  // Real Escalation Driver-Based Recommendations generated dynamically for activeProj
  const realRecommendations = useMemo(() => {
    if (!activeProj) return [];

    const origCost = parseFloat(activeProj.costApproved.replace(/[^0-9.]/g, '')) || 0;
    const revCost = parseFloat(activeProj.costRevised.replace(/[^0-9.]/g, '')) || origCost || 1000;
    const deltaCr = Math.max(0, Math.round(revCost - origCost));
    const overrunPct = origCost > 0 ? Math.round(((revCost - origCost) / origCost) * 100) : parseInt(activeProj.costOverrunPct) || 0;
    const delayMo = activeProj.timeOverrunMonths ?? 12;
    const physProg = activeProj.progressPhysical || 0;
    const finProg = activeProj.progressFinancial || 0;
    const progGap = Math.max(0, Math.round(finProg - physProg));
    const riskScore = activeProj.riskScore ?? 75;
    const agencyName = activeProj.agency || activeProj.sector || 'Executing Agency';
    const ministryName = activeProj.ministry || 'Nodal Ministry';
    const projId = activeProj.id;
    const stateLoc = activeProj.location?.split('\r\n')[0] || 'Site Zone';

    return [
      {
        id: 'rec-driver-1',
        driverLabel: `ESCALATION DRIVER: ${delayMo} MONTHS SCHEDULE DELAY`,
        driverType: 'TIME SLIPPAGE',
        tag: delayMo >= 12 ? 'URGENT' : 'HIGH IMPACT',
        tagClass: delayMo >= 12 ? 'tag-urgent' : 'tag-high',
        savingChip: `Est. Time Saved: ${(delayMo * 0.35).toFixed(1)} Months`,
        title: `Statutory Environmental & Forest Clearance Fast-Track`,
        desc: `Driven by ${delayMo}-month schedule delay on #${projId}: Issue administrative mandate to ${stateLoc} Nodal Environment Officer to expedite Stage-II Forest Conservation & Right-of-Way clearance under ${ministryName}.`,
        btnLabel: `Dispatch Directive`,
        toastMsg: `Fast-Track Clearance Facilitation Directive dispatched for #${projId}`
      },
      {
        id: 'rec-driver-2',
        driverLabel: `ESCALATION DRIVER: +₹${deltaCr} CR (+${overrunPct}%) COST OVERRUN`,
        driverType: 'COST ESCALATION',
        tag: 'HIGH IMPACT',
        tagClass: 'tag-high',
        savingChip: `Est. Cost Recovery: ₹${Math.max(45, Math.round(deltaCr * 0.25 || 145))} Cr`,
        title: `SCOC Outlay Realignment & Mobilization Advance Release`,
        desc: `Driven by +₹${deltaCr} Cr budget escalation over initial ₹${activeProj.costApproved}: Sanction 15% mobilization advance under SCOC guidelines for ${agencyName} to resolve contractor liquidity constraints on #${projId}.`,
        btnLabel: `Authorize Release`,
        toastMsg: `SCOC Outlay Realignment Memo issued for #${projId}`
      },
      {
        id: 'rec-driver-3',
        driverLabel: `ESCALATION DRIVER: ${progGap}% DISBURSEMENT-EXECUTION GAP`,
        driverType: 'PHYSICAL DIVERGENCE',
        tag: progGap > 15 ? 'HIGH IMPACT' : 'MEDIUM',
        tagClass: progGap > 15 ? 'tag-high' : 'tag-medium',
        savingChip: `Est. Progress Boost: +${Math.round((100 - physProg) * 0.3 || 18)}%`,
        title: `Increase Resources: Site Workforce & Heavy Machinery Augmentation`,
        desc: `Driven by physical execution lagging financial expenditure by ${progGap}% (${physProg}% physical vs ${finProg}% financial): Mandate 2-shift 24x7 work pacing with additional skilled manpower and specialized heavy machinery for ${agencyName}.`,
        btnLabel: `Issue Notice`,
        toastMsg: `Workforce & Equipment Augmentation Order sent to Project Director for #${projId}`
      },
      {
        id: 'rec-driver-4',
        driverLabel: `ESCALATION DRIVER: ML RISK SCORE ${riskScore}/100`,
        driverType: 'ML COMPOSITE RISK',
        tag: riskScore >= 75 ? 'URGENT' : 'HIGH IMPACT',
        tagClass: riskScore >= 75 ? 'tag-urgent' : 'tag-high',
        savingChip: `Est. Time Saved: ${(delayMo * 0.2 || 2.0).toFixed(1)} Months`,
        title: `Inter-Ministerial Right-of-Way & PMG Dispute Resolution Cell`,
        desc: `Driven by critical ML risk index of ${riskScore}/100: Convene PMG joint dispute resolution cell with ${ministryName} and state utilities in ${stateLoc} for utility shifting and land handover clearance for #${projId}.`,
        btnLabel: `Convene Cell`,
        toastMsg: `Inter-Ministerial PMG Facilitation Cell established for #${projId}`
      }
    ];
  }, [activeProj]);

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

          {/* ── Horizontal Navigation Bar ── */}
          <div className="ac-horizontal-nav" style={{ display: 'flex', gap: '8px', background: 'linear-gradient(90deg, #0f172a 0%, #1e3a8a 100%)', padding: '12px 24px', borderBottom: '1px solid #1e293b', position: 'sticky', top: 0, zIndex: 50, alignItems: 'center', marginBottom: '24px' }}>
            {[
              { id: 'actions' as ActionSidebarSection, label: 'Recommended Actions', icon: ShieldAlert },
              { id: 'simulator' as ActionSidebarSection, label: 'What-If Simulator', icon: Sliders },
              { id: 'routing' as ActionSidebarSection, label: 'Authority Routing', icon: Landmark }
            ].map((sec) => {
              const isActive = activeSection === sec.id;
              const Icon = sec.icon;
              return (
                <button 
                  key={sec.id}
                  className={`ac-nav-tab ${isActive ? 'active' : ''}`}
                  onClick={() => scrollToSection(sec.id)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '10px 16px',
                    borderRadius: '8px',
                    border: '1px solid',
                    borderColor: isActive ? 'rgba(56, 189, 248, 0.4)' : 'transparent',
                    background: isActive ? 'rgba(56, 189, 248, 0.15)' : 'transparent',
                    color: isActive ? '#38bdf8' : '#cbd5e1',
                    fontSize: '14px',
                    fontWeight: isActive ? 700 : 500,
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                  }}
                  onMouseEnter={(e) => {
                    if (!isActive) {
                      e.currentTarget.style.color = '#ffffff';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isActive) {
                      e.currentTarget.style.color = '#cbd5e1';
                    }
                  }}
                >
                  <Icon size={16} />
                  <span>{sec.label}</span>
                </button>
              );
            })}
          </div>

          {/* ════════════════════════════════════════════════════════════════
             SECTION 1: RECOMMENDED ACTIONS FOR SELECTED ASSET
             ════════════════════════════════════════════════════════════════ */}
          <section id="ac-sec-actions" className="ac-section">
            <div className="pd-section-header pd-section-header--escalation" style={{ marginTop: '24px' }}>
              <span className="pd-section-tag">01</span>
              <span className="pd-section-name">Recommended Interventions &amp; Fast-Track Actions</span>
              <InfoButton title="Recommended Interventions" summary="AI-generated operational actions tailored to halt cost escalation and schedule slippage based on identified root causes." size="sm" theme="light" />
            </div>
            <div className="ac-panel-card">
              <div className="ac-panel-head">
                <p className="ac-sec-sub" style={{ margin: 0 }}>
                  AI-generated operational actions tailored to halt cost escalation and schedule slippage.
                </p>

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

              {/* Recommended Actions Grid (Driven by Real Escalation Drivers & Project Data) */}
              <div className="ac-actions-grid">
                {realRecommendations.map((rec) => (
                  <div key={rec.id} className="ac-action-card">
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '8px' }}>
                      <span style={{ fontSize: '10px', fontWeight: 850, color: '#2563EB', background: '#EFF6FF', border: '1px solid #BFDBFE', padding: '2px 8px', borderRadius: '4px', width: 'fit-content', letterSpacing: '0.04em' }}>
                        {rec.driverLabel}
                      </span>
                      <div className="action-card-top" style={{ marginTop: '2px' }}>
                        <span className={`action-priority-tag ${rec.tagClass}`}>{rec.tag}</span>
                        <span className="action-saving-chip">{rec.savingChip}</span>
                      </div>
                    </div>
                    <h3 className="action-card-title">{rec.title}</h3>
                    <p className="action-card-desc">{rec.desc}</p>

                    <div className="action-card-footer" style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '12px' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <label style={{ fontSize: '10.5px', fontWeight: 600, color: '#64748B' }}>Assign Ticket To:</label>
                        <select
                          id={`assignee-${rec.id}`}
                          style={{ fontSize: '11px', padding: '6px', borderRadius: '6px', border: '1px solid #CBD5E1', background: '#F8FAFC', color: '#0F172A', outline: 'none' }}
                          defaultValue={authorityRouting.title}
                        >
                          <option value={authorityRouting.title}>{authorityRouting.title} (Routed Authority)</option>
                          <option value="Project Director (PIU)">Project Director (PIU)</option>
                          <option value="Secretary (Administrative Ministry)">Secretary (Administrative Ministry)</option>
                          <option value="Cabinet Secretary">Cabinet Secretary</option>
                        </select>
                      </div>

                      <button
                        type="button"
                        className="action-dispatch-btn"
                        onClick={() => {
                          const assignee = (document.getElementById(`assignee-${rec.id}`) as HTMLSelectElement)?.value || authorityRouting.title;
                          const ticket: TicketData = {
                            id: `TCK-${Date.now().toString().slice(-6)}`,
                            projectName: activeProj.name,
                            projectId: activeProj.id,
                            actionTitle: rec.title,
                            routedOfficer: assignee,
                            status: 'OPEN',
                            priority: activeProj.riskScore >= 75 ? 'Critical' : 'High',
                            dateCreated: new Date().toLocaleDateString('en-IN'),
                            ministry: activeProj.ministry,
                            agency: activeProj.agency || 'Executing Agency',
                            description: rec.desc,
                          };
                          if (onCreateTicket) {
                            onCreateTicket(ticket);
                          }
                          generateTicketPDF(ticket);
                          triggerToast(`Action Ticket ${ticket.id} generated as PDF & assigned to ${assignee}!`);
                        }}
                        style={{ width: '100%', background: '#2563EB', color: '#ffffff', fontWeight: 'bold' }}
                      >
                        <Send size={13} />
                        <span>Generate Ticket (PDF)</span>
                      </button>

                      <button
                        type="button"
                        className="action-dispatch-btn"
                        onClick={() => {
                          const assignee = (document.getElementById(`assignee-${rec.id}`) as HTMLSelectElement)?.value || authorityRouting.title;
                          generateMemoPDF(activeProj.name, activeProj.id, rec.title, assignee);
                        }}
                        style={{ width: '100%', background: 'rgba(37, 99, 235, 0.08)', border: '1px solid rgba(37, 99, 235, 0.3)', color: '#1D4ED8', fontWeight: 600 }}
                      >
                        <FileText size={13} />
                        <span>Generate Memo / Direct Order (PDF)</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* ════════════════════════════════════════════════════════════════
             SECTION 2: IMPACT SECTION (REAL ML-DRIVEN WHAT-IF SIMULATOR)
             ════════════════════════════════════════════════════════════════ */}
          <section id="ac-sec-simulator" className="ac-section">
            <div className="pd-section-header pd-section-header--forecasts" style={{ marginTop: '32px' }}>
              <span className="pd-section-tag">02</span>
              <span className="pd-section-name">What-If Counterfactual Policy Simulator</span>
              <InfoButton title="What-If Simulator" summary="Predictive policy simulator testing counterfactual scenarios via ML to understand the resulting impact on project risk, time, and cost." size="sm" theme="light" />
            </div>
            <div className="ac-panel-card">
              <div className="ac-panel-head">
                <div>
                  <p className="ac-sec-sub" style={{ margin: 0 }}>
                    Simulate dynamic real-time counterfactual impact using the trained PAIMANA XGBoost pipelines and centralized Risk Engine.
                  </p>
                  <div style={{ fontSize: '11px', color: '#64748B', marginTop: '3px' }}>
                    Active Project: <strong style={{ color: '#0F172A' }}>{activeProj?.name}</strong> (ID: {activeProj?.id})
                  </div>
                </div>
              </div>

              {/* CUF Telemetry Note */}
              <div className="ac-cuf-disclaimer-box">
                <Info size={16} className="cuf-info-icon" />
                <span>
                  <strong>CUF (Common Upload Form) Telemetry Note:</strong> Baseline inference and counterfactual scenarios run directly against trained XGBoost Cost &amp; Schedule regressors and the empirical Risk Engine.
                </span>
              </div>



              {/* Simulator Main Body (3 Sliders Left, Dynamic Comparison Table Right) */}
              <div className="ac-simulator-body">
                {/* Sliders Column: Exactly 3 Variables (Additional Cost, Additional Time Delay, Monthly Expenditure) */}
                <div className="ac-sliders-col">
                  {/* Variable 1: Additional Cost */}
                  <div className="sim-slider-group">
                    <div className="slider-label-row">
                      <span className="slider-lbl">1. Additional Cost (Capital Outlay)</span>
                      <span className="slider-val text-blue">
                        +{Number(additionalCost).toLocaleString('en-IN')} ₹ Cr
                      </span>
                    </div>
                    <div className="slider-controls-row">
                      <input
                        type="range"
                        min="0"
                        max={Math.max(500, Math.round((baselineData?.baseline.cost || 1000) * 0.5))}
                        step="10"
                        value={additionalCost}
                        onChange={(e) => setAdditionalCost(Math.max(0, parseFloat(e.target.value) || 0))}
                        className="ac-range-input"
                      />
                      <div className="ac-num-input-wrap">
                        <input
                          type="number"
                          min="0"
                          value={additionalCost}
                          onChange={(e) => setAdditionalCost(Math.max(0, parseFloat(e.target.value) || 0))}
                          className="ac-num-input"
                        />
                        <span className="ac-num-unit">₹ Cr</span>
                      </div>
                    </div>
                    <div className="slider-minmax">
                      <span>Baseline (₹0 Cr)</span>
                      <span>+₹{Math.max(500, Math.round((baselineData?.baseline.cost || 1000) * 0.5))} Cr</span>
                    </div>
                  </div>

                  {/* Variable 2: Additional Time Delay */}
                  <div className="sim-slider-group">
                    <div className="slider-label-row">
                      <span className="slider-lbl">2. Additional Time Delay</span>
                      <span className="slider-val text-blue">+{additionalDelayMonths} Months</span>
                    </div>
                    <div className="slider-controls-row">
                      <input
                        type="range"
                        min="0"
                        max="36"
                        step="1"
                        value={additionalDelayMonths}
                        onChange={(e) => setAdditionalDelayMonths(Math.max(0, parseFloat(e.target.value) || 0))}
                        className="ac-range-input"
                      />
                      <div className="ac-num-input-wrap">
                        <input
                          type="number"
                          min="0"
                          max="72"
                          value={additionalDelayMonths}
                          onChange={(e) => setAdditionalDelayMonths(Math.max(0, parseFloat(e.target.value) || 0))}
                          className="ac-num-input"
                        />
                        <span className="ac-num-unit">Mo</span>
                      </div>
                    </div>
                    <div className="slider-minmax">
                      <span>Baseline (0 Months)</span>
                      <span>+36 Months Delay</span>
                    </div>
                  </div>

                  {/* Variable 3: Monthly Expenditure */}
                  <div className="sim-slider-group">
                    <div className="slider-label-row">
                      <span className="slider-lbl">3. Monthly Expenditure Velocity</span>
                      <span className="slider-val text-blue">
                        ₹{Number(monthlyExpenditure || baselineData?.baseline?.monthly_expenditure || 0).toFixed(1)} Cr/mo
                      </span>
                    </div>
                    <div className="slider-controls-row">
                      <input
                        type="range"
                        min="0"
                        max={Math.max(100, Math.round((baselineData?.baseline?.monthly_expenditure || 25) * 3))}
                        step="1"
                        value={monthlyExpenditure || 0}
                        onChange={(e) => setMonthlyExpenditure(Math.max(0, parseFloat(e.target.value) || 0))}
                        className="ac-range-input"
                      />
                      <div className="ac-num-input-wrap">
                        <input
                          type="number"
                          min="0"
                          step="0.5"
                          value={monthlyExpenditure || 0}
                          onChange={(e) => setMonthlyExpenditure(Math.max(0, parseFloat(e.target.value) || 0))}
                          className="ac-num-input"
                        />
                        <span className="ac-num-unit">Cr/mo</span>
                      </div>
                    </div>
                    <div className="slider-minmax">
                      <span>₹0 Cr/mo</span>
                      <span>Baseline: ₹{(baselineData?.baseline?.monthly_expenditure || 0).toFixed(1)} Cr/mo</span>
                      <span>₹{Math.max(100, Math.round((baselineData?.baseline?.monthly_expenditure || 25) * 3))} Cr/mo</span>
                    </div>
                  </div>

                  {/* Action Buttons: Reset & Run Simulation */}
                  <div className="ac-sim-actions-bar">
                    <button
                      type="button"
                      className="ac-btn-reset"
                      onClick={handleResetSimulation}
                      disabled={simLoading}
                    >
                      <RotateCcw size={13} />
                      <span>Reset to Baseline</span>
                    </button>
                    <button
                      type="button"
                      className="ac-btn-run"
                      onClick={handleRunSimulation}
                      disabled={simLoading}
                    >
                      {simLoading ? (
                        <>
                          <Loader2 size={14} className="animate-spin" />
                          <span>Simulating...</span>
                        </>
                      ) : (
                        <>
                          <Play size={13} fill="currentColor" />
                          <span>Run Simulation</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {/* Simulation Impact Column: Comparison Table */}
                <div className="ac-sim-results-col">
                  <div className="ac-impact-table-wrap">
                    <table className="ac-impact-table">
                      <thead>
                        <tr>
                          <th>Metric</th>
                          <th>Baseline</th>
                          <th>Scenario</th>
                          <th>Change</th>
                        </tr>
                      </thead>
                      <tbody>
                        {/* 1. Direct Metric: Projected Cost */}
                        <tr>
                          <td>
                            <div className="ac-table-metric">
                              <span>Projected Cost</span>
                            </div>
                          </td>
                          <td className="ac-table-base">
                            ₹{(baselineData?.baseline?.cost ?? 0).toLocaleString('en-IN', { maximumFractionDigits: 1 })} Cr
                          </td>
                          <td className="ac-table-scen">
                            {whatIfData?.scenario?.cost != null ? `₹${whatIfData.scenario.cost.toLocaleString('en-IN', { maximumFractionDigits: 1 })} Cr` : '—'}
                          </td>
                          <td>
                            {whatIfData?.impact?.cost_change != null ? (
                              <span className={`ac-table-delta ${whatIfData.impact.cost_change > 0 ? 'delta-bad' : whatIfData.impact.cost_change < 0 ? 'delta-good' : 'delta-neutral'}`}>
                                {whatIfData.impact.cost_change >= 0 ? '+' : ''}₹{whatIfData.impact.cost_change.toLocaleString('en-IN', { maximumFractionDigits: 1 })} Cr
                              </span>
                            ) : (
                              <span className="ac-table-delta delta-neutral">—</span>
                            )}
                          </td>
                        </tr>

                        {/* 2. Direct Metric: Remaining Months */}
                        <tr>
                          <td>
                            <div className="ac-table-metric">
                              <span>Remaining Months</span>
                            </div>
                          </td>
                          <td className="ac-table-base">
                            {baselineData?.baseline?.remaining_months ?? 0} mo
                          </td>
                          <td className="ac-table-scen">
                            {whatIfData?.scenario?.remaining_months != null ? `${whatIfData.scenario.remaining_months} mo` : '—'}
                          </td>
                          <td>
                            {whatIfData?.impact?.remaining_months_change != null ? (
                              <span className={`ac-table-delta ${whatIfData.impact.remaining_months_change > 0 ? 'delta-bad' : whatIfData.impact.remaining_months_change < 0 ? 'delta-good' : 'delta-neutral'}`}>
                                {whatIfData.impact.remaining_months_change >= 0 ? '+' : ''}{whatIfData.impact.remaining_months_change} mo
                              </span>
                            ) : (
                              <span className="ac-table-delta delta-neutral">—</span>
                            )}
                          </td>
                        </tr>

                        {/* 3. Direct Metric: Monthly Expenditure */}
                        <tr>
                          <td>
                            <div className="ac-table-metric">
                              <span>Monthly Expenditure</span>
                            </div>
                          </td>
                          <td className="ac-table-base">
                            ₹{(baselineData?.baseline?.monthly_expenditure ?? 0).toFixed(1)} Cr/mo
                          </td>
                          <td className="ac-table-scen">
                            {whatIfData?.scenario?.monthly_expenditure != null ? `₹${whatIfData.scenario.monthly_expenditure.toFixed(1)} Cr/mo` : '—'}
                          </td>
                          <td>
                            {whatIfData?.impact?.expenditure_change != null ? (
                              <span className="ac-table-delta delta-neutral">
                                {whatIfData.impact.expenditure_change >= 0 ? '+' : ''}₹{whatIfData.impact.expenditure_change.toFixed(1)} Cr/mo
                              </span>
                            ) : (
                              <span className="ac-table-delta delta-neutral">—</span>
                            )}
                          </td>
                        </tr>

                        {/* 4. Model Prediction: Cost Overrun */}
                        <tr style={{ background: '#F8FAFC' }}>
                          <td>
                            <div className="ac-table-metric">
                              <span style={{ color: '#2563EB', fontWeight: 800 }}>Predicted Cost Overrun</span>
                            </div>
                          </td>
                          <td className="ac-table-base">
                            {(baselineData?.baseline?.predicted_cost_overrun ?? 0).toFixed(1)}%
                          </td>
                          <td className="ac-table-scen">
                            {whatIfData?.scenario?.predicted_cost_overrun != null ? `${whatIfData.scenario.predicted_cost_overrun.toFixed(1)}%` : '—'}
                          </td>
                          <td>
                            {whatIfData?.impact?.cost_overrun_change != null ? (
                              <span className={`ac-table-delta ${whatIfData.impact.cost_overrun_change > 0 ? 'delta-bad' : whatIfData.impact.cost_overrun_change < 0 ? 'delta-good' : 'delta-neutral'}`}>
                                {whatIfData.impact.cost_overrun_change >= 0 ? '+' : ''}{whatIfData.impact.cost_overrun_change.toFixed(1)} pp
                              </span>
                            ) : (
                              <span className="ac-table-delta delta-neutral">—</span>
                            )}
                          </td>
                        </tr>

                        {/* 5. Model Prediction: Schedule Delay */}
                        <tr style={{ background: '#F8FAFC' }}>
                          <td>
                            <div className="ac-table-metric">
                              <span style={{ color: '#2563EB', fontWeight: 800 }}>Predicted Schedule Delay</span>
                            </div>
                          </td>
                          <td className="ac-table-base">
                            {(baselineData?.baseline?.predicted_schedule_delay ?? 0).toFixed(1)} mo
                          </td>
                          <td className="ac-table-scen">
                            {whatIfData?.scenario?.predicted_schedule_delay != null ? `${whatIfData.scenario.predicted_schedule_delay.toFixed(1)} mo` : '—'}
                          </td>
                          <td>
                            {whatIfData?.impact?.schedule_delay_change != null ? (
                              <span className={`ac-table-delta ${whatIfData.impact.schedule_delay_change > 0 ? 'delta-bad' : whatIfData.impact.schedule_delay_change < 0 ? 'delta-good' : 'delta-neutral'}`}>
                                {whatIfData.impact.schedule_delay_change >= 0 ? '+' : ''}{whatIfData.impact.schedule_delay_change.toFixed(1)} mo
                              </span>
                            ) : (
                              <span className="ac-table-delta delta-neutral">—</span>
                            )}
                          </td>
                        </tr>

                        {/* 6. Centralized Risk Engine: Composite Risk Score */}
                        <tr style={{ background: '#EFF6FF' }}>
                          <td>
                            <div className="ac-table-metric">
                              <span style={{ color: '#1E3A8A', fontWeight: 850 }}>Composite Risk Score</span>
                            </div>
                          </td>
                          <td className="ac-table-base" style={{ fontWeight: 800 }}>
                            {baselineData?.baseline?.risk_score ?? 0}/100 ({baselineData?.baseline?.risk_level ?? '—'})
                          </td>
                          <td className="ac-table-scen" style={{ fontWeight: 850, color: '#1E3A8A' }}>
                            {whatIfData?.scenario?.risk_score != null ? `${whatIfData.scenario.risk_score}/100 (${whatIfData.scenario.risk_level || 'Medium'})` : '—'}
                          </td>
                          <td>
                            {whatIfData?.impact?.risk_score_change != null ? (
                              <span className={`ac-table-delta ${whatIfData.impact.risk_score_change > 0 ? 'delta-bad' : whatIfData.impact.risk_score_change < 0 ? 'delta-good' : 'delta-neutral'}`} style={{ fontSize: '13px' }}>
                                {whatIfData.impact.risk_score_change >= 0 ? '+' : ''}{whatIfData.impact.risk_score_change} pts
                              </span>
                            ) : (
                              <span className="ac-table-delta delta-neutral">—</span>
                            )}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              {/* Partial Dependence Plots (PDP / Sensitivity Analysis) */}
              <div className="pdp-charts-grid">
                {/* PDP Chart 1: Cost Overrun Sensitivity */}
                <div className="pdp-chart-card">
                  <div className="pdp-chart-head">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span className="pdp-chart-title">Cost Overrun Sensitivity (PDP)</span>
                      <InfoButton title="Partial Dependence Plot (PDP)" summary="PDP shows how changing the Additional Cost affects the ML model's predicted Cost Overrun Risk. The line represents the model's learned relationship, while the dots show your specific scenario." size="sm" theme="light" />
                    </div>
                    <span className="pdp-chart-sub">Trained XGBoost Cost Regressor | Feature: cost_escalation_crore</span>
                  </div>
                  {(() => {
                    const curve = whatIfData?.pdp_cost || baselineData?.pdp_cost;
                    if (!curve || !curve.points || curve.points.length === 0) {
                      return (
                        <div style={{ height: 160, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94A3B8', fontSize: 12 }}>
                          {simLoading ? 'Scoring trained XGBoost cost model...' : 'PDP data unavailable'}
                        </div>
                      );
                    }
                    const width = 360;
                    const height = 180;
                    const padding = { top: 20, right: 25, bottom: 35, left: 45 };
                    const plotW = width - padding.left - padding.right;
                    const plotH = height - padding.top - padding.bottom;

                    const allX = (curve.points || []).map(p => p.x);
                    if (curve.baseline_point?.x != null) allX.push(curve.baseline_point.x);
                    if (whatIfData && curve.scenario_point?.x != null) allX.push(curve.scenario_point.x);
                    let minX = Math.min(...allX);
                    let maxX = Math.max(...allX);
                    if (minX === maxX) maxX = minX + 10;

                    const allY = (curve.points || []).map(p => p.y);
                    if (curve.baseline_point?.y != null) allY.push(curve.baseline_point.y);
                    if (whatIfData && curve.scenario_point?.y != null) allY.push(curve.scenario_point.y);
                    let minY = Math.min(...allY);
                    let maxY = Math.max(...allY);
                    if (minY === maxY) maxY = minY + 5;
                    const yPad = (maxY - minY) * 0.1 || 1;
                    minY -= yPad;
                    maxY += yPad;

                    const scaleX = (x: number) => padding.left + ((x - minX) / (maxX - minX)) * plotW;
                    const scaleY = (y: number) => padding.top + plotH - ((y - minY) / (maxY - minY)) * plotH;

                    const poly = (curve.points || []).map(p => `${scaleX(p.x).toFixed(1)},${scaleY(p.y).toFixed(1)}`).join(' ');
                    const bX = scaleX(curve.baseline_point?.x ?? minX);
                    const bY = scaleY(curve.baseline_point?.y ?? minY);
                    const hasScen = Boolean(whatIfData && curve.scenario_point);
                    const sX = hasScen ? scaleX(curve.scenario_point!.x) : 0;
                    const sY = hasScen ? scaleY(curve.scenario_point!.y) : 0;

                    return (
                      <div>
                        <svg viewBox={`0 0 ${width} ${height}`} className="pdp-svg">
                          <line x1={padding.left} y1={scaleY(minY + yPad)} x2={width - padding.right} y2={scaleY(minY + yPad)} stroke="#F1F5F9" strokeWidth="1" strokeDasharray="3 3" />
                          <line x1={padding.left} y1={scaleY((minY + maxY) / 2)} x2={width - padding.right} y2={scaleY((minY + maxY) / 2)} stroke="#F1F5F9" strokeWidth="1" strokeDasharray="3 3" />
                          <line x1={padding.left} y1={scaleY(maxY - yPad)} x2={width - padding.right} y2={scaleY(maxY - yPad)} stroke="#F1F5F9" strokeWidth="1" strokeDasharray="3 3" />
                          <line x1={padding.left} y1={height - padding.bottom} x2={width - padding.right} y2={height - padding.bottom} stroke="#CBD5E1" strokeWidth="1.5" />
                          <line x1={padding.left} y1={padding.top} x2={padding.left} y2={height - padding.bottom} stroke="#CBD5E1" strokeWidth="1.5" />
                          <polyline fill="none" stroke="#2563EB" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" points={poly}>
                            <title>Predicted Model Response Curve</title>
                          </polyline>
                          <circle cx={bX} cy={bY} r={6} fill="#2563EB" stroke="#FFFFFF" strokeWidth={2} style={{ cursor: 'pointer' }}>
                            <title>Baseline: ₹{curve.baseline_point?.x?.toFixed(0)} Cr, {curve.baseline_point?.y?.toFixed(1)}%</title>
                          </circle>
                          {hasScen && (
                            <circle cx={sX} cy={sY} r={6.5} fill="#DC2626" stroke="#FFFFFF" strokeWidth={2} style={{ cursor: 'pointer' }}>
                              <title>Scenario: ₹{curve.scenario_point?.x?.toFixed(0)} Cr, {curve.scenario_point?.y?.toFixed(1)}%</title>
                            </circle>
                          )}
                          <text x={padding.left} y={height - 12} fontSize="9.5" fill="#64748B" textAnchor="start">₹{minX.toFixed(0)} Cr</text>
                          <text x={width - padding.right} y={height - 12} fontSize="9.5" fill="#64748B" textAnchor="end">₹{maxX.toFixed(0)} Cr</text>
                          <text x={padding.left - 6} y={padding.top + 8} fontSize="9.5" fill="#64748B" textAnchor="end">{maxY.toFixed(1)}%</text>
                          <text x={padding.left - 6} y={height - padding.bottom} fontSize="9.5" fill="#64748B" textAnchor="end">{minY.toFixed(1)}%</text>
                        </svg>
                        <div className="pdp-legend">
                          <div className="pdp-legend-item">
                            <span className="pdp-line-sample" style={{ background: '#2563EB' }}></span>
                            <span>PDP Response</span>
                          </div>
                          <div className="pdp-legend-item">
                            <span className="pdp-dot dot-base"></span>
                            <span>Baseline ({curve.baseline_point?.x != null ? curve.baseline_point.x.toFixed(0) : '0'} Cr, {curve.baseline_point?.y != null ? curve.baseline_point.y.toFixed(1) : '0'}%)</span>
                          </div>
                          {hasScen && (
                            <div className="pdp-legend-item">
                              <span className="pdp-dot dot-scen"></span>
                              <span>Scenario ({curve.scenario_point?.x != null ? curve.scenario_point.x.toFixed(0) : '0'} Cr, {curve.scenario_point?.y != null ? curve.scenario_point.y.toFixed(1) : '0'}%)</span>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })()}
                </div>

                {/* PDP Chart 2: Schedule Delay Sensitivity */}
                <div className="pdp-chart-card">
                  <div className="pdp-chart-head">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span className="pdp-chart-title">Schedule Delay Sensitivity (PDP)</span>
                      <InfoButton title="Partial Dependence Plot (PDP)" summary="PDP shows how adding Schedule Delays impacts the ML model's predicted Time Overrun Risk. Compare the red dot (your scenario) to the blue dot (current baseline)." size="sm" theme="light" />
                    </div>
                    <span className="pdp-chart-sub">Trained XGBoost Schedule Regressor | Feature: schedule_extension_months</span>
                  </div>
                  {(() => {
                    const curve = whatIfData?.pdp_schedule || baselineData?.pdp_schedule;
                    if (!curve || !curve.points || curve.points.length === 0) {
                      return (
                        <div style={{ height: 160, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94A3B8', fontSize: 12 }}>
                          {simLoading ? 'Scoring trained XGBoost schedule model...' : 'PDP data unavailable'}
                        </div>
                      );
                    }
                    const width = 360;
                    const height = 180;
                    const padding = { top: 20, right: 25, bottom: 35, left: 45 };
                    const plotW = width - padding.left - padding.right;
                    const plotH = height - padding.top - padding.bottom;

                    const allX = (curve.points || []).map(p => p.x);
                    if (curve.baseline_point?.x != null) allX.push(curve.baseline_point.x);
                    if (whatIfData && curve.scenario_point?.x != null) allX.push(curve.scenario_point.x);
                    let minX = Math.min(...allX);
                    let maxX = Math.max(...allX);
                    if (minX === maxX) maxX = minX + 10;

                    const allY = (curve.points || []).map(p => p.y);
                    if (curve.baseline_point?.y != null) allY.push(curve.baseline_point.y);
                    if (whatIfData && curve.scenario_point?.y != null) allY.push(curve.scenario_point.y);
                    let minY = Math.min(...allY);
                    let maxY = Math.max(...allY);
                    if (minY === maxY) maxY = minY + 5;
                    const yPad = (maxY - minY) * 0.1 || 1;
                    minY -= yPad;
                    maxY += yPad;

                    const scaleX = (x: number) => padding.left + ((x - minX) / (maxX - minX)) * plotW;
                    const scaleY = (y: number) => padding.top + plotH - ((y - minY) / (maxY - minY)) * plotH;

                    const poly = (curve.points || []).map(p => `${scaleX(p.x).toFixed(1)},${scaleY(p.y).toFixed(1)}`).join(' ');
                    const bX = scaleX(curve.baseline_point?.x ?? minX);
                    const bY = scaleY(curve.baseline_point?.y ?? minY);
                    const hasScen = Boolean(whatIfData && curve.scenario_point);
                    const sX = hasScen ? scaleX(curve.scenario_point!.x) : 0;
                    const sY = hasScen ? scaleY(curve.scenario_point!.y) : 0;

                    return (
                      <div>
                        <svg viewBox={`0 0 ${width} ${height}`} className="pdp-svg">
                          <line x1={padding.left} y1={scaleY(minY + yPad)} x2={width - padding.right} y2={scaleY(minY + yPad)} stroke="#F1F5F9" strokeWidth="1" strokeDasharray="3 3" />
                          <line x1={padding.left} y1={scaleY((minY + maxY) / 2)} x2={width - padding.right} y2={scaleY((minY + maxY) / 2)} stroke="#F1F5F9" strokeWidth="1" strokeDasharray="3 3" />
                          <line x1={padding.left} y1={scaleY(maxY - yPad)} x2={width - padding.right} y2={scaleY(maxY - yPad)} stroke="#F1F5F9" strokeWidth="1" strokeDasharray="3 3" />
                          <line x1={padding.left} y1={height - padding.bottom} x2={width - padding.right} y2={height - padding.bottom} stroke="#CBD5E1" strokeWidth="1.5" />
                          <line x1={padding.left} y1={padding.top} x2={padding.left} y2={height - padding.bottom} stroke="#CBD5E1" strokeWidth="1.5" />
                          <polyline fill="none" stroke="#2563EB" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" points={poly}>
                            <title>Predicted Model Response Curve</title>
                          </polyline>
                          <circle cx={bX} cy={bY} r={6} fill="#2563EB" stroke="#FFFFFF" strokeWidth={2} style={{ cursor: 'pointer' }}>
                            <title>Baseline: {curve.baseline_point?.x?.toFixed(0)} Mo, {curve.baseline_point?.y?.toFixed(1)}m</title>
                          </circle>
                          {hasScen && (
                            <circle cx={sX} cy={sY} r={6.5} fill="#DC2626" stroke="#FFFFFF" strokeWidth={2} style={{ cursor: 'pointer' }}>
                              <title>Scenario: {curve.scenario_point?.x?.toFixed(0)} Mo, {curve.scenario_point?.y?.toFixed(1)}m</title>
                            </circle>
                          )}
                          <text x={padding.left} y={height - 12} fontSize="9.5" fill="#64748B" textAnchor="start">{minX.toFixed(0)} Mo</text>
                          <text x={width - padding.right} y={height - 12} fontSize="9.5" fill="#64748B" textAnchor="end">{maxX.toFixed(0)} Mo</text>
                          <text x={padding.left - 6} y={padding.top + 8} fontSize="9.5" fill="#64748B" textAnchor="end">{maxY.toFixed(1)}m</text>
                          <text x={padding.left - 6} y={height - padding.bottom} fontSize="9.5" fill="#64748B" textAnchor="end">{minY.toFixed(1)}m</text>
                        </svg>
                        <div className="pdp-legend">
                          <div className="pdp-legend-item">
                            <span className="pdp-line-sample" style={{ background: '#2563EB' }}></span>
                            <span>PDP Response</span>
                          </div>
                          <div className="pdp-legend-item">
                            <span className="pdp-dot dot-base"></span>
                            <span>Baseline ({curve.baseline_point?.x != null ? curve.baseline_point.x.toFixed(0) : '0'} Mo, {curve.baseline_point?.y != null ? curve.baseline_point.y.toFixed(1) : '0'}m)</span>
                          </div>
                          {hasScen && (
                            <div className="pdp-legend-item">
                              <span className="pdp-dot dot-scen"></span>
                              <span>Scenario ({curve.scenario_point?.x != null ? curve.scenario_point.x.toFixed(0) : '0'} Mo, {curve.scenario_point?.y != null ? curve.scenario_point.y.toFixed(1) : '0'}m)</span>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })()}
                </div>
              </div>

              {/* Dynamic Scenario Explanation */}
              {whatIfData ? (
                <div className="ac-narrative-box">
                  <div className="ac-narrative-title">
                    <Sparkles size={14} /> Counterfactual Evaluation
                  </div>
                  <p style={{ margin: 0 }}>{whatIfData.narrative_insight}</p>
                </div>
              ) : (
                <div className="ac-narrative-box" style={{ background: '#F8FAFC', borderColor: '#E2E8F0', color: '#64748B' }}>
                  <div className="ac-narrative-title" style={{ color: '#475569' }}>
                    <Info size={14} /> Baseline Mode Active
                  </div>
                  <p style={{ margin: 0 }}>
                    Adjust Additional Cost, Additional Time Delay, or Monthly Expenditure above and click <strong>Run Simulation</strong> to score the counterfactual scenario through the trained PAIMANA XGBoost models and centralized Risk Engine.
                  </p>
                </div>
              )}
            </div>
          </section>

          {/* ════════════════════════════════════════════════════════════════
             SECTION 3: POLICY-AWARE AUTHORITY ROUTING (OFFICIAL GOVT FRAMEWORK)
             ════════════════════════════════════════════════════════════════ */}
          <section id="ac-sec-routing" className="ac-section">
            <div className="pd-section-header pd-section-header--warnings" style={{ marginTop: '32px' }}>
              <span className="pd-section-tag">03</span>
              <span className="pd-section-name">Policy-Aware Authority Routing Matrix</span>
              <InfoButton title="Authority Routing Matrix" summary="Official Government Infrastructure Framework (MoSPI, PAIMANA, PIB/EFC & CCEA Guidelines)." size="sm" theme="light" />
            </div>
            <div className="ac-panel-card">
              <div className="ac-panel-head">
                <p className="ac-sec-sub" style={{ margin: 0 }}>
                  Official Government Infrastructure Framework (MoSPI, PAIMANA, PIB/EFC &amp; CCEA Guidelines).
                </p>
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
                    <span className="tier-scope">₹150 Cr – ₹500 Cr / RCE-I</span>
                  </div>
                  <h4 className="tier-title">Standing Committee on Time &amp; Cost Overruns (SCOC)</h4>
                  <p className="tier-sub">Departmental committee chaired by Additional Secretary / Joint Secretary.</p>
                </div>

                {/* Tier 3 */}
                <div className={`ac-tier-card ${authorityRouting.tierNum === 3 ? 'tier-active' : ''}`}>
                  <div className="tier-head">
                    <span className="tier-num">TIER 3</span>
                    <span className="tier-scope">₹500 Cr – ₹1,000 Cr / RCE-II</span>
                  </div>
                  <h4 className="tier-title">Public Investment Board (PIB) / EFC</h4>
                  <p className="tier-sub">Ministry of Finance committee chaired by Secretary (Expenditure).</p>
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
                    className="ac-gov-btn btn-scoc"
                    style={{ background: '#2563EB', color: '#ffffff', border: 'none' }}
                    onClick={() => {
                      const ticket: TicketData = {
                        id: `TCK-${Date.now().toString().slice(-6)}`,
                        projectName: activeProj.name,
                        projectId: activeProj.id,
                        actionTitle: authorityRouting.mandate,
                        routedOfficer: authorityRouting.title,
                        status: 'OPEN',
                        priority: activeProj.riskScore >= 75 ? 'Critical' : 'High',
                        dateCreated: new Date().toLocaleDateString('en-IN'),
                        ministry: activeProj.ministry,
                        agency: activeProj.agency || 'Executing Agency',
                        description: `Official Escalation requested for ${activeProj.name} to ${authorityRouting.title}. Reason: Cost/Time overrun limits exceeded active threshold.`,
                      };
                      if (onCreateTicket) {
                        onCreateTicket(ticket);
                      }
                      generateTicketPDF(ticket);
                      triggerToast(`Official ${authorityRouting.title} Action Ticket generated & routed!`);
                    }}
                  >
                    <Send size={14} />
                    <span>Generate Ticket (PDF)</span>
                  </button>

                  <button
                    type="button"
                    className="ac-gov-btn btn-cabinet"
                    style={{ background: 'rgba(37, 99, 235, 0.08)', color: '#1D4ED8', border: '1px solid rgba(37, 99, 235, 0.3)' }}
                    onClick={() => {
                      generateMemoPDF(activeProj.name, activeProj.id, authorityRouting.mandate, authorityRouting.title);
                      triggerToast(`Official ${authorityRouting.title} Memo drafted for #${activeProj.id}`);
                    }}
                  >
                    <FileText size={14} />
                    <span>Generate Memo (PDF)</span>
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

          {/* Stacked 1-Column Projects List (Image 3 Executive Horizontal Row Layout) */}
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
                const overrunPct = origCost > 0 ? Math.round(((revCost - origCost) / origCost) * 100) : parseInt(proj.costOverrunPct) || 0;
                const delayMonths = proj.timeOverrunMonths || 0;
                const riskVal = proj.riskScore ?? 50;
                const isCrit = riskVal >= 75 || proj.scheduleStatus === 'CRITICAL';

                return (
                  <div key={proj.id} className="img3-intervention-row">
                    <span className={`img3-rank-badge ${idx % 2 === 1 ? 'rank-blue' : 'rank-dark'}`}>
                      #{String(idx + 1).padStart(2, '0')}
                    </span>

                    <div className="img3-info-col">
                      <div className="img3-meta-top">
                        <span className="img3-id-tag">#{proj.id}</span>
                        <span className="img3-meta-dot">•</span>
                        <span className="img3-sector-tag"><Building2 size={12} /> {proj.sector}</span>
                        <span className="img3-meta-dot">•</span>
                        <span className="img3-ministry-tag">{proj.ministry}</span>
                      </div>
                      <h3 className="img3-project-title">{proj.name}</h3>
                    </div>

                    <div className="img3-metrics-group">
                      <div className="img3-metric-item">
                        <span className="img3-metric-lbl">COST OVERRUN</span>
                        <div className="img3-metric-val-row text-red">
                          <TrendingUp size={13} />
                          <span className="img3-val-bold">+{overrunPct}%</span>
                          {deltaCr > 0 && <span className="img3-val-sub">(+₹{Math.round(deltaCr)} Cr)</span>}
                        </div>
                      </div>

                      <div className="img3-metric-item">
                        <span className="img3-metric-lbl">SCHEDULE SLIPPAGE</span>
                        <div className="img3-metric-val-row text-amber">
                          <Clock size={13} />
                          <span className="img3-val-bold">+{delayMonths} mo delay</span>
                        </div>
                      </div>

                      <div className="img3-metric-item">
                        <span className="img3-metric-lbl">RISK INDEX</span>
                        <div className="img3-risk-val-row">
                          <span className="img3-risk-num">{riskVal} <span className="img3-risk-denom">/100</span></span>
                          <span className={`img3-critical-badge ${isCrit ? 'badge-crit' : 'badge-high'}`}>
                            {isCrit ? 'CRITICAL' : 'HIGH RISK'}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="img3-actions-group">
                      <button
                        type="button"
                        className="img3-inspect-btn"
                        onClick={() => onSelectProject(proj.id)}
                      >
                        <span>Inspect</span>
                        <ExternalLink size={13} />
                      </button>

                      <button
                        type="button"
                        className="img3-action-btn"
                        onClick={() => setInternalTargetId(proj.id)}
                      >
                        <ShieldAlert size={13} />
                        <span>Take Action</span>
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
