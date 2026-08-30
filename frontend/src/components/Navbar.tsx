import React, { useRef, useEffect, useState } from 'react';
import './Navbar.css';

interface NavbarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

export const Navbar: React.FC<NavbarProps> = ({ activeTab, setActiveTab }) => {
  const navItems = [
    { id: 'home', label: 'Home' },
    { id: 'dashboard', label: 'Dashboard' },
    { id: 'projects', label: 'Projects' },
    { id: 'insights', label: 'AI Insights' },
    { id: 'risk', label: 'Risk Analysis' },
    { id: 'distribution', label: 'Distribution' },
    { id: 'action-centre', label: 'Action centre' },
  ];

  const containerRef = useRef<HTMLDivElement | null>(null);
  const [indicatorStyle, setIndicatorStyle] = useState<React.CSSProperties>({
    left: 0,
    width: 0,
    opacity: 0
  });

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

  return (
    <nav className="navbar-container">
      <div className="nav-pills-wrapper" ref={containerRef} style={{ position: 'relative' }}>
        {/* Sliding indicator background pill */}
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
  );
};
