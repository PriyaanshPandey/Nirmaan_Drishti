import React, { useState, useEffect } from 'react';
import {
  Download, Search, ShieldAlert, AlertTriangle, Clock,
  IndianRupee, ChevronDown, Sparkles, Activity, BarChart3
} from 'lucide-react';
import './ActionCenter.css';
import { AnimatedCounter } from './AnimatedCounter';
import { api } from '../services/api';

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
  const [selectedSimCategory, setSelectedSimCategory] = useState<string>('land');
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

  const currentSim = simulatorData[selectedSimCategory] || simulatorData.land || Object.values(simulatorData)[0] || {
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
        return <span className="action-tag tag-critical">Critical</span>;
      case 'High':
        return <span className="action-tag tag-high">High</span>;
      case 'Medium':
        return <span className="action-tag tag-medium">Medium</span>;
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
          <h1 className="ac-page-title">Action Centre</h1>
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
                <h2 className="ac-title">Action Queue Status</h2>
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
                  <div className="sev-icon-wrap icon-crit-wrap">
                    <ShieldAlert size={16} />
                  </div>
                  <span className="sev-lbl">Critical</span>
                  <span className="sev-count">
                    <AnimatedCounter value={summaryCounts.critical} triggerKey={summaryCounts.critical} />
                  </span>
                  <span className="sev-sub">Immediate PMG Review</span>
                </div>

                <div className="sev-box box-high">
                  <div className="sev-icon-wrap icon-high-wrap">
                    <AlertTriangle size={16} />
                  </div>
                  <span className="sev-lbl">High</span>
                  <span className="sev-count">
                    <AnimatedCounter value={summaryCounts.high} triggerKey={summaryCounts.high} />
                  </span>
                  <span className="sev-sub">Ministry Escalation</span>
                </div>

                <div className="sev-box box-med">
                  <div className="sev-icon-wrap icon-med-wrap">
                    <Clock size={16} />
                  </div>
                  <span className="sev-lbl">Medium</span>
                  <span className="sev-count">
                    <AnimatedCounter value={summaryCounts.medium} triggerKey={summaryCounts.medium} />
                  </span>
                  <span className="sev-sub">Agency Level NOC</span>
                </div>
              </div>

              {/* Stacked Proportional Severity Distribution Bar */}
              <div className="ac-severity-bar-track">
                <div
                  className="sev-seg seg-crit"
                  style={{ width: `${(summaryCounts.critical / (summaryCounts.critical + summaryCounts.high + summaryCounts.medium)) * 100}%` }}
                  title={`Critical: ${summaryCounts.critical}`}
                />
                <div
                  className="sev-seg seg-high"
                  style={{ width: `${(summaryCounts.high / (summaryCounts.critical + summaryCounts.high + summaryCounts.medium)) * 100}%` }}
                  title={`High: ${summaryCounts.high}`}
                />
                <div
                  className="sev-seg seg-med"
                  style={{ width: `${(summaryCounts.medium / (summaryCounts.critical + summaryCounts.high + summaryCounts.medium)) * 100}%` }}
                  title={`Medium: ${summaryCounts.medium}`}
                />
              </div>

              {/* Exposure Highlights Banner */}
              <div className="ac-exposure-banner">
                <div className="exp-item exp-item-financial">
                  <div className="exp-icon-wrap icon-red-tint">
                    <IndianRupee size={15} />
                  </div>
                  <div className="exp-text-wrap">
                    <span className="exp-lbl">Financial Exposure</span>
                    <span className="exp-val exp-red">{summaryCounts.totalExp}</span>
                  </div>
                </div>
                <div className="exp-divider" />
                <div className="exp-item exp-item-delay">
                  <div className="exp-icon-wrap icon-amber-tint">
                    <Clock size={15} />
                  </div>
                  <div className="exp-text-wrap">
                    <span className="exp-lbl">Avg Delay Exposure</span>
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
                <h2 className="ac-title">Resolution Simulator</h2>
                <p className="ac-subtitle">Counterfactual scenario projection</p>
              </div>
            </div>
            <span className="ac-head-pill pill-ai-active">
              <span className="ai-spark-dot" />
              {currentSim.confidence}% Confidence
            </span>
          </div>

          <div className="sim-dropdown-wrapper">
            <label className="sim-field-lbl">Simulate Resolution Strategy</label>
            <div className="sim-select-container">
              <select 
                value={selectedSimCategory} 
                onChange={(e) => setSelectedSimCategory(e.target.value)}
                className="sim-custom-select"
              >
                <option value="land">Land Acquisition (ROW Acceleration)</option>
                <option value="procurement">Procurement (Expedited Tendership)</option>
                <option value="contractor">Contractor Defaults (Subcontract Fast-track)</option>
                <option value="milestone">Milestone Slippage (Overtime Mobilization)</option>
                <option value="clearance">Clearance Delays (Statutory Green Channel)</option>
              </select>
              <ChevronDown size={15} className="sim-select-arrow" />
            </div>
          </div>

          {/* 2 Comparison Impact Cards (Delay vs Cost) */}
          <div className="sim-impact-grid">
            {/* Delay Impact Card */}
            <div className="sim-impact-card impact-card-delay">
              <div className="impact-top">
                <span className="impact-tag">DELAY REDUCTION</span>
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
                <span className="impact-tag">FINANCIAL RECOVERY</span>
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
                <h2 className="ac-title">Prioritization Weights</h2>
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
            >
              All Actions ({actionItems.length})
            </button>
            <button 
              className={`ac-tab-btn ${activeFilterTab === 'critical' ? 'active' : ''}`}
              onClick={() => setActiveFilterTab('critical')}
            >
              Critical ({summaryCounts?.critical ?? '...'})
            </button>
            <button 
              className={`ac-tab-btn ${activeFilterTab === 'high' ? 'active' : ''}`}
              onClick={() => setActiveFilterTab('high')}
            >
              High ({summaryCounts?.high ?? '...'})
            </button>
            <button 
              className={`ac-tab-btn ${activeFilterTab === 'medium' ? 'active' : ''}`}
              onClick={() => setActiveFilterTab('medium')}
            >
              Medium ({summaryCounts?.medium ?? '...'})
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
                  <th className="th-proj">PROJECT & MINISTRY</th>
                  <th className="th-risk-event">RISK EVENT</th>
                  <th className="th-sev">SEVERITY</th>
                  <th className="th-score">SCORE</th>
                  <th className="th-fin">FIN. EXPOSURE</th>
                  <th className="th-delay">DELAY EXPOSURE</th>
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
                        <span className={`status-pill pill-${item.status.toLowerCase().replace(' ', '-')}`}>
                          {item.status}
                        </span>
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
