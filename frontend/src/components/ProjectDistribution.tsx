import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
  ShieldAlert,
  AlertTriangle,
  CheckCircle2,
  Layers,
  TrendingUp,
  MapPin,
  Sparkles,
  ArrowRight,
  ChevronDown,
  Building2,
  Activity,
  ChevronLeft,
  ChevronRight,
  ArrowUp,
  Bot,
  PieChart,
  BarChart3,
  Sliders,
  Filter
} from 'lucide-react';
import './ProjectDistribution.css';
import { AnimatedCounter } from './AnimatedCounter';
import { api } from '../services/api';
import type { DistributionSummaryData } from '../services/api';
import { StatusIndicator } from './StatusIndicator';
import { projectsData, type Project } from '../data/projectsData';
import { InfoButton } from './ExplainabilityInfo';

export interface ProjectDistributionProps {
  onSelectProject?: (projectId: string) => void;
  onNavigateTab?: (tab: string) => void;
}

type SidebarSection = 'breakdown' | 'interventions' | 'comparison';

const SIDEBAR_SECTIONS = [
  {
    id: 'breakdown' as SidebarSection,
    icon: PieChart,
    label: 'Health & Risk Breakdown',
    desc: 'Donuts & tier progress bars',
    num: '01',
  },
  {
    id: 'interventions' as SidebarSection,
    icon: ShieldAlert,
    label: 'Priority Interventions',
    desc: 'Top 5 & 10 critical assets',
    num: '02',
  },
  {
    id: 'comparison' as SidebarSection,
    icon: BarChart3,
    label: 'Comparative Analytics',
    desc: 'Head-to-head entity metrics',
    num: '03',
  },
];

export const ProjectDistribution: React.FC<ProjectDistributionProps> = ({
  onSelectProject,
  onNavigateTab
}) => {
  // Navigation Sidebar State — closed by default on page load
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(true);
  const [activeSection, setActiveSection] = useState<SidebarSection>('breakdown');

  // Datasets
  const [projects, setProjects] = useState<Project[]>([]);
  useEffect(() => {
    setProjects(projectsData);
  }, []);

  // Section 1 State: Breakdown Toggles & Selection
  const [sec1Mode, setSec1Mode] = useState<'ministry' | 'sector'>('ministry');
  const [sec1SelectedEntity, setSec1SelectedEntity] = useState<string>('All');

  // Section 2 State: Interventions Toggles & Selection
  const [sec2Mode, setSec2Mode] = useState<'ministry' | 'sector'>('ministry');
  const [sec2SelectedEntity, setSec2SelectedEntity] = useState<string>('All');
  const [sec2Count, setSec2Count] = useState<5 | 10>(5);

  // Section 3 State: Comparison Toggles & Selection
  const [sec3Mode, setSec3Mode] = useState<'ministry' | 'sector'>('ministry');
  const [sec3EntityA, setSec3EntityA] = useState<string>('');
  const [sec3EntityB, setSec3EntityB] = useState<string>('');

  // Extract unique Ministries & Sectors
  const allMinistries = useMemo(() => {
    const set = new Set<string>();
    projects.forEach(p => {
      if (p.ministry) set.add(p.ministry.trim());
    });
    return Array.from(set).sort();
  }, [projects]);

  const allSectors = useMemo(() => {
    const set = new Set<string>();
    projects.forEach(p => {
      if (p.sector) set.add(p.sector.trim());
    });
    return Array.from(set).sort();
  }, [projects]);

  // Set default comparison entities
  useEffect(() => {
    if (sec3Mode === 'ministry') {
      setSec3EntityA(allMinistries[0] || 'Ministry of Railways');
      setSec3EntityB(allMinistries[1] || 'Ministry of Road Transport and Highways');
    } else {
      setSec3EntityA(allSectors[0] || 'RAILWAYS');
      setSec3EntityB(allSectors[1] || 'ROADS AND HIGHWAYS');
    }
  }, [sec3Mode, allMinistries, allSectors]);

  // Smooth scroll handler
  const scrollToSection = useCallback((sectionId: SidebarSection) => {
    setActiveSection(sectionId);
    const el = document.getElementById(`dist-section-${sectionId}`);
    if (el) {
      const headerOffset = 88;
      const elementTop = el.getBoundingClientRect().top + window.scrollY;
      window.scrollTo({
        top: elementTop - headerOffset,
        behavior: 'smooth'
      });
    }
  }, []);

  // Track active section on scroll
  useEffect(() => {
    const sections: SidebarSection[] = ['breakdown', 'interventions', 'comparison'];
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const id = entry.target.id.replace('dist-section-', '') as SidebarSection;
            setActiveSection(id);
          }
        });
      },
      { rootMargin: '-20% 0px -60% 0px', threshold: 0 }
    );

    sections.forEach((id) => {
      const el = document.getElementById(`dist-section-${id}`);
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, []);

  /* ─────────────────────────────────────────────────────────────
     SECTION 1: HEALTH & RISK BREAKDOWN DATA CALCULATIONS
     ───────────────────────────────────────────────────────────── */
  const sec1FilteredProjects = useMemo(() => {
    if (sec1SelectedEntity === 'All') return projects;
    if (sec1Mode === 'ministry') {
      return projects.filter(p => p.ministry?.trim() === sec1SelectedEntity);
    }
    return projects.filter(p => p.sector?.trim() === sec1SelectedEntity);
  }, [projects, sec1Mode, sec1SelectedEntity]);

  const sec1Metrics = useMemo(() => {
    const total = sec1FilteredProjects.length;
    if (total === 0) {
      return {
        total: 0,
        health: { healthy: 0, moderate: 0, vulnerable: 0, critical: 0 },
        healthPcts: { healthy: 0, moderate: 0, vulnerable: 0, critical: 0 },
        risk: { low: 0, moderate: 0, high: 0, critical: 0 },
        riskPcts: { low: 0, moderate: 0, high: 0, critical: 0 },
        avgRisk: 0,
        avgHealth: 0
      };
    }

    let healthy = 0, hMod = 0, hVul = 0, hCrit = 0;
    let rLow = 0, rMod = 0, rHigh = 0, rCrit = 0;
    let sumRisk = 0;

    sec1FilteredProjects.forEach(p => {
      const risk = p.riskScore ?? 50;
      sumRisk += risk;

      // Risk tiers
      if (risk >= 80) rCrit++;
      else if (risk >= 65) rHigh++;
      else if (risk >= 40) rMod++;
      else rLow++;

      // Health Index tiers (inverse of risk + physical progress weight)
      const healthScore = Math.max(0, Math.min(100, Math.round(100 - risk * 0.7 + (p.progressPhysical || 0) * 0.3)));
      if (healthScore >= 75) healthy++;
      else if (healthScore >= 55) hMod++;
      else if (healthScore >= 35) hVul++;
      else hCrit++;
    });

    const avgRisk = Math.round(sumRisk / total);
    const avgHealth = Math.round(100 - avgRisk * 0.7);

    return {
      total,
      health: { healthy, moderate: hMod, vulnerable: hVul, critical: hCrit },
      healthPcts: {
        healthy: Math.round((healthy / total) * 100),
        moderate: Math.round((hMod / total) * 100),
        vulnerable: Math.round((hVul / total) * 100),
        critical: Math.round((hCrit / total) * 100)
      },
      risk: { low: rLow, moderate: rMod, high: rHigh, critical: rCrit },
      riskPcts: {
        low: Math.round((rLow / total) * 100),
        moderate: Math.round((rMod / total) * 100),
        high: Math.round((rHigh / total) * 100),
        critical: Math.round((rCrit / total) * 100)
      },
      avgRisk,
      avgHealth
    };
  }, [sec1FilteredProjects]);

  /* ─────────────────────────────────────────────────────────────
     SECTION 2: PRIORITY INTERVENTIONS DATA CALCULATIONS
     ───────────────────────────────────────────────────────────── */
  const sec2FilteredProjects = useMemo(() => {
    let list = projects;
    if (sec2SelectedEntity !== 'All') {
      if (sec2Mode === 'ministry') {
        list = projects.filter(p => p.ministry?.trim() === sec2SelectedEntity);
      } else {
        list = projects.filter(p => p.sector?.trim() === sec2SelectedEntity);
      }
    }

    // Sort by highest risk score, then cost overrun
    return [...list]
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
      })
      .slice(0, sec2Count);
  }, [projects, sec2Mode, sec2SelectedEntity, sec2Count]);

  /* ─────────────────────────────────────────────────────────────
     SECTION 3: COMPARATIVE ANALYTICS CALCULATIONS
     ───────────────────────────────────────────────────────────── */
  const calculateEntityStats = useCallback((entityName: string, mode: 'ministry' | 'sector') => {
    const list = projects.filter(p => (mode === 'ministry' ? p.ministry : p.sector)?.trim() === entityName);
    const count = list.length;
    if (count === 0) {
      return { count: 0, totalCostCr: 0, avgRisk: 0, overrunPct: 0, criticalCount: 0, avgProgress: 0 };
    }

    let totalCost = 0;
    let totalOrigCost = 0;
    let sumRisk = 0;
    let critCount = 0;
    let sumProg = 0;

    list.forEach(p => {
      const rev = parseFloat(p.costRevised.replace(/[^0-9.]/g, '')) || 0;
      const orig = parseFloat(p.costApproved.replace(/[^0-9.]/g, '')) || 0;
      totalCost += rev;
      totalOrigCost += orig;

      const r = p.riskScore ?? 50;
      sumRisk += r;
      if (r >= 70 || p.scheduleStatus === 'CRITICAL' || p.riskLevel === 'Critical') critCount++;

      sumProg += p.progressPhysical || 0;
    });

    const overrunPct = totalOrigCost > 0 ? Math.round(((totalCost - totalOrigCost) / totalOrigCost) * 100) : 0;

    return {
      count,
      totalCostCr: Math.round(totalCost),
      avgRisk: Math.round(sumRisk / count),
      overrunPct: Math.max(0, overrunPct),
      criticalCount: critCount,
      avgProgress: Math.round(sumProg / count)
    };
  }, [projects]);

  const statsA = useMemo(() => calculateEntityStats(sec3EntityA, sec3Mode), [calculateEntityStats, sec3EntityA, sec3Mode]);
  const statsB = useMemo(() => calculateEntityStats(sec3EntityB, sec3Mode), [calculateEntityStats, sec3EntityB, sec3Mode]);

  // Top 6 Entities Leaderboard Matrix
  const leaderboardItems = useMemo(() => {
    const sourceList = sec3Mode === 'ministry' ? allMinistries : allSectors;
    return sourceList
      .map(name => {
        const st = calculateEntityStats(name, sec3Mode);
        return { name, ...st };
      })
      .filter(x => x.count > 0)
      .sort((a, b) => b.avgRisk - a.avgRisk)
      .slice(0, 6);
  }, [sec3Mode, allMinistries, allSectors, calculateEntityStats]);

  return (
    <div className="dist-page-layout animation-fade-in">
      {/* ── Portaled Navigation Sidebar (Closed by default) ── */}
      {typeof document !== 'undefined' && createPortal(
        <aside className={`pnav ${sidebarCollapsed ? 'pnav--collapsed' : ''}`} aria-label="Distribution Navigation">
          <div className="pnav__card">
            {/* Header */}
            <div className="pnav__brand">
              {!sidebarCollapsed && (
                <div className="pnav__brand-text">
                  <Activity size={14} className="pnav__brand-icon" />
                  <span>Distribution Telemetry</span>
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

            {/* Gauge summary */}
            {!sidebarCollapsed && (
              <div className="pnav__gauge">
                <div className="pnav__gauge-row">
                  <span className="pnav__gauge-label">Portfolio Risk</span>
                  <span className="pnav__gauge-val" style={{ color: '#D97706' }}>Moderate</span>
                </div>
                <div className="pnav__gauge-num" style={{ color: '#D97706' }}>
                  {sec1Metrics.avgRisk}
                  <span className="pnav__gauge-denom">/100</span>
                </div>
                <div className="pnav__gauge-track">
                  <div className="pnav__gauge-fill" style={{ width: `${sec1Metrics.avgRisk}%`, background: '#D97706' }} />
                </div>
              </div>
            )}

            <div className="pnav__sep" />

            {/* Nav Items */}
            <nav className="pnav__nav">
              {SIDEBAR_SECTIONS.map((sec, idx) => {
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

      {/* ── Page Title Banner ── */}
      <div className="dist-page-header">
        <div className="dist-header-left">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <h1 className="dist-page-title">Project Distribution Analytics</h1>
            <InfoButton
              title="Distribution Intelligence Telemetry"
              summary="Cross-sectoral and departmental analytical engine tracking health distributions, ML risk profiles, priority intervention targets, and side-by-side performance benchmarks."
              size="md"
            />
          </div>
          <p className="dist-page-subtitle">
            Departmental risk concentration, sectoral health breakdown, and targeted priority intervention models.
          </p>
        </div>
        <div className="dist-header-right">
          <div className="dist-header-badge">
            <span className="dist-pulse-dot" />
            <span>3,361 Active Assets Synchronized</span>
          </div>
        </div>
      </div>

      {/* ════════════════════════════════════════════════════════════════
         SECTION 1: HEALTH & RISK BREAKDOWN (DONUTS + PROGRESS BARS)
         ════════════════════════════════════════════════════════════════ */}
      <section id="dist-section-breakdown" className="dist-section">
        <div className="dist-panel-card">
          {/* Header Controls */}
          <div className="dist-panel-head">
            <div className="dist-panel-title-group">
              <span className="dist-section-badge">01</span>
              <div>
                <h2 className="dist-section-title">Health &amp; Risk Breakdown</h2>
                <p className="dist-section-sub">
                  Dynamic Donut distribution charts and tier volume indicators by Ministry or Sector.
                </p>
              </div>
            </div>

            {/* Controls: Mode Switcher + Entity Select Dropdown */}
            <div className="dist-controls-group">
              <div className="dist-toggle-pill">
                <button
                  type="button"
                  className={`dist-toggle-btn ${sec1Mode === 'ministry' ? 'active' : ''}`}
                  onClick={() => {
                    setSec1Mode('ministry');
                    setSec1SelectedEntity('All');
                  }}
                >
                  Ministry-Wise
                </button>
                <button
                  type="button"
                  className={`dist-toggle-btn ${sec1Mode === 'sector' ? 'active' : ''}`}
                  onClick={() => {
                    setSec1Mode('sector');
                    setSec1SelectedEntity('All');
                  }}
                >
                  Sector-Wise
                </button>
              </div>

              <div className="dist-dropdown-wrapper">
                <Filter size={14} className="dist-dropdown-icon" />
                <select
                  className="dist-select"
                  value={sec1SelectedEntity}
                  onChange={(e) => setSec1SelectedEntity(e.target.value)}
                >
                  <option value="All">All {sec1Mode === 'ministry' ? 'Ministries' : 'Sectors'} ({projects.length} Assets)</option>
                  {(sec1Mode === 'ministry' ? allMinistries : allSectors).map(item => (
                    <option key={item} value={item}>{item}</option>
                  ))}
                </select>
                <ChevronDown size={14} className="dist-dropdown-arrow" />
              </div>
            </div>
          </div>

          {/* Donut Charts & Progress Bars Grid */}
          <div className="dist-donuts-grid">
            {/* ── Donut 1: Health Index Breakdown ── */}
            <div className="dist-donut-card">
              <div className="dist-card-header-row">
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Activity size={18} color="#2563EB" />
                  <h3 className="dist-card-heading">Portfolio Health Index Breakdown</h3>
                </div>
                <span className="dist-count-chip">{sec1Metrics.total} Projects</span>
              </div>

              <div className="donut-visualization-block">
                {/* SVG Donut Chart */}
                <div className="svg-donut-wrapper">
                  <svg className="svg-donut" viewBox="0 0 160 160">
                    <circle cx="80" cy="80" r="62" fill="none" stroke="#F1F5F9" strokeWidth="18" />
                    {/* Healthy segment */}
                    <circle
                      cx="80" cy="80" r="62" fill="none"
                      stroke="#2563EB" strokeWidth="18"
                      strokeDasharray={`${(sec1Metrics.healthPcts.healthy * 3.9).toFixed(1)} 390`}
                      strokeDashoffset="0"
                      transform="rotate(-90 80 80)"
                    />
                    {/* Moderate segment */}
                    <circle
                      cx="80" cy="80" r="62" fill="none"
                      stroke="#38BDF8" strokeWidth="18"
                      strokeDasharray={`${(sec1Metrics.healthPcts.moderate * 3.9).toFixed(1)} 390`}
                      strokeDashoffset={`-${(sec1Metrics.healthPcts.healthy * 3.9).toFixed(1)}`}
                      transform="rotate(-90 80 80)"
                    />
                    {/* Vulnerable segment */}
                    <circle
                      cx="80" cy="80" r="62" fill="none"
                      stroke="#64748B" strokeWidth="18"
                      strokeDasharray={`${(sec1Metrics.healthPcts.vulnerable * 3.9).toFixed(1)} 390`}
                      strokeDashoffset={`-${((sec1Metrics.healthPcts.healthy + sec1Metrics.healthPcts.moderate) * 3.9).toFixed(1)}`}
                      transform="rotate(-90 80 80)"
                    />
                    {/* Critical segment */}
                    <circle
                      cx="80" cy="80" r="62" fill="none"
                      stroke="#0F172A" strokeWidth="18"
                      strokeDasharray={`${(sec1Metrics.healthPcts.critical * 3.9).toFixed(1)} 390`}
                      strokeDashoffset={`-${((sec1Metrics.healthPcts.healthy + sec1Metrics.healthPcts.moderate + sec1Metrics.healthPcts.vulnerable) * 3.9).toFixed(1)}`}
                      transform="rotate(-90 80 80)"
                    />
                  </svg>
                  <div className="svg-donut-center">
                    <span className="donut-center-num">{sec1Metrics.avgHealth}</span>
                    <span className="donut-center-label">Avg Health Index</span>
                  </div>
                </div>

                {/* Horizontal Breakdown Bars Below Donut 1 */}
                <div className="donut-bars-list">
                  <div className="bar-breakdown-row">
                    <div className="bar-info-row">
                      <span className="bar-label-dot" style={{ backgroundColor: '#2563EB' }} />
                      <span className="bar-name">Healthy (Score 75-100)</span>
                      <span className="bar-value">{sec1Metrics.health.healthy} ({sec1Metrics.healthPcts.healthy}%)</span>
                    </div>
                    <div className="bar-track">
                      <div className="bar-fill" style={{ width: `${sec1Metrics.healthPcts.healthy}%`, background: '#2563EB' }} />
                    </div>
                  </div>

                  <div className="bar-breakdown-row">
                    <div className="bar-info-row">
                      <span className="bar-label-dot" style={{ backgroundColor: '#38BDF8' }} />
                      <span className="bar-name">Moderate (Score 55-74)</span>
                      <span className="bar-value">{sec1Metrics.health.moderate} ({sec1Metrics.healthPcts.moderate}%)</span>
                    </div>
                    <div className="bar-track">
                      <div className="bar-fill" style={{ width: `${sec1Metrics.healthPcts.moderate}%`, background: '#38BDF8' }} />
                    </div>
                  </div>

                  <div className="bar-breakdown-row">
                    <div className="bar-info-row">
                      <span className="bar-label-dot" style={{ backgroundColor: '#64748B' }} />
                      <span className="bar-name">Vulnerable (Score 35-54)</span>
                      <span className="bar-value">{sec1Metrics.health.vulnerable} ({sec1Metrics.healthPcts.vulnerable}%)</span>
                    </div>
                    <div className="bar-track">
                      <div className="bar-fill" style={{ width: `${sec1Metrics.healthPcts.vulnerable}%`, background: '#64748B' }} />
                    </div>
                  </div>

                  <div className="bar-breakdown-row">
                    <div className="bar-info-row">
                      <span className="bar-label-dot" style={{ backgroundColor: '#0F172A' }} />
                      <span className="bar-name">Critical (Score &lt;35)</span>
                      <span className="bar-value">{sec1Metrics.health.critical} ({sec1Metrics.healthPcts.critical}%)</span>
                    </div>
                    <div className="bar-track">
                      <div className="bar-fill" style={{ width: `${sec1Metrics.healthPcts.critical}%`, background: '#0F172A' }} />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* ── Donut 2: Risk Index Breakdown ── */}
            <div className="dist-donut-card">
              <div className="dist-card-header-row">
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <ShieldAlert size={18} color="#DC2626" />
                  <h3 className="dist-card-heading">ML Composite Risk Index Breakdown</h3>
                </div>
                <span className="dist-count-chip count-red">Avg Risk: {sec1Metrics.avgRisk}/100</span>
              </div>

              <div className="donut-visualization-block">
                {/* SVG Donut Chart */}
                <div className="svg-donut-wrapper">
                  <svg className="svg-donut" viewBox="0 0 160 160">
                    <circle cx="80" cy="80" r="62" fill="none" stroke="#F1F5F9" strokeWidth="18" />
                    {/* Low Risk */}
                    <circle
                      cx="80" cy="80" r="62" fill="none"
                      stroke="#16A34A" strokeWidth="18"
                      strokeDasharray={`${(sec1Metrics.riskPcts.low * 3.9).toFixed(1)} 390`}
                      strokeDashoffset="0"
                      transform="rotate(-90 80 80)"
                    />
                    {/* Moderate Risk */}
                    <circle
                      cx="80" cy="80" r="62" fill="none"
                      stroke="#D97706" strokeWidth="18"
                      strokeDasharray={`${(sec1Metrics.riskPcts.moderate * 3.9).toFixed(1)} 390`}
                      strokeDashoffset={`-${(sec1Metrics.riskPcts.low * 3.9).toFixed(1)}`}
                      transform="rotate(-90 80 80)"
                    />
                    {/* High Risk */}
                    <circle
                      cx="80" cy="80" r="62" fill="none"
                      stroke="#DC2626" strokeWidth="18"
                      strokeDasharray={`${(sec1Metrics.riskPcts.high * 3.9).toFixed(1)} 390`}
                      strokeDashoffset={`-${((sec1Metrics.riskPcts.low + sec1Metrics.riskPcts.moderate) * 3.9).toFixed(1)}`}
                      transform="rotate(-90 80 80)"
                    />
                    {/* Critical Risk */}
                    <circle
                      cx="80" cy="80" r="62" fill="none"
                      stroke="#7F1D1D" strokeWidth="18"
                      strokeDasharray={`${(sec1Metrics.riskPcts.critical * 3.9).toFixed(1)} 390`}
                      strokeDashoffset={`-${((sec1Metrics.riskPcts.low + sec1Metrics.riskPcts.moderate + sec1Metrics.riskPcts.high) * 3.9).toFixed(1)}`}
                      transform="rotate(-90 80 80)"
                    />
                  </svg>
                  <div className="svg-donut-center">
                    <span className="donut-center-num text-red">{sec1Metrics.avgRisk}</span>
                    <span className="donut-center-label">Avg ML Risk</span>
                  </div>
                </div>

                {/* Horizontal Breakdown Bars Below Donut 2 */}
                <div className="donut-bars-list">
                  <div className="bar-breakdown-row">
                    <div className="bar-info-row">
                      <span className="bar-label-dot" style={{ backgroundColor: '#16A34A' }} />
                      <span className="bar-name">Low Risk (&lt;40)</span>
                      <span className="bar-value">{sec1Metrics.risk.low} ({sec1Metrics.riskPcts.low}%)</span>
                    </div>
                    <div className="bar-track">
                      <div className="bar-fill" style={{ width: `${sec1Metrics.riskPcts.low}%`, background: '#16A34A' }} />
                    </div>
                  </div>

                  <div className="bar-breakdown-row">
                    <div className="bar-info-row">
                      <span className="bar-label-dot" style={{ backgroundColor: '#D97706' }} />
                      <span className="bar-name">Moderate Risk (40-64)</span>
                      <span className="bar-value">{sec1Metrics.risk.moderate} ({sec1Metrics.riskPcts.moderate}%)</span>
                    </div>
                    <div className="bar-track">
                      <div className="bar-fill" style={{ width: `${sec1Metrics.riskPcts.moderate}%`, background: '#D97706' }} />
                    </div>
                  </div>

                  <div className="bar-breakdown-row">
                    <div className="bar-info-row">
                      <span className="bar-label-dot" style={{ backgroundColor: '#DC2626' }} />
                      <span className="bar-name">High Risk (65-79)</span>
                      <span className="bar-value">{sec1Metrics.risk.high} ({sec1Metrics.riskPcts.high}%)</span>
                    </div>
                    <div className="bar-track">
                      <div className="bar-fill" style={{ width: `${sec1Metrics.riskPcts.high}%`, background: '#DC2626' }} />
                    </div>
                  </div>

                  <div className="bar-breakdown-row">
                    <div className="bar-info-row">
                      <span className="bar-label-dot" style={{ backgroundColor: '#7F1D1D' }} />
                      <span className="bar-name">Critical Risk (&ge;80)</span>
                      <span className="bar-value">{sec1Metrics.risk.critical} ({sec1Metrics.riskPcts.critical}%)</span>
                    </div>
                    <div className="bar-track">
                      <div className="bar-fill" style={{ width: `${sec1Metrics.riskPcts.critical}%`, background: '#7F1D1D' }} />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ════════════════════════════════════════════════════════════════
         SECTION 2: PRIORITY INTERVENTIONS (TOP 5 & TOP 10 CARDS GRID)
         ════════════════════════════════════════════════════════════════ */}
      <section id="dist-section-interventions" className="dist-section">
        <div className="dist-panel-card">
          {/* Header Controls */}
          <div className="dist-panel-head">
            <div className="dist-panel-title-group">
              <span className="dist-section-badge badge-red">02</span>
              <div>
                <h2 className="dist-section-title">Priority Interventions</h2>
                <p className="dist-section-sub">
                  High-priority assets requiring urgent departmental intervention and executive oversight.
                </p>
              </div>
            </div>

            {/* Controls: Mode + Dropdown + Count Selector (Top 5 / Top 10) */}
            <div className="dist-controls-group">
              <div className="dist-toggle-pill">
                <button
                  type="button"
                  className={`dist-toggle-btn ${sec2Mode === 'ministry' ? 'active' : ''}`}
                  onClick={() => {
                    setSec2Mode('ministry');
                    setSec2SelectedEntity('All');
                  }}
                >
                  Ministry
                </button>
                <button
                  type="button"
                  className={`dist-toggle-btn ${sec2Mode === 'sector' ? 'active' : ''}`}
                  onClick={() => {
                    setSec2Mode('sector');
                    setSec2SelectedEntity('All');
                  }}
                >
                  Sector
                </button>
              </div>

              <div className="dist-dropdown-wrapper">
                <select
                  className="dist-select"
                  value={sec2SelectedEntity}
                  onChange={(e) => setSec2SelectedEntity(e.target.value)}
                >
                  <option value="All">All {sec2Mode === 'ministry' ? 'Ministries' : 'Sectors'}</option>
                  {(sec2Mode === 'ministry' ? allMinistries : allSectors).map(item => (
                    <option key={item} value={item}>{item}</option>
                  ))}
                </select>
                <ChevronDown size={14} className="dist-dropdown-arrow" />
              </div>

              {/* Count Toggle Pill */}
              <div className="dist-toggle-pill count-toggle">
                <button
                  type="button"
                  className={`dist-toggle-btn ${sec2Count === 5 ? 'active' : ''}`}
                  onClick={() => setSec2Count(5)}
                >
                  Top 5
                </button>
                <button
                  type="button"
                  className={`dist-toggle-btn ${sec2Count === 10 ? 'active' : ''}`}
                  onClick={() => setSec2Count(10)}
                >
                  Top 10
                </button>
              </div>
            </div>
          </div>

          {/* Projects Cards Grid */}
          <div className="interventions-cards-grid">
            {sec2FilteredProjects.length === 0 ? (
              <div className="dist-empty-state">
                <ShieldAlert size={32} color="#94A3B8" />
                <p>No critical intervention assets found for this selection.</p>
              </div>
            ) : (
              sec2FilteredProjects.map((proj, idx) => {
                const origCost = parseFloat(proj.costApproved.replace(/[^0-9.]/g, '')) || 0;
                const revCost = parseFloat(proj.costRevised.replace(/[^0-9.]/g, '')) || 0;
                const deltaCr = revCost - origCost;
                const riskVal = proj.riskScore ?? 50;
                const isCrit = riskVal >= 75 || proj.scheduleStatus === 'CRITICAL';
                const statusColor = isCrit ? '#DC2626' : proj.scheduleStatus === 'DELAYED' ? '#D97706' : '#2563EB';

                return (
                  <div key={proj.id} className="intervention-item-card">
                    {/* Top Rank Badge & Risk Score Pill */}
                    <div className="item-card-top">
                      <div className="rank-badge-wrap">
                        <span className="rank-num">#{String(idx + 1).padStart(2, '0')}</span>
                        <span className="item-project-id">#{proj.id}</span>
                      </div>
                      <div className="item-risk-pill" style={{ color: statusColor, borderColor: `${statusColor}44`, backgroundColor: `${statusColor}10` }}>
                        <span>ML Risk: {riskVal}/100</span>
                      </div>
                    </div>

                    {/* Title & Metadata */}
                    <h3 className="item-project-name">{proj.name}</h3>
                    <div className="item-meta-row">
                      <span className="item-meta-tag"><Building2 size={12} /> {proj.sector}</span>
                      <span className="item-meta-tag"><MapPin size={12} /> {proj.location?.split('\r\n')[0]}</span>
                    </div>

                    {/* Cost & Progress Metrics Grid */}
                    <div className="item-metrics-grid">
                      <div className="item-metric-col">
                        <span className="metric-lbl">Revised Outlay</span>
                        <span className="metric-val">₹{proj.costRevised} Cr</span>
                      </div>
                      <div className="item-metric-col">
                        <span className="metric-lbl">Cost Overrun</span>
                        <span className="metric-val text-red">
                          {deltaCr > 0 ? `+₹${Math.round(deltaCr)} Cr` : 'On Baseline'}
                        </span>
                      </div>
                      <div className="item-metric-col">
                        <span className="metric-lbl">Physical Execution</span>
                        <span className="metric-val">{proj.progressPhysical || 0}%</span>
                      </div>
                    </div>

                    {/* Progress Bar */}
                    <div className="item-progress-track">
                      <div
                        className="item-progress-fill"
                        style={{ width: `${proj.progressPhysical || 0}%`, background: statusColor }}
                      />
                    </div>

                    {/* Action CTA */}
                    <button
                      type="button"
                      className="item-inspect-btn"
                      onClick={() => onSelectProject?.(proj.id)}
                    >
                      <span>Inspect Detailed Telemetry</span>
                      <ArrowRight size={14} />
                    </button>
                  </div>
                );
              })
            )}
          </div>

          {/* Footer Navigation CTA */}
          <div className="interventions-footer-bar">
            <span>Showing Top {sec2Count} Priority Interventions in {sec2SelectedEntity}</span>
            <button
              type="button"
              className="dist-explore-all-btn"
              onClick={() => onNavigateTab?.('projects')}
            >
              <span>Explore All Monitored Assets in Portfolio</span>
              <ArrowRight size={14} />
            </button>
          </div>
        </div>
      </section>

      {/* ════════════════════════════════════════════════════════════════
         SECTION 3: COMPARATIVE ANALYTICS (ENTITY VS ENTITY BENCHMARK)
         ════════════════════════════════════════════════════════════════ */}
      <section id="dist-section-comparison" className="dist-section">
        <div className="dist-panel-card">
          {/* Header Controls */}
          <div className="dist-panel-head">
            <div className="dist-panel-title-group">
              <span className="dist-section-badge badge-blue">03</span>
              <div>
                <h2 className="dist-section-title">Comparative Analytics</h2>
                <p className="dist-section-sub">
                  Head-to-head entity benchmarks and sectoral performance leaderboards.
                </p>
              </div>
            </div>

            {/* Controls: Mode Switcher */}
            <div className="dist-controls-group">
              <div className="dist-toggle-pill">
                <button
                  type="button"
                  className={`dist-toggle-btn ${sec3Mode === 'ministry' ? 'active' : ''}`}
                  onClick={() => setSec3Mode('ministry')}
                >
                  Ministry Comparison
                </button>
                <button
                  type="button"
                  className={`dist-toggle-btn ${sec3Mode === 'sector' ? 'active' : ''}`}
                  onClick={() => setSec3Mode('sector')}
                >
                  Sector Comparison
                </button>
              </div>
            </div>
          </div>

          {/* Dual Dropdowns for Entity A vs Entity B */}
          <div className="dist-compare-selector-bar">
            <div className="compare-select-col">
              <label className="compare-lbl">Entity A ({sec3Mode === 'ministry' ? 'Primary Ministry' : 'Sector A'}):</label>
              <div className="dist-dropdown-wrapper full-w">
                <select
                  className="dist-select"
                  value={sec3EntityA}
                  onChange={(e) => setSec3EntityA(e.target.value)}
                >
                  {(sec3Mode === 'ministry' ? allMinistries : allSectors).map(item => (
                    <option key={item} value={item}>{item}</option>
                  ))}
                </select>
                <ChevronDown size={14} className="dist-dropdown-arrow" />
              </div>
            </div>

            <div className="compare-vs-badge">VS</div>

            <div className="compare-select-col">
              <label className="compare-lbl">Entity B ({sec3Mode === 'ministry' ? 'Benchmark Ministry' : 'Sector B'}):</label>
              <div className="dist-dropdown-wrapper full-w">
                <select
                  className="dist-select"
                  value={sec3EntityB}
                  onChange={(e) => setSec3EntityB(e.target.value)}
                >
                  {(sec3Mode === 'ministry' ? allMinistries : allSectors).map(item => (
                    <option key={item} value={item}>{item}</option>
                  ))}
                </select>
                <ChevronDown size={14} className="dist-dropdown-arrow" />
              </div>
            </div>
          </div>

          {/* Head to Head Comparison Matrix Card */}
          <div className="compare-matrix-card">
            <div className="matrix-head-row">
              <div className="matrix-cell-head text-blue">{sec3EntityA}</div>
              <div className="matrix-cell-head text-center">COMPARISON METRIC</div>
              <div className="matrix-cell-head text-right text-indigo">{sec3EntityB}</div>
            </div>

            {/* Metric 1: Total Assets */}
            <div className="matrix-data-row">
              <div className="matrix-val-cell font-bold text-blue">{statsA.count} Assets</div>
              <div className="matrix-label-cell">Monitored Project Count</div>
              <div className="matrix-val-cell font-bold text-indigo text-right">{statsB.count} Assets</div>
            </div>

            {/* Metric 2: Total Sanctioned Outlay */}
            <div className="matrix-data-row">
              <div className="matrix-val-cell font-bold">₹{statsA.totalCostCr.toLocaleString()} Cr</div>
              <div className="matrix-label-cell">Total Revised Outlay</div>
              <div className="matrix-val-cell font-bold text-right">₹{statsB.totalCostCr.toLocaleString()} Cr</div>
            </div>

            {/* Metric 3: Avg Risk Score */}
            <div className="matrix-data-row">
              <div className="matrix-val-cell">
                <span className={`badge-pill ${statsA.avgRisk >= 60 ? 'bg-red' : 'bg-blue'}`}>{statsA.avgRisk}/100</span>
              </div>
              <div className="matrix-label-cell">Composite Risk Index</div>
              <div className="matrix-val-cell text-right">
                <span className={`badge-pill ${statsB.avgRisk >= 60 ? 'bg-red' : 'bg-indigo'}`}>{statsB.avgRisk}/100</span>
              </div>
            </div>

            {/* Metric 4: Cost Overrun Delta */}
            <div className="matrix-data-row">
              <div className="matrix-val-cell font-bold text-red">+{statsA.overrunPct}% Overrun</div>
              <div className="matrix-label-cell">Cost Escalation Rate</div>
              <div className="matrix-val-cell font-bold text-red text-right">+{statsB.overrunPct}% Overrun</div>
            </div>

            {/* Metric 5: Average Execution Progress */}
            <div className="matrix-data-row">
              <div className="matrix-val-cell font-bold">{statsA.avgProgress}% Executed</div>
              <div className="matrix-label-cell">Avg Physical Execution</div>
              <div className="matrix-val-cell font-bold text-right">{statsB.avgProgress}% Executed</div>
            </div>
          </div>

          {/* Sector / Ministry Leaderboard Grid */}
          <div className="dist-leaderboard-section">
            <h3 className="leaderboard-title">Top Portfolio {sec3Mode === 'ministry' ? 'Ministries' : 'Sectors'} Ranked by Risk Index</h3>
            <div className="leaderboard-grid">
              {leaderboardItems.map((item, idx) => (
                <div key={item.name} className="leaderboard-card">
                  <div className="lb-card-top">
                    <span className="lb-rank">#{idx + 1}</span>
                    <span className="lb-name">{item.name}</span>
                  </div>
                  <div className="lb-metrics-row">
                    <span className="lb-score-pill" style={{ backgroundColor: item.avgRisk >= 60 ? '#FEF2F2' : '#EFF6FF', color: item.avgRisk >= 60 ? '#DC2626' : '#2563EB' }}>
                      Risk Index: {item.avgRisk}/100
                    </span>
                    <span className="lb-count">{item.count} Assets</span>
                  </div>
                  <div className="lb-bar-track">
                    <div className="lb-bar-fill" style={{ width: `${item.avgRisk}%`, background: item.avgRisk >= 60 ? '#DC2626' : '#2563EB' }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};
