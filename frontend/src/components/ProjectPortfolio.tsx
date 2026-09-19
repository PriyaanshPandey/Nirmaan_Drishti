import React, { useState, useEffect } from 'react';
import { Download, Search, SlidersHorizontal, ChevronLeft, ChevronRight, X, ChevronDown, Activity, CheckCircle2, PauseCircle } from 'lucide-react';
import type { Project } from '../data/projectsData';
import { getProjectDisplayStatus } from '../utils/projectStatus';
import { api } from '../services/api';
import './ProjectPortfolio.css';
import { StatusIndicator } from './StatusIndicator';

export type ProjectCategoryTab = 'ONGOING' | 'COMPLETED' | 'INACTIVE';

interface ProjectPortfolioProps {
  onSelectProject: (projectId: string) => void;
  onTakeAction?: (projectId: string) => void;
  initialStatus?: string;
  statusFilterNonce?: number;
  initialRisk?: string;
  riskFilterNonce?: number;
}

export const ProjectPortfolio: React.FC<ProjectPortfolioProps> = ({ 
  onSelectProject, 
  onTakeAction,
  initialStatus, 
  statusFilterNonce,
  initialRisk,
  riskFilterNonce
}) => {
  const [projectsList, setProjectsList] = useState<Project[]>([]);
  const [totalProjects, setTotalProjects] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<boolean>(false);
  const [page, setPage] = useState<number>(1);
  const pageSize = 20;

  const [showNewProjectModal, setShowNewProjectModal] = useState<boolean>(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectCode, setNewProjectCode] = useState('');
  const [newProjectCost, setNewProjectCost] = useState('');

  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [searchType, setSearchType] = useState<'all' | 'name' | 'id'>('all');
  const [selectedMinistry, setSelectedMinistry] = useState('All');
  const [selectedSector, setSelectedSector] = useState('All');
  const [selectedStatus, setSelectedStatus] = useState(initialStatus || 'All');
  const [selectedRisk, setSelectedRisk] = useState(initialRisk || 'All');
  const [activeCategory, setActiveCategory] = useState<ProjectCategoryTab>('ONGOING');
  const [statusCounts, setStatusCounts] = useState<{ ongoing: number; completed: number; inactive: number; total: number }>({
    ongoing: 1379,
    completed: 1442,
    inactive: 2328,
    total: 5149
  });

  // Fetch status counts on mount
  useEffect(() => {
    let isMounted = true;
    api.getProjectStatusCounts().then((counts) => {
      if (isMounted && counts) {
        setStatusCounts(counts);
      }
    }).catch(() => {});
    return () => { isMounted = false; };
  }, []);

  const handleCategoryChange = (category: ProjectCategoryTab) => {
    if (category === activeCategory) return;
    setActiveCategory(category);
    setPage(1);
  };

  const fetchProjects = () => {
    setLoading(true);
    setError(false);

    api.getProjects(
      page, 
      pageSize, 
      searchQuery, 
      undefined, 
      undefined, 
      selectedStatus !== 'All' ? selectedStatus : undefined,
      selectedMinistry !== 'All' ? selectedMinistry : undefined,
      selectedSector !== 'All' ? selectedSector : undefined,
      selectedRisk !== 'All' ? selectedRisk : undefined,
      searchType,
      activeCategory
    )
      .then((res) => {
        setProjectsList(res.items);
        setTotalProjects(res.total);
        setLoading(false);
      })
      .catch(() => {
        setError(true);
        setLoading(false);
      });
  };

  const handleOnboardProject = async () => {
    if (!newProjectName.trim()) {
      setSubmitError('Project Name is required');
      return;
    }

    const costNum = parseFloat(newProjectCost) || 1000;
    const code = newProjectCode.trim() || `PRJ-${Date.now().toString().slice(-5)}`;

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      await api.createProject({
        id: code,
        name: newProjectName.trim(),
        project_code: code,
        original_cost: costNum,
        revised_cost: costNum,
        schedule_status: 'ON TRACK'
      });

      // Clear inputs & close modal
      setNewProjectName('');
      setNewProjectCode('');
      setNewProjectCost('');
      setShowNewProjectModal(false);

      // Re-fetch project list to display newly added project at the top
      setPage(1);
      fetchProjects();
    } catch (err: any) {
      setSubmitError(err.message || 'Failed to onboard project');
    } finally {
      setIsSubmitting(false);
    }
  };

  useEffect(() => {
    if (initialStatus !== undefined) {
      setSelectedStatus(initialStatus || 'All');
      setPage(1);
    }
  }, [initialStatus, statusFilterNonce]);

  useEffect(() => {
    if (initialRisk !== undefined) {
      setSelectedRisk(initialRisk || 'All');
      setPage(1);
    }
  }, [initialRisk, riskFilterNonce]);

  const [ministries, setMinistries] = useState<string[]>(['All']);
  const [sectors, setSectors] = useState<string[]>(['All']);

  useEffect(() => {
    if (!showNewProjectModal) return;
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setShowNewProjectModal(false);
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [showNewProjectModal]);

  // Fetch filter options (Ministries & Sectors) from backend
  useEffect(() => {
    let isMounted = true;
    api.getMinistries().then((res) => {
      if (isMounted && res && res.length > 0) {
        setMinistries(['All', ...res.map(m => m.name)]);
      }
    });

    api.getSectors().then((res) => {
      if (isMounted && res && res.length > 0) {
        setSectors(['All', ...res.map(s => s.name)]);
      }
    });

    return () => {
      isMounted = false;
    };
  }, []);

  const handleSearchChange = (val: string) => {
    setSearchQuery(val);
    setPage(1);
  };

  const handleSearchTypeChange = (val: 'all' | 'name' | 'id') => {
    setSearchType(val);
    setPage(1);
  };

  const handleMinistryChange = (val: string) => {
    setSelectedMinistry(val);
    setPage(1);
  };

  const handleSectorChange = (val: string) => {
    setSelectedSector(val);
    setPage(1);
  };

  const handleStatusChange = (val: string) => {
    setSelectedStatus(val);
    setPage(1);
  };

  const handleRiskChange = (val: string) => {
    setSelectedRisk(val);
    setPage(1);
  };

  const handleClearFilters = () => {
    setSelectedStatus('All');
    setSelectedRisk('All');
    setSelectedMinistry('All');
    setSelectedSector('All');
    setSearchQuery('');
    setSearchType('all');
    setPage(1);
  };

  // Fetch paginated & filtered projects from backend
  useEffect(() => {
    let isMounted = true;
    setLoading(true);
    setError(false);

    api.getProjects(
      page, 
      pageSize, 
      searchQuery, 
      undefined, 
      undefined, 
      selectedStatus !== 'All' ? selectedStatus : undefined,
      selectedMinistry !== 'All' ? selectedMinistry : undefined,
      selectedSector !== 'All' ? selectedSector : undefined,
      selectedRisk !== 'All' ? selectedRisk : undefined,
      searchType,
      activeCategory
    )
      .then((res) => {
        if (!isMounted) return;
        setProjectsList(res.items);
        setTotalProjects(res.total);
        setLoading(false);
      })
      .catch(() => {
        if (isMounted) {
          setError(true);
          setLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [page, searchQuery, searchType, selectedMinistry, selectedSector, selectedStatus, selectedRisk, activeCategory]);

  const filteredProjects = projectsList;

  const getStatusBadge = (status: Project['scheduleStatus'] | string, project?: Project) => {
    if (activeCategory === 'COMPLETED' || project?.projectStatus === 'COMPLETED' || project?.isCompleted) {
      return (
        <span className="status-badge-pill status-completed">
          <CheckCircle2 size={12} className="status-badge-icon" />
          COMPLETED
        </span>
      );
    }
    if (activeCategory === 'INACTIVE' || project?.projectStatus === 'INACTIVE') {
      return (
        <span className="status-badge-pill status-inactive">
          <PauseCircle size={12} className="status-badge-icon" />
          INACTIVE / STOPPED
        </span>
      );
    }
    const dispStatus = project ? getProjectDisplayStatus(project) : getProjectDisplayStatus({ scheduleStatus: status });
    if (dispStatus === 'CRITICAL') {
      return <StatusIndicator kind="critical" label="CRITICAL" className="status-badge-pill status-critical" />;
    }
    if (dispStatus === 'DELAYED') {
      return <StatusIndicator kind="delayed" label="DELAYED" className="status-badge-pill status-delayed" />;
    }
    if (dispStatus === 'IN REVIEW') {
      return <StatusIndicator kind="medium" label="IN REVIEW" className="status-badge-pill status-in-review" />;
    }
    return <StatusIndicator kind="on-track" label="ON TRACK" className="status-badge-pill status-on-track" />;
  };

  const totalPages = Math.ceil(totalProjects / pageSize) || 1;

  return (
    <div className="project-portfolio-page">
      {/* Top Header Controls */}
      <div className="portfolio-top-bar">
        <div className="portfolio-title-section">
          <h1 className="portfolio-main-title">Project Portfolio</h1>
          <span className="portfolio-total-badge">{totalProjects} Projects</span>
        </div>
        <div className="portfolio-action-buttons">
          <button className="portfolio-btn btn-export" onClick={() => api.exportActionPlan()}>
            <Download size={15} />
            <span>Export View</span>
          </button>
        </div>
      </div>

      {/* Top Lifecycle Segregation Selector */}
      <div className="portfolio-lifecycle-segregation-bar">
        <div className="portfolio-lifecycle-tabs" role="tablist" aria-label="Project Status Segregation">
          <button
            type="button"
            role="tab"
            aria-selected={activeCategory === 'ONGOING'}
            className={`lifecycle-tab-btn ${activeCategory === 'ONGOING' ? 'active-tab tab-ongoing' : ''}`}
            onClick={() => handleCategoryChange('ONGOING')}
          >
            <Activity size={16} className="tab-icon" />
            <span className="tab-text">Ongoing Projects</span>
            <span className="tab-badge">{statusCounts.ongoing.toLocaleString()}</span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={activeCategory === 'COMPLETED'}
            className={`lifecycle-tab-btn ${activeCategory === 'COMPLETED' ? 'active-tab tab-completed' : ''}`}
            onClick={() => handleCategoryChange('COMPLETED')}
          >
            <CheckCircle2 size={16} className="tab-icon" />
            <span className="tab-text">Completed Projects</span>
            <span className="tab-badge">{statusCounts.completed.toLocaleString()}</span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={activeCategory === 'INACTIVE'}
            className={`lifecycle-tab-btn ${activeCategory === 'INACTIVE' ? 'active-tab tab-inactive' : ''}`}
            onClick={() => handleCategoryChange('INACTIVE')}
          >
            <PauseCircle size={16} className="tab-icon" />
            <span className="tab-text">Inactive / Stopped Projects</span>
            <span className="tab-badge">{statusCounts.inactive.toLocaleString()}</span>
          </button>
        </div>
      </div>

      {/* Filter and Search Bar Section */}
      <div className="portfolio-filters-card">
        <div className="portfolio-search-bar-row">
          <div className="portfolio-search-type-wrapper">
            <select
              value={searchType}
              onChange={(e) => handleSearchTypeChange(e.target.value as 'all' | 'name' | 'id')}
              className="portfolio-search-type-select"
              aria-label="Search filter criteria"
            >
              <option value="all">All Fields</option>
              <option value="name">Project Name</option>
              <option value="id">Project ID</option>
            </select>
            <ChevronDown size={14} className="search-type-chevron" />
          </div>

          <div className="portfolio-search-input-wrapper">
            <Search size={16} className="search-icon" />
            <input
              type="text"
              placeholder={
                searchType === 'id'
                  ? 'Search by Project ID or OCMS Code (e.g., 020100044)...'
                  : searchType === 'name'
                  ? 'Search by Project Name...'
                  : 'Search projects by name, ID, agency or location...'
              }
              value={searchQuery}
              onChange={(e) => handleSearchChange(e.target.value)}
              className="portfolio-search-input"
              autoComplete="off"
            />
            {searchQuery && (
              <button
                type="button"
                className="portfolio-search-clear-btn"
                onClick={() => handleSearchChange('')}
                title="Clear search"
                aria-label="Clear search"
              >
                <X size={14} />
              </button>
            )}
          </div>
        </div>

        <div className="portfolio-dropdowns-group">
          <div className="portfolio-filter-select-wrapper">
            <SlidersHorizontal size={14} className="filter-select-icon" />
            <select
              value={selectedMinistry}
              onChange={(e) => handleMinistryChange(e.target.value)}
              className="portfolio-filter-select"
            >
              {ministries.map((m, idx) => (
                <option key={idx} value={m}>
                  {m === 'All' ? 'All Ministries' : m}
                </option>
              ))}
            </select>
          </div>

          <div className="portfolio-filter-select-wrapper">
            <select
              value={selectedSector}
              onChange={(e) => handleSectorChange(e.target.value)}
              className="portfolio-filter-select"
            >
              {sectors.map((s, idx) => (
                <option key={idx} value={s}>
                  {s === 'All' ? 'All Sectors' : s}
                </option>
              ))}
            </select>
          </div>

          <div className="portfolio-filter-select-wrapper">
            <select
              value={selectedStatus}
              onChange={(e) => handleStatusChange(e.target.value)}
              className="portfolio-filter-select"
            >
              <option value="All">All Schedule Statuses</option>
              <option value="ON TRACK">On Track</option>
              <option value="Needs Attention">Needs Attention</option>
              <option value="DELAYED">Delayed</option>
              <option value="High Risk">High Risk</option>
              <option value="CRITICAL">Critical Delay</option>
            </select>
          </div>

          <div className="portfolio-filter-select-wrapper">
            <select
              value={selectedRisk}
              onChange={(e) => handleRiskChange(e.target.value)}
              className="portfolio-filter-select"
            >
              <option value="All">All Risk Levels</option>
              <option value="Critical">Critical Risk</option>
              <option value="High">High Risk</option>
              <option value="Medium">Medium Risk</option>
              <option value="Low">Low Risk</option>
            </select>
          </div>
        </div>

        {(selectedStatus !== 'All' || selectedRisk !== 'All' || selectedMinistry !== 'All' || selectedSector !== 'All' || searchQuery || searchType !== 'all') && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '12px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '12px', color: '#64748B', fontWeight: 600 }}>Active Filters:</span>
            {searchQuery && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', background: '#F1F5F9', color: '#1E293B', padding: '3px 8px', borderRadius: '4px', fontSize: '12px', fontWeight: 600 }}>
                {searchType === 'id' ? 'ID: ' : searchType === 'name' ? 'Name: ' : 'Search: '} "{searchQuery}"
                <X size={12} style={{ cursor: 'pointer' }} onClick={() => handleSearchChange('')} />
              </span>
            )}
            {searchType !== 'all' && !searchQuery && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', background: '#EFF6FF', color: '#2563EB', padding: '3px 8px', borderRadius: '4px', fontSize: '12px', fontWeight: 600 }}>
                Filter: {searchType === 'id' ? 'By Project ID' : 'By Project Name'}
                <X size={12} style={{ cursor: 'pointer' }} onClick={() => handleSearchTypeChange('all')} />
              </span>
            )}
            {selectedStatus !== 'All' && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', background: '#EFF6FF', color: '#1D4ED8', padding: '3px 8px', borderRadius: '4px', fontSize: '12px', fontWeight: 600 }}>
                Status: {selectedStatus}
                <X size={12} style={{ cursor: 'pointer' }} onClick={() => handleStatusChange('All')} />
              </span>
            )}
            {selectedRisk !== 'All' && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', background: '#FEF2F2', color: '#B91C1C', padding: '3px 8px', borderRadius: '4px', fontSize: '12px', fontWeight: 600 }}>
                Risk: {selectedRisk}
                <X size={12} style={{ cursor: 'pointer' }} onClick={() => handleRiskChange('All')} />
              </span>
            )}
            {selectedMinistry !== 'All' && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', background: '#F8FAFC', color: '#334155', padding: '3px 8px', borderRadius: '4px', fontSize: '12px' }}>
                Ministry: {selectedMinistry}
                <X size={12} style={{ cursor: 'pointer' }} onClick={() => handleMinistryChange('All')} />
              </span>
            )}
            {selectedSector !== 'All' && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', background: '#F8FAFC', color: '#334155', padding: '3px 8px', borderRadius: '4px', fontSize: '12px' }}>
                Sector: {selectedSector}
                <X size={12} style={{ cursor: 'pointer' }} onClick={() => handleSectorChange('All')} />
              </span>
            )}
            <button
              onClick={handleClearFilters}
              style={{ background: 'none', border: 'none', color: '#64748B', fontSize: '12px', textDecoration: 'underline', cursor: 'pointer', padding: '2px 6px' }}
            >
              Reset all
            </button>
          </div>
        )}
      </div>

      {/* Table Card Section */}
      <div className="portfolio-table-card">
        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '300px', gap: '16px' }}>
            <div style={{ width: '36px', height: '36px', border: '3px solid #E2E8F0', borderTop: '3px solid #2563EB', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
            <span style={{ color: '#64748B', fontSize: '14px' }}>Loading projects from database...</span>
          </div>
        ) : error ? (
          <div style={{ padding: '40px', textAlign: 'center', color: '#DC2626' }}>
            Failed to load projects. Please ensure backend is running.
          </div>
        ) : (
          <div className="portfolio-table-responsive-container">
            <table className="portfolio-custom-table">
              <thead>
                <tr>
                  <th className="th-project-id">PROJECT ID</th>
                  <th className="th-project-name">PROJECT NAME</th>
                  <th className="th-agency">AGENCY</th>
                  <th className="th-location">STATE</th>
                  <th className="th-cost-approved">APPROVED</th>
                  <th className="th-cost-revised">REVISED</th>
                  <th className="th-cost-overrun">OVERRUN</th>
                  <th className="th-physical-progress">PROGRESS</th>
                  <th className="th-schedule-status">STATUS</th>
                  <th className="th-actions">ACTION</th>
                </tr>
              </thead>
              <tbody>
                {filteredProjects.length === 0 ? (
                  <tr>
                    <td colSpan={10} style={{ textAlign: 'center', padding: '40px', color: '#64748B' }}>
                      {activeCategory === 'ONGOING'
                        ? 'No ongoing infrastructure projects found matching the criteria.'
                        : activeCategory === 'COMPLETED'
                        ? 'No completed infrastructure projects found matching the criteria.'
                        : 'No inactive / stopped infrastructure projects found matching the criteria.'}
                    </td>
                  </tr>
                ) : (
                  filteredProjects.map((project) => (
                    <tr 
                      key={project.id} 
                      className="portfolio-table-row"
                      onClick={() => onSelectProject(project.id)}
                      tabIndex={0}
                      aria-label={`Open project ${project.name}`}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault();
                          onSelectProject(project.id);
                        }
                      }}
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
                        <div className="project-sub-meta">{project.sector} • {project.ministry}</div>
                      </td>
                      <td className="td-agency">{project.agency}</td>
                      <td className="td-location">{project.location}</td>
                      <td className="td-cost-approved">{project.costApproved}</td>
                      <td className="td-cost-revised">{project.costRevised}</td>
                      <td className="td-cost-overrun" style={{ fontWeight: 700, color: project.costOverrunPct.includes('-') ? '#16A34A' : '#DC2626' }}>
                        {project.costOverrunPct}
                      </td>
                      <td className="td-physical-progress">
                        <div className="progress-cell-group">
                          <div className="progress-bar-track">
                            <div 
                              className="progress-bar-fill"
                              style={{ width: `${project.progressPhysical}%` }}
                            />
                          </div>
                          <span className="progress-text-pct">{project.progressPhysical}%</span>
                        </div>
                      </td>
                      <td className="td-schedule-status">
                        {getStatusBadge(project.scheduleStatus, project)}
                      </td>
                      <td className="td-actions" onClick={(e) => e.stopPropagation()}>
                        <div className="portfolio-actions-group">
                          <button 
                            className="view-project-details-btn action-btn-details"
                            onClick={() => onSelectProject(project.id)}
                            title="View project details"
                          >
                            View Details
                          </button>
                          {onTakeAction && (
                            <button
                              className="view-project-details-btn action-btn-take-action"
                              onClick={() => onTakeAction(project.id)}
                              title="Take intervention action"
                            >
                              Take Action
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Section */}
        {totalPages > 1 && (
          <div className="portfolio-pagination-bar">
            <span className="pagination-info">
              Showing {(page - 1) * pageSize + 1} to {Math.min(page * pageSize, totalProjects)} of {totalProjects} projects
            </span>
            <div className="pagination-controls">
              <button 
                className="page-btn" 
                disabled={page <= 1}
                onClick={() => setPage(p => Math.max(1, p - 1))}
                title="Previous Page"
                aria-label="Previous page"
              >
                <ChevronLeft size={16} aria-hidden="true" />
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
                    className={`page-btn ${page === pNum ? 'active' : ''}`}
                    onClick={() => setPage(pNum)}
                    aria-label={`Page ${pNum}`}
                    aria-current={page === pNum ? 'page' : undefined}
                  >
                    {pNum}
                  </button>
                ));
              })()}

              <button 
                className="page-btn" 
                disabled={page >= totalPages}
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                title="Next Page"
                aria-label="Next page"
              >
                <ChevronRight size={16} aria-hidden="true" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* New Project Modal */}
      {showNewProjectModal && (
        <div className="portfolio-modal-backdrop"
          role="presentation"
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.65)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: '20px'
          }}
          onClick={() => setShowNewProjectModal(false)}
        >
          <div className="portfolio-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="new-project-modal-title"
            style={{
              backgroundColor: '#FFFFFF',
              borderRadius: '16px',
              maxWidth: '550px',
              width: '100%',
              padding: '24px',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
              position: 'relative'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '1px solid #E2E8F0', paddingBottom: '12px' }}>
              <h2 id="new-project-modal-title" style={{ fontSize: '18px', fontWeight: 800, color: 'var(--navy-dark)', margin: 0 }}>
                Onboard New Infrastructure Project
              </h2>
              <button 
                onClick={() => setShowNewProjectModal(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px', color: '#64748B' }}
                aria-label="Close new project dialog"
              >
                <X size={20} aria-hidden="true" />
              </button>
            </div>

            <p style={{ fontSize: '13px', color: '#64748B', marginBottom: '16px' }}>
              Projects onboarded here are synchronized to PostgreSQL and immediately become available for XGBoost Risk Assessment and SHAP Explainability.
            </p>

            {submitError && (
              <div style={{ padding: '8px 12px', background: '#FEE2E2', border: '1px solid #F87171', borderRadius: '6px', color: '#B91C1C', fontSize: '12px', marginBottom: '12px' }}>
                {submitError}
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label style={{ fontSize: '12px', fontWeight: 700, color: '#334155', display: 'block', marginBottom: '4px' }}>Project Name *</label>
                <input 
                  type="text" 
                  placeholder="e.g. National Corridor Expansion Phase IV"
                  value={newProjectName}
                  onChange={(e) => setNewProjectName(e.target.value)}
                  disabled={isSubmitting}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '13px' }}
                />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 700, color: '#334155', display: 'block', marginBottom: '4px' }}>Project Code</label>
                  <input 
                    type="text" 
                    placeholder="e.g. PRJ-9901"
                    value={newProjectCode}
                    onChange={(e) => setNewProjectCode(e.target.value)}
                    disabled={isSubmitting}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '13px' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 700, color: '#334155', display: 'block', marginBottom: '4px' }}>Approved Cost (₹ Cr)</label>
                  <input 
                    type="number" 
                    placeholder="e.g. 1250"
                    value={newProjectCost}
                    onChange={(e) => setNewProjectCost(e.target.value)}
                    disabled={isSubmitting}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '13px' }}
                  />
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px', borderTop: '1px solid #E2E8F0', paddingTop: '16px' }}>
              <button 
                onClick={() => {
                  setShowNewProjectModal(false);
                  setSubmitError(null);
                }}
                disabled={isSubmitting}
                style={{ padding: '8px 16px', borderRadius: '6px', border: '1px solid #CBD5E1', background: '#F8FAFC', color: '#475569', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}
              >
                Cancel
              </button>
              <button 
                onClick={handleOnboardProject}
                disabled={isSubmitting}
                style={{ padding: '8px 16px', borderRadius: '6px', border: 'none', background: isSubmitting ? '#93C5FD' : '#2563EB', color: '#FFFFFF', fontSize: '13px', fontWeight: 700, cursor: isSubmitting ? 'not-allowed' : 'pointer' }}
              >
                {isSubmitting ? 'Onboarding...' : 'Onboard Project'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
