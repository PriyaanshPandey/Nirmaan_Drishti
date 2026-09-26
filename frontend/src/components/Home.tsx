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
import { useLanguage } from '../context/LanguageContext';
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
  const { t } = useLanguage();
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
      tag: t('module_dashboard_title', 'Real-Time Dashboard'),
      title: t('nav_dashboard', 'Dashboard'),
      desc: t('module_dashboard_desc', 'Live national risk telemetry with AI-powered forecasts and trend analysis'),
      color: 'blue'
    },
    {
      tab: 'projects',
      tag: t('module_projects_title', 'Project Intelligence'),
      title: t('nav_projects', 'Projects'),
      desc: t('module_projects_desc', 'Deep-dive into individual project health, SHAP attributions, and ML forecasts'),
      color: 'green'
    },
    {
      tab: 'distribution',
      tag: t('module_benchmark_title', 'Benchmark Analytics'),
      title: t('nav_benchmark', 'Distribution'),
      desc: t('module_benchmark_desc', 'Ministry-wise and sector-wise distribution, risk comparison matrix'),
      color: 'teal'
    },
    {
      tab: 'action-centre',
      tag: t('module_alerts_title', 'Early Warnings & Alerts'),
      title: t('nav_actions', 'Action Center'),
      desc: t('module_alerts_desc', 'Real-time early warning signals for cost and schedule overruns'),
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
                {t('nirmaan_drishti', 'Nirmaan Drishti')}
              </h1>
              <p className="hero-subtitle-main">
                {t('hero_subtitle', 'Real-time telemetry tracking 1,981 central infrastructure projects across 28 states')}
              </p>
              <div className="hero-actions-row">
                <button
                  type="button"
                  className="hero-btn-launch"
                  onClick={() => onNavigateTab('dashboard')}
                >
                  <span>{t('explore_dashboard', 'Launch Dashboard')}</span>
                  <ArrowRight size={16} aria-hidden="true" />
                </button>
                <button
                  type="button"
                  className="hero-btn-replay-intro"
                  onClick={() => onNavigateTab('projects')}
                  title={t('view_projects', 'Browse All Projects')}
                >
                  <span>{t('view_projects', 'Browse Projects')}</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Right-side Infrastructure Illustration */}
        <div className="hero-infra-stage">
          <img
            src={heroIllustration}
            alt="National Infrastructure — India's Central Sector Projects"
            className="hero-infra-img-original"
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
            <span className="strip-lbl">{t('status_ongoing', 'Ongoing Projects Monitored')}</span>
          </div>
        </div>

        <div className="metric-strip-card">
          <div className="strip-icon"><TrendingUp size={20} color="#059669" aria-hidden="true" /></div>
          <div className="strip-info">
            <span className="strip-val">
              ₹<AnimatedCounter value={portfolioCostLakhCr} duration={1000} resetKey={activeTab} formatter={(v) => v.toFixed(2)} /> {t('lakh_crore', 'L Cr')}
            </span>
            <span className="strip-lbl">{t('total_cost_revised', 'Revised Portfolio Outlay')}</span>
          </div>
        </div>

        <div className="metric-strip-card" style={{ position: 'relative' }}>
          <div className="strip-icon"><Cpu size={20} color="#DC2626" aria-hidden="true" /></div>
          <div className="strip-info">
            <span className="strip-val" style={{ color: '#ef4444' }}>+15.2% Cr</span>
            <span className="strip-lbl">
              {t('cost_overrun_forecast', 'Cost Overrun Forecast')}
              <span style={{ marginLeft: '6px', verticalAlign: 'middle', display: 'inline-flex' }}>
                <InfoButton 
                  title={t('cost_overrun_forecast', 'Cost Overrun Forecast')}
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
              {t('schedule_overrun_forecast', 'Schedule Overrun Forecast')}
              <span style={{ marginLeft: '6px', verticalAlign: 'middle', display: 'inline-flex' }}>
                <InfoButton 
                  title={t('schedule_overrun_forecast', 'Schedule Overrun Forecast')}
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
            <h2 className="modules-title">{t('platform_modules', 'Platform Modules')}</h2>
            <InfoButton
              title={t('platform_modules', 'Platform Intelligence Modules')}
              summary="Navigate between core analytical engines: Dashboard for executive metrics, Projects for master portfolio telemetry, Distribution for resource allocation, and Action Center for generating policy directives."
              size="sm"
            />
          </div>
          <span className="modules-subtitle">{t('module_dashboard_desc', 'Core analytical engines & intelligence layers')}</span>
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
              <h3 style={{ margin: 0, color: '#0F172A', fontSize: '1.25rem', fontWeight: 'bold' }}>{t('officer_sign_in', 'MoSPI & Executing Agency Officer Access')}</h3>
            </div>
            <p style={{ margin: 0, color: '#475569', fontSize: '0.88rem', maxWidth: '650px' }}>
              {t('login_subtitle', 'Authorized officials from MoSPI, Ministry of Road Transport, Railways, Power, and Executing Agencies (NHAI) can sign in to access full predictive PDP telemetry, counterfactual simulators, automated ticket routing, and PDF Memorandum generators.')}
            </p>
          </div>
          <button
            type="button"
            className="officer-auth-btn"
            onClick={onOpenLoginModal}
          >
            <span>{t('officer_sign_in', 'Officer Authentication')}</span>
            <ArrowRight size={16} />
          </button>
        </section>
      )}
    </div>
  );
};
