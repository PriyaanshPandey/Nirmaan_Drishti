import React, { useState, useEffect } from 'react';
import { Folder, AlertTriangle, ShieldAlert, CheckCircle2 } from 'lucide-react';
import './ProjectDistribution.css';
import { AnimatedCounter } from './AnimatedCounter';
import { api } from '../services/api';
import type { DistributionSummaryData } from '../services/api';

export const ProjectDistribution: React.FC = () => {
  const [data, setData] = useState<DistributionSummaryData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api.getDistributionSummary().then((res) => {
      if (res) {
        setData(res);
      }
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  // Metrics Data - driven entirely from backend response
  const metrics = data ? [
    {
      id: 'total',
      title: 'Total Projects',
      value: data.total,
      formatter: (val: number) => val.toLocaleString(),
      desc: 'Across all ministries & Sectors',
      icon: <Folder size={15} color="var(--color-on-track)" />,
      themeClass: 'light-theme'
    },
    {
      id: 'high',
      title: 'High Priority',
      value: data.high,
      formatter: (val: number) => val.toString(),
      desc: `${data.highPct} of total projects`,
      icon: <ShieldAlert size={15} color="var(--color-accent-red)" />,
      themeClass: 'light-theme'
    },
    {
      id: 'medium',
      title: 'Medium Priority',
      value: data.medium,
      formatter: (val: number) => val.toString(),
      desc: `${data.mediumPct} of total projects`,
      icon: <AlertTriangle size={15} color="#F59E0B" />,
      themeClass: 'dark-theme'
    },
    {
      id: 'low',
      title: 'Low Priority',
      value: data.low,
      formatter: (val: number) => val.toString(),
      desc: `${data.lowPct} of total projects`,
      icon: <CheckCircle2 size={15} color="#22C55E" />,
      themeClass: 'light-theme'
    }
  ] : [];

  return (
    <div className="distribution-container animation-fade-in">
      {/* Top Section Header */}
      <div className="distribution-header">
        <div>
          <h1 className="dist-page-title">Project Distribution</h1>
          <p className="dist-page-subtitle">Sectoral and geographical distribution of infrastructure projects.</p>
        </div>
      </div>

      {/* Row 1: 4 Metric Cards */}
      <div className="dist-metrics-row-4">
        {loading ? (
          <div style={{ gridColumn: '1/-1', padding: '30px', textAlign: 'center', color: '#94A3B8', fontSize: '14px' }}>
            <div style={{ display: 'flex', gap: '16px' }}>
              {[1,2,3,4].map(i => (
                <div key={i} style={{ flex: 1, padding: '20px', borderRadius: '16px', border: '1px solid #E2E8F0' }}>
                  <div className="skeleton-pulse skeleton-line" style={{ width: '50%', marginBottom: '16px' }} />
                  <div className="skeleton-pulse" style={{ height: '32px', borderRadius: '6px', width: '70%', marginBottom: '10px' }} />
                  <div className="skeleton-pulse skeleton-line" style={{ width: '80%' }} />
                </div>
              ))}
            </div>
          </div>
        ) : metrics.map((m, idx) => (
          <div key={m.id} className={`dist-metric-box ${m.themeClass} card-stagger-${idx + 1}`}>
            <div className="dist-metric-head">
              <span className="dist-metric-title">{m.title}</span>
              <div className="dist-metric-icon">{m.icon}</div>
            </div>
            <div className="dist-metric-val">
              <AnimatedCounter value={m.value} formatter={m.formatter} triggerKey={m.value} />
            </div>
            <div className="dist-metric-desc">{m.desc}</div>
          </div>
        ))}
      </div>

      {/* Row 2: Distribution Table */}
      <div className="dist-table-card card">
        <div className="dist-table-head-row">
          <div>
            <h2 className="card-title">Sectoral Risk Breakdown</h2>
            <p className="card-subtitle">Risk classification across national infrastructure sectors</p>
          </div>
        </div>

        <div className="dist-table-responsive">
          <table className="dist-data-table">
            <thead>
              <tr>
                <th className="th-name">SECTOR</th>
                <th className="th-tot">TOTAL</th>
                <th className="th-high">HIGH RISK</th>
                <th className="th-med">MEDIUM RISK</th>
                <th className="th-low">LOW RISK</th>
                <th className="th-avg">AVG RISK</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', padding: '30px', color: '#94A3B8', fontSize: '13px' }}>
                    Loading sector breakdown from backend...
                  </td>
                </tr>
              ) : !data || data.sectors.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', padding: '30px', color: '#94A3B8', fontSize: '13px' }}>
                    No sector data available from backend.
                  </td>
                </tr>
              ) : data.sectors.map((row, idx) => (
                <tr key={idx} className="dist-table-row">
                  <td className="td-name font-semibold">{row.name}</td>
                  <td className="td-tot font-bold">{row.total}</td>
                  <td className="td-high">
                    <span className="dist-badge badge-high">{row.high} ({row.highPct}%)</span>
                  </td>
                  <td className="td-med">
                    <span className="dist-badge badge-med">{row.medium} ({row.mediumPct}%)</span>
                  </td>
                  <td className="td-low">
                    <span className="dist-badge badge-low">{row.low} ({row.lowPct}%)</span>
                  </td>
                  <td className="td-avg">
                    <span className={`avg-score ${row.avgRisk > 60 ? 'score-high' : 'score-low'}`}>{row.avgRisk}/100</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Row 3: Bottom Recommendation Cards */}
      <div className="dist-bottom-grid-4" style={{ marginTop: '4px' }}>
        {/* Card 1: Critical Actions */}
        <div className="dist-recommend-card red-outline-card">
          <div className="recommend-title-top font-red">CRITICAL ACTION REQUIRED</div>
          <div className="recommend-title font-red">
            <span>Land Clearance Backlog</span>
          </div>
          <p className="recommend-desc">
            78 projects across railways and highways are delayed due to ROW clearance issues.
          </p>
          <div className="recommend-stats-row">
            <div className="recommend-stat-col">
              <span className="stat-num font-red"><AnimatedCounter value={78} triggerKey="land-78" /></span>
              <span className="stat-lbl">Projects Delayed</span>
            </div>
            <div className="recommend-stat-col">
              <span className="stat-num">₹14.2K Cr</span>
              <span className="stat-lbl">Escalation Cost</span>
            </div>
          </div>
          <button className="recommend-cta-btn btn-red-outline">Fast Track Approvals</button>
        </div>

        {/* Card 2: Prioritised Sector */}
        <div className="dist-recommend-card prioritised-sector-card">
          <div className="recommend-title-top text-light-blue">MOST CRITICAL SECTOR</div>
          <div className="recommend-focus-name text-white">Railways Core</div>
          <p className="recommend-desc text-light-blue" style={{ fontSize: '11.5px', marginTop: '4px' }}>
            High severity contractor defaults and equipment shortage during freezing weather windows.
          </p>
          <div className="recommend-stats-row">
            <div className="recommend-stat-col">
              <span className="stat-num text-orange-yellow">22.9%</span>
              <span className="stat-lbl">High Risk Pct</span>
            </div>
            <div className="recommend-stat-col">
              <span className="stat-num text-white">65/100</span>
              <span className="stat-lbl">Avg Risk Index</span>
            </div>
          </div>
          <button className="recommend-cta-btn btn-white-outline">Review Tenders</button>
        </div>

        {/* Card 3: Regional Distribution */}
        <div className="dist-recommend-card">
          <div className="recommend-title-top text-muted">REGIONAL CONCENTRATION</div>
          <div className="recommend-title">
            <span>Western Corridor</span>
          </div>
          <p className="recommend-desc">
            Maharashtra and Gujarat hold 34% of active projects under monitoring phase.
          </p>
          <div className="recommend-stats-row">
            <div className="recommend-stat-col">
              <span className="stat-num"><AnimatedCounter value={298} triggerKey="region-298" /></span>
              <span className="stat-lbl">Active Projects</span>
            </div>
            <div className="recommend-stat-col">
              <span className="stat-num">₹48.6K Cr</span>
              <span className="stat-lbl">Total Funding</span>
            </div>
          </div>
          <button className="recommend-cta-btn btn-green-outline" style={{ border: '1px solid rgba(47, 107, 244, 0.4)', color: 'var(--color-on-track)', backgroundColor: '#EFF6FF' }}>Inspect Region</button>
        </div>

        {/* Card 4: AI Recommendations */}
        <div className="dist-recommend-card">
          <div className="recommend-title-top text-muted">AI POLICY STRATEGY</div>
          <div className="recommend-title">
            <span>NOC Optimization</span>
          </div>
          <div className="actions-bullet-list" style={{ marginTop: '8px' }}>
            <div className="action-bullet-item">
              <span className="bullet-check-icon">✓</span>
              <span>Automate environment permissions NOC</span>
            </div>
            <div className="action-bullet-item">
              <span className="bullet-check-icon">✓</span>
              <span>Trigger PMG fast-track path review</span>
            </div>
            <div className="action-bullet-item">
              <span className="bullet-check-icon">✓</span>
              <span>Re-allocate contractor work shares</span>
            </div>
          </div>
          <button className="recommend-cta-btn btn-green-outline">Apply Policy NOC</button>
        </div>
      </div>
    </div>
  );
};
