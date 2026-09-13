import React from 'react';
import { ExternalLink, Globe, Cpu } from 'lucide-react';
import nirmaanEmblem from '../assets/nirmaan_emblem.png';
import './Footer.css';

interface FooterProps {
  onNavigateTab?: (tabId: string) => void;
  activeTab?: string;
}

export const Footer: React.FC<FooterProps> = ({ onNavigateTab, activeTab }) => {
  return (
    <footer className="simple-govt-footer">
      <div className="footer-simple-container">
        {/* Left: Brand Identity & External Official Links in clean aligned column */}
        <div className="footer-brand-section">
          <div className="footer-emblem-container">
            <img
              src={nirmaanEmblem}
              alt="Nirmaan Drishti Emblem"
              className="footer-emblem-img"
            />
          </div>
          <div className="brand-content-col">
            <div className="brand-title-row">
              <span className="brand-title">NIRMAAN DRISHTI</span>
              <span className="brand-govt-badge">GOVT OF INDIA</span>
            </div>
            <span className="brand-sub">
              MoSPI &amp; PAIMANA Infrastructure Intelligence Platform
            </span>
            <div className="official-link-row">
              <a 
                href="https://www.mospi.gov.in" 
                target="_blank" 
                rel="noopener noreferrer" 
                className="simple-link-pill"
                title="Visit Official MoSPI Portal"
              >
                <Globe size={13} />
                <span>MoSPI Official Site</span>
                <ExternalLink size={11} />
              </a>

              <a 
                href="https://www.mospi.gov.in" 
                target="_blank" 
                rel="noopener noreferrer" 
                className="simple-link-pill pill-paimana"
                title="Access PAIMANA Platform"
              >
                <Cpu size={13} />
                <span>PAIMANA Platform</span>
                <ExternalLink size={11} />
              </a>
            </div>
          </div>
        </div>

        {/* Right: Quick Pages Navigation aligned with header */}
        <div className="footer-nav-section">
          <span className="nav-section-title">Quick Pages</span>
          <div className="nav-links-grid">
            <button 
              className={`footer-nav-btn ${activeTab === 'home' ? 'active-nav' : ''}`} 
              onClick={() => onNavigateTab?.('home')}
            >
              Home
            </button>
            <button 
              className={`footer-nav-btn ${activeTab === 'dashboard' ? 'active-nav' : ''}`} 
              onClick={() => onNavigateTab?.('dashboard')}
            >
              Dashboard
            </button>
            <button 
              className={`footer-nav-btn ${activeTab === 'projects' ? 'active-nav' : ''}`} 
              onClick={() => onNavigateTab?.('projects')}
            >
              Projects
            </button>
            <button 
              className={`footer-nav-btn ${activeTab === 'insights' ? 'active-nav' : ''}`} 
              onClick={() => onNavigateTab?.('insights')}
            >
              AI Insights
            </button>
            <button 
              className={`footer-nav-btn ${activeTab === 'action-centre' ? 'active-nav' : ''}`} 
              onClick={() => onNavigateTab?.('action-centre')}
            >
              Action Center
            </button>
            <button 
              className={`footer-nav-btn ${activeTab === 'distribution' ? 'active-nav' : ''}`} 
              onClick={() => onNavigateTab?.('distribution')}
            >
              Distribution
            </button>
          </div>
        </div>
      </div>

      {/* Bottom Copyright Bar */}
      <div className="footer-bottom-simple">
        <div className="footer-bottom-inner">
          <p>© 2026 Ministry of Statistics &amp; Programme Implementation (MoSPI), Government of India. All Rights Reserved.</p>
        </div>
      </div>
    </footer>
  );
};



