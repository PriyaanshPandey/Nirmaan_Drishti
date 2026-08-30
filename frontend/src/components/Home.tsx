import React from 'react';
import {
  Sparkles, LayoutDashboard, Database,
  ArrowRight, Cpu
} from 'lucide-react';
import './Home.css';

interface HomeProps {
  onNavigateTab: (tab: string) => void;
}

export const Home: React.FC<HomeProps> = ({ onNavigateTab }) => {
  const stats = [
    { label: 'Infrastructure Assets', val: '3,361', desc: 'Central Sector Projects Monitored' },
    { label: 'Time-Series Snapshots', val: '14,979', desc: 'Historical Progress Records' },
    { label: 'AI Accuracy Horizon', val: '3 & 6 Mo', desc: 'Calibrated Incremental Forecasts' },
    { label: 'Systemic Risk Index', val: 'SHAP', desc: 'Explainable Tree-Based Attributions' },
  ];

  const quickLinks = [
    {
      tab: 'dashboard',
      title: 'Analytics Dashboard',
      desc: 'National health overview, donut chart distributions, priority interventions, and risk trend splines.',
      icon: <LayoutDashboard size={20} color="#2563EB" />,
      color: 'blue'
    },
    {
      tab: 'projects',
      title: 'Project Portfolio',
      desc: 'Detailed index of all 3,361 assets with paginated query matching and full milestone tracking.',
      icon: <Database size={20} color="#059669" />,
      color: 'green'
    },
    {
      tab: 'insights',
      title: 'AI Intelligence Insights',
      desc: 'Actionable recommendations, emerging pattern accordions, and similarity metrics driven by SQL.',
      icon: <Sparkles size={20} color="#7C3AED" />,
      color: 'purple'
    },
    {
      tab: 'risk',
      title: 'XGBoost Risk Analysis',
      desc: 'Predictive modeling engine simulating cost overruns, delay probabilities, and TreeSHAP risk drivers.',
      icon: <Cpu size={20} color="#DC2626" />,
      color: 'red'
    }
  ];

  return (
    <div className="home-container animation-fade-in">
      {/* Hero Section */}
      <section className="home-hero">
        <div className="hero-badge">
          <Sparkles size={13} className="hero-sparkle" />
          <span>PMG Early Warning System</span>
        </div>
        <h1 className="hero-title">Nirmaan Dristi</h1>
        <p className="hero-subtitle">
          Advanced Machine Learning &amp; Explainable AI for Incremental Project Cost &amp; Schedule Forecasting.
          Tailored for Central Sector Infrastructure Monitoring.
        </p>

        <div className="hero-cta-group">
          <button className="hero-btn primary" onClick={() => onNavigateTab('dashboard')}>
            <span>Launch Dashboard</span>
            <ArrowRight size={14} />
          </button>
          <button className="hero-btn secondary" onClick={() => onNavigateTab('insights')}>
            <span>Ask AI Assistant</span>
          </button>
        </div>
      </section>

      {/* Stats Counter Grid */}
      <section className="home-stats-grid">
        {stats.map((st, i) => (
          <div key={i} className="home-stat-card card">
            <span className="stat-val">{st.val}</span>
            <span className="stat-lbl">{st.label}</span>
            <span className="stat-desc">{st.desc}</span>
          </div>
        ))}
      </section>

      {/* Quick Navigation Cards */}
      <section className="home-section">
        <h2 className="section-title">Explore the Platform</h2>
        <p className="section-subtitle">Navigate to the core components of the Nirmaan Dristi predictive monitoring suite.</p>
        
        <div className="home-nav-grid">
          {quickLinks.map((link, i) => (
            <div key={i} className={`home-nav-card card hover-${link.color}`} onClick={() => onNavigateTab(link.tab)}>
              <div className={`nav-icon-box ${link.color}-glow`}>
                {link.icon}
              </div>
              <h3 className="nav-card-title">{link.title}</h3>
              <p className="nav-card-desc">{link.desc}</p>
              <span className="nav-card-action">
                <span>Access Module</span>
                <ArrowRight size={13} />
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* Technical Summary / Explainability Info */}
      <section className="home-technical-panel card">
        <div className="tech-panel-header">
          <div className="tech-icon-wrapper">
            <Cpu size={22} color="#ffffff" />
          </div>
          <div>
            <h3 className="tech-panel-title">Nirmaan Dristi Forecasting Framework</h3>
            <p className="tech-panel-subtitle">Mathematical consistency &amp; explainability guardrails</p>
          </div>
        </div>
        
        <div className="tech-grid">
          <div className="tech-col">
            <h4>📈 Calibrated XGBoost Modifiers</h4>
            <p>
              Rather than predicting static endpoints, models evaluate risk probability deltas over 3-month and 6-month intervals.
              All predictions are Platt-calibrated to map perfectly with historical project slippage dynamics.
            </p>
          </div>
          <div className="tech-col">
            <h4>🧠 Local TreeSHAP Explanations</h4>
            <p>
              Decisions are supported by local game-theoretic feature attribution. Every warning is traced back to root causes
              like physical-vs-financial gaps, consecutive stagnant progress months, or scale-adjusted capital risk.
            </p>
          </div>
          <div className="tech-col">
            <h4>🤖 Zero-Downtime Narrative Fallback</h4>
            <p>
              An OpenAI-compatible LLM endpoint runs live Qwen3-8B narration. In the absence of an API key, the built-in
              deterministic explainer automatically transforms raw SHAP metrics into grounded executive summaries.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
};
