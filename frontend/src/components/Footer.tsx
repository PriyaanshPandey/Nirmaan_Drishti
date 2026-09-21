import React from 'react';
import { Mail, ExternalLink, MapPin } from 'lucide-react';
import './Footer.css';
import { useLanguage } from '../context/LanguageContext';

interface FooterProps {
  onNavigateTab?: (tabId: string) => void;
  activeTab?: string;
}

export const Footer: React.FC<FooterProps> = ({ onNavigateTab, activeTab = 'home' }) => {
  const { t } = useLanguage();

  const quickLinks = [
    { id: 'home', label: t('nav_home', 'Home') },
    { id: 'dashboard', label: t('nav_dashboard', 'Dashboard') },
    { id: 'projects', label: t('nav_projects', 'Projects') },
    { id: 'distribution', label: t('nav_benchmark', 'Benchmark') },
    { id: 'alerts', label: t('nav_alerts', 'Alerts') },
    { id: 'action-centre', label: t('nav_actions', 'Action Center') },
  ];

  const importantLinks = [
    { label: t('mospi_portal', 'MoSPI Official Portal'), url: 'https://www.mospi.gov.in' },
    { label: t('india_gov', 'National Portal of India'), url: 'https://www.india.gov.in' },
    { label: t('pib', 'Press Information Bureau'), url: 'https://pib.gov.in' },
    { label: t('niti_aayog', 'NITI Aayog'), url: 'https://www.niti.gov.in' },
  ];

  return (
    <footer className="gov-footer" aria-label="Official Portal Footer">
      {/* Top Accent Line */}
      <div className="footer-top-accent" aria-hidden="true" />

      <div className="footer-content-wrapper">
        {/* 4-Column Grid */}
        <div className="footer-columns-grid">
          {/* Column 1: About */}
          <div className="footer-column">
            <h4 className="footer-col-heading">{t('footer_about', 'About')}</h4>
            <div className="footer-logo-row" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <img src="/nirmaan_drishti_logo.png" alt="Nirmaan Drishti Logo" className="footer-brand-logo" />
              <span style={{ fontWeight: 800, fontSize: '16px', color: '#FFFFFF', letterSpacing: '-0.01em' }}>Nirmaan Drishti</span>
            </div>
            <p className="footer-about-text">
              {t('footer_about_text', 'Nirmaan Drishti is the AI-powered national infrastructure monitoring portal under the Ministry of Statistics & Programme Implementation (MoSPI), Government of India.')}
            </p>
          </div>

          {/* Column 2: Quick Links */}
          <div className="footer-column">
            <h4 className="footer-col-heading">{t('footer_quick_links', 'Quick Links')}</h4>
            <nav className="footer-links-list" aria-label="Footer Quick Navigation">
              {quickLinks.map((item) => {
                const isActive = activeTab === item.id || (item.id === 'projects' && activeTab === 'project');
                return (
                  <button
                    key={item.id}
                    type="button"
                    className={`footer-link-btn ${isActive ? 'active' : ''}`}
                    onClick={() => {
                      onNavigateTab?.(item.id);
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                    }}
                  >
                    <span className="footer-link-arrow">›</span>
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </nav>
          </div>

          {/* Column 3: Important Links */}
          <div className="footer-column">
            <h4 className="footer-col-heading">{t('footer_important_links', 'Important Links')}</h4>
            <nav className="footer-links-list" aria-label="Important Government Links">
              {importantLinks.map((link) => (
                <a
                  key={link.url}
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="footer-ext-link"
                >
                  <ExternalLink size={12} />
                  <span>{link.label}</span>
                </a>
              ))}
            </nav>
          </div>

          {/* Column 4: Contact */}
          <div className="footer-column">
            <h4 className="footer-col-heading">{t('footer_contact', 'Contact Us')}</h4>
            <div className="footer-contact-list">
              <div className="footer-contact-item">
                <MapPin size={14} className="footer-contact-icon" />
                <span>{t('footer_address', 'Madan Mohan Malaviya University of Technology, Gorakhpur')}</span>
              </div>
              <a
                href="mailto:teamnavdrishti@gmail.com"
                className="footer-contact-item clickable"
              >
                <Mail size={14} className="footer-contact-icon" />
                <span>teamnavdrishti@gmail.com</span>
              </a>
            </div>

            {/* Institutional Logos */}
            <div className="footer-institutional-logos">
              <a href="https://www.mospi.gov.in" target="_blank" rel="noopener noreferrer" title="MoSPI">
                <img src="/mospi logo.png" alt="MoSPI" className="footer-inst-logo" />
              </a>
              <a href="https://www.mospi.gov.in" target="_blank" rel="noopener noreferrer" title="PAIMANA">
                <img src="/paimana.png" alt="PAIMANA" className="footer-inst-logo" />
              </a>
            </div>
          </div>
        </div>

        {/* Bottom Strip */}
        <div className="footer-bottom-strip">
          <div className="footer-bottom-left">
            <p className="footer-copyright">
              {t('footer_copyright', 'Copyright © 2026 Team NavDrishti. All Rights Reserved.')}
            </p>
          </div>
          <div className="footer-bottom-right">
            <span className="footer-credit">
              {t('footer_designed_by', 'Designed & Developed by Team NavDrishti')}
            </span>
            <span className="footer-credit-sep">|</span>
            <span className="footer-credit">
              {t('footer_content_managed', 'Content managed by MoSPI, Government of India')}
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
};
