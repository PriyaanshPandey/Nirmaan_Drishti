import React, { useState } from 'react';
import {
  Sliders, ShieldAlert, CheckCircle2, Check, Activity
} from 'lucide-react';
import {
  ComposedChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer
} from 'recharts';
import { InfoButton } from './ExplainabilityInfo';
import './FidelityIndexDemo.css';

export const FidelityIndexDemo: React.FC = () => {
  // ── Simulator State ──
  const [remainingWork, setRemainingWork] = useState<number>(40); // %
  const [monthsLeft, setMonthsLeft] = useState<number>(2); // months
  const [historicalSpeed, setHistoricalSpeed] = useState<number>(2.0); // % / month
  const [expenditureVelocity, setExpenditureVelocity] = useState<number>(45); // ₹ Cr / month
  const [threeMonthPhysicalDelta, setThreeMonthPhysicalDelta] = useState<number>(0); // %

  // ── Calculations ──
  const requiredSpeed = Number((remainingWork / Math.max(0.5, monthsLeft)).toFixed(1));
  const vdf = Number((requiredSpeed / Math.max(0.1, historicalSpeed)).toFixed(2));
  const isGhostProgress = threeMonthPhysicalDelta === 0 && expenditureVelocity > 0;

  // VDF Risk Rating & Assessment
  let vdfStatus: { label: string; tier: 'normal' | 'stress' | 'improbable'; color: string; bg: string; desc: string } = {
    label: 'Normal Pacing',
    tier: 'normal',
    color: '#16a34a',
    bg: '#dcfce7',
    desc: 'Reported progress speed matches historical execution velocity. Low risk of reporting disconnect.'
  };

  if (vdf > 2.5) {
    vdfStatus = {
      label: 'Statistically Improbable Trajectory (Reporting Velocity Inconsistency)',
      tier: 'improbable',
      color: '#dc2626',
      bg: '#fee2e2',
      desc: `Reported timeline requires a ${(vdf * 100).toFixed(0)}% execution speed explosion without additional budget or resource allocation.`
    };
  } else if (vdf > 1.2) {
    vdfStatus = {
      label: 'Accelerated Pacing Stress',
      tier: 'stress',
      color: '#d97706',
      bg: '#fef3c7',
      desc: 'Requires double the workforce or financial throughput to achieve on-time completion.'
    };
  }

  // Live Chart Data for Simulator
  const chartData = [
    { month: 'Month T-3', actualSpeed: historicalSpeed, claimedSpeed: historicalSpeed },
    { month: 'Month T-2', actualSpeed: historicalSpeed + 0.2, claimedSpeed: historicalSpeed + 0.2 },
    { month: 'Month T-1', actualSpeed: historicalSpeed - 0.1, claimedSpeed: historicalSpeed - 0.1 },
    { month: 'Month T (Current)', actualSpeed: historicalSpeed, claimedSpeed: historicalSpeed },
    { month: 'Month T+1 (Claimed)', actualSpeed: null, claimedSpeed: requiredSpeed },
    { month: 'Month T+2 (Target)', actualSpeed: null, claimedSpeed: requiredSpeed },
  ];

  // Sample PAIMANA Audit Projects
  const auditProjects = [
    {
      id: 'NHAI-JK-4402',
      name: 'Ramban to Banihal NH-44 4-Laning',
      agency: 'NHAI',
      remainingWork: 42,
      monthsLeft: 3,
      histSpeed: 1.8,
      vdf: 7.78,
      status: 'improbable',
      ghostProgress: true,
      expenditureSpent: 82.5,
      physicalDelta: 0,
    },
    {
      id: 'MOR-JK-9912',
      name: 'Udhampur-Srinagar-Baramulla Rail Link',
      agency: 'Indian Railways',
      remainingWork: 28,
      monthsLeft: 8,
      histSpeed: 2.1,
      vdf: 1.67,
      status: 'stress',
      ghostProgress: false,
      expenditureSpent: 45.0,
      physicalDelta: 3.2,
    },
    {
      id: 'MMRDA-MH-0301',
      name: 'Mumbai Metro Line 3 Underground',
      agency: 'MMRDA',
      remainingWork: 12,
      monthsLeft: 10,
      histSpeed: 1.4,
      vdf: 0.86,
      status: 'normal',
      ghostProgress: false,
      expenditureSpent: 18.2,
      physicalDelta: 2.8,
    },
    {
      id: 'PMRDA-MH-0104',
      name: 'Pune Metro Line 1 Extension',
      agency: 'PMRDA',
      remainingWork: 55,
      monthsLeft: 4,
      histSpeed: 2.5,
      vdf: 5.50,
      status: 'improbable',
      ghostProgress: true,
      expenditureSpent: 64.0,
      physicalDelta: 0,
    }
  ];

  return (
    <div className="fidelity-page-container">
      {/* ── Main Simulator Section ─────────────────────────────── */}
      <div className="simulator-section">
        <div className="section-title-box">
          <div className="title-left-group">
            <Sliders size={20} className="text-blue" />
            <h2>Reporting Fidelity Index &amp; Ground Output Assessment</h2>
            
            {/* Info Button for Math & Internal Calculation Methodology */}
            <InfoButton
              title="Velocity Disconnect Factor (VDF) Methodology"
              summary="VDF measures the statistical ratio between required physical progress rate to meet reported target dates versus actual 3-month historical execution velocity."
              dataSummary={{
                items: [
                  { label: 'Required Completion Rate', value: `${remainingWork}% ÷ ${monthsLeft}m = ${requiredSpeed}%/month` },
                  { label: 'Historical Speed (3-mo avg)', value: `${historicalSpeed}%/month` },
                  { label: 'Velocity Disconnect Factor', value: `${requiredSpeed} ÷ ${historicalSpeed} = ${vdf}x` },
                  { label: 'Evaluation Tier', value: vdfStatus.label }
                ],
                insight: 'A VDF > 2.5x flags a statistically improbable pacing curve where claimed completion velocity exceeds 250% of historical capability without additional budget allocation.'
              }}
              theme="light"
            />
          </div>
        </div>

        <div className="simulator-grid">
          {/* Left Column: Input Parameters */}
          <div className="sim-controls-card">
            <h3>Adjust Project Report Parameters</h3>
            
            <div className="control-group">
              <label>
                <span>Remaining Work: <strong>{remainingWork}%</strong></span>
              </label>
              <input
                type="range"
                min="5"
                max="90"
                value={remainingWork}
                onChange={(e) => setRemainingWork(Number(e.target.value))}
              />
            </div>

            <div className="control-group">
              <label>
                <span>Months Left to Target Date: <strong>{monthsLeft} months</strong></span>
              </label>
              <input
                type="range"
                min="1"
                max="24"
                value={monthsLeft}
                onChange={(e) => setMonthsLeft(Number(e.target.value))}
              />
            </div>

            <div className="control-group">
              <label>
                <span>Historical 3-Month Speed: <strong>{historicalSpeed}% / month</strong></span>
              </label>
              <input
                type="range"
                min="0.5"
                max="10"
                step="0.1"
                value={historicalSpeed}
                onChange={(e) => setHistoricalSpeed(Number(e.target.value))}
              />
            </div>

            <div className="control-group">
              <label>
                <span>Expenditure Velocity: <strong>₹{expenditureVelocity} Cr / month</strong></span>
              </label>
              <input
                type="range"
                min="0"
                max="200"
                value={expenditureVelocity}
                onChange={(e) => setExpenditureVelocity(Number(e.target.value))}
              />
            </div>

            <div className="control-group">
              <label>
                <span>Physical Progress Delta (Past 3 Months): <strong>{threeMonthPhysicalDelta}%</strong></span>
              </label>
              <div className="toggle-btn-group">
                <button
                  type="button"
                  className={threeMonthPhysicalDelta === 0 ? 'active danger' : ''}
                  onClick={() => setThreeMonthPhysicalDelta(0)}
                >
                  0% (Stagnant Ground Output)
                </button>
                <button
                  type="button"
                  className={threeMonthPhysicalDelta > 0 ? 'active success' : ''}
                  onClick={() => setThreeMonthPhysicalDelta(4.5)}
                >
                  4.5% (Active Output)
                </button>
              </div>
            </div>
          </div>

          {/* Right Column: Calculated Result */}
          <div className="sim-results-card">
            <h3>Calculated Reporting Fidelity Index</h3>

            {/* VDF Score Box */}
            <div className="vdf-score-box" style={{ backgroundColor: vdfStatus.bg, borderColor: vdfStatus.color }}>
              <div className="vdf-score-value" style={{ color: vdfStatus.color }}>
                {vdf}x
              </div>
              <div className="vdf-score-meta">
                <span className="vdf-badge-label" style={{ backgroundColor: vdfStatus.color }}>
                  {vdfStatus.label}
                </span>
                <p className="vdf-score-desc">{vdfStatus.desc}</p>
              </div>
            </div>

            {/* Capital Outlay Consistency Alert */}
            <div className={`ghost-alert-card ${isGhostProgress ? 'active-ghost' : 'clear-ghost'}`}>
              <div className="ghost-alert-icon">
                {isGhostProgress ? <ShieldAlert size={24} color="#dc2626" /> : <CheckCircle2 size={24} color="#16a34a" />}
              </div>
              <div>
                <h4 style={{ color: isGhostProgress ? '#dc2626' : '#16a34a' }}>
                  {isGhostProgress ? '⚠️ EXPENDITURE-PROGRESS INCONSISTENCY FLAGGED' : '✅ EXPENDITURE-PROGRESS CONSISTENT'}
                </h4>
                <p>
                  {isGhostProgress
                    ? `Zero physical progress reported over past 3 months while ₹${expenditureVelocity} Cr/month is being disbursed. Flagged for inaccuracy review: Capital outlay without verifiable ground output.`
                    : 'Reported financial disbursement is consistent with physical progress recorded on the ground.'}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Chart Comparison */}
        <div className="sim-chart-card">
          <h4>Reported Completion Trajectory vs Realized Historical Pacing</h4>
          <div style={{ width: '100%', height: 260 }}>
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={chartData} margin={{ top: 10, right: 10, bottom: 10, left: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                <XAxis dataKey="month" stroke="#64748B" fontSize={12} />
                <YAxis stroke="#64748B" fontSize={12} unit="%/m" />
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: 13 }} />
                <Line type="monotone" dataKey="actualSpeed" name="Historical Realized Speed (%/mo)" stroke="#0284C7" strokeWidth={3} dot={{ r: 5 }} />
                <Line type="monotone" dataKey="claimedSpeed" name="Required Speed for Reported Target (%/mo)" stroke="#DC2626" strokeWidth={3} strokeDasharray="6 6" dot={{ r: 5 }} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* ── PAIMANA Sample Audit Table ────────────────────── */}
      <div className="audit-table-section">
        <div className="section-title-box">
          <Activity size={20} className="text-teal" />
          <h2>PAIMANA Projects Live Reporting Fidelity Audit</h2>
        </div>

        <div className="table-responsive">
          <table className="fidelity-table">
            <thead>
              <tr>
                <th>Project ID &amp; Name</th>
                <th>Agency</th>
                <th>Work Left</th>
                <th>Time Left</th>
                <th>Hist. Speed</th>
                <th>VDF</th>
                <th>Pacing Assessment</th>
                <th>Reporting Status</th>
                <th>Expenditure–Progress Consistency</th>
              </tr>
            </thead>
            <tbody>
              {auditProjects.map((p) => {
                const isInconsistent = p.status === 'improbable' || p.ghostProgress;
                return (
                  <tr key={p.id} className={isInconsistent ? 'row-inconsistent' : 'row-consistent'}>
                    <td>
                      <div className="proj-name-cell">
                        <strong>{p.name}</strong>
                        <span className="proj-id">{p.id}</span>
                      </div>
                    </td>
                    <td><span className="agency-badge">{p.agency}</span></td>
                    <td>{p.remainingWork}%</td>
                    <td>{p.monthsLeft} mos</td>
                    <td>{p.histSpeed}%/m</td>
                    <td>
                      <strong className="vdf-val-tag" style={{ color: p.vdf > 2.5 ? '#dc2626' : p.vdf > 1.2 ? '#d97706' : '#16a34a' }}>
                        {p.vdf}x
                      </strong>
                    </td>
                    <td>
                      {p.status === 'improbable' && (
                        <span className="badge-danger">Velocity Inconsistency</span>
                      )}
                      {p.status === 'stress' && (
                        <span className="badge-warning">Accelerated Pacing Stress</span>
                      )}
                      {p.status === 'normal' && (
                        <span className="badge-success">Normal Pacing</span>
                      )}
                    </td>
                    <td>
                      {isInconsistent ? (
                        <span className="status-inconsistent">⛔ INCONSISTENT</span>
                      ) : (
                        <span className="status-consistent">✅ CONSISTENT</span>
                      )}
                    </td>
                    <td>
                      {p.ghostProgress ? (
                        <span className="expend-flag alert">
                          ⚠️ ₹{p.expenditureSpent}Cr disbursed — 0% physical output
                        </span>
                      ) : (
                        <span className="expend-flag ok">
                          <Check size={12} /> Expenditure Aligned
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
