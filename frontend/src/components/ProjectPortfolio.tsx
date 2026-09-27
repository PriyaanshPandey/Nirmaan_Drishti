import React, { useState, useEffect } from 'react';
import { Search, SlidersHorizontal, ChevronLeft, ChevronRight, X, ChevronDown, Activity, CheckCircle2, PauseCircle } from 'lucide-react';
import type { Project } from '../data/projectsData';
import { getProjectRiskCategory } from '../utils/projectStatus';
import { api } from '../services/api';
import './ProjectPortfolio.css';
import { StatusIndicator } from './StatusIndicator';
import { InfoButton } from './ExplainabilityInfo';
import { useLanguage } from '../context/LanguageContext';

export type ProjectCategoryTab = 'ONGOING' | 'COMPLETED' | 'INACTIVE';

interface ProjectPortfolioProps {
  onSelectProject: (projectId: string) => void;
  onTakeAction?: (projectId: string) => void;
  initialStatus?: string;
  statusFilterNonce?: number;
  initialRisk?: string;
  riskFilterNonce?: number;
  initialState?: string;
  stateFilterNonce?: number;
  initialSector?: string;
  sectorFilterNonce?: number;
  initialMinistry?: string;
  ministryFilterNonce?: number;
  initialSearch?: string;
  searchFilterNonce?: number;
  targetMinistry?: string;
  targetAgency?: string;
  isPublic?: boolean;
}

export const ProjectPortfolio: React.FC<ProjectPortfolioProps> = ({ 
  onSelectProject, 
  onTakeAction,
  initialStatus, 
  statusFilterNonce,
  initialRisk,
  riskFilterNonce,
  initialState,
  stateFilterNonce,
  initialSector,
  sectorFilterNonce,
  initialMinistry,
  ministryFilterNonce,
  initialSearch,
  searchFilterNonce,
  targetMinistry,
  targetAgency,
  isPublic: _isPublic
}) => {
  const { t } = useLanguage();
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

  const [searchQuery, setSearchQuery] = useState(initialSearch || '');
  const [searchType, setSearchType] = useState<'all' | 'name' | 'id'>('all');
  const [selectedMinistry, setSelectedMinistry] = useState(initialMinistry || 'All');
  const [selectedSector, setSelectedSector] = useState(initialSector || 'All');
  const [selectedState, setSelectedState] = useState(initialState || 'All');
  const [selectedStatus, setSelectedStatus] = useState(initialStatus || 'All');
  const [selectedRisk, setSelectedRisk] = useState(initialRisk || 'All');
  const [activeCategory, setActiveCategory] = useState<ProjectCategoryTab>('ONGOING');
  const [statusCounts, setStatusCounts] = useState<{ ongoing: number; inactive: number; completed: number; total: number }>({
    ongoing: 1379,
    inactive: 2328,
    completed: 1442,
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
      activeCategory,
      selectedState !== 'All' ? selectedState : undefined
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

  useEffect(() => {
    if (initialState !== undefined) {
      setSelectedState(initialState || 'All');
      setPage(1);
    }
  }, [initialState, stateFilterNonce]);

  useEffect(() => {
    if (initialSector !== undefined) {
      setSelectedSector(initialSector || 'All');
      setPage(1);
    }
  }, [initialSector, sectorFilterNonce]);

  useEffect(() => {
    if (initialMinistry !== undefined) {
      setSelectedMinistry(initialMinistry || 'All');
      setPage(1);
    }
  }, [initialMinistry, ministryFilterNonce]);

  useEffect(() => {
    if (initialSearch !== undefined) {
      setSearchQuery(initialSearch || '');
      setPage(1);
    }
  }, [initialSearch, searchFilterNonce]);

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

  const indianStates = [
    'All', 'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh',
    'Delhi', 'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jammu & Kashmir',
    'Jharkhand', 'Karnataka', 'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Manipur',
    'Meghalaya', 'Mizoram', 'Nagaland', 'Odisha', 'Punjab', 'Rajasthan', 'Sikkim',
    'Tamil Nadu', 'Telangana', 'Tripura', 'Uttar Pradesh', 'Uttarakhand', 'West Bengal'
  ];

  const handleMinistryChange = (val: string) => {
    setSelectedMinistry(val);
    setPage(1);
  };

  const handleSectorChange = (val: string) => {
    setSelectedSector(val);
    setPage(1);
  };

  const handleStateChange = (val: string) => {
    setSelectedState(val);
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
    setSelectedState('All');
    setSearchQuery('');
    setSearchType('all');
    setPage(1);
  };

  // Fetch paginated & filtered projects from backend
  useEffect(() => {
    let isMounted = true;
    setLoading(true);
    setError(false);

    // Apply role-based ministry/agency filter on top of user selection
    const effectiveMinistry = targetMinistry || (selectedMinistry !== 'All' ? selectedMinistry : undefined);
    const effectiveAgency = targetAgency || undefined;

    api.getProjects(
      page, 
      pageSize, 
      searchQuery, 
      undefined, 
      undefined, 
      selectedStatus !== 'All' ? selectedStatus : undefined,
      effectiveMinistry,
      selectedSector !== 'All' ? selectedSector : undefined,
      selectedRisk !== 'All' ? selectedRisk : undefined,
      searchType,
      activeCategory,
      selectedState !== 'All' ? selectedState : undefined,
      effectiveAgency
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
  }, [page, searchQuery, searchType, selectedMinistry, selectedSector, selectedState, selectedStatus, selectedRisk, activeCategory]);

  const filteredProjects = projectsList;

  const getStatusBadge = (_status: Project['scheduleStatus'] | string, project?: Project) => {
    // Authoritative check based strictly on project status: ongoing | inactive | completed
    const projectCat = project?.status
      ? project.status
      : project?.projectStatus === 'COMPLETED' || project?.isCompleted ? 'completed'
      : project?.projectStatus === 'INACTIVE' || project?.projectStatus === 'STOPPED' ? 'inactive'
      : 'ongoing';

    if (projectCat === 'completed') {
      return (
        <span className="status-badge-pill status-completed">
          <CheckCircle2 size={12} className="status-badge-icon" />
          COMPLETED
        </span>
      );
    }
    if (projectCat === 'inactive') {
      return (
        <span className="status-badge-pill status-inactive">
          <PauseCircle size={12} className="status-badge-icon" />
          INACTIVE
        </span>
      );
    }
    const riskCat = project ? getProjectRiskCategory(project) : 'Low';

    if (riskCat === 'Critical') {
      return <StatusIndicator kind="critical" label="CRITICAL RISK" className="status-badge-pill status-critical" />;
    }
    if (riskCat === 'High') {
      return <StatusIndicator kind="delayed" label="HIGH RISK" className="status-badge-pill status-delayed" />;
    }
    if (riskCat === 'Medium') {
      return <StatusIndicator kind="medium" label="MEDIUM RISK" className="status-badge-pill status-in-review" />;
    }
    return <StatusIndicator kind="on-track" label="LOW RISK" className="status-badge-pill status-on-track" />;
  };

  const totalPages = Math.ceil(totalProjects / pageSize) || 1;

  const categoryTotal =
    activeCategory === 'ONGOING'
      ? statusCounts.ongoing
      : activeCategory === 'INACTIVE'
      ? statusCounts.inactive
      : statusCounts.completed;

  const isFiltered = Boolean(
    searchQuery.trim() ||
    selectedMinistry !== 'All' ||
    selectedSector !== 'All' ||
    selectedStatus !== 'All' ||
    selectedRisk !== 'All'
  );

  return (
    <div className="project-portfolio-page">
      {/* Top Header Controls */}
      <div className="portfolio-top-bar">
        <div className="portfolio-title-section">
          <h1 className="portfolio-main-title">{t('nav_projects', 'Project Portfolio')}</h1>
        </div>
        <div className="portfolio-header-actions">
          {/* Export View removed per user request */}
        </div>
      </div>

      {/* Top Lifecycle Segregation Selector: Mutually Exclusive Categories */}
      <div className="portfolio-lifecycle-segregation-bar">
        <div className="portfolio-lifecycle-tabs" role="tablist" aria-label="Project Status Segregation">
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <button
              type="button"
              role="tab"
              aria-selected={activeCategory === 'ONGOING'}
              className={`lifecycle-tab-btn ${activeCategory === 'ONGOING' ? 'active-tab tab-ongoing' : ''}`}
              onClick={() => handleCategoryChange('ONGOING')}
            >
              <Activity size={16} className="tab-icon" />
              <span className="tab-text">{t('status_ongoing', 'Ongoing Active')}</span>
              <span className="tab-badge">{statusCounts.ongoing.toLocaleString()}</span>
            </button>
            <InfoButton
              title="Ongoing Active Projects"
              summary="Currently active infrastructure projects under ongoing execution and monthly PAIMANA monitoring."
              theme="light"
              size="sm"
            />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <button
              type="button"
              role="tab"
              aria-selected={activeCategory === 'INACTIVE'}
              className={`lifecycle-tab-btn ${activeCategory === 'INACTIVE' ? 'active-tab tab-inactive' : ''}`}
              onClick={() => handleCategoryChange('INACTIVE')}
            >
              <PauseCircle size={16} className="tab-icon" />
              <span className="tab-text">{t('status_inactive', 'Ongoing Inactive')}</span>
              <span className="tab-badge">{statusCounts.inactive.toLocaleString()}</span>
            </button>
            <InfoButton
              title="Ongoing Inactive Projects"
              summary="Inactive, stalled, shelved, or non-active projects monitored under PAIMANA. Retained in the database to train machine learning models on failure modes and prevent survival bias."
              theme="light"
              size="sm"
            />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <button
              type="button"
              role="tab"
              aria-selected={activeCategory === 'COMPLETED'}
              className={`lifecycle-tab-btn ${activeCategory === 'COMPLETED' ? 'active-tab tab-completed' : ''}`}
              onClick={() => handleCategoryChange('COMPLETED')}
            >
              <CheckCircle2 size={16} className="tab-icon" />
              <span className="tab-text">{t('status_completed', 'Completed')}</span>
              <span className="tab-badge">{statusCounts.completed.toLocaleString()}</span>
            </button>
            <InfoButton
              title="Completed Projects"
              summary="Infrastructure projects that have achieved full commissioning and completion."
              theme="light"
              size="sm"
            />
          </div>
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
              <option value="all">{t('filter_all', 'All Fields')}</option>
              <option value="name">{t('search_by_name', 'Project Name')}</option>
              <option value="id">{t('search_by_id', 'Project ID')}</option>
            </select>
            <ChevronDown size={14} className="search-type-chevron" />
          </div>

          <div className="portfolio-search-input-wrapper">
            <Search size={16} className="search-icon" />
            <input
              type="text"
              placeholder={
                searchType === 'id'
                  ? t('search_placeholder_id', 'Search by Project ID or OCMS Code (e.g., 020100044)...')
                  : searchType === 'name'
                  ? t('search_placeholder_name', 'Search by Project Name...')
                  : t('search_placeholder_all', 'Search projects by name, ID, agency or location...')
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
                  {m === 'All' ? t('filter_all_ministries', 'All Ministries') : m}
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
                  {s === 'All' ? t('filter_all_sectors', 'All Infrastructure Sectors') : s}
                </option>
              ))}
            </select>
          </div>

          <div className="portfolio-filter-select-wrapper">
            <select
              value={selectedState}
              onChange={(e) => handleStateChange(e.target.value)}
              className="portfolio-filter-select"
            >
              {indianStates.map((st, idx) => (
                <option key={idx} value={st}>
                  {st === 'All' ? t('filter_all_states', 'All States / UTs') : st}
                </option>
              ))}
            </select>
          </div>

          <div className="portfolio-filter-select-wrapper" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <select
              value={selectedRisk}
              onChange={(e) => handleRiskChange(e.target.value)}
              className="portfolio-filter-select"
            >
              <option value="All">{t('filter_all_risk', 'All Risk Levels')}</option>
              <option value="Critical">🔴 {t('status_critical', 'Critical Risk')} — Score ≥ 75</option>
              <option value="High">🟠 {t('status_high_risk', 'High Risk')} — Score 60–74</option>
              <option value="Medium">🟡 {t('status_medium_risk', 'Medium Risk')} — Score 35–59</option>
              <option value="Low">🟢 {t('status_low_risk', 'Low Risk')} — Score &lt; 35</option>
            </select>

            <InfoButton
              title="Risk-Based Project Classification"
              summary="Projects in India's PAIMANA system are classified into 4 risk tiers based on AI-scored cost and schedule indicators. This replaces subjective status tags with objective, data-driven monitoring."
              dataSummary={{
                items: [
                  { label: '🔴 Critical Risk (Score ≥ 75)', value: 'Cost drift >20% OR delay >12 months — Needs immediate MoSPI escalation' },
                  { label: '🟠 High Risk (Score 60–74)', value: 'Significant cost or schedule pressure — Proactive intervention required' },
                  { label: '🟡 Medium Risk (Score 35–59)', value: 'Delay 3–12 months or milestone lag — Monitor closely' },
                  { label: '🟢 Low Risk (Score < 35)', value: 'On track, within budget and schedule parameters' }
                ],
                insight: 'Risk scores are recomputed from MIS data each reporting cycle. Officers should prioritise Critical and High risk projects for field visits and directive action.'
              }}
              theme="light"
              size="sm"
            />
          </div>
        </div>

        {(selectedRisk !== 'All' || selectedMinistry !== 'All' || selectedSector !== 'All' || selectedState !== 'All' || searchQuery || searchType !== 'all') && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '12px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '12px', color: '#64748B', fontWeight: 600 }}>{t('filter_active', 'Active Filters')}:</span>
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
              {t('clear_filters', 'Reset all')}
            </button>
          </div>
        )}
      </div>

      {/* Table Card Section */}
      <div className="portfolio-table-card">
        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '300px', gap: '16px' }}>
            <div style={{ width: '36px', height: '36px', border: '3px solid #E2E8F0', borderTop: '3px solid #2563EB', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
            <span style={{ color: '#64748B', fontSize: '14px' }}>{t('loading', 'Loading projects from database...')}</span>
          </div>
        ) : error ? (
          <div style={{ padding: '40px', textAlign: 'center', color: '#DC2626' }}>
            {t('error', 'Failed to load projects. Please ensure backend is running.')}
          </div>
        ) : (
          <div className="portfolio-table-responsive-container">
            <table className="portfolio-custom-table">
              <thead>
                <tr>
                  <th className="th-project-id">{t('col_project_id', 'PROJECT ID')}</th>
                  <th className="th-project-name">{t('col_project_name', 'PROJECT NAME')}</th>
                  <th className="th-agency">{t('col_agency', 'AGENCY')}</th>
                  <th className="th-location">{t('col_location', 'STATE')}</th>
                  <th className="th-cost-approved">{t('col_cost_approved', 'APPROVED')}</th>
                  <th className="th-cost-revised">{t('col_cost_revised', 'REVISED')}</th>
                  <th className="th-cost-overrun">{t('col_cost_overrun', 'OVERRUN')}</th>
                  <th className="th-physical-progress">{t('col_progress', 'PROGRESS')}</th>
                  <th className="th-schedule-status">{t('col_risk', 'RISK')}</th>
                  {!_isPublic && <th className="th-actions">{t('col_action', 'ACTION')}</th>}
                </tr>
              </thead>
              <tbody>
                {filteredProjects.length === 0 ? (
                  <tr>
                    <td colSpan={10} style={{ textAlign: 'center', padding: '40px', color: '#64748B' }}>
                      {activeCategory === 'ONGOING'
                        ? t('no_ongoing_projects', 'No ongoing infrastructure projects found matching the criteria.')
                        : activeCategory === 'INACTIVE'
                        ? t('no_inactive_projects', 'No inactive infrastructure projects found matching the criteria.')
                        : t('no_completed_projects', 'No completed infrastructure projects found matching the criteria.')}
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
                      {!_isPublic && (
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
                      )}
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
              Showing {(page - 1) * pageSize + 1} to {Math.min(page * pageSize, totalProjects)} of {totalProjects.toLocaleString()} projects
              {isFiltered && ` (filtered from ${categoryTotal.toLocaleString()} ${activeCategory.toLowerCase()} projects)`}
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
