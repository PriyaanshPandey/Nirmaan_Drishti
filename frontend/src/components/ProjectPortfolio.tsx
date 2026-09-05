import React, { useState, useEffect } from 'react';
import { Download, Plus, Search, SlidersHorizontal, ChevronLeft, ChevronRight, X } from 'lucide-react';
import type { Project } from '../data/projectsData';
import { api } from '../services/api';
import './ProjectPortfolio.css';

interface ProjectPortfolioProps {
  onSelectProject: (projectId: string) => void;
}

export const ProjectPortfolio: React.FC<ProjectPortfolioProps> = ({ onSelectProject }) => {
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
      selectedSector !== 'All' ? selectedSector : undefined
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

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMinistry, setSelectedMinistry] = useState('All');
  const [selectedSector, setSelectedSector] = useState('All');
  const [selectedStatus, setSelectedStatus] = useState('All');

  const [ministries, setMinistries] = useState<string[]>(['All']);
  const [sectors, setSectors] = useState<string[]>(['All']);

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
      selectedSector !== 'All' ? selectedSector : undefined
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
  }, [page, searchQuery, selectedMinistry, selectedSector, selectedStatus]);

  const filteredProjects = projectsList;

  const getStatusBadge = (status: Project['scheduleStatus'] | string) => {
    const stat = (status || '').toUpperCase();
    if (stat.includes('CRIT') || stat.includes('OVERDUE')) {
      return <span className="status-badge-pill status-critical">CRITICAL</span>;
    }
    if (stat.includes('DELAY') || stat.includes('EXTEND')) {
      return <span className="status-badge-pill status-delayed">DELAYED</span>;
    }
    return <span className="status-badge-pill status-on-track">ON TRACK</span>;
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
          <button className="portfolio-btn btn-add-project" onClick={() => setShowNewProjectModal(true)}>
            <Plus size={15} />
            <span>New Project</span>
          </button>
        </div>
      </div>

      {/* Filter and Search Bar Section */}
      <div className="portfolio-filters-card">
        <div className="portfolio-search-input-wrapper">
          <Search size={16} className="search-icon" />
          <input
            type="text"
            placeholder="Search projects by name, ID, agency or location..."
            value={searchQuery}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="portfolio-search-input"
          />
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
              <option value="DELAYED">Delayed</option>
              <option value="CRITICAL">Critical</option>
            </select>
          </div>
        </div>
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
                    <td colSpan={10} style={{ textAlign: 'center', padding: '40px', color: '#94A3B8' }}>
                      No infrastructure projects found matching the criteria.
                    </td>
                  </tr>
                ) : (
                  filteredProjects.map((project) => (
                    <tr 
                      key={project.id} 
                      className="portfolio-table-row"
                      onClick={() => onSelectProject(project.id)}
                    >
                      <td className="td-project-id">{project.id}</td>
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
                        {getStatusBadge(project.scheduleStatus)}
                      </td>
                      <td className="td-actions" onClick={(e) => e.stopPropagation()}>
                        <button 
                          className="view-project-details-btn"
                          onClick={() => onSelectProject(project.id)}
                        >
                          View Details
                        </button>
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
                    className={`page-btn ${page === pNum ? 'active' : ''}`}
                    onClick={() => setPage(pNum)}
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
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* New Project Modal */}
      {showNewProjectModal && (
        <div 
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
          <div 
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
              <h2 style={{ fontSize: '18px', fontWeight: 800, color: 'var(--navy-dark)', margin: 0 }}>
                Onboard New Infrastructure Project
              </h2>
              <button 
                onClick={() => setShowNewProjectModal(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px', color: '#64748B' }}
              >
                <X size={20} />
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
