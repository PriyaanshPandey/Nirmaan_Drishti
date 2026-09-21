import React, { useState, useEffect } from 'react';
import {
  ArrowRight, Cpu, TrendingUp, BarChart3, Globe
} from 'lucide-react';
import './Home.css';
import { InfoButton } from './ExplainabilityInfo';
import { IndiaMap } from './IndiaMap';
import { AnimatedCounter } from './AnimatedCounter';
import nirmaanEmblem from '../assets/nirmaan_emblem.png';
import heroIllustration from '../assets/hero_illustration.png';

import { api } from '../services/api';

interface HomeProps {
  activeTab?: string;
  onNavigateTab: (tab: string) => void;
  onFilterState?: (stateName: string) => void;
  onOpenLoginModal?: () => void;
  homeClickNonce?: number;
  isPublic?: boolean;
}

const initialProjectsCount = 1981;
const initialLakhCrores = 42.78;

export const Home: React.FC<HomeProps> = ({ activeTab, onNavigateTab, onFilterState, onOpenLoginModal, homeClickNonce: _homeClickNonce, isPublic: _isPublic }) => {
  const [totalProjects, setTotalProjects] = useState<number>(initialProjectsCount);
  const [portfolioCostLakhCr, setPortfolioCostLakhCr] = useState<number>(initialLakhCrores);

  useEffect(() => {
    let isMounted = true;
    api.getDashboardSummary()
      .then((res) => {
        if (!isMounted) return;
        if (res && res.metrics) {
          if (res.metrics.total_projects > 0) {
            setTotalProjects(res.metrics.total_projects);
          }
          if (res.metrics.total_revised_cost > 0) {
            setPortfolioCostLakhCr(res.metrics.total_revised_cost / 100000);
          }
        }
      })
      .catch(() => {});

    return () => {
      isMounted = false;
    };
  }, []);

  const modules = [
    {
      tab: 'dashboard',
      tag: 'Executive Overview',
      title: 'Dashboard',
      desc: 'National health index, budget overruns, and priority interventions.',
      color: 'blue'
    },
    {
      tab: 'projects',
      tag: 'Master Portfolio',
      title: 'Projects',
      desc: 'Telemetry, risk diagnostics, and milestone tracking across 1,981 central sector projects.',
      color: 'green'
    },
    {
      tab: 'distribution',
      tag: 'Resource Allocation',
      title: 'Distribution',
      desc: 'Cross-ministry expenditure and state-level infrastructure spread.',
      color: 'teal'
    },
    {
      tab: 'action-centre',
      tag: 'Intervention Matrix',
      title: 'Action Center',
      desc: 'Bottleneck escalations, contractor accountability, and resolution alerts.',
      color: 'red'
    }
  ];

  return (
    <div className="home-container animation-fade-in">
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
                  onClick={() => onNavigateTab('projects')}
                  title="Browse All Projects"
                >
                  <span>Browse Projects</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Right-side Infrastructure Illustration — Clean professional government view */}
        <div className="hero-infra-stage">
          {/* Main infrastructure illustration */}
          <img
            src={heroIllustration}
            alt="National Infrastructure — India's Central Sector Projects"
            className="hero-infra-img-original"
            style={{ opacity: 1 }}
          />
        </div>
      </section>

      {/* ── 2. Key Metrics Strip ── */}
      <section className="metrics-strip-row">
        <div className="metric-strip-card">
          <div className="strip-icon"><BarChart3 size={20} color="#2563EB" aria-hidden="true" /></div>
          <div className="strip-info">
            <span className="strip-val">
              <AnimatedCounter value={totalProjects} duration={1000} resetKey={activeTab} />
            </span>
            <span className="strip-lbl">Ongoing Projects Monitored</span>
          </div>
        </div>

        <div className="metric-strip-card">
          <div className="strip-icon"><TrendingUp size={20} color="#059669" aria-hidden="true" /></div>
          <div className="strip-info">
            <span className="strip-val">
              ₹<AnimatedCounter value={portfolioCostLakhCr} duration={1000} resetKey={activeTab} formatter={(v) => v.toFixed(2)} /> L Cr
            </span>
            <span className="strip-lbl">Revised Portfolio Outlay</span>
          </div>
        </div>

        <div className="metric-strip-card" style={{ position: 'relative' }}>
          <div className="strip-icon"><Cpu size={20} color="#DC2626" aria-hidden="true" /></div>
          <div className="strip-info">
            <span className="strip-val" style={{ color: '#ef4444' }}>+15.2% Cr</span>
            <span className="strip-lbl">
              Cost Overrun Forecast
              <span style={{ marginLeft: '6px', verticalAlign: 'middle', display: 'inline-flex' }}>
                <InfoButton 
                  title="Cost Overrun Forecast" 
                  summary="AI-driven aggregate forecast of anticipated cost escalations across the portfolio if current execution trends continue." 
                  size="sm" 
                />
              </span>
            </span>
          </div>
        </div>

        <div className="metric-strip-card" style={{ position: 'relative' }}>
          <div className="strip-icon"><Globe size={20} color="#D97706" aria-hidden="true" /></div>
          <div className="strip-info">
            <span className="strip-val" style={{ color: '#f59e0b' }}>+18.4 Mos</span>
            <span className="strip-lbl">
              Schedule Overrun Forecast
              <span style={{ marginLeft: '6px', verticalAlign: 'middle', display: 'inline-flex' }}>
                <InfoButton 
                  title="Schedule Overrun Forecast" 
                  summary="Anticipated average schedule slippage based on predictive milestone trajectory models." 
                  size="sm" 
                />
              </span>
            </span>
          </div>
        </div>
      </section>

      {/* ── 3. Interactive India Map ── */}
      <section className="home-india-map">
        <IndiaMap activeTab={activeTab} onSelectStateFilter={onFilterState} />
      </section>

      {/* ── 4. Platform Modules Grid (Rectangular Cards) ── */}
      <section className="home-modules">
        <div className="modules-header-row">
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <h2 className="modules-title">Platform Modules</h2>
            <InfoButton
              title="Platform Intelligence Modules"
              summary="Navigate between core analytical engines: Dashboard for executive metrics, Projects for master portfolio telemetry, Distribution for resource allocation, and Action Center for generating policy directives."
              size="sm"
            />
          </div>
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
                <span className="module-tag">{m.tag}</span>
                <span className="module-arrow" aria-hidden="true">→</span>
              </div>
              <div className="module-body">
                <h3 className="module-name">{m.title}</h3>
                <p className="module-desc">{m.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── 5. Officer Sign-In Banner CTA at end of Home page ── */}
      {_isPublic && (
        <section className="home-officer-cta" style={{ marginTop: '40px', padding: '32px', borderRadius: '12px', background: '#F8FAFC', border: '1px solid #E2E8F0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '20px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '1.2rem' }}>🏛️</span>
              <h3 style={{ margin: 0, color: '#0F172A', fontSize: '1.25rem', fontWeight: 'bold' }}>MoSPI &amp; Executing Agency Officer Access</h3>
            </div>
            <p style={{ margin: 0, color: '#475569', fontSize: '0.88rem', maxWidth: '650px' }}>
              Authorized officials from MoSPI, Ministry of Road Transport, Railways, Power, and Executing Agencies (NHAI) can sign in to access full predictive PDP telemetry, counterfactual simulators, automated ticket routing, and PDF Memorandum generators.
            </p>
          </div>
          <button
            type="button"
            className="officer-auth-btn"
            onClick={onOpenLoginModal}
          >
            <span>Officer Authentication</span>
            <ArrowRight size={16} />
          </button>
        </section>
      )}
    </div>
  );
};
