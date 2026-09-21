import React, { useState, useEffect } from 'react';
import { ShieldAlert, ArrowRight, ExternalLink, Building2, TrendingUp, Clock, Landmark, Filter } from 'lucide-react';
import { InfoButton } from './ExplainabilityInfo';
import './PriorityInterventions.css';
import { api } from '../services/api';
import { cleanProjectName, cleanProjectId } from '../utils/cleanProjectName';

export interface CriticalProject {
  id: string;
  projectId: string;
  project: string;
  riskScore: number;
  riskLevel: string;
  costOverrunPct: number;
  costEscalationCrore: number;
  delayMonths: number;
  originalCost: number;
  revisedCost: number;
  sector: string;
  ministry: string;
  concern: string;
}

interface PriorityInterventionsProps {
  onSelectProject?: (projectId: string) => void;
  onTakeAction?: (projectId: string) => void;
}

export const PriorityInterventions: React.FC<PriorityInterventionsProps> = ({ onSelectProject, onTakeAction }) => {
  const [projects, setProjects] = useState<CriticalProject[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<boolean>(false);
  const [showAll, setShowAll] = useState<boolean>(true); // Default to showing Top 10
  const [selectedMinistry, setSelectedMinistry] = useState<string>('All');
  const [ministriesList, setMinistriesList] = useState<string[]>([]);

  // Fetch available ministries on mount
  useEffect(() => {
    api.getMinistries().then((res) => {
      if (res && res.length > 0) {
        // Deduplicate case-insensitively and format cleanly
        const uniqueNames = new Map<string, string>();
        res.forEach(m => {
          const trimmed = m.name.trim();
          const key = trimmed.toLowerCase();
          if (!uniqueNames.has(key)) {
            uniqueNames.set(key, trimmed);
          }
        });
        const sorted = Array.from(uniqueNames.values()).sort((a, b) => a.localeCompare(b));
        setMinistriesList(sorted);
      }
    }).catch(() => {
      // Fallback ministries
      setMinistriesList([
        'Ministry of Railways',
        'Ministry of Road Transport & Highways',
        'Ministry of Power',
        'Ministry of Petroleum & Natural Gas',
        'Ministry of Coal',
        'Ministry of Steel',
        'Ministry of Housing and Urban Affairs',
        'Ministry of Water Resources'
      ]);
    });
  }, []);

  // Fetch top critical projects whenever selectedMinistry changes
  useEffect(() => {
    let isMounted = true;
    setLoading(true);
    setError(false);

    api.getCriticalProjects(selectedMinistry, 10).then((res) => {
      if (!isMounted) return;
      if (res && res.length > 0) {
        setProjects(res);
        setLoading(false);
      } else {
        setProjects([]);
        setLoading(false);
      }
    }).catch(() => {
      if (!isMounted) return;
      setError(true);
      setLoading(false);
    });

    return () => {
      isMounted = false;
    };
  }, [selectedMinistry]);

  const displayedProjects = showAll ? projects.slice(0, 10) : projects.slice(0, 5);

  return (
    <div className="card priority-critical-card">
      {/* ── Header Toolbar with Title & Ministry Filter ── */}
      <div className="priority-header">
        <div className="priority-title-group">
          <div className="priority-header-icon-box">
            <ShieldAlert size={20} color="#DC2626" />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <h2 className="priority-main-title" style={{ margin: 0 }}>Priority Interventions &amp; Critical Projects</h2>
              <InfoButton
                title="Priority Interventions"
                summary="Automatically curates the top critical infrastructure projects across the nation that require immediate executive action based on their cost and schedule risk profiles."
                theme="light"
                size="sm"
              />
            </div>
            <p className="priority-sub-title">
              {selectedMinistry === 'All'
                ? 'Top 10 highest-risk national infrastructure assets flagged by Predictive AI'
                : `Top 10 highest-risk assets under ${selectedMinistry}`}
            </p>
          </div>
        </div>

        <div className="priority-controls-group">
          {/* Ministry Filter Dropdown */}
          <div className="priority-ministry-filter">
            <Landmark size={14} className="filter-icon" />
            <select
              value={selectedMinistry}
              onChange={(e) => setSelectedMinistry(e.target.value)}
              className="priority-ministry-select"
              aria-label="Filter by Ministry"
            >
              <option value="All">All Ministries (National Top 10)</option>
              {ministriesList.map((m, idx) => (
                <option key={idx} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>

          {/* Toggle Top 5 / Top 10 */}
          {projects.length > 5 && (
            <button
              className="priority-toggle-btn"
              onClick={() => setShowAll(!showAll)}
              title={showAll ? 'Collapse to Top 5' : 'Expand to Top 10'}
            >
              <span>{showAll ? 'Show Top 5' : `View All ${projects.length} Critical`}</span>
              <ArrowRight size={13} className={`arrow-icon ${showAll ? 'arrow-up' : ''}`} />
            </button>
          )}
        </div>
      </div>

      {/* ── Content Area: List of Top 10 Critical Projects ── */}
      <div className="priority-content-area">
        {loading ? (
          <div className="priority-loading-state">
            <div className="spinner-border" />
            <span>Retrieving top risk-weighted assets from database...</span>
          </div>
        ) : error || projects.length === 0 ? (
          <div className="priority-empty-state">
            <Filter size={24} color="#94A3B8" />
            <span>No critical projects found for {selectedMinistry === 'All' ? 'this selection' : selectedMinistry}.</span>
          </div>
        ) : (
          <div className="critical-projects-list">
            {displayedProjects.map((p, index) => {
              const handleRowClick = () => {
                if (onSelectProject) {
                  onSelectProject(p.projectId || p.id);
                }
              };

              const cleanedTitle = cleanProjectName(p.project);
              const cleanedId = cleanProjectId(p.projectId || p.id);
              const isCritical = (p.riskLevel || '').toUpperCase() === 'CRITICAL' || p.riskScore >= 80;

              return (
                <div
                  key={p.id || index}
                  className="img3-intervention-row"
                  onClick={handleRowClick}
                  role="button"
                  tabIndex={0}
                  aria-label={`Open ${cleanedTitle}, risk score ${p.riskScore}/100`}
                >
                  <span className={`img3-rank-badge ${index % 2 === 1 ? 'rank-blue' : 'rank-dark'}`}>
                    #{String(index + 1).padStart(2, '0')}
                  </span>

                  <div className="img3-info-col">
                    <div className="img3-meta-top">
                      <span className="img3-id-tag">ID: {cleanedId}</span>
                      <span className="img3-meta-dot">•</span>
                      <span className="img3-sector-tag"><Building2 size={12} /> {p.sector || 'Infrastructure'}</span>
                      <span className="img3-meta-dot">•</span>
                      <span className="img3-ministry-tag">{p.ministry}</span>
                    </div>
                    <h3 className="img3-project-title">{cleanedTitle}</h3>
                  </div>

                  <div className="img3-metrics-group">
                    <div className="img3-metric-item">
                      <span className="img3-metric-lbl">COST OVERRUN</span>
                      <div className="img3-metric-val-row text-red">
                        <TrendingUp size={13} />
                        <span className="img3-val-bold">+{p.costOverrunPct}%</span>
                        {p.costEscalationCrore > 0 && (
                          <span className="img3-val-sub">(+₹{p.costEscalationCrore.toLocaleString()} Cr)</span>
                        )}
                      </div>
                    </div>

                    <div className="img3-metric-item">
                      <span className="img3-metric-lbl">SCHEDULE SLIPPAGE</span>
                      <div className="img3-metric-val-row text-amber">
                        <Clock size={13} />
                        <span className="img3-val-bold">+{p.delayMonths} mo delay</span>
                      </div>
                    </div>

                    <div className="img3-metric-item">
                      <span className="img3-metric-lbl">RISK INDEX</span>
                      <div className="img3-risk-val-row">
                        <span className="img3-risk-num">{p.riskScore} <span className="img3-risk-denom">/100</span></span>
                        <span className={`img3-critical-badge ${isCritical ? 'badge-crit' : 'badge-high'}`}>
                          {isCritical ? 'CRITICAL' : 'HIGH RISK'}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="img3-actions-group">
                    <button
                      type="button"
                      className="img3-inspect-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (onSelectProject) onSelectProject(p.projectId || p.id);
                      }}
                    >
                      <span>Inspect</span>
                      <ExternalLink size={13} />
                    </button>

                    <button
                      type="button"
                      className="img3-action-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (onTakeAction) onTakeAction(p.projectId || p.id);
                      }}
                    >
                      <ShieldAlert size={13} />
                      <span>Take Action</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
