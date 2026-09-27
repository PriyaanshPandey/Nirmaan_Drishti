import React, { useState } from 'react';
import {
  Activity, CheckCircle2, BrainCircuit,
  Sliders, ShieldAlert, Car, Sparkles, ArrowRight, Check
} from 'lucide-react';
import {
  ComposedChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer
} from 'recharts';
import './FidelityIndexDemo.css';

export const FidelityIndexDemo: React.FC = () => {
  // ── Simulator Interactive State ──
  const [remainingWork, setRemainingWork] = useState<number>(40); // %
  const [monthsLeft, setMonthsLeft] = useState<number>(2); // months
  const [historicalSpeed, setHistoricalSpeed] = useState<number>(2.0); // % / month
  const [expenditureVelocity, setExpenditureVelocity] = useState<number>(45); // ₹ Cr / month
  const [threeMonthPhysicalDelta, setThreeMonthPhysicalDelta] = useState<number>(0); // %

  // ── Calculations ──
  const requiredSpeed = Number((remainingWork / Math.max(0.5, monthsLeft)).toFixed(1));
  const vdf = Number((requiredSpeed / Math.max(0.1, historicalSpeed)).toFixed(2));
  const isGhostProgress = threeMonthPhysicalDelta === 0 && expenditureVelocity > 0;

  // VDF Risk Rating
  let vdfStatus: { label: string; tier: 'normal' | 'stress' | 'improbable'; color: string; bg: string; desc: string } = {
    label: 'Normal Pacing',
    tier: 'normal',
    color: '#16a34a',
    bg: '#dcfce7',
    desc: 'Project speed matches its reported commitments. Low risk of timeline inflation.'
  };

  if (vdf > 2.5) {
    vdfStatus = {
      label: "Statistically Improbable Target ('Hockey Stick' Lie)",
      tier: 'improbable',
      color: '#dc2626',
      bg: '#fee2e2',
      desc: `Agency claims a ${(vdf * 100).toFixed(0)}% speed explosion without additional budget or resource allocation. Physically improbable.`
    };
  } else if (vdf > 1.2) {
    vdfStatus = {
      label: 'Pacing Stress',
      tier: 'stress',
      color: '#d97706',
      bg: '#fef3c7',
      desc: 'Requires double the manpower, machinery, or budget to achieve on-time completion.'
    };
  }

  // Live Chart Data for Simulator
  const chartData = [
    { month: 'Month T-3', actualSpeed: historicalSpeed, claimedSpeed: historicalSpeed },
    { month: 'Month T-2', actualSpeed: historicalSpeed + 0.2, claimedSpeed: historicalSpeed + 0.2 },
    { month: 'Month T-1', actualSpeed: historicalSpeed - 0.1, claimedSpeed: historicalSpeed - 0.1 },
    { month: 'Month T (Today)', actualSpeed: historicalSpeed, claimedSpeed: historicalSpeed },
    { month: 'Month T+1 (Claim)', actualSpeed: null, claimedSpeed: requiredSpeed },
    { month: 'Month T+2 (Target)', actualSpeed: null, claimedSpeed: requiredSpeed },
  ];

  // Sample Audit Projects
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
      {/* ── 1. Top Header Banner ─────────────────────────────────── */}
      <div className="fidelity-header">
        <div className="fidelity-header-badge">
          <Sparkles size={14} /> SIH 2026 INNOVATION DEMO 1
        </div>
        <h1 className="fidelity-title">
          Reporting Fidelity Index <span className="highlight-text">(Catching Ghost-Progress)</span>
        </h1>
        <p className="fidelity-subtitle">
          Detecting the <strong>"Hockey Stick"</strong> reporting illusion and <strong>Capital Drain without Ground Output</strong> across MoSPI PAIMANA infrastructure datasets.
        </p>
        <div className="fidelity-meta">
          <span>Team NavDrishti (Sanket-AI)</span> • <span>MoSPI PAIMANA Infrastructure Intelligence (SIH26103)</span>
        </div>
      </div>

      {/* ── 2. Beginner Analogy Card ─────────────────────────────── */}
      <div className="analogy-card">
        <div className="analogy-header">
          <div className="analogy-icon"><Car size={24} /></div>
          <div>
            <h3>The Beginner Analogy: The "100 km/h" Impossibility</h3>
            <p className="analogy-sub">Understanding Velocity Disconnect in Simple Physical Terms</p>
          </div>
        </div>
        <div className="analogy-body">
          <div className="analogy-scenario">
            <div className="scenario-item">
              <span className="step-label">Current Situation</span>
              <p>Driving 100 km away. Pacing at <strong>10 km/h</strong> for the last 3 hours.</p>
            </div>
            <div className="scenario-arrow">&rarr;</div>
            <div className="scenario-item">
              <span className="step-label">Claim with 30 mins left</span>
              <p>"Don't worry, I will still arrive on time!"</p>
            </div>
            <div className="scenario-arrow">&rarr;</div>
            <div className="scenario-item danger">
              <span className="step-label">Physical Reality</span>
              <p>Requires driving at <strong>200 km/h</strong> without a faster car! <strong>(Implausible "Hockey Stick")</strong></p>
            </div>
          </div>
        </div>
      </div>

      {/* ── 3. Interactive VDF & Ghost-Progress Live Simulator ──── */}
      <div className="simulator-section">
        <div className="section-title-box">
          <Sliders size={20} className="text-blue" />
          <h2>Live VDF &amp; Ghost-Progress Audit Simulator</h2>
          <span className="live-tag">Interactive Judge Playground</span>
        </div>

        <div className="simulator-grid">
          {/* Controls Panel */}
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

          {/* Real-time Results Output */}
          <div className="sim-results-card">
            <h3>Calculated Reporting Fidelity Index</h3>

            {/* VDF Score Pill */}
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

            {/* Formula Breakdown */}
            <div className="formula-box">
              <div className="formula-row">
                <span>Required Speed to Finish On-Time:</span>
                <strong>{remainingWork}% ÷ {monthsLeft}m = {requiredSpeed}%/month</strong>
              </div>
              <div className="formula-row">
                <span>Historical Realized Speed (3-mo avg):</span>
                <strong>{historicalSpeed}%/month</strong>
              </div>
              <div className="formula-row highlight">
                <span>Velocity Disconnect Factor (VDF):</span>
                <strong>{requiredSpeed} ÷ {historicalSpeed} = {vdf}x</strong>
              </div>
            </div>

            {/* Ghost Progress Alert Banner */}
            <div className={`ghost-alert-card ${isGhostProgress ? 'active-ghost' : 'clear-ghost'}`}>
              <div className="ghost-alert-icon">
                {isGhostProgress ? <ShieldAlert size={24} color="#dc2626" /> : <CheckCircle2 size={24} color="#16a34a" />}
              </div>
              <div>
                <h4 style={{ color: isGhostProgress ? '#dc2626' : '#16a34a' }}>
                  {isGhostProgress ? '⚠️ GHOST-PROGRESS AUDIT ALERT' : '✅ GROUND OUTPUT VERIFIED'}
                </h4>
                <p>
                  {isGhostProgress
                    ? `Physical progress is 0% over past 3 months while ₹${expenditureVelocity} Cr/month is being spent! Flagged: Capital Drain without Ground Output.`
                    : 'Financial expenditure aligns with reported physical progress on the ground.'}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Live Chart Comparison */}
        <div className="sim-chart-card">
          <h4>Visualizing the "Hockey Stick" Claim vs Realized Speed</h4>
          <div style={{ width: '100%', height: 260 }}>
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={chartData} margin={{ top: 10, right: 10, bottom: 10, left: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                <XAxis dataKey="month" stroke="#64748B" fontSize={12} />
                <YAxis stroke="#64748B" fontSize={12} unit="%/m" />
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: 13 }} />
                <Line type="monotone" dataKey="actualSpeed" name="Historical Realized Speed (%/mo)" stroke="#0284C7" strokeWidth={3} dot={{ r: 5 }} />
                <Line type="monotone" dataKey="claimedSpeed" name="Required Speed to Meet Claim (%/mo)" stroke="#DC2626" strokeWidth={3} strokeDasharray="6 6" dot={{ r: 5 }} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* ── 4. Self-Supervised ML Hindsight Truth Pipeline ───────── */}
      <div className="hindsight-section">
        <div className="section-title-box">
          <BrainCircuit size={20} className="text-purple" />
          <h2>Hindsight Truth: Self-Supervised AI Learning</h2>
          <span className="purple-tag">No Manual Human Labels Needed</span>
        </div>

        <p className="hindsight-desc">
          Because our historical PAIMANA CSV dataset spans <strong>2011 to 2026</strong>, the system automatically checks reported claims at Month <strong>T</strong> against actual ground outcomes 6 months later at Month <strong>T+6</strong>.
        </p>

        <div className="pipeline-steps-grid">
          <div className="step-card">
            <div className="step-num">1</div>
            <h4>Month T Claim</h4>
            <p>Agency files PAIMANA report claiming target completion date and progress velocity.</p>
          </div>
          <div className="step-arrow"><ArrowRight size={20} /></div>

          <div className="step-card">
            <div className="step-num">2</div>
            <h4>Look-Forward T+6</h4>
            <p>AI engine inspects the CSV 6 months ahead in time to evaluate actual realized progress.</p>
          </div>
          <div className="step-arrow"><ArrowRight size={20} /></div>

          <div className="step-card">
            <div className="step-num">3</div>
            <h4>Auto-Labeling</h4>
            <p>If actual progress &lt; 40% of claimed speed, automatically set <code>Strategic_Underreporting = 1</code>.</p>
          </div>
          <div className="step-arrow"><ArrowRight size={20} /></div>

          <div className="step-card highlight-purple">
            <div className="step-num">4</div>
            <h4>Model Training</h4>
            <p>XGBoost/LightGBM learns patterns of habitual underreporting without needing manual human labels!</p>
          </div>
        </div>
      </div>

      {/* ── 5. Real PAIMANA Sample Audit Table ────────────────────── */}
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
                <th>Hist Speed</th>
                <th>Calculated VDF</th>
                <th>VDF Classification</th>
                <th>Ghost Progress Audit</th>
              </tr>
            </thead>
            <tbody>
              {auditProjects.map((p) => (
                <tr key={p.id}>
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
                      <span className="badge-danger">🔴 Improbable ('Hockey Stick')</span>
                    )}
                    {p.status === 'stress' && (
                      <span className="badge-warning">🟡 Pacing Stress (2x)</span>
                    )}
                    {p.status === 'normal' && (
                      <span className="badge-success">🟢 Normal Pacing</span>
                    )}
                  </td>
                  <td>
                    {p.ghostProgress ? (
                      <span className="ghost-badge alert">
                        ⚠️ Ghost Progress (₹{p.expenditureSpent}Cr spent, 0% progress)
                      </span>
                    ) : (
                      <span className="ghost-badge ok">
                        <Check size={12} /> Verified Output
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
