import React from 'react';
import './PageLoader.css';

export const PageLoader: React.FC = () => {
  return (
    <div className="page-loader-overlay">
      {/* Top shimmering progress bar */}
      <div className="loader-top-bar" />

      {/* Brand splash centred above skeleton */}
      <div className="loader-brand-splash">
        <div className="loader-spinner-ring" />
        <div className="loader-brand-text">
          <span className="loader-brand-name">Nirmaan Drishti</span>
          <span className="loader-brand-sub">Loading national infrastructure data…</span>
        </div>
      </div>

      {/* Skeleton content area matching dashboard layout */}
      <div className="loader-body">
        {/* Header skeleton */}
        <div className="skeleton-header-block">
          <div className="skeleton skeleton-title" />
          <div className="skeleton skeleton-subtitle" />
        </div>

        {/* Row 1: 3 skeleton cards */}
        <div className="skeleton-cards-row-3">
          <div className="skeleton skeleton-card tall" />
          <div className="skeleton skeleton-card tall" />
          <div className="skeleton skeleton-card tall wide" />
        </div>

        {/* Row 2: 2 skeleton cards */}
        <div className="skeleton-cards-row-2">
          <div className="skeleton skeleton-card medium" />
          <div className="skeleton skeleton-card medium wide" />
        </div>
      </div>
    </div>
  );
};
