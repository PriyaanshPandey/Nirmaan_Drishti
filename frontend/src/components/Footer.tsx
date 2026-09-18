import React from 'react';
import { Mail } from 'lucide-react';
import './Footer.css';

interface FooterProps {
  onNavigateTab?: (tabId: string) => void;
  activeTab?: string;
}

export const Footer: React.FC<FooterProps> = ({ onNavigateTab, activeTab = 'home' }) => {
  const quickLinks = [
    { id: 'home', label: 'Home' },
    { id: 'dashboard', label: 'Dashboard' },
    { id: 'projects', label: 'Project' },
    { id: 'distribution', label: 'Distribution' },
    { id: 'action-centre', label: 'Action Center' },
  ];

  return (
    <footer className="nirmaan-unified-navy-footer" aria-label="Official Portal Footer">
      {/* Distinction Top Accent Line */}
      <div className="footer-accent-stripe" aria-hidden="true" />

      <div className="footer-main-wrapper">
        {/* ── Top Row: Logos on Left, Quick Links on Right ── */}
        <div className="footer-top-row">
          {/* LEFT: 3 Cleaned Logos in Sleek Cards */}
          <div className="footer-logos-left" aria-label="Official Institutional Logos">
            {/* MoSPI Logo (Clickable) */}
            <a
              href="https://www.mospi.gov.in"
              target="_blank"
              rel="noopener noreferrer"
              className="footer-logo-card clickable"
              title="Ministry of Statistics and Programme Implementation (MoSPI) — Visit Official Portal"
            >
              <img
                src="/mospi%20logo.png"
                alt="MoSPI Government of India"
                className="logo-img mospi-logo-img"
              />
            </a>

            {/* NavDrishti Logo (Brand Identity — No redirect needed) */}
            <div
              className="footer-logo-card brand-card"
              title="NavDrishti — National Infrastructure Intelligence Dashboard"
            >
              <img
                src="/navdrishti.png"
                alt="NavDrishti"
                className="logo-img navdrishti-logo-img"
              />
            </div>

            {/* PAIMANA Logo (Clickable) */}
            <a
              href="https://www.mospi.gov.in"
              target="_blank"
              rel="noopener noreferrer"
              className="footer-logo-card clickable"
              title="PAIMANA — Project Monitoring & Telemetry Platform"
            >
              <img
                src="/paimana.png"
                alt="PAIMANA Monitoring Platform"
                className="logo-img paimana-logo-img"
              />
            </a>
          </div>

          {/* RIGHT: Quick Links with ONLY Underline on Active / Click */}
          <div className="footer-links-right">
            <span className="footer-links-label">Quick Links:</span>
            <nav className="footer-nav-group" aria-label="Footer Quick Navigation">
              {quickLinks.map((item) => {
                const isActive = activeTab === item.id || (item.id === 'projects' && activeTab === 'project');
                return (
                  <button
                    key={item.id}
                    type="button"
                    className={`footer-underline-nav-btn ${isActive ? 'active' : ''}`}
                    onClick={() => {
                      onNavigateTab?.(item.id);
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                    }}
                    title={`Navigate to ${item.label}`}
                  >
                    {item.label}
                  </button>
                );
              })}
            </nav>
          </div>
        </div>

        {/* Divider */}
        <div className="footer-inner-divider" />

        {/* ── Bottom Row: Copyright & Email ── */}
        <div className="footer-bottom-row">
          <p className="footer-copyright-text">
            Copyright © 2026 Team NavDrishti. All Rights Reserved.
          </p>

          <a
            href="mailto:teamnavdrishti@gmail.com"
            className="footer-email-text-link"
            title="Send email to Team NavDrishti"
          >
            <Mail size={13} className="footer-mail-icon" />
            <span>teamnavdrishti@gmail.com</span>
          </a>
        </div>
      </div>
    </footer>
  );
};
