import React, { useState, useEffect } from 'react';
import { ShieldAlert, ArrowRight, ExternalLink, Building2, TrendingUp, Clock, Landmark, Filter } from 'lucide-react';
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
            <h2 className="priority-main-title">Priority Interventions &amp; Critical Projects</h2>
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
              const isTopThree = index < 3;
              const isCritical = (p.riskLevel || '').toUpperCase() === 'CRITICAL' || p.riskScore >= 80;

              return (
                <div
                  key={p.id || index}
                  className="critical-project-row"
                  onClick={handleRowClick}
                  role="button"
                  tabIndex={0}
                  aria-label={`Open ${cleanedTitle}, risk score ${p.riskScore}/100`}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      handleRowClick();
                    }
                  }}
                >
                  {/* Left Column: Rank + Project Title + Metadata */}
                  <div className="row-left">
                    <span className={`rank-badge ${isTopThree ? 'rank-top' : 'rank-normal'}`}>
                      #{String(index + 1).padStart(2, '0')}
                    </span>

                    <div className="project-info">
                      <div className="project-title-line">
                        <span className="project-name" title={cleanedTitle}>
                          {cleanedTitle}
                        </span>
                      </div>

                      <div className="project-meta-line">
                        <span className="project-id-pill">ID: {cleanedId}</span>
                        <span className="meta-sep">•</span>
                        <span className="meta-sector">
                          <Building2 size={12} />
                          {p.sector || 'Infrastructure'}
                        </span>
                        <span className="meta-sep">•</span>
                        <span className="meta-ministry" title={p.ministry}>
                          {p.ministry}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Middle Column: Cost Overrun & Time Slippage */}
                  <div className="row-center">
                    <div className="stat-box stat-cost">
                      <span className="stat-label">COST OVERRUN</span>
                      <div className="stat-value-group">
                        <TrendingUp size={13} className="text-red" />
                        <span className="stat-value text-red">+{p.costOverrunPct}%</span>
                        {p.costEscalationCrore > 0 && (
                          <span className="stat-sub">(+₹{p.costEscalationCrore.toLocaleString()} Cr)</span>
                        )}
                      </div>
                    </div>

                    <div className="stat-box stat-time">
                      <span className="stat-label">SCHEDULE SLIPPAGE</span>
                      <div className="stat-value-group">
                        <Clock size={13} className="text-amber" />
                        <span className="stat-value text-amber">+{p.delayMonths} mo delay</span>
                      </div>
                    </div>
                  </div>

                  {/* Right Column: Composite Risk Score & Inspect Action */}
                  <div className="row-right">
                    <div className="risk-score-box">
                      <span className="risk-label">RISK INDEX</span>
                      <div className="risk-score-group">
                        <span className={`risk-score-value ${isCritical ? 'score-critical' : 'score-high'}`}>
                          {p.riskScore}
                        </span>
                        <span className="risk-score-denom">/100</span>
                        <span className={`risk-tier-badge ${isCritical ? 'tier-critical' : 'tier-high'}`}>
                          {isCritical ? 'CRITICAL' : 'HIGH RISK'}
                        </span>
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <button
                        className="open-inspect-btn"
                        title="Inspect Project Details"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (onSelectProject) onSelectProject(p.projectId || p.id);
                        }}
                      >
                        <span>Inspect</span>
                        <ExternalLink size={12} />
                      </button>

                      <button
                        className="open-inspect-btn"
                        style={{ background: '#2563EB', borderColor: '#2563EB', color: '#FFFFFF' }}
                        title="Take Action in Action Center"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (onTakeAction) onTakeAction(p.projectId || p.id);
                        }}
                      >
                        <span>Take Action</span>
                        <ShieldAlert size={12} />
                      </button>
                    </div>
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
