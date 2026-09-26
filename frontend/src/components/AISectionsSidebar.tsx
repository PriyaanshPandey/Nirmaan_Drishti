import React, { useState } from 'react';
import { 
  Cpu, 
  Layers, 
  Sparkles, 
  AlertTriangle, 
  ChevronLeft, 
  ChevronRight, 
  ArrowUp, 
  Bot, 
  Maximize2, 
  Minimize2,
  CheckCircle2,
  Activity
} from 'lucide-react';
import './AISectionsSidebar.css';
import { useLanguage } from '../context/LanguageContext';

export interface AISectionsSidebarProps {
  activeSection: string | null;
  openSections: {
    forecast: boolean;
    shap: boolean;
    nlp: boolean;
    earlyWarnings: boolean;
  };
  onSelectSection: (sectionId: 'forecast' | 'shap' | 'nlp' | 'earlyWarnings') => void;
  onToggleSection: (sectionId: 'forecast' | 'shap' | 'nlp' | 'earlyWarnings') => void;
  onExpandAll: () => void;
  onCollapseAll: () => void;
  onScrollToTop: () => void;
  onOpenAIChat?: () => void;
  warningsCount?: number;
}

export const AISectionsSidebar: React.FC<AISectionsSidebarProps> = ({
  activeSection,
  openSections,
  onSelectSection,
  onToggleSection,
  onExpandAll,
  onCollapseAll,
  onScrollToTop,
  onOpenAIChat,
  warningsCount = 2,
}) => {
  const { t } = useLanguage();
  const [isExpanded, setIsExpanded] = useState(() => {
    if (typeof window !== 'undefined') {
      return window.innerWidth >= 1480;
    }
    return true;
  });

  const sections = [
    {
      id: 'forecast' as const,
      num: '01',
      title: t('sec_forecast', 'AI Cost & Schedule Forecast'),
      subtext: t('sec_forecast_sub', 'PAIMANA Calibrated 3M ML predictions'),
      badge: 'XGBoost 3M Forecast',
      icon: Cpu,
      color: '#2563EB',
      bgColor: '#EFF6FF',
      borderColor: '#BFDBFE',
    },
    {
      id: 'shap' as const,
      num: '02',
      title: t('sec_shap', 'Explainable AI Analysis'),
      subtext: t('sec_shap_sub', 'TreeSHAP feature attributions & drivers'),
      badge: 'TreeSHAP Attributions',
      icon: Layers,
      color: '#03045E',
      bgColor: '#F1F5F9',
      borderColor: '#CBD5E1',
    },
    {
      id: 'nlp' as const,
      num: '03',
      title: t('sec_nlp', 'AI Natural Language Explanation'),
      subtext: t('sec_nlp_sub', 'Model-specific reasoning & delay dynamics'),
      badge: 'Qwen Reasoner',
      icon: Sparkles,
      color: '#7C3AED',
      bgColor: '#F5F3FF',
      borderColor: '#DDD6FE',
    },
    {
      id: 'earlyWarnings' as const,
      num: '04',
      title: t('sec_early_warnings', 'Early Warnings & Recommendations'),
      subtext: t('sec_early_warnings_sub', 'Telemetry anomaly flags & mitigation matrix'),
      badge: `${warningsCount} ${t('active_warnings_badge', 'Active Warnings')}`,
      icon: AlertTriangle,
      color: '#D62F39',
      bgColor: '#FEF2F2',
      borderColor: '#FECACA',
    },
  ];

  return (
    <aside 
      className={`ai-sidebar-container ${isExpanded ? 'sidebar-expanded' : 'sidebar-collapsed'}`}
      aria-label="AI Sections Navigator"
    >
      {/* Collapsed Mini Rail View */}
      {!isExpanded ? (
        <div className="ai-rail-wrapper">
          {/* Expand Toggle Button */}
          <button
            className="ai-rail-toggle-btn"
            onClick={() => setIsExpanded(true)}
            title={t('ai_engine_bar', 'Open AI Sections Bar')}
            aria-label={t('ai_engine_bar', 'Open AI Sections Bar')}
          >
            <Sparkles size={16} className="sparkle-spin-slow" />
            <span className="rail-vertical-text">{t('ai_modules', 'AI MODULES')}</span>
            <ChevronRight size={14} className="rail-chevron-icon" />
          </button>

          {/* Quick Icon Links */}
          <div className="ai-rail-icons-stack">
            {sections.map((sec) => {
              const Icon = sec.icon;
              const isActive = activeSection === sec.id;
              return (
                <button
                  key={sec.id}
                  className={`ai-rail-icon-btn ${isActive ? 'rail-btn-active' : ''}`}
                  onClick={() => onSelectSection(sec.id)}
                  title={`${sec.title} - Click to open`}
                  aria-label={`Open ${sec.title}`}
                  aria-current={isActive ? 'true' : undefined}
                  style={{ '--btn-theme-color': sec.color } as React.CSSProperties}
                >
                  <Icon size={18} color={isActive ? '#FFFFFF' : sec.color} />
                  <span className="rail-item-tooltip">{sec.title}</span>
                </button>
              );
            })}
          </div>

          <button
            className="ai-rail-icon-btn rail-top-btn"
            onClick={onScrollToTop}
            title={t('back_to_top', 'Back to Top')}
            aria-label={t('back_to_top', 'Back to Top')}
          >
            <ArrowUp size={15} />
          </button>
        </div>
      ) : (
        /* Expanded Full Navigation Drawer View */
        <div className="ai-drawer-wrapper">
          {/* Drawer Header */}
          <div className="ai-drawer-header">
            <div className="ai-drawer-header-left">
              <div className="ai-header-icon-box">
                <Activity size={18} color="#FFFFFF" />
              </div>
              <div>
                <div className="ai-drawer-title-row">
                  <h3 className="ai-drawer-title">{t('ai_engine_bar', 'AI Engine Bar')}</h3>
                  <span className="ai-drawer-badge">{t('ai_modules_count', '4 Modules')}</span>
                </div>
                <p className="ai-drawer-subtitle">{t('click_to_open', 'Click module to open & inspect')}</p>
              </div>
            </div>

            <button
              className="ai-drawer-collapse-btn"
              onClick={() => setIsExpanded(false)}
              title="Collapse sidebar to icon bar"
              aria-label="Collapse sidebar"
            >
              <ChevronLeft size={16} />
            </button>
          </div>

          {/* Quick Bulk Action Toggles */}
          <div className="ai-drawer-quick-actions">
            <button 
              className="ai-bulk-btn"
              onClick={onExpandAll}
              title={t('expand_all', 'Expand all 4 AI sections')}
            >
              <Maximize2 size={12} />
              <span>{t('expand_all', 'Expand All')}</span>
            </button>
            <button 
              className="ai-bulk-btn"
              onClick={onCollapseAll}
              title={t('collapse_all', 'Collapse all 4 AI sections')}
            >
              <Minimize2 size={12} />
              <span>{t('collapse_all', 'Collapse All')}</span>
            </button>
          </div>

          {/* 4 Section Navigation Cards */}
          <nav className="ai-drawer-nav-list">
            {sections.map((sec) => {
              const Icon = sec.icon;
              const isActive = activeSection === sec.id;
              const isOpen = openSections[sec.id];

              return (
                <div
                  key={sec.id}
                  className={`ai-nav-card ${isActive ? 'nav-card-active' : ''}`}
                  onClick={() => onSelectSection(sec.id)}
                  role="button"
                  tabIndex={0}
                  aria-current={isActive ? 'true' : undefined}
                  aria-expanded={isOpen}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      onSelectSection(sec.id);
                    }
                  }}
                  style={{
                    '--card-theme-color': sec.color,
                    '--card-theme-bg': sec.bgColor,
                    '--card-theme-border': sec.borderColor,
                  } as React.CSSProperties}
                >
                  {/* Left Color Indicator Bar */}
                  <div className="nav-card-indicator" />

                  {/* Card Icon & Number */}
                  <div className="nav-card-top-row">
                    <div className="nav-card-icon-wrap" style={{ backgroundColor: sec.bgColor, borderColor: sec.borderColor }}>
                      <Icon size={16} color={sec.color} />
                    </div>

                    <div className="nav-card-meta-wrap">
                      <span className="nav-card-num">{sec.num}</span>
                      <span className="nav-card-badge" style={{ color: sec.color, backgroundColor: sec.bgColor, borderColor: sec.borderColor }}>
                        {sec.badge}
                      </span>
                    </div>
                  </div>

                  {/* Card Title & Description */}
                  <div className="nav-card-body">
                    <h4 className="nav-card-title">{sec.title}</h4>
                    <p className="nav-card-subtext">{sec.subtext}</p>
                  </div>

                  {/* Card Bottom Status & Quick Toggle */}
                  <div className="nav-card-footer">
                    <span className="nav-card-status-pill">
                      {isOpen ? (
                        <>
                          <CheckCircle2 size={12} color="#16A34A" />
                          <span>{t('section_open', 'Open')}</span>
                        </>
                      ) : (
                        <span className="status-pill-collapsed">{t('section_collapsed', 'Collapsed')}</span>
                      )}
                    </span>

                    <button
                      className="nav-card-toggle-action"
                      onClick={(e) => {
                        e.stopPropagation();
                        onToggleSection(sec.id);
                      }}
                      title={isOpen ? t('section_fold', 'Collapse Section') : t('section_open', 'Open Section')}
                      aria-label={`${isOpen ? t('section_fold', 'Collapse') : t('section_open', 'Open')} ${sec.title}`}
                      aria-expanded={isOpen}
                    >
                      {isOpen ? t('section_fold', 'Fold') : t('section_open', 'Open')}
                    </button>
                  </div>
                </div>
              );
            })}
          </nav>

          {/* Drawer Footer Controls */}
          <div className="ai-drawer-footer">
            <button
              className="ai-footer-btn ai-footer-top-btn"
              onClick={onScrollToTop}
              title={t('back_to_top', 'Return to top of project dashboard')}
            >
              <ArrowUp size={14} />
              <span>{t('back_to_top', 'Back to Top')}</span>
            </button>

            {onOpenAIChat && (
              <button
                className="ai-footer-btn ai-footer-chat-btn"
                onClick={onOpenAIChat}
                title={t('ai_copilot', 'Open AI Intelligence Assistant Copilot')}
              >
                <Bot size={14} />
                <span>{t('ai_copilot', 'AI Copilot')}</span>
              </button>
            )}
          </div>
        </div>
      )}
    </aside>
  );
};
