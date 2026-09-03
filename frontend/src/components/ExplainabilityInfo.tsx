import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Info, X, BookOpen, Layers, Cpu, ShieldAlert, CheckCircle2 } from 'lucide-react';
import './ExplainabilityInfo.css';

export interface InfoButtonProps {
  title: string;
  category?: string;
  summary: string;
  calculation?: string;
  implication?: string;
  theme?: 'dark' | 'light';
  size?: 'sm' | 'md';
  style?: React.CSSProperties;
}

export const InfoButton: React.FC<InfoButtonProps> = ({
  title,
  category = 'DEFINITION',
  summary,
  calculation,
  implication,
  theme = 'light',
  size = 'md',
  style
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [coords, setCoords] = useState<{ top: number; left: number }>({ top: 0, left: 0 });
  const buttonRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  const updatePosition = () => {
    if (!buttonRef.current) return;
    const rect = buttonRef.current.getBoundingClientRect();
    const popoverWidth = 320;
    const padding = 12;

    // Calculate left, keeping within viewport
    let left = rect.left + rect.width / 2 - popoverWidth / 2;
    if (left < padding) left = padding;
    if (left + popoverWidth > window.innerWidth - padding) {
      left = window.innerWidth - popoverWidth - padding;
    }

    // Calculate top: prefer below, flip above if near bottom
    let top = rect.bottom + 8;
    if (top + 280 > window.innerHeight && rect.top - 280 > padding) {
      top = rect.top - 260;
    }

    setCoords({ top, left });
  };

  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isOpen) {
      updatePosition();
    }
    setIsOpen(!isOpen);
  };

  useEffect(() => {
    if (!isOpen) return;

    const handleScrollOrResize = () => {
      updatePosition();
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false);
    };

    const handleOutsideClick = (e: MouseEvent) => {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(e.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    window.addEventListener('scroll', handleScrollOrResize, true);
    window.addEventListener('resize', handleScrollOrResize);
    document.addEventListener('mousedown', handleOutsideClick);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('scroll', handleScrollOrResize, true);
      window.removeEventListener('resize', handleScrollOrResize);
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        className={`info-btn-trigger ${size} ${theme === 'dark' ? 'dark-theme-trigger' : ''} ${isOpen ? 'active' : ''}`}
        onClick={handleToggle}
        title={`Click for explainability: ${title}`}
        aria-label={`Explain ${title}`}
        style={style}
      >
        <Info size={size === 'sm' ? 10 : 12} strokeWidth={2.4} />
      </button>

      {isOpen &&
        createPortal(
          <>
            <div className="info-popover-backdrop" onClick={() => setIsOpen(false)} />
            <div
              ref={popoverRef}
              className="info-popover-card"
              style={{ top: `${coords.top}px`, left: `${coords.left}px` }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="info-popover-header">
                <div>
                  <span className="info-popover-category">{category}</span>
                  <h4 className="info-popover-title">{title}</h4>
                </div>
                <button
                  type="button"
                  className="info-popover-close"
                  onClick={() => setIsOpen(false)}
                  aria-label="Close popover"
                >
                  <X size={14} />
                </button>
              </div>

              <div className="info-popover-body">
                <p className="info-popover-summary">{summary}</p>

                {calculation && (
                  <div className="info-popover-section">
                    <div className="info-popover-section-label">
                      <span>Formula &amp; Method</span>
                    </div>
                    <p className="info-popover-section-text info-popover-code">{calculation}</p>
                  </div>
                )}

                {implication && (
                  <div className="info-popover-tip">
                    <div className="info-popover-section-label">
                      <span>Key Takeaway</span>
                    </div>
                    <p className="info-popover-section-text">{implication}</p>
                  </div>
                )}
              </div>
            </div>
          </>,
          document.body
        )}
    </>
  );
};

export const DashboardGuideModal: React.FC<{ isOpen: boolean; onClose: () => void }> = ({
  isOpen,
  onClose
}) => {
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return createPortal(
    <div className="guide-modal-overlay" onClick={onClose}>
      <div className="guide-modal-container" onClick={(e) => e.stopPropagation()}>
        <div className="guide-modal-header">
          <div className="guide-modal-header-text">
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
              <BookOpen size={18} color="#93C5FD" />
              <h2>Platform Explainability &amp; Methodology Guide</h2>
            </div>
            <p>Understand how metrics are calculated, risk scores are assigned, and AI forecasts are generated</p>
          </div>
          <button className="guide-modal-close" onClick={onClose} aria-label="Close guide">
            <X size={16} />
          </button>
        </div>

        <div className="guide-modal-content">
          {/* Section 1: Monitoring Mandate */}
          <div className="guide-section">
            <h3 className="guide-section-title">
              <Layers size={16} color="#03045E" />
              1. PAIMANA Monitoring Scope &amp; Criteria
            </h3>
            <p className="guide-section-text">
              Nirmaan Drishti tracks all central sector infrastructure projects with sanctioned capital outlay of <strong>₹150 Crore and above</strong> under the Ministry of Statistics and Programme Implementation (MoSPI). Progress data, expenditure vouchers, and milestone updates are synthesized on a continuous monthly cycle.
            </p>
            <div className="guide-grid-2">
              <div className="guide-kpi-card">
                <div className="guide-kpi-name">Original Sanctioned Cost</div>
                <div className="guide-kpi-desc">Statutory capital expenditure approved at inception by the Cabinet Committee on Economic Affairs (CCEA) or relevant Ministry.</div>
              </div>
              <div className="guide-kpi-card">
                <div className="guide-kpi-name">Revised Anticipated Cost</div>
                <div className="guide-kpi-desc">Latest projected completion cost incorporating approved variation orders, price index adjustments, and foreign exchange shifts.</div>
              </div>
            </div>
          </div>

          {/* Section 2: Health Status Classification */}
          <div className="guide-section">
            <h3 className="guide-section-title">
              <CheckCircle2 size={16} color="#03045E" />
              2. Project Health Classification Rules
            </h3>
            <p className="guide-section-text">
              Every project is automatically categorized into one of four distinct health states:
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', background: '#FFFFFF', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
                <span className="guide-status-pill on-track">On Track</span>
                <span style={{ fontSize: '12px', color: '#475569' }}>0 months timeline delay AND 0% cost overrun</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', background: '#FFFFFF', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
                <span className="guide-status-pill monitoring">Monitoring</span>
                <span style={{ fontSize: '12px', color: '#475569' }}>Minor delay (1–3 months) or minor cost variance (&lt;5%)</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', background: '#FFFFFF', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
                <span className="guide-status-pill at-risk">At Risk</span>
                <span style={{ fontSize: '12px', color: '#475569' }}>Schedule delay of 3–12 months or cost overrun of 5–15%</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', background: '#FFFFFF', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
                <span className="guide-status-pill critical">Critical Delay</span>
                <span style={{ fontSize: '12px', color: '#475569' }}>Schedule delay &gt;12 months OR cost escalation &gt;15%</span>
              </div>
            </div>
          </div>

          {/* Section 3: AI Predictive Modeling & TreeSHAP */}
          <div className="guide-section">
            <h3 className="guide-section-title">
              <Cpu size={16} color="#03045E" />
              3. AI Machine Learning &amp; TreeSHAP Explainability
            </h3>
            <p className="guide-section-text">
              Our backend executes four production <strong>XGBoost Gradient Boosted Decision Tree</strong> models trained on 14,979 monthly project snapshots across walk-forward temporal cross-validation folds:
            </p>
            <div className="guide-grid-2">
              <div className="guide-kpi-card">
                <div className="guide-kpi-name">3M &amp; 6M Horizon Classifiers</div>
                <div className="guide-kpi-desc">Predict the exact probability (0–100%) that a project will suffer cost or schedule overruns in the next quarter or half-year.</div>
              </div>
              <div className="guide-kpi-card">
                <div className="guide-kpi-name">Continuous Regressors</div>
                <div className="guide-kpi-desc">Estimate the exact expected quantum of additional cost (₹ Crores) and additional slippage (Months).</div>
              </div>
            </div>
            <div style={{ marginTop: '12px', padding: '10px', background: '#FFFFFF', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
              <div style={{ fontSize: '11.5px', fontWeight: 800, color: '#03045E', marginBottom: '4px' }}>
                How TreeSHAP Values Work:
              </div>
              <div style={{ fontSize: '12px', color: '#64748B', lineHeight: '1.5' }}>
                <strong>Red Bars (+SHAP):</strong> Features accelerating risk (e.g. expenditure lagging behind physical progress, pending land acquisition).<br />
                <strong>Green Bars (-SHAP):</strong> Protective factors mitigating risk (e.g. experienced EPC contractor, high monthly milestone completion rate).
              </div>
            </div>
          </div>

          {/* Section 4: Priority Interventions */}
          <div className="guide-section">
            <h3 className="guide-section-title">
              <ShieldAlert size={16} color="#EF4444" />
              4. Priority Interventions Scoring
            </h3>
            <p className="guide-section-text">
              Projects in the Action Centre are ranked by a composite Exposure Index:
              <br />
              <code style={{ background: '#F1F5F9', padding: '2px 6px', borderRadius: '4px', fontSize: '12px', color: '#03045E', display: 'inline-block', marginTop: '6px' }}>
                Priority Score = (Risk Probability × 0.6) + (Capital at Stake / ₹10,000 Cr × 0.4)
              </code>
            </p>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};
