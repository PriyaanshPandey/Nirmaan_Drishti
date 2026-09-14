import React, { useState, useEffect } from 'react';
import {
  Sparkles, ShieldAlert, Clock, Users, ArrowRight, ChevronDown, Check,
  ChevronRight, TrendingUp, HelpCircle, Layers, BarChart3, Zap, Send, Bot, X, ExternalLink
} from 'lucide-react';
import './AIInsights.css';
import { api } from '../services/api';
import { AnimatedCounter } from './AnimatedCounter';
import { StatusIndicator } from './StatusIndicator';
import { InfoButton } from './ExplainabilityInfo';

type InsightData = {
  as_of_date: string;
  total_projects: number;
  high_risk_count: number;
  summary_text: string;
  recommendations: Array<{ id: number; title: string; impact: string; impactClass: string; iconType: string; iconBg: string; desc: string }>;
  emerging_issues: Array<{ label: string; count: number; impact: string }>;
  patterns: Array<{ title: string; count: number; risk: string; riskClass: string; detail: string }>;
  similarity: { score: number; total_comparable: number; cost_overrun_pct: number; schedule_delay_pct: number; on_hold_pct: number };
  predictive: { projects_entering_risk: number; projects_entering_risk_pct: string; expected_portfolio_delay: string; potential_cost_overrun: string; active_scenarios: number };
  sector_insights: Array<{ name: string; label: string; labelClass: string; pct: string; count: number; desc: string }>;
  risk_drivers: Array<{ label: string; pct: number; color: string }>;
};

type InsightsTab = 'overview' | 'issues' | 'patterns' | 'similarity' | 'drivers' | 'predictive';

const FALLBACK_INSIGHTS: InsightData = {
  as_of_date: new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' }),
  total_projects: 6568,
  high_risk_count: 148,
  summary_text: "Current telemetry indicates elevated portfolio risks driven by physical progress lags, milestone slippages, and financial outlay divergence across monitored central infrastructure projects.",
  recommendations: [
    {
      id: 1,
      title: "Fast-Track Milestone Recovery",
      impact: "High Impact",
      impactClass: "font-red",
      iconType: "clock",
      iconBg: "var(--color-accent-red)",
      desc: "Milestone slippage represents the primary critical path risk across active construction packages."
    },
    {
      id: 2,
      title: "Reconcile Financial Outlays",
      impact: "High Impact",
      impactClass: "font-red",
      iconType: "shield",
      iconBg: "var(--color-accent-red)",
      desc: "Advance payment and outlay divergence require verified expenditure audits before subsequent fund release."
    },
    {
      id: 3,
      title: "Accelerate Physical Progress",
      impact: "Medium Impact",
      impactClass: "font-orange",
      iconType: "shield",
      iconBg: "#F59E0B",
      desc: "Lag between scheduled progress and actual site execution observed in major transportation corridors."
    },
    {
      id: 4,
      title: "Enforce Cost Escalation Controls",
      impact: "Medium Impact",
      impactClass: "font-orange",
      iconType: "users",
      iconBg: "#F59E0B",
      desc: "Budget revisions exceeding original sanction require administrative value engineering reviews."
    }
  ],
  emerging_issues: [
    { label: "Physical Progress Lag", count: 184, impact: "+18%" },
    { label: "Milestone Slippage", count: 142, impact: "+14%" },
    { label: "Financial Outlay Divergence", count: 96, impact: "+9%" },
    { label: "Cost Escalation", count: 74, impact: "+7%" },
    { label: "Work Stagnation Risk", count: 52, impact: "+5%" }
  ],
  patterns: [
    {
      title: "High Expenditure + Low Progress = Milestone Slippage",
      count: 34,
      risk: "High Risk",
      riskClass: "font-red",
      detail: "Milestone slippages strongly correlated with capital drawdowns outpacing actual physical execution."
    },
    {
      title: "Repeated Milestone Slippage = Extended Project Delay",
      count: 26,
      risk: "Medium Risk",
      riskClass: "font-orange",
      detail: "Corridor nodes experiencing consecutive milestone revisions exhibit exponential completion delays."
    },
    {
      title: "Cost Escalation = Financial Outlay Stagnation",
      count: 21,
      risk: "Medium Risk",
      riskClass: "font-orange",
      detail: "Unapproved cost escalation leads to funding stalls and administrative re-sanction cycles."
    }
  ],
  similarity: {
    score: 42,
    total_comparable: 50,
    cost_overrun_pct: 78,
    schedule_delay_pct: 82,
    on_hold_pct: 12
  },
  predictive: {
    projects_entering_risk: 148,
    projects_entering_risk_pct: "+12%",
    expected_portfolio_delay: "8.4 months",
    potential_cost_overrun: "₹56,420 Cr",
    active_scenarios: 3
  },
  sector_insights: [
    { name: "Railways", label: "High risk sector", labelClass: "font-red", pct: "+28%", count: 92, desc: "92 projects affected" },
    { name: "Road Transport", label: "High risk sector", labelClass: "font-red", pct: "+24%", count: 114, desc: "114 projects affected" },
    { name: "Power", label: "Common patterns", labelClass: "font-orange", pct: "+12%", count: 45, desc: "45 projects affected" },
    { name: "Petroleum", label: "Common bottlenecks", labelClass: "font-blue", pct: "+9%", count: 32, desc: "32 projects affected" },
    { name: "Coal", label: "Common bottlenecks", labelClass: "font-blue", pct: "+6%", count: 18, desc: "18 projects affected" }
  ],
  risk_drivers: [
    { label: "Physical Progress Lag", pct: 42, color: "bg-accent" },
    { label: "Milestone Slippage", pct: 38, color: "bg-accent" },
    { label: "Cost Escalation", pct: 26, color: "bg-orange" },
    { label: "Financial Outlay Divergence", pct: 19, color: "bg-info" },
    { label: "Work Stagnation Risk", pct: 14, color: "bg-info" }
  ]
};

interface AIInsightsProps {
  onSelectProject?: (projectId: string) => void;
  onNavigateTab?: (tab: string) => void;
}

export const AIInsights: React.FC<AIInsightsProps> = ({ onSelectProject }) => {
  const [activeSubTab, setActiveSubTab] = useState<InsightsTab>('overview');
  const [expandedPattern, setExpandedPattern] = useState<number | null>(0);
  const [selectedSimilarity, setSelectedSimilarity] = useState<'cost' | 'schedule' | 'onhold'>('schedule');
  const [insightsData, setInsightsData] = useState<InsightData | null>(null);
  const [loadingInsights, setLoadingInsights] = useState(true);
  const [isFallback, setIsFallback] = useState(false);

  // Modal for viewing projects affiliated with a risk recommendation
  const [selectedRecModal, setSelectedRecModal] = useState<{
    rec: { id: number; title: string; impact: string; impactClass: string; desc: string };
    projects: Array<{
      id: string;
      name: string;
      agency: string;
      ministry: string;
      riskScore: number;
      costOverrunPct: string;
      scheduleStatus: string;
    }>;
    loading: boolean;
  } | null>(null);

  const handleOpenAffectedProjects = async (rec: any) => {
    setSelectedRecModal({ rec, projects: [], loading: true });
    try {
      const res = await api.getProjects(1, 15);
      if (res && res.items) {
        const mapped = res.items.map((p) => ({
          id: p.id,
          name: p.name,
          agency: p.agency,
          ministry: p.ministry,
          riskScore: p.riskScore,
          costOverrunPct: p.costOverrunPct,
          scheduleStatus: p.scheduleStatus,
        }));
        setSelectedRecModal({ rec, projects: mapped, loading: false });
      } else {
        setSelectedRecModal({ rec, projects: [], loading: false });
      }
    } catch (e) {
      console.error(e);
      setSelectedRecModal({ rec, projects: [], loading: false });
    }
  };

  useEffect(() => {
    if (!selectedRecModal) return;
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setSelectedRecModal(null);
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [selectedRecModal]);

  // Interactive Portfolio AI Assistant state
  const [queryText, setQueryText] = useState('');
  const [queryAnswer, setQueryAnswer] = useState<string | null>(null);
  const [queryInsights, setQueryInsights] = useState<string[]>([]);
  const [queryLoading, setQueryLoading] = useState(false);

  const handleQuery = async (customText?: string) => {
    const q = customText || queryText;
    if (!q.trim()) return;
    setQueryLoading(true);
    setQueryAnswer(null);
    try {
      const res = await api.queryAssistant(q);
      if (res) {
        setQueryAnswer(res.answer);
        setQueryInsights(res.insights || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setQueryLoading(false);
    }
  };

  useEffect(() => {
    setLoadingInsights(true);
    api.getInsightsSummary().then((res) => {
      if (res && res.total_projects !== undefined) {
        setInsightsData(res as InsightData);
        setIsFallback(false);
      } else {
        setInsightsData(FALLBACK_INSIGHTS);
        setIsFallback(true);
      }
      setLoadingInsights(false);
    }).catch(() => {
      setInsightsData(FALLBACK_INSIGHTS);
      setIsFallback(true);
      setLoadingInsights(false);
    });
  }, []);

  const subTabs = [
    { id: 'overview', label: 'Overview' },
    { id: 'issues', label: 'Emerging Issues' },
    { id: 'patterns', label: 'Pattern Detection' },
    { id: 'similarity', label: 'Historical Similarity' },
    { id: 'drivers', label: 'Risk Drivers' },
    { id: 'predictive', label: 'Predictive Insights' },
  ];

  // Map iconType from API to actual React element
  const getRecIcon = (iconType: string) => {
    switch (iconType) {
      case 'clock': return <Clock size={16} color="#ffffff" />;
      case 'users': return <Users size={16} color="#ffffff" />;
      default: return <ShieldAlert size={16} color="#ffffff" />;
    }
  };

  // Emerging Trends sparkline helper
  const renderSparkline = (points: string, color: string) => (
    <svg aria-hidden="true" width="45" height="15" viewBox="0 0 50 20" className="trend-sparkline-svg">
      <path d={points} fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );

  // Circular progress loader for Historical Similarity
  const renderSimilarityCircle = (pct: number, label: string, key: 'cost' | 'schedule' | 'onhold') => {
    const radius = 18;
    const circum = 2 * Math.PI * radius;
    const offset = circum - (pct / 100) * circum;
    const isActive = selectedSimilarity === key;

    return (
      <div
        className={`similarity-circle-unit ${isActive ? 'active' : ''}`}
        onClick={() => setSelectedSimilarity(key)}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            setSelectedSimilarity(key);
          }
        }}
        style={{ cursor: 'pointer' }}
        role="button"
        tabIndex={0}
        aria-label={`${label}: ${pct}% similarity`}
        aria-pressed={isActive}
      >
        <div className="similarity-circle-svg-wrapper">
          <svg aria-hidden="true" width="44" height="44" viewBox="0 0 44 44">
            <circle cx="22" cy="22" r={radius} fill="none" stroke="#F1F5F9" strokeWidth="3" />
            <circle
              cx="22"
              cy="22"
              r={radius}
              fill="none"
              stroke="#D62F39"
              strokeWidth="3"
              strokeDasharray={circum}
              strokeDashoffset={offset}
              strokeLinecap="round"
              transform="rotate(-90 22 22)"
            />
          </svg>
          <span className="similarity-circle-val">{pct}%</span>
        </div>
        <span className="similarity-circle-lbl">{label}</span>
      </div>
    );
  };

  const getSimilarityFooterText = () => {
    if (!insightsData) return '';
    const sim = insightsData.similarity;
    switch (selectedSimilarity) {
      case 'cost':
        return `Projects with similar profiles showed ${sim.cost_overrun_pct}% chance of significant cost overruns exceeding 15% of approved budget.`;
      case 'schedule':
        return `Projects with similar profiles showed ${sim.schedule_delay_pct}% chance of significant schedule delays exceeding 12 months.`;
      case 'onhold':
        return `Projects with similar profiles showed ${sim.on_hold_pct}% chance of being placed on hold within the next 18 months.`;
      default:
        return `Projects with similar profiles showed ${sim.schedule_delay_pct}% chance of significant delay within 18 months.`;
    }
  };

  const sparkPaths = [
    'M 2 12 Q 12 5, 22 10 T 42 2 T 48 8',
    'M 2 12 C 15 15, 25 2, 35 10 T 48 4',
    'M 2 15 C 10 10, 20 18, 30 8 T 48 2',
    'M 2 15 Q 12 12, 22 8 T 42 12 T 48 5',
    'M 2 15 C 15 15, 25 12, 35 12 T 48 8',
  ];
  const sparkColors = [
    'var(--color-accent-red)', '#F59E0B', '#F59E0B', '#A855F7', 'var(--color-on-track)'
  ];
  const issueValClasses = ['font-red', 'font-orange', 'font-orange', 'font-purple', 'font-blue'];

  return (
    <div className="insights-container animation-fade-in">
      {/* Title Block Header */}
      <div className="insights-header-block">
        <div className="header-block-left">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <h1 className="insights-page-title">AI Insights</h1>
            <InfoButton
              title="AI Insights System"
              summary="Synthesizes real-time project telemetry, machine learning delay predictions, and historical pattern clustering into actionable intelligence."
              size="md"
            />
          </div>
          <p className="insights-page-subtitle">Actionable intelligence for a stronger infrastructure tomorrow.</p>
        </div>
        <div className="header-block-right">
          <div className="insights-date-group">
            <span className="insights-date-indicator">{insightsData?.as_of_date || 'Loading...'}</span>
            <span className="insights-update-sub" style={{ color: isFallback ? '#DC2626' : '#64748B', fontWeight: isFallback ? 700 : 'normal' }}>
              {isFallback ? 'Simulated Sandbox Mode (Offline)' : 'Live data from PostgreSQL'}
            </span>
          </div>

          <div className="ai-dropdown-badge">
            <Sparkles size={13} className="ai-spark-icon" />
            <span className="ai-dropdown-txt">AI Powered Insights</span>
            <ChevronDown size={12} className="ai-chevron" />
          </div>
        </div>
      </div>

      {/* Show loading state if loading */}
      {loadingInsights ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '300px', gap: '16px' }}>
          <div style={{ width: '36px', height: '36px', border: '3px solid #E2E8F0', borderTop: '3px solid #2563EB', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
          <span style={{ color: '#64748B', fontSize: '14px' }}>Loading AI insights from backend...</span>
        </div>
      ) : !insightsData ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '300px', gap: '16px' }}>
          <Sparkles size={32} color="#94A3B8" />
          <span style={{ color: '#64748B', fontSize: '14px' }}>AI insights unavailable. Under Development.</span>
        </div>
      ) : (
        <>
      {/* Interactive AI Intelligence Query Bar */}
      <div className="card" style={{ padding: '18px 24px', borderRadius: '14px', border: '1.5px solid #2563EB', marginBottom: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
          <div style={{ backgroundColor: '#EFF6FF', padding: '8px', borderRadius: '8px' }}>
            <Bot size={20} color="#2563EB" />
          </div>
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <h3 style={{ fontSize: '15px', fontWeight: 800, color: 'var(--navy-dark)', margin: 0 }}>
                  National Infrastructure AI Intelligence Assistant
                </h3>
                <span style={{ fontSize: '10px', fontWeight: 800, padding: '2px 7px', borderRadius: '4px', backgroundColor: '#EFF6FF', color: '#2563EB', border: '1px solid #BFDBFE' }}>
                  Interactive NLP Preview
                </span>
                <InfoButton
                  title="AI Intelligence Assistant"
                  summary="Direct natural language querying over project execution, delay drivers, and PMG intervention targets across 6,568+ monitored projects."
                  size="sm"
                />
              </div>
              <p style={{ fontSize: '12px', color: '#64748B', margin: '2px 0 0 0' }}>
                Direct natural language querying over project execution, delay drivers, and PMG intervention targets.
              </p>
            </div>
          </div>
        </div>

        {/* Quick Query Prompts */}
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '12px' }}>
          {[
            "What are the top systemic causes of delays across railway & highway sectors?",
            "How many projects face critical delay risks over the next 6 months?",
            "Which projects exhibit highest physical vs financial progress gap?"
          ].map((promptText, idx) => (
            <button
              key={idx}
              onClick={() => {
                setQueryText(promptText);
                handleQuery(promptText);
              }}
              style={{
                fontSize: '11.5px',
                backgroundColor: '#F8FAFC',
                border: '1px solid #E2E8F0',
                borderRadius: '100px',
                padding: '4px 12px',
                cursor: 'pointer',
                color: '#334155',
                fontWeight: 600
              }}
            >
              {promptText}
            </button>
          ))}
        </div>

        {/* Query Input */}
        <div style={{ display: 'flex', gap: '8px' }}>
          <input
            type="text"
            value={queryText}
            onChange={(e) => setQueryText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleQuery()}
            placeholder="Ask anything about infrastructure portfolio risk patterns, systemic drivers, or specific ministries..."
            style={{
              flex: 1,
              padding: '10px 14px',
              borderRadius: '8px',
              border: '1px solid #CBD5E1',
              fontSize: '13px',
              fontFamily: 'inherit'
            }}
          />
          <button
            onClick={() => handleQuery()}
            disabled={queryLoading || !queryText.trim()}
            style={{
              backgroundColor: '#2563EB',
              color: '#FFFFFF',
              border: 'none',
              borderRadius: '8px',
              padding: '0 18px',
              cursor: queryLoading ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontWeight: 700,
              fontSize: '13px'
            }}
          >
            {queryLoading ? 'Analyzing...' : <><Send size={14} /> Inquire</>}
          </button>
        </div>

        {/* AI Answer Display */}
        {queryAnswer && (
          <div style={{ backgroundColor: '#F8FAFC', padding: '14px 16px', borderRadius: '8px', border: '1px solid #E2E8F0', marginTop: '12px' }}>
            <div style={{ fontSize: '11px', fontWeight: 800, color: '#2563EB', marginBottom: '4px', letterSpacing: '0.5px' }}>
              AI INTELLIGENCE SYNTHESIS
            </div>
            <p style={{ fontSize: '13px', lineHeight: '1.6', color: '#1E293B', margin: 0, whiteSpace: 'pre-line' }}>
              {queryAnswer}
            </p>
            {queryInsights && queryInsights.length > 0 && (
              <ul style={{ margin: '8px 0 0 0', paddingLeft: '18px', fontSize: '12px', color: '#475569' }}>
                {queryInsights.map((ins, i) => (
                  <li key={i} style={{ marginBottom: '3px' }}>{ins}</li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>

      {/* Pill sub-tabs selector */}
      <div className="insights-sub-tabs-bar">
        {subTabs.map((tab) => (
          <button
            key={tab.id}
            className={`insights-sub-tab-btn ${activeSubTab === tab.id ? 'active' : ''}`}
            onClick={() => setActiveSubTab(tab.id as InsightsTab)}
            aria-selected={activeSubTab === tab.id}
            role="tab"
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Main Insights Content Grid */}
      {activeSubTab === 'overview' ? (
        <div className="insights-grid-content">
          {/* Row 1: Recommendations Block & Summary Box */}
          <div className="insights-row-recommendations-summary">
            {/* AI Recommendations */}
            <div className="card recommendations-card">
              <div className="recommendations-header">
                <div>
                  <h2 className="card-title flex-align-center gap-6" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                    <div className="flex-align-center gap-6">
                      <Zap size={15} fill="var(--color-on-track)" color="var(--color-on-track)" />
                      <span>AI Recommendations</span>
                      <InfoButton
                        title="AI System Recommendations"
                        summary="Prioritized operational interventions targeting high-impact bottlenecks to compress timelines and prevent cost overruns."
                        size="sm"
                      />
                    </div>
                    <span style={{ fontSize: '10px', fontWeight: 800, padding: '3px 8px', borderRadius: '4px', backgroundColor: '#DCFCE7', color: '#16A34A', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                      SQL-Driven
                    </span>
                  </h2>
                  <p className="card-subtitle">Top recommendations based on current trends and historical patterns.</p>
                </div>
                <button className="card-link-btn" onClick={() => handleOpenAffectedProjects(insightsData.recommendations[0])}>View All</button>
              </div>

              <div className="recommendations-horizontal-row">
                {insightsData.recommendations.map((rec) => (
                  <div key={rec.id} className="recommendation-sub-card">
                    <div className="rec-header">
                      <div className="rec-icon-wrapper" style={{ backgroundColor: rec.iconBg }}>
                        {getRecIcon(rec.iconType)}
                      </div>
                      <span
                        className="rec-impact-tag"
                        style={{ color: rec.impactClass === 'font-red' ? '#B91C1C' : '#B45309' }}
                      >
                        {rec.impact}
                      </span>
                    </div>
                    <h4 className="rec-title">{rec.title}</h4>
                    <p className="rec-description">{rec.desc}</p>
                    <button className="rec-action-dropdown-btn" onClick={() => handleOpenAffectedProjects(rec)}>
                      <span>View Affected Projects</span>
                      <ChevronDown size={11} />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* AI Insight Summary */}
            <div className="card summary-insight-card">
              <div className="summary-insight-header">
                <div className="summary-icon-pulse-wrapper">
                  <Sparkles size={16} color="#6EA7F5" />
                </div>
                <h2 className="card-title" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span>AI Insight Summary</span>
                    <InfoButton
                      title="Executive AI Summary"
                      summary="Concise synthesis of portfolio-wide trends, key drivers, and high-level priorities derived from live database metrics."
                      size="sm"
                    />
                  </div>
                  <span style={{ fontSize: '10px', fontWeight: 800, padding: '3px 8px', borderRadius: '4px', backgroundColor: '#EFF6FF', color: '#2563EB', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    Grounded LLM
                  </span>
                </h2>
              </div>
              <p className="summary-insight-body-text">
                {insightsData.summary_text}
              </p>
              <button className="summary-insight-cta-btn" onClick={() => setActiveSubTab('predictive')}>
                <span>Explore Detailed Insights</span>
                <ArrowRight size={14} />
              </button>
            </div>
          </div>

          {/* Row 2: 4-Column Analytics Row */}
          <div className="insights-row-4-columns">
            {/* Col 1: Emerging Issues & Trends */}
            <div className="card column-card">
              <div className="column-card-header">
                <div>
                  <h2 className="card-title" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span>Emerging Issues &amp; Trends</span>
                      <InfoButton
                        title="Emerging Issues & Trends"
                        summary="Operational bottlenecks exhibiting the sharpest growth in affected project counts across the active portfolio."
                        size="sm"
                      />
                    </div>
                    <span style={{ fontSize: '10px', fontWeight: 800, padding: '3px 8px', borderRadius: '4px', backgroundColor: '#DCFCE7', color: '#16A34A', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                      SQL-Driven
                    </span>
                  </h2>
                  <p className="card-subtitle">Top issues showing increased activity across the project portfolio.</p>
                </div>
                <button className="card-link-btn" onClick={() => setActiveSubTab('issues')}>View All</button>
              </div>

              <div className="emerging-list-grid">
                {insightsData.emerging_issues.map((issue, idx) => (
                  <div key={idx} className="emerging-row-item">
                    <div className="emerging-row-details">
                      <span className="emerging-row-name">{issue.label}</span>
                      <span className="emerging-row-sub">
                        <AnimatedCounter value={issue.count} triggerKey={`issue-${issue.count}-${activeSubTab}`} /> projects
                      </span>
                    </div>
                    <div className="emerging-row-value-spark">
                      <span className={`emerging-val ${issueValClasses[idx] || 'font-red'}`}>{issue.impact}</span>
                      {renderSparkline(sparkPaths[idx] || sparkPaths[0], sparkColors[idx] || 'var(--color-accent-red)')}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Col 2: Pattern Detection Accordions */}
            <div className="card column-card">
              <div className="column-card-header">
                <div>
                  <h2 className="card-title" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span>Pattern Detection</span>
                      <InfoButton
                        title="Cross-Project Pattern Detection"
                        summary="Detects recurring multi-variable symptoms across projects (e.g. high spending with low progress) that historically lead to heavy delays."
                        size="sm"
                      />
                    </div>
                    <span style={{ fontSize: '10px', fontWeight: 800, padding: '3px 8px', borderRadius: '4px', backgroundColor: '#DCFCE7', color: '#16A34A', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                      SQL-Driven
                    </span>
                  </h2>
                  <p className="card-subtitle">Active patterns detected across projects.</p>
                </div>
                <button className="card-link-btn" onClick={() => setActiveSubTab('patterns')}>View All</button>
              </div>

              <div className="pattern-accordion-wrapper">
                {insightsData.patterns.map((pat, idx) => (
                  <div
                    key={idx}
                    className={`pattern-panel ${expandedPattern === idx ? 'expanded' : ''}`}
                    onClick={() => setExpandedPattern(expandedPattern === idx ? null : idx)}
                    role="button"
                    tabIndex={0}
                    aria-expanded={expandedPattern === idx}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        setExpandedPattern(expandedPattern === idx ? null : idx);
                      }
                    }}
                  >
                    <div className="panel-header">
                      <div className="panel-header-title">{pat.title}</div>
                      <div className="panel-meta-row">
                        <StatusIndicator
                          kind={pat.risk.toLowerCase().includes('high') ? 'high' : 'medium'}
                          label={pat.risk.toUpperCase()}
                          className={`panel-status-tag ${pat.riskClass}`}
                        />
                        <ChevronDown size={12} className="panel-arrow" />
                      </div>
                    </div>
                    <div className="panel-body">{pat.detail}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Col 3: Historical Similarity (Dark Navy Card) */}
            <div className="card column-card dark-navy-theme historical-card">
              <div className="column-card-header">
                <div>
                  <h2 className="card-title" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span>Historical Similarity</span>
                      <InfoButton
                        title="Historical Similarity Engine"
                        summary="Matches active project profiles against thousands of historical completed projects to project likely delay and cost overrun rates."
                        theme="dark"
                        size="sm"
                      />
                    </div>
                    <span style={{ fontSize: '10px', fontWeight: 800, padding: '3px 8px', borderRadius: '4px', backgroundColor: '#DCFCE7', color: '#16A34A', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                      SQL-Driven
                    </span>
                  </h2>
                  <p className="card-subtitle">The project profile matches historical outcomes.</p>
                </div>
                <button className="card-link-btn" onClick={() => setActiveSubTab('similarity')}>View All</button>
              </div>

              {/* White internal score card */}
              <div className="historical-score-sub-card">
                <div className="score-lbl">Similarity Score</div>
                <div className="score-number-group">
                  <span className="score-val">
                    <AnimatedCounter value={insightsData.similarity.score} triggerKey={`sim-${insightsData.similarity.score}`} />
                  </span>
                  <span className="score-max">/{insightsData.similarity.total_comparable}</span>
                </div>
                <div className="score-desc">projects match this profile</div>
              </div>

              {/* Outcomes Row with circles */}
              <div className="historical-outcomes-section">
                <h4 className="section-small-title">HISTORICAL OUTCOMES</h4>
                <div className="similarity-circles-row">
                  {renderSimilarityCircle(insightsData.similarity.cost_overrun_pct, 'Cost Overrun', 'cost')}
                  {renderSimilarityCircle(insightsData.similarity.schedule_delay_pct, 'Schedule Delay', 'schedule')}
                  {renderSimilarityCircle(insightsData.similarity.on_hold_pct, 'On Hold', 'onhold')}
                </div>
              </div>

              <div className="historical-warning-footer">
                <Check size={14} className="historical-check-icon" />
                <p className="historical-footer-text">
                  {getSimilarityFooterText()}
                </p>
              </div>
            </div>

            {/* Col 4: Predictive Insights */}
            <div className="card column-card">
              <div className="column-card-header">
                <div>
                  <h2 className="card-title" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span>Predictive Insights</span>
                      <InfoButton
                        title="Predictive ML Forecasts"
                        summary="Machine learning models (XGBoost) forecasting future risk zone transitions, expected delay months, and capital cost overruns."
                        size="sm"
                      />
                    </div>
                    <span style={{ fontSize: '10px', fontWeight: 800, padding: '3px 8px', borderRadius: '4px', backgroundColor: '#FEE2E2', color: '#DC2626', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                      XGBoost ML
                    </span>
                  </h2>
                  <p className="card-subtitle">AI powered forecasts and predictions.</p>
                </div>
                <button className="card-link-btn" onClick={() => setActiveSubTab('predictive')}>View All</button>
              </div>

              <div className="predictive-rows-stack">
                <div className="predictive-row-item">
                  <div className="pred-icon-wrapper blue-glow">
                    <TrendingUp size={14} color="var(--color-on-track)" />
                  </div>
                  <div className="pred-details">
                    <span className="pred-lbl">Projects Entering Risk Zone <strong style={{ fontSize: '9px', opacity: 0.75, color: '#16A34A' }}>[SQL]</strong></span>
                    <span className="pred-val font-red">
                      <AnimatedCounter value={insightsData.predictive.projects_entering_risk} triggerKey={`pred-risk-${insightsData.predictive.projects_entering_risk}`} /> projects
                    </span>
                  </div>
                  <span className="pred-variance-pct font-red">{insightsData.predictive.projects_entering_risk_pct}</span>
                </div>

                <div className="predictive-row-item">
                  <div className="pred-icon-wrapper orange-glow">
                    <Clock size={14} color="#D97706" />
                  </div>
                  <div className="pred-details">
                    <span className="pred-lbl">Expected Delay (Portfolio) <strong style={{ fontSize: '9px', opacity: 0.75, color: '#DC2626' }}>[XGBoost]</strong></span>
                    <span className="pred-val font-red">{insightsData.predictive.expected_portfolio_delay}</span>
                  </div>
                </div>

                <div className="predictive-row-item">
                  <div className="pred-icon-wrapper purple-glow">
                    <BarChart3 size={14} color="#A855F7" />
                  </div>
                  <div className="pred-details">
                    <span className="pred-lbl">Potential Cost Overrun <strong style={{ fontSize: '9px', opacity: 0.75, color: '#DC2626' }}>[XGBoost]</strong></span>
                    <span className="pred-val font-red">{insightsData.predictive.potential_cost_overrun}</span>
                  </div>
                </div>

                <div
                  className="predictive-row-item action-row"
                  onClick={() => setActiveSubTab('predictive')}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      setActiveSubTab('predictive');
                    }
                  }}
                >
                  <div className="pred-icon-wrapper grey-glow">
                    <Layers size={14} color="var(--navy-dark)" />
                  </div>
                  <div className="pred-details">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                      <span className="pred-lbl">Risk Mitigation Scenarios <strong style={{ fontSize: '9px', opacity: 0.7, color: '#D97706' }}>[Simulated]</strong></span>
                      <span style={{ fontSize: '9px', fontWeight: 800, padding: '1px 5px', borderRadius: '3px', backgroundColor: '#FEF3C7', color: '#B45309', border: '1px solid #FDE68A' }}>
                        Under Development (Illustration)
                      </span>
                    </div>
                    <span className="pred-val">{insightsData.predictive.active_scenarios} active scenarios</span>
                  </div>
                  <ChevronRight size={14} className="pred-arrow-right" />
                </div>
              </div>
            </div>
          </div>

          {/* Row 3: Key Insights by Sector & Risk Driver Analysis */}
          <div className="insights-row-bottom-split">
            {/* Sector Insights */}
            <div className="card sector-insights-card">
              <div className="sector-header">
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <h2 className="card-title">Key Insights by Sector</h2>
                    <InfoButton
                      title="Sectoral Insights"
                      summary="Detailed performance diagnostics comparing risk concentrations, affected asset counts, and common bottlenecks across central sectors."
                      size="sm"
                    />
                  </div>
                  <p className="card-subtitle">Sector-wise performance and AI generated insights.</p>
                </div>
                <button className="card-link-btn" onClick={() => setActiveSubTab('drivers')}>View All</button>
              </div>

              <div className="sector-sub-cards-row">
                {insightsData.sector_insights.length > 0 ? insightsData.sector_insights.map((s, idx) => (
                  <div key={idx} className="sector-box">
                    <div className="sector-box-header">
                      <span className="sector-box-name">{s.name}</span>
                      <StatusIndicator
                        kind={s.label.toLowerCase().includes('high risk') ? 'high' : s.label.toLowerCase().includes('common') ? 'medium' : 'low'}
                        label={s.label.toUpperCase()}
                        className={`sector-box-tag ${s.labelClass === 'font-red' ? 'tag-red' : s.labelClass === 'font-orange' ? 'tag-orange' : 'tag-blue'}`}
                      />
                    </div>
                    <div className="sector-box-pct-row">
                      <span className="sector-box-pct font-red">{s.pct}</span>
                      <span className="sector-box-sub">of sector projects</span>
                    </div>
                    <p className="sector-box-desc">{s.desc}</p>
                  </div>
                )) : (
                  <div className="sector-box" style={{ gridColumn: 'span 5', textAlign: 'center', color: 'var(--text-muted)', padding: '20px 0' }}>
                    No sector data available yet.
                  </div>
                )}
              </div>
            </div>

            {/* Risk Driver Analysis */}
            <div className="card risk-driver-card light-blue-bg">
              <div className="risk-driver-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <h2 className="card-title">Risk Driver Analysis</h2>
                  <InfoButton
                    title="Portfolio Risk Drivers"
                    summary="Quantifies the relative contribution of each operational variable (progress lag, milestone slippage, cost growth) to overall portfolio risk."
                    size="sm"
                  />
                </div>
                <p className="card-subtitle">What's driving risk across the portfolio</p>
              </div>

              <div className="driver-analysis-split-content">
                {/* Left progress lists */}
                <div className="driver-bars-list">
                  {insightsData.risk_drivers.map((driver, idx) => (
                    <div key={idx} className="driver-bar-item">
                      <div className="driver-bar-header">
                        <span className="driver-bar-lbl">{driver.label}</span>
                        <span className="driver-bar-pct">{driver.pct}%</span>
                      </div>
                      <div className="driver-track-full">
                        <div
                          className={`driver-filled ${driver.color}`}
                          style={{
                            width: `${Math.min(driver.pct, 100)}%`,
                            transition: `width 0.7s cubic-bezier(0.16, 1, 0.3, 1) ${idx * 0.1}s`
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>

                {/* Right Takeaway sub-card */}
                <div className="driver-takeaway-sub-card">
                  <div className="takeaway-header">
                    <HelpCircle size={14} className="takeaway-icon" />
                    <span>My Takeaway</span>
                    <InfoButton
                      title="Strategic Takeaway"
                      summary="Core takeaway identifying the two most dominant factors governing overall infrastructure risk."
                      size="sm"
                    />
                  </div>
                  <p className="takeaway-body-text">
                    {insightsData.risk_drivers.length > 0
                      ? `${insightsData.risk_drivers[0].label} and ${insightsData.risk_drivers[1]?.label || 'milestone slippages'} represent the leading drivers of risk across the ${insightsData.total_projects > 0 ? insightsData.total_projects + ' project' : ''} portfolio.`
                      : 'Physical progress lag and milestone slippages represent the leading drivers of risk across the portfolio.'}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="card" style={{ padding: '40px 24px', marginTop: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <h2 style={{ fontSize: '18px', fontWeight: 800, color: 'var(--navy-dark)', margin: 0 }}>
              {subTabs.find(t => t.id === activeSubTab)?.label}
            </h2>
            <button 
              onClick={() => setActiveSubTab('overview')}
              style={{
                backgroundColor: '#EFF6FF',
                color: '#2563EB',
                border: '1px solid #BFDBFE',
                padding: '6px 14px',
                borderRadius: '8px',
                fontSize: '13px',
                fontWeight: 700,
                cursor: 'pointer'
              }}
            >
              ← Back to Overview
            </button>
          </div>

          {activeSubTab === 'issues' && (
            <div className="emerging-list-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))' }}>
              {insightsData.emerging_issues.map((issue, idx) => (
                <div key={idx} className="emerging-row-item" style={{ padding: '16px', border: '1px solid #E2E8F0', borderRadius: '10px' }}>
                  <div className="emerging-row-details">
                    <span className="emerging-row-name" style={{ fontSize: '15px' }}>{issue.label}</span>
                    <span className="emerging-row-sub">{issue.count} projects affected across national portfolio</span>
                  </div>
                  <div className="emerging-row-value-spark">
                    <span className={`emerging-val ${issueValClasses[idx] || 'font-red'}`} style={{ fontSize: '16px' }}>{issue.impact}</span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {activeSubTab === 'patterns' && (
            <div className="pattern-accordion-wrapper">
              {insightsData.patterns.map((pat, idx) => (
                <div
                  key={idx}
                  className="pattern-panel expanded"
                  style={{ marginBottom: '12px' }}
                >
                  <div className="panel-header">
                    <div className="panel-header-title" style={{ fontSize: '15px' }}>{pat.title}</div>
                    <div className="panel-meta-row">
                      <StatusIndicator
                        kind={pat.risk.toLowerCase().includes('high') ? 'high' : 'medium'}
                        label={`${pat.risk.toUpperCase()} (${pat.count} PROJECTS)`}
                        className={`panel-status-tag ${pat.riskClass}`}
                      />
                    </div>
                  </div>
                  <div className="panel-body" style={{ display: 'block', fontSize: '13px', color: '#475569' }}>{pat.detail}</div>
                </div>
              ))}
            </div>
          )}

          {activeSubTab === 'similarity' && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px' }}>
              <div className="card" style={{ padding: '20px', borderRadius: '12px', border: '1px solid #E2E8F0' }}>
                <h3 style={{ fontSize: '15px', fontWeight: 800, marginBottom: '8px' }}>Historical Similarity Outcomes</h3>
                <p style={{ fontSize: '13px', color: '#64748B' }}>
                  Multidimensional distance metrics compare active infrastructure profiles against {insightsData.similarity.total_comparable} completed projects.
                </p>
                <div style={{ display: 'flex', gap: '16px', marginTop: '16px' }}>
                  <div style={{ flex: 1, padding: '12px', backgroundColor: '#FEF2F2', borderRadius: '8px', textAlign: 'center' }}>
                    <div style={{ fontSize: '18px', fontWeight: 800, color: '#DC2626' }}>{insightsData.similarity.cost_overrun_pct}%</div>
                    <div style={{ fontSize: '11px', color: '#64748B' }}>Cost Overrun Rate</div>
                  </div>
                  <div style={{ flex: 1, padding: '12px', backgroundColor: '#FFFBEB', borderRadius: '8px', textAlign: 'center' }}>
                    <div style={{ fontSize: '18px', fontWeight: 800, color: '#D97706' }}>{insightsData.similarity.schedule_delay_pct}%</div>
                    <div style={{ fontSize: '11px', color: '#64748B' }}>Schedule Delay Rate</div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeSubTab === 'drivers' && (
            <div className="driver-bars-list" style={{ maxWidth: '600px' }}>
              {insightsData.risk_drivers.map((driver, idx) => (
                <div key={idx} className="driver-bar-item" style={{ marginBottom: '16px' }}>
                  <div className="driver-bar-header">
                    <span className="driver-bar-lbl" style={{ fontSize: '14px' }}>{driver.label}</span>
                    <span className="driver-bar-pct" style={{ fontSize: '14px' }}>{driver.pct}%</span>
                  </div>
                  <div className="driver-track-full" style={{ height: '8px' }}>
                    <div
                      className={`driver-filled ${driver.color}`}
                      style={{ width: `${Math.min(driver.pct, 100)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}

          {activeSubTab === 'predictive' && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
              <div style={{ padding: '20px', backgroundColor: '#FEF2F2', borderRadius: '12px', border: '1px solid #FECACA' }}>
                <div style={{ fontSize: '12px', fontWeight: 700, color: '#DC2626', textTransform: 'uppercase' }}>Projects Entering Risk Zone</div>
                <div style={{ fontSize: '24px', fontWeight: 800, color: '#991B1B', marginTop: '6px' }}>{insightsData.predictive.projects_entering_risk} projects</div>
                <div style={{ fontSize: '12px', color: '#B91C1C', marginTop: '4px' }}>{insightsData.predictive.projects_entering_risk_pct} over next quarter</div>
              </div>
              <div style={{ padding: '20px', backgroundColor: '#FFFBEB', borderRadius: '12px', border: '1px solid #FDE68A' }}>
                <div style={{ fontSize: '12px', fontWeight: 700, color: '#D97706', textTransform: 'uppercase' }}>Expected Portfolio Delay</div>
                <div style={{ fontSize: '24px', fontWeight: 800, color: '#92400E', marginTop: '6px' }}>{insightsData.predictive.expected_portfolio_delay}</div>
                <div style={{ fontSize: '12px', color: '#B45309', marginTop: '4px' }}>Derived from XGBoost time regressor</div>
              </div>
              <div style={{ padding: '20px', backgroundColor: '#F5F3FF', borderRadius: '12px', border: '1px solid #DDD6FE' }}>
                <div style={{ fontSize: '12px', fontWeight: 700, color: '#7C3AED', textTransform: 'uppercase' }}>Potential Cost Overrun</div>
                <div style={{ fontSize: '24px', fontWeight: 800, color: '#5B21B6', marginTop: '6px' }}>{insightsData.predictive.potential_cost_overrun}</div>
                <div style={{ fontSize: '12px', color: '#6D28D9', marginTop: '4px' }}>Derived from XGBoost cost regressor</div>
              </div>
              <div style={{ padding: '20px', backgroundColor: '#F8FAFC', borderRadius: '12px', border: '1px dashed #CBD5E1' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', flexWrap: 'wrap' }}>
                  <div style={{ fontSize: '12px', fontWeight: 700, color: '#475569', textTransform: 'uppercase' }}>Risk Mitigation Scenarios</div>
                  <span style={{ fontSize: '9.5px', fontWeight: 800, padding: '2px 6px', borderRadius: '4px', backgroundColor: '#FEF3C7', color: '#B45309', border: '1px solid #FDE68A', textTransform: 'uppercase' }}>
                    Under Development (Illustration)
                  </span>
                </div>
                <div style={{ fontSize: '24px', fontWeight: 800, color: '#1E293B', marginTop: '6px' }}>{insightsData.predictive.active_scenarios} Active Scenarios</div>
                <div style={{ fontSize: '12px', color: '#64748B', marginTop: '4px' }}>Counterfactual policy simulation engine for timeline &amp; outlay recovery</div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Affected Projects Modal */}
      {selectedRecModal && (
        <div className="ai-insights-modal-backdrop"
          role="presentation"
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.65)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: '20px'
          }}
          onClick={() => setSelectedRecModal(null)}
        >
          <div className="ai-insights-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="affected-projects-modal-title"
            style={{
              backgroundColor: '#FFFFFF',
              borderRadius: '16px',
              maxWidth: '850px',
              width: '100%',
              maxHeight: '85vh',
              overflowY: 'auto',
              padding: '28px',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
              position: 'relative'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px', borderBottom: '1px solid #E2E8F0', paddingBottom: '16px' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                  <span style={{ fontSize: '11px', fontWeight: 800, padding: '3px 8px', borderRadius: '4px', backgroundColor: selectedRecModal.rec.impactClass === 'font-red' ? '#FEE2E2' : '#FEF3C7', color: selectedRecModal.rec.impactClass === 'font-red' ? '#B91C1C' : '#92400E' }}>
                    {selectedRecModal.rec.impact}
                  </span>
                  <h2 id="affected-projects-modal-title" style={{ fontSize: '18px', fontWeight: 800, color: 'var(--navy-dark)', margin: 0 }}>
                    {selectedRecModal.rec.title}
                  </h2>
                </div>
                <p style={{ fontSize: '13px', color: '#64748B', margin: 0 }}>
                  {selectedRecModal.rec.desc}
                </p>
              </div>
              <button 
                onClick={() => setSelectedRecModal(null)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px', color: '#64748B' }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Affected Projects Table */}
            <div style={{ marginTop: '16px' }}>
              <div style={{ fontSize: '12px', fontWeight: 800, color: '#0F172A', marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Affiliated High-Exposure Projects ({selectedRecModal.projects.length})
              </div>

              {selectedRecModal.loading ? (
                <div style={{ padding: '40px', textAlign: 'center', color: '#64748B', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
                  <div style={{ width: '32px', height: '32px', border: '3px solid #E2E8F0', borderTop: '3px solid #2563EB', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                  <span>Loading affiliated projects from database...</span>
                </div>
              ) : selectedRecModal.projects.length === 0 ? (
                <div style={{ padding: '30px', textAlign: 'center', color: '#94A3B8' }}>
                  No high-risk projects currently match this specific filter.
                </div>
              ) : (
                <div style={{ overflowX: 'auto', border: '1px solid #E2E8F0', borderRadius: '10px' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
                    <thead>
                      <tr style={{ backgroundColor: '#F8FAFC', borderBottom: '1px solid #E2E8F0' }}>
                        <th style={{ padding: '10px 14px', color: '#64748B', fontWeight: 700 }}>Project</th>
                        <th style={{ padding: '10px 14px', color: '#64748B', fontWeight: 700 }}>Ministry / Agency</th>
                        <th style={{ padding: '10px 14px', color: '#64748B', fontWeight: 700 }}>Risk Score</th>
                        <th style={{ padding: '10px 14px', color: '#64748B', fontWeight: 700 }}>Overrun</th>
                        <th style={{ padding: '10px 14px', color: '#64748B', fontWeight: 700, textAlign: 'right' }}>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedRecModal.projects.map((proj) => (
                        <tr key={proj.id} style={{ borderBottom: '1px solid #F1F5F9' }}>
                          <td style={{ padding: '12px 14px' }}>
                            <div style={{ fontWeight: 700, color: 'var(--navy-dark)' }}>{proj.name}</div>
                            <div style={{ fontSize: '11px', color: '#94A3B8' }}>ID: {proj.id}</div>
                          </td>
                          <td style={{ padding: '12px 14px', color: '#475569' }}>
                            <div>{proj.ministry}</div>
                            <div style={{ fontSize: '11px', color: '#94A3B8' }}>{proj.agency}</div>
                          </td>
                          <td style={{ padding: '12px 14px' }}>
                            <span style={{
                              padding: '2px 8px',
                              borderRadius: '4px',
                              fontSize: '11px',
                              fontWeight: 800,
                              backgroundColor: proj.riskScore >= 70 ? '#FEE2E2' : (proj.riskScore >= 50 ? '#FEF3C7' : '#DCFCE7'),
                              color: proj.riskScore >= 70 ? '#DC2626' : (proj.riskScore >= 50 ? '#D97706' : '#16A34A')
                            }}>
                              {proj.riskScore}/100
                            </span>
                          </td>
                          <td style={{ padding: '12px 14px', fontWeight: 700, color: proj.costOverrunPct.includes('-') ? '#16A34A' : '#DC2626' }}>
                            {proj.costOverrunPct}
                          </td>
                          <td style={{ padding: '12px 14px', textAlign: 'right' }}>
                            <button
                              onClick={() => {
                                setSelectedRecModal(null);
                                if (onSelectProject) {
                                  onSelectProject(proj.id);
                                }
                              }}
                              style={{
                                backgroundColor: '#EFF6FF',
                                color: '#2563EB',
                                border: '1px solid #BFDBFE',
                                padding: '6px 12px',
                                borderRadius: '6px',
                                fontSize: '12px',
                                fontWeight: 700,
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px'
                              }}
                            >
                              <span>View ML Details</span>
                              <ExternalLink size={12} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      </>
      )}
    </div>
  );
};
