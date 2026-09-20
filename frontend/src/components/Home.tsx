import React, { useState, useEffect } from 'react';
import {
  ArrowRight, Cpu, TrendingUp, BarChart3, Globe, Play
} from 'lucide-react';
import './Home.css';
import { VideoHero } from './VideoHero';
import { IndiaMap } from './IndiaMap';
import { AnimatedCounter } from './AnimatedCounter';
import nirmaanEmblem from '../assets/nirmaan_emblem.png';
import heroIllustration from '../assets/hero_illustration.png';
import heroIllustrationBase from '../assets/hero_illustration_base.png';

import { api } from '../services/api';

const initialProjectsCount = 6568;
const initialLakhCrores = 35.8;
const initialStatesCount = 28;

interface HomeProps {
  activeTab?: string;
  onNavigateTab: (tab: string) => void;
  homeClickNonce?: number;
}

export const Home: React.FC<HomeProps> = ({ activeTab, onNavigateTab, homeClickNonce }) => {
  const [playIntro, setPlayIntro] = useState<boolean>(false);
  const [replayCount, setReplayCount] = useState<number>(0);
  const [isDotsAnimating, setIsDotsAnimating] = useState<boolean>(false);
  const [animIteration, setAnimIteration] = useState<number>(0);

  const [totalProjects, setTotalProjects] = useState<number>(initialProjectsCount);
  const [portfolioCostLakhCr, setPortfolioCostLakhCr] = useState<number>(initialLakhCrores);
  const statesCount = initialStatesCount;

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

  // Trigger convergence animation on home load or after video intro dismisses or whenever home is clicked
  useEffect(() => {
    if (!playIntro && activeTab === 'home') {
      setIsDotsAnimating(false);
      const timer = setTimeout(() => {
        setIsDotsAnimating(true);
        setAnimIteration(prev => prev + 1);
      }, 120);
      return () => clearTimeout(timer);
    }
  }, [playIntro, activeTab, homeClickNonce]);

  // Turn off isDotsAnimating state after animation cycle completes (~3.5s)
  useEffect(() => {
    if (isDotsAnimating) {
      const timer = setTimeout(() => {
        setIsDotsAnimating(false);
      }, 3500);
      return () => clearTimeout(timer);
    }
  }, [isDotsAnimating, animIteration]);

  // Manual replay trigger (on clicking illustration directly)
  const handleTriggerAnimation = () => {
    setIsDotsAnimating(false);
    setTimeout(() => {
      setIsDotsAnimating(true);
      setAnimIteration(prev => prev + 1);
    }, 40);
  };

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
      desc: 'Telemetry, risk diagnostics, and milestone tracking across 6,568 assets.',
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

        {/* Right-side Infrastructure Illustration with 4-Dots Convergence & Blur Animation */}
        <div
          className={`hero-infra-stage ${isDotsAnimating ? 'is-animating' : ''}`}
          key={`anim-stage-${animIteration}`}
          onClick={handleTriggerAnimation}
          role="button"
          tabIndex={0}
          title="Click to replay convergence animation"
        >
          {/* Base illustration that blurs when dots converge */}
          <img
            src={heroIllustrationBase}
            alt="National Infrastructure Illustration"
            className="hero-infra-img"
          />

          {/* Pristine original illustration (active when not animating) */}
          <img
            src={heroIllustration}
            alt=""
            aria-hidden="true"
            className="hero-infra-img-original"
          />

          {/* Central AI Synthesis / Radar Pulse Wave */}
          <div className="hero-center-cluster" aria-hidden="true">
            <div className="hero-center-pulse ring-1" />
            <div className="hero-center-pulse ring-2" />
            <div className="hero-center-core-glow" />
          </div>

          {/* 4 Animated High-Precision Dots */}
          {/* 1. Blue Dot */}
          <div className="hero-dot hero-dot-blue" aria-label="Blue Intelligence Node">
            <div className="hero-dot-core" />
            <div className="hero-dot-glow" />
            <div className="hero-dot-ping" />
          </div>

          {/* 2. Green Dot */}
          <div className="hero-dot hero-dot-green" aria-label="Green Intelligence Node">
            <div className="hero-dot-core" />
            <div className="hero-dot-glow" />
            <div className="hero-dot-ping" />
          </div>

          {/* 3. Yellow Dot */}
          <div className="hero-dot hero-dot-yellow" aria-label="Yellow Intelligence Node">
            <div className="hero-dot-core" />
            <div className="hero-dot-glow" />
            <div className="hero-dot-ping" />
          </div>

          {/* 4. Red Dot */}
          <div className="hero-dot hero-dot-red" aria-label="Red Intelligence Node">
            <div className="hero-dot-core" />
            <div className="hero-dot-glow" />
            <div className="hero-dot-ping" />
          </div>
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
            <span className="strip-lbl">Projects Monitored</span>
          </div>
        </div>

        <div className="metric-strip-card">
          <div className="strip-icon"><TrendingUp size={20} color="#059669" aria-hidden="true" /></div>
          <div className="strip-info">
            <span className="strip-val">
              ₹<AnimatedCounter value={portfolioCostLakhCr} duration={1000} resetKey={activeTab} formatter={(v) => v.toFixed(2)} /> L Cr
            </span>
            <span className="strip-lbl">Total Portfolio</span>
          </div>
        </div>

        <div className="metric-strip-card">
          <div className="strip-icon"><Cpu size={20} color="#7C3AED" aria-hidden="true" /></div>
          <div className="strip-info">
            <span className="strip-val">3 Months</span>
            <span className="strip-lbl">Forecast Horizon</span>
          </div>
        </div>

        <div className="metric-strip-card">
          <div className="strip-icon"><Globe size={20} color="#D97706" aria-hidden="true" /></div>
          <div className="strip-info">
            <span className="strip-val">
              <AnimatedCounter value={statesCount} duration={800} resetKey={activeTab} />+
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
    </div>
  );
};
