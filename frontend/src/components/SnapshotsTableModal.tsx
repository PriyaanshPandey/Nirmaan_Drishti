import React, { useState, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  Download,
  Search,
  ArrowUpDown,
  Database,
  Calendar,
  CheckCircle2,
  Clock,
  Sparkles,
  Table as TableIcon
} from 'lucide-react';
import type { Project } from '../data/projectsData';
import type { ProjectTimelinePoint } from '../services/api';
import './SnapshotsTableModal.css';

interface SnapshotsTableModalProps {
  isOpen: boolean;
  onClose: () => void;
  project: Project;
  timelineData: ProjectTimelinePoint[];
  totalSnapshots: number;
}

type FilterType = 'all' | 'historical' | 'forecast';
type SortOrder = 'desc' | 'asc';

export const SnapshotsTableModal: React.FC<SnapshotsTableModalProps> = ({
  isOpen,
  onClose,
  project,
  timelineData,
  totalSnapshots
}) => {
  const [filterType, setFilterType] = useState<FilterType>('all');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');

  // Handle ESC key to close modal
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Lock body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  const historicalCount = useMemo(
    () => timelineData.filter((d) => d.is_historical !== false).length,
    [timelineData]
  );
  const forecastCount = useMemo(
    () => timelineData.filter((d) => d.is_historical === false).length,
    [timelineData]
  );

  // Latest historical record
  const latestHistorical = useMemo(() => {
    for (let i = timelineData.length - 1; i >= 0; i--) {
      if (timelineData[i].is_historical !== false && timelineData[i].physical !== null) {
        return timelineData[i];
      }
    }
    return null;
  }, [timelineData]);

  // Initial historical record
  const initialHistorical = useMemo(() => {
    for (let i = 0; i < timelineData.length; i++) {
      if (timelineData[i].is_historical !== false && timelineData[i].physical !== null) {
        return timelineData[i];
      }
    }
    return null;
  }, [timelineData]);

  // Filter and sort the snapshot rows
  const filteredRows = useMemo(() => {
    let result = timelineData.map((pt, originalIndex) => ({
      ...pt,
      originalIndex: originalIndex + 1
    }));

    // Filter by type
    if (filterType === 'historical') {
      result = result.filter((d) => d.is_historical !== false);
    } else if (filterType === 'forecast') {
      result = result.filter((d) => d.is_historical === false);
    }

    // Filter by search query
    if (searchTerm.trim()) {
      const q = searchTerm.trim().toLowerCase();
      result = result.filter((d) => {
        const periodMatch = d.period?.toLowerCase().includes(q);
        const monthMatch = d.report_month?.toLowerCase().includes(q);
        const dateMatch = d.reporting_date?.toLowerCase().includes(q);
        return periodMatch || monthMatch || dateMatch;
      });
    }

    // Sort order
    if (sortOrder === 'desc') {
      result.reverse();
    }

    return result;
  }, [timelineData, filterType, searchTerm, sortOrder]);

  const handleExportCSV = () => {
    const headers = [
      'Snapshot Index',
      'Period',
      'Report Month',
      'Reporting Date',
      'Record Type',
      'Physical Progress (%)',
      'Cumulative Expenditure (₹ Crore)',
      'Cumulative Expenditure (%)',
      'Total Revised Cost (₹ Crore)',
      'Total Revised Cost (%)',
      'Data Status'
    ];

    const rows = filteredRows.map((pt) => [
      pt.originalIndex,
      `"${pt.period}"`,
      `"${pt.report_month || ''}"`,
      `"${pt.reporting_date || ''}"`,
      pt.is_historical === false ? 'ML Model Prediction' : 'PAIMANA Official Snapshot',
      pt.physical != null ? pt.physical : '',
      pt.expenditure_cr != null ? pt.expenditure_cr : '',
      pt.expenditure != null ? pt.expenditure : '',
      pt.revised_cost_cr != null ? pt.revised_cost_cr : '',
      pt.revised_cost != null ? pt.revised_cost : '',
      pt.is_historical === false
        ? 'Forecast Horizon'
        : pt.physical != null
        ? 'Verified Snapshot'
        : 'Missing / Not Reported'
    ]);

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const dateStr = new Date().toISOString().slice(0, 10);
    link.setAttribute('href', url);
    link.setAttribute('download', `Project_${project.id}_Snapshots_${dateStr}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  if (!isOpen) return null;

  return createPortal(
    <div className="snapshots-modal-overlay" onClick={onClose}>
      <div
        className="snapshots-modal-dialog"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="snapshots-modal-title"
      >
        {/* Modal Header */}
        <div className="snapshots-modal-header">
          <div className="snapshots-header-left">
            <div className="snapshots-header-icon">
              <TableIcon size={20} color="#0284C7" />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <h2 id="snapshots-modal-title" className="snapshots-header-title">
                  All Monthly Snapshots & Model Timeline
                </h2>
                <span className="snapshots-count-pill">
                  <Database size={11} /> {timelineData.length} Data Points
                </span>
              </div>
              <p className="snapshots-header-subtitle">
                {project.name} &bull; Project ID: <strong>{project.id}</strong>
                {(project as any).legacyOcmsCode && (
                  <span> &bull; OCMS Code: <strong>{(project as any).legacyOcmsCode}</strong></span>
                )}
              </p>
            </div>
          </div>

          <div className="snapshots-header-actions">
            <button
              type="button"
              className="snapshots-export-btn"
              onClick={handleExportCSV}
              title="Export all visible snapshots to CSV"
            >
              <Download size={14} /> Export CSV
            </button>
            <button
              type="button"
              className="snapshots-close-btn"
              onClick={onClose}
              title="Close dialog (Esc)"
              aria-label="Close dialog"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Telemetry KPI Strip */}
        <div className="snapshots-kpi-grid">
          <div className="snapshots-kpi-card">
            <div className="kpi-card-label">Total Recorded Snapshots</div>
            <div className="kpi-card-value">{totalSnapshots}</div>
            <div className="kpi-card-sub">
              {historicalCount} PAIMANA + {forecastCount} ML Future Horizon
            </div>
          </div>

          <div className="snapshots-kpi-card">
            <div className="kpi-card-label">Timeline Range</div>
            <div className="kpi-card-value" style={{ fontSize: '1.05rem' }}>
              {timelineData[0]?.period || '—'} &rarr; {timelineData[timelineData.length - 1]?.period || '—'}
            </div>
            <div className="kpi-card-sub">
              Baseline inception to target completion
            </div>
          </div>

          <div className="snapshots-kpi-card">
            <div className="kpi-card-label">Physical Progress Trajectory</div>
            <div className="kpi-card-value" style={{ color: '#0284C7' }}>
              {latestHistorical?.physical != null ? `${latestHistorical.physical}%` : `${project.physical_progress || 0}%`}
            </div>
            <div className="kpi-card-sub">
              Initial: {initialHistorical?.physical != null ? `${initialHistorical.physical}%` : '0%'}
            </div>
          </div>

          <div className="snapshots-kpi-card">
            <div className="kpi-card-label">Cumulative Expenditure</div>
            <div className="kpi-card-value" style={{ color: '#D97706' }}>
              {latestHistorical?.expenditure_cr != null
                ? `₹${Number(latestHistorical.expenditure_cr).toLocaleString()} Cr`
                : (project as any).costExpenditure || '—'}
            </div>
            <div className="kpi-card-sub">
              {latestHistorical?.expenditure != null ? `${latestHistorical.expenditure}% of original budget` : 'Reported'}
            </div>
          </div>
        </div>

        {/* Filter and Search Bar */}
        <div className="snapshots-toolbar">
          <div className="snapshots-filter-tabs">
            <button
              type="button"
              className={`filter-tab ${filterType === 'all' ? 'active' : ''}`}
              onClick={() => setFilterType('all')}
            >
              All Records ({timelineData.length})
            </button>
            <button
              type="button"
              className={`filter-tab ${filterType === 'historical' ? 'active' : ''}`}
              onClick={() => setFilterType('historical')}
            >
              PAIMANA Snapshots ({historicalCount})
            </button>
            <button
              type="button"
              className={`filter-tab ${filterType === 'forecast' ? 'active' : ''}`}
              onClick={() => setFilterType('forecast')}
            >
              ML Predictions ({forecastCount})
            </button>
          </div>

          <div className="snapshots-toolbar-right">
            <div className="snapshots-search-wrap">
              <Search size={14} className="snapshots-search-icon" />
              <input
                type="text"
                className="snapshots-search-input"
                placeholder="Search by month or year (e.g. 2025, Apr)..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
              {searchTerm && (
                <button
                  type="button"
                  className="snapshots-search-clear"
                  onClick={() => setSearchTerm('')}
                  title="Clear search"
                >
                  <X size={12} />
                </button>
              )}
            </div>

            <button
              type="button"
              className="snapshots-sort-btn"
              onClick={() => setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc')}
              title={`Switch to ${sortOrder === 'desc' ? 'Oldest First' : 'Newest First'}`}
            >
              <ArrowUpDown size={14} />
              {sortOrder === 'desc' ? 'Newest First' : 'Oldest First'}
            </button>
          </div>
        </div>

        {/* Snapshots Table Content */}
        <div className="snapshots-table-wrapper">
          <table className="snapshots-data-table">
            <thead>
              <tr>
                <th style={{ width: '50px', textAlign: 'center' }}>#</th>
                <th style={{ width: '130px' }}>Period</th>
                <th style={{ width: '160px' }}>Data Source</th>
                <th style={{ width: '190px' }}>Physical Progress %</th>
                <th style={{ width: '180px' }}>Cumulative Expenditure</th>
                <th style={{ width: '180px' }}>Total Revised Cost</th>
                <th style={{ width: '140px' }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="snapshots-table-empty">
                    <Calendar size={32} style={{ color: '#94A3B8', marginBottom: '8px' }} />
                    <p style={{ fontWeight: 600, color: '#475569', margin: '0 0 4px 0' }}>
                      No snapshot records match your filter criteria
                    </p>
                    <span style={{ fontSize: '0.8rem', color: '#94A3B8' }}>
                      Try adjusting the search query or selecting &quot;All Records&quot;
                    </span>
                  </td>
                </tr>
              ) : (
                filteredRows.map((row) => {
                  const isFuture = row.is_historical === false;
                  const isMissing = row.physical === null && !isFuture;

                  return (
                    <tr
                      key={`${row.period}-${row.originalIndex}`}
                      className={`snapshot-row ${isFuture ? 'row-forecast' : ''} ${isMissing ? 'row-missing' : ''}`}
                    >
                      <td style={{ textAlign: 'center', color: '#94A3B8', fontWeight: 500, fontSize: '0.78rem' }}>
                        {row.originalIndex}
                      </td>

                      <td style={{ fontWeight: 600, color: '#0F172A' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          {row.period}
                          {isFuture && <Sparkles size={12} color="#8B5CF6" />}
                        </div>
                      </td>

                      <td>
                        {isFuture ? (
                          <span className="source-badge badge-forecast">
                            <Sparkles size={11} /> ML Model Forecast
                          </span>
                        ) : (
                          <span className="source-badge badge-paimana">
                            <Database size={11} /> PAIMANA Official
                          </span>
                        )}
                      </td>

                      <td>
                        {row.physical !== null ? (
                          <div className="progress-cell-wrap">
                            <div className="progress-cell-num">
                              <span style={{ fontWeight: 700, color: isFuture ? '#6D28D9' : '#0284C7' }}>
                                {row.physical.toFixed(1)}%
                              </span>
                            </div>
                            <div className="progress-cell-bar">
                              <div
                                className="progress-cell-fill"
                                style={{
                                  width: `${Math.min(100, Math.max(0, row.physical))}%`,
                                  background: isFuture
                                    ? 'linear-gradient(90deg, #A78BFA, #7C3AED)'
                                    : 'linear-gradient(90deg, #38BDF8, #0284C7)'
                                }}
                              />
                            </div>
                          </div>
                        ) : (
                          <span className="missing-text">&mdash; Not Reported &mdash;</span>
                        )}
                      </td>

                      <td>
                        {row.expenditure_cr !== null ? (
                          <div className="val-compound">
                            <span className="val-cr">
                              ₹{Number(row.expenditure_cr).toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 2 })} Cr
                            </span>
                            {row.expenditure !== null && (
                              <span className="val-pct badge-exp">
                                {row.expenditure.toFixed(1)}%
                              </span>
                            )}
                          </div>
                        ) : row.expenditure !== null ? (
                          <span className="val-pct badge-exp">{row.expenditure.toFixed(1)}%</span>
                        ) : (
                          <span className="missing-text">&mdash;</span>
                        )}
                      </td>

                      <td>
                        {row.revised_cost_cr !== null ? (
                          <div className="val-compound">
                            <span className="val-cr">
                              ₹{Number(row.revised_cost_cr).toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 2 })} Cr
                            </span>
                            {row.revised_cost !== null && (
                              <span className="val-pct badge-cost">
                                {row.revised_cost.toFixed(1)}%
                              </span>
                            )}
                          </div>
                        ) : row.revised_cost !== null ? (
                          <span className="val-pct badge-cost">{row.revised_cost.toFixed(1)}%</span>
                        ) : (
                          <span className="missing-text">&mdash;</span>
                        )}
                      </td>

                      <td>
                        {isFuture ? (
                          <span className="status-tag status-horizon">
                            <Clock size={11} /> Model Horizon
                          </span>
                        ) : isMissing ? (
                          <span className="status-tag status-null">
                            Missing (Null)
                          </span>
                        ) : (
                          <span className="status-tag status-verified">
                            <CheckCircle2 size={11} /> Verified
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Modal Footer */}
        <div className="snapshots-modal-footer">
          <div className="snapshots-footer-note">
            * Note: Missing monthly snapshots remain <code>null</code> to prevent artificial zero-dips. The Historical Timeline Chart linearly connects available verified points.
          </div>
          <div className="snapshots-footer-count">
            Showing <strong>{filteredRows.length}</strong> of <strong>{timelineData.length}</strong> total records
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};
