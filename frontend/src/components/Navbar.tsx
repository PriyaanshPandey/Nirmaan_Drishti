import React, { useRef, useEffect, useState, useId } from 'react';
import {
  Menu,
  X,
  Home,
  LayoutDashboard,
  FolderKanban,
  Sparkles,
  PieChart,
  Zap,
  ChevronRight,
  ShieldCheck
} from 'lucide-react';
import './Navbar.css';
import nirmaanEmblem from '../assets/nirmaan_emblem.png';

interface NavbarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

interface NavItemConfig {
  id: string;
  label: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  badge?: string;
}

export const Navbar: React.FC<NavbarProps> = ({ activeTab, setActiveTab }) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const drawerId = useId();

  const navItems: NavItemConfig[] = [
    { id: 'home', label: 'Home', icon: Home },
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'projects', label: 'Projects', icon: FolderKanban, badge: '3,361' },
    { id: 'insights', label: 'AI Insights', icon: Sparkles, badge: 'Live' },
    { id: 'distribution', label: 'Distribution', icon: PieChart },
    { id: 'action-centre', label: 'Action centre', icon: Zap, badge: 'Priority' },
  ];

  const [indicatorStyle, setIndicatorStyle] = useState<React.CSSProperties>({
    left: 0,
    width: 0,
    opacity: 0
  });

  // Desktop indicator pill tracking
  useEffect(() => {
    if (!containerRef.current) return;
    const activeEl = containerRef.current.querySelector('.nav-pill-btn.active') as HTMLElement;
    if (activeEl) {
      setIndicatorStyle({
        left: activeEl.offsetLeft,
        width: activeEl.offsetWidth,
        opacity: 1
      });
    } else {
      setIndicatorStyle((prev) => ({ ...prev, opacity: 0 }));
    }
  }, [activeTab]);

  // Handle body scroll lock & ESC key when mobile drawer is open
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && mobileMenuOpen) {
        setMobileMenuOpen(false);
      }
    };

    if (mobileMenuOpen) {
      document.body.style.overflow = 'hidden';
      window.addEventListener('keydown', handleKeyDown);
    } else {
      document.body.style.overflow = '';
    }

    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [mobileMenuOpen]);

  const handleMobileNavSelect = (tabId: string) => {
    setActiveTab(tabId);
    setMobileMenuOpen(false);
  };

  return (
    <>
      {/* ── Desktop Pill Navbar (Hidden on <= 868px) ── */}
      <nav className="navbar-container" aria-label="Main Navigation">
        <div className="nav-pills-wrapper" ref={containerRef} style={{ position: 'relative' }}>
          <div
            className="nav-active-indicator"
            style={{
              position: 'absolute',
              top: '6px',
              bottom: '6px',
              borderRadius: '100px',
              transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
              zIndex: 1,
              pointerEvents: 'none',
              ...indicatorStyle
            }}
          />
          {navItems.map((item) => (
            <button
              key={item.id}
              className={`nav-pill-btn ${activeTab === item.id ? 'active' : ''}`}
              onClick={() => setActiveTab(item.id)}
              style={{
                position: 'relative',
                zIndex: 2,
                color: activeTab === item.id ? '#ffffff' : 'var(--text-light)',
                transition: 'color 0.3s cubic-bezier(0.16, 1, 0.3, 1)'
              }}
            >
              {item.label}
            </button>
          ))}
        </div>
      </nav>

      {/* ── Mobile Topbar (Visible only on <= 868px) ── */}
      <header className="mobile-nav-topbar" aria-label="Mobile Navigation Bar">
        <div className="mobile-brand-group" onClick={() => handleMobileNavSelect('home')}>
          <div className="mobile-emblem-badge">
            <img src={nirmaanEmblem} alt="National Emblem" className="mobile-emblem-img" />
          </div>
          <div className="mobile-brand-text">
            <span className="mobile-brand-title">Nirmaan Drishti</span>
            <span className="mobile-brand-sub">MoSPI Early Warning</span>
          </div>
        </div>

        <div className="mobile-topbar-actions">
          <div className="mobile-live-pill">
            <span className="mobile-live-dot"></span>
            <span className="mobile-live-label">LIVE</span>
          </div>
          <button
            type="button"
            className="mobile-hamburger-btn"
            onClick={() => setMobileMenuOpen(true)}
            aria-label="Open Navigation Sidebar"
            aria-expanded={mobileMenuOpen}
            aria-controls={drawerId}
          >
            <Menu size={22} />
          </button>
        </div>
      </header>

      {/* ── Mobile Sidebar Drawer & Backdrop (Slide-in) ── */}
      <div
        className={`mobile-sidebar-backdrop ${mobileMenuOpen ? 'open' : ''}`}
        onClick={() => setMobileMenuOpen(false)}
        aria-hidden="true"
      />

      <aside
        id={drawerId}
        className={`mobile-sidebar-drawer ${mobileMenuOpen ? 'open' : ''}`}
        aria-label="Mobile Sidebar Menu"
      >
        {/* Drawer Header */}
        <div className="drawer-header">
          <div className="drawer-brand">
            <img src={nirmaanEmblem} alt="Nirmaan Emblem" className="drawer-emblem" />
            <div className="drawer-titles">
              <span className="drawer-app-title">Nirmaan Drishti</span>
              <span className="drawer-app-sub">Govt of India • MoSPI</span>
            </div>
          </div>
          <button
            type="button"
            className="drawer-close-btn"
            onClick={() => setMobileMenuOpen(false)}
            aria-label="Close Navigation Sidebar"
          >
            <X size={20} />
          </button>
        </div>

        {/* Status Chip */}
        <div className="drawer-status-card">
          <div className="drawer-status-indicator">
            <span className="drawer-dot-pulse"></span>
            <span className="drawer-status-title">Telemetry Engine Online</span>
          </div>
          <p className="drawer-status-desc">3,361 National Infrastructure projects continuously monitored</p>
        </div>

        {/* Navigation Links */}
        <nav className="drawer-nav-list" aria-label="Mobile Menu Links">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;

            return (
              <button
                key={item.id}
                type="button"
                className={`drawer-nav-item ${isActive ? 'active' : ''}`}
                onClick={() => handleMobileNavSelect(item.id)}
              >
                <div className="drawer-item-left">
                  <div className={`drawer-icon-box ${isActive ? 'active-icon' : ''}`}>
                    <Icon size={19} />
                  </div>
                  <span className="drawer-item-label">{item.label}</span>
                </div>

                <div className="drawer-item-right">
                  {item.badge && (
                    <span className={`drawer-item-badge ${isActive ? 'active-badge' : ''}`}>
                      {item.badge}
                    </span>
                  )}
                  <ChevronRight size={16} className="drawer-chevron" />
                </div>
              </button>
            );
          })}
        </nav>

        {/* Drawer Footer */}
        <div className="drawer-footer">
          <div className="drawer-gov-tag">
            <ShieldCheck size={14} className="drawer-shield-icon" />
            <span>PAIMANA National Infrastructure Portal</span>
          </div>
          <span className="drawer-version-tag">Version 2.4 • Early Warning System</span>
        </div>
      </aside>
    </>
  );
};
