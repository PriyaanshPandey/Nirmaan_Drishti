import React, { useState } from "react";
import {
  ArrowUp, Bot, ChevronLeft, ChevronRight,
  LayoutDashboard, TrendingUp, Flame, ShieldAlert,
  Activity
} from "lucide-react";
import "./ProjectNavSidebar.css";

export type SidebarSection = "basic" | "forecasts" | "escalation" | "warnings";

export interface ProjectNavSidebarProps {
  activeSection: SidebarSection;
  onSelectSection: (section: SidebarSection) => void;
  warningsCount?: number;
  riskScore?: number;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
  onScrollToTop?: () => void;
  onOpenAIChat?: () => void;
}

const SECTIONS = [
  {
    id: "basic" as SidebarSection,
    icon: LayoutDashboard,
    label: "Basic Information",
    desc: "Cost, schedule & metadata",
    num: "01",
  },
  {
    id: "forecasts" as SidebarSection,
    icon: TrendingUp,
    label: "Forecasts",
    desc: "AI 3M predictions",
    num: "02",
  },
  {
    id: "escalation" as SidebarSection,
    icon: Flame,
    label: "Escalation Drivers",
    desc: "SHAP attributions & NLP",
    num: "03",
  },
  {
    id: "warnings" as SidebarSection,
    icon: ShieldAlert,
    label: "Early Warnings",
    desc: "Alerts & recommendations",
    num: "04",
  },
];

export const ProjectNavSidebar: React.FC<ProjectNavSidebarProps> = ({
  activeSection,
  onSelectSection,
  warningsCount = 0,
  riskScore,
  collapsed: externalCollapsed,
  onToggleCollapse,
  onScrollToTop,
  onOpenAIChat,
}) => {
  const [internalCollapsed, setInternalCollapsed] = useState(true);
  const isCollapsed = externalCollapsed !== undefined ? externalCollapsed : internalCollapsed;

  const handleToggle = () => {
    if (onToggleCollapse) {
      onToggleCollapse();
    } else {
      setInternalCollapsed(!internalCollapsed);
    }
  };

  const riskPct = riskScore ?? 0;
  const riskColor = riskPct >= 70 ? "#EF4444" : riskPct >= 50 ? "#F59E0B" : "#22C55E";
  const riskLabel = riskPct >= 70 ? "High Risk" : riskPct >= 50 ? "Moderate" : "On Track";

  const activeIdx = SECTIONS.findIndex(s => s.id === activeSection);

  return (
    <aside className={`pnav ${isCollapsed ? "pnav--collapsed" : ""}`} aria-label="Section Navigation">
      <div className="pnav__card">

        {/* ── Brand strip ── */}
        <div className="pnav__brand">
          {!isCollapsed && (
            <div className="pnav__brand-text">
              <Activity size={14} className="pnav__brand-icon" />
              <span>Project Analysis</span>
            </div>
          )}
          <button
            className="pnav__toggle"
            onClick={handleToggle}
            aria-label={isCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
            title={isCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
          >
            {isCollapsed
              ? <ChevronRight size={14} />
              : <ChevronLeft size={14} />
            }
          </button>
        </div>

        {/* ── Risk gauge (expanded only) ── */}
        {!isCollapsed && riskScore !== undefined && (
          <div className="pnav__gauge">
            <div className="pnav__gauge-row">
              <span className="pnav__gauge-label">Risk Score</span>
              <span className="pnav__gauge-val" style={{ color: riskColor }}>
                {riskLabel}
              </span>
            </div>
            <div className="pnav__gauge-num" style={{ color: riskColor }}>
              {riskScore}
              <span className="pnav__gauge-denom">/100</span>
            </div>
            <div className="pnav__gauge-track">
              <div
                className="pnav__gauge-fill"
                style={{ width: `${riskScore}%`, background: riskColor }}
              />
            </div>
          </div>
        )}

        <div className="pnav__sep" />

        {/* ── Nav items ── */}
        <nav className="pnav__nav">
          {SECTIONS.map((sec, idx) => {
            const isActive = activeSection === sec.id;
            const isPast = idx < activeIdx;
            const Icon = sec.icon;
            return (
              <button
                key={sec.id}
                className={`pnav__item ${isActive ? "pnav__item--active" : ""} ${isPast ? "pnav__item--past" : ""}`}
                onClick={() => onSelectSection(sec.id)}
                aria-current={isActive ? "page" : undefined}
                title={isCollapsed ? sec.label : undefined}
              >
                {/* Animated left pill */}
                <span className="pnav__pill" />

                {/* Step number */}
                {!isCollapsed && (
                  <span className={`pnav__num ${isActive ? "pnav__num--active" : ""}`}>
                    {sec.num}
                  </span>
                )}

                {/* Icon */}
                <span className={`pnav__icon ${isActive ? "pnav__icon--active" : ""}`}>
                  <Icon size={15} strokeWidth={isActive ? 2.5 : 1.75} />
                </span>

                {/* Text */}
                {!isCollapsed && (
                  <span className="pnav__text">
                    <span className="pnav__label">{sec.label}</span>
                    {isActive && (
                      <span className="pnav__desc pnav__desc--in">{sec.desc}</span>
                    )}
                  </span>
                )}

                {/* Badge */}
                {sec.id === "warnings" && warningsCount > 0 && (
                  <span className="pnav__badge">{warningsCount}</span>
                )}
              </button>
            );
          })}
        </nav>

        <div className="pnav__sep" style={{ marginTop: "auto" }} />

        {/* ── Footer ── */}
        <div className="pnav__footer">
          {onScrollToTop && (
            <button className="pnav__ftr-btn" onClick={onScrollToTop} title="Back to Top">
              <ArrowUp size={13} />
              {!isCollapsed && <span>Top</span>}
            </button>
          )}
          {onOpenAIChat && (
            <button className="pnav__ftr-btn pnav__ftr-btn--ai" onClick={onOpenAIChat} title="AI Copilot">
              <Bot size={13} />
              {!isCollapsed && <span>AI Copilot</span>}
            </button>
          )}
        </div>

      </div>
    </aside>
  );
};
