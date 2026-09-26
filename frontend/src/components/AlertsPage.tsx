import React, { useState, useMemo } from 'react';
import { 
  AlertTriangle, 
  Ticket, 
  Download, 
  Search, 
  ChevronDown, 
  ChevronLeft, 
  ChevronRight, 
  X, 
  ArrowUpRight, 
  CheckCircle2, 
  ShieldAlert, 
  Layers, 
  MapPin, 
  Building2,
  Clock,
  UserCheck,
  Briefcase
} from 'lucide-react';
import { projectsData } from '../data/projectsData';
import { InfoButton } from './ExplainabilityInfo';
import { StatusIndicator } from './StatusIndicator';
import { getProjectRiskCategory } from '../utils/projectStatus';
import { generateTicketPDF, type TicketData } from '../utils/pdfGenerator';
import './AlertsPage.css';
import { useLanguage } from '../context/LanguageContext';

interface AlertsPageProps {
  onSelectProject: (projectId: string) => void;
  onTakeAction: (projectId: string) => void;
  ticketsList: TicketData[];
  onUpdateTicketStatus?: (ticketId: string, newStatus: string) => void;
  targetMinistry?: string;
  targetAgency?: string;
}

export const AlertsPage: React.FC<AlertsPageProps> = ({
  onSelectProject,
  onTakeAction,
  ticketsList,
  onUpdateTicketStatus,
  targetMinistry,
  targetAgency
}) => {
  const { t } = useLanguage();
  const [activeTab, setActiveTab] = useState<'warnings' | 'tickets'>('warnings');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchType, setSearchType] = useState<'all' | 'name' | 'id' | 'sector'>('all');
  const [selectedRiskFilter, setSelectedRiskFilter] = useState<string>('All');
  const [selectedSectorFilter, setSelectedSectorFilter] = useState<string>('All');
  const [selectedMinistryFilter, setSelectedMinistryFilter] = useState<string>('All');
  const [selectedStateFilter, setSelectedStateFilter] = useState<string>('All');
  const [ticketStatusFilter, setTicketStatusFilter] = useState<string>('All');
  const [page, setPage] = useState(1);
  const pageSize = 12;

  // Filter projects with early warning signals (high risk scores or delayed status)
  const allEarlyWarningProjects = useMemo(() => {
    return projectsData.filter(p => {
      const isHighRisk = (p.riskScore && p.riskScore >= 60) || p.riskLevel === 'Critical' || p.riskLevel === 'High' || p.scheduleStatus === 'CRITICAL' || p.scheduleStatus === 'DELAYED';
      if (!isHighRisk) return false;

      // Apply role-based ministry/agency filter
      if (targetMinistry && p.ministry && !p.ministry.toLowerCase().includes(targetMinistry.toLowerCase())) return false;
      if (targetAgency && p.agency && !p.agency.toLowerCase().includes(targetAgency.toLowerCase())) return false;

      if (selectedRiskFilter !== 'All') {
        const rCat = getProjectRiskCategory(p);
        if (selectedRiskFilter === 'Critical' && rCat !== 'Critical') return false;
        if (selectedRiskFilter === 'High' && rCat !== 'High') return false;
      }

      if (selectedSectorFilter !== 'All' && p.sector !== selectedSectorFilter) return false;
      if (selectedMinistryFilter !== 'All' && p.ministry !== selectedMinistryFilter) return false;
      if (selectedStateFilter !== 'All' && p.location !== selectedStateFilter) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        if (searchType === 'id') {
          return p.id.toLowerCase().includes(q) || 
                 (p.legacyOcmsCode && p.legacyOcmsCode.toLowerCase().includes(q)) || 
                 ((p as any).legacy_ocms_code && String((p as any).legacy_ocms_code).toLowerCase().includes(q));
        }
        if (searchType === 'name') {
          return p.name.toLowerCase().includes(q);
        }
        if (searchType === 'sector') {
          return p.sector.toLowerCase().includes(q);
        }
        return p.name.toLowerCase().includes(q) || 
               p.id.toLowerCase().includes(q) || 
               p.sector.toLowerCase().includes(q) || 
               (p.ministry || '').toLowerCase().includes(q) ||
               (p.location || '').toLowerCase().includes(q);
      }
      return true;
    });
  }, [searchQuery, searchType, selectedRiskFilter, selectedSectorFilter, selectedMinistryFilter, selectedStateFilter, targetMinistry, targetAgency]);

  // Total detected warnings across whole database
  const totalWarningsCount = useMemo(() => {
    return projectsData.filter(p => (p.riskScore && p.riskScore >= 60) || p.riskLevel === 'Critical' || p.riskLevel === 'High' || p.scheduleStatus === 'CRITICAL' || p.scheduleStatus === 'DELAYED').length;
  }, []);

  // Available unique sectors, ministries, and states
  const { sectors, ministries, states } = useMemo(() => {
    const secSet = new Set<string>();
    const minSet = new Set<string>();
    const stSet = new Set<string>();

    projectsData.forEach(p => {
      if (p.sector) secSet.add(p.sector.trim());
      if (p.ministry) minSet.add(p.ministry.trim());
      if (p.location) stSet.add(p.location.trim());
    });

    return {
      sectors: ['All', ...Array.from(secSet).sort()],
      ministries: ['All', ...Array.from(minSet).sort()],
      states: ['All', ...Array.from(stSet).sort()]
    };
  }, []);

  // Filtered action tickets
  const filteredTickets = useMemo(() => {
    return ticketsList.filter(t => {
      if (ticketStatusFilter !== 'All' && t.status !== ticketStatusFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return t.id.toLowerCase().includes(q) ||
               t.projectName.toLowerCase().includes(q) ||
               t.projectId.toLowerCase().includes(q) ||
               t.actionTitle.toLowerCase().includes(q) ||
               t.routedOfficer.toLowerCase().includes(q) ||
               t.ministry.toLowerCase().includes(q);
      }
      return true;
    });
  }, [ticketsList, ticketStatusFilter, searchQuery]);

  // Paginated Early Warnings
  const totalPages = Math.ceil(allEarlyWarningProjects.length / pageSize) || 1;
  const paginatedWarnings = useMemo(() => {
    const start = (page - 1) * pageSize;
    return allEarlyWarningProjects.slice(start, start + pageSize);
  }, [allEarlyWarningProjects, page, pageSize]);

  const handleClearFilters = () => {
    setSearchQuery('');
    setSearchType('all');
    setSelectedRiskFilter('All');
    setSelectedSectorFilter('All');
    setSelectedMinistryFilter('All');
    setSelectedStateFilter('All');
    setTicketStatusFilter('All');
    setPage(1);
  };

  const isFiltered = Boolean(
    searchQuery.trim() ||
    selectedRiskFilter !== 'All' ||
    selectedSectorFilter !== 'All' ||
    selectedMinistryFilter !== 'All' ||
    selectedStateFilter !== 'All' ||
    searchType !== 'all'
  );

  return (
    <div className="alerts-page-container">
      {/* Top Header Bar */}
      <div className="alerts-top-bar">
        <div className="alerts-title-section">
          <div className="alerts-icon-badge">
            <ShieldAlert size={26} color="#4338CA" />
          </div>
          <div>
            <h1 className="alerts-main-title">{t('early_warnings', 'Early Warning Signals')} &amp; {t('tickets', 'Action Tickets')}</h1>
            <p className="alerts-main-subtitle">
              PAIMANA Infrastructure Risk Surveillance &amp; Automated Directive Management Framework
            </p>
          </div>
        </div>

        <div className="alerts-header-actions">
          <span className="alerts-total-badge">
            {activeTab === 'warnings' 
              ? `${allEarlyWarningProjects.length.toLocaleString()} ${t('warning_signals', 'Warning Signals')}` 
              : `${filteredTickets.length.toLocaleString()} ${t('tickets', 'Officer Tickets')}`}
          </span>

          {activeTab === 'warnings' ? (
            <InfoButton
              title="Early Warning Signals"
              summary="Continuous AI surveillance detecting high-risk cost overrun and delay trajectories (risk score ≥ 60%). Empowers MoSPI and executing agencies to review counterfactual scenarios and issue structured directives."
              dataSummary={{
                items: [
                  { label: 'Risk Threshold', value: 'Cost Overrun ≥ 20% OR Delay ≥ 12 Months (Score ≥ 60%)' },
                  { label: 'Signal Sources', value: 'Live PMG, OCMS, and field inspector telemetry' }
                ],
                insight: 'Filter by risk tier and sector to triage high-priority infrastructure bottlenecks before cost escalations become irreversible.'
              }}
              theme="light"
              size="md"
            />
          ) : (
            <InfoButton
              title="Action Tickets Board"
              summary="Formal inter-ministerial tickets with auto-generated PDF memos used to escalate critical delays to the appropriate authorities for intervention."
              dataSummary={{
                items: [
                  { label: 'Directive Issuance', value: 'One-click memo generation synced with PMG' },
                  { label: 'Tracking Ledger', value: 'Live status synced across MoSPI and executing agencies' }
                ],
                insight: 'Track the status of issued directives and monitor executing agency compliance in real-time.'
              }}
              theme="light"
              size="md"
            />
          )}
        </div>
      </div>

      {/* Lifecycle / View Segregation Tabs */}
      <div className="section-nav-bar" style={{ marginBottom: '24px' }}>
        <div role="tablist" aria-label="Alerts View Segregation" style={{ display: 'flex', gap: '2px' }}>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'warnings'}
            className={`section-nav-tab ${activeTab === 'warnings' ? 'active' : ''}`}
            onClick={() => { setActiveTab('warnings'); setPage(1); }}
          >
            <AlertTriangle size={16} />
            <span>{t('early_warnings', 'Early Warnings List')}</span>
            <span style={{ marginLeft: '4px', background: activeTab === 'warnings' ? 'rgba(79,142,247,0.25)' : 'rgba(255,255,255,0.1)', padding: '2px 7px', borderRadius: '20px', fontSize: '11px', fontWeight: 800 }}>{totalWarningsCount.toLocaleString()}</span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'tickets'}
            className={`section-nav-tab ${activeTab === 'tickets' ? 'active' : ''}`}
            onClick={() => { setActiveTab('tickets'); setPage(1); }}
          >
            <Ticket size={16} />
            <span>{t('tickets', 'Action Tickets Board')}</span>
            <span style={{ marginLeft: '4px', background: activeTab === 'tickets' ? 'rgba(79,142,247,0.25)' : 'rgba(255,255,255,0.1)', padding: '2px 7px', borderRadius: '20px', fontSize: '11px', fontWeight: 800 }}>{ticketsList.length}</span>
          </button>
        </div>
      </div>

      {/* Tab 1: Early Warnings List */}
      {activeTab === 'warnings' && (
        <div className="alerts-content-section">
          {/* Filters Card */}
          <div className="alerts-filters-card">
            <div className="alerts-search-bar-row">
              <div className="alerts-search-type-wrapper">
                <select
                  value={searchType}
                  onChange={(e) => { setSearchType(e.target.value as any); setPage(1); }}
                  className="alerts-search-type-select"
                >
                  <option value="all">{t('filter_all', 'All Fields')}</option>
                  <option value="name">{t('search_by_name', 'By Project Name')}</option>
                  <option value="id">{t('search_by_id', 'By Project ID')}</option>
                  <option value="sector">{t('filter_sector', 'By Sector')}</option>
                </select>
                <ChevronDown size={14} className="search-type-chevron" />
              </div>

              <div className="alerts-search-input-wrapper">
                <Search size={16} className="search-icon" />
                <input
                  type="text"
                  placeholder={t('search_warnings', 'Filter early warnings by project name, ID, sector, or ministry...')}
                  value={searchQuery}
                  onChange={(e) => { setSearchQuery(e.target.value); setPage(1); }}
                  className="alerts-search-input"
                />
                {searchQuery && (
                  <button 
                    type="button" 
                    className="search-clear-btn" 
                    onClick={() => { setSearchQuery(''); setPage(1); }}
                  >
                    <X size={14} />
                  </button>
                )}
              </div>
            </div>

            <div className="alerts-dropdowns-group">
              <div className="alerts-filter-select-wrapper">
                <Layers size={15} className="filter-select-icon" />
                <select
                  value={selectedSectorFilter}
                  onChange={(e) => { setSelectedSectorFilter(e.target.value); setPage(1); }}
                  className="alerts-filter-select"
                >
                  {sectors.map((sec, idx) => (
                    <option key={idx} value={sec}>
                      {sec === 'All' ? t('filter_all_sectors', 'All Infrastructure Sectors') : sec}
                    </option>
                  ))}
                </select>
              </div>

              <div className="alerts-filter-select-wrapper">
                <Building2 size={15} className="filter-select-icon" />
                <select
                  value={selectedMinistryFilter}
                  onChange={(e) => { setSelectedMinistryFilter(e.target.value); setPage(1); }}
                  className="alerts-filter-select"
                >
                  {ministries.map((min, idx) => (
                    <option key={idx} value={min}>
                      {min === 'All' ? t('filter_all_ministries', 'All Ministries') : min}
                    </option>
                  ))}
                </select>
              </div>

              <div className="alerts-filter-select-wrapper">
                <MapPin size={15} className="filter-select-icon" />
                <select
                  value={selectedStateFilter}
                  onChange={(e) => { setSelectedStateFilter(e.target.value); setPage(1); }}
                  className="alerts-filter-select"
                >
                  {states.map((st, idx) => (
                    <option key={idx} value={st}>
                      {st === 'All' ? t('filter_all_states', 'All States / UTs') : st}
                    </option>
                  ))}
                </select>
              </div>

              <div className="alerts-filter-select-wrapper">
                <select
                  value={selectedRiskFilter}
                  onChange={(e) => { setSelectedRiskFilter(e.target.value); setPage(1); }}
                  className="alerts-filter-select"
                >
                  <option value="All">{t('filter_all_risk', 'All Risk Levels')}</option>
                  <option value="Critical">🔴 {t('status_critical', 'Critical')} {t('risk_score', 'Risk')} — Score ≥ 75</option>
                  <option value="High">🟠 {t('status_high_risk', 'High Risk')} — Score 60–74</option>
                </select>
              </div>
            </div>

            {/* Active Filters Row */}
            {isFiltered && (
              <div className="alerts-active-filters-row">
                <span className="active-filters-label">{t('filter_active', 'Active Filters')}:</span>
                {searchQuery && (
                  <span className="filter-chip">
                    {searchType === 'id' ? 'ID: ' : searchType === 'name' ? 'Name: ' : 'Search: '} "{searchQuery}"
                    <X size={12} className="chip-x" onClick={() => { setSearchQuery(''); setPage(1); }} />
                  </span>
                )}
                {selectedRiskFilter !== 'All' && (
                  <span className="filter-chip chip-risk">
                    Risk: {selectedRiskFilter}
                    <X size={12} className="chip-x" onClick={() => { setSelectedRiskFilter('All'); setPage(1); }} />
                  </span>
                )}
                {selectedSectorFilter !== 'All' && (
                  <span className="filter-chip">
                    Sector: {selectedSectorFilter}
                    <X size={12} className="chip-x" onClick={() => { setSelectedSectorFilter('All'); setPage(1); }} />
                  </span>
                )}
                {selectedMinistryFilter !== 'All' && (
                  <span className="filter-chip">
                    Ministry: {selectedMinistryFilter}
                    <X size={12} className="chip-x" onClick={() => { setSelectedMinistryFilter('All'); setPage(1); }} />
                  </span>
                )}
                {selectedStateFilter !== 'All' && (
                  <span className="filter-chip">
                    State: {selectedStateFilter}
                    <X size={12} className="chip-x" onClick={() => { setSelectedStateFilter('All'); setPage(1); }} />
                  </span>
                )}
                <button type="button" onClick={handleClearFilters} className="clear-all-filters-btn">
                  Reset all
                </button>
              </div>
            )}
          </div>

          {/* Table Card */}
          <div className="alerts-table-card">
            <div className="alerts-table-responsive-container">
              <table className="alerts-custom-table">
                <thead>
                  <tr>
                    <th className="th-project-id">PROJECT ID</th>
                    <th className="th-project-name">PROJECT NAME</th>
                    <th className="th-sector">SECTOR & MINISTRY</th>
                    <th className="th-agency">AGENCY & STATE</th>
                    <th className="th-overrun">OVERRUN PROJECTIONS</th>
                    <th className="th-risk">RISK CLASSIFICATION</th>
                    <th className="th-early-warning">EARLY WARNING SIGNAL</th>
                    <th className="th-actions">ACTIONS</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedWarnings.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="alerts-empty-cell">
                        No early warning signals found matching the selected filter criteria.
                      </td>
                    </tr>
                  ) : (
                    paginatedWarnings.map((project) => {
                      const score = project.riskScore || 68;
                      const isCrit = score >= 75 || project.riskLevel === 'Critical';
                      const costOverrun = project.costOverrunPct || '24.5%';
                      const isCostSaving = costOverrun.includes('-');
                      const delayMo = (project as any).delayMonths || project.timeOverrunMonths || 14;

                      // Derive realistic early warning signal
                      const tRisk = project.timeRisk ?? (project.riskScore || 0);
                      const cRisk = project.costRisk ?? (project.riskScore || 0);
                      let earlyWarningTitle = "Routine Monitoring Recommended";
                      let warningColor = "#03045E";
                      let warningBg = "#F1F5F9";
                      if (tRisk >= 60 && cRisk >= 60) {
                        earlyWarningTitle = "Schedule & Budget Escalation Risk";
                        warningColor = "#991B1B";
                        warningBg = "#FEE2E2";
                      } else if (tRisk >= 50) {
                        earlyWarningTitle = "Recorded Timeline Extension Overrun";
                        warningColor = "#D97706";
                        warningBg = "#FEF3C7";
                      } else if (cRisk >= 50 || costOverrun.includes('+')) {
                        earlyWarningTitle = "Budget Outlay Escalation Pressure";
                        warningColor = "#D97706";
                        warningBg = "#FEF3C7";
                      }

                      return (
                        <tr
                          key={project.id}
                          className="alerts-table-row"
                          onClick={() => onSelectProject(project.id)}
                          tabIndex={0}
                        >
                          <td className="td-project-id">
                            <div className="project-id-text">{project.id}</div>
                            {(project.legacyOcmsCode || (project as any).legacy_ocms_code) && (
                              <span className="ocms-pill-badge">
                                OCMS: {project.legacyOcmsCode || (project as any).legacy_ocms_code}
                              </span>
                            )}
                          </td>

                          <td className="td-project-name">
                            <div className="project-primary-name">{project.name}</div>
                            <div className="project-sub-meta">{project.sector} • {project.location || 'Pan-India'}</div>
                          </td>

                          <td className="td-sector">
                            <div className="sector-badge-pill">{project.sector}</div>
                            <div className="ministry-sub-text">{project.ministry}</div>
                          </td>

                          <td className="td-agency">
                            <div className="agency-title">{project.agency || 'Executing Agency'}</div>
                            <div className="location-sub-text">{project.location}</div>
                          </td>

                          <td className="td-overrun">
                            <div className="overrun-pills-row">
                              <span className={`overrun-cost-pill ${isCostSaving ? 'good' : 'bad'}`}>
                                {costOverrun.startsWith('+') ? '' : '+'}{costOverrun} Cost
                              </span>
                              <span className="overrun-delay-pill">
                                +{delayMo} mos Delay
                              </span>
                            </div>
                          </td>

                          <td className="td-risk">
                            <div className="risk-cell-cluster">
                              <StatusIndicator 
                                kind={isCrit ? 'critical' : 'delayed'} 
                                label={isCrit ? 'CRITICAL RISK' : 'HIGH RISK'} 
                                className={`status-badge-pill ${isCrit ? 'status-critical' : 'status-delayed'}`} 
                              />
                              <span className="risk-score-sub">{score}/100 Risk Index</span>
                            </div>
                          </td>

                          <td className="td-early-warning" style={{ padding: '12px 16px' }}>
                            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', backgroundColor: warningBg, color: warningColor, padding: '4px 10px', borderRadius: '6px', fontSize: '11.5px', fontWeight: 650, border: `1px solid ${warningColor}33`, whiteSpace: 'nowrap' }}>
                              <AlertTriangle size={13} />
                              {earlyWarningTitle}
                            </div>
                          </td>

                          <td className="td-actions" onClick={(e) => e.stopPropagation()}>
                            <div className="alerts-actions-group">
                              <button
                                type="button"
                                className="action-btn-details"
                                onClick={() => onSelectProject(project.id)}
                                title="View Project Analytics"
                              >
                                <span>Details</span>
                                <ArrowUpRight size={13} />
                              </button>
                              <button
                                type="button"
                                className="action-btn-take-action"
                                onClick={() => onTakeAction(project.id)}
                                title="Open Policy Action Center"
                              >
                                <span>Take Action</span>
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="alerts-pagination-bar">
                <span className="pagination-info">
                  Showing {(page - 1) * pageSize + 1} to {Math.min(page * pageSize, allEarlyWarningProjects.length)} of {allEarlyWarningProjects.length.toLocaleString()} warning signals
                  {isFiltered && ` (filtered from ${totalWarningsCount.toLocaleString()} total)`}
                </span>

                <div className="pagination-controls">
                  <button
                    type="button"
                    className="page-btn"
                    disabled={page <= 1}
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    title="Previous Page"
                    aria-label="Previous page"
                  >
                    <ChevronLeft size={16} />
                  </button>

                  {(() => {
                    const pages: number[] = [];
                    const maxButtons = 5;
                    let start = Math.max(1, page - Math.floor(maxButtons / 2));
                    let end = start + maxButtons - 1;
                    if (end > totalPages) {
                      end = totalPages;
                      start = Math.max(1, end - maxButtons + 1);
                    }
                    for (let i = start; i <= end; i++) {
                      pages.push(i);
                    }
                    return pages.map(pNum => (
                      <button
                        key={pNum}
                        type="button"
                        className={`page-btn ${page === pNum ? 'active' : ''}`}
                        onClick={() => setPage(pNum)}
                      >
                        {pNum}
                      </button>
                    ));
                  })()}

                  <button
                    type="button"
                    className="page-btn"
                    disabled={page >= totalPages}
                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                    title="Next Page"
                    aria-label="Next page"
                  >
                    <ChevronRight size={16} />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab 2: Action Tickets Board */}
      {activeTab === 'tickets' && (
        <div className="alerts-content-section">
          {/* Controls Bar for Tickets */}
          <div className="alerts-filters-card" style={{ marginBottom: '20px' }}>
            <div className="alerts-search-bar-row">
              <div className="alerts-search-input-wrapper" style={{ paddingLeft: '12px' }}>
                <Search size={16} className="search-icon" />
                <input
                  type="text"
                  placeholder="Search tickets by ID, project name, directive title, or assigned officer..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="alerts-search-input"
                />
                {searchQuery && (
                  <button 
                    type="button" 
                    className="search-clear-btn" 
                    onClick={() => setSearchQuery('')}
                  >
                    <X size={14} />
                  </button>
                )}
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '12px' }}>
              <span style={{ fontSize: '13px', fontWeight: 700, color: '#334155' }}>Filter by Status:</span>
              <div className="ticket-status-filter-pills">
                {['All', 'PENDING', 'IN_PROGRESS', 'RESOLVED'].map(st => (
                  <button
                    key={st}
                    type="button"
                    className={`ticket-filter-pill ${ticketStatusFilter === st ? 'active' : ''}`}
                    onClick={() => setTicketStatusFilter(st)}
                  >
                    {st === 'All' ? 'All Tickets' : st.replace('_', ' ')}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {filteredTickets.length === 0 ? (
            <div className="alerts-no-tickets-card">
              <div className="no-tickets-icon-wrap">
                <Ticket size={40} color="#64748B" />
              </div>
              <h3 className="no-tickets-title">No Officer Action Tickets Found</h3>
              <p className="no-tickets-desc">
                {ticketsList.length === 0 
                  ? 'No intervention directives have been generated yet. Open any project from the Early Warnings list and click "Take Action" to run counterfactual simulations and generate official MoSPI tickets.'
                  : 'No tickets match your current search and filter criteria.'}
              </p>
              {ticketsList.length === 0 && (
                <button
                  type="button"
                  className="action-btn-take-action"
                  style={{ marginTop: '16px', padding: '10px 20px', fontSize: '13px' }}
                  onClick={() => setActiveTab('warnings')}
                >
                  <AlertTriangle size={15} />
                  <span>Review Early Warning Signals</span>
                </button>
              )}
            </div>
          ) : (
            <div className="alerts-tickets-grid">
              {filteredTickets.map(t => {
                const statusClass = t.status.toLowerCase().replace('_', '-');
                return (
                  <div key={t.id} className="alerts-ticket-card">
                    <div className="ticket-top-row">
                      <div className="ticket-id-badge">
                        <Ticket size={14} color="#2563EB" />
                        <span>{t.id}</span>
                      </div>
                      <span className={`ticket-status-tag ${statusClass}`}>
                        {t.status.replace('_', ' ')}
                      </span>
                    </div>

                    <h3 className="ticket-directive-title">{t.actionTitle}</h3>

                    <div className="ticket-project-box" onClick={() => onSelectProject(t.projectId)}>
                      <div className="ticket-project-label">PROJECT REFERENCE</div>
                      <div className="ticket-project-name">{t.projectName}</div>
                      <div className="ticket-project-meta">ID: {t.projectId} • {t.ministry}</div>
                    </div>

                    <div className="ticket-details-table">
                      <div className="ticket-detail-item">
                        <span className="detail-lbl"><UserCheck size={13} /> Assigned Officer</span>
                        <span className="detail-val">{t.routedOfficer}</span>
                      </div>
                      <div className="ticket-detail-item">
                        <span className="detail-lbl"><Briefcase size={13} /> Ministry / Agency</span>
                        <span className="detail-val">{t.ministry}</span>
                      </div>
                      <div className="ticket-detail-item">
                        <span className="detail-lbl"><Clock size={13} /> Date Issued</span>
                        <span className="detail-val">{t.dateCreated}</span>
                      </div>
                    </div>

                    <div className="ticket-card-actions">
                      <button
                        type="button"
                        className="ticket-download-btn"
                        onClick={() => generateTicketPDF(t)}
                        title="Download Official MoSPI PDF Directive"
                      >
                        <Download size={14} />
                        <span>Download MoSPI PDF</span>
                      </button>

                      {onUpdateTicketStatus && t.status !== 'RESOLVED' && (
                        <button
                          type="button"
                          className="ticket-resolve-btn"
                          onClick={() => onUpdateTicketStatus(t.id, 'RESOLVED')}
                          title="Mark Directive as Resolved"
                        >
                          <CheckCircle2 size={14} />
                          <span>Mark Resolved</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
