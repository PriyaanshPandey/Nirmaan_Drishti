import React, { useState, useRef, useEffect, useId } from 'react';
import { createPortal } from 'react-dom';
import { Info } from 'lucide-react';
import './ExplainabilityInfo.css';

export interface InfoButtonProps {
  title: string;
  category?: string;
  summary: string;
  dataSummary?: ChartDataSummary;
  calculation?: string;
  implication?: string;
  theme?: 'dark' | 'light';
  size?: 'sm' | 'md';
  style?: React.CSSProperties;
}

export interface ChartDataSummary {
  items: Array<{ label: string; value: string }>;
  insight?: string;
}

export const InfoButton: React.FC<InfoButtonProps> = ({
  title,
  summary,
  dataSummary,
  theme = 'light',
  size = 'md',
  style
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [coords, setCoords] = useState<{ top: number; left: number }>({ top: 0, left: 0 });
  const popoverId = useId();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const closeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

    // Calculate top: prefer below; flip above if near bottom
    let top = rect.bottom + 6;
    if (top + 360 > window.innerHeight && rect.top - 360 > padding) {
      top = Math.max(padding, rect.top - 360);
    }

    setCoords({ top, left });
  };

  const handleMouseEnter = () => {
    if (closeTimeoutRef.current) {
      clearTimeout(closeTimeoutRef.current);
      closeTimeoutRef.current = null;
    }
    updatePosition();
    setIsOpen(true);
  };

  const handleMouseLeave = () => {
    closeTimeoutRef.current = setTimeout(() => {
      setIsOpen(false);
    }, 150);
  };

  const handleToggleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isOpen) {
      updatePosition();
      setIsOpen(true);
    } else {
      setIsOpen(false);
    }
  };

  useEffect(() => {
    if (!isOpen) return;
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
        buttonRef.current?.focus();
      }
    };
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('keydown', handleEscape);
      if (closeTimeoutRef.current) clearTimeout(closeTimeoutRef.current);
    };
  }, [isOpen]);

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        className={`info-btn-trigger ${size} ${theme === 'dark' ? 'dark-theme-trigger' : ''} ${isOpen ? 'active' : ''}`}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onClick={handleToggleClick}
        title={title}
        aria-label={`Explain ${title}`}
        aria-expanded={isOpen}
        aria-controls={isOpen ? popoverId : undefined}
        aria-describedby={isOpen ? popoverId : undefined}
        style={style}
      >
        <Info size={size === 'sm' ? 10 : 11} strokeWidth={2.4} aria-hidden="true" />
      </button>

      {isOpen &&
        createPortal(
          <div
            ref={popoverRef}
            id={popoverId}
            role="tooltip"
            className="info-popover-card"
            style={{ top: `${coords.top}px`, left: `${coords.left}px` }}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="info-popover-header">
              <h4 className="info-popover-title">{title}</h4>
            </div>
            <p className="info-popover-summary">{summary}</p>
            {dataSummary && (
              <div className="info-popover-data-summary" aria-label="Current chart data">
                <h5 className="info-popover-section-title">Current Data</h5>
                <ul className="info-popover-data-list">
                  {dataSummary.items.map((item) => (
                    <li key={`${item.label}-${item.value}`}>
                      <span>{item.label}</span>
                      <strong>{item.value}</strong>
                    </li>
                  ))}
                </ul>
                {dataSummary.insight && (
                  <div className="info-popover-insight">
                    <h5 className="info-popover-section-title">Key Insight</h5>
                    <p>{dataSummary.insight}</p>
                  </div>
                )}
              </div>
            )}
          </div>,
          document.body
        )}
    </>
  );
};
