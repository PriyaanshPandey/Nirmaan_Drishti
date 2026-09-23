/**
 * LoginPage — Nirmaan Drishti authentication screen.
 *
 * Displayed after the intro animation completes, before any app content.
 * Matches the existing design language exactly (dark gov theme, amber accents).
 * On successful login, calls onSuccess() which unmounts this page and shows the app.
 */
import React, { useState, useRef, useEffect } from 'react';
import { AlertCircle, LogIn, Shield } from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import './LoginPage.css';
import nirmaanEmblem from '../assets/nirmaan_emblem.png';

interface LoginPageProps {
  onSuccess: () => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({ onSuccess }) => {
  const { login } = useAuth();
  const { t } = useLanguage();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const usernameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Auto-focus username field when page appears
    const timer = setTimeout(() => usernameRef.current?.focus(), 100);
    return () => clearTimeout(timer);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const trimmedUsername = username.trim();
    const trimmedPassword = password.trim();

    if (!trimmedUsername || !trimmedPassword) {
      setError(t('error', 'Please enter both username and password.'));
      return;
    }

    setIsLoading(true);
    try {
      await login({ username: trimmedUsername, password: trimmedPassword });
      onSuccess();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'An error occurred. Please try again.';
      setError(msg);
    }
 finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="login-overlay" role="main" aria-label="Nirmaan Drishti Login">
      {/* Decorative background elements */}
      <div className="login-bg-grid" aria-hidden="true" />
      <div className="login-glow-1" aria-hidden="true" />
      <div className="login-glow-2" aria-hidden="true" />

      <div className="login-card" role="region" aria-label="Sign in to Nirmaan Drishti">
        {/* Header */}
        <div className="login-header">
          <div className="login-emblem-wrap">
            <img
              src={nirmaanEmblem}
              alt="Nirmaan Drishti"
              className="login-emblem"
            />
          </div>
          <h1 className="login-title" style={{ fontSize: '24px' }}>{t('officer_sign_in', 'MoSPI & Executing Agency Officer Access')}</h1>
          <p className="login-subtitle">{t('portal_title', 'Nirmaan Drishti')} — {t('portal_subtitle', 'National Infrastructure Intelligence Portal')}</p>
          <div className="login-divider" aria-hidden="true" />
        </div>

        {/* Login Form */}
        <form className="login-form" onSubmit={handleSubmit} noValidate>
          {/* Username */}
          <div className="login-field">
            <label htmlFor="login-username" className="login-label">
              {t('username', 'Username')}
            </label>
            <div className="login-input-wrap">
              <input
                id="login-username"
                ref={usernameRef}
                type="text"
                className="login-input"
                placeholder={t('username', 'Enter your username')}
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="username"
                autoCapitalize="none"
                spellCheck={false}
                disabled={isLoading}
                aria-required="true"
                aria-describedby={error ? 'login-error-msg' : undefined}
              />
            </div>
          </div>

          {/* Password */}
          <div className="login-field">
            <label htmlFor="login-password" className="login-label">
              {t('password', 'Password')}
            </label>
            <div className="login-input-wrap">
              <input
                id="login-password"
                type="password"
                className="login-input"
                placeholder={t('password', 'Enter your password')}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                disabled={isLoading}
                aria-required="true"
                aria-describedby={error ? 'login-error-msg' : undefined}
              />
            </div>
          </div>

          {/* Error message */}
          {error && (
            <div
              id="login-error-msg"
              className="login-error"
              role="alert"
              aria-live="assertive"
            >
              <AlertCircle size={15} className="login-error-icon" aria-hidden="true" />
              <span>{error}</span>
            </div>
          )}

          {/* Submit */}
          <button
            id="login-submit-btn"
            type="submit"
            className="login-btn"
            disabled={isLoading}
            aria-label={isLoading ? t('loading', 'Signing in…') : t('sign_in', 'Sign in')}
          >
            <span className="login-btn-inner">
              {isLoading ? (
                <>
                  <span className="login-spinner" aria-hidden="true" />
                  <span>{t('loading', 'Authenticating…')}</span>
                </>
              ) : (
                <>
                  <LogIn size={16} aria-hidden="true" />
                  <span>{t('sign_in', 'Sign In')}</span>
                </>
              )}
            </span>
          </button>
        </form>

        {/* Footer */}
        <footer className="login-footer">
          {/* Demo Credentials Box */}
          <div style={{
            marginBottom: '16px',
            padding: '12px 14px',
            borderRadius: '8px',
            backgroundColor: 'rgba(245, 158, 11, 0.08)',
            border: '1px solid rgba(245, 158, 11, 0.25)',
            fontSize: '0.75rem',
            color: '#cbd5e1',
            textAlign: 'left',
            lineHeight: '1.6'
          }}>
            <div style={{ fontWeight: 'bold', color: '#f59e0b', marginBottom: '6px', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Shield size={14} /> AUTHORISED OFFICER CREDENTIALS:
            </div>
            <div>
              • <strong>MoSPI Superadmin:</strong> <code style={{ color: '#38bdf8' }}>mospi001</code> / <code style={{ color: '#38bdf8' }}>mospi123</code> (Full Access)
            </div>
            <div>
              • <strong>Agency Officer:</strong> <code style={{ color: '#38bdf8' }}>agn001</code> / <code style={{ color: '#38bdf8' }}>agn123</code> (NHAI Focused View)
            </div>
            <div>
              • <strong>Ministry Officer:</strong> <code style={{ color: '#38bdf8' }}>min001</code> / <code style={{ color: '#38bdf8' }}>min123</code> (MoRTH Focused View)
            </div>
          </div>

          <p className="login-footer-text" style={{ marginBottom: '12px' }}>
            {t('mospi_title', 'Ministry of Statistics & Programme Implementation (MoSPI)')}
            <br />
            {t('goi_title', 'Government of India')}
          </p>
        </footer>

      </div>
    </div>
  );
};

export default LoginPage;
