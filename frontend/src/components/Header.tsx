import React, { useState, useEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
  Search, X, ChevronRight, Building2, MapPin, ArrowRight,
  SlidersHorizontal, CornerDownLeft, Home, LayoutDashboard,
  Database, Layers, ShieldAlert, FileSpreadsheet, LogOut,
  Accessibility, Type, ZoomIn, ZoomOut, Link2, Eye, RotateCcw
} from 'lucide-react';
import type { Project } from '../data/projectsData';
import './Header.css';
import { useAuth } from '../auth/AuthContext';

import { useLanguage } from '../context/LanguageContext';

interface HeaderProps {
  activeTab?: string;
  onNavigateTab?: (tab: string) => void;
  onSelectProject?: (projectId: string) => void;
  onFilterStatus?: (status: string) => void;
  currentStatusFilter?: string;
  onOpenLoginModal?: () => void;
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
  onFilterStatus: _onFilterStatus,
  currentStatusFilter: _currentStatusFilter = 'All',
  onOpenLoginModal
}) => {
  const { user, logout } = useAuth();
  const { language, toggleLanguage, t } = useLanguage();
  const isIMPD = user?.role === 'mospi_officer' || user?.role === ('impd_officer' as any);
  const isPublic = !user || user.role === 'public';
  const [projectsList, setProjectsList] = useState<Project[]>([]);

  // Accessibility state
  const [isAccessibilityOpen, setIsAccessibilityOpen] = useState(false);
  const [fontSize, setFontSize] = useState(100);
  const [isHighContrast, setIsHighContrast] = useState(false);
  const [isLinksHighlighted, setIsLinksHighlighted] = useState(false);
  const accessibilityRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    import('../data/projectsData').then(mod => setProjectsList(mod.projectsData));
  }, []);

  // Close accessibility panel on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (accessibilityRef.current && !accessibilityRef.current.contains(e.target as Node)) {
        setIsAccessibilityOpen(false);
      }
    };
    if (isAccessibilityOpen) {
      document.addEventListener('mousedown', handleClick);
    }
    return () => document.removeEventListener('mousedown', handleClick);
  }, [isAccessibilityOpen]);

  // Apply font size changes
  useEffect(() => {
    document.documentElement.style.fontSize = `${fontSize}%`;
  }, [fontSize]);

  // Apply high contrast
  useEffect(() => {
    if (isHighContrast) {
      document.body.classList.add('high-contrast-mode');
    } else {
      document.body.classList.remove('high-contrast-mode');
    }
  }, [isHighContrast]);

  // Apply link highlighting
  useEffect(() => {
    if (isLinksHighlighted) {
      document.body.classList.add('highlight-links-mode');
    } else {
      document.body.classList.remove('highlight-links-mode');
    }
  }, [isLinksHighlighted]);

  const resetAccessibility = () => {
    setFontSize(100);
    setIsHighContrast(false);
    setIsLinksHighlighted(false);
  };

  const [isSearchOpen, setIsSearchOpen] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedFilterStatus, setSelectedFilterStatus] = useState<string | null>(null);
  const [selectedResultIndex, setSelectedResultIndex] = useState<number>(0);

  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const cardRef = useRef<HTMLDivElement | null>(null);
  const resultsContainerRef = useRef<HTMLDivElement | null>(null);

  // Exact nav items — Restricted to Home & Projects in Public Mode
  const allNavItems = [
    { id: 'home', label: t('nav_home', 'Home'), icon: <Home size={15} /> },
    { id: 'dashboard', label: t('nav_dashboard', 'Dashboard'), icon: <LayoutDashboard size={15} /> },
    { id: 'projects', label: t('nav_projects', 'Projects'), icon: <Database size={15} /> },
    { id: 'distribution', label: t('nav_benchmark', 'Benchmark'), icon: <Layers size={15} /> },
    { id: 'alerts', label: t('nav_alerts', 'Alerts'), icon: <ShieldAlert size={15} /> },
    { id: 'action-centre', label: t('nav_actions', 'Action Center'), icon: <ShieldAlert size={15} /> },
    { id: 'extractor', label: t('nav_extractor', 'PDF Extractor'), icon: <FileSpreadsheet size={15} />, impdOnly: true },
  ];

  const navItems = useMemo(() => {
    if (isPublic) {
      return [
        { id: 'home', label: t('nav_home', 'Home'), icon: <Home size={15} /> },
        { id: 'projects', label: t('nav_projects', 'Projects'), icon: <Database size={15} /> },
      ];
    }
    return allNavItems.filter(item => !item.impdOnly || isIMPD);
  }, [isPublic, isIMPD, language]);

  // Compute exact counts from 6,568 master dataset
  const statusItems: StatusItem[] = useMemo(() => {
    let onTrack = 0;
    let inProgress = 0;
    let delayed = 0;
    let critical = 0;

    for (const p of projectsList) {
      if (p.scheduleStatus === 'CRITICAL' || p.riskLevel === 'Critical' || (p.riskScore && p.riskScore >= 75)) {
        critical++;
      } else if (p.scheduleStatus === 'DELAYED') {
        delayed++;
      } else if (
        p.scheduleStatus === 'ON TRACK' &&
        p.progressPhysical > 0 &&
        p.progressPhysical < 100 &&
        ((p.riskScore && p.riskScore >= 25) || p.riskLevel === 'Medium')
      ) {
        inProgress++;
      } else {
        onTrack++;
      }
    }

    return [
      { id: 'on-track', label: t('status_on_track', 'On Track'), dotColor: '#16A34A', count: onTrack, statusCode: 'ON TRACK' },
      { id: 'in-progress', label: t('status_in_progress', 'In Progress'), dotColor: '#2563EB', count: inProgress, statusCode: 'IN REVIEW' },
      { id: 'delayed', label: t('status_delayed', 'Delayed'), dotColor: '#F59E0B', count: delayed, statusCode: 'DELAYED' },
      { id: 'critical', label: t('status_critical', 'Critical'), dotColor: '#DC2626', count: critical, statusCode: 'CRITICAL' }
    ];
  }, [projectsList, language]);

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

  // Click outside search card to dismiss modal & lock body scroll
  useEffect(() => {
    if (!isSearchOpen) return;

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

    return projectsList
      .filter(p => {
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

        if (!q) return true;
        return (
          p.name.toLowerCase().includes(q) ||
          p.id.toLowerCase().includes(q) ||
          (p.legacyOcmsCode && p.legacyOcmsCode.toLowerCase().includes(q)) ||
          ((p as any).legacy_ocms_code && String((p as any).legacy_ocms_code).toLowerCase().includes(q)) ||
          p.ministry.toLowerCase().includes(q) ||
          p.sector.toLowerCase().includes(q) ||
          p.location.toLowerCase().includes(q)
        );
      })
      .slice(0, 10);
  }, [searchQuery, selectedFilterStatus, projectsList]);

  // Scroll active item into view
  useEffect(() => {
    if (!resultsContainerRef.current) return;
    const activeEl = resultsContainerRef.current.querySelector('.spotlight-item.selected') as HTMLElement;
    if (activeEl) {
      activeEl.scrollIntoView({ block: 'nearest' });
    }
  }, [selectedResultIndex]);

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
      {/* ── 1. Official Government Top Bar (MoSPI-style) ── */}
      <header className="nirmaan-header-bar">
        <div className="nirmaan-header-inner">
          {/* Left: Ashoka Emblem + GoI / MoSPI Text + Nirmaan Drishti Logo */}
          <div
            className="header-brand-group"
            onClick={handleBrandClick}
            role="button"
            tabIndex={0}
            title={t('nav_home', 'Return to Home')}
          >
            {/* Ashoka Emblem */}
            <div className="header-emblem-container">
              <img
                src="https://upload.wikimedia.org/wikipedia/commons/5/55/Emblem_of_India.svg"
                alt="Ashoka Emblem — Satyameva Jayate"
                className="header-emblem-img"
                onError={(e) => {
                  // Fallback if CDN fails
                  (e.target as HTMLImageElement).style.display = 'none';
                }}
              />
            </div>

            {/* GoI + MoSPI Bilingual Text */}
            <div className="header-text-cluster">
              <span className="header-goi-title">
                {language === 'hi' ? 'भारत सरकार' : 'Government of India'}
              </span>
              <span className="header-mospi-title">
                {language === 'hi' ? 'सांख्यिकी एवं कार्यक्रम कार्यान्वयन मंत्रालय' : 'Ministry of Statistics & Programme Implementation'}
              </span>
            </div>

            {/* Separator */}
            <div className="header-brand-separator" />

            {/* Nirmaan Drishti Logo */}
            <div className="header-app-identity" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <img
                src="/nirmaan_drishti_logo.png"
                alt="Nirmaan Drishti Logo"
                className="header-app-logo"
              />
              <span style={{ 
                fontWeight: 800, 
                fontSize: '20px', 
                color: '#0F172A',
                letterSpacing: '-0.01em'
              }}>
                Nirmaan Drishti
              </span>
            </div>
          </div>

          {/* Right: Utility Icons (MoSPI-style) */}
          <div className="header-right-cluster">
            {/* Search */}
            <button
              type="button"
              className="header-utility-btn"
              onClick={() => setIsSearchOpen(true)}
              title={t('search_projects', 'Search Projects') + ' (Ctrl+K)'}
              aria-label="Search projects"
            >
              <Search size={18} strokeWidth={2} />
            </button>

            <span className="header-utility-divider" />

            {/* Screen Reader Access */}
            <button
              type="button"
              className="header-utility-btn"
              onClick={() => {
                const main = document.querySelector('main') || document.querySelector('.app-content') || document.getElementById('root');
                if (main) (main as HTMLElement).focus();
              }}
              title={t('screen_reader', 'Screen Reader Access')}
              aria-label="Screen Reader Access"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="3" width="20" height="14" rx="2" />
                <line x1="8" y1="21" x2="16" y2="21" />
                <line x1="12" y1="17" x2="12" y2="21" />
                <path d="M7 8h10M7 12h6" />
              </svg>
            </button>

            <span className="header-utility-divider" />

            {/* Language Toggle (Hindi / English) */}
            <button
              type="button"
              className="header-utility-btn header-lang-btn"
              onClick={toggleLanguage}
              title={`Switch to ${language === 'en' ? 'Hindi (हिंदी)' : 'English'}`}
              aria-label="Toggle language"
            >
              <span className="lang-icon-text">अ</span>
              <span className="lang-icon-slash">/</span>
              <span className="lang-icon-text">A</span>
            </button>

            <span className="header-utility-divider" />

            {/* Accessibility Tools */}
            <div className="header-accessibility-wrapper" ref={accessibilityRef}>
              <button
                type="button"
                className="header-utility-btn"
                onClick={() => setIsAccessibilityOpen(prev => !prev)}
                title={t('accessibility', 'Accessibility Tools')}
                aria-label="Accessibility Tools"
              >
                <Accessibility size={18} strokeWidth={2} />
              </button>

              {/* Accessibility Panel Dropdown */}
              {isAccessibilityOpen && (
                <div className="accessibility-panel">
                  <div className="accessibility-panel-header">
                    <h3>{t('accessibility', 'Accessibility Tools')}</h3>
                    <button
                      type="button"
                      className="accessibility-reset-btn"
                      onClick={resetAccessibility}
                    >
                      <RotateCcw size={13} />
                      <span>{t('reset_all', 'Reset All')}</span>
                    </button>
                  </div>
                  <div className="accessibility-grid">
                    <button
                      type="button"
                      className={`accessibility-tool-btn ${isHighContrast ? 'active' : ''}`}
                      onClick={() => setIsHighContrast(prev => !prev)}
                    >
                      <Eye size={20} />
                      <span>{t('dark_contrast', 'Dark Contrast')}</span>
                    </button>
                    <button
                      type="button"
                      className="accessibility-tool-btn"
                      onClick={() => setFontSize(prev => Math.min(prev + 10, 150))}
                    >
                      <ZoomIn size={20} />
                      <span>{t('text_increase', 'Text Size +')}</span>
                    </button>
                    <button
                      type="button"
                      className="accessibility-tool-btn"
                      onClick={() => setFontSize(prev => Math.max(prev - 10, 80))}
                    >
                      <ZoomOut size={20} />
                      <span>{t('text_decrease', 'Text Size −')}</span>
                    </button>
                    <button
                      type="button"
                      className={`accessibility-tool-btn ${isLinksHighlighted ? 'active' : ''}`}
                      onClick={() => setIsLinksHighlighted(prev => !prev)}
                    >
                      <Link2 size={20} />
                      <span>{t('highlight_links', 'Highlight Links')}</span>
                    </button>
                  </div>
                  <div className="accessibility-font-indicator">
                    <Type size={14} />
                    <span>{language === 'hi' ? `पाठ आकार: ${fontSize}%` : `Font Size: ${fontSize}%`}</span>
                  </div>
                </div>
              )}
            </div>

            <span className="header-utility-divider" />

            {/* Officer Sign In / Sign Out */}
            {isPublic ? (
              <button
                type="button"
                className="header-officer-signin-btn"
                onClick={onOpenLoginModal}
              >
                <LogOut size={14} style={{ transform: 'rotate(180deg)' }} />
                <span>{t('officer_sign_in', 'Officer Sign In')}</span>
              </button>
            ) : (
              <button
                type="button"
                id="header-logout-btn"
                className="header-utility-btn"
                onClick={logout}
                title={`${t('sign_out', 'Sign out')} (${user?.full_name || user?.username})`}
                aria-label="Sign out"
              >
                <LogOut size={17} strokeWidth={2} />
              </button>
            )}
          </div>
        </div>
      </header>

      {/* ── 2. Full-Width Deep Royal Navy Navigation Bar with CENTRALIZED Items ── */}
      <nav className="nirmaan-navy-nav" aria-label="Main Navigation">
        <div className="navy-nav-inner">
          {/* Centered Navigation Links */}
          <div className="navy-nav-center">
            {navItems.map((item) => {
              const isActive = activeTab === item.id || (item.id === 'projects' && activeTab === 'project');
              return (
                <button
                  key={item.id}
                  type="button"
                  className={`header-nav-rectangular-tab ${isActive ? 'active' : ''}`}
                  onClick={() => {
                    onNavigateTab?.(item.id);
                  }}
                  title={item.id === 'extractor' ? t('nav_extractor', 'PDF Extractor') : undefined}
                >
                  <span className="nav-tab-icon">{item.icon}</span>
                  <span className="nav-tab-label">{item.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </nav>

      {/* ── 3. Fullscreen Spotlight Quick-Search Modal via React Portal ── */}
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
                placeholder={t('search_placeholder', 'Search projects by name, sector, ministry, or ID...')}
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
                <span>{t('filter_status', 'Filter status')}:</span>
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
                    ? `${language === 'hi' ? 'मिलान परियोजनाएं' : 'Matching Projects'} (${searchResults.length})`
                    : language === 'hi' ? 'प्राथमिकता केंद्रीय बुनियादी ढांचा परियोजनाएं' : 'Priority Central Infrastructure Projects'}
                </span>
                <span className="spotlight-nav-hint">
                  {language === 'hi' ? '↑ ↓ तीर कुंजी • Enter चयन करें' : 'Use ↑ ↓ arrows to navigate • Enter to view'}
                </span>
              </div>

              {searchResults.length === 0 ? (
                <div className="spotlight-no-results">
                  <div className="spotlight-no-results-icon">
                    <Search size={32} color="#94A3B8" />
                  </div>
                  <p className="no-results-text">
                    {language === 'hi' ? 'कोई बुनियादी ढांचा परियोजना नहीं मिली' : 'No infrastructure projects found'}
                  </p>
                  <p className="no-results-sub">
                    {language === 'hi'
                      ? `"${searchQuery || selectedFilterStatus}" के लिए कोई मिलान नहीं।`
                      : `No matches for "${searchQuery || selectedFilterStatus}". Try searching by project code, ministry, or state.`}
                  </p>
                  <button
                    type="button"
                    className="spotlight-reset-filter-btn"
                    onClick={() => {
                      setSearchQuery('');
                      setSelectedFilterStatus(null);
                    }}
                  >
                    {language === 'hi' ? 'खोज और फ़िल्टर रीसेट करें' : 'Reset Search & Filters'}
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
                          title={`${t('schedule_status', 'Schedule')}: ${displayStatus}`}
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
                              <MapPin size={12} /> {proj.location.split('\r\n')[0].replace('Multi-States', language === 'hi' ? 'अखिल भारतीय' : 'All-India')}
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
                          <span className="spotlight-cost-label">{t('total_cost', 'Cost')}</span>
                          <span className="spotlight-item-cost">₹{proj.costRevised} {t('crore', 'Cr')}</span>
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
                <span className="spotlight-key-label">{language === 'hi' ? 'नेविगेट' : 'Navigate'}</span>
                <span className="spotlight-key-badge">↵</span>
                <span className="spotlight-key-label">{language === 'hi' ? 'चुनें' : 'Select'}</span>
                <span className="spotlight-key-badge">ESC</span>
                <span className="spotlight-key-label">{language === 'hi' ? 'बंद करें' : 'Close'}</span>
              </div>
              <button
                type="button"
                className="spotlight-view-all-btn"
                onClick={() => {
                  setIsSearchOpen(false);
                  if (onNavigateTab) onNavigateTab('projects');
                }}
              >
                <span>{language === 'hi' ? 'सभी चल रही परियोजनाएं देखें' : 'View All Ongoing Projects'}</span>
                <ArrowRight size={14} />
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};
