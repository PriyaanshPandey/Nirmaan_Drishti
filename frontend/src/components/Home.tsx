import React from 'react';
import {
  Sparkles, LayoutDashboard, Database, ArrowRight, Cpu, ShieldAlert,
  TrendingUp, Layers, BarChart3, Globe
} from 'lucide-react';
import './Home.css';
import { IndiaMap } from './IndiaMap';
import { AnimatedCounter } from './AnimatedCounter';
import nirmaanEmblem from '../assets/nirmaan_emblem.png';
import heroIllustration from '../assets/hero_illustration.png';

interface HomeProps {
  activeTab?: string;
  onNavigateTab: (tab: string) => void;
}

export const Home: React.FC<HomeProps> = ({ activeTab, onNavigateTab }) => {
  const modules = [
    {
      tab: 'dashboard',
      title: 'Analytics Dashboard',
      desc: 'National health overview with real-time risk scores, sector breakdowns, and priority interventions.',
      icon: <LayoutDashboard size={22} color="#2563EB" />,
      color: 'blue'
    },
    {
      tab: 'projects',
      title: 'Project Portfolio',
      desc: 'Browse all 3,361 infrastructure assets with search, filters, and detailed milestone tracking.',
      icon: <Database size={22} color="#059669" />,
      color: 'green'
    },
    {
      tab: 'insights',
      title: 'AI Intelligence',
      desc: 'Qwen-8B powered executive Q&A with SHAP feature attributions and root-cause analysis.',
      icon: <Sparkles size={22} color="#7C3AED" />,
      color: 'purple'
    },
    {
      tab: 'risk',
      title: 'Risk Forecasting',
      desc: 'XGBoost multi-horizon cost drift projections, delay probability, and what-if simulation.',
      icon: <ShieldAlert size={22} color="#DC2626" />,
      color: 'red'
    },
    {
      tab: 'distribution',
      title: 'Sector Distribution',
      desc: 'Geographic and sector-level breakdown across all central infrastructure ministries.',
      icon: <Layers size={22} color="#0284C7" />,
      color: 'teal'
    }
  ];

  return (
    <div className="home-container animation-fade-in">
      {/* Hero Section */}
      <section className="home-hero">
        <div className="hero-content-wrapper">
          <div className="hero-main-layout">
            <div className="hero-logo-col">
              <img
                src={nirmaanEmblem}
                alt="Nirmaan Drishti Emblem"
                className="hero-emblem-img"
              />
            </div>
            <div className="hero-text-col">
              <h1 className="hero-title-main">
                Nirmaan<br />Drishti
              </h1>
              <p className="hero-subtitle-main">
                Predictive Intelligence &amp; Early Warning System for India's Central Infrastructure Projects
              </p>
              <button className="hero-btn-launch" onClick={() => onNavigateTab('dashboard')}>
                <span>Launch Dashboard</span>
                <ArrowRight size={16} />
              </button>
            </div>
          </div>
        </div>

        {/* Right-side Infrastructure Illustration */}
        <img
          src={heroIllustration}
          alt="National Infrastructure Illustration"
          className="hero-infra-illustration"
        />
      </section>

      {/* Key Metrics Strip with Counting Animations (0 -> X) */}
      <section className="metrics-strip-row">
        <div className="metric-strip-card">
          <div className="strip-icon"><BarChart3 size={20} color="#2563EB" /></div>
          <div className="strip-info">
            <span className="strip-val">
              <AnimatedCounter value={3361} duration={1000} resetKey={activeTab} />
            </span>
            <span className="strip-lbl">Projects Monitored</span>
          </div>
        </div>

        <div className="metric-strip-card">
          <div className="strip-icon"><TrendingUp size={20} color="#059669" /></div>
          <div className="strip-info">
            <span className="strip-val">
              ₹<AnimatedCounter value={42.78} duration={1000} resetKey={activeTab} formatter={(v) => v.toFixed(2)} /> L Cr
            </span>
            <span className="strip-lbl">Total Portfolio</span>
          </div>
        </div>

        <div className="metric-strip-card">
          <div className="strip-icon"><Cpu size={20} color="#7C3AED" /></div>
          <div className="strip-info">
            <span className="strip-val">3 &amp; 6 Months</span>
            <span className="strip-lbl">Forecast Horizon</span>
          </div>
        </div>

        <div className="metric-strip-card">
          <div className="strip-icon"><Globe size={20} color="#D97706" /></div>
          <div className="strip-info">
            <span className="strip-val">
              <AnimatedCounter value={28} duration={800} resetKey={activeTab} />+
            </span>
            <span className="strip-lbl">States Covered</span>
          </div>
        </div>
      </section>

      {/* Interactive India Map with State Counter Reset */}
      <IndiaMap activeTab={activeTab} />

      {/* Platform Modules */}
      <section className="home-modules">
        <h2 className="modules-title">Platform Modules</h2>
        <div className="modules-grid">
          {modules.map((m, i) => (
            <div key={i} className={`module-card module-${m.color}`} onClick={() => onNavigateTab(m.tab)}>
              <div className={`module-icon icon-${m.color}`}>{m.icon}</div>
              <div className="module-body">
                <h3 className="module-name">{m.title}</h3>
                <p className="module-desc">{m.desc}</p>
              </div>
              <ArrowRight size={16} className="module-arrow" />
            </div>
          ))}
        </div>
      </section>
    </div>
  );
};
