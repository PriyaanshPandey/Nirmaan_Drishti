import React, { useState } from 'react';
import { Download, Plus, Search, SlidersHorizontal, ChevronLeft, ChevronRight } from 'lucide-react';
import { projectsData } from '../data/projectsData';
import type { Project } from '../data/projectsData';
import './ProjectPortfolio.css';

interface ProjectPortfolioProps {
  onSelectProject: (projectId: string) => void;
}

export const ProjectPortfolio: React.FC<ProjectPortfolioProps> = ({ onSelectProject }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMinistry, setSelectedMinistry] = useState('All');
  const [selectedSector, setSelectedSector] = useState('All');
  const [selectedStatus, setSelectedStatus] = useState('All');

  // Filters setup
  const ministries = ['All', 'Railways', 'Ministry of Railways'];
  const sectors = ['All', 'Metro Rail', 'High Speed Rail', 'Freight Corridor'];
  const statuses = ['All', 'ON TRACK', 'DELAYED', 'CRITICAL'];

  // Filter projects
  const filteredProjects = projectsData.filter((project) => {
    const matchesSearch =
      project.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      project.location.toLowerCase().includes(searchQuery.toLowerCase()) ||
      project.agency.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesMinistry = selectedMinistry === 'All' || project.ministry === selectedMinistry;
    const matchesSector = selectedSector === 'All' || project.sector === selectedSector;
    const matchesStatus = selectedStatus === 'All' || project.scheduleStatus === selectedStatus;

    return matchesSearch && matchesMinistry && matchesSector && matchesStatus;
  });

  const getStatusBadge = (status: Project['scheduleStatus']) => {
    switch (status) {
      case 'CRITICAL':
        return <span className="portfolio-badge badge-critical-status">CRITICAL</span>;
      case 'DELAYED':
        return <span className="portfolio-badge badge-delayed-status">DELAYED</span>;
      case 'ON TRACK':
        return <span className="portfolio-badge badge-ontrack-status">ON TRACK</span>;
      default:
        return null;
    }
  };

  const getRiskIndicator = (score: number) => {
    let color = '#2F6BF4'; // Low risk
    if (score >= 80) color = '#D62F39'; // Critical risk
    else if (score >= 60) color = '#4A5673'; // Medium/High risk
    
    return (
      <div className="risk-indicator-bar-wrapper">
        <div 
          className="risk-indicator-fill" 
          style={{ width: `${score}%`, backgroundColor: color }}
        ></div>
      </div>
    );
  };

  return (
    <div className="portfolio-container animation-fade-in">
      {/* Portfolio Title & CTA section */}
      <div className="portfolio-header">
        <div>
          <h1 className="portfolio-title">Project Portfolio</h1>
          <p className="portfolio-subtitle">
            Displaying {filteredProjects.length} active infrastructure projects across {ministries.length - 1} ministries.
          </p>
        </div>
        <div className="portfolio-cta-group">
          <button className="export-csv-btn" onClick={() => alert('Exporting Portfolio CSV...')}>
            <Download size={14} />
            <span>Export CSV</span>
          </button>
          <button className="new-project-btn" onClick={() => alert('Add new project...')}>
            <Plus size={14} />
            <span>New Project</span>
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="filter-card">
        <div className="search-box-wrapper">
          <Search size={16} className="search-icon" />
          <input 
            type="text" 
            placeholder="Search projects by name, location, agency..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="search-input"
          />
        </div>

        <div className="filters-row">
          <div className="filter-select-group">
            <div className="select-container">
              <label className="select-label">Ministry</label>
              <select 
                value={selectedMinistry} 
                onChange={(e) => setSelectedMinistry(e.target.value)}
                className="filter-select"
              >
                {ministries.map((m) => (
                  <option key={m} value={m}>{m === 'All' ? 'All Ministries' : m}</option>
                ))}
              </select>
            </div>

            <div className="select-container">
              <label className="select-label">Sector</label>
              <select 
                value={selectedSector} 
                onChange={(e) => setSelectedSector(e.target.value)}
                className="filter-select"
              >
                {sectors.map((s) => (
                  <option key={s} value={s}>{s === 'All' ? 'All Sectors' : s}</option>
                ))}
              </select>
            </div>

            <div className="select-container">
              <label className="select-label">Status</label>
              <select 
                value={selectedStatus} 
                onChange={(e) => setSelectedStatus(e.target.value)}
                className="filter-select"
              >
                {statuses.map((st) => (
                  <option key={st} value={st}>{st === 'All' ? 'All Statuses' : st}</option>
                ))}
              </select>
            </div>
          </div>

          <button className="more-filters-btn" onClick={() => alert('More filters toggled')}>
            <SlidersHorizontal size={14} />
            <span>More Filters</span>
          </button>
        </div>
      </div>

      {/* Projects Table */}
      <div className="table-card">
        <div className="portfolio-table-wrapper">
          <table className="portfolio-table">
            <thead>
              <tr>
                <th style={{ width: '35%' }}>PROJECT NAME</th>
                <th style={{ width: '12%' }}>MINISTRY</th>
                <th style={{ width: '15%' }}>COST (CR)</th>
                <th style={{ width: '13%' }}>PHYSICAL %</th>
                <th style={{ width: '13%' }}>FINANCIAL %</th>
                <th style={{ width: '12%' }}>SCHEDULE</th>
                <th style={{ width: '10%', textAlign: 'center' }}>RISK</th>
              </tr>
            </thead>
            <tbody>
              {filteredProjects.length > 0 ? (
                filteredProjects.map((project) => (
                  <tr 
                    key={project.id} 
                    className="portfolio-row" 
                    onClick={() => onSelectProject(project.id)}
                  >
                    <td>
                      <div className="project-name-primary">{project.name}</div>
                      <div className="project-name-sub">
                        {project.type} • {project.location}
                      </div>
                    </td>
                    <td className="td-ministry-text">{project.ministry}</td>
                    <td>
                      <div className="project-cost-val">{project.costLabel}</div>
                      <div className={`project-cost-sub ${project.costSubtext.includes('▲') || project.costSubtext.includes('+') ? 'cost-alert' : ''}`}>
                        {project.costSubtext}
                      </div>
                    </td>
                    <td>
                      <div className="progress-cell-wrapper">
                        <span className="progress-cell-val">{project.progressPhysical}%</span>
                        <div className="progress-cell-bar-bg">
                          <div 
                            className="progress-cell-bar-fill" 
                            style={{ width: `${project.progressPhysical}%`, backgroundColor: '#090B2E' }}
                          ></div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <div className="progress-cell-wrapper">
                        <span className="progress-cell-val">{project.progressFinancial}%</span>
                        <div className="progress-cell-bar-bg">
                          <div 
                            className="progress-cell-bar-fill" 
                            style={{ width: `${project.progressFinancial}%`, backgroundColor: '#4A5673' }}
                          ></div>
                        </div>
                      </div>
                    </td>
                    <td>{getStatusBadge(project.scheduleStatus)}</td>
                    <td style={{ verticalAlign: 'middle' }}>{getRiskIndicator(project.riskScore)}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} className="table-empty-state">
                    No active infrastructure projects matches your search/filter criteria.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Table Pagination */}
        <div className="portfolio-pagination">
          <div className="pagination-info">
            Showing 1-{filteredProjects.length} of {filteredProjects.length} projects
          </div>
          <div className="pagination-controls">
            <button className="pagination-arrow-btn" disabled>
              <ChevronLeft size={14} />
            </button>
            <button className="pagination-num-btn active">1</button>
            <button className="pagination-num-btn" disabled>2</button>
            <button className="pagination-num-btn" disabled>3</button>
            <button className="pagination-arrow-btn" disabled>
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
