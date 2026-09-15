import React, { useState, useEffect } from 'react';
import {
  Download, Search, ShieldAlert, AlertTriangle, Clock,
  IndianRupee, ChevronDown, Sparkles, Activity, BarChart3
} from 'lucide-react';
import './ActionCenter.css';
import { AnimatedCounter } from './AnimatedCounter';
import { api } from '../services/api';
import { StatusIndicator } from './StatusIndicator';
import { InfoButton } from './ExplainabilityInfo';

interface ActionItem {
  project: string;
  projectId: string;
  ministry: string;
  riskEvent: string;
  severity: 'Critical' | 'High' | 'Medium';
  priorityScore: number;
  financialExposure: string;
  delayExposure: string;
  overdue: string;
  dueDate: string;
  status: 'Open' | 'In Progress' | 'Pending';
}

interface SimulatorScenario {
  currentDelay: string;
  currentCost: string;
  projDelay: string;
  projDelayReduction: string;
  projSaving: string;
  confidence: number;
}

interface ActionCenterProps {
  onSelectProject: (projectId: string) => void;
  onNavigateTab?: (tab: string) => void;
}

export const ActionCenter: React.FC<ActionCenterProps> = ({ onSelectProject }) => {
  const [activeFilterTab, setActiveFilterTab] = useState<'all' | 'critical' | 'high' | 'medium'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSimCategory, setSelectedSimCategory] = useState<string>('milestone');
  const [mounted, setMounted] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  const [summaryCounts, setSummaryCounts] = useState<{
    critical: number;
    high: number;
    medium: number;
    totalExp: string;
    avgDelay: string;
  } | null>(null);

  const [simulatorData, setSimulatorData] = useState<Record<string, SimulatorScenario>>({});
  const [weightData, setWeightData] = useState<Array<{ label: string; pct: number; color: string }>>([]);
  const [actionItems, setActionItems] = useState<ActionItem[]>([]);

  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 80);
    api.getActionCenterSummary().then((res) => {
      if (res && res.action_items && res.action_items.length > 0) {
        setSummaryCounts({
          critical: res.critical_count,
          high: res.high_count,
          medium: res.medium_count,
          totalExp: res.total_financial_exposure_formatted,
          avgDelay: res.total_delay_exposure_formatted,
        });
        setActionItems(res.action_items);
        // Wire simulator scenarios from backend
        if (res.simulator_scenarios && Object.keys(res.simulator_scenarios).length > 0) {
          const mapped: Record<string, SimulatorScenario> = {};
          Object.entries(res.simulator_scenarios).forEach(([key, s]: [string, any]) => {
            mapped[key] = {
              currentDelay: s.currentDelay,
              currentCost: s.currentCost,
              projDelay: s.projDelay,
              projDelayReduction: s.projDelayReduction,
              projSaving: s.projSaving,
              confidence: s.confidence,
            };
          });
          setSimulatorData(mapped);
        }
        // Wire prioritization weights from backend
        if (res.prioritization_weights && res.prioritization_weights.length > 0) {
          setWeightData(res.prioritization_weights.map((w: any) => ({
            label: w.label,
            pct: w.pct,
            color: w.color,
          })));
        }
      }
    });
    return () => clearTimeout(t);
  }, []);

  const currentSim = simulatorData[selectedSimCategory] || simulatorData.milestone || Object.values(simulatorData)[0] || {
    currentDelay: '—', currentCost: '—', projDelay: '—', projDelayReduction: '—', projSaving: '—', confidence: 0
  };

  const weights = weightData;

  // Filtering list by tabs & search
  const filteredItems = actionItems.filter((item) => {
    const matchesSearch = 
      item.project.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.riskEvent.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.ministry.toLowerCase().includes(searchQuery.toLowerCase());
      
    const matchesTab = 
      activeFilterTab === 'all' || 
      item.severity.toLowerCase() === activeFilterTab;

    return matchesSearch && matchesTab;
  });

  const getSeverityBadge = (sev: ActionItem['severity']) => {
    switch (sev) {
      case 'Critical':
        return <StatusIndicator kind="critical" label="CRITICAL" className="action-tag tag-critical" />;
      case 'High':
        return <StatusIndicator kind="high" label="HIGH RISK" className="action-tag tag-high" />;
      case 'Medium':
        return <StatusIndicator kind="medium" label="MEDIUM RISK" className="action-tag tag-medium" />;
    }
  };

  const handleExport = async () => {
    try {
      setIsExporting(true);
      await api.exportActionPlan();
    } catch (err) {
      console.error('Failed to export action plan:', err);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="action-center-container animation-fade-in">
      {/* Top Header */}
      <div className="action-center-header">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <h1 className="ac-page-title">Action Centre</h1>
            <InfoButton
              title="Action Centre Hub"
              summary="Centralized operational console to triage, prioritize, simulate, and resolve execution bottlenecks across high-risk national infrastructure projects."
              size="md"
            />
          </div>
          <p className="ac-page-subtitle">Prioritized interventions and resolution simulations for critical infrastructure.</p>
        </div>
        <button 
          className="ac-export-btn" 
          onClick={handleExport}
          disabled={isExporting}
          style={{ opacity: isExporting ? 0.75 : 1, cursor: isExporting ? 'wait' : 'pointer' }}
        >
          <Download size={14} />
          <span>{isExporting ? 'Exporting...' : 'Export Action Plan'}</span>
        </button>
      </div>

      {/* Row 1: 3 Column Dashboard Layout */}
      <div className="action-top-row-grid">
        {/* Col 1: Action Queue Card */}
        <div className="card ac-card-summary">
          <div className="ac-card-head">
            <div className="ac-head-left">
              <div className="ac-head-icon-chip chip-red">
                <Activity size={18} color="#DC2626" />
              </div>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <h2 className="ac-title">Action Queue Status</h2>
                  <InfoButton
                    title="Action Queue Status"
                    summary="Live inventory of critical infrastructure projects requiring active intervention, segmented by urgency tier."
                    size="sm"
                  />
                </div>
                <p className="ac-subtitle">Active interventions by urgency tier</p>
              </div>
            </div>
            {summaryCounts && (
              <span className="ac-head-pill pill-total-tasks">
                {summaryCounts.critical + summaryCounts.high + summaryCounts.medium} Tasks
              </span>
            )}
          </div>

          {!summaryCounts ? (
            <div className="ac-loading-placeholder">Loading action queue...</div>
          ) : (
            <>
              {/* 3 Severity Cards */}
              <div className="ac-severity-boxes">
                <div className="sev-box box-crit">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                    <div className="sev-icon-wrap icon-crit-wrap">
                      <ShieldAlert size={16} />
                    </div>
                    <InfoButton
                      title="Critical Urgency Tier"
                      summary="Projects facing >12 months delay or severe cost escalation, requiring immediate Cabinet or PMG fast-track intervention."
                      size="sm"
                    />
                  </div>
                  <StatusIndicator kind="critical" label="CRITICAL" className="sev-lbl" />
                  <span className="sev-count">
                    <AnimatedCounter value={summaryCounts.critical} triggerKey={summaryCounts.critical} />
                  </span>
                  <span className="sev-sub">Immediate PMG Review</span>
                </div>

                <div className="sev-box box-high">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                    <div className="sev-icon-wrap icon-high-wrap">
                      <AlertTriangle size={16} />
                    </div>
                    <InfoButton
                      title="High Urgency Tier"
                      summary="Projects experiencing substantial milestone deviations or budget growth needing Secretary or Ministry-level escalation."
                      size="sm"
                    />
                  </div>
                  <StatusIndicator kind="high" label="HIGH RISK" className="sev-lbl" />
                  <span className="sev-count">
                    <AnimatedCounter value={summaryCounts.high} triggerKey={summaryCounts.high} />
                  </span>
                  <span className="sev-sub">Ministry Escalation</span>
                </div>

                <div className="sev-box box-med">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                    <div className="sev-icon-wrap icon-med-wrap">
                      <Clock size={16} />
                    </div>
                    <InfoButton
                      title="Medium Urgency Tier"
                      summary="Projects with early warning signals or moderate deviations manageable at the implementing agency or zonal level."
                      size="sm"
                    />
                  </div>
                  <StatusIndicator kind="medium" label="MEDIUM RISK" className="sev-lbl" />
                  <span className="sev-count">
                    <AnimatedCounter value={summaryCounts.medium} triggerKey={summaryCounts.medium} />
                  </span>
                  <span className="sev-sub">Agency Level Review</span>
                </div>
              </div>

              {/* Stacked Proportional Severity Distribution Bar */}
              <div className="ac-severity-bar-track">
                <div
                  className="sev-seg seg-crit"
                  style={{ width: `${(summaryCounts.critical / (summaryCounts.critical + summaryCounts.high + summaryCounts.medium)) * 100}%` }}
                  title={`Critical: ${summaryCounts.critical}`}
                ><span className="sr-only">CRITICAL: {summaryCounts.critical}</span></div>
                <div
                  className="sev-seg seg-high"
                  style={{ width: `${(summaryCounts.high / (summaryCounts.critical + summaryCounts.high + summaryCounts.medium)) * 100}%` }}
                  title={`High: ${summaryCounts.high}`}
                ><span className="sr-only">HIGH RISK: {summaryCounts.high}</span></div>
                <div
                  className="sev-seg seg-med"
                  style={{ width: `${(summaryCounts.medium / (summaryCounts.critical + summaryCounts.high + summaryCounts.medium)) * 100}%` }}
                  title={`Medium: ${summaryCounts.medium}`}
                ><span className="sr-only">MEDIUM RISK: {summaryCounts.medium}</span></div>
              </div>

              {/* Exposure Highlights Banner */}
              <div className="ac-exposure-banner">
                <div className="exp-item exp-item-financial">
                  <div className="exp-icon-wrap icon-red-tint">
                    <IndianRupee size={15} />
                  </div>
                  <div className="exp-text-wrap">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <span className="exp-lbl">Financial Exposure</span>
                      <InfoButton
                        title="Total Financial Exposure"
                        summary="Aggregated capital at risk and cost escalation across all projects currently in the intervention queue."
                        size="sm"
                      />
                    </div>
                    <span className="exp-val exp-red">{summaryCounts.totalExp}</span>
                  </div>
                </div>
                <div className="exp-divider" />
                <div className="exp-item exp-item-delay">
                  <div className="exp-icon-wrap icon-amber-tint">
                    <Clock size={15} />
                  </div>
                  <div className="exp-text-wrap">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <span className="exp-lbl">Avg Delay Exposure</span>
                      <InfoButton
                        title="Average Delay Exposure"
                        summary="Average completion schedule delay across all projects needing administrative action."
                        size="sm"
                      />
                    </div>
                    <span className="exp-val exp-orange">{summaryCounts.avgDelay}</span>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Col 2: Resolution Simulator */}
        <div className="card ac-card-simulator">
          <div className="ac-card-head">
            <div className="ac-head-left">
              <div className="ac-head-icon-chip chip-blue">
                <Sparkles size={18} color="#2563EB" />
              </div>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                  <h2 className="ac-title">Resolution Simulator</h2>
                  <InfoButton
                    title="Resolution Simulator (Under Development)"
                    summary="Future expansion: Counterfactual scenario modeling engine predicting how targeted administrative interventions reduce delay months and recover financial exposure (Illustrative Demo)."
                    size="sm"
                  />
                </div>
                <p className="ac-subtitle">Counterfactual scenario projection</p>
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
              <span className="ac-head-pill pill-ai-active">
                <span className="ai-spark-dot" />
                {currentSim.confidence}% Confidence
              </span>
              <span style={{
                fontSize: '9.5px',
                fontWeight: 800,
                color: '#B45309',
                backgroundColor: '#FEF3C7',
                border: '1px solid #FDE68A',
                padding: '2px 6px',
                borderRadius: '4px',
                textTransform: 'uppercase',
                letterSpacing: '0.4px',
                whiteSpace: 'nowrap'
              }}>
                Under Development • Illustration
              </span>
            </div>
          </div>

          {/* Under Development Notice Banner */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '8px 12px',
            backgroundColor: '#FFFBEB',
            border: '1px dashed #F59E0B',
            borderRadius: '8px',
            marginBottom: '12px',
            fontSize: '11.5px',
            color: '#92400E',
            lineHeight: 1.4
          }}>
            <span style={{ fontWeight: 800, whiteSpace: 'nowrap' }}>FUTURE EXPANSION:</span>
            <span>Counterfactual intervention simulation is under active development for illustration and what-if policy exploration.</span>
          </div>

          <div className="sim-dropdown-wrapper">
            <label className="sim-field-lbl">Simulate Resolution Strategy</label>
            <div className="sim-select-container">
              <select 
                value={selectedSimCategory} 
                onChange={(e) => setSelectedSimCategory(e.target.value)}
                className="sim-custom-select"
              >
                <option value="milestone">Milestone Slippage (Fast-Tracking &amp; Expedited Mobilization)</option>
                <option value="financial">Financial Outlay Divergence (Reconciliation &amp; Fund Release)</option>
                <option value="cost">Cost Escalation Controls (Value Engineering &amp; Scope Review)</option>
                <option value="stagnation">Work Pacing &amp; Physical Progress Acceleration</option>
                <option value="schedule">Schedule Baseline Realignment</option>
              </select>
              <ChevronDown size={15} className="sim-select-arrow" />
            </div>
          </div>

          {/* 2 Comparison Impact Cards (Delay vs Cost) */}
          <div className="sim-impact-grid">
            {/* Delay Impact Card */}
            <div className="sim-impact-card impact-card-delay">
              <div className="impact-top">
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span className="impact-tag">DELAY REDUCTION</span>
                  <InfoButton
                    title="Delay Reduction Impact"
                    summary="Estimated schedule compression achieved by deploying this targeted resolution policy."
                    size="sm"
                  />
                </div>
                <span className="impact-pill pill-green">▼ {currentSim.projDelayReduction}</span>
              </div>
              <div className="impact-numbers-row">
                <div className="impact-col">
                  <span className="impact-lbl">Baseline</span>
                  <span className="impact-val val-muted">{currentSim.currentDelay}</span>
                </div>
                <div className="impact-arrow">→</div>
                <div className="impact-col">
                  <span className="impact-lbl">Post-Action</span>
                  <span className="impact-val val-blue">{currentSim.projDelay}</span>
                </div>
              </div>
              <div className="impact-bar-track">
                <div className="impact-bar-fill fill-blue" style={{ width: '50%' }} />
              </div>
            </div>

            {/* Cost Impact Card */}
            <div className="sim-impact-card impact-card-cost">
              <div className="impact-top">
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span className="impact-tag">FINANCIAL RECOVERY</span>
                  <InfoButton
                    title="Financial Recovery Impact"
                    summary="Estimated monetary savings achieved by halting delay penalties and inflationary project cost overruns."
                    size="sm"
                  />
                </div>
                <span className="impact-pill pill-emerald">Saved Exposure</span>
              </div>
              <div className="impact-numbers-row">
                <div className="impact-col">
                  <span className="impact-lbl">Cost Risk</span>
                  <span className="impact-val val-muted">{currentSim.currentCost}</span>
                </div>
                <div className="impact-arrow">→</div>
                <div className="impact-col">
                  <span className="impact-lbl">Est. Savings</span>
                  <span className="impact-val val-green">{currentSim.projSaving}</span>
                </div>
              </div>
              <div className="impact-bar-track">
                <div className="impact-bar-fill fill-green" style={{ width: '51.4%' }} />
              </div>
            </div>
          </div>

          {/* Bottom AI Confidence Metric */}
          <div className="sim-confidence-footer">
            <div className="conf-meta">
              <span className="conf-lbl">AI Model Verification Confidence</span>
              <span className="conf-score-tag">{currentSim.confidence}% Validated</span>
            </div>
            <div className="conf-bar-track">
              <div
                className="conf-bar-fill"
                style={{ width: `${currentSim.confidence}%` }}
              />
            </div>
          </div>
        </div>

        {/* Col 3: Prioritization Weights */}
        <div className="card ac-card-weights">
          <div className="ac-card-head">
            <div className="ac-head-left">
              <div className="ac-head-icon-chip chip-purple">
                <BarChart3 size={18} color="#7C3AED" />
              </div>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <h2 className="ac-title">Prioritization Weights</h2>
                  <InfoButton
                    title="Prioritization Scoring Weights"
                    summary="Multi-criteria weights calibrated against national risk severity, financial exposure, delay months, and dependency criticality."
                    size="sm"
                  />
                </div>
                <p className="ac-subtitle">Scoring model configuration</p>
              </div>
            </div>
            <span className="ac-head-pill pill-calibrated">
              Active Model
            </span>
          </div>

          <div className="weights-list">
            {weights.map((w, idx) => (
              <div key={idx} className="weight-item">
                <div className="weight-meta">
                  <div className="weight-label-wrap">
                    <span className="weight-rank">{idx + 1}</span>
                    <span className="weight-label">{w.label}</span>
                  </div>
                  <span className="weight-pct-badge" style={{ color: w.color }}>
                    {w.pct}%
                  </span>
                </div>
                <div className="weight-bar-bg">
                  <div 
                    className="weight-bar-fill" 
                    style={{ 
                      width: mounted ? `${w.pct}%` : '0%', 
                      background: `linear-gradient(90deg, ${w.color}CC 0%, ${w.color} 100%)`,
                      boxShadow: `0 0 10px ${w.color}33`,
                      transition: `width 0.7s cubic-bezier(0.16, 1, 0.3, 1) ${idx * 0.08}s` 
                    }}
                  />
                </div>
              </div>
            ))}
          </div>

          {/* Scale Axis */}
          <div className="weights-scale-axis">
            <span>0%</span>
            <span>25%</span>
            <span>50%</span>
            <span>75%</span>
            <span>100%</span>
          </div>
        </div>
      </div>

      {/* Row 2: Filter and Action Table */}
      <div className="action-table-section">
        <div className="action-table-controls">
          <div className="action-tabs-group">
            <button 
              className={`ac-tab-btn ${activeFilterTab === 'all' ? 'active' : ''}`}
              onClick={() => setActiveFilterTab('all')}
              aria-selected={activeFilterTab === 'all'}
              role="tab"
            >
              All Actions ({actionItems.length})
            </button>
            <button 
              className={`ac-tab-btn ${activeFilterTab === 'critical' ? 'active' : ''}`}
              onClick={() => setActiveFilterTab('critical')}
              aria-selected={activeFilterTab === 'critical'}
              role="tab"
            >
              <StatusIndicator kind="critical" label={`CRITICAL (${summaryCounts?.critical ?? '...'})`} />
            </button>
            <button 
              className={`ac-tab-btn ${activeFilterTab === 'high' ? 'active' : ''}`}
              onClick={() => setActiveFilterTab('high')}
              aria-selected={activeFilterTab === 'high'}
              role="tab"
            >
              <StatusIndicator kind="high" label={`HIGH RISK (${summaryCounts?.high ?? '...'})`} />
            </button>
            <button 
              className={`ac-tab-btn ${activeFilterTab === 'medium' ? 'active' : ''}`}
              onClick={() => setActiveFilterTab('medium')}
              aria-selected={activeFilterTab === 'medium'}
              role="tab"
            >
              <StatusIndicator kind="medium" label={`MEDIUM RISK (${summaryCounts?.medium ?? '...'})`} />
            </button>
          </div>

          <div className="ac-search-input-wrapper">
            <Search size={15} className="ac-search-icon" />
            <input 
              type="text" 
              placeholder="Search actions by project or category..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="ac-search-input"
            />
          </div>
        </div>

        {/* The Action Items Table */}
        <div className="card ac-table-card">
          <div className="table-responsive">
            <table className="ac-data-table">
              <thead>
                <tr>
                  <th className="th-proj">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <span>PROJECT &amp; MINISTRY</span>
                      <InfoButton title="Project & Ministry" summary="Identified national project and its supervising central ministry." size="sm" />
                    </div>
                  </th>
                  <th className="th-risk-event">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <span>RISK EVENT</span>
                      <InfoButton title="Risk Event Trigger" summary="Primary operational bottleneck diagnosed from live progress and milestone telemetry." size="sm" />
                    </div>
                  </th>
                  <th className="th-sev">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <span>SEVERITY</span>
                      <InfoButton title="Urgency Severity" summary="Assigned intervention level: Critical (Immediate PMG), High (Ministry), or Medium (Agency)." size="sm" />
                    </div>
                  </th>
                  <th className="th-score">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <span>SCORE</span>
                      <InfoButton title="Priority Urgency Score" summary="Composite 0–100 urgency score calculated from weighted delay, cost, and progress parameters." size="sm" />
                    </div>
                  </th>
                  <th className="th-fin">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <span>FIN. EXPOSURE</span>
                      <InfoButton title="Financial Exposure" summary="Total cost escalation or capital outlay currently exposed to delay risks." size="sm" />
                    </div>
                  </th>
                  <th className="th-delay">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <span>DELAY EXPOSURE</span>
                      <InfoButton title="Delay Exposure" summary="Months elapsed past the approved baseline commissioning date." size="sm" />
                    </div>
                  </th>
                  <th className="th-due">DUE DATE</th>
                  <th className="th-status">STATUS</th>
                  <th className="th-act">ACTION</th>
                </tr>
              </thead>
              <tbody>
                {filteredItems.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="empty-table-msg">
                      No actions match the selected filter.
                    </td>
                  </tr>
                ) : (
                  filteredItems.map((item, idx) => (
                    <tr key={idx} className="ac-table-row">
                      <td className="td-proj">
                        <div className="p-title">{item.project}</div>
                        <div className="p-sub">{item.ministry}</div>
                      </td>
                      <td className="td-risk-event">
                        <span className="risk-event-badge">{item.riskEvent}</span>
                      </td>
                      <td className="td-sev">{getSeverityBadge(item.severity)}</td>
                      <td className="td-score">
                        <span className="priority-score-badge">{item.priorityScore}</span>
                      </td>
                      <td className="td-fin">{item.financialExposure}</td>
                      <td className="td-delay">{item.delayExposure}</td>
                      <td className="td-due">{item.dueDate}</td>
                      <td className="td-status">
                        <StatusIndicator
                          kind={item.status === 'Open' ? 'high' : item.status === 'In Progress' ? 'medium' : 'low'}
                          label={item.status.toUpperCase()}
                          className={`status-pill pill-${item.status.toLowerCase().replace(' ', '-')}`}
                        />
                      </td>
                      <td className="td-act">
                        <button 
                          className="ac-open-btn"
                          onClick={() => onSelectProject(item.projectId)}
                        >
                          Resolve
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};
