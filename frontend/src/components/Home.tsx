import React, { useState } from 'react';
import {
  Sparkles, LayoutDashboard, Database, ArrowRight, Cpu, ShieldAlert,
  TrendingUp, Layers, BarChart3, Globe, Play
} from 'lucide-react';
import './Home.css';
import { VideoHero } from './VideoHero';
import { IndiaMap } from './IndiaMap';
import { AnimatedCounter } from './AnimatedCounter';
import nirmaanEmblem from '../assets/nirmaan_emblem.png';
import heroIllustration from '../assets/hero_illustration.png';

interface HomeProps {
  activeTab?: string;
  onNavigateTab: (tab: string) => void;
}

export const Home: React.FC<HomeProps> = ({ activeTab, onNavigateTab }) => {
  const [playIntro, setPlayIntro] = useState<boolean>(true);
  const [replayCount, setReplayCount] = useState<number>(0);

  const modules = [
    {
      tab: 'dashboard',
      title: 'Analytics Dashboard',
      desc: 'National health overview with real-time risk scores, sector breakdowns, and priority interventions.',
      icon: <LayoutDashboard size={22} color="#2563EB" aria-hidden="true" />,
      color: 'blue'
    },
    {
      tab: 'projects',
      title: 'Project Portfolio',
      desc: 'Browse all 3,361 infrastructure assets with search, filters, and detailed milestone tracking.',
      icon: <Database size={22} color="#059669" aria-hidden="true" />,
      color: 'green'
    },
    {
      tab: 'insights',
      title: 'AI Intelligence',
      desc: 'Qwen-8B powered executive Q&A with SHAP feature attributions and root-cause analysis.',
      icon: <Sparkles size={22} color="#7C3AED" aria-hidden="true" />,
      color: 'purple'
    },
    {
      tab: 'distribution',
      title: 'Sector Distribution',
      desc: 'Geographic and sector-level breakdown across all central infrastructure ministries.',
      icon: <Layers size={22} color="#0284C7" aria-hidden="true" />,
      color: 'teal'
    },
    {
      tab: 'action-centre',
      title: 'Action Center',
      desc: 'Automated executive alerts, inter-ministerial task assignments, and contractor milestone resolutions.',
      icon: <ShieldAlert size={22} color="#DC2626" aria-hidden="true" />,
      color: 'red'
    }
  ];

  return (
    <div className="home-container animation-fade-in">
      {/* ── Fullscreen Video Intro Overlay (Plays on load for 3s, blurs out, dissolves without scrolling) ── */}
      {playIntro && (
        <VideoHero
          key={replayCount}
          onFinished={() => setPlayIntro(false)}
        />
      )}

      {/* ── 1. Hero Banner Section ── */}
      <section className="home-hero">
        <div className="hero-content-wrapper">
          {/* Live Platform Status Pill */}
          <div className="hero-live-pill">
            <span className="hero-live-dot" />
            <span>LIVE • MoSPI / PAIMANA Platform</span>
          </div>

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
              <div className="hero-actions-row">
                <button
                  type="button"
                  className="hero-btn-launch"
                  onClick={() => onNavigateTab('dashboard')}
                >
                  <span>Launch Dashboard</span>
                  <ArrowRight size={16} aria-hidden="true" />
                </button>
                <button
                  type="button"
                  className="hero-btn-replay-intro"
                  onClick={() => {
                    setPlayIntro(true);
                    setReplayCount(prev => prev + 1);
                  }}
                  title="Watch Video Intro"
                >
                  <Play size={14} aria-hidden="true" />
                  <span>Watch Intro</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Right-side Infrastructure Illustration */}
        <img
          src={heroIllustration}
          alt="Illustration of national infrastructure construction and transport"
          className="hero-infra-illustration"
        />
      </section>

      {/* ── 2. Key Metrics Strip ── */}
      <section className="metrics-strip-row">
        <div className="metric-strip-card">
          <div className="strip-icon"><BarChart3 size={20} color="#2563EB" aria-hidden="true" /></div>
          <div className="strip-info">
            <span className="strip-val">
              <AnimatedCounter value={3361} duration={1000} resetKey={activeTab} />
            </span>
            <span className="strip-lbl">Projects Monitored</span>
          </div>
        </div>

        <div className="metric-strip-card">
          <div className="strip-icon"><TrendingUp size={20} color="#059669" aria-hidden="true" /></div>
          <div className="strip-info">
            <span className="strip-val">
              ₹<AnimatedCounter value={42.78} duration={1000} resetKey={activeTab} formatter={(v) => v.toFixed(2)} /> L Cr
            </span>
            <span className="strip-lbl">Total Portfolio</span>
          </div>
        </div>

        <div className="metric-strip-card">
          <div className="strip-icon"><Cpu size={20} color="#7C3AED" aria-hidden="true" /></div>
          <div className="strip-info">
            <span className="strip-val">3 &amp; 6 Mo</span>
            <span className="strip-lbl">Forecast Horizon</span>
          </div>
        </div>

        <div className="metric-strip-card">
          <div className="strip-icon"><Globe size={20} color="#D97706" aria-hidden="true" /></div>
          <div className="strip-info">
            <span className="strip-val">
              <AnimatedCounter value={28} duration={800} resetKey={activeTab} />+
            </span>
            <span className="strip-lbl">States Covered</span>
          </div>
        </div>
      </section>

      {/* ── 3. Interactive India Map ── */}
      <IndiaMap activeTab={activeTab} />

      {/* ── 4. Platform Modules Grid (Rectangular Cards) ── */}
      <section className="home-modules">
        <div className="modules-header-row">
          <h2 className="modules-title">Platform Modules</h2>
          <span className="modules-subtitle">Core analytical engines &amp; intelligence layers</span>
        </div>
        <div className="modules-grid">
          {modules.map((m, i) => (
            <div
              key={i}
              className={`module-card module-${m.color}`}
              onClick={() => onNavigateTab(m.tab)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  onNavigateTab(m.tab);
                }
              }}
              role="button"
              tabIndex={0}
              aria-label={`Open ${m.title}`}
              aria-current={activeTab === m.tab ? 'page' : undefined}
            >
              <div className="module-card-top">
                <div className={`module-icon icon-${m.color}`}>{m.icon}</div>
                <div className="module-arrow-wrap">
                  <ArrowRight size={15} className="module-arrow" aria-hidden="true" />
                </div>
              </div>
              <div className="module-body">
                <h3 className="module-name">{m.title}</h3>
                <p className="module-desc">{m.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
};
