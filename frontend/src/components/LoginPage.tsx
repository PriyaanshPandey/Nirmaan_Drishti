import React, { useState, useRef, useEffect } from 'react';
import {
  AlertCircle, Lock, User, LogIn, Eye, EyeOff,
  ShieldCheck, Shield, X,
  TrendingUp, AlertTriangle, Building2
} from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import './LoginPage.css';
import nirmaanEmblem from '../assets/nirmaan_emblem.png';

interface LoginPageProps {
  onSuccess: () => void;
  onClose?: () => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({ onSuccess, onClose }) => {
  const { login } = useAuth();
  const { t } = useLanguage();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const usernameRef = useRef<HTMLInputElement>(null);

  // Live Keystrokes / Typewriter effect for headline
  const [typedText, setTypedText] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [phraseIndex, setPhraseIndex] = useState(0);

  const headlinePhrases = [
    "AI–Driven Predictive Intelligence",
    "Real-Time Infrastructure Insights",
    "Automated Risk Detection Engine"
  ];

  useEffect(() => {
    const currentPhrase = headlinePhrases[phraseIndex % headlinePhrases.length];

    let timer: ReturnType<typeof setTimeout>;

    if (!isDeleting && typedText === currentPhrase) {
      timer = setTimeout(() => setIsDeleting(true), 2200);
    } else if (isDeleting && typedText === '') {
      setIsDeleting(false);
      setPhraseIndex((prev) => prev + 1);
    } else {
      const speed = isDeleting ? 35 : 70;
      timer = setTimeout(() => {
        setTypedText(
          isDeleting
            ? currentPhrase.substring(0, typedText.length - 1)
            : currentPhrase.substring(0, typedText.length + 1)
        );
      }, speed);
    }

    return () => clearTimeout(timer);
  }, [typedText, isDeleting, phraseIndex]);

  // Lock scrolling on mounting
  useEffect(() => {
    const originalBodyOverflow = document.body.style.overflow;
    const originalHtmlOverflow = document.documentElement.style.overflow;
    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';

    const timer = setTimeout(() => usernameRef.current?.focus(), 150);

    return () => {
      document.body.style.overflow = originalBodyOverflow;
      document.documentElement.style.overflow = originalHtmlOverflow;
      clearTimeout(timer);
    };
  }, []);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && onClose) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const trimmedUsername = username.trim();
    const trimmedPassword = password.trim();

    if (!trimmedUsername || !trimmedPassword) {
      setError(t('error_empty', 'Please enter both username and password.'));
      return;
    }

    setIsLoading(true);
    try {
      await login({ username: trimmedUsername, password: trimmedPassword });
      onSuccess();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Invalid credentials. Please verify and try again.';
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  };

  const fillCreds = (u: string, p: string) => {
    setUsername(u);
    setPassword(p);
    setError(null);
  };

  return (
    <div className="gov-login-viewport" role="main" aria-label="Nirmaan Drishti Officer Portal Login">
      {/* ── 1. Top Government Header (Centralized & Elegant) ───────────────── */}
      <header className="gov-top-header">
        {/* Left: Ashoka Emblem & Titles */}
        <div className="gov-header-left">
          <div className="gov-emblem-seal">
            <img
              src="/mospi_clean.png"
              alt="State Emblem of India"
              className="gov-emblem-img"
            />
          </div>
          <div className="gov-header-titles">
            <span className="gov-hindi-title">सांख्यिकी एवं कार्यक्रम कार्यान्वयन मंत्रालय</span>
            <span className="gov-eng-title">Ministry of Statistics &amp; Programme Implementation</span>
            <span className="gov-sub-title">Government of India</span>
          </div>
        </div>

        {/* Center: Absolutely Centralized Brand Title */}
        <div className="gov-header-center">
          <div className="gov-brand-name">NIRMAAN DRISHTI</div>
          <div className="gov-portal-tag">National Infrastructure Intelligence Portal</div>
          <div className="gov-tricolor-pill" aria-hidden="true">
            <span className="tri-saffron" />
            <span className="tri-white" />
            <span className="tri-green" />
          </div>
        </div>

        {/* Right: Subtle Close Button */}
        {onClose && (
          <button
            type="button"
            className="gov-header-subtle-close"
            onClick={onClose}
            title="Close login modal"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        )}
      </header>

      {/* ── 2. Main Body with Background & Content ───────────────────────── */}
      <main className="gov-main-stage">
        <div className="gov-backdrop-illustration" aria-hidden="true" />
        <div className="gov-backdrop-glow" aria-hidden="true" />

        <div className="gov-layout-grid">
          {/* Left Column */}
          <div className="gov-hero-col">
            <h1 className="gov-hero-headline">
              <span className="gov-typewriter-text">{typedText}</span>
              <span className="gov-typing-cursor">|</span>
              <br />
              for a <span className="gov-gradient-text">Viksit Bharat</span>
            </h1>

            <p className="gov-hero-desc">
              Intelligence platform built on top of PAIMANA to empower government officers with AI-driven insights to plan, monitor and accelerate India's infrastructure development.
            </p>

            {/* 4 Feature Badges with Staggered Floating Micro-Animations */}
            <div className="gov-features-row">
              <div className="gov-feature-card float-badge-1">
                <div className="gov-feature-icon-box bg-blue">
                  <TrendingUp size={22} className="text-blue" />
                </div>
                <div className="gov-feature-label">
                  AI-Driven<br />Forecasts
                </div>
              </div>

              <div className="gov-feature-card float-badge-2">
                <div className="gov-feature-icon-box bg-teal">
                  <ShieldCheck size={22} className="text-teal" />
                </div>
                <div className="gov-feature-label">
                  Real-Time<br />Early Warnings
                </div>
              </div>

              <div className="gov-feature-card float-badge-3">
                <div className="gov-feature-icon-box bg-amber">
                  <AlertTriangle size={22} className="text-amber" />
                </div>
                <div className="gov-feature-label">
                  Cost &amp; Delay<br />Overrun Matrix
                </div>
              </div>

              <div className="gov-feature-card float-badge-4">
                <div className="gov-feature-icon-box bg-purple">
                  <Building2 size={22} className="text-purple" />
                </div>
                <div className="gov-feature-label">
                  Multi-Ministry<br />Project Intelligence
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Sign-In Card */}
          <div className="gov-card-col">
            <div className="gov-login-card">
              {/* Card Header Logo */}
              <div className="gov-card-brand">
                <img
                  src={nirmaanEmblem}
                  alt="Nirmaan Drishti Logo"
                  className="gov-card-logo"
                />
                <div className="gov-card-brand-text">
                  <div className="gov-card-portal-title">NIRMAAN DRISHTI</div>
                  <div className="gov-card-portal-sub">MoSPI – National Infrastructure Intelligence Portal</div>
                </div>
              </div>

              <div className="gov-card-heading-group">
                <h2 className="gov-card-title">Sign in with Government Account</h2>
                <p className="gov-card-subtitle">Access for authorised government officers only</p>
              </div>

              {/* Form */}
              <form className="gov-form" onSubmit={handleSubmit} noValidate>
                {/* Username Field */}
                <div className="gov-form-group">
                  <label htmlFor="gov-username" className="gov-field-label">
                    Username / Official Email
                  </label>
                  <div className="gov-input-wrap">
                    <User size={18} className="gov-input-icon" />
                    <input
                      id="gov-username"
                      ref={usernameRef}
                      type="text"
                      className="gov-input-element"
                      placeholder="Enter your government email or username"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      autoComplete="username"
                      autoCapitalize="none"
                      spellCheck={false}
                      disabled={isLoading}
                      required
                    />
                  </div>
                </div>

                {/* Password Field (without Forgot Password link) */}
                <div className="gov-form-group">
                  <div className="gov-label-row">
                    <label htmlFor="gov-password" className="gov-field-label">
                      Password
                    </label>
                  </div>
                  <div className="gov-input-wrap">
                    <Lock size={18} className="gov-input-icon" />
                    <input
                      id="gov-password"
                      type={showPassword ? 'text' : 'password'}
                      className="gov-input-element"
                      placeholder="Enter your password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      autoComplete="current-password"
                      disabled={isLoading}
                      required
                    />
                    <button
                      type="button"
                      className="gov-eye-toggle"
                      onClick={() => setShowPassword(!showPassword)}
                      tabIndex={-1}
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </div>

                {/* Error Banner */}
                {error && (
                  <div className="gov-error-box" role="alert">
                    <AlertCircle size={16} className="gov-error-icon" />
                    <span>{error}</span>
                  </div>
                )}

                {/* Sign In Button */}
                <button
                  type="submit"
                  className="gov-submit-btn"
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <>
                      <span className="gov-btn-spinner" />
                      <span>Authenticating…</span>
                    </>
                  ) : (
                    <>
                      <LogIn size={18} />
                      <span>Sign In</span>
                    </>
                  )}
                </button>
              </form>

              {/* Security Audit Box */}
              <div className="gov-audit-box">
                <ShieldCheck size={20} className="gov-audit-icon" />
                <div className="gov-audit-text">
                  This system is for authorised government use only. All activities are monitored and audited.
                </div>
              </div>

              {/* Authorised Officer Demo Credentials Box directly under the Audit box */}
              <div className="gov-officer-credentials-box">
                <div className="gov-officer-cred-header">
                  <Shield size={14} className="gov-officer-cred-shield" />
                  <span>AUTHORISED OFFICER CREDENTIALS:</span>
                </div>
                <div
                  className="gov-officer-cred-item"
                  onClick={() => fillCreds('mospi001', 'mospi123')}
                  title="Click to fill MoSPI Superadmin credentials"
                >
                  <span className="gov-bullet">•</span>
                  <strong>MoSPI Superadmin:</strong>{' '}
                  <code className="gov-cred-code">mospi001</code> / <code className="gov-cred-code">mospi123</code>{' '}
                  <span className="gov-cred-desc">(Full Access)</span>
                </div>
                <div
                  className="gov-officer-cred-item"
                  onClick={() => fillCreds('agn001', 'agn123')}
                  title="Click to fill Agency Officer credentials"
                >
                  <span className="gov-bullet">•</span>
                  <strong>Agency Officer:</strong>{' '}
                  <code className="gov-cred-code">agn001</code> / <code className="gov-cred-code">agn123</code>{' '}
                  <span className="gov-cred-desc">(NHAI Focused View)</span>
                </div>
                <div
                  className="gov-officer-cred-item"
                  onClick={() => fillCreds('min001', 'min123')}
                  title="Click to fill Ministry Officer credentials"
                >
                  <span className="gov-bullet">•</span>
                  <strong>Ministry Officer:</strong>{' '}
                  <code className="gov-cred-code">min001</code> / <code className="gov-cred-code">min123</code>{' '}
                  <span className="gov-cred-desc">(MoRTH Focused View)</span>
                </div>
              </div>

            </div>
          </div>
        </div>
      </main>

      {/* ── 3. Bottom Government NIC Footer (without Indian map/flag icon) ──── */}
      <footer className="gov-bottom-footer">
        <div className="gov-footer-inner">
          {/* NIC Brand */}
          <div className="gov-footer-nic">
            <div className="nic-logo-text">NIC</div>
            <div className="nic-sub-text">
              National<br />Informatics<br />Centre
            </div>
          </div>

          {/* Links */}
          <div className="gov-footer-links">
            <a href="#about" onClick={(e) => e.preventDefault()}>About</a>
            <span className="gov-footer-sep">|</span>
            <a href="#help" onClick={(e) => e.preventDefault()}>Help</a>
            <span className="gov-footer-sep">|</span>
            <a href="#privacy" onClick={(e) => e.preventDefault()}>Privacy Policy</a>
            <span className="gov-footer-sep">|</span>
            <a href="#terms" onClick={(e) => e.preventDefault()}>Terms of Use</a>
            <span className="gov-footer-sep">|</span>
            <a href="#accessibility" onClick={(e) => e.preventDefault()}>Accessibility</a>
            <span className="gov-footer-sep">|</span>
            <a href="#contact" onClick={(e) => e.preventDefault()}>Contact Us</a>
          </div>

          {/* Government of India Emblem (Map icon removed as requested) */}
          <div className="gov-footer-goi">
            <img
              src="/mospi_clean.png"
              alt="Government of India"
              className="gov-footer-emblem"
            />
            <div className="gov-footer-goi-text">
              <span className="goi-hindi">भारत सरकार</span>
              <span className="goi-eng">Government of India</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default LoginPage;
