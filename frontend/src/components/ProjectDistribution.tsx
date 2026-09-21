import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  ShieldAlert,
  ArrowRight,
  ChevronDown,
  Building2,
  Activity,
  PieChart,
  BarChart3,
  Filter,
  TrendingUp,
  Clock,
  ExternalLink
} from 'lucide-react';
import './ProjectDistribution.css';
import { projectsData, type Project } from '../data/projectsData';
import { InfoButton } from './ExplainabilityInfo';

export interface ProjectDistributionProps {
  activeTab?: string;
  onSelectProject?: (projectId: string) => void;
  onNavigateTab?: (tab: string) => void;
  onFilterStatus?: (status: string) => void;
  onFilterRisk?: (risk: string) => void;
  targetMinistry?: string;
}

type SidebarSection = 'breakdown' | 'interventions' | 'comparison';

const SIDEBAR_SECTIONS = [
  {
    id: 'breakdown' as SidebarSection,
    icon: PieChart,
    label: 'Health & Risk Breakdown',
    desc: 'Interactive Donut analytics',
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
    label: 'Benchmark',
    desc: 'Head-to-head entity metrics',
    num: '03',
  },
];

export const ProjectDistribution: React.FC<ProjectDistributionProps> = ({
  onSelectProject,
  onNavigateTab,
  onFilterStatus,
  onFilterRisk
}) => {
  const [activeSection, setActiveSection] = useState<SidebarSection>('breakdown');

  // Datasets
  const [projects, setProjects] = useState<Project[]>([]);
  useEffect(() => {
    setProjects(projectsData);
  }, []);

  // Section 1 State: Breakdown Toggles & Selection
  const [sec1Mode, setSec1Mode] = useState<'ministry' | 'sector'>('ministry');
  const [sec1SelectedEntity, setSec1SelectedEntity] = useState<string>('All');
  const [hoveredHealthId, setHoveredHealthId] = useState<string | null>(null);
  const [hoveredRiskId, setHoveredRiskId] = useState<string | null>(null);

  // Section 2 State: Interventions Toggles & Selection
  const [sec2Mode, setSec2Mode] = useState<'ministry' | 'sector'>('sector');
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

      // Health Index tiers
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

  // Computed Interactive SVG Donut Segments with Trigonometric Pop-Out Vector Offsets
  const healthSegments = useMemo(() => {
    const list = [
      { id: 'healthy', name: 'On Track', label: 'ON TRACK', fullName: 'On Track (Score 75–100)', count: sec1Metrics.health.healthy, pct: sec1Metrics.healthPcts.healthy, color: '#22C55E', statusFilter: 'ON TRACK' },
      { id: 'moderate', name: 'Needs Attention', label: 'NEEDS ATTENTION', fullName: 'Needs Attention (Score 55–74)', count: sec1Metrics.health.moderate, pct: sec1Metrics.healthPcts.moderate, color: '#3B82F6', statusFilter: 'IN REVIEW' },
      { id: 'vulnerable', name: 'High Risk', label: 'HIGH RISK', fullName: 'High Risk (Score 35–54)', count: sec1Metrics.health.vulnerable, pct: sec1Metrics.healthPcts.vulnerable, color: '#EAB308', statusFilter: 'DELAYED' },
      { id: 'critical', name: 'Critical Delay', label: 'CRITICAL DELAY', fullName: 'Critical Delay (Score <35)', count: sec1Metrics.health.critical, pct: sec1Metrics.healthPcts.critical, color: '#EF4444', statusFilter: 'CRITICAL' }
    ];

    const totalCount = sec1Metrics.total;
    let acc = 0;
    const radius = 60;
    const circumference = 2 * Math.PI * radius;
    const popDistance = 4.5;

    return list.map(seg => {
      const startPercent = acc;
      const segPercent = totalCount > 0 ? (seg.count / totalCount) * 100 : seg.pct;
      const endPercent = startPercent + segPercent;
      const midPercent = (startPercent + endPercent) / 2;
      acc = endPercent;

      const startDeg = (startPercent / 100) * 360 - 90;
      const angleRad = (midPercent / 100) * 2 * Math.PI;
      const dx = Math.sin(angleRad) * popDistance;
      const dy = -Math.cos(angleRad) * popDistance;
      const strokeLength = (segPercent / 100) * circumference;

      return {
        ...seg,
        startDeg,
        dx,
        dy,
        strokeLength,
        circumference,
        segPercent
      };
    });
  }, [sec1Metrics]);

  const riskSegments = useMemo(() => {
    const list = [
      { id: 'low', name: 'Low Risk', label: 'LOW RISK', fullName: 'Low Risk (<40)', count: sec1Metrics.risk.low, pct: sec1Metrics.riskPcts.low, color: '#22C55E', riskFilter: 'Low' },
      { id: 'moderate', name: 'Medium Risk', label: 'MEDIUM RISK', fullName: 'Medium Risk (40–64)', count: sec1Metrics.risk.moderate, pct: sec1Metrics.riskPcts.moderate, color: '#EAB308', riskFilter: 'Medium' },
      { id: 'high', name: 'High Risk', label: 'HIGH RISK', fullName: 'High Risk (65–79)', count: sec1Metrics.risk.high, pct: sec1Metrics.riskPcts.high, color: '#EF4444', riskFilter: 'High' },
      { id: 'critical', name: 'Critical Risk', label: 'CRITICAL RISK', fullName: 'Critical Risk (≥80)', count: sec1Metrics.risk.critical, pct: sec1Metrics.riskPcts.critical, color: '#991B1B', riskFilter: 'Critical' }
    ];

    const totalCount = sec1Metrics.total;
    let acc = 0;
    const radius = 60;
    const circumference = 2 * Math.PI * radius;
    const popDistance = 4.5;

    return list.map(seg => {
      const startPercent = acc;
      const segPercent = totalCount > 0 ? (seg.count / totalCount) * 100 : seg.pct;
      const endPercent = startPercent + segPercent;
      const midPercent = (startPercent + endPercent) / 2;
      acc = endPercent;

      const startDeg = (startPercent / 100) * 360 - 90;
      const angleRad = (midPercent / 100) * 2 * Math.PI;
      const dx = Math.sin(angleRad) * popDistance;
      const dy = -Math.cos(angleRad) * popDistance;
      const strokeLength = (segPercent / 100) * circumference;

      return {
        ...seg,
        startDeg,
        dx,
        dy,
        strokeLength,
        circumference,
        segPercent
      };
    });
  }, [sec1Metrics]);

  const activeHealthSeg = useMemo(() => healthSegments.find(s => s.id === hoveredHealthId) || null, [healthSegments, hoveredHealthId]);
  const activeRiskSeg = useMemo(() => riskSegments.find(s => s.id === hoveredRiskId) || null, [riskSegments, hoveredRiskId]);

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
            <span>1,981 Active Assets Synchronized</span>
          </div>
        </div>
      </div>

      {/* ── Horizontal Navigation Bar ── */}
      <div className="dist-horizontal-nav" style={{ display: 'flex', gap: '8px', background: 'linear-gradient(90deg, #0f172a 0%, #1e3a8a 100%)', padding: '12px 24px', borderBottom: '1px solid #1e293b', position: 'sticky', top: 0, zIndex: 50, alignItems: 'center', marginBottom: '24px' }}>
        {SIDEBAR_SECTIONS.map((sec) => {
          const isActive = activeSection === sec.id;
          const Icon = sec.icon;
          return (
            <button 
              key={sec.id}
              className={`dist-nav-tab ${isActive ? 'active' : ''}`}
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
         SECTION 1: HEALTH & RISK BREAKDOWN (INTERACTIVE DONUTS + PROGRESS BARS)
         ════════════════════════════════════════════════════════════════ */}
      <section id="dist-section-breakdown" className="dist-section">
        <div className="dist-panel-card">
          {/* Header Controls */}
          <div className="dist-panel-head">
            <div className="dist-panel-title-group">
              <span className="dist-section-badge">01</span>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <h2 className="dist-section-title">Health &amp; Risk Breakdown</h2>
                  <InfoButton title="Health & Risk Breakdown" summary="Analyzes distribution of health profiles across different sectors and ministries." size="sm" />
                </div>
                <p className="dist-section-sub">
                  Interactive Donut analytics. Click any donut segment or bar row to open filtered projects list!
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
                  <option value="All">All {sec1Mode === 'ministry' ? 'Ministries' : 'Sectors'} ({projects.length > 5000 ? '6,568' : projects.length} Assets)</option>
                  {(sec1Mode === 'ministry' ? allMinistries : allSectors).map(item => (
                    <option key={item} value={item}>{item}</option>
                  ))}
                </select>
                <ChevronDown size={14} className="dist-dropdown-arrow" />
              </div>
            </div>
          </div>

          {/* Mode Context Insight Banner — felt difference when toggled */}
          <div key={sec1Mode} className="dist-mode-context-banner dist-mode-fade-in">
            <div className="context-banner-left">
              <span className="context-banner-tag">{sec1Mode === 'ministry' ? 'DEPARTMENTAL PERSPECTIVE' : 'SECTORAL INFRASTRUCTURE PERSPECTIVE'}</span>
              <span className="context-banner-text">
                {sec1Mode === 'ministry'
                  ? `Monitored across ${allMinistries.length} Central Ministries & Executive Departments.`
                  : `Categorized into ${allSectors.length} Key Infrastructure Sectors (Railways, Roads, Power, Coal, etc.).`}
              </span>
            </div>
            <div className="context-banner-right">
              <span className="context-hint">💡 Click any segment below to view filtered assets</span>
            </div>
          </div>

          {/* Donut Charts & Progress Bars Grid */}
          <div key={`${sec1Mode}-${sec1SelectedEntity}`} className="dist-donuts-grid dist-mode-fade-in">
            {/* ── Donut 1: Health Index Breakdown ── */}
            <div className="dist-donut-card">
              <div className="dist-card-header-row">
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Activity size={18} color="#2563EB" />
                  <h3 className="dist-card-heading">Portfolio Health Index Breakdown</h3>
                </div>
                <span className="dist-count-chip">{sec1Metrics.total > 5000 ? '6,568' : sec1Metrics.total.toLocaleString()} Projects</span>
              </div>

              <div className="donut-visualization-block">
                {/* SVG Donut Chart with Dynamic Trigonometric Segment Pop-out & Glow */}
                <div className="svg-donut-wrapper">
                  <svg className="svg-donut" viewBox="0 0 160 160">
                    <circle cx="80" cy="80" r="60" fill="none" stroke="#F1F5F9" strokeWidth="16" />
                    {healthSegments.map((seg) => {
                      const isHovered = hoveredHealthId === seg.id;
                      const isAnyHovered = hoveredHealthId !== null;
                      return (
                        <g
                          key={seg.id}
                          style={{
                            transform: isHovered ? `translate(${seg.dx.toFixed(2)}px, ${seg.dy.toFixed(2)}px)` : 'translate(0px, 0px)',
                            transition: 'transform 0.28s cubic-bezier(0.16, 1, 0.3, 1)'
                          }}
                        >
                          <circle
                            cx="80"
                            cy="80"
                            r="60"
                            fill="none"
                            stroke={seg.color}
                            strokeWidth={isHovered ? 20 : 16}
                            strokeDasharray={`${seg.strokeLength.toFixed(1)} ${seg.circumference}`}
                            strokeDashoffset={0}
                            style={{
                              transformOrigin: '80px 80px',
                              transform: `rotate(${seg.startDeg}deg)`,
                              transition: 'stroke-width 0.25s ease, filter 0.25s ease, opacity 0.25s ease',
                              cursor: 'pointer',
                              filter: isHovered ? `drop-shadow(0 0 12px ${seg.color})` : 'none',
                              opacity: isAnyHovered && !isHovered ? 0.45 : 1
                            }}
                            onMouseEnter={() => setHoveredHealthId(seg.id)}
                            onMouseLeave={() => setHoveredHealthId(null)}
                            onClick={() => onFilterStatus?.(seg.statusFilter)}
                          >
                            <title>{`${seg.fullName}: Click to view ${seg.count} projects`}</title>
                          </circle>
                        </g>
                      );
                    })}
                  </svg>
                  <div className="svg-donut-center">
                    <span
                      className="donut-center-num"
                      style={{ color: activeHealthSeg ? activeHealthSeg.color : '#0F172A' }}
                    >
                      {activeHealthSeg ? activeHealthSeg.count.toLocaleString() : (sec1Metrics.total > 5000 ? '6,568' : sec1Metrics.total.toLocaleString())}
                    </span>
                    <span
                      className="donut-center-label"
                      style={{
                        color: activeHealthSeg ? activeHealthSeg.color : '#64748B',
                        fontWeight: activeHealthSeg ? 850 : 700
                      }}
                    >
                      {activeHealthSeg ? activeHealthSeg.label : 'TOTAL PROJECTS'}
                    </span>
                  </div>
                </div>

                {/* Horizontal Breakdown Bars Below Donut 1 — Synced Clickable Rows */}
                <div className="donut-bars-list">
                  {healthSegments.map((seg) => {
                    const isHovered = hoveredHealthId === seg.id;
                    return (
                      <div
                        key={seg.id}
                        className={`bar-breakdown-row clickable-row${isHovered ? ' active-breakdown-row' : ''}`}
                        onMouseEnter={() => setHoveredHealthId(seg.id)}
                        onMouseLeave={() => setHoveredHealthId(null)}
                        onClick={() => onFilterStatus?.(seg.statusFilter)}
                        title={`Click to view ${seg.name} projects in Portfolio`}
                        style={isHovered ? { backgroundColor: `${seg.color}15`, borderRadius: '8px' } : undefined}
                      >
                        <div className="bar-info-row">
                          <span
                            className="bar-label-dot"
                            style={{
                              backgroundColor: seg.color,
                              boxShadow: isHovered ? `0 0 8px ${seg.color}` : 'none',
                              transform: isHovered ? 'scale(1.25)' : 'scale(1)',
                              transition: 'transform 0.18s ease, box-shadow 0.18s ease'
                            }}
                          />
                          <span
                            className="bar-name"
                            style={{
                              fontWeight: isHovered ? 800 : 600,
                              color: isHovered ? seg.color : '#334155'
                            }}
                          >
                            {seg.fullName}
                          </span>
                          <span className="bar-value" style={{ fontWeight: isHovered ? 900 : 750 }}>
                            {seg.count.toLocaleString()} ({seg.pct}%)
                          </span>
                        </div>
                        <div className="bar-track">
                          <div
                            className="bar-fill"
                            style={{
                              width: `${seg.pct}%`,
                              background: seg.color,
                              boxShadow: isHovered ? `0 0 6px ${seg.color}` : 'none'
                            }}
                          />
                        </div>
                      </div>
                    );
                  })}
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
                {/* SVG Donut Chart with Dynamic Trigonometric Segment Pop-out & Glow */}
                <div className="svg-donut-wrapper">
                  <svg className="svg-donut" viewBox="0 0 160 160">
                    <circle cx="80" cy="80" r="60" fill="none" stroke="#F1F5F9" strokeWidth="16" />
                    {riskSegments.map((seg) => {
                      const isHovered = hoveredRiskId === seg.id;
                      const isAnyHovered = hoveredRiskId !== null;
                      return (
                        <g
                          key={seg.id}
                          style={{
                            transform: isHovered ? `translate(${seg.dx.toFixed(2)}px, ${seg.dy.toFixed(2)}px)` : 'translate(0px, 0px)',
                            transition: 'transform 0.28s cubic-bezier(0.16, 1, 0.3, 1)'
                          }}
                        >
                          <circle
                            cx="80"
                            cy="80"
                            r="60"
                            fill="none"
                            stroke={seg.color}
                            strokeWidth={isHovered ? 20 : 16}
                            strokeDasharray={`${seg.strokeLength.toFixed(1)} ${seg.circumference}`}
                            strokeDashoffset={0}
                            style={{
                              transformOrigin: '80px 80px',
                              transform: `rotate(${seg.startDeg}deg)`,
                              transition: 'stroke-width 0.25s ease, filter 0.25s ease, opacity 0.25s ease',
                              cursor: 'pointer',
                              filter: isHovered ? `drop-shadow(0 0 12px ${seg.color})` : 'none',
                              opacity: isAnyHovered && !isHovered ? 0.45 : 1
                            }}
                            onMouseEnter={() => setHoveredRiskId(seg.id)}
                            onMouseLeave={() => setHoveredRiskId(null)}
                            onClick={() => onFilterRisk?.(seg.riskFilter)}
                          >
                            <title>{`${seg.fullName}: Click to view ${seg.count} projects`}</title>
                          </circle>
                        </g>
                      );
                    })}
                  </svg>
                  <div className="svg-donut-center">
                    <span
                      className="donut-center-num"
                      style={{ color: activeRiskSeg ? activeRiskSeg.color : '#DC2626' }}
                    >
                      {activeRiskSeg ? activeRiskSeg.count.toLocaleString() : (sec1Metrics.total > 5000 ? '6,568' : sec1Metrics.total.toLocaleString())}
                    </span>
                    <span
                      className="donut-center-label"
                      style={{
                        color: activeRiskSeg ? activeRiskSeg.color : '#64748B',
                        fontWeight: activeRiskSeg ? 850 : 700
                      }}
                    >
                      {activeRiskSeg ? activeRiskSeg.label : 'TOTAL PROJECTS'}
                    </span>
                  </div>
                </div>

                {/* Horizontal Breakdown Bars Below Donut 2 — Synced Clickable Rows */}
                <div className="donut-bars-list">
                  {riskSegments.map((seg) => {
                    const isHovered = hoveredRiskId === seg.id;
                    return (
                      <div
                        key={seg.id}
                        className={`bar-breakdown-row clickable-row${isHovered ? ' active-breakdown-row' : ''}`}
                        onMouseEnter={() => setHoveredRiskId(seg.id)}
                        onMouseLeave={() => setHoveredRiskId(null)}
                        onClick={() => onFilterRisk?.(seg.riskFilter)}
                        title={`Click to view ${seg.name} projects in Portfolio`}
                        style={isHovered ? { backgroundColor: `${seg.color}15`, borderRadius: '8px' } : undefined}
                      >
                        <div className="bar-info-row">
                          <span
                            className="bar-label-dot"
                            style={{
                              backgroundColor: seg.color,
                              boxShadow: isHovered ? `0 0 8px ${seg.color}` : 'none',
                              transform: isHovered ? 'scale(1.25)' : 'scale(1)',
                              transition: 'transform 0.18s ease, box-shadow 0.18s ease'
                            }}
                          />
                          <span
                            className="bar-name"
                            style={{
                              fontWeight: isHovered ? 800 : 600,
                              color: isHovered ? seg.color : '#334155'
                            }}
                          >
                            {seg.fullName}
                          </span>
                          <span className="bar-value" style={{ fontWeight: isHovered ? 900 : 750 }}>
                            {seg.count.toLocaleString()} ({seg.pct}%)
                          </span>
                        </div>
                        <div className="bar-track">
                          <div
                            className="bar-fill"
                            style={{
                              width: `${seg.pct}%`,
                              background: seg.color,
                              boxShadow: isHovered ? `0 0 6px ${seg.color}` : 'none'
                            }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ════════════════════════════════════════════════════════════════
         SECTION 2: PRIORITY INTERVENTIONS (STACKED 1-COLUMN DASHBOARD LIST)
         ════════════════════════════════════════════════════════════════ */}
      <section id="dist-section-interventions" className="dist-section">
        <div className="dist-panel-card">
          {/* Header Controls */}
          <div className="dist-panel-head">
            <div className="dist-panel-title-group">
              <span className="dist-section-badge badge-red">02</span>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <h2 className="dist-section-title">Priority Interventions</h2>
                  <InfoButton title="Priority Interventions" summary="Identifies assets requiring immediate oversight due to compounded risks and delays." size="sm" />
                </div>
                <p className="dist-section-sub">
                  Stacked high-priority assets requiring urgent departmental intervention and executive oversight.
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

          {/* Stacked 1-Column Projects List (Image 3 Executive Horizontal Row Layout) */}
          <div className="interventions-stacked-list">
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
                        onClick={() => onSelectProject?.(proj.id)}
                      >
                        <span>Inspect</span>
                        <ExternalLink size={13} />
                      </button>

                      <button
                        type="button"
                        className="img3-action-btn"
                        onClick={() => onNavigateTab?.('action-centre')}
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
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <h2 className="dist-section-title">Benchmark Analytics</h2>
                  <InfoButton title="Benchmark Analytics" summary="Compares organizational performance and risk clustering between different entities." size="sm" />
                </div>
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
