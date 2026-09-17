import React, { useState, useEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
  Search, X, ChevronRight, Building2, MapPin, ArrowRight,
  Home, LayoutDashboard, Database, Sparkles, Layers, ShieldAlert,
  SlidersHorizontal, CornerDownLeft, FileSpreadsheet, ExternalLink
} from 'lucide-react';
import nirmaanEmblem from '../assets/nirmaan_emblem.png';
import { projectsData } from '../data/projectsData';
import './Header.css';

interface HeaderProps {
  activeTab?: string;
  onNavigateTab?: (tab: string) => void;
  onSelectProject?: (projectId: string) => void;
  onFilterStatus?: (status: string) => void;
  currentStatusFilter?: string;
}

interface StatusItem {
  id: string;
  label: string;
  dotColor: string;
  count: number;
  statusCode: string;
}


export const Header: React.FC<HeaderProps> = ({
  activeTab = 'home',
  onNavigateTab,
  onSelectProject,
  onFilterStatus,
  currentStatusFilter = 'All'
}) => {
  const [isSearchOpen, setIsSearchOpen] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedFilterStatus, setSelectedFilterStatus] = useState<string | null>(null);
  const [selectedResultIndex, setSelectedResultIndex] = useState<number>(0);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const cardRef = useRef<HTMLDivElement | null>(null);
  const resultsContainerRef = useRef<HTMLDivElement | null>(null);

  const navItems = [
    { id: 'home', label: 'Home', icon: <Home size={15} /> },
    { id: 'projects', label: 'Projects', icon: <Database size={15} /> },
    { id: 'insights', label: 'AI Insights', icon: <Sparkles size={15} /> },
    { id: 'distribution', label: 'Distribution', icon: <Layers size={15} /> },
    { id: 'action-centre', label: 'Action centre', icon: <ShieldAlert size={15} /> },
    { id: 'extractor', label: 'Extractor', icon: <FileSpreadsheet size={15} /> },
  ];

  // Dynamically compute exact counts from 3,361 master dataset so buttons match results 100%
  const statusItems: StatusItem[] = useMemo(() => {
    let onTrack = 0;
    let inReview = 0;
    let delayed = 0;
    let critical = 0;

    for (const p of projectsData) {
      if (p.scheduleStatus === 'CRITICAL' || p.riskLevel === 'Critical' || (p.riskScore && p.riskScore >= 75)) {
        critical++;
      } else if (p.scheduleStatus === 'DELAYED') {
        delayed++;
      } else if (p.scheduleStatus === 'ON TRACK' && p.progressPhysical > 0 && p.progressPhysical < 100 && ((p.riskScore && p.riskScore >= 25) || p.riskLevel === 'Medium')) {
        inReview++;
      } else {
        onTrack++;
      }
    }

    return [
      { id: 'on-track', label: 'On Track', dotColor: '#16A34A', count: onTrack, statusCode: 'ON TRACK' },
      { id: 'in-review', label: 'In Review', dotColor: '#2563EB', count: inReview, statusCode: 'IN REVIEW' },
      { id: 'delayed', label: 'Delayed', dotColor: '#F59E0B', count: delayed, statusCode: 'DELAYED' },
      { id: 'critical', label: 'Critical', dotColor: '#DC2626', count: critical, statusCode: 'CRITICAL' }
    ];
  }, []);

  // Global hotkey Ctrl+K or Cmd+K or "/" to toggle Spotlight Search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsSearchOpen(prev => !prev);
      } else if (e.key === '/' && !['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) {
        e.preventDefault();
        setIsSearchOpen(true);
      } else if (e.key === 'Escape' && isSearchOpen) {
        setIsSearchOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isSearchOpen]);

  // Click outside card to dismiss modal & lock body scroll
  useEffect(() => {
    if (!isSearchOpen) return;

    // Prevent background scrolling while modal is open
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleMouseDownOutside = (e: MouseEvent) => {
      if (cardRef.current && !cardRef.current.contains(e.target as Node)) {
        setIsSearchOpen(false);
      }
    };

    document.addEventListener('mousedown', handleMouseDownOutside);
    return () => {
      document.body.style.overflow = prevOverflow;
      document.removeEventListener('mousedown', handleMouseDownOutside);
    };
  }, [isSearchOpen]);

  // Autofocus input on open & reset state
  useEffect(() => {
    if (isSearchOpen) {
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 50);
      setSelectedResultIndex(0);
    } else {
      setSearchQuery('');
      setSelectedFilterStatus(null);
    }
  }, [isSearchOpen]);

  // Filter projects for spotlight with query and chip filter
  const searchResults = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();

    return projectsData
      .filter(p => {
        // Status chip filter matching the 4 categories
        if (selectedFilterStatus) {
          if (selectedFilterStatus === 'CRITICAL') {
            const isCrit = p.scheduleStatus === 'CRITICAL' || p.riskLevel === 'Critical' || (p.riskScore && p.riskScore >= 75);
            if (!isCrit) return false;
          } else if (selectedFilterStatus === 'IN REVIEW' || selectedFilterStatus === 'IN PROGRESS') {
            const isInRev = (p.scheduleStatus as string) === 'IN REVIEW' || (p.scheduleStatus as string) === 'IN PROGRESS' || (p.scheduleStatus === 'ON TRACK' && p.progressPhysical > 0 && p.progressPhysical < 100 && ((p.riskScore && p.riskScore >= 25) || p.riskLevel === 'Medium'));
            if (!isInRev) return false;
          } else if (selectedFilterStatus === 'DELAYED') {
            const isDel = p.scheduleStatus === 'DELAYED' && p.riskLevel !== 'Critical' && (!p.riskScore || p.riskScore < 75);
            if (!isDel) return false;
          } else if (selectedFilterStatus === 'ON TRACK') {
            const isOnTrk = p.scheduleStatus === 'ON TRACK' && p.riskLevel !== 'Critical' && (!p.riskScore || p.riskScore < 75) && !(p.progressPhysical > 0 && p.progressPhysical < 100 && ((p.riskScore && p.riskScore >= 25) || p.riskLevel === 'Medium'));
            if (!isOnTrk) return false;
          }
        }

        // Text query match
        if (!q) return true;
        return (
          p.name.toLowerCase().includes(q) ||
          p.id.toLowerCase().includes(q) ||
          p.ministry.toLowerCase().includes(q) ||
          p.sector.toLowerCase().includes(q) ||
          p.location.toLowerCase().includes(q)
        );
      })
      .slice(0, 10);
  }, [searchQuery, selectedFilterStatus]);

  // Scroll active item into view
  useEffect(() => {
    if (!resultsContainerRef.current) return;
    const activeEl = resultsContainerRef.current.querySelector('.spotlight-item.selected') as HTMLElement;
    if (activeEl) {
      activeEl.scrollIntoView({ block: 'nearest' });
    }
  }, [selectedResultIndex]);

  // Handle keyboard navigation inside search modal
  const handleSearchKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedResultIndex(prev => Math.min(prev + 1, searchResults.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedResultIndex(prev => Math.max(prev - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const chosen = searchResults[selectedResultIndex];
      if (chosen) {
        handleChooseProject(chosen.id);
      }
    }
  };

  const handleChooseProject = (projectId: string) => {
    setIsSearchOpen(false);
    if (onSelectProject) {
      onSelectProject(projectId);
    } else if (onNavigateTab) {
      onNavigateTab('projects');
    }
  };

  const handleStatusClick = (item: StatusItem) => {
    if (onFilterStatus) {
      if (activeTab === 'projects' && (currentStatusFilter === item.statusCode || currentStatusFilter?.toUpperCase() === item.statusCode)) {
        onFilterStatus('All');
      } else {
        onFilterStatus(item.statusCode);
      }
    }
    if (onNavigateTab) {
      onNavigateTab('projects');
    }
  };

  const handleBrandClick = () => {
    if (onNavigateTab) {
      onNavigateTab('home');
    }
  };

  const toggleFilterChip = (status: string) => {
    setSelectedFilterStatus(prev => (prev === status ? null : status));
    setSelectedResultIndex(0);
  };

  return (
    <div className="nirmaan-header-wrapper">
      {/* ── 1. Top Midnight Blue Stripe Bar ── */}
      <div className="nirmaan-header-stripe" />

      {/* ── 2. Pristine White Brand & Status Banner ── */}
      <header className="nirmaan-header-bar">
        <div className="nirmaan-header-inner">
          {/* Left: Guideline, Bigger Emblem & Bigger Titles aligned further left */}
          <div className="header-left-cluster">
            {/* Architectural vertical guide rule */}
            <div className="header-architectural-guide" aria-hidden="true" />

            <div
              className="header-brand-group"
              onClick={handleBrandClick}
              role="button"
              tabIndex={0}
              title="Return to Home Overview"
            >
              <div className="header-emblem-container">
                <img
                  src={nirmaanEmblem}
                  alt="Nirmaan Drishti Emblem"
                  className="header-emblem-img"
                />
              </div>

              <div className="header-text-cluster">
                <h1 className="header-brand-title">Nirmaan Drishti</h1>
                <p className="header-brand-subtitle">
                  National Infrastructure Intelligence Dashboard
                </p>
              </div>
            </div>
          </div>

          {/* Right: Status Indicators, Divider & Search Trigger */}
          <div className="header-right-cluster">
            {/* Live Status Indicators (matching emblem dots) */}
            <div className="header-status-indicators" role="region" aria-label="Project Status Breakdown">
              {statusItems.map((item) => {
                const isActive = Boolean(
                  activeTab === 'projects' && (
                    currentStatusFilter === item.statusCode ||
                    (currentStatusFilter && currentStatusFilter.toUpperCase() === item.statusCode)
                  )
                );
                return (
                  <button
                    key={item.id}
                    type="button"
                    className={`status-pill-btn ${isActive ? 'active' : ''}`}
                    onClick={() => handleStatusClick(item)}
                    title={`${item.label}: ${item.count.toLocaleString()} Projects (Click to ${isActive ? 'clear filter' : 'filter'})`}
                    aria-pressed={isActive}
                  >
                    <span
                      className="status-dot-bullet"
                      style={{
                        backgroundColor: item.dotColor,
                      }}
                    />
                    <span className="status-pill-label">{item.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Vertical Separator Divider */}
            <div className="header-actions-divider" aria-hidden="true" />

            {/* Search Action Button (Clean minimal frameless icon matching reference) */}
            <button
              type="button"
              className="header-search-icon-btn"
              onClick={() => setIsSearchOpen(true)}
              title="Search 3,361 Infrastructure Projects (Ctrl+K or /)"
              aria-label="Search projects"
            >
              <Search size={18} strokeWidth={2} className="search-icon-svg" />
            </button>
          </div>
        </div>
      </header>

      {/* ── 3. Rectangular Navbar Bar (Integrated in the Header!) ── */}
      <nav className="nirmaan-header-nav-bar" aria-label="Main Navigation">
        <div className="header-nav-inner">
          <div className="header-nav-rectangular-group">
            {navItems.map((item) => {
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  className={`header-nav-rectangular-tab ${isActive ? 'active' : ''}`}
                  onClick={() => {
                    if (item.id === 'extractor') {
                      window.open('http://localhost:8000', '_blank', 'noopener,noreferrer');
                    } else {
                      onNavigateTab?.(item.id);
                    }
                  }}
                  title={item.id === 'extractor' ? "Open MoSPI PDF Extractor (New Tab)" : undefined}
                >
                  <span className="nav-tab-icon">{item.icon}</span>
                  <span className="nav-tab-label">{item.label}</span>
                  {item.id === 'extractor' && (
                    <ExternalLink size={11} style={{ opacity: 0.65, marginLeft: 2 }} />
                  )}
                </button>
              );
            })}
          </div>

          {/* Right-aligned Dark Theme Dashboard Button (Moved from next to Home to replace Live MoSPI badge) */}
          <button
            type="button"
            className={`header-nav-dashboard-dark-btn ${activeTab === 'dashboard' ? 'active' : ''}`}
            onClick={() => onNavigateTab?.('dashboard')}
            title="National Executive Overview & Telemetry Dashboard"
            aria-label="Open Dashboard"
          >
            <span className="dashboard-dark-icon">
              <LayoutDashboard size={15} />
            </span>
            <span className="dashboard-dark-label">Dashboard</span>
          </button>
        </div>
      </nav>

      {/* ── 4. Fullscreen Spotlight Quick-Search Modal via React Portal ── */}
      {isSearchOpen && typeof document !== 'undefined' && createPortal(
    <div
      className="spotlight-backdrop"
      onClick={() => setIsSearchOpen(false)}
      role="dialog"
      aria-modal="true"
      aria-label="Spotlight Project Search"
    >
      <div
        ref={cardRef}
        className="spotlight-card"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleSearchKeyDown}
      >
        {/* Search Input Bar */}
        <div className="spotlight-input-row">
          <Search size={21} className="spotlight-input-icon" />
          <input
            ref={searchInputRef}
            type="text"
            className="spotlight-input-field"
            placeholder="Search 3,361 projects by name, sector, ministry, or ID..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setSelectedResultIndex(0);
            }}
          />
          {searchQuery && (
            <button
              type="button"
              className="spotlight-clear-btn"
              onClick={() => {
                setSearchQuery('');
                searchInputRef.current?.focus();
              }}
              aria-label="Clear query"
              title="Clear input"
            >
              <X size={15} />
            </button>
          )}
          <button
            type="button"
            className="spotlight-close-btn"
            onClick={() => setIsSearchOpen(false)}
            title="Close (Esc)"
          >
            ESC
          </button>
        </div>

        {/* Quick Status Filter Helper Chips */}
        <div className="spotlight-chips-row">
          <span className="spotlight-chips-label">
            <SlidersHorizontal size={13} />
            <span>Filter status:</span>
          </span>
          {statusItems.map((item) => {
            const isChipActive = selectedFilterStatus === item.statusCode;
            return (
              <button
                key={item.id}
                type="button"
                className={`spotlight-chip ${isChipActive ? 'active' : ''}`}
                onClick={() => toggleFilterChip(item.statusCode)}
              >
                <span
                  className="spotlight-chip-dot"
                  style={{ backgroundColor: item.dotColor }}
                />
                <span>{item.label}</span>
                {isChipActive && <X size={12} className="chip-active-x" />}
              </button>
            );
          })}
        </div>

        {/* Results List */}
        <div className="spotlight-results-list" ref={resultsContainerRef}>
          <div className="spotlight-results-header">
            <span>
              {searchQuery.trim() || selectedFilterStatus
                ? `Matching Projects (${searchResults.length})`
                : 'Priority Central Infrastructure Projects'}
            </span>
            <span className="spotlight-nav-hint">Use ↑ ↓ arrows to navigate • Enter to view</span>
          </div>

          {searchResults.length === 0 ? (
            <div className="spotlight-no-results">
              <div className="spotlight-no-results-icon">
                <Search size={32} color="#94A3B8" />
              </div>
              <p className="no-results-text">No infrastructure projects found</p>
              <p className="no-results-sub">
                No matches for "{searchQuery || selectedFilterStatus}". Try searching by project code, ministry, or state.
              </p>
              <button
                type="button"
                className="spotlight-reset-filter-btn"
                onClick={() => {
                  setSearchQuery('');
                  setSelectedFilterStatus(null);
                }}
              >
                Reset Search & Filters
              </button>
            </div>
          ) : (
            searchResults.map((proj, idx) => {
              const isSelected = idx === selectedResultIndex;
              const isCrit = proj.riskLevel === 'Critical' || (proj.riskScore && proj.riskScore >= 75);
              const isInRev = !isCrit && proj.scheduleStatus === 'ON TRACK' && proj.progressPhysical > 0 && proj.progressPhysical < 100 && ((proj.riskScore && proj.riskScore >= 25) || proj.riskLevel === 'Medium');
              const displayStatus = isCrit ? 'CRITICAL' : isInRev ? 'IN REVIEW' : proj.scheduleStatus;
              const statusColor = displayStatus === 'CRITICAL' ? '#DC2626' : displayStatus === 'DELAYED' ? '#F59E0B' : displayStatus === 'IN REVIEW' ? '#2563EB' : '#16A34A';

              return (
                <div
                  key={proj.id}
                  className={`spotlight-item ${isSelected ? 'selected' : ''}`}
                  onClick={() => handleChooseProject(proj.id)}
                  onMouseEnter={() => setSelectedResultIndex(idx)}
                >
                  <div className="spotlight-item-left">
                    <div
                      className="spotlight-status-bullet"
                      style={{ backgroundColor: statusColor }}
                      title={`Schedule: ${displayStatus}`}
                    />
                    <div className="spotlight-item-info">
                      <div className="spotlight-item-name-row">
                        <span className="spotlight-item-name">{proj.name}</span>
                        <span className="spotlight-item-id">#{proj.id}</span>
                      </div>
                      <div className="spotlight-item-meta">
                        <span className="spotlight-meta-pill">
                          <Building2 size={12} /> {proj.sector}
                        </span>
                        <span className="spotlight-meta-pill">
                          <MapPin size={12} /> {proj.location.split('\r\n')[0].replace('Multi-States', 'All-India')}
                        </span>
                        <span
                          className="spotlight-meta-status"
                          style={{
                            color: statusColor,
                            borderColor: `${statusColor}44`,
                            backgroundColor: `${statusColor}10`
                          }}
                        >
                          {displayStatus}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="spotlight-item-right">
                    <div className="spotlight-cost-group">
                      <span className="spotlight-cost-label">Cost</span>
                      <span className="spotlight-item-cost">₹{proj.costRevised} Cr</span>
                    </div>
                    <div className="spotlight-action-icon">
                      {isSelected ? (
                        <CornerDownLeft size={16} className="spotlight-enter-icon" />
                      ) : (
                        <ChevronRight size={16} className="spotlight-arrow" />
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Modal Footer */}
        <div className="spotlight-footer">
          <div className="spotlight-footer-keys">
            <span className="spotlight-key-badge">↑</span>
            <span className="spotlight-key-badge">↓</span>
            <span className="spotlight-key-label">Navigate</span>
            <span className="spotlight-key-badge">↵</span>
            <span className="spotlight-key-label">Select</span>
            <span className="spotlight-key-badge">ESC</span>
            <span className="spotlight-key-label">Close</span>
          </div>
          <button
            type="button"
            className="spotlight-view-all-btn"
            onClick={() => {
              setIsSearchOpen(false);
              if (onNavigateTab) onNavigateTab('projects');
            }}
          >
            <span>View All 3,361 Projects</span>
            <ArrowRight size={14} />
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}
    </div >
  );
};
