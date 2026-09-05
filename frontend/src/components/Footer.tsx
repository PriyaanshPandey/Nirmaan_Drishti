import React from 'react';
import { ExternalLink, Globe, Cpu, Building2 } from 'lucide-react';
import './Footer.css';

interface FooterProps {
  onNavigateTab?: (tabId: string) => void;
}

export const Footer: React.FC<FooterProps> = ({ onNavigateTab }) => {
  return (
    <footer className="simple-govt-footer">
      <div className="footer-simple-container">
        {/* Left: Brand & External Government Links */}
        <div className="footer-brand-section">
          <div className="brand-header">
            <Building2 size={22} className="govt-icon" />
            <div>
              <span className="brand-title">NIRMAAN DRISHTI</span>
              <span className="brand-sub">MoSPI &amp; PAIMANA Infrastructure Intelligence Platform</span>
            </div>
          </div>

          <div className="official-link-row">
            <a 
              href="https://www.mospi.gov.in" 
              target="_blank" 
              rel="noopener noreferrer" 
              className="simple-link-pill"
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
            >
              <Cpu size={13} />
              <span>PAIMANA Platform</span>
              <ExternalLink size={11} />
            </a>
          </div>
        </div>

        {/* Right: Our App Pages */}
        <div className="footer-nav-section">
          <span className="nav-section-title">Quick Pages</span>
          <div className="nav-links-grid">
            <button onClick={() => onNavigateTab?.('home')}>Home</button>
            <button onClick={() => onNavigateTab?.('dashboard')}>Dashboard</button>
            <button onClick={() => onNavigateTab?.('projects')}>Projects</button>
            <button onClick={() => onNavigateTab?.('insights')}>AI Insights</button>
            <button onClick={() => onNavigateTab?.('action')}>Action Center</button>
            <button onClick={() => onNavigateTab?.('distribution')}>Distribution</button>
          </div>
        </div>
      </div>

      {/* Bottom Copyright Bar */}
      <div className="footer-bottom-simple">
        <p>© 2026 Ministry of Statistics &amp; Programme Implementation (MoSPI), Government of India. All Rights Reserved.</p>
      </div>
    </footer>
  );
};
