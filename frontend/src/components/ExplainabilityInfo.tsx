import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Info } from 'lucide-react';
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
  summary,
  theme = 'light',
  size = 'md',
  style
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [coords, setCoords] = useState<{ top: number; left: number }>({ top: 0, left: 0 });
  const buttonRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const closeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const updatePosition = () => {
    if (!buttonRef.current) return;
    const rect = buttonRef.current.getBoundingClientRect();
    const popoverWidth = 270;
    const padding = 12;

    // Calculate left, keeping within viewport
    let left = rect.left + rect.width / 2 - popoverWidth / 2;
    if (left < padding) left = padding;
    if (left + popoverWidth > window.innerWidth - padding) {
      left = window.innerWidth - popoverWidth - padding;
    }

    // Calculate top: prefer below; flip above if near bottom
    let top = rect.bottom + 6;
    if (top + 160 > window.innerHeight && rect.top - 160 > padding) {
      top = rect.top - 140;
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
    return () => {
      if (closeTimeoutRef.current) clearTimeout(closeTimeoutRef.current);
    };
  }, []);

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
        style={style}
      >
        <Info size={size === 'sm' ? 10 : 11} strokeWidth={2.4} />
      </button>

      {isOpen &&
        createPortal(
          <div
            ref={popoverRef}
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
          </div>,
          document.body
        )}
    </>
  );
};
