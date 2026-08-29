import React, { useState, useEffect } from 'react';
import { 
  Sparkles, ShieldAlert, Clock, Users, ArrowRight, ChevronDown, Check, 
  ChevronRight, TrendingUp, HelpCircle, Layers, BarChart3, Zap 
} from 'lucide-react';
import './AIInsights.css';

type InsightsTab = 'overview' | 'issues' | 'patterns' | 'similarity' | 'drivers' | 'predictive';

export const AIInsights: React.FC = () => {
  const [activeSubTab, setActiveSubTab] = useState<InsightsTab>('overview');
  const [expandedPattern, setExpandedPattern] = useState<number | null>(0);
  const [selectedSimilarity, setSelectedSimilarity] = useState<'cost' | 'schedule' | 'onhold'>('schedule');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 80);
    return () => clearTimeout(t);
  }, []);

  const subTabs = [
    { id: 'overview', label: 'Overview' },
    { id: 'issues', label: 'Emerging Issues' },
    { id: 'patterns', label: 'Pattern Detection' },
    { id: 'similarity', label: 'Historical Similarity' },
    { id: 'drivers', label: 'Risk Drivers' },
    { id: 'predictive', label: 'Predictive Insights' },
  ];

  // Recommendations data
  const recommendations = [
    {
      id: 1,
      title: 'Revision Land Acquisition Processes',
      impact: 'High Impact',
      impactColor: 'var(--color-accent-red)',
      desc: 'Distribution delay affects key construction phases.',
      icon: <ShieldAlert size={16} color="#ffffff" />,
      iconBg: 'var(--color-accent-red)'
    },
    {
      id: 2,
      title: 'Restructure Procurement Timelines',
      impact: 'High Impact',
      impactColor: 'var(--color-accent-red)',
      desc: 'Supply delays propagate risk to equipment installations.',
      icon: <Clock size={16} color="#ffffff" />,
      iconBg: 'var(--color-accent-red)'
    },
    {
      id: 3,
      title: 'Strengthen Clearance Approvals',
      impact: 'Medium Impact',
      impactColor: '#D97706',
      desc: 'Forest clearance permissions represent primary critical path items.',
      icon: <ShieldAlert size={16} color="#ffffff" />,
      iconBg: '#F59E0B'
    },
    {
      id: 4,
      title: 'Review Contractor Performance',
      impact: 'Medium Impact',
      impactColor: '#D97706',
      desc: 'Milestone slippage rates exceed average sector deviations by 15%.',
      icon: <Users size={16} color="#ffffff" />,
      iconBg: '#F59E0B'
    }
  ];

  // Emerging Trends sparkline helper
  const renderSparkline = (points: string, color: string) => (
    <svg width="45" height="15" viewBox="0 0 50 20" className="trend-sparkline-svg">
      <path d={points} fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );

  // Circular progress loader for Historical Similarity (Interactive)
  const renderSimilarityCircle = (pct: number, label: string, key: 'cost' | 'schedule' | 'onhold') => {
    const radius = 18;
    const circum = 2 * Math.PI * radius;
    const offset = circum - (pct / 100) * circum;
    const isActive = selectedSimilarity === key;

    return (
      <div 
        className={`similarity-circle-unit ${isActive ? 'active' : ''}`}
        onClick={() => setSelectedSimilarity(key)}
        style={{ cursor: 'pointer' }}
      >
        <div className="similarity-circle-svg-wrapper">
          <svg viewBox="0 0 44 44" className="sim-circle-svg">
            <circle cx="22" cy="22" r={radius} fill="none" stroke="rgba(255, 255, 255, 0.1)" strokeWidth="3.5" />
            <circle 
              cx="22" 
              cy="22" 
              r={radius} 
              fill="none" 
              stroke={isActive ? '#3E8BFF' : '#ffffff'} 
              strokeWidth="3.5" 
              strokeDasharray={circum}
              strokeDashoffset={offset}
              strokeLinecap="round"
              transform="rotate(-90 22 22)"
              style={{ transition: 'stroke-dashoffset 0.8s ease, stroke 0.25s ease' }}
            />
          </svg>
          <div className="similarity-circle-pct-txt" style={{ color: isActive ? '#3E8BFF' : '#ffffff', fontWeight: isActive ? '900' : '700' }}>{pct}%</div>
        </div>
        <span className="similarity-circle-lbl" style={{ color: isActive ? '#ffffff' : '#A5B4FC', fontWeight: isActive ? '800' : '600' }}>{label}</span>
      </div>
    );
  };

  const getSimilarityFooterText = () => {
    switch (selectedSimilarity) {
      case 'cost':
        return 'Projects with similar profiles showed 82% chance of significant cost overruns exceeding 15% of approved budget.';
      case 'schedule':
        return 'Projects with similar profiles showed 90% chance of significant schedule delays exceeding 12 months.';
      case 'onhold':
        return 'Projects with similar profiles showed 31% chance of being placed on hold within the next 18 months.';
      default:
        return 'Projects with similar profiles showed 90% chance of significant delay within 18 months.';
    }
  };

  return (
    <div className="insights-container animation-fade-in">
      {/* Title Block Header */}
      <div className="insights-header-block">
        <div className="header-block-left">
          <h1 className="insights-page-title">AI Insights</h1>
          <p className="insights-page-subtitle">Actionable intelligence for a stronger infrastructure tomorrow.</p>
        </div>
        <div className="header-block-right">
          <div className="insights-date-group">
            <span className="insights-date-indicator">31 July 2026</span>
            <span className="insights-update-sub">Last updated: 12m ago</span>
          </div>
          
          <div className="ai-dropdown-badge">
            <Sparkles size={13} className="ai-spark-icon" />
            <span className="ai-dropdown-txt">AI Powered Insights</span>
            <ChevronDown size={12} className="ai-chevron" />
          </div>
        </div>
      </div>

      {/* Pill sub-tabs selector (Overview, Pattern, Similarity etc.) */}
      <div className="insights-sub-tabs-bar">
        {subTabs.map((tab) => (
          <button
            key={tab.id}
            className={`insights-sub-tab-btn ${activeSubTab === tab.id ? 'active' : ''}`}
            onClick={() => setActiveSubTab(tab.id as InsightsTab)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Main Insights Content Grid */}
      {activeSubTab === 'overview' ? (
        <div className="insights-grid-content">
          {/* Row 1: Recommendations Block & Summary Box */}
          <div className="insights-row-recommendations-summary">
            {/* AI Recommendations */}
            <div className="card recommendations-card">
              <div className="recommendations-header">
                <div>
                  <h2 className="card-title flex-align-center gap-6">
                    <Zap size={15} fill="var(--color-on-track)" color="var(--color-on-track)" />
                    <span>AI Recommendations</span>
                  </h2>
                  <p className="card-subtitle">Top recommendations based on current trends and historical patterns.</p>
                </div>
                <button className="card-link-btn" onClick={() => alert('View all recommendations')}>View All</button>
              </div>

              <div className="recommendations-horizontal-row">
                {recommendations.map((rec) => (
                  <div key={rec.id} className="recommendation-sub-card">
                    <div className="rec-header">
                      <div className="rec-icon-wrapper" style={{ backgroundColor: rec.iconBg }}>
                        {rec.icon}
                      </div>
                      <span className="rec-impact-tag" style={{ color: rec.impactColor }}>{rec.impact}</span>
                    </div>
                    <h4 className="rec-title">{rec.title}</h4>
                    <p className="rec-description">{rec.desc}</p>
                    <button className="rec-action-dropdown-btn" onClick={() => alert(`Showing projects for: ${rec.title}`)}>
                      <span>View Affected Projects</span>
                      <ChevronDown size={11} />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* AI Insight Summary */}
            <div className="card summary-insight-card">
              <div className="summary-insight-header">
                <div className="summary-icon-pulse-wrapper">
                  <Sparkles size={16} color="#6EA7F5" />
                </div>
                <h2 className="card-title">AI Insight Summary</h2>
              </div>
              <p className="summary-insight-body-text">
                Current patterns indicate escalating delays in land acquisition and procurement, with 12 projects showing early risk signals. If current trends continue, overall portfolio delay could increase by <strong>5.2 months</strong>.
              </p>
              <button className="summary-insight-cta-btn" onClick={() => alert('Opening detailed analytical view...')}>
                <span>Explore Detailed Insights</span>
                <ArrowRight size={14} />
              </button>
            </div>
          </div>

          {/* Row 2: 4-Column Analytics Row */}
          <div className="insights-row-4-columns">
            {/* Col 1: Emerging Issues & Trends */}
            <div className="card column-card">
              <div className="column-card-header">
                <div>
                  <h2 className="card-title">Emerging Issues & Trends</h2>
                  <p className="card-subtitle">Top issues showing increased activity across the project portfolio.</p>
                </div>
                <button className="card-link-btn">View All</button>
              </div>

              <div className="emerging-list-grid">
                <div className="emerging-row-item">
                  <div className="emerging-row-details">
                    <span className="emerging-row-name">Land Acquisition</span>
                    <span className="emerging-row-sub">24 projects</span>
                  </div>
                  <div className="emerging-row-value-spark">
                    <span className="emerging-val font-red">+23%</span>
                    {renderSparkline('M 2 12 Q 12 5, 22 10 T 42 2 T 48 8', 'var(--color-accent-red)')}
                  </div>
                </div>

                <div className="emerging-row-item">
                  <div className="emerging-row-details">
                    <span className="emerging-row-name">Procurement Delays</span>
                    <span className="emerging-row-sub">18 projects</span>
                  </div>
                  <div className="emerging-row-value-spark">
                    <span className="emerging-val font-orange">+17%</span>
                    {renderSparkline('M 2 12 C 15 15, 25 2, 35 10 T 48 4', '#F59E0B')}
                  </div>
                </div>

                <div className="emerging-row-item">
                  <div className="emerging-row-details">
                    <span className="emerging-row-name">Clearance Delays</span>
                    <span className="emerging-row-sub">15 projects</span>
                  </div>
                  <div className="emerging-row-value-spark">
                    <span className="emerging-val font-orange">+14%</span>
                    {renderSparkline('M 2 15 C 10 10, 20 18, 30 8 T 48 2', '#F59E0B')}
                  </div>
                </div>

                <div className="emerging-row-item">
                  <div className="emerging-row-details">
                    <span className="emerging-row-name">Contractor Issues</span>
                    <span className="emerging-row-sub">12 projects</span>
                  </div>
                  <div className="emerging-row-value-spark">
                    <span className="emerging-val font-purple">+11%</span>
                    {renderSparkline('M 2 15 Q 12 12, 22 8 T 42 12 T 48 5', '#A855F7')}
                  </div>
                </div>

                <div className="emerging-row-item">
                  <div className="emerging-row-details">
                    <span className="emerging-row-name">Milestone Slippage</span>
                    <span className="emerging-row-sub">10 projects</span>
                  </div>
                  <div className="emerging-row-value-spark">
                    <span className="emerging-val font-blue">+7%</span>
                    {renderSparkline('M 2 15 C 15 15, 25 12, 35 12 T 48 8', 'var(--color-on-track)')}
                  </div>
                </div>
              </div>
            </div>

            {/* Col 2: Pattern Detection Accordions */}
            <div className="card column-card">
              <div className="column-card-header">
                <div>
                  <h2 className="card-title">Pattern Detection</h2>
                  <p className="card-subtitle">Active patterns detected across projects.</p>
                </div>
                <button className="card-link-btn">View All</button>
              </div>

              <div className="pattern-accordion-wrapper">
                {/* Panel 1 */}
                <div 
                  className={`pattern-panel ${expandedPattern === 0 ? 'expanded' : ''}`}
                  onClick={() => setExpandedPattern(expandedPattern === 0 ? null : 0)}
                >
                  <div className="panel-header">
                    <div className="panel-header-title">
                      High Expenditure + Low Progress = Milestone Slippage
                    </div>
                    <div className="panel-meta-row">
                      <span className="panel-status-tag font-red">High Risk</span>
                      <ChevronDown size={12} className="panel-arrow" />
                    </div>
                  </div>
                  <div className="panel-body">
                    12 projects affected. Average progress delay is 6.5 months across the sector. Immediate review advised.
                  </div>
                </div>

                {/* Panel 2 */}
                <div 
                  className={`pattern-panel ${expandedPattern === 1 ? 'expanded' : ''}`}
                  onClick={() => setExpandedPattern(expandedPattern === 1 ? null : 1)}
                >
                  <div className="panel-header">
                    <div className="panel-header-title">
                      Repeated Milestone Postponement = Contractor Performance Decline
                    </div>
                    <div className="panel-meta-row">
                      <span className="panel-status-tag font-orange">Medium Risk</span>
                      <ChevronDown size={12} className="panel-arrow" />
                    </div>
                  </div>
                  <div className="panel-body">
                    15 projects affected. Low output rates and resource constraints observed on sites.
                  </div>
                </div>

                {/* Panel 3 */}
                <div 
                  className={`pattern-panel ${expandedPattern === 2 ? 'expanded' : ''}`}
                  onClick={() => setExpandedPattern(expandedPattern === 2 ? null : 2)}
                >
                  <div className="panel-header">
                    <div className="panel-header-title">
                      Clearance Delays = Land Acquisition Issues
                    </div>
                    <div className="panel-meta-row">
                      <span className="panel-status-tag font-orange">Medium Risk</span>
                      <ChevronDown size={12} className="panel-arrow" />
                    </div>
                  </div>
                  <div className="panel-body">
                    10 projects affected. Delay correlation index stands at 82%. Environmental permissions pending.
                  </div>
                </div>
              </div>
            </div>

            {/* Col 3: Historical Similarity (Dark Navy Card) */}
            <div className="card column-card dark-navy-theme historical-card">
              <div className="column-card-header">
                <div>
                  <h2 className="card-title">Historical Similarity</h2>
                  <p className="card-subtitle">The project profile matches historical outcomes.</p>
                </div>
                <button className="card-link-btn">View All</button>
              </div>

              {/* White internal score card */}
              <div className="historical-score-sub-card">
                <div className="score-lbl">Similarity Score</div>
                <div className="score-number-group">
                  <span className="score-val">47</span>
                  <span className="score-max">/50</span>
                </div>
                <div className="score-desc">projects match this profile</div>
              </div>

              {/* Outcomes Row with circles */}
              <div className="historical-outcomes-section">
                <h4 className="section-small-title">HISTORICAL OUTCOMES</h4>
                <div className="similarity-circles-row">
                  {renderSimilarityCircle(82, 'Cost Overrun', 'cost')}
                  {renderSimilarityCircle(90, 'Schedule Delay', 'schedule')}
                  {renderSimilarityCircle(31, 'On Hold', 'onhold')}
                </div>
              </div>

              <div className="historical-warning-footer">
                <Check size={14} className="historical-check-icon" />
                <p className="historical-footer-text">
                  {getSimilarityFooterText()}
                </p>
              </div>
            </div>

            {/* Col 4: Predictive Insights */}
            <div className="card column-card">
              <div className="column-card-header">
                <div>
                  <h2 className="card-title">Predictive Insights</h2>
                  <p className="card-subtitle">AI powered forecasts and predictions.</p>
                </div>
                <button className="card-link-btn">View All</button>
              </div>

              <div className="predictive-rows-stack">
                <div className="predictive-row-item">
                  <div className="pred-icon-wrapper blue-glow">
                    <TrendingUp size={14} color="var(--color-on-track)" />
                  </div>
                  <div className="pred-details">
                    <span className="pred-lbl">Projects Entering Risk Zone</span>
                    <span className="pred-val font-red">412 projects</span>
                  </div>
                  <span className="pred-variance-pct font-red">+23%</span>
                </div>

                <div className="predictive-row-item">
                  <div className="pred-icon-wrapper orange-glow">
                    <Clock size={14} color="#D97706" />
                  </div>
                  <div className="pred-details">
                    <span className="pred-lbl">Expected Delay (Portfolio)</span>
                    <span className="pred-val font-red">5.2 months</span>
                  </div>
                  <span className="pred-variance-pct font-red">+12%</span>
                </div>

                <div className="predictive-row-item">
                  <div className="pred-icon-wrapper purple-glow">
                    <BarChart3 size={14} color="#A855F7" />
                  </div>
                  <div className="pred-details">
                    <span className="pred-lbl">Potential Cost Overrun</span>
                    <span className="pred-val font-red">₹12,458 Cr</span>
                  </div>
                  <span className="pred-variance-pct font-red">+18%</span>
                </div>

                <div className="predictive-row-item action-row" onClick={() => alert('Simulating scenarios...')}>
                  <div className="pred-icon-wrapper grey-glow">
                    <Layers size={14} color="var(--navy-dark)" />
                  </div>
                  <div className="pred-details">
                    <span className="pred-lbl">Risk Mitigation Scenarios</span>
                    <span className="pred-val">3 active scenarios</span>
                  </div>
                  <ChevronRight size={14} className="pred-arrow-right" />
                </div>
              </div>
            </div>
          </div>

          {/* Row 3: Key Insights by Sector & Risk Driver Analysis */}
          <div className="insights-row-bottom-split">
            {/* Sector Insights */}
            <div className="card sector-insights-card">
              <div className="sector-header">
                <div>
                  <h2 className="card-title">Key Insights by Sector</h2>
                  <p className="card-subtitle">Sector-wise performance and AI generated insights.</p>
                </div>
                <button className="card-link-btn">View All</button>
              </div>

              <div className="sector-sub-cards-row">
                {/* Card 1 */}
                <div className="sector-box">
                  <h4 className="sector-box-title">Transport</h4>
                  <div className="sector-box-lbl font-red">High risk sector</div>
                  <div className="sector-box-pct font-red">+26%</div>
                  <div className="sector-box-desc">26 projects affected</div>
                </div>

                {/* Card 2 */}
                <div className="sector-box">
                  <h4 className="sector-box-title">Railways</h4>
                  <div className="sector-box-lbl font-orange">Common patterns</div>
                  <div className="sector-box-pct font-orange">+18%</div>
                  <div className="sector-box-desc">18 projects affected</div>
                </div>

                {/* Card 3 */}
                <div className="sector-box">
                  <h4 className="sector-box-title">Power</h4>
                  <div className="sector-box-lbl font-orange">Compliance issues</div>
                  <div className="sector-box-pct font-orange">+15%</div>
                  <div className="sector-box-desc">15 projects affected</div>
                </div>

                {/* Card 4 */}
                <div className="sector-box">
                  <h4 className="sector-box-title">Water</h4>
                  <div className="sector-box-lbl font-blue">Common bottlenecks</div>
                  <div className="sector-box-pct font-blue">+12%</div>
                  <div className="sector-box-desc">12 projects affected</div>
                </div>

                {/* Card 5 */}
                <div className="sector-box">
                  <h4 className="sector-box-title">Urban Dev.</h4>
                  <div className="sector-box-lbl font-blue">Land acquisition delays</div>
                  <div className="sector-box-pct font-blue">+11%</div>
                  <div className="sector-box-desc">11 projects affected</div>
                </div>
              </div>
            </div>

            {/* Risk Driver Analysis */}
            <div className="card risk-driver-card light-blue-bg">
              <div className="risk-driver-header">
                <h2 className="card-title">Risk Driver Analysis</h2>
                <p className="card-subtitle">What's driving risk across the portfolio</p>
              </div>

              <div className="driver-analysis-split-content">
                {/* Left progress lists */}
                <div className="driver-bars-list">
                  <div className="driver-bar-item">
                    <div className="driver-bar-header">
                      <span className="driver-bar-lbl">Physical Progress</span>
                      <span className="driver-bar-pct">55%</span>
                    </div>
                    <div className="driver-track-full">
                      <div className="driver-filled bg-accent" style={{ width: mounted ? '55%' : '0%', transition: 'width 0.7s cubic-bezier(0.16, 1, 0.3, 1) 0.1s' }}></div>
                    </div>
                  </div>

                  <div className="driver-bar-item">
                    <div className="driver-bar-header">
                      <span className="driver-bar-lbl">Milestone Slippage</span>
                      <span className="driver-bar-pct">60%</span>
                    </div>
                    <div className="driver-track-full">
                      <div className="driver-filled bg-accent" style={{ width: mounted ? '60%' : '0%', transition: 'width 0.7s cubic-bezier(0.16, 1, 0.3, 1) 0.2s' }}></div>
                    </div>
                  </div>

                  <div className="driver-bar-item">
                    <div className="driver-bar-header">
                      <span className="driver-bar-lbl">Fund Flow Delays</span>
                      <span className="driver-bar-pct">38%</span>
                    </div>
                    <div className="driver-track-full">
                      <div className="driver-filled bg-orange" style={{ width: mounted ? '38%' : '0%', transition: 'width 0.7s cubic-bezier(0.16, 1, 0.3, 1) 0.3s' }}></div>
                    </div>
                  </div>

                  <div className="driver-bar-item">
                    <div className="driver-bar-header">
                      <span className="driver-bar-lbl">Clearance Delays</span>
                      <span className="driver-bar-pct">18%</span>
                    </div>
                    <div className="driver-track-full">
                      <div className="driver-filled bg-info" style={{ width: mounted ? '18%' : '0%', transition: 'width 0.7s cubic-bezier(0.16, 1, 0.3, 1) 0.4s' }}></div>
                    </div>
                  </div>

                  <div className="driver-bar-item">
                    <div className="driver-bar-header">
                      <span className="driver-bar-lbl">Contractor Performance</span>
                      <span className="driver-bar-pct">15%</span>
                    </div>
                    <div className="driver-track-full">
                      <div className="driver-filled bg-info" style={{ width: mounted ? '15%' : '0%', transition: 'width 0.7s cubic-bezier(0.16, 1, 0.3, 1) 0.5s' }}></div>
                    </div>
                  </div>
                </div>

                {/* Right Takeaway sub-card */}
                <div className="driver-takeaway-sub-card">
                  <div className="takeaway-header">
                    <HelpCircle size={14} className="takeaway-icon" />
                    <span>My Takeaway</span>
                  </div>
                  <p className="takeaway-body-text">
                    Physical progress lag and milestone slippages represent the leading drivers of risk across the portfolio.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div style={{ padding: '80px 20px', textAlign: 'center', backgroundColor: '#FFFFFF', borderRadius: '16px', border: '1px dashed #CBD5E1', marginTop: '20px' }}>
          <h2 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--navy-dark)' }}>
            {subTabs.find(t => t.id === activeSubTab)?.label} Details
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '13px', marginTop: '8px' }}>
            This sub-tab details and reports will render here.
          </p>
        </div>
      )}
    </div>
  );
};
