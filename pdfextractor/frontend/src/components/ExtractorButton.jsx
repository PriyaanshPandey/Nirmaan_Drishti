import React from 'react';
import { Layers } from 'lucide-react';

/**
 * Reusable Extractor Navigation / Action Button.
 * Can be placed in the Navbar, Sidebar, or Header of Nirmaan-Drishti.
 */
export function ExtractorButton({ onClick, className = '' }) {
  return (
    <button
      onClick={onClick}
      className={`extractor-nav-trigger ${className}`}
      title="Open MoSPI Flash Report PDF Extractor"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '8px',
        background: 'linear-gradient(135deg, #0284C7, #6366F1)',
        color: '#FFFFFF',
        border: 'none',
        padding: '8px 16px',
        borderRadius: '8px',
        fontSize: '13.5px',
        fontWeight: '600',
        cursor: 'pointer',
        boxShadow: '0 4px 12px rgba(99, 102, 241, 0.25)',
        transition: 'all 0.2s ease',
      }}
    >
      <Layers size={16} />
      <span>Extractor</span>
    </button>
  );
}

export default ExtractorButton;
