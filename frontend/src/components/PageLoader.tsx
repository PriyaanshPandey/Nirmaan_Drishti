import React from 'react';
import './PageLoader.css';

export const PageLoader: React.FC = () => {
  return (
    <div className="page-loader-overlay">
      {/* Top shimmer bar */}
      <div className="loader-top-bar"></div>

      {/* Skeleton content area */}
      <div className="loader-body">
        {/* Header skeleton */}
        <div className="skeleton-header-block">
          <div className="skeleton skeleton-title"></div>
          <div className="skeleton skeleton-subtitle"></div>
        </div>

        {/* Row 1: 3 skeleton cards */}
        <div className="skeleton-cards-row-3">
          <div className="skeleton skeleton-card tall"></div>
          <div className="skeleton skeleton-card tall"></div>
          <div className="skeleton skeleton-card tall wide"></div>
        </div>

        {/* Row 2: 2 skeleton cards */}
        <div className="skeleton-cards-row-2">
          <div className="skeleton skeleton-card medium"></div>
          <div className="skeleton skeleton-card medium wide"></div>
        </div>
      </div>
    </div>
  );
};
