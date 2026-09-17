import React, { useState, useEffect } from 'react';
import {
  Folder,
  ShieldAlert,
  AlertTriangle,
  CheckCircle2,
  Layers,
  TrendingUp,
  MapPin,
  Sparkles,
  ArrowRight
} from 'lucide-react';
import './ProjectDistribution.css';
import { AnimatedCounter } from './AnimatedCounter';
import { api } from '../services/api';
import type { DistributionSummaryData } from '../services/api';
import { StatusIndicator } from './StatusIndicator';
import type { Project } from '../data/projectsData';
import { InfoButton } from './ExplainabilityInfo';

export const ProjectDistribution: React.FC = () => {
  const [data, setData] = useState<DistributionSummaryData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [projectsList, setProjectsList] = useState<Project[]>([]);

  useEffect(() => {
    import('../data/projectsData').then(mod => setProjectsList(mod.projectsData));
  }, []);

  // Derive dynamic portfolio and regional metrics
  const delayedCount = projectsList.filter(p => (p.scheduleStatus || '').toUpperCase().includes('DELAY') || (p.scheduleStatus || '').toUpperCase().includes('EXTEND') || (p.riskScore || 0) >= 70).length;
  const totalEscalationCr = projectsList.reduce((acc, p) => {
    const orig = parseFloat(p.costApproved.replace(/[^0-9.]/g, '')) || 0;
    const rev = parseFloat(p.costRevised.replace(/[^0-9.]/g, '')) || 0;
    return acc + Math.max(0, rev - orig);
  }, 0);
  const totalEscalationFormatted = totalEscalationCr >= 100000 
    ? `₹${(totalEscalationCr / 100000).toFixed(1)}L Cr` 
    : `₹${Math.round(totalEscalationCr).toLocaleString('en-IN')} Cr`;

  // Top Sector from data or projectsData
  const topSector = data && data.sectors && data.sectors.length > 0 ? data.sectors[0] : null;
  const topSectorName = topSector ? topSector.name : (projectsList[0]?.sector || 'Road Transport & Highways');
  const topSectorTotal = topSector ? topSector.total : projectsList.filter(p => p.sector === topSectorName).length;
  const topSectorHighPct = topSector ? topSector.highPct : 18.4;
  const topSectorAvgRisk = topSector ? topSector.avgRisk : 50;

  // Regional state breakdown
  const stateCounts: Record<string, { count: number; cost: number }> = {};
  for (const p of projectsList) {
    let st = p.location ? p.location.replace(/[\r\n]+/g, ' ').trim() : 'National';
    if (st.startsWith('Multi-States')) {
      const match = st.match(/\(([^,)]+)/);
      st = match ? match[1].trim() : 'Multi-State';
    } else {
      st = st.split(',')[0].trim();
    }
    if (!stateCounts[st]) stateCounts[st] = { count: 0, cost: 0 };
    stateCounts[st].count += 1;
    stateCounts[st].cost += parseFloat(p.costRevised.replace(/[^0-9.]/g, '')) || 0;
  }
  const sortedStates = Object.entries(stateCounts).sort((a, b) => b[1].count - a[1].count);
  const topStateName = sortedStates[0] ? sortedStates[0][0] : 'Western';
  const topStateCount = sortedStates[0] ? sortedStates[0][1].count : 298;
  const topStateCost = sortedStates[0] ? sortedStates[0][1].cost : 48600;
  const topStateCostFormatted = topStateCost >= 100000 
    ? `₹${(topStateCost / 100000).toFixed(1)}L Cr` 
    : `₹${Math.round(topStateCost).toLocaleString('en-IN')} Cr`;

  useEffect(() => {
    setLoading(true);
    api.getDistributionSummary()
      .then((res) => {
        if (res) {
          setData(res);
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  // Summary Metrics Data - mapped strictly from the existing API response
  const summaryCards = data
    ? [
        {
          id: 'total',
          title: 'Total Projects',
          value: data.total,
          badge: '100%',
          desc: 'Across all ministries & sectors',
          icon: <Folder size={18} className="stat-icon-blue" />,
          chipClass: 'chip-blue',
          accentColor: '#2563EB',
          progressWidth: '100%',
          progressClass: 'bar-blue',
          infoTitle: 'Total Monitored Projects',
          infoSummary: 'Total active central sector infrastructure projects currently monitored across all national ministries and departments.'
        },
        {
          id: 'high',
          title: 'High Priority',
          value: data.high,
          badge: data.highPct,
          desc: `${data.highPct} of total projects`,
          icon: <ShieldAlert size={18} className="stat-icon-red" />,
          chipClass: 'chip-red',
          accentColor: '#DC2626',
          progressWidth: data.highPct,
          progressClass: 'bar-red',
          infoTitle: 'High Priority Tier',
          infoSummary: 'Projects facing severe schedule delays (>6 months), heavy budget escalation, or critical risk indices (≥70).'
        },
        {
          id: 'medium',
          title: 'Medium Priority',
          value: data.medium,
          badge: data.mediumPct,
          desc: `${data.mediumPct} of total projects`,
          icon: <AlertTriangle size={18} className="stat-icon-amber" />,
          chipClass: 'chip-amber',
          accentColor: '#D97706',
          progressWidth: data.mediumPct,
          progressClass: 'bar-amber',
          infoTitle: 'Medium Priority Tier',
          infoSummary: 'Projects with moderate milestone slippages or emerging cost deviations requiring heightened departmental supervision.'
        },
        {
          id: 'low',
          title: 'Low Priority',
          value: data.low,
          badge: data.lowPct,
          desc: `${data.lowPct} of total projects`,
          icon: <CheckCircle2 size={18} className="stat-icon-green" />,
          chipClass: 'chip-green',
          accentColor: '#16A34A',
          progressWidth: data.lowPct,
          progressClass: 'bar-green',
          infoTitle: 'Low Priority Tier',
          infoSummary: 'Projects executing stably on schedule within sanctioned budgets with healthy milestone progress.'
        }
      ]
    : [];

  return (
    <div className="dist-page-layout animation-fade-in">
      {/* ── Page Header ── */}
      <div className="dist-page-header">
        <div className="dist-header-left">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <h1 className="dist-page-title">Project Distribution</h1>
            <InfoButton 
              title="Project Distribution Telemetry" 
              summary="Structural overview of all monitored central infrastructure assets, tracking sector concentration, risk tier distributions, and regional allocations."
              size="md"
            />
          </div>
          <p className="dist-page-subtitle">
            Sectoral composition, risk tier dispersion, and portfolio health across central infrastructure ministries.
          </p>
        </div>
        <div className="dist-header-right">
          <div className="dist-header-badge">
            <span className="dist-pulse-dot" />
            <span>Live Portfolio Telemetry</span>
          </div>
        </div>
      </div>

      {/* ── SECTION 1: Summary Peer Metric Cards (4-Column Responsive Grid) ── */}
      <section className="dist-section">
        <div className="dist-summary-grid">
          {loading ? (
            [1, 2, 3, 4].map((i) => (
              <div key={i} className="dist-stat-card dist-card-skeleton">
                <div className="skeleton-pulse" style={{ width: '40%', height: '14px', marginBottom: '14px', borderRadius: '4px' }} />
                <div className="skeleton-pulse" style={{ width: '65%', height: '36px', marginBottom: '10px', borderRadius: '8px' }} />
                <div className="skeleton-pulse" style={{ width: '85%', height: '12px', borderRadius: '4px' }} />
              </div>
            ))
          ) : (
            summaryCards.map((card) => (
              <div key={card.id} className={`dist-stat-card card-${card.id}`}>
                {/* Top Row: Title + Info + Icon Chip */}
                <div className="dist-stat-top">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span className="dist-stat-label">{card.title}</span>
                    <InfoButton title={card.infoTitle} summary={card.infoSummary} size="sm" />
                  </div>
                  <div className={`dist-stat-icon-chip ${card.chipClass}`}>
                    {card.icon}
                  </div>
                </div>

                {/* Middle: Large Numeric Value + Percentage Badge */}
                <div className="dist-stat-value-row">
                  <span className="dist-stat-number">
                    <AnimatedCounter value={card.value} />
                  </span>
                  <span className={`dist-stat-badge ${card.chipClass}`}>
                    {card.badge}
                  </span>
                </div>

                {/* Subtext description */}
                <div className="dist-stat-footer">
                  <span className="dist-stat-desc">{card.desc}</span>
                </div>

                {/* Inline mini progress bar representing portfolio proportion */}
                <div className="dist-stat-progress-track">
                  <div
                    className={`dist-stat-progress-fill ${card.progressClass}`}
                    style={{ width: card.progressWidth }}
                  />
                </div>
              </div>
            ))
          )}
        </div>
      </section>

      {/* ── SECTION 2: Sectoral Risk Breakdown (Hybrid Table with Segmented Mini Progress Bars) ── */}
      <section className="dist-section">
        <div className="dist-table-panel">
          {/* Panel Header & Legend */}
          <div className="dist-table-panel-header">
            <div className="dist-table-title-group">
              <div className="dist-panel-icon-wrap">
                <Layers size={18} color="#2563EB" />
              </div>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <h3 className="dist-panel-title">Sectoral Risk Breakdown</h3>
                  <InfoButton
                    title="Sectoral Risk Breakdown"
                    summary="Evaluates project volume, composite risk severity, and high/medium/low tier distribution for each infrastructure sector."
                    size="sm"
                  />
                </div>
                <p className="dist-panel-desc">
                  Proportional risk distribution and composite severity indices per national infrastructure sector
                </p>
              </div>
            </div>

            {/* Interactive Color Legend */}
            <div className="dist-table-legend">
              <span className="dist-legend-item">
                <StatusIndicator kind="high" label="HIGH RISK" />
              </span>
              <span className="dist-legend-item">
                <StatusIndicator kind="medium" label="MEDIUM RISK" />
              </span>
              <span className="dist-legend-item">
                <StatusIndicator kind="low" label="LOW RISK" />
              </span>
            </div>
          </div>

          {/* Table Container */}
          <div className="dist-table-scroll-container">
            <table className="dist-hybrid-table">
              <thead>
                <tr>
                  <th className="th-col-sector">SECTOR</th>
                  <th className="th-col-total">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <span>TOTAL ASSETS</span>
                      <InfoButton title="Total Sector Assets" summary="Total number of monitored infrastructure projects within this sector." size="sm" />
                    </div>
                  </th>
                  <th className="th-col-proportion">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <span>PROPORTIONAL DISTRIBUTION</span>
                      <InfoButton title="Risk Proportion" summary="Relative share of high risk (red), medium risk (amber), and low risk (green) projects in this sector." size="sm" />
                    </div>
                  </th>
                  <th className="th-col-metric">HIGH RISK</th>
                  <th className="th-col-metric">MEDIUM RISK</th>
                  <th className="th-col-metric">LOW RISK</th>
                  <th className="th-col-score">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', justifyContent: 'flex-end' }}>
                      <span>AVG RISK SCORE</span>
                      <InfoButton title="Average Risk Index" summary="Mean composite risk score (0 to 100) combining schedule delay, cost escalation, and milestone slippage." size="sm" />
                    </div>
                  </th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={7} className="dist-table-empty-cell">
                      Loading sector breakdown telemetry...
                    </td>
                  </tr>
                ) : !data || data.sectors.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="dist-table-empty-cell">
                      No sector data available from backend.
                    </td>
                  </tr>
                ) : (
                  data.sectors.map((row, idx) => (
                    <tr key={idx} className="dist-hybrid-row">
                      {/* Sector Name */}
                      <td className="td-col-sector">
                        <span className="sector-primary-name">{row.name}</span>
                      </td>

                      {/* Total Projects */}
                      <td className="td-col-total">
                        <span className="sector-total-badge">{row.total}</span>
                      </td>

                      {/* Composite Stacked Mini Progress Bar */}
                      <td className="td-col-proportion">
                        <div className="composite-bar-container">
                          <div
                            className="composite-bar-segment segment-high"
                            style={{ width: `${row.highPct}%` }}
                            title={`High: ${row.high} (${row.highPct}%)`}
                          ><span className="sr-only">HIGH RISK: {row.high} ({row.highPct}%)</span></div>
                          <div
                            className="composite-bar-segment segment-med"
                            style={{ width: `${row.mediumPct}%` }}
                            title={`Medium: ${row.medium} (${row.mediumPct}%)`}
                          ><span className="sr-only">MEDIUM RISK: {row.medium} ({row.mediumPct}%)</span></div>
                          <div
                            className="composite-bar-segment segment-low"
                            style={{ width: `${row.lowPct}%` }}
                            title={`Low: ${row.low} (${row.lowPct}%)`}
                          ><span className="sr-only">LOW RISK: {row.low} ({row.lowPct}%)</span></div>
                        </div>
                      </td>

                      {/* High Risk Count + Percent */}
                      <td className="td-col-metric">
                        <span className="risk-pill pill-high">
                          <StatusIndicator kind="high" label="HIGH RISK" />
                          <span className="risk-count">{row.high}</span>
                          <span className="risk-pct">({row.highPct}%)</span>
                        </span>
                      </td>

                      {/* Medium Risk Count + Percent */}
                      <td className="td-col-metric">
                        <span className="risk-pill pill-med">
                          <StatusIndicator kind="medium" label="MEDIUM RISK" />
                          <span className="risk-count">{row.medium}</span>
                          <span className="risk-pct">({row.mediumPct}%)</span>
                        </span>
                      </td>

                      {/* Low Risk Count + Percent */}
                      <td className="td-col-metric">
                        <span className="risk-pill pill-low">
                          <StatusIndicator kind="low" label="LOW RISK" />
                          <span className="risk-count">{row.low}</span>
                          <span className="risk-pct">({row.lowPct}%)</span>
                        </span>
                      </td>

                      {/* Avg Risk Index Score Badge */}
                      <td className="td-col-score">
                        <div
                          className={`score-badge ${
                            row.avgRisk >= 60
                              ? 'score-danger'
                              : row.avgRisk >= 48
                              ? 'score-warning'
                              : 'score-normal'
                          }`}
                        >
                          <span className="score-num">{row.avgRisk}</span>
                          <span className="score-max">/100</span>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* ── SECTION 3: Strategic Intelligence & Regional Focus (Bottom 4 Cards) ── */}
      <section className="dist-section">
        <div className="dist-section-header">
          <span className="dist-section-tag">STRATEGIC INTELLIGENCE</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <h2 className="dist-section-heading">Priority Interventions &amp; Regional Focus</h2>
            <InfoButton
              title="Strategic Intelligence Overview"
              summary="High-level operational takeaways pinpointing where urgent intervention, capital focus, and targeted policies yield the highest risk reduction."
              size="md"
            />
          </div>
        </div>

        <div className="dist-strategic-grid">
          {/* Card 1: Critical Action Required */}
          <div className="strategic-card card-critical-action">
            <div className="strategic-top-row">
              <span className="strategic-tag tag-red">CRITICAL ACTION REQUIRED</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <InfoButton title="Critical Interventions" summary="Total high-risk projects and aggregate cost escalation requiring immediate administrative escalation." size="sm" />
                <ShieldAlert size={18} color="#DC2626" />
              </div>
            </div>
            <h4 className="strategic-card-title text-red">High Priority Interventions</h4>
            <p className="strategic-card-desc">
              {data?.high || delayedCount} projects are flagged as critical or delayed requiring administrative escalation.
            </p>
            <div className="strategic-metrics-box">
              <div className="strategic-metric-item">
                <span className="strategic-num text-red">
                  <AnimatedCounter value={data?.high || delayedCount} />
                </span>
                <span className="strategic-lbl">High Risk Projects</span>
              </div>
              <div className="strategic-divider" />
              <div className="strategic-metric-item">
                <span className="strategic-num">{totalEscalationFormatted}</span>
                <span className="strategic-lbl">Escalation Cost</span>
              </div>
            </div>
            <button type="button" className="strategic-btn btn-action-red">
              <span>Fast Track Approvals</span>
              <ArrowRight size={14} />
            </button>
          </div>

          {/* Card 2: Prioritised Sector */}
          <div className="strategic-card card-priority-sector">
            <div className="strategic-top-row">
              <span className="strategic-tag tag-blue">TOP CAPITAL SECTOR</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <InfoButton title="Top Capital Sector" summary="Sector accounting for the highest volume of national infrastructure capital and its specific risk concentration." size="sm" />
                <TrendingUp size={18} color="#2563EB" />
              </div>
            </div>
            <h4 className="strategic-card-title">{topSectorName}</h4>
            <p className="strategic-card-desc">
              Accounts for {topSectorTotal} monitored national assets with {topSectorHighPct}% in elevated risk tier.
            </p>
            <div className="strategic-metrics-box">
              <div className="strategic-metric-item">
                <span className="strategic-num text-amber">{topSectorHighPct}%</span>
                <span className="strategic-lbl">High Risk Pct</span>
              </div>
              <div className="strategic-divider" />
              <div className="strategic-metric-item">
                <span className="strategic-num">{topSectorAvgRisk}/100</span>
                <span className="strategic-lbl">Avg Risk Index</span>
              </div>
            </div>
            <button type="button" className="strategic-btn btn-action-blue">
              <span>Review Tenders</span>
              <ArrowRight size={14} />
            </button>
          </div>

          {/* Card 3: Regional Distribution */}
          <div className="strategic-card card-region-focus">
            <div className="strategic-top-row">
              <span className="strategic-tag tag-neutral">REGIONAL CONCENTRATION</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <InfoButton title="Regional Allocation" summary="The geographic state or territory with the largest concentration of active monitored projects and sanctioned capital." size="sm" />
                <MapPin size={18} color="#059669" />
              </div>
            </div>
            <h4 className="strategic-card-title">{topStateName} Region</h4>
            <p className="strategic-card-desc">
              Concentration of {topStateCount} active central sector projects across primary corridor nodes.
            </p>
            <div className="strategic-metrics-box">
              <div className="strategic-metric-item">
                <span className="strategic-num">
                  <AnimatedCounter value={topStateCount} />
                </span>
                <span className="strategic-lbl">Active Projects</span>
              </div>
              <div className="strategic-divider" />
              <div className="strategic-metric-item">
                <span className="strategic-num">{topStateCostFormatted}</span>
                <span className="strategic-lbl">Total Sanctioned</span>
              </div>
            </div>
            <button type="button" className="strategic-btn btn-action-neutral">
              <span>Inspect Region</span>
              <ArrowRight size={14} />
            </button>
          </div>

          {/* Card 4: Strategic Policy Playbook */}
          <div className="strategic-card card-ai-policy">
            <div className="strategic-top-row">
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                <span className="strategic-tag tag-purple">STRATEGIC PLAYBOOK</span>
                <span style={{
                  fontSize: '9px',
                  fontWeight: 800,
                  padding: '2px 6px',
                  borderRadius: '4px',
                  backgroundColor: '#FEF3C7',
                  color: '#B45309',
                  border: '1px solid #FDE68A',
                  textTransform: 'uppercase',
                  letterSpacing: '0.4px',
                  whiteSpace: 'nowrap'
                }}>
                  Under Development • Illustration
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <InfoButton 
                  title="Portfolio Risk Playbook (Under Development)" 
                  summary="Future expansion: Automated policy recommendation and dispatch engine under active development for illustration of intervention levers." 
                  size="sm" 
                />
                <Sparkles size={18} color="#7C3AED" />
              </div>
            </div>
            <h4 className="strategic-card-title">Portfolio Risk Mitigation</h4>

            {/* Under Development Notice Banner */}
            <div style={{
              fontSize: '11px',
              color: '#6B21A8',
              backgroundColor: '#FAF5FF',
              border: '1px dashed #C084FC',
              borderRadius: '6px',
              padding: '6px 10px',
              marginBottom: '10px',
              lineHeight: 1.4
            }}>
              <strong>FUTURE EXPANSION:</strong> Policy dispatch automation is under active development for illustration.
            </div>

            <div className="strategic-checklist">
              <div className="checklist-item">
                <span className="checklist-dot">✓</span>
                <span>Priority milestone recovery mobilization</span>
              </div>
              <div className="checklist-item">
                <span className="checklist-dot">✓</span>
                <span>Financial outlay &amp; expenditure audit</span>
              </div>
              <div className="checklist-item">
                <span className="checklist-dot">✓</span>
                <span>Critical path schedule re-baselining</span>
              </div>
            </div>
            <button type="button" className="strategic-btn btn-action-purple">
              <span>View Strategic Playbook (Demo)</span>
              <ArrowRight size={14} />
            </button>
          </div>
        </div>
      </section>
    </div>
  );
};
