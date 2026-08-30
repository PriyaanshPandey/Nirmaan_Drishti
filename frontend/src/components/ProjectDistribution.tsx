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
            Loading distribution data from backend...
          </div>
        ) : metrics.map((m) => (
          <div key={m.id} className={`dist-metric-box ${m.themeClass}`}>
            <div className="dist-metric-head">
              <span className="dist-metric-title">{m.title}</span>
              <div className="dist-metric-icon">{m.icon}</div>
            </div>
            <div className="dist-metric-val">
              <AnimatedCounter value={m.value} formatter={m.formatter} />
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
    </div>
  );
};
