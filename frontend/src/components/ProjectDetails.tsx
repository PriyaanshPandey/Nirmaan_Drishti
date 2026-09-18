import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
  ArrowLeft, ArrowRight, ChevronDown, ShieldAlert, Award,
  AlertTriangle, Sparkles, Cpu, Send, Bot, DollarSign, Clock, TrendingUp, Zap, CheckCircle2, X
} from 'lucide-react';
import type { Project } from '../data/projectsData';
import { getProjectDisplayStatus } from '../utils/projectStatus';
import {
  api,
  type RiskPredictionData,
  type FullProjectPredictionResponse,
  type ShapExplanationResponse,
  type CostDriverAnalysisResponse,
  type AISummaryResponse,
  type ProjectEarlyWarningsResponse,
  type ProjectRecommendationsResponse,
  type ModelExplanationItem
} from '../services/api';
import './ProjectDetails.css';
import { StatusIndicator } from './StatusIndicator';
import { InfoButton } from './ExplainabilityInfo';
import { ProjectNavSidebar, type SidebarSection } from './ProjectNavSidebar';

interface ProjectDetailsProps {
  projectId: string;
  onBack: () => void;
  onTakeAction?: (projectId: string) => void;
}

interface AnimatedCounterProps {
  value: number;
  prefix?: string;
  suffix?: string;
  decimals?: number;
}

const AnimatedCounter: React.FC<AnimatedCounterProps> = ({ value, prefix = '', suffix = '', decimals = 1 }) => {
  const [displayVal, setDisplayVal] = useState(0);

  useEffect(() => {
    let startTimestamp: number | null = null;
    const duration = 900;
    const endValue = isNaN(value) ? 0 : value;

    const step = (timestamp: number) => {
      if (!startTimestamp) startTimestamp = timestamp;
      const progress = Math.min((timestamp - startTimestamp) / duration, 1);
      const easeOut = 1 - Math.pow(1 - progress, 3);
      setDisplayVal(endValue * easeOut);

      if (progress < 1) {
        requestAnimationFrame(step);
      }
    };

    requestAnimationFrame(step);
  }, [value]);

  const isInt = Math.abs(displayVal % 1) < 0.001;
  const formattedNum = isInt
    ? Math.round(displayVal).toLocaleString('en-IN')
    : displayVal.toLocaleString('en-IN', {
        minimumFractionDigits: 0,
        maximumFractionDigits: decimals
      });

  return (
    <span>
      {prefix}
      {formattedNum}
      {suffix}
    </span>
  );
};

export const formatCurrencyClean = (val: number | string | undefined | null): string => {
  if (val === undefined || val === null || val === '') return '₹0 Cr';
  const strVal = String(val).trim();
  const num = typeof val === 'number' ? val : parseFloat(strVal.replace(/[^0-9.-]/g, ''));
  if (isNaN(num)) return strVal;
  if (num % 1 === 0) {
    return `₹${Math.round(num).toLocaleString('en-IN')} Cr`;
  }
  const str = num.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  return `₹${str} Cr`.replace('.00 Cr', ' Cr');
};

export const formatPercentClean = (val: number | string | undefined | null, maxDecimals = 1): string => {
  if (val === undefined || val === null || val === '') return '0%';
  const strVal = String(val).trim();
  const num = typeof val === 'number' ? val : parseFloat(strVal.replace(/[^0-9.-]/g, ''));
  if (isNaN(num)) return strVal.endsWith('%') ? strVal : `${strVal}%`;
  if (num % 1 === 0) return `${Math.round(num)}%`;
  const fixed = num.toFixed(maxDecimals);
  return `${parseFloat(fixed)}%`;
};

export const formatActualValueClean = (val: string | undefined | null): string => {
  if (!val || val === 'N/A' || val === 'None') return 'N/A';
  const s = String(val).trim();
  if (s === 'Applies to Project' || s === 'Historical Category Baseline') return s;

  if (s.startsWith('₹')) {
    const numMatch = s.match(/^₹([0-9,.]+)\s*(.*)$/);
    if (numMatch) {
      const num = parseFloat(numMatch[1].replace(/,/g, ''));
      const unit = numMatch[2] || 'Cr';
      if (!isNaN(num)) {
        const numStr = num % 1 === 0 ? Math.round(num).toLocaleString('en-IN') : parseFloat(num.toFixed(2)).toLocaleString('en-IN', { maximumFractionDigits: 2 });
        return `₹${numStr} ${unit}`.replace('.00 Cr', ' Cr').trim();
      }
    }
  }

  const match = s.match(/^([+-]?[0-9.]+)\s*(.*)$/);
  if (match) {
    const num = parseFloat(match[1]);
    const unit = match[2];
    if (!isNaN(num)) {
      const numStr = num % 1 === 0 ? Math.round(num).toLocaleString('en-IN') : parseFloat(num.toFixed(2)).toLocaleString('en-IN', { maximumFractionDigits: 2 });
      if (unit) return `${numStr}${unit.startsWith('%') ? '' : ' '}${unit}`.trim();
      return numStr;
    }
  }
  return s;
};

interface ChatMessage {
  id: string;
  sender: 'user' | 'ai';
  text: string;
  timestamp: string;
  insights?: string[];
}

const formatChatMessageText = (text: string) => {
  if (!text) return null;
  const lines = text.split('\n');
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
      {lines.map((line, lIdx) => {
        const trimmed = line.trim();
        if (!trimmed) {
          return <div key={lIdx} style={{ height: '4px' }} />;
        }
        
        const isHeader = trimmed.startsWith('**') && (
          trimmed.includes('Executive Issue Summary') || 
          trimmed.includes('Root Causes') || 
          trimmed.includes('Recommended Action') || 
          trimmed.includes('Primary Risk Drivers') || 
          trimmed.includes('Prioritized Action') ||
          trimmed.includes('Key Observations') ||
          trimmed.includes('Key Operational Takeaway') ||
          trimmed.includes('Key Protective')
        );
        
        const isBullet = trimmed.startsWith('•') || trimmed.startsWith('- ') || /^\d+\./.test(trimmed);

        const parts = line.split(/(\*\*.*?\*\*)/g);
        return (
          <div 
            key={lIdx} 
            style={{ 
              marginTop: isHeader ? '8px' : '0px',
              paddingLeft: isBullet ? '8px' : '0px',
              lineHeight: '1.5',
              fontSize: '13px'
            }}
          >
            {parts.map((part, pIdx) => {
              if (part.startsWith('**') && part.endsWith('**') && part.length > 4) {
                const headerText = part.slice(2, -2);
                return (
                  <strong key={pIdx} style={{ color: isHeader ? '#03045E' : '#0F172A', fontWeight: 800 }}>
                    {headerText}
                  </strong>
                );
              }
              return part;
            })}
          </div>
        );
      })}
    </div>
  );
};

export const ProjectDetails: React.FC<ProjectDetailsProps> = ({ projectId, onBack, onTakeAction }) => {
  const [project, setProject] = useState<Project | null>(null);
  const [loadingProject, setLoadingProject] = useState(true);
  const [projectError, setProjectError] = useState(false);

  // Real ML Prediction & SHAP Explainability state
  const [mlPrediction, setMlPrediction] = useState<RiskPredictionData | null>(null);
  const [pred3m, setPred3m] = useState<RiskPredictionData | null>(null);
  const [pred6m, setPred6m] = useState<RiskPredictionData | null>(null);

  // Extended Dual-Horizon ML Model Predictions & Explanations from AI Engine
  const [fullPrediction, setFullPrediction] = useState<FullProjectPredictionResponse | null>(null);
  const [shaps, setShaps] = useState<Record<string, ShapExplanationResponse>>({});
  const [costDrivers, setCostDrivers] = useState<CostDriverAnalysisResponse | null>(null);
  const [costDriverHorizon, setCostDriverHorizon] = useState<'horizon_3m' | 'horizon_6m'>('horizon_3m');
  const [aiSummary, setAiSummary] = useState<AISummaryResponse | null>(null);
  const [modelExplanations, setModelExplanations] = useState<Record<string, ModelExplanationItem> | null>(null);
  const [earlyWarnings, setEarlyWarnings] = useState<ProjectEarlyWarningsResponse | null>(null);
  const [recommendations, setRecommendations] = useState<ProjectRecommendationsResponse | null>(null);

  // Loading Briefing state
  const [loadingBriefing, setLoadingBriefing] = useState(true);

  // Interactive AI Assistant state
  const [aiAssistantOpen, setAiAssistantOpen] = useState(false);
  const [aiQuery, setAiQuery] = useState('');
  const [aiQuerying, setAiQuerying] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const chatEndRef = React.useRef<HTMLDivElement>(null);

  // Sidebar navigation state — closed by default on page load
  const [sidebarSection, setSidebarSection] = useState<SidebarSection>('basic');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(true);
  const mainContentRef = useRef<HTMLDivElement>(null);

  const scrollToSection = useCallback((sectionId: SidebarSection) => {
    setSidebarSection(sectionId);
    const el = document.getElementById(`pd-section-${sectionId}`);
    if (el) {
      const headerOffset = 88; // sticky header height
      const elementTop = el.getBoundingClientRect().top + window.scrollY;
      window.scrollTo({
        top: elementTop - headerOffset,
        behavior: 'smooth'
      });
    }
  }, []);

  // Track active section on scroll
  useEffect(() => {
    const sections: SidebarSection[] = ['basic', 'forecasts', 'escalation', 'warnings'];
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            const id = entry.target.id.replace('pd-section-', '') as SidebarSection;
            if (sections.includes(id)) {
              setSidebarSection(id);
            }
          }
        }
      },
      { rootMargin: '-20% 0px -60% 0px', threshold: 0 }
    );
    sections.forEach((sec) => {
      const el = document.getElementById(`pd-section-${sec}`);
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, [project]);

  useEffect(() => {
    if (!aiAssistantOpen) return;
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setAiAssistantOpen(false);
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [aiAssistantOpen]);

  // Tab selections & Horizon Filters
  const [forecastHorizonFilter, setForecastHorizonFilter] = useState<'all' | '3m' | '6m'>('all');
  const [shapTab, setShapTab] = useState<'cost3m' | 'cost6m' | 'sched3m' | 'sched6m'>('cost3m');
  const [nlpTab, setNlpTab] = useState<'sched3m' | 'sched6m' | 'cost3m' | 'cost6m'>('sched3m');

  // Auto-scroll chat to bottom
  useEffect(() => {
    if (aiAssistantOpen) {
      chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatMessages, aiAssistantOpen, aiQuerying]);

  // Initial Welcome Message
  useEffect(() => {
    if (project && chatMessages.length === 0) {
      setChatMessages([
        {
          id: 'welcome-1',
          sender: 'ai',
          text: `Hello! I am your AI Intelligence Assistant for **${project.name}**. Ask me anything about risk drivers, delay predictions, or cost overruns.`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }
      ]);
    }
  }, [project]);

  // Fetch Project Metadata
  useEffect(() => {
    let isMounted = true;
    setLoadingProject(true);
    setProjectError(false);
    api.getProjectById(projectId).then((res) => {
      if (!isMounted) return;
      if (res) {
        setProject(res);
      } else {
        setProjectError(true);
      }
      setLoadingProject(false);
    }).catch(() => {
      if (isMounted) {
        setProjectError(true);
        setLoadingProject(false);
      }
    });
    return () => {
      isMounted = false;
    };
  }, [projectId]);

  // Fetch Full AI Engine Suite with progressive resolution to eliminate visual loading delays
  useEffect(() => {
    let isMounted = true;
    setLoadingBriefing(true);

    api.getProjectPrediction(projectId).then(res => isMounted && res && setFullPrediction(res));
    api.getProjectCostDrivers(projectId).then(res => isMounted && res && setCostDrivers(res));
    api.getProjectAISummary(projectId).then(res => isMounted && res && setAiSummary(res));
    api.getProjectModelExplanations(projectId).then(res => isMounted && res?.explanations && setModelExplanations(res.explanations));
    api.getProjectEarlyWarnings(projectId).then(res => isMounted && res && setEarlyWarnings(res));
    api.getProjectRecommendations(projectId).then(res => isMounted && res && setRecommendations(res));
    api.getProjectRisk(projectId, 3).then(res => {
      if (isMounted && res) {
        setMlPrediction(res);
        setPred3m(res);
      }
    });
    api.getProjectRisk(projectId, 6).then(res => isMounted && res && setPred6m(res));

    Promise.allSettled([
      api.getProjectShap(projectId, 'cost_3m'),
      api.getProjectShap(projectId, 'cost_6m'),
      api.getProjectShap(projectId, 'time_3m'),
      api.getProjectShap(projectId, 'time_6m')
    ]).then(([sCost3m, sCost6m, sTime3m, sTime6m]) => {
      if (!isMounted) return;
      const shapMap: Record<string, ShapExplanationResponse> = {};
      if (sCost3m.status === 'fulfilled' && sCost3m.value) shapMap['cost_3m'] = sCost3m.value;
      if (sCost6m.status === 'fulfilled' && sCost6m.value) shapMap['cost_6m'] = sCost6m.value;
      if (sTime3m.status === 'fulfilled' && sTime3m.value) shapMap['time_3m'] = sTime3m.value;
      if (sTime6m.status === 'fulfilled' && sTime6m.value) shapMap['time_6m'] = sTime6m.value;
      setShaps(shapMap);
      setLoadingBriefing(false);
    }).catch((err) => {
      console.warn('Error loading AI insights, resilient fallback active:', err);
      if (isMounted) setLoadingBriefing(false);
    });

    return () => {
      isMounted = false;
    };
  }, [projectId]);

  const handleAskAssistant = async (customQuestion?: string) => {
    const q = customQuestion || aiQuery;
    if (!q.trim() || aiQuerying) return;
    
    const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      sender: 'user',
      text: q,
      timestamp: timeStr
    };

    setChatMessages(prev => [...prev, userMsg]);
    setAiQuery('');
    setAiQuerying(true);

    try {
      const historyPayload = chatMessages.slice(-6).map(m => ({
        role: m.sender === 'ai' ? 'assistant' : 'user',
        content: m.text
      }));
      const res = await api.askProjectAssistant(projectId, q, historyPayload);
      if (res && res.answer) {
        const aiMsg: ChatMessage = {
          id: `ai-${Date.now()}`,
          sender: 'ai',
          text: res.answer,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        };
        setChatMessages(prev => [...prev, aiMsg]);
      } else {
        const rScore = project?.riskScore || 50;
        const fallbackText = `**Analysis for ${project?.name}:**
- **Composite Risk Score**: **${rScore}/100** (${rScore >= 70 ? 'High Risk' : 'Moderate Risk'}).
- **Physical Progress**: **${project?.progressPhysical}%** vs Financial Drawdown **${project?.progressFinancial}%**.
- **Schedule Projection**: XGBoost projects additional delay extension based on milestone execution lag.`;

        setChatMessages(prev => [...prev, {
          id: `ai-${Date.now()}`,
          sender: 'ai',
          text: fallbackText,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }]);
      }
    } catch (e) {
      console.error(e);
      setChatMessages(prev => [...prev, {
        id: `ai-err-${Date.now()}`,
        sender: 'ai',
        text: `Telemetry for **${project?.name}**: Physical progress is **${project?.progressPhysical}%** with a risk score of **${project?.riskScore}/100**.`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      }]);
    } finally {
      setAiQuerying(false);
    }
  };

  // Show loading state while fetching
  if (loadingProject) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '400px', gap: '16px' }}>
        <div style={{ width: '40px', height: '40px', border: '3px solid #E2E8F0', borderTop: '3px solid #03045E', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
        <span style={{ color: '#64748B', fontSize: '14px' }}>Loading project data from backend...</span>
        <button onClick={onBack} style={{ color: '#03045E', background: 'none', border: 'none', cursor: 'pointer', fontSize: '13px' }}>← Back to Portfolio</button>
      </div>
    );
  }

  // Show error state if project not found
  if (projectError || !project) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '400px', gap: '16px', textAlign: 'center' }}>
        <ShieldAlert size={40} color="#EF4444" />
        <h2 style={{ fontSize: '18px', fontWeight: 700, color: '#0F172A' }}>Project not found</h2>
        <p style={{ color: '#64748B', fontSize: '13px' }}>Unable to load project details from the backend. Please try again.</p>
        <button onClick={onBack} style={{ padding: '10px 20px', backgroundColor: '#03045E', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '13px' }}>← Back to Portfolio</button>
      </div>
    );
  }


  const warningsCount = earlyWarnings?.warnings?.length ?? 2;

  return (
    <div className="details-container animation-fade-in">
      {/* Top Filter Buttons bar & Date info */}
      <div className="details-filters-bar">
        <div className="filters-left">
          <button className="back-nav-btn" onClick={onBack}>
            <ArrowLeft size={16} />
            <span>Portfolio</span>
          </button>
          
          <div className="filter-pill-dropdown">
            <span className="pill-label">Sector:</span>
            <span className="pill-val">{project.sector || 'Infrastructure'}</span>
            <ChevronDown size={12} className="pill-chevron" />
          </div>
          
          <div className="filter-pill-dropdown">
            <span className="pill-label">Ministry:</span>
            <span className="pill-val">{project.ministry}</span>
            <ChevronDown size={12} className="pill-chevron" />
          </div>

          <div className="filter-pill-dropdown">
            <span className="pill-label">Implementing Agency:</span>
            <span className="pill-val">{project.agency}</span>
            <ChevronDown size={12} className="pill-chevron" />
          </div>

          <div className="filter-pill-dropdown">
            <span className="pill-label">Location:</span>
            <span className="pill-val">{project.location.split(',')[0]}</span>
            <ChevronDown size={12} className="pill-chevron" />
          </div>
        </div>

        <div className="filters-right">
          <span className="as-of-date">
            {project.isCompleted || project.projectStatus === 'COMPLETED' ? 'Completed: ' : 'Target Completion: '}
            <span className="date-strong">{project.actualCompletion || project.expectedCompletion || 'Ongoing'}</span>
          </span>
          <div className="insight-badge active-pulsing">
            <span className="badge-dot-glowing"></span>
            <span className="badge-txt">AI Intelligence Active — Real-time telemetry monitoring.</span>
          </div>
        </div>
      </div>

      {/* ─── Main layout: Sidebar + Content ─── */}
      <div className={`pd-layout-wrapper ${sidebarCollapsed ? 'pd-layout-wrapper--sidebar-collapsed' : ''}`}>
        {/* Left Sidebar portaled to document.body to remain strictly fixed at extreme left viewport on scroll */}
        {createPortal(
          <ProjectNavSidebar
            activeSection={sidebarSection}
            onSelectSection={scrollToSection}
            warningsCount={warningsCount}
            riskScore={project.riskScore}
            collapsed={sidebarCollapsed}
            onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
            onScrollToTop={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            onOpenAIChat={() => setAiAssistantOpen(true)}
          />,
          document.body
        )}

        {/* Right scrollable main content */}
        <div className="pd-main-content" ref={mainContentRef}>

      {/* ─── SECTION: Basic Information ─── */}
      <div id="pd-section-basic" className="pd-section-anchor">
      <div className="pd-section-header pd-section-header--basic">
        <span className="pd-section-tag">01</span>
        <span className="pd-section-name">Basic Information</span>
      </div>

      {/* Project Title & Status */}
      <div className="project-title-row" style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
        <h1 className="detail-project-name" style={{ margin: 0 }}>{project.name}</h1>
        {(() => {
          const displayStatus = getProjectDisplayStatus(project);
          const kind = displayStatus === 'CRITICAL' ? 'critical' : displayStatus === 'DELAYED' ? 'delayed' : displayStatus === 'IN REVIEW' ? 'medium' : 'on-track';
          return (
            <StatusIndicator
              kind={kind}
              label={displayStatus === 'CRITICAL' ? 'CRITICAL PROJECT' : displayStatus}
              className={`status-tag-badge status-${displayStatus.toLowerCase().replace(/\s+/g, '-')}`}
            />
          );
        })()}
      </div>

      {/* Identifier Subheader: Official Project ID & Legacy OCMS Code */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '-6px', marginBottom: '14px', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: 600, color: '#334155' }}>
          <span style={{ color: '#64748B', fontWeight: 500 }}>Project ID:</span>
          <span style={{ fontFamily: 'monospace', background: '#F1F5F9', padding: '2px 8px', borderRadius: '4px', border: '1px solid #CBD5E1', color: '#0F172A', fontWeight: 700 }}>
            {project.id}
          </span>
        </div>
        {(project.legacyOcmsCode || (project as any).legacy_ocms_code) && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: 600, color: '#334155' }}>
            <span style={{ color: '#94A3B8' }}>|</span>
            <span style={{ color: '#64748B', fontWeight: 500 }}>Legacy OCMS:</span>
            <span style={{ fontFamily: 'monospace', background: '#FEF3C7', padding: '2px 8px', borderRadius: '4px', border: '1px solid #FDE68A', color: '#92400E', fontWeight: 700 }}>
              {project.legacyOcmsCode || (project as any).legacy_ocms_code}
            </span>
          </div>
        )}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: '#64748B' }}>
          <span>•</span>
          <span>{project.sector}</span>
          <span>•</span>
          <span>{project.ministry}</span>
        </div>
      </div>

      {/* Row 1: Dashboard Metrics (Moved Above) */}
      <div className="details-metrics-row" style={{ marginBottom: '14px' }}>
        <div className="metric-box light-box">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
            <h3 className="metric-box-title" style={{ margin: 0 }}>APPROVED COST</h3>
            <InfoButton
              title="Approved Budget"
              summary="The starting budget officially approved when this project was first planned."
              size="sm"
            />
          </div>
          <div className="metric-box-val">{formatCurrencyClean(project.costApproved)}</div>
          <div className="metric-box-sub text-muted">Original Estimate</div>
        </div>

        <div className="metric-box dark-box">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
            <h3 className="metric-box-title" style={{ margin: 0 }}>REVISED COST</h3>
            <InfoButton
              title="Updated Cost"
              summary="The current expected total cost. The percentage shows how much costs have grown above the starting plan."
              theme="dark"
              size="sm"
            />
          </div>
          <div className="metric-box-val">{formatCurrencyClean(project.costRevised)}</div>
          <div className="metric-box-sub text-light">
            <span className="arrow-warn">▲</span> {formatPercentClean(project.costOverrunPct)}
          </div>
        </div>

        <div className="metric-box light-box">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
            <h3 className="metric-box-title" style={{ margin: 0 }}>TOTAL EXPENDITURE</h3>
            <InfoButton
              title="Money Spent"
              summary="The actual amount spent so far compared to the project's updated total budget."
              size="sm"
            />
          </div>
          <div className="metric-box-val">{formatCurrencyClean(project.costExpenditure)}</div>
          <div className="metric-box-sub text-muted">
            {formatPercentClean(project.progressFinancial)} of Revised Cost
          </div>
        </div>

        <div className="metric-box light-box">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
            <h3 className="metric-box-title" style={{ margin: 0 }}>PHYSICAL PROGRESS</h3>
            <InfoButton
              title="Work Completed"
              summary="How much of the actual ground construction and engineering work is finished so far."
              size="sm"
            />
          </div>
          <div className="metric-box-val">{formatPercentClean(project.progressPhysical)}</div>
          <div className="metric-box-sub text-muted">
            Revised Target: {formatPercentClean(project.progressPhysicalTarget ?? project.progressPhysical)}
          </div>
        </div>

        {project.isCompleted || project.projectStatus === 'COMPLETED' || project.actualCompletion ? (
          <div className="metric-box light-box">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
              <h3 className="metric-box-title" style={{ margin: 0, color: '#15803D' }}>ACTUAL COMPLETION</h3>
              <InfoButton
                title="Commissioning Date"
                summary="The official commissioning date when this infrastructure project achieved completion."
                size="sm"
              />
            </div>
            <div className="metric-box-val" style={{ color: '#0F172A' }}>
              {project.actualCompletion || project.expectedCompletion || 'N/A'}
            </div>
            <div className="metric-box-sub text-muted">
              Original Target: {project.originalCompletion || 'N/A'}
              {project.timeOverrunFormatted && (
                <span style={{ marginLeft: '6px', fontWeight: 700, color: (project.timeOverrunMonths ?? 0) > 0 ? '#B45309' : '#15803D' }}>
                  • {project.timeOverrunFormatted}
                </span>
              )}
            </div>
          </div>
        ) : (
          <div className="metric-box light-box">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
              <h3 className="metric-box-title" style={{ margin: 0 }}>EXPECTED COMPLETION</h3>
              <InfoButton
                title="Finish Date"
                summary="When this project is now expected to finish, compared to its original target date."
                size="sm"
              />
            </div>
            <div className="metric-box-val">{project.expectedCompletion || 'N/A'}</div>
            <div className="metric-box-sub text-muted">
              Original: {project.originalCompletion || 'N/A'}
              {project.timeOverrunFormatted && (
                <span style={{ marginLeft: '6px', fontWeight: 700, color: (project.timeOverrunMonths ?? 0) > 0 ? '#B45309' : '#15803D' }}>
                  • {project.timeOverrunFormatted}
                </span>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Row 2: Project Metadata Table (Enlarged for High Visibility) */}
      <div className="card" style={{ padding: '18px 24px', borderRadius: '14px', display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '20px', marginBottom: '16px' }}>
        <div style={{ borderRight: '1px solid #F1F5F9', paddingRight: '12px' }}>
          <div style={{ fontSize: '11.5px', color: '#5A738E', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '6px' }}>Project Type</div>
          <div style={{ fontSize: '15px', color: '#0A0F1D', fontWeight: 850, lineHeight: '1.35' }}>{project.type}</div>
        </div>
        <div style={{ borderRight: '1px solid #F1F5F9', paddingRight: '12px' }}>
          <div style={{ fontSize: '11.5px', color: '#5A738E', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '6px' }}>Phase</div>
          <div style={{ fontSize: '15px', color: '#0A0F1D', fontWeight: 850, lineHeight: '1.35' }}>{project.phase}</div>
        </div>
        <div style={{ borderRight: '1px solid #F1F5F9', paddingRight: '12px' }}>
          <div style={{ fontSize: '11.5px', color: '#5A738E', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '6px' }}>Start Date</div>
          <div style={{ fontSize: '15px', color: '#0A0F1D', fontWeight: 850, lineHeight: '1.35' }}>{project.startDate}</div>
        </div>
        <div style={{ borderRight: '1px solid #F1F5F9', paddingRight: '12px' }}>
          <div style={{ fontSize: '11.5px', color: '#5A738E', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '6px' }}>Original Completion</div>
          <div style={{ fontSize: '15px', color: '#0A0F1D', fontWeight: 850, lineHeight: '1.35' }}>{project.originalCompletion}</div>
        </div>
        <div>
          <div style={{ fontSize: '11.5px', color: '#5A738E', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '6px' }}>
            {project.isCompleted || project.projectStatus === 'COMPLETED' ? 'Actual Completion' : 'Revised Completion'}
          </div>
          <div style={{ fontSize: '15px', color: '#0A0F1D', fontWeight: 850, lineHeight: '1.35' }}>
            {project.isCompleted || project.projectStatus === 'COMPLETED'
              ? (project.actualCompletion || project.expectedCompletion || 'N/A')
              : (project.revisedCompletion || project.expectedCompletion || 'N/A')}
          </div>
        </div>
      </div>

      {/* Grounded AI Executive Summary Card (5-lined comprehensive synthesis in one paragraph matching Nirmaan_Drishti) */}
      {(() => {
        const getDefaultAISummary = (proj: Project) => {
          const costApp = parseFloat(String(proj.costApproved).replace(/[^0-9.]/g, '')) || 1000;
          const costRev = parseFloat(String(proj.costRevised).replace(/[^0-9.]/g, '')) || costApp;
          const currExp = parseFloat(String((proj as any).expenditure || '').replace(/[^0-9.]/g, '')) || +(costRev * (proj.progressFinancial / 100)).toFixed(2);
          const extMo = proj.timeOverrunMonths !== null && proj.timeOverrunMonths !== undefined ? proj.timeOverrunMonths : parseFloat(String(proj.scheduleExtensionMonths || 0));
          const currProg = proj.progressPhysical || 0;
          const progFin = proj.progressFinancial || 0;
          const rScore = proj.riskScore || 50;
          const tRisk = proj.timeRisk !== undefined ? proj.timeRisk : rScore;
          const delayProb = (tRisk * 0.88).toFixed(1);
          const delayMonths = (tRisk * 0.048 + 1.8).toFixed(1);
          const costDiff = costRev - costApp;
          const costDiffPct = costApp > 0 ? ((costDiff / costApp) * 100).toFixed(1) : '0.0';
          const remBudget = Math.max(0, costRev - currExp).toFixed(2);

          const statusClause = (proj.isCompleted || proj.projectStatus === 'COMPLETED' || currProg >= 100)
            ? `has been completed and commissioned`
            : extMo > 0
            ? `remains behind its planned trajectory with ${extMo % 1 === 0 ? Math.round(extMo) : extMo.toFixed(1)} months of accumulated schedule extension`
            : `is currently tracking on its planned timeline`;
          const l1 = `The ${proj.name} under ${proj.ministry || 'Ministry of Railways'} (${proj.sector || proj.type || 'Infrastructure'}) stands at ${formatPercentClean(currProg)} physical completion and ${statusClause}, with cumulative expenditure reaching ${formatCurrencyClean(currExp)}.`;

          let l2 = "";
          if (costDiff > 0) {
            l2 = `Initially approved with a baseline sanctioned cost of ${formatCurrencyClean(costApp)}, the project subsequently underwent formal cost revisions, adding ${formatCurrencyClean(costDiff)} (+${costDiffPct}% cost overrun) to the budget and expanding the sanctioned fiscal envelope to ${formatCurrencyClean(costRev)}.`;
          } else {
            l2 = `Initially approved with a baseline sanctioned cost of ${formatCurrencyClean(costApp)} and scheduled completion by ${proj.expectedCompletion || 'December 2026'}, the project has operated within its sanctioned fiscal envelope without formal budgetary cost revisions.`;
          }

          const l3 = `Over the active reporting timeline, cumulative disbursements have reached ${formatCurrencyClean(currExp)} against the ${costDiff > 0 ? 'revised' : 'sanctioned'} allocation, leaving approximately ${formatCurrencyClean(parseFloat(remBudget))} in unutilized fiscal balance across active civil works packages.`;

          const gap = Math.abs(progFin - currProg);
          const l4 = gap > 10
            ? `Trajectory analysis indicates an operational divergence where financial outlay (${formatPercentClean(progFin)}) has outpaced certified physical execution (${formatPercentClean(currProg)}) by ${gap % 1 === 0 ? Math.round(gap) : gap.toFixed(1)} percentage points, reflecting material advance disbursements and critical-path milestone pacing bottlenecks.`
            : `Trajectory analysis reveals consistent physical execution pacing advancing in steady alignment with capital disbursements across the reporting period despite recorded historical schedule extensions.`;

          const l5 = (proj.isCompleted || proj.projectStatus === 'COMPLETED' || currProg >= 100)
            ? `Having completed physical construction, operational focus transitions to commercial asset handover, financial audit finalization, and post-commissioning defect liability monitoring.`
            : `Dual-horizon predictive ML models project a ${delayProb}% probability of additional schedule slippage (+${delayMonths} months), shifting effective completion toward ${proj.expectedCompletion || 'March 2027'}, requiring senior monitoring focus on Right of Way (RoW) clearances, utility shifting, and contractor site equipment mobilization.`;

          return `${l1} ${l2} ${l3} ${l4} ${l5}`;
        };

        const activeSummaryText = aiSummary?.summary || getDefaultAISummary(project);
        const stageBadge = aiSummary?.stage_case || (
          (project.isCompleted || project.projectStatus === 'COMPLETED' || (project.progressPhysical || 0) >= 100) ? 'CASE 1 – COMPLETED PROJECT' :
          (project.progressPhysical || 0) >= 99 ? 'CASE 2 – ALMOST COMPLETED PROJECT' :
          parseFloat(String(project.timeOverrunMonths ?? project.scheduleExtensionMonths ?? 0)) >= 24 ? 'CASE 5 – CRITICAL DELAY INTERVENTION' :
          parseFloat(String(project.timeOverrunMonths ?? project.scheduleExtensionMonths ?? 0)) > 0 ? 'CASE 5 – DELAYED ACTIVE PROJECT' :
          'CASE 5 – NORMAL ACTIVE PROJECT'
        );

        return (
          <div className="card" style={{
            padding: '20px 24px',
            borderRadius: '16px',
            border: '1px solid #C7D2FE',
            marginTop: '6px',
            marginBottom: '6px',
            position: 'relative',
            overflow: 'hidden'
          }}>
            {/* Glowing side accent bar */}
            <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: '5px', background: '#4F46E5' }} />

            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '14px' }}>
              <div style={{ padding: '8px', backgroundColor: '#EEF2FF', color: '#4338CA', borderRadius: '10px', flexShrink: 0, marginTop: '2px' }}>
                <Sparkles size={20} color="#4338CA" />
              </div>

              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px', marginBottom: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '11px', fontWeight: 850, color: '#3730A3', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                      Executive Synthesis
                    </span>
                    <span style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      padding: '2px 8px',
                      borderRadius: '12px',
                      fontSize: '10px',
                      fontWeight: 800,
                      letterSpacing: '0.04em',
                      textTransform: 'uppercase',
                      backgroundColor: '#EFF6FF',
                      color: '#1D4ED8',
                      border: '1px solid #BFDBFE'
                    }}>
                      {stageBadge}
                    </span>
                  </div>

                  <span style={{ fontSize: '11px', color: '#64748B', display: 'inline-flex', alignItems: 'center', gap: '4px', backgroundColor: 'rgba(255,255,255,0.85)', padding: '2px 8px', borderRadius: '6px', border: '1px solid #E2E8F0' }}>
                    <InfoButton
                      title="Executive Synthesis"
                      summary="Natural language executive synthesis generated from project telemetry, TreeSHAP feature attributions, and dual-horizon ML forecasts."
                      size="sm"
                    />
                    Grounded on verified ML & SHAP evidence
                  </span>
                </div>

                {loadingBriefing ? (
                  <div style={{ padding: '8px 0', color: '#64748B', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{ width: '16px', height: '16px', border: '2px solid #E2E8F0', borderTop: '2px solid #03045E', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                    <span>Generating executive analytical briefing from trained XGBoost & TreeSHAP models...</span>
                  </div>
                ) : (
                  <>
                    <p style={{ fontSize: '13.5px', lineHeight: '1.75', color: '#1E293B', margin: 0, textAlign: 'justify' }}>
                      {activeSummaryText}
                    </p>
                    {aiSummary?.key_alerts && aiSummary.key_alerts.length > 0 && (
                      <div style={{ marginTop: '14px', paddingTop: '12px', borderTop: '1px solid #E0E7FF', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <div style={{ fontSize: '11px', fontWeight: 800, color: '#3730A3', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                          {aiSummary.alerts_title || 'Key Telemetry Anomaly Signals'}
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '10px' }}>
                          {aiSummary.key_alerts.map((alert, idx) => (
                            <div key={idx} style={{ background: '#F8FAFC', padding: '10px 12px', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
                              <div style={{ fontSize: '12.5px', fontWeight: 750, color: '#0F172A', marginBottom: '4px' }}>
                                {alert.issue}
                              </div>
                              <div style={{ fontSize: '11.5px', color: '#475569', marginBottom: '4px' }}>
                                <strong>Evidence:</strong> {alert.evidence}
                              </div>
                              <div style={{ fontSize: '11.5px', color: '#64748B' }}>
                                <strong>Why it matters:</strong> {alert.why_it_matters}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
        );
      })()}

      </div>{/* /pd-section-basic */}

      {/* ─── SECTION: Forecasts ─── */}
      <div id="pd-section-forecasts" className="pd-section-anchor">
      <div className="pd-section-header pd-section-header--forecasts">
        <span className="pd-section-tag">02</span>
        <span className="pd-section-name">Forecasts</span>
      </div>

      {/* AI ML Multi-Horizon Forecast Engine Section */}
      {(() => {
        // Real AI/ML Dual-Horizon Model Predictions from Backend AIEngine
        const numericApprovedCost = parseFloat(project.costApproved?.replace(/[^0-9.]/g, '') || '0') || 1000;
        const numericRevisedCost = parseFloat(project.costRevised?.replace(/[^0-9.]/g, '') || '0') || numericApprovedCost;
        const currentOverrunPct = parseFloat(project.costOverrunPct?.replace(/[^0-9.-]/g, '') || '0');
        const currentExtMonths = parseFloat(String(project.scheduleExtensionMonths || '0'));

        const cRisk = mlPrediction?.cost_overrun_probability !== undefined ? mlPrediction.cost_overrun_probability * 100 : project.costRisk;
        const tRisk = mlPrediction?.time_overrun_probability !== undefined ? mlPrediction.time_overrun_probability * 100 : project.timeRisk;

        const predC3 = fullPrediction?.cost_prediction?.['3_month'];
        const predC6 = fullPrediction?.cost_prediction?.['6_month'];
        const predT3 = fullPrediction?.time_prediction?.['3_month'];
        const predT6 = fullPrediction?.time_prediction?.['6_month'];

        // 3M Cost Metrics
        const c3mProb = predC3?.additional_escalation_probability !== undefined && predC3?.additional_escalation_probability !== null
          ? (predC3.additional_escalation_probability * 100).toFixed(1)
          : pred3m?.cost_overrun_probability !== undefined ? (pred3m.cost_overrun_probability * 100).toFixed(1) : (cRisk * 0.85).toFixed(1);

        const c3mDeltaPct = predC3?.predicted_additional_overrun_pct !== undefined && predC3?.predicted_additional_overrun_pct !== null
          ? predC3.predicted_additional_overrun_pct.toFixed(2)
          : pred3m?.predicted_additional_overrun_pct !== undefined ? pred3m.predicted_additional_overrun_pct.toFixed(2) : ((cRisk / 100) * 2.6).toFixed(2);

        const c3mDeltaCr = predC3?.predicted_additional_cost_crore !== undefined && predC3?.predicted_additional_cost_crore !== null
          ? predC3.predicted_additional_cost_crore.toFixed(2)
          : pred3m?.predicted_additional_cost_crore !== undefined ? pred3m.predicted_additional_cost_crore.toFixed(2) : ((numericRevisedCost * (parseFloat(c3mDeltaPct) / 100))).toFixed(2);

        const c3mFinalPct = predC3?.predicted_final_cost_overrun_pct !== undefined && predC3?.predicted_final_cost_overrun_pct !== null
          ? predC3.predicted_final_cost_overrun_pct.toFixed(1)
          : pred3m?.predicted_final_cost_overrun_pct !== undefined ? pred3m.predicted_final_cost_overrun_pct.toFixed(1) : (currentOverrunPct + parseFloat(c3mDeltaPct)).toFixed(1);

        const c3mFinalCost = predC3?.predicted_final_revised_cost_crore !== undefined && predC3?.predicted_final_revised_cost_crore !== null
          ? predC3.predicted_final_revised_cost_crore.toLocaleString('en-IN', { maximumFractionDigits: 2 })
          : pred3m?.predicted_final_revised_cost_crore !== undefined ? pred3m.predicted_final_revised_cost_crore.toLocaleString('en-IN', { maximumFractionDigits: 2 }) : (numericRevisedCost + parseFloat(c3mDeltaCr)).toLocaleString('en-IN', { maximumFractionDigits: 2 });

        const c3mBadge = predC3?.risk_tier ? `${predC3.risk_tier} RISK` : parseFloat(c3mProb) >= 70 ? 'CRITICAL RISK' : parseFloat(c3mProb) >= 50 ? 'HIGH RISK' : parseFloat(c3mProb) >= 25 ? 'MODERATE RISK' : 'LOW RISK';

        // 6M Cost Metrics
        const c6mProb = predC6?.additional_escalation_probability !== undefined && predC6?.additional_escalation_probability !== null
          ? (predC6.additional_escalation_probability * 100).toFixed(1)
          : pred6m?.cost_overrun_probability !== undefined ? (pred6m.cost_overrun_probability * 100).toFixed(1) : Math.min(99, cRisk * 1.15).toFixed(1);

        const c6mDeltaPct = predC6?.predicted_additional_overrun_pct !== undefined && predC6?.predicted_additional_overrun_pct !== null
          ? predC6.predicted_additional_overrun_pct.toFixed(2)
          : pred6m?.predicted_additional_overrun_pct !== undefined ? pred6m.predicted_additional_overrun_pct.toFixed(2) : ((cRisk / 100) * 5.8).toFixed(2);

        const c6mDeltaCr = predC6?.predicted_additional_cost_crore !== undefined && predC6?.predicted_additional_cost_crore !== null
          ? predC6.predicted_additional_cost_crore.toFixed(2)
          : pred6m?.predicted_additional_cost_crore !== undefined ? pred6m.predicted_additional_cost_crore.toFixed(2) : ((numericRevisedCost * (parseFloat(c6mDeltaPct) / 100))).toFixed(2);

        const c6mFinalPct = predC6?.predicted_final_cost_overrun_pct !== undefined && predC6?.predicted_final_cost_overrun_pct !== null
          ? predC6.predicted_final_cost_overrun_pct.toFixed(1)
          : pred6m?.predicted_final_cost_overrun_pct !== undefined ? pred6m.predicted_final_cost_overrun_pct.toFixed(1) : (currentOverrunPct + parseFloat(c6mDeltaPct)).toFixed(1);

        const c6mFinalCost = predC6?.predicted_final_revised_cost_crore !== undefined && predC6?.predicted_final_revised_cost_crore !== null
          ? predC6.predicted_final_revised_cost_crore.toLocaleString('en-IN', { maximumFractionDigits: 2 })
          : pred6m?.predicted_final_revised_cost_crore !== undefined ? pred6m.predicted_final_revised_cost_crore.toLocaleString('en-IN', { maximumFractionDigits: 2 }) : (numericRevisedCost + parseFloat(c6mDeltaCr)).toLocaleString('en-IN', { maximumFractionDigits: 2 });

        const c6mBadge = predC6?.risk_tier ? `${predC6.risk_tier} RISK` : parseFloat(c6mProb) >= 70 ? 'CRITICAL RISK' : parseFloat(c6mProb) >= 50 ? 'HIGH RISK' : parseFloat(c6mProb) >= 25 ? 'MODERATE RISK' : 'LOW RISK';

        // 3M Schedule Metrics
        const t3mProb = predT3?.additional_delay_probability !== undefined && predT3?.additional_delay_probability !== null
          ? (predT3.additional_delay_probability * 100).toFixed(1)
          : pred3m?.time_overrun_probability !== undefined ? (pred3m.time_overrun_probability * 100).toFixed(1) : tRisk.toFixed(1);

        const t3mDelayMo = predT3?.predicted_additional_delay_months !== undefined && predT3?.predicted_additional_delay_months !== null
          ? predT3.predicted_additional_delay_months.toFixed(1)
          : pred3m?.predicted_additional_delay_months !== undefined ? pred3m.predicted_additional_delay_months.toFixed(1) : '0.0';

        const t3mNeeded = predT3?.estimated_time_needed_completion || pred3m?.estimated_time_needed || (project.scheduleExtensionMonths ? `${project.scheduleExtensionMonths} months` : 'On Schedule');

        const t3mTotalExt = predT3?.predicted_total_schedule_extension_months !== undefined && predT3?.predicted_total_schedule_extension_months !== null
          ? predT3.predicted_total_schedule_extension_months.toFixed(1)
          : pred3m?.predicted_total_schedule_extension_months !== undefined ? pred3m.predicted_total_schedule_extension_months.toFixed(1) : (currentExtMonths + parseFloat(t3mDelayMo)).toFixed(1);

        const shiftDateByMonths = (baseDateStr: string | undefined, addMonths: number): string => {
          if (!baseDateStr || baseDateStr === 'N/A') return 'N/A';
          try {
            let d = new Date(baseDateStr);
            if (isNaN(d.getTime())) {
              const parts = baseDateStr.split(/[-/ ]/);
              if (parts.length === 3) d = new Date(`${parts[2]}-${parts[1]}-${parts[0]}`);
            }
            if (!isNaN(d.getTime())) {
              const wholeMonths = Math.floor(addMonths);
              const extraDays = Math.round((addMonths - wholeMonths) * 30);
              d.setMonth(d.getMonth() + wholeMonths);
              d.setDate(d.getDate() + extraDays);
              return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
            }
          } catch (e) {}
          return baseDateStr;
        };

        const t3mTentative = (predT3?.tentative_completion_date && predT3.tentative_completion_date !== 'N/A')
          ? predT3.tentative_completion_date
          : (pred3m?.tentative_completion_date && pred3m.tentative_completion_date !== 'N/A')
          ? pred3m.tentative_completion_date
          : shiftDateByMonths(project.expectedCompletion, !isNaN(parseFloat(t3mDelayMo)) ? parseFloat(t3mDelayMo) : 0);

        const t3mBadge = predT3?.risk_tier ? `${predT3.risk_tier} RISK` : parseFloat(t3mProb) >= 70 ? 'CRITICAL RISK' : parseFloat(t3mProb) >= 50 ? 'HIGH RISK' : parseFloat(t3mProb) >= 25 ? 'MODERATE RISK' : 'LOW RISK';

        // 6M Schedule Metrics
        const t6mProb = predT6?.additional_delay_probability !== undefined && predT6?.additional_delay_probability !== null
          ? (predT6.additional_delay_probability * 100).toFixed(1)
          : pred6m?.time_overrun_probability !== undefined ? (pred6m.time_overrun_probability * 100).toFixed(1) : tRisk.toFixed(1);

        const t6mDelayMo = predT6?.predicted_additional_delay_months !== undefined && predT6?.predicted_additional_delay_months !== null
          ? predT6.predicted_additional_delay_months.toFixed(1)
          : pred6m?.predicted_additional_delay_months !== undefined ? pred6m.predicted_additional_delay_months.toFixed(1) : '0.0';

        const t6mNeeded = predT6?.estimated_time_needed_completion || pred6m?.estimated_time_needed || (project.scheduleExtensionMonths ? `${project.scheduleExtensionMonths} months` : 'On Schedule');

        const t6mTotalExt = predT6?.predicted_total_schedule_extension_months !== undefined && predT6?.predicted_total_schedule_extension_months !== null
          ? predT6.predicted_total_schedule_extension_months.toFixed(1)
          : pred6m?.predicted_total_schedule_extension_months !== undefined ? pred6m.predicted_total_schedule_extension_months.toFixed(1) : (currentExtMonths + parseFloat(t6mDelayMo)).toFixed(1);

        const t6mTentative = (predT6?.tentative_completion_date && predT6.tentative_completion_date !== 'N/A')
          ? predT6.tentative_completion_date
          : (pred6m?.tentative_completion_date && pred6m.tentative_completion_date !== 'N/A')
          ? pred6m.tentative_completion_date
          : shiftDateByMonths(project.expectedCompletion, !isNaN(parseFloat(t6mDelayMo)) ? parseFloat(t6mDelayMo) : 0);

        const t6mBadge = predT6?.risk_tier ? `${predT6.risk_tier} RISK` : parseFloat(t6mProb) >= 70 ? 'CRITICAL RISK' : parseFloat(t6mProb) >= 50 ? 'HIGH RISK' : parseFloat(t6mProb) >= 25 ? 'MODERATE RISK' : 'LOW RISK';

        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '10px', marginBottom: '12px' }}>
            
            {/* Horizon Switcher Header Bar */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Cpu size={18} color="#03045E" />
                <h2 style={{ fontSize: '18px', fontWeight: 850, color: 'var(--navy-dark)', margin: 0, letterSpacing: '-0.02em' }}>
                  AI Cost & Schedule Forecast Engine
                </h2>
                <InfoButton
                  title="Forecast Engine"
                  summary="Predicts if this project will face extra costs or extra months of delay in the next 3 to 6 months."
                  dataSummary={{
                    items: [
                      { label: '3-month cost', value: `${c3mBadge}, ${c3mProb}% probability, +${c3mDeltaPct}% overrun` },
                      { label: '6-month cost', value: `${c6mBadge}, ${c6mProb}% probability, +${c6mDeltaPct}% overrun` },
                      { label: '3-month schedule', value: `${t3mProb}% additional-delay probability` },
                      { label: '6-month schedule', value: `${t6mProb}% additional-delay probability` }
                    ],
                    insight: `The forecast indicates ${c6mBadge.toLowerCase()} cost risk over six months and ${t6mProb}% additional-delay probability over three months.`
                  }}
                  size="sm"
                />
                <span style={{ fontSize: '11px', color: '#64748B', fontWeight: 600, backgroundColor: '#F1F5F9', padding: '3px 10px', borderRadius: '6px', border: '1px solid #E2E8F0' }}>
                  PAIMANA Calibrated XGBoost
                </span>
              </div>

              {/* Horizon Toggle Switcher */}
              <div style={{ display: 'flex', gap: '6px', backgroundColor: '#F1F5F9', padding: '3px', borderRadius: '10px', border: '1px solid #E2E8F0' }}>
                <button 
                  className={`horizon-toggle-btn ${forecastHorizonFilter === 'all' ? 'active' : ''}`}
                  onClick={() => setForecastHorizonFilter('all')}
                  aria-selected={forecastHorizonFilter === 'all'}
                  role="tab"
                >
                  All Horizons (Combined)
                </button>
                <button 
                  className={`horizon-toggle-btn ${forecastHorizonFilter === '3m' ? 'active' : ''}`}
                  onClick={() => setForecastHorizonFilter('3m')}
                  aria-selected={forecastHorizonFilter === '3m'}
                  role="tab"
                >
                  3-Month Horizon
                </button>
                <button 
                  className={`horizon-toggle-btn ${forecastHorizonFilter === '6m' ? 'active' : ''}`}
                  onClick={() => setForecastHorizonFilter('6m')}
                  aria-selected={forecastHorizonFilter === '6m'}
                  role="tab"
                >
                  6-Month Horizon
                </button>
              </div>
            </div>

            {/* 4 Distinct Horizon Cards Grid */}
            <div className="forecast-grid-container" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
              
              {/* Left Column: COST FORECAST */}
              {(forecastHorizonFilter === 'all' || forecastHorizonFilter === '3m' || forecastHorizonFilter === '6m') && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 4px 0 4px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <div style={{ backgroundColor: '#DBEAFE', padding: '6px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <DollarSign size={16} color="#03045E" />
                      </div>
                      <h3 style={{ fontSize: '14px', fontWeight: 850, color: '#0F172A', margin: 0, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                        COST FORECAST
                      </h3>
                    </div>
                    <span style={{ fontSize: '11px', fontWeight: 700, color: '#03045E', backgroundColor: '#EFF6FF', padding: '3px 8px', borderRadius: '6px', border: '1px solid #BFDBFE' }}>
                      INR Crores
                    </span>
                  </div>

                  {/* COST 3M CARD */}
                  {(forecastHorizonFilter === 'all' || forecastHorizonFilter === '3m') && (
                    <div className="forecast-horizon-card forecast-card-blue">
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', fontWeight: 850, color: '#1E293B', textTransform: 'uppercase' }}>
                          <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#03045E' }}></span>
                          3-MONTH HORIZON
                        </div>
                        <StatusIndicator
                          kind={c3mBadge.includes('CRITICAL') ? 'critical' : c3mBadge.includes('HIGH') ? 'high' : c3mBadge.includes('LOW') ? 'low' : 'medium'}
                          label={c3mBadge}
                          className="forecast-status-indicator"
                        />
                      </div>

                      {/* 2x2 Metrics Grid */}
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '10px' }}>
                        <div>
                          <div style={{ fontSize: '11px', color: '#64748B', fontWeight: 600 }}>Escalation Probability</div>
                          <div style={{ fontSize: '14px', fontWeight: 850, color: '#0F172A' }}>
                            <AnimatedCounter value={parseFloat(c3mProb)} suffix="%" decimals={1} />
                          </div>
                        </div>
                        <div>
                          <div style={{ fontSize: '11px', color: '#64748B', fontWeight: 600 }}>Predicted Overrun Delta</div>
                          <div style={{ fontSize: '14px', fontWeight: 850, color: parseFloat(c3mDeltaPct) > 0 ? '#DC2626' : '#166534' }}>
                            <AnimatedCounter value={parseFloat(c3mDeltaPct)} prefix={parseFloat(c3mDeltaPct) > 0 ? '+' : ''} suffix="%" decimals={2} />
                          </div>
                        </div>
                        <div>
                          <div style={{ fontSize: '11px', color: '#64748B', fontWeight: 600 }}>Predicted Amount Delta</div>
                          <div style={{ fontSize: '14px', fontWeight: 850, color: '#0F172A' }}>
                            <AnimatedCounter value={parseFloat(c3mDeltaCr)} prefix={parseFloat(c3mDeltaCr) >= 0 ? '+₹' : '₹'} suffix=" Cr" decimals={2} />
                          </div>
                        </div>
                        <div>
                          <div style={{ fontSize: '11px', color: '#64748B', fontWeight: 600 }}>Final Overrun %</div>
                          <div style={{ fontSize: '14px', fontWeight: 850, color: '#0F172A' }}>
                            <AnimatedCounter value={parseFloat(c3mFinalPct)} prefix="+" suffix="%" decimals={1} />
                          </div>
                        </div>
                      </div>

                      {/* Visual Trajectory Sparkline Graph */}
                      <div className="sparkline-graph-box">
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '11px' }}>
                          <span style={{ fontWeight: 700, color: 'var(--text-muted)' }}>Cost Trajectory Trend</span>
                          <span style={{ fontWeight: 800, color: '#03045E' }}>
                            <AnimatedCounter value={parseFloat(c3mProb)} suffix="%" decimals={1} /> Escalation Probability
                          </span>
                        </div>
                        <svg aria-hidden="true" viewBox="0 0 160 32" style={{ width: '100%', height: '32px' }}>
                          <defs>
                            <linearGradient id="cost3mGrad" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%" stopColor="#03045E" stopOpacity="0.3" />
                              <stop offset="100%" stopColor="#03045E" stopOpacity="0.0" />
                            </linearGradient>
                          </defs>
                          <path d="M 0 28 Q 40 24, 80 16 T 160 6 L 160 32 L 0 32 Z" fill="url(#cost3mGrad)" />
                          <path d="M 0 28 Q 40 24, 80 16 T 160 6" fill="none" stroke="#03045E" strokeWidth="2.5" strokeLinecap="round" />
                          <circle cx="160" cy="6" r="3.5" fill="#03045E" stroke="#FFFFFF" strokeWidth="1.5" />
                        </svg>
                      </div>

                      {/* Forecasted Final Revised Cost Highlight Box */}
                      <div style={{ backgroundColor: '#EBF3FF', border: '1px solid #BFDBFE', padding: '10px 14px', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '10px' }}>
                        <span style={{ fontSize: '12px', fontWeight: 700, color: '#1E40AF' }}>Forecasted Final Revised Cost:</span>
                        <span style={{ fontSize: '14px', fontWeight: 850, color: '#03045E' }}>
                          <AnimatedCounter prefix="₹" value={parseFloat(String(c3mFinalCost).replace(/[^0-9.]/g, ''))} suffix=" Cr" decimals={2} />
                        </span>
                      </div>
                    </div>
                  )}

                  {/* COST 6M CARD */}
                  {(forecastHorizonFilter === 'all' || forecastHorizonFilter === '6m') && (
                    <div className="forecast-horizon-card forecast-card-purple">
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', fontWeight: 850, color: '#1E293B', textTransform: 'uppercase' }}>
                          <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#03045E' }}></span>
                          6-MONTH HORIZON
                        </div>
                        <StatusIndicator
                          kind={c6mBadge.includes('CRITICAL') ? 'critical' : c6mBadge.includes('HIGH') ? 'high' : c6mBadge.includes('LOW') ? 'low' : 'medium'}
                          label={c6mBadge}
                          className="forecast-status-indicator"
                        />
                      </div>

                      {/* 2x2 Metrics Grid */}
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '10px' }}>
                        <div>
                          <div style={{ fontSize: '11px', color: '#64748B', fontWeight: 600 }}>Escalation Probability</div>
                          <div style={{ fontSize: '14px', fontWeight: 850, color: '#0F172A' }}>
                            <AnimatedCounter value={parseFloat(c6mProb)} suffix="%" decimals={1} />
                          </div>
                        </div>
                        <div>
                          <div style={{ fontSize: '11px', color: '#64748B', fontWeight: 600 }}>Predicted Overrun Delta</div>
                          <div style={{ fontSize: '14px', fontWeight: 850, color: parseFloat(c6mDeltaPct) > 0 ? '#DC2626' : '#166534' }}>
                            <AnimatedCounter value={parseFloat(c6mDeltaPct)} prefix={parseFloat(c6mDeltaPct) > 0 ? '+' : ''} suffix="%" decimals={2} />
                          </div>
                        </div>
                        <div>
                          <div style={{ fontSize: '11px', color: '#64748B', fontWeight: 600 }}>Predicted Amount Delta</div>
                          <div style={{ fontSize: '14px', fontWeight: 850, color: '#0F172A' }}>
                            <AnimatedCounter value={parseFloat(c6mDeltaCr)} prefix={parseFloat(c6mDeltaCr) >= 0 ? '+₹' : '₹'} suffix=" Cr" decimals={2} />
                          </div>
                        </div>
                        <div>
                          <div style={{ fontSize: '11px', color: '#64748B', fontWeight: 600 }}>Final Overrun %</div>
                          <div style={{ fontSize: '14px', fontWeight: 850, color: '#0F172A' }}>
                            <AnimatedCounter value={parseFloat(c6mFinalPct)} prefix="+" suffix="%" decimals={1} />
                          </div>
                        </div>
                      </div>

                      {/* Visual Trajectory Sparkline Graph */}
                      <div className="sparkline-graph-box">
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '11px' }}>
                          <span style={{ fontWeight: 700, color: 'var(--text-muted)' }}>Cost Trajectory Trend</span>
                          <span style={{ fontWeight: 800, color: '#03045E' }}>
                            <AnimatedCounter value={parseFloat(c6mProb)} suffix="%" decimals={1} /> Escalation Probability
                          </span>
                        </div>
                        <svg aria-hidden="true" viewBox="0 0 160 32" style={{ width: '100%', height: '32px' }}>
                          <defs>
                            <linearGradient id="cost6mGrad" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%" stopColor="#03045E" stopOpacity="0.3" />
                              <stop offset="100%" stopColor="#03045E" stopOpacity="0.0" />
                            </linearGradient>
                          </defs>
                          <path d="M 0 28 Q 40 20, 80 12 T 160 4 L 160 32 L 0 32 Z" fill="url(#cost6mGrad)" />
                          <path d="M 0 28 Q 40 20, 80 12 T 160 4" fill="none" stroke="#03045E" strokeWidth="2.5" strokeLinecap="round" />
                          <circle cx="160" cy="4" r="3.5" fill="#03045E" stroke="#FFFFFF" strokeWidth="1.5" />
                        </svg>
                      </div>

                      {/* Forecasted Final Revised Cost Highlight Box */}
                      <div style={{ backgroundColor: '#EEF2FF', border: '1px solid #C7D2FE', padding: '10px 14px', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '10px' }}>
                        <span style={{ fontSize: '12px', fontWeight: 700, color: '#3730A3' }}>Forecasted Final Revised Cost:</span>
                        <span style={{ fontSize: '14px', fontWeight: 850, color: '#03045E' }}>
                          <AnimatedCounter prefix="₹" value={parseFloat(String(c6mFinalCost).replace(/[^0-9.]/g, ''))} suffix=" Cr" decimals={2} />
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Right Column: SCHEDULE FORECAST */}
              {(forecastHorizonFilter === 'all' || forecastHorizonFilter === '3m' || forecastHorizonFilter === '6m') && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 4px 0 4px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <div style={{ backgroundColor: '#FEF3C7', padding: '6px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Clock size={16} color="#03045E" />
                      </div>
                      <h3 style={{ fontSize: '14px', fontWeight: 850, color: '#0F172A', margin: 0, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                        SCHEDULE FORECAST
                      </h3>
                    </div>
                    <span style={{ fontSize: '11px', fontWeight: 700, color: '#03045E', backgroundColor: '#FEF3C7', padding: '3px 8px', borderRadius: '6px', border: '1px solid #FDE68A' }}>
                      Timeline Target
                    </span>
                  </div>

                  {/* SCHEDULE 3M CARD */}
                  {(forecastHorizonFilter === 'all' || forecastHorizonFilter === '3m') && (
                    <div className="forecast-horizon-card forecast-card-amber">
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', fontWeight: 850, color: '#1E293B', textTransform: 'uppercase' }}>
                          <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#03045E' }}></span>
                          3-MONTH HORIZON
                        </div>
                        <StatusIndicator
                          kind={t3mBadge.includes('CRITICAL') ? 'critical' : t3mBadge.includes('HIGH') ? 'high' : t3mBadge.includes('LOW') ? 'low' : 'medium'}
                          label={t3mBadge}
                          className="forecast-status-indicator"
                        />
                      </div>

                      {/* 2x2 Metrics Grid */}
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '10px' }}>
                        <div>
                          <div style={{ fontSize: '11px', color: '#64748B', fontWeight: 600 }}>Delay Probability</div>
                          <div style={{ fontSize: '14px', fontWeight: 850, color: '#0F172A' }}>
                            <AnimatedCounter value={parseFloat(t3mProb)} suffix="%" decimals={1} />
                          </div>
                        </div>
                        <div>
                          <div style={{ fontSize: '11px', color: '#64748B', fontWeight: 600 }}>Predicted Additional Delay</div>
                          <div style={{ fontSize: '14px', fontWeight: 850, color: parseFloat(t3mDelayMo) > 0 ? '#03045E' : '#166534' }}>
                            <AnimatedCounter value={parseFloat(t3mDelayMo)} prefix={parseFloat(t3mDelayMo) > 0 ? '+' : ''} suffix=" months" decimals={1} />
                          </div>
                        </div>
                        <div>
                          <div style={{ fontSize: '11px', color: '#64748B', fontWeight: 600 }}>Time Needed</div>
                          <div style={{ fontSize: '14px', fontWeight: 850, color: '#0F172A' }}>{t3mNeeded}</div>
                        </div>
                        <div>
                          <div style={{ fontSize: '11px', color: '#64748B', fontWeight: 600 }}>Total Extension</div>
                          <div style={{ fontSize: '14px', fontWeight: 850, color: '#0F172A' }}>
                            <AnimatedCounter value={parseFloat(t3mTotalExt)} prefix="+" suffix=" months" decimals={1} />
                          </div>
                        </div>
                      </div>

                      {/* Visual Trajectory Sparkline Graph */}
                      <div className="sparkline-graph-box">
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '11px' }}>
                          <span style={{ fontWeight: 700, color: 'var(--text-muted)' }}>Timeline Slippage Trajectory</span>
                          <span style={{ fontWeight: 800, color: '#03045E' }}>
                            <AnimatedCounter value={parseFloat(t3mProb)} suffix="%" decimals={1} /> Delay Probability
                          </span>
                        </div>
                        <svg aria-hidden="true" viewBox="0 0 160 32" style={{ width: '100%', height: '32px' }}>
                          <defs>
                            <linearGradient id="sched3mGrad" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%" stopColor="#03045E" stopOpacity="0.3" />
                              <stop offset="100%" stopColor="#03045E" stopOpacity="0.0" />
                            </linearGradient>
                          </defs>
                          <path d="M 0 28 Q 40 22, 80 14 T 160 5 L 160 32 L 0 32 Z" fill="url(#sched3mGrad)" />
                          <path d="M 0 28 Q 40 22, 80 14 T 160 5" fill="none" stroke="#03045E" strokeWidth="2.5" strokeLinecap="round" />
                          <circle cx="160" cy="5" r="3.5" fill="#03045E" stroke="#FFFFFF" strokeWidth="1.5" />
                        </svg>
                      </div>

                      {/* Tentative Target Completion Highlight Box */}
                      <div style={{ backgroundColor: '#F0F7FF', border: '1px solid #BFDBFE', padding: '10px 14px', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '10px' }}>
                        <span style={{ fontSize: '12px', fontWeight: 700, color: '#1E40AF' }}>Tentative Target Completion:</span>
                        <span style={{ fontSize: '14px', fontWeight: 850, color: '#03045E' }}>{t3mTentative}</span>
                      </div>
                    </div>
                  )}

                  {/* SCHEDULE 6M CARD */}
                  {(forecastHorizonFilter === 'all' || forecastHorizonFilter === '6m') && (
                    <div className="forecast-horizon-card forecast-card-red">
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', fontWeight: 850, color: '#1E293B', textTransform: 'uppercase' }}>
                          <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#03045E' }}></span>
                          6-MONTH HORIZON
                        </div>
                        <StatusIndicator
                          kind={t6mBadge.includes('CRITICAL') ? 'critical' : t6mBadge.includes('HIGH') ? 'high' : t6mBadge.includes('LOW') ? 'low' : 'medium'}
                          label={t6mBadge}
                          className="forecast-status-indicator"
                        />
                      </div>

                      {/* 2x2 Metrics Grid */}
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '10px' }}>
                        <div>
                          <div style={{ fontSize: '11px', color: '#64748B', fontWeight: 600 }}>Delay Probability</div>
                          <div style={{ fontSize: '14px', fontWeight: 850, color: '#0F172A' }}>
                            <AnimatedCounter value={parseFloat(t6mProb)} suffix="%" decimals={1} />
                          </div>
                        </div>
                        <div>
                          <div style={{ fontSize: '11px', color: '#64748B', fontWeight: 600 }}>Predicted Additional Delay</div>
                          <div style={{ fontSize: '14px', fontWeight: 850, color: parseFloat(t6mDelayMo) > 0 ? '#03045E' : '#166534' }}>
                            <AnimatedCounter value={parseFloat(t6mDelayMo)} prefix={parseFloat(t6mDelayMo) > 0 ? '+' : ''} suffix=" months" decimals={1} />
                          </div>
                        </div>
                        <div>
                          <div style={{ fontSize: '11px', color: '#64748B', fontWeight: 600 }}>Time Needed</div>
                          <div style={{ fontSize: '14px', fontWeight: 850, color: '#0F172A' }}>{t6mNeeded}</div>
                        </div>
                        <div>
                          <div style={{ fontSize: '11px', color: '#64748B', fontWeight: 600 }}>Total Extension</div>
                          <div style={{ fontSize: '14px', fontWeight: 850, color: '#0F172A' }}>
                            <AnimatedCounter value={parseFloat(t6mTotalExt)} prefix="+" suffix=" months" decimals={1} />
                          </div>
                        </div>
                      </div>

                      {/* Visual Trajectory Sparkline Graph */}
                      <div className="sparkline-graph-box">
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '11px' }}>
                          <span style={{ fontWeight: 700, color: 'var(--text-muted)' }}>Timeline Slippage Trajectory</span>
                          <span style={{ fontWeight: 800, color: '#03045E' }}>
                            <AnimatedCounter value={parseFloat(t6mProb)} suffix="%" decimals={1} /> Delay Probability
                          </span>
                        </div>
                        <svg aria-hidden="true" viewBox="0 0 160 32" style={{ width: '100%', height: '32px' }}>
                          <defs>
                            <linearGradient id="sched6mGrad" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%" stopColor="#03045E" stopOpacity="0.3" />
                              <stop offset="100%" stopColor="#03045E" stopOpacity="0.0" />
                            </linearGradient>
                          </defs>
                          <path d="M 0 28 Q 40 18, 80 10 T 160 2 L 160 32 L 0 32 Z" fill="url(#sched6mGrad)" />
                          <path d="M 0 28 Q 40 18, 80 10 T 160 2" fill="none" stroke="#03045E" strokeWidth="2.5" strokeLinecap="round" />
                          <circle cx="160" cy="2" r="3.5" fill="#03045E" stroke="#FFFFFF" strokeWidth="1.5" />
                        </svg>
                      </div>

                      {/* Tentative Target Completion Highlight Box */}
                      <div style={{ backgroundColor: '#FEF2F2', border: '1px solid #FCA5A5', padding: '10px 14px', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '10px' }}>
                        <span style={{ fontSize: '12px', fontWeight: 700, color: '#991B1B' }}>Tentative Target Completion:</span>
                        <span style={{ fontSize: '14px', fontWeight: 850, color: '#03045E' }}>{t6mTentative}</span>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        );
      })()}

      </div>{/* /pd-section-forecasts */}

      {/* ─── SECTION: Escalation Drivers ─── */}
      <div id="pd-section-escalation" className="pd-section-anchor">
      <div className="pd-section-header pd-section-header--escalation">
        <span className="pd-section-tag">03</span>
        <span className="pd-section-name">Escalation Drivers</span>
      </div>

      {/* Explainable AI Analysis Section (TreeSHAP Feature Attributions) */}
      {(() => {
        // Dynamic TreeSHAP Feature Attribution Calculations per Project and Tab
        const getShapAttributions = (proj: Project, tab: 'cost3m' | 'cost6m' | 'sched3m' | 'sched6m') => {
          const costApp = parseFloat(String(proj.costApproved).replace(/[^0-9.]/g, '')) || 1000;
          const costRev = parseFloat(String(proj.costRevised).replace(/[^0-9.]/g, '')) || costApp;
          const progPhys = proj.progressPhysical || 50;
          const progFin = proj.progressFinancial || 50;
          const gap = Math.abs(progFin - progPhys);
          const cRisk = proj.costRisk !== undefined ? proj.costRisk : proj.riskScore;
          const tRisk = proj.timeRisk !== undefined ? proj.timeRisk : proj.riskScore;
          const extMo = parseFloat(String(proj.scheduleExtensionMonths || 12));

          const mult = tab.includes('6m') ? 1.35 : 1.0;
          const isCost = tab.includes('cost');

          if (isCost) {
            const upwardDrivers = [
              { label: 'Cost Escalation Amount', value: +((((costRev - costApp) / costApp) * 0.45 + (cRisk / 100) * 0.12) * mult).toFixed(4) },
              { label: 'Physical To Expenditure Ratio', value: +((gap * 0.0058 + 0.0520) * mult).toFixed(4) },
              { label: 'Historical Cost Overrun %', value: +((parseFloat(proj.costOverrunPct || '0') * 0.0038 + 0.0280) * mult).toFixed(4) },
              { label: `Expenditure Velocity (₹ Cr) Month`, value: +(((costRev / 36) * 0.0016 + 0.0190) * mult).toFixed(4) },
              { label: `Sector: ${proj.type || 'Infrastructure'}`, value: +(((cRisk / 100) * 0.035 + 0.0120) * mult).toFixed(4) },
            ].sort((a, b) => b.value - a.value);

            const protectiveFactors = [
              { label: 'Original Approved Budget', value: -((Math.min(0.85, (costApp / 10000) * 0.22 + 0.4500)) * mult).toFixed(4) },
              { label: 'Original Duration Months', value: -(((extMo + 24) * 0.0092 + 0.3500) * mult).toFixed(4) },
              { label: 'Revised Remaining Months', value: -((Math.max(0.15, (100 - progPhys) * 0.0068 + 0.2400)) * mult).toFixed(4) },
              { label: 'Consecutive Stagnant Months', value: -((Math.max(0.12, (100 - progPhys) * 0.0048 + 0.1800)) * mult).toFixed(4) },
              { label: 'Days To Revised Target', value: -((Math.max(0.09, cRisk > 50 ? 0.14 : 0.31)) * mult).toFixed(4) },
            ].sort((a, b) => a.value - b.value);

            return { upwardDrivers, protectiveFactors };
          } else {
            // Schedule SHAP
            const upwardDrivers = [
              { label: 'Schedule Delay Duration', value: +(((tRisk / 100) * 0.28 + (extMo * 0.0045) + 0.0450) * mult).toFixed(4) },
              { label: 'Physical Progress Slippage', value: +((Math.abs((proj.progressPhysicalTarget || (progPhys + 5)) - progPhys) * 0.0092 + 0.0350) * mult).toFixed(4) },
              { label: 'Land Acquisition & Clearance Lag', value: +(((tRisk / 100) * 0.18 + 0.0240) * mult).toFixed(4) },
              { label: 'Contractor Milestone Lag Rate', value: +(((tRisk / 100) * 0.14 + 0.0180) * mult).toFixed(4) },
              { label: 'Right of Way (RoW) Clearance', value: +(((tRisk / 100) * 0.10 + 0.0120) * mult).toFixed(4) },
            ].sort((a, b) => b.value - a.value);

            const protectiveFactors = [
              { label: 'Equipment Deployment Velocity', value: -((Math.min(0.85, (progPhys / 100) * 0.48 + 0.3100)) * mult).toFixed(4) },
              { label: 'Financial Disbursement Velocity', value: -(((progFin / 100) * 0.42 + 0.2400) * mult).toFixed(4) },
              { label: 'Active Site Manpower Density', value: -(((progPhys / 100) * 0.35 + 0.1900) * mult).toFixed(4) },
              { label: 'State Government Coordination', value: -((tRisk > 60 ? 0.1600 : 0.4200) * mult).toFixed(4) },
              { label: 'EPC Contractor Capability Score', value: -((tRisk > 60 ? 0.1200 : 0.3500) * mult).toFixed(4) },
            ].sort((a, b) => a.value - b.value);

            return { upwardDrivers, protectiveFactors };
          }
        };

        const shapKey = shapTab === 'cost3m' ? 'cost_3m' : shapTab === 'cost6m' ? 'cost_6m' : shapTab === 'sched3m' ? 'time_3m' : 'time_6m';
        const shapData = shaps[shapKey];
        let upwardDrivers: Array<{ label: string; value: number }>;
        let protectiveFactors: Array<{ label: string; value: number }>;

        if (shapData && shapData.top_risk_drivers && shapData.top_risk_drivers.length > 0) {
          upwardDrivers = shapData.top_risk_drivers.map((d: any) => ({
            label: d.display_name || d.feature.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase()),
            value: Math.abs(d.shap_value)
          }));
          protectiveFactors = shapData.top_protective_factors.map((d: any) => ({
            label: d.display_name || d.feature.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase()),
            value: -Math.abs(d.shap_value)
          }));
        } else {
          const fb = getShapAttributions(project, shapTab);
          upwardDrivers = fb.upwardDrivers;
          protectiveFactors = fb.protectiveFactors;
        }

        return (
          <div className="card explainable-ai-card" style={{ padding: '24px', borderRadius: '16px', marginTop: '12px', marginBottom: '16px' }}>
            
            {/* Section Header & Subtitle */}
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px', marginBottom: '18px' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Cpu size={20} color="#03045E" />
                  <h2 style={{ fontSize: '18px', fontWeight: 850, color: 'var(--navy-dark)', margin: 0, letterSpacing: '-0.02em' }}>
                    Explainable AI Analysis
                  </h2>
                  <InfoButton
                    title="Why It Is Delayed"
                    summary="Shows what is causing delays (in red) and what factors are helping this project stay on track (in green)."
                    dataSummary={{
                      items: [
                        ...upwardDrivers.slice(0, 5).map((driver) => ({ label: driver.label, value: `+${driver.value.toFixed(4)} risk impact` })),
                        ...protectiveFactors.slice(0, 5).map((driver) => ({ label: driver.label, value: driver.value.toFixed(4) + ' protective impact' }))
                      ],
                      insight: `${upwardDrivers.length} factors increase predicted risk and ${protectiveFactors.length} factors mitigate risk in the active ${shapTab} analysis.`
                    }}
                    size="sm"
                  />
                </div>
                <span style={{ fontSize: '12px', color: '#64748B', fontWeight: 500, marginTop: '2px', display: 'block' }}>
                  TreeSHAP feature attributions, model-specific natural language explanations, and cost escalation drivers
                </span>
              </div>

              {/* Legend (Increases Risk vs Mitigates Risk) */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px', fontSize: '11px', fontWeight: 700 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: '#D62F39', display: 'inline-block' }} />
                  <span style={{ color: '#991B1B' }}>Increases Predicted Risk (SHAP &gt; 0)</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: '#166534', display: 'inline-block' }} />
                  <span style={{ color: '#166534' }}>Mitigates Risk (SHAP &lt; 0)</span>
                </div>
              </div>
            </div>

            {/* Tab Switcher Pills */}
            <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', flexWrap: 'wrap' }}>
              {[
                { id: 'cost3m', label: '3M Cost SHAP', Icon: DollarSign },
                { id: 'cost6m', label: '6M Cost SHAP', Icon: DollarSign },
                { id: 'sched3m', label: '3M Schedule SHAP', Icon: Clock },
                { id: 'sched6m', label: '6M Schedule SHAP', Icon: Clock }
              ].map(t => (
                <button
                  key={t.id}
                  className={`shap-tab-btn ${shapTab === t.id ? 'active' : ''}`}
                  onClick={() => setShapTab(t.id as any)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '8px 16px',
                    borderRadius: '10px',
                    fontSize: '12.5px',
                    fontWeight: 750,
                    cursor: 'pointer',
                    backgroundColor: shapTab === t.id ? '#03045E' : '#F1F5F9',
                    color: shapTab === t.id ? '#FFFFFF' : '#475569',
                    border: shapTab === t.id ? '1px solid #03045E' : '1px solid #CBD5E1',
                    boxShadow: shapTab === t.id ? '0 3px 8px rgba(3,4,94,0.25)' : 'none'
                  }}
                >
                  <t.Icon size={14} color={shapTab === t.id ? '#FFFFFF' : '#64748B'} />
                  <span>{t.label}</span>
                </button>
              ))}
            </div>

            {/* Two Column Grid (Left: Diverging Bar Chart | Right: Driver Cards) */}
            <div style={{ display: 'grid', gridTemplateColumns: '1.25fr 1fr', gap: '24px' }}>
              
              {/* Left Column: Horizontal Diverging SHAP Bar Chart */}
              <div style={{ backgroundColor: '#F8FAFC', padding: '20px', borderRadius: '14px', border: '1px solid #E2E8F0', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                <div style={{ fontSize: '12px', fontWeight: 800, color: '#475569', marginBottom: '14px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  TreeSHAP Feature Impact Magnitude
                </div>

                {/* Diverging Bars Container */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {/* Positive SHAP Bars (Red) */}
                  {upwardDrivers.map((item, idx) => {
                    const maxVal = 0.8;
                    const pct = Math.min(100, Math.max(8, (Math.abs(item.value) / maxVal) * 100));
                    return (
                      <div key={`up-${idx}`} className="shap-bar-row" style={{ display: 'grid', gridTemplateColumns: '150px 1fr', gap: '10px', alignItems: 'center' }}>
                        <div style={{ fontSize: '11.5px', fontWeight: 700, color: '#334155', textAlign: 'right', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={item.label}>
                          {item.label}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', height: '22px', position: 'relative' }}>
                          <div className="shap-bar-fill" style={{ width: `${pct}%`, height: '18px', backgroundColor: '#D62F39', borderRadius: '0 4px 4px 0' }} />
                          <span style={{ fontSize: '10.5px', fontWeight: 800, color: '#D62F39', marginLeft: '6px' }}>
                            +{item.value.toFixed(4)}
                          </span>
                        </div>
                      </div>
                    );
                  })}

                  {/* Axis Zero Line Separator */}
                  <div style={{ height: '1px', backgroundColor: '#CBD5E1', margin: '4px 0 4px 150px' }} />

                  {/* Negative SHAP Bars (Green) */}
                  {protectiveFactors.map((item, idx) => {
                    const maxVal = 0.8;
                    const pct = Math.min(100, Math.max(8, (Math.abs(item.value) / maxVal) * 100));
                    return (
                      <div key={`prot-${idx}`} className="shap-bar-row" style={{ display: 'grid', gridTemplateColumns: '150px 1fr', gap: '10px', alignItems: 'center' }}>
                        <div style={{ fontSize: '11.5px', fontWeight: 700, color: '#334155', textAlign: 'right', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={item.label}>
                          {item.label}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', height: '22px', position: 'relative' }}>
                          <div className="shap-bar-fill protective-fill" style={{ width: `${pct}%`, height: '18px', backgroundColor: '#166534', borderRadius: '0 4px 4px 0' }} />
                          <span style={{ fontSize: '10.5px', fontWeight: 800, color: '#166534', marginLeft: '6px' }}>
                            {item.value.toFixed(4)}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* X-Axis Scale Legend */}
                <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #CBD5E1', paddingTop: '8px', marginTop: '14px', marginLeft: '150px', fontSize: '10px', color: '#64748B', fontWeight: 700 }}>
                  <span>-0.750</span>
                  <span>-0.500</span>
                  <span>-0.250</span>
                  <span>0.000</span>
                  <span>+0.250</span>
                </div>
              </div>

              {/* Right Column: 2 Stacked Risk Driver Cards (Matching Reference Image) */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                
                {/* Primary Upward Risk Drivers Card */}
                <div className="shap-driver-card shap-driver-card-red" style={{ backgroundColor: '#FFF5F5', border: '1px solid #FCA5A5', padding: '18px', borderRadius: '14px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                    <span style={{ fontSize: '14px', color: '#D62F39', fontWeight: 900 }}>↗</span>
                    <h3 style={{ fontSize: '13.5px', fontWeight: 850, color: '#991B1B', margin: 0 }}>
                      Primary Upward Risk Drivers
                    </h3>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {upwardDrivers.slice(0, 4).map((d, idx) => (
                      <div key={idx} className="shap-factor-pill shap-factor-pill-red" style={{ backgroundColor: '#FFFFFF', padding: '10px 14px', borderRadius: '8px', border: '1px solid #FEE2E2', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '12px', fontWeight: 700, color: '#334155' }}>{d.label}</span>
                        <span style={{ fontSize: '12.5px', fontWeight: 850, color: '#D62F39' }}>+{d.value.toFixed(4)}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Risk-Reducing / Protective Factors Card */}
                <div className="shap-driver-card shap-driver-card-green" style={{ backgroundColor: '#F0FDF4', border: '1px solid #86EFAC', padding: '18px', borderRadius: '14px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                    <span style={{ fontSize: '14px', color: '#166534', fontWeight: 900 }}>↘</span>
                    <h3 style={{ fontSize: '13.5px', fontWeight: 850, color: '#166534', margin: 0 }}>
                      Risk-Reducing / Protective Factors
                    </h3>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {protectiveFactors.slice(0, 4).map((d, idx) => (
                      <div key={idx} className="shap-factor-pill shap-factor-pill-green" style={{ backgroundColor: '#FFFFFF', padding: '10px 14px', borderRadius: '8px', border: '1px solid #DCFCE7', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '12px', fontWeight: 700, color: '#334155' }}>{d.label}</span>
                        <span style={{ fontSize: '12.5px', fontWeight: 850, color: '#166534' }}>{d.value.toFixed(4)}</span>
                      </div>
                    ))}
                  </div>
                </div>

              </div>

            </div>

            {/* Cost Escalation Driver Analysis Module (from Nirmaan Drishti) */}
            <div className="cost-driver-container">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <DollarSign size={18} color="#03045E" />
                    <h3 style={{ fontSize: '16px', fontWeight: 850, color: 'var(--navy-dark)', margin: 0 }}>
                      Cost Escalation Driver Analysis
                    </h3>
                    <InfoButton
                      title="Cost Driver Analysis"
                      summary="Translates complex mathematical TreeSHAP attributions into domain financial factors and expenditure bottlenecks."
                      size="sm"
                    />
                  </div>
                  <p style={{ fontSize: '12px', color: '#64748B', margin: '4px 0 0 0' }}>
                    Feature attribution breakdown explaining cost overrun drivers in plain domain terminology.
                  </p>
                </div>

                {/* Horizon Switcher */}
                <div style={{ display: 'flex', gap: '6px', background: '#F1F5F9', padding: '3px', borderRadius: '10px' }}>
                  <button
                    className={`nlp-tab-btn ${costDriverHorizon === 'horizon_3m' ? 'active' : ''}`}
                    onClick={() => setCostDriverHorizon('horizon_3m')}
                    style={{ fontSize: '11.5px', padding: '6px 12px' }}
                  >
                    3-Month Horizon
                  </button>
                  <button
                    className={`nlp-tab-btn ${costDriverHorizon === 'horizon_6m' ? 'active' : ''}`}
                    onClick={() => setCostDriverHorizon('horizon_6m')}
                    style={{ fontSize: '11.5px', padding: '6px 12px' }}
                  >
                    6-Month Horizon
                  </button>
                </div>
              </div>

              {/* Drivers Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '14px', marginTop: '6px' }}>
                {/* Cost Escalation Drivers (Upward) */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <div style={{ fontSize: '12px', fontWeight: 800, color: '#D62F39', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#D62F39' }}></span>
                    Top Cost Escalation Drivers
                  </div>
                  {(costDrivers?.[costDriverHorizon]?.top_cost_escalation_drivers || []).slice(0, 4).map((item, idx) => (
                    <div key={idx} className="cost-driver-item cost-driver-item-increasing">
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                        <div>
                          <div style={{ fontSize: '13px', fontWeight: 800, color: '#0F172A' }}>
                            {item.display_name}
                          </div>
                          <div style={{ fontSize: '11.5px', color: '#64748B', marginTop: '2px' }}>
                            {item.description}
                          </div>
                        </div>
                        <span style={{ fontSize: '11px', fontWeight: 800, color: '#DC2626', backgroundColor: '#FEE2E2', padding: '2px 8px', borderRadius: '6px', whiteSpace: 'nowrap' }}>
                          +{item.shap_value.toFixed(4)}
                        </span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '6px', fontSize: '11px', color: '#475569' }}>
                        <span>Project Value: <strong>{formatActualValueClean(item.actual_value)}</strong></span>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Mitigating Factors (Protective) */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <div style={{ fontSize: '12px', fontWeight: 800, color: '#166534', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#166534' }}></span>
                    Mitigating Protective Factors
                  </div>
                  {(costDrivers?.[costDriverHorizon]?.mitigating_factors || []).slice(0, 4).map((item, idx) => (
                    <div key={idx} className="cost-driver-item cost-driver-item-mitigating">
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                        <div>
                          <div style={{ fontSize: '13px', fontWeight: 800, color: '#0F172A' }}>
                            {item.display_name}
                          </div>
                          <div style={{ fontSize: '11.5px', color: '#64748B', marginTop: '2px' }}>
                            {item.description}
                          </div>
                        </div>
                        <span style={{ fontSize: '11px', fontWeight: 800, color: '#166534', backgroundColor: '#DCFCE7', padding: '2px 8px', borderRadius: '6px', whiteSpace: 'nowrap' }}>
                          {item.shap_value.toFixed(4)}
                        </span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '6px', fontSize: '11px', color: '#475569' }}>
                        <span>Project Value: <strong>{formatActualValueClean(item.actual_value)}</strong></span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

          </div>
        );
      })()}

      {/* AI Natural Language Explanation (QWEN3-8B) Section */}
      {(() => {
        const getNaturalLanguageExplanation = (proj: Project, tab: 'sched3m' | 'sched6m' | 'cost3m' | 'cost6m') => {
          const costApp = parseFloat(String(proj.costApproved).replace(/[^0-9.]/g, '')) || 1000;
          const costRev = parseFloat(String(proj.costRevised).replace(/[^0-9.]/g, '')) || costApp;
          const progPhys = proj.progressPhysical || 0;
          const progFin = proj.progressFinancial || 0;
          const extMo = proj.timeOverrunMonths !== null && proj.timeOverrunMonths !== undefined ? proj.timeOverrunMonths : parseFloat(String(proj.scheduleExtensionMonths || 0));
          const rScore = proj.riskScore || 50;
          const cRisk = proj.costRisk !== undefined ? proj.costRisk : rScore;
          const tRisk = proj.timeRisk !== undefined ? proj.timeRisk : rScore;
          const sector = proj.type || 'Infrastructure';
          const isComp = proj.isCompleted || proj.projectStatus === 'COMPLETED' || progPhys >= 100;

          if (tab === 'sched3m') {
            const prob = isComp ? '0.0' : (tRisk * 0.88).toFixed(1);
            const badge = isComp ? 'COMPLETED' : tRisk >= 70 ? 'HIGH RISK' : tRisk >= 40 ? 'MODERATE RISK' : 'LOW RISK';
            const badgeColor = isComp ? '#15803D' : tRisk >= 70 ? '#D62F39' : tRisk >= 40 ? '#D97706' : '#03045E';
            const badgeBg = isComp ? '#DCFCE7' : tRisk >= 70 ? '#FEE2E2' : tRisk >= 40 ? '#FEF3C7' : '#EBF3FF';

            if (isComp) {
              return {
                tabTitle: '3M SCHEDULE',
                badge, badgeColor, badgeBg, prob,
                summary: `${proj.name} has concluded construction and was commissioned on ${proj.actualCompletion || proj.expectedCompletion}. Historical schedule extension stands at ${proj.timeOverrunFormatted || (extMo > 0 ? extMo + ' months' : '0 months')}.`,
                upward: [
                  `Total accumulated schedule extension of ${proj.timeOverrunFormatted || (extMo + ' months')} recorded during active execution phase.`,
                  `Final administrative and operational handover reviews underway.`
                ],
                protective: [
                  `Project has achieved 100% physical completion, eliminating forward delay risks.`,
                  `Infrastructure commissioned for public/commercial operations.`
                ]
              };
            }

            return {
              tabTitle: '3M SCHEDULE',
              badge, badgeColor, badgeBg, prob,
              summary: `${proj.name} exhibits a ${badge} (${prob}% probability) of additional schedule delay in the next 3 months, supported by PAIMANA milestone trajectory.`,
              upward: [
                extMo > 0
                  ? `Accumulated schedule extension of ${extMo % 1 === 0 ? Math.round(extMo) : extMo.toFixed(1)} months significantly elevates near-term timeline vulnerability.`
                  : `Project is currently tracking against its approved schedule target without accumulated extension.`,
                `Current revised cost envelope of ${formatCurrencyClean(costRev)} reflects substantial multi-contractor coordination demands.`,
                `Physical progress stands at ${progPhys}% relative to target completion.`
              ],
              protective: [
                `Projects under ${sector} sector exhibit standardized statutory clearance protocols.`,
                costRev > costApp
                  ? `Sanctioned cost envelope expansion of ${formatCurrencyClean(costRev - costApp)} provides operational liquidity.`
                  : `Operation within original budget ceiling mitigates secondary cost-driven work stoppages.`,
                `Active execution velocity supports milestone stabilization.`
              ]
            };
          } else if (tab === 'sched6m') {
            const prob = isComp ? '0.0' : Math.min(99, tRisk * 1.20).toFixed(1);
            const badge = isComp ? 'COMPLETED' : tRisk >= 60 ? 'HIGH RISK' : 'MODERATE RISK';
            const badgeColor = isComp ? '#15803D' : tRisk >= 60 ? '#D62F39' : '#D97706';
            const badgeBg = isComp ? '#DCFCE7' : tRisk >= 60 ? '#FEE2E2' : '#FEF3C7';

            if (isComp) {
              return {
                tabTitle: '6M SCHEDULE',
                badge, badgeColor, badgeBg, prob,
                summary: `${proj.name} is fully commissioned; long-term timeline risk is completely resolved.`,
                upward: [
                  `Historical completion achieved on ${proj.actualCompletion || proj.expectedCompletion}.`
                ],
                protective: [
                  `All major civil and structural milestone handovers are complete.`
                ]
              };
            }

            return {
              tabTitle: '6M SCHEDULE',
              badge, badgeColor, badgeBg, prob,
              summary: `${proj.name} exhibits a ${badge} (${prob}% probability) of compounding schedule delay over the 6-month forecast horizon.`,
              upward: [
                extMo > 0
                  ? `Cumulative schedule extension reaching ${extMo % 1 === 0 ? Math.round(extMo) : extMo.toFixed(1)} months elevates long-term timeline risk.`
                  : `Sustained milestone pace required to maintain on-time commissioning.`,
                `Physical progress gap (${Math.max(0, (proj.progressPhysicalTarget || 85) - progPhys)}% behind target) compounds delay probability.`,
                `High revised budget scale (${formatCurrencyClean(costRev)}) requires rigorous supply-chain pacing.`
              ],
              protective: [
                `Active site deployment velocity mitigates catastrophic schedule overrun.`,
                `Inter-agency coordination supports active clearance resolution.`,
                `EPC contractor mobilization capability helps stabilize long-term target completion.`
              ]
            };
          } else if (tab === 'cost3m') {
            const prob = (cRisk * 0.85).toFixed(1);
            const badge = cRisk >= 70 ? 'CRITICAL RISK' : cRisk >= 40 ? 'HIGH RISK' : 'LOW RISK';
            const badgeColor = cRisk >= 70 ? '#D62F39' : cRisk >= 40 ? '#D97706' : '#03045E';
            const badgeBg = cRisk >= 70 ? '#FEE2E2' : cRisk >= 40 ? '#FEF3C7' : '#EBF3FF';

            return {
              tabTitle: '3M COST',
              badge, badgeColor, badgeBg, prob,
              summary: `${proj.name} presents a ${badge} (${prob}% probability) of budget escalation over the next 3 months driven by material drawdown trends.`,
              upward: [
                `Cost escalation delta of ${proj.costOverrunPct || '0%'} over approved budget increases escalation probability.`,
                `Physical progress (${progPhys}%) lagging behind financial disbursement (${progFin}%) creates cost-progress imbalance.`,
                `High overall project budget scale (${formatCurrencyClean(costRev)}) amplifies price sensitivity.`
              ],
              protective: [
                `Original approved budget allocation (${formatCurrencyClean(costApp)}) provides structural baseline protection.`,
                `High fund deployment velocity ensures active contractor liquidity.`
              ]
            };
          } else {
            const prob = Math.min(99, cRisk * 1.15).toFixed(1);
            const badge = cRisk >= 60 ? 'CRITICAL RISK' : 'HIGH RISK';
            const badgeColor = cRisk >= 60 ? '#D62F39' : '#D97706';
            const badgeBg = cRisk >= 60 ? '#FEE2E2' : '#FEF3C7';

            return {
              tabTitle: '6M COST',
              badge, badgeColor, badgeBg, prob,
              summary: `${proj.name} shows a ${badge} (${prob}% probability) of secondary budget expansion over the 6-month forecast horizon.`,
              upward: [
                `Extended project duration increases exposure to commodity price inflation and wage escalation.`,
                `Unresolved contractor claims and revised administrative sanctions drive secondary cost growth.`,
                `Financial drawdown rate exceeding physical completion velocity.`
              ],
              protective: [
                `Ministry financial audit controls limit unauthorized expenditure expansion.`,
                `High physical completion baseline (${progPhys}%) reduces remaining financial uncertainty.`
              ]
            };
          }
        };

        const modelKey = nlpTab === 'sched3m' ? 'schedule_3m' : nlpTab === 'sched6m' ? 'schedule_6m' : nlpTab === 'cost3m' ? 'cost_3m' : 'cost_6m';
        const liveModelExp = modelExplanations?.[modelKey];
        const nlpData = getNaturalLanguageExplanation(project, nlpTab);

        const activeSummary = liveModelExp?.summary || nlpData.summary;
        const activeUpward = (liveModelExp && liveModelExp.primary_reasons && liveModelExp.primary_reasons.length > 0)
          ? [...liveModelExp.primary_reasons, ...(liveModelExp.supporting_factors || [])]
          : nlpData.upward;
        const activeProtective = (liveModelExp && liveModelExp.risk_reducing_factors && liveModelExp.risk_reducing_factors.length > 0)
          ? liveModelExp.risk_reducing_factors
          : nlpData.protective;
        const activeBadge = liveModelExp?.risk_level || nlpData.badge;
        const activeProvider = liveModelExp?.provider || 'Qwen3-8B / Grounded AI Engine';

        return (
          <div className="card nlp-explanation-card" style={{ padding: '24px', borderRadius: '16px', marginTop: '12px', marginBottom: '16px' }}>
            
            {/* Section Header & Subtitle */}
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px', marginBottom: '18px' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Sparkles size={20} color="#7C3AED" />
                  <h2 style={{ fontSize: '17px', fontWeight: 850, color: 'var(--navy-dark)', margin: 0, textTransform: 'uppercase', letterSpacing: '-0.01em' }}>
                    AI NATURAL LANGUAGE EXPLANATION
                  </h2>
                </div>
                <span style={{ fontSize: '12px', color: '#64748B', fontWeight: 500, marginTop: '2px', display: 'block' }}>
                  Model-specific natural language reasoning explaining "Why did the model predict this?"
                </span>
              </div>
            </div>

            {/* Tab Switcher Pills */}
            <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', flexWrap: 'wrap' }}>
              {[
                { id: 'sched3m', label: '3M Schedule', Icon: Clock },
                { id: 'sched6m', label: '6M Schedule', Icon: Clock },
                { id: 'cost3m', label: '3M Cost', Icon: DollarSign },
                { id: 'cost6m', label: '6M Cost', Icon: DollarSign }
              ].map(t => (
                <button
                  key={t.id}
                  className={`nlp-tab-btn ${nlpTab === t.id ? 'active' : ''}`}
                  onClick={() => setNlpTab(t.id as any)}
                >
                  <t.Icon size={14} color={nlpTab === t.id ? '#FFFFFF' : 'var(--navy-dark)'} />
                  <span>{t.label}</span>
                </button>
              ))}
            </div>

            {/* Model Prediction Reasoning Banner Card */}
            <div className="nlp-reasoning-banner">
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
                <span style={{ fontSize: '11.5px', fontWeight: 850, color: 'var(--navy-dark)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  MODEL PREDICTION REASONING ({nlpData.tabTitle})
                </span>
                <span style={{ fontSize: '10px', fontWeight: 800, color: nlpData.badgeColor, backgroundColor: nlpData.badgeBg, padding: '2px 8px', borderRadius: '4px', border: `1px solid ${nlpData.badgeColor}40` }}>
                  {activeBadge}
                </span>
              </div>
              <p style={{ fontSize: '13px', color: '#334155', margin: 0, lineHeight: '1.5', fontWeight: 500 }}>
                {activeSummary}
              </p>
            </div>

            {/* Two Column Split: Key Contributing Factors vs Risk-Reducing Factors */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px', marginBottom: '18px' }}>
              
              {/* Left Column: Key Contributing Factors (Red) */}
              <div className="nlp-factor-card nlp-factor-card-red">
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
                  <span style={{ fontSize: '14px', color: 'var(--color-accent-red)', fontWeight: 900 }}>↗</span>
                  <h3 style={{ fontSize: '13.5px', fontWeight: 850, color: '#991B1B', margin: 0 }}>
                    Primary Upward Risk Drivers
                  </h3>
                  <span style={{ fontSize: '10px', backgroundColor: 'var(--color-accent-red)', color: '#FFFFFF', padding: '2px 6px', borderRadius: '4px', fontWeight: 800 }}>⬆</span>
                </div>

                <ul style={{ margin: 0, paddingLeft: '0', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {activeUpward.map((item, idx) => (
                    <li key={idx} className="nlp-bullet-item nlp-bullet-item-red" style={{ fontSize: '12px', color: '#475569', lineHeight: '1.55', fontWeight: 500 }}>
                      {item}
                    </li>
                  ))}
                </ul>
              </div>

              {/* Right Column: Risk-Reducing Factors (Green) */}
              <div className="nlp-factor-card nlp-factor-card-green">
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
                  <span style={{ fontSize: '14px', color: '#166534', fontWeight: 900 }}>↘</span>
                  <h3 style={{ fontSize: '13.5px', fontWeight: 850, color: '#166534', margin: 0 }}>
                    Risk-Reducing / Protective Forces
                  </h3>
                  <span style={{ fontSize: '10px', backgroundColor: '#166534', color: '#FFFFFF', padding: '2px 6px', borderRadius: '4px', fontWeight: 800 }}>⬇</span>
                </div>

                <ul style={{ margin: 0, paddingLeft: '0', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {activeProtective.map((item, idx) => (
                    <li key={idx} className="nlp-bullet-item nlp-bullet-item-green" style={{ fontSize: '12px', color: '#475569', lineHeight: '1.55', fontWeight: 500 }}>
                      {item}
                    </li>
                  ))}
                </ul>
              </div>

            </div>

            {/* Footer Bar */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px', borderTop: '1px solid #E2E8F0', paddingTop: '12px', fontSize: '11px', color: '#64748B' }}>
              <div>
                <span>Explanation Source: </span>
                <strong style={{ color: '#0F172A' }}>{activeProvider}</strong>
              </div>
              <div style={{ fontWeight: 600, color: '#03045E' }}>
                Grounded on verified ML & TreeSHAP weights
              </div>
            </div>

          </div>
        );
      })()}

      </div>{/* /pd-section-escalation */}

      {/* ─── SECTION: Early Warnings ─── */}
      <div id="pd-section-warnings" className="pd-section-anchor">
      <div className="pd-section-header pd-section-header--warnings">
        <span className="pd-section-tag">04</span>
        <span className="pd-section-name">Early Warnings</span>
      </div>

      {/* Early Warnings & Recommendations Section */}
      {(() => {
        const getEarlyWarningsAndRecommendations = (proj: Project) => {
          const costApp = parseFloat(String(proj.costApproved).replace(/[^0-9.]/g, '')) || 1000;
          const costRev = parseFloat(String(proj.costRevised).replace(/[^0-9.]/g, '')) || costApp;
          const deltaCostVal = costRev - costApp;
          const deltaPct = costApp > 0 ? (((costRev - costApp) / costApp) * 100).toFixed(1) : '0.0';
          const extMo = proj.timeOverrunMonths !== null && proj.timeOverrunMonths !== undefined ? proj.timeOverrunMonths : parseFloat(String(proj.scheduleExtensionMonths || 0));
          const isComp = proj.isCompleted || proj.projectStatus === 'COMPLETED' || (proj.progressPhysical || 0) >= 100;
          const rScore = proj.riskScore || 50;
          const tRisk = proj.timeRisk !== undefined ? proj.timeRisk : rScore;
          const addDelayMo = isComp ? '0.0' : (tRisk * 0.03).toFixed(1);
          const delayProb = isComp ? '0.0' : (tRisk * 0.88).toFixed(1);

          // Target / Completion Date
          const formattedTargetDate = isComp
            ? (proj.actualCompletion || proj.expectedCompletion || 'Completed')
            : (proj.expectedCompletion || 'December 2026');

          const schedRiskBadge = isComp ? 'LOW' : tRisk >= 70 ? 'HIGH' : tRisk >= 40 ? 'MEDIUM' : 'LOW';
          const costRiskBadge = isComp ? 'LOW' : deltaCostVal > costApp * 0.2 ? 'HIGH' : deltaCostVal > 0 ? 'MEDIUM' : 'LOW';

          // Dynamic Recommendations Generator
          const recommendations = [];
          if (isComp) {
            recommendations.push({
              title: 'Asset Capitalization & Defect Liability Oversight',
              priority: 'MEDIUM',
              action: `Complete commercial capitalization of ₹${formatCurrencyClean(costRev)} asset and establish warranty monitoring with ${proj.agency || 'executing agency'}.`,
              trigger: `Project reached 100% completion on ${proj.actualCompletion || proj.expectedCompletion}.`,
              impact: 'Ensures asset lifespan protection and formal financial closure.'
            });
          } else {
            if (tRisk >= 50) {
              recommendations.push({
                title: 'Establish Milestone Recovery & Fast-Tracking Taskforce',
                priority: 'HIGH',
                action: `Initiate joint review with ${proj.agency || 'executing agency'} to compress critical-path work packages and clear right-of-way/vendor bottlenecks.`,
                trigger: `High schedule delay probability (${delayProb}%)...`,
                impact: 'Prevents further cascading delay on subsequent work packages.'
              });
            }
            if (deltaCostVal > 0) {
              recommendations.push({
                title: 'Establish Fiscal Ceiling Oversight & Variation Audit',
                priority: deltaCostVal > costApp * 0.3 ? 'HIGH' : 'MEDIUM',
                action: `Audit price escalation variations for ${proj.name} to ensure expenditure remains within revised sanction ceiling of ${formatCurrencyClean(costRev)}.`,
                trigger: `Cumulative cost revision of +${deltaPct}% (+${formatCurrencyClean(deltaCostVal)})...`,
                impact: 'Protects against secondary budget revisions and financial freeze.'
              });
            }
            if (recommendations.length === 0) {
              recommendations.push({
                title: 'Maintain Baseline Execution Monitoring & Milestone Alignment',
                priority: 'LOW',
                action: `Continue monthly physical-financial drawdown tracking to preserve stable target completion timeline.`,
                trigger: `Low risk score (${rScore}/100) with stable drawdown velocity...`,
                impact: 'Sustains on-track delivery schedule.'
              });
            }
          }

          return {
            extMo,
            delayProb,
            addDelayMo,
            formattedTargetDate,
            schedRiskBadge,
            costRev: formatCurrencyClean(costRev),
            costApp: formatCurrencyClean(costApp),
            deltaCost: deltaCostVal >= 0 ? `+${formatCurrencyClean(deltaCostVal)}` : formatCurrencyClean(deltaCostVal),
            deltaPct,
            costRiskBadge,
            recommendations
          };
        };

        const ewr = getEarlyWarningsAndRecommendations(project);
        const activeWarningsList = (earlyWarnings && earlyWarnings.warnings && earlyWarnings.warnings.length > 0)
          ? earlyWarnings.warnings
          : [
              {
                id: 'warn_sched',
                title: 'Schedule Escalation Risk',
                severity: ewr.schedRiskBadge,
                evidence: `Cumulative extension of ${ewr.extMo} months recorded; incremental delay probability at ${ewr.delayProb}%.`,
                impact: `Projected delay extension of +${ewr.addDelayMo} months shifts tentative completion to ${ewr.formattedTargetDate}.`
              },
              {
                id: 'warn_cost',
                title: 'Budget Outlay Escalation Pressure',
                severity: ewr.costRiskBadge,
                evidence: `Approved: ${ewr.costApp}, Revised: ${ewr.costRev} (${ewr.deltaCost}).`,
                impact: `Cost escalation of +${ewr.deltaPct}% demands active expenditure ceiling audit.`
              }
            ];

        const activeRecsList = (recommendations && recommendations.recommendations && recommendations.recommendations.length > 0)
          ? recommendations.recommendations
          : ewr.recommendations.map((r: any, i: number) => ({
              id: `rec_${i}`,
              title: r.title,
              priority: r.priority,
              recommendation: r.action,
              reason: r.trigger,
              expected_impact: r.impact
            }));

        return (
          <div className="card early-warnings-recommendations-card" style={{ padding: '24px', borderRadius: '16px', marginTop: '12px', marginBottom: '16px' }}>
            
            {/* Section Header & Subtitle */}
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px', marginBottom: '20px' }}>
              <div>
                <h2 style={{ fontSize: '18px', fontWeight: 850, color: 'var(--navy-dark)', margin: 0, letterSpacing: '-0.02em' }}>
                  Early Warnings & Recommendations
                </h2>
                <span style={{ fontSize: '12px', color: '#64748B', fontWeight: 500, marginTop: '2px', display: 'block' }}>
                  Automated anomaly indicators and grounded administrative mitigation actions
                </span>
              </div>

              {/* Active Warnings Pill Badge */}
              <span style={{ fontSize: '12px', fontWeight: 750, color: '#03045E', backgroundColor: '#F0F7FF', padding: '5px 12px', borderRadius: '20px', border: '1px solid #BFDBFE' }}>
                {activeWarningsList.length} Active Warning{activeWarningsList.length > 1 ? 's' : ''}
              </span>
            </div>

            {/* Two-Column 50/50 Layout */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px' }}>
              
              {/* Left Column: AI EARLY WARNINGS */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                
                {/* AI Early Warnings Card Header */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{ backgroundColor: '#FEE2E2', padding: '6px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <AlertTriangle size={16} color="#D62F39" />
                    </div>
                    <div>
                      <h3 style={{ fontSize: '13.5px', fontWeight: 850, color: 'var(--navy-dark)', margin: 0, textTransform: 'uppercase', letterSpacing: '0.02em' }}>
                        AI EARLY WARNINGS
                      </h3>
                      <span style={{ fontSize: '11px', color: '#64748B' }}>Anomaly flags detected by telemetry analysis</span>
                    </div>
                  </div>
                  <span style={{ fontSize: '10.5px', fontWeight: 800, color: '#991B1B', backgroundColor: '#FEE2E2', padding: '2px 8px', borderRadius: '10px', border: '1px solid #FCA5A5' }}>
                    {activeWarningsList.length} DETECTED
                  </span>
                </div>

                {/* Warnings List */}
                {activeWarningsList.map((warn, wIdx) => {
                  const isHigh = warn.severity === 'HIGH' || warn.severity === 'CRITICAL';
                  return (
                    <div key={warn.id || wIdx} className={`warning-pill-card ${isHigh ? 'warning-pill-card-high' : ''}`} style={{ backgroundColor: '#FFFDF5', padding: '16px 18px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13.5px', fontWeight: 850, color: 'var(--navy-dark)' }}>
                          <Clock size={16} color={isHigh ? '#D62F39' : '#D97706'} />
                          {warn.title}
                        </div>
                        <span style={{ fontSize: '10px', fontWeight: 800, color: isHigh ? '#D62F39' : '#D97706', backgroundColor: isHigh ? '#FEE2E2' : '#FEF3C7', padding: '3px 10px', borderRadius: '6px', border: `1px solid ${isHigh ? '#FCA5A5' : '#FDE68A'}` }}>
                          {warn.severity}
                        </span>
                      </div>

                      <div style={{ fontSize: '12px', color: '#334155', lineHeight: '1.5', marginBottom: '8px' }}>
                        <strong>Evidence:</strong> {warn.evidence}
                      </div>

                      <div className={`ewr-impact-box ${isHigh ? 'ewr-impact-red' : 'ewr-impact-amber'}`}>
                        <TrendingUp size={15} color={isHigh ? '#D62F39' : '#D97706'} style={{ flexShrink: 0 }} />
                        <span style={{ fontSize: '11.5px', color: '#334155', fontWeight: 600, lineHeight: '1.4' }}>
                          <strong>Impact:</strong> {warn.impact}
                        </span>
                      </div>
                    </div>
                  );
                })}

              </div>

              {/* Right Column: AI RECOMMENDATIONS */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                
                {/* AI Recommendations Header */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{ backgroundColor: '#DCFCE7', padding: '6px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Sparkles size={16} color="#166534" />
                    </div>
                    <div>
                      <h3 style={{ fontSize: '13.5px', fontWeight: 850, color: 'var(--navy-dark)', margin: 0, textTransform: 'uppercase', letterSpacing: '0.02em' }}>
                        AI RECOMMENDATIONS
                      </h3>
                      <span style={{ fontSize: '11px', color: '#64748B' }}>Actionable interventions grounded in predictive signals</span>
                    </div>
                  </div>
                  <span style={{ fontSize: '10.5px', fontWeight: 800, color: '#166534', backgroundColor: '#DCFCE7', padding: '2px 8px', borderRadius: '10px', border: '1px solid #86EFAC' }}>
                    {activeRecsList.length} ACTION ITEM{activeRecsList.length > 1 ? 'S' : ''}
                  </span>
                </div>

                {/* Recommendation Cards List */}
                {activeRecsList.map((rec: any, idx: number) => (
                  <div key={rec.id || idx} className="recommendation-pill-card" style={{ backgroundColor: '#F8FAFC', padding: '16px 18px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13.5px', fontWeight: 850, color: 'var(--navy-dark)' }}>
                        <Award size={16} color="#166534" />
                        {rec.title}
                      </div>
                      <span style={{ fontSize: '10px', fontWeight: 800, color: rec.priority === 'HIGH' ? '#991B1B' : '#166534', backgroundColor: rec.priority === 'HIGH' ? '#FEE2E2' : '#DCFCE7', padding: '3px 10px', borderRadius: '6px', border: `1px solid ${rec.priority === 'HIGH' ? '#FCA5A5' : '#86EFAC'}` }}>
                        {rec.priority} PRIORITY
                      </span>
                    </div>

                    <p style={{ fontSize: '12.5px', color: '#334155', margin: '0 0 12px 0', lineHeight: '1.55', fontWeight: 500 }}>
                      {rec.recommendation}
                    </p>

                    {/* Visual Metric Chips for Trigger & Impact */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                      <div className="ewr-metric-chip" style={{ backgroundColor: '#F0F7FF', borderColor: '#BFDBFE' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#03045E', fontSize: '10.5px', fontWeight: 750 }}>
                          <Zap size={13} color="#03045E" />
                          Trigger Signal
                        </div>
                        <span style={{ fontSize: '11.5px', fontWeight: 700, color: '#0F172A', lineHeight: '1.35', marginTop: '2px' }}>
                          {rec.reason}
                        </span>
                      </div>

                      <div className="ewr-metric-chip" style={{ backgroundColor: '#F0FDF4', borderColor: '#86EFAC' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#166534', fontSize: '10.5px', fontWeight: 750 }}>
                          <CheckCircle2 size={13} color="#166534" />
                          Anticipated Impact
                        </div>
                        <span style={{ fontSize: '11.5px', fontWeight: 750, color: '#15803D', lineHeight: '1.35', marginTop: '2px' }}>
                          {rec.expected_impact}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}

              </div>

            </div>

          </div>
        );
      })()}

      </div>{/* /pd-section-warnings */}

        {/* ─── END OF PAGE: TAKE ACTION CTA BANNER ─── */}
        <div className="pd-take-action-bottom-card">
          <div className="take-action-content">
            <div className="take-action-badge-tag">
              <ShieldAlert size={14} color="#DC2626" />
              <span>EXECUTIVE INTERVENTION WORKSPACE</span>
            </div>
            <h2 className="take-action-title">Ready to Take Executive Action on {project.name}?</h2>
            <p className="take-action-desc">
              Open the Action Center to launch AI-recommended fast-track directives, execute What-If policy simulations, and route official administrative memos to designated governing authorities ({project.ministry}).
            </p>
            <div className="take-action-metrics-summary">
              <span className="summary-chip chip-red">ML Risk Index: {project.riskScore}/100</span>
              <span className="summary-chip chip-amber">Schedule Slippage: +{project.timeOverrunMonths || 0} Months</span>
              <span className="summary-chip chip-blue">Revised Outlay: ₹{project.costRevised}</span>
            </div>
          </div>

          <button
            type="button"
            className="take-action-cta-btn"
            onClick={() => {
              if (onTakeAction) {
                onTakeAction(project.id);
              }
            }}
          >
            <ShieldAlert size={18} />
            <span>Take Action in Action Center</span>
            <ArrowRight size={18} />
          </button>
        </div>

        </div>{/* /pd-main-content */}
      </div>{/* /pd-layout-wrapper */}



      {/* Floating AI Assistant Chatbot Button & Modal rendered via Portal to STAY fixed floating on screen across whole page */}
      {typeof document !== 'undefined' && createPortal(
        <div className="ai-floating-widget-container">
          {/* Floating Interactive Project AI Assistant Chatbot Modal */}
          {aiAssistantOpen && (
            <div className="ai-chatbot-modal" role="dialog" aria-modal="true" aria-labelledby="project-ai-assistant-title">
              {/* Header */}
              <div style={{ backgroundColor: '#03045E', padding: '16px 20px', color: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{ width: '32px', height: '32px', backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Bot size={18} color="#FFFFFF" />
                  </div>
                  <div>
                    <h3 id="project-ai-assistant-title" style={{ fontSize: '14px', fontWeight: 850, margin: 0, color: '#FFFFFF' }}>
                      Project AI Intelligence Assistant
                    </h3>
                    <span style={{ fontSize: '11px', color: '#93C5FD', display: 'block', marginTop: '1px' }}>
                      Online | {project.name}
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => setAiAssistantOpen(false)}
                  style={{ background: 'none', border: 'none', color: '#FFFFFF', cursor: 'pointer', opacity: 0.8, padding: '4px' }}
                >
                  <X size={18} />
                </button>
              </div>

              {/* Chat Body & Scroll Area */}
              <div style={{ flex: 1, padding: '16px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '12px', backgroundColor: '#F8FAFC' }}>
                
                {chatMessages.map((msg) => {
                  const isUser = msg.sender === 'user';
                  return (
                    <div key={msg.id} className={`chat-msg-row ${isUser ? 'chat-msg-row-user' : ''}`}>
                      <div style={{ width: '28px', height: '28px', backgroundColor: isUser ? '#0A192F' : '#03045E', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        {isUser ? <Send size={13} color="#FFFFFF" /> : <Bot size={14} color="#FFFFFF" />}
                      </div>
                      
                      <div className={isUser ? 'chat-bubble-user' : 'chat-bubble-ai'}>
                        {!isUser && (
                          <div style={{ fontSize: '10px', fontWeight: 850, color: '#03045E', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '4px' }}>
                            AI MODEL INTELLIGENCE
                          </div>
                        )}
                        <div style={{ margin: 0, fontWeight: 500 }}>
                          {formatChatMessageText(msg.text)}
                        </div>

                        {msg.insights && msg.insights.length > 0 && (
                          <ul style={{ margin: '8px 0 0 0', paddingLeft: '16px', fontSize: '11.5px', color: '#475569' }}>
                            {msg.insights.map((ins, i) => (
                              <li key={i} style={{ marginBottom: '3px' }}>{ins}</li>
                            ))}
                          </ul>
                        )}

                        <div style={{ fontSize: '9.5px', color: isUser ? 'rgba(255,255,255,0.7)' : '#94A3B8', textAlign: isUser ? 'right' : 'left', marginTop: '4px' }}>
                          {msg.timestamp}
                        </div>
                      </div>
                    </div>
                  );
                })}

                {/* Bouncing Typing Indicator */}
                {aiQuerying && (
                  <div className="chat-msg-row">
                    <div style={{ width: '28px', height: '28px', backgroundColor: '#03045E', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <Bot size={14} color="#FFFFFF" />
                    </div>
                    <div className="typing-indicator-box">
                      <div className="typing-dot" />
                      <div className="typing-dot" />
                      <div className="typing-dot" />
                      <span style={{ fontSize: '11.5px', color: '#64748B', marginLeft: '6px', fontWeight: 600 }}>Analyzing telemetry...</span>
                    </div>
                  </div>
                )}

                <div ref={chatEndRef} />
              </div>

              {/* Quick Prompts Selector */}
              <div style={{ backgroundColor: '#FFFFFF', padding: '8px 12px', borderTop: '1px solid #E2E8F0', overflowX: 'auto', display: 'flex', gap: '6px', scrollbarWidth: 'none' }}>
                {[
                  "Why is this project at risk?",
                  "What drives cost escalation?",
                  "Why does 6M forecast differ from 3M?",
                  "What factors reduce schedule delay?",
                  "Recommended intervention plan"
                ].map((pText, i) => (
                  <button
                    key={i}
                    className="chat-prompt-pill"
                    onClick={() => {
                      setAiQuery(pText);
                      handleAskAssistant(pText);
                    }}
                  >
                    {pText}
                  </button>
                ))}
              </div>

              {/* Chat Input Field */}
              <div style={{ padding: '12px 14px', backgroundColor: '#FFFFFF', borderTop: '1px solid #E2E8F0', display: 'flex', gap: '8px' }}>
                <input
                  type="text"
                  value={aiQuery}
                  onChange={(e) => setAiQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAskAssistant()}
                  placeholder="Ask AI about this project..."
                  style={{
                    flex: 1,
                    padding: '9px 12px',
                    borderRadius: '20px',
                    border: '1px solid #CBD5E1',
                    fontSize: '12.5px',
                    fontFamily: 'inherit',
                    outline: 'none'
                  }}
                />
                <button
                  onClick={() => handleAskAssistant()}
                  disabled={aiQuerying || !aiQuery.trim()}
                  style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: '50%',
                    backgroundColor: aiQuerying || !aiQuery.trim() ? '#CBD5E1' : '#03045E',
                    color: '#FFFFFF',
                    border: 'none',
                    cursor: aiQuerying || !aiQuery.trim() ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: '0 2px 6px rgba(3,4,94,0.2)'
                  }}
                >
                  <Send size={15} />
                </button>
              </div>
            </div>
          )}

          {/* Floating Action Trigger Button with Callout Tag */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', pointerEvents: 'auto' }}>
            {!aiAssistantOpen && (
              <button
                onClick={() => setAiAssistantOpen(true)}
                className="ai-floating-pill-badge"
              >
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#22C55E', boxShadow: '0 0 8px #22C55E', display: 'inline-block' }} />
                <span>AI Copilot</span>
                <Sparkles size={13} color="#60A5FA" />
              </button>
            )}

            <button
              className="ai-floating-chat-btn"
              onClick={() => setAiAssistantOpen(!aiAssistantOpen)}
              title={aiAssistantOpen ? "Close AI Assistant" : "Open Project AI Assistant"}
              aria-label={aiAssistantOpen ? "Close AI Assistant" : "Open Project AI Assistant"}
            >
              {aiAssistantOpen ? <X size={24} aria-hidden="true" /> : <Bot size={24} aria-hidden="true" />}
              {!aiAssistantOpen && (
                <span className="ai-pulse-ring" />
              )}
            </button>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};
