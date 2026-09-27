import React, { useState, useEffect, useMemo } from 'react';
import { TrendingUp, RefreshCw, Calendar, Database, Table as TableIcon } from 'lucide-react';
import { InfoButton } from './ExplainabilityInfo';
import { SnapshotsTableModal } from './SnapshotsTableModal';
import type { Project } from '../data/projectsData';
import { api, type ProjectTimelinePoint } from '../services/api';
import {
  ComposedChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine
} from 'recharts';
import './HistoricalTimelineChart.css';

interface HistoricalTimelineChartProps {
  project: Project;
}

type TimeRangeOption = 'ALL' | '5Y' | '2Y' | '1Y';

export const HistoricalTimelineChart: React.FC<HistoricalTimelineChartProps> = ({ project }) => {
  const [animate, setAnimate] = useState<boolean>(true);
  const [loading, setLoading] = useState<boolean>(true);
  const [timelineData, setTimelineData] = useState<ProjectTimelinePoint[]>([]);
  const [totalSnapshots, setTotalSnapshots] = useState<number>(0);
  const [latestReportMonth, setLatestReportMonth] = useState<string>('');
  const [showSnapshotsModal, setShowSnapshotsModal] = useState<boolean>(false);
  const [timeRange, setTimeRange] = useState<TimeRangeOption>('ALL');

  const replayAnimation = () => {
    setAnimate(false);
    setTimeout(() => setAnimate(true), 50);
  };

  useEffect(() => {
    let isMounted = true;
    setLoading(true);

    api.getProjectTimeline(project.id)
      .then((res) => {
        if (!isMounted) return;
        setTimelineData(res.timeline || []);
        setTotalSnapshots(res.total_snapshots || res.timeline?.length || 0);
        setLatestReportMonth(res.latest_snapshot_month || '');
        setLoading(false);
        replayAnimation();
      })
      .catch((err) => {
        console.warn('Failed to fetch timeline from backend:', err);
        if (!isMounted) return;
        setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [project.id]);

  const originalCost = (project as any).costOriginal || (project as any).originalCost || 1200;
  const currentCost = project.costRevised || originalCost;

  // Find the boundary between actual historical records and forward forecast
  const lastHistoricalIndex = timelineData.reduce((lastIdx, pt, idx) => {
    return pt.is_historical !== false && (pt.physical !== null || pt.expenditure !== null) ? idx : lastIdx;
  }, -1);

  const hasFuturePredictions = lastHistoricalIndex >= 0 && lastHistoricalIndex < timelineData.length - 1;

  const referenceMonth = lastHistoricalIndex >= 0 && timelineData[lastHistoricalIndex]
    ? timelineData[lastHistoricalIndex].period
    : latestReportMonth || (timelineData.length > 0 ? timelineData[0].period : 'Latest Snapshot');

  // Compute sliced display data based on selected time range
  const displayData = useMemo(() => {
    if (timeRange === 'ALL' || timelineData.length <= 15) {
      return timelineData;
    }
    const cutoffMonths = timeRange === '5Y' ? 60 : timeRange === '2Y' ? 24 : 12;
    const baseIndex = lastHistoricalIndex >= 0 ? lastHistoricalIndex : timelineData.length - 1;
    const startIndex = Math.max(0, baseIndex - cutoffMonths + 1);
    return timelineData.slice(startIndex);
  }, [timelineData, timeRange, lastHistoricalIndex]);

  const showReferenceLine = referenceMonth && hasFuturePredictions && displayData.some(d => d.period === referenceMonth);

  const displayStatus = 
    project.status === 'completed' || project.projectStatus === 'COMPLETED' ? 'Completed'
    : project.status === 'inactive' || project.projectStatus === 'INACTIVE' ? 'Ongoing Inactive'
    : 'Ongoing Active';

  return (
    <div className="historical-timeline-section" id="section-timeline">
      <div className="timeline-section-header">
        <div className="timeline-title-group">
          <div className="timeline-icon-box">
            <TrendingUp size={20} color="#38bdf8" />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <h2 className="timeline-title">Historical Project Timeline & Trajectory</h2>
              {totalSnapshots > 0 && (
                <span style={{
                  fontSize: '0.72rem',
                  fontWeight: 600,
                  padding: '2px 8px',
                  borderRadius: '12px',
                  background: 'rgba(56, 189, 248, 0.1)',
                  color: '#0284C7',
                  border: '1px solid rgba(56, 189, 248, 0.25)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px'
                }}>
                  <Database size={11} /> {totalSnapshots} Monthly Snapshots
                </span>
              )}
            </div>
            <p className="timeline-subtitle">
              Verified Monthly PAIMANA Snapshots (Historical) & ML Model Predictions (Future): Physical Progress %, Total Revised Cost %, and Cumulative Expenditure %
            </p>
          </div>
        </div>

        <div className="timeline-controls">
          {timelineData.length > 20 && (
            <div className="timeline-range-selector">
              <button
                type="button"
                className={`range-pill ${timeRange === 'ALL' ? 'active' : ''}`}
                onClick={() => setTimeRange('ALL')}
                title="View full project lifetime trajectory"
              >
                All ({timelineData.length})
              </button>
              {timelineData.length > 60 && (
                <button
                  type="button"
                  className={`range-pill ${timeRange === '5Y' ? 'active' : ''}`}
                  onClick={() => setTimeRange('5Y')}
                  title="View last 5 years"
                >
                  5Y
                </button>
              )}
              {timelineData.length > 24 && (
                <button
                  type="button"
                  className={`range-pill ${timeRange === '2Y' ? 'active' : ''}`}
                  onClick={() => setTimeRange('2Y')}
                  title="View last 2 years"
                >
                  2Y
                </button>
              )}
              {timelineData.length > 12 && (
                <button
                  type="button"
                  className={`range-pill ${timeRange === '1Y' ? 'active' : ''}`}
                  onClick={() => setTimeRange('1Y')}
                  title="View last 12 months"
                >
                  1Y
                </button>
              )}
            </div>
          )}

          <button
            type="button"
            className="view-snapshots-btn"
            onClick={() => setShowSnapshotsModal(true)}
            title="Open comprehensive table of all project monthly snapshots"
          >
            <TableIcon size={14} /> View Snapshots Table
          </button>

          <button
            type="button"
            className="replay-anim-btn"
            onClick={replayAnimation}
            title="Replay chart live draw animation"
          >
            <RefreshCw size={14} /> Replay Graph
          </button>

          <InfoButton
            title="Historical Timeline & Progress vs Expenditure"
            summary="Tracks monthly physical progress, total revised cost percentage, and cumulative expenditure percentage over the project lifecycle directly from authoritative PAIMANA monthly reporting snapshots, seamlessly extending into future ML model predictions."
            dataSummary={{
              items: [
                { label: 'Classification', value: displayStatus },
                { label: 'Total Snapshots', value: `${totalSnapshots} monthly records` },
                { label: 'Latest Valid Snapshot', value: latestReportMonth || referenceMonth || 'Recorded' },
                { label: 'Current Physical Progress', value: `${project.progressPhysical || 0}%` },
                { label: 'Original Cost', value: `₹${Number(originalCost).toLocaleString()} Cr` },
                { label: 'Revised Cost', value: `₹${Number(currentCost).toLocaleString()} Cr` },
                { label: 'Forecast Delay', value: `+${(project as any).delayMonths || project.timeOverrunMonths || 0} Months` }
              ],
              insight: 'Comparing Physical Progress %, Total Revised Cost %, and Cumulative Expenditure % on a unified percentage scale reveals cost escalation and financial velocity relative to physical milestone completion without visual distortion.'
            }}
            theme="light"
          />
        </div>
      </div>

      <div className="recharts-container" style={{ width: '100%', height: 450, backgroundColor: '#FFFFFF', borderRadius: '12px', padding: '24px', border: '1px solid #E2E8F0', boxShadow: '0 4px 6px -1px rgba(15, 23, 42, 0.05)', position: 'relative' }}>
        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#64748B', gap: '12px' }}>
            <RefreshCw size={28} className="animate-spin" style={{ color: '#0284C7' }} />
            <span style={{ fontSize: '0.9rem', fontWeight: 500 }}>Loading verified monthly PAIMANA snapshots...</span>
          </div>
        ) : timelineData.length === 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#64748B', gap: '8px' }}>
            <Calendar size={32} style={{ color: '#94A3B8' }} />
            <span style={{ fontSize: '0.95rem', fontWeight: 600 }}>No monthly snapshots found for this project.</span>
            <span style={{ fontSize: '0.8rem', color: '#94A3B8' }}>Inception and baseline milestone metrics are tracked in the Project Details summary.</span>
          </div>
        ) : animate && (
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={displayData} margin={{ top: 20, right: 30, bottom: 20, left: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
              <XAxis 
                dataKey="period" 
                stroke="#94A3B8" 
                tick={{ fill: '#64748B', fontSize: 12, fontWeight: 500 }} 
                tickMargin={12} 
                minTickGap={28}
                interval="preserveEnd"
              />
              <YAxis 
                stroke="#94A3B8" 
                tick={{ fill: '#64748B', fontSize: 12, fontWeight: 500 }} 
                tickFormatter={(val) => `${val}%`}
                label={{ value: 'Percentage (%)', angle: -90, position: 'insideLeft', fill: '#475569', fontWeight: 600 }} 
                domain={[0, (dataMax: number) => Math.max(100, Math.ceil(Number(dataMax || 100) / 10) * 10)]} 
              />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: '#FFFFFF', 
                  borderColor: '#E2E8F0', 
                  borderRadius: '10px', 
                  color: '#0F172A', 
                  boxShadow: '0 10px 25px -5px rgba(15, 23, 42, 0.1)', 
                  padding: '12px 16px' 
                }}
                itemStyle={{ fontWeight: 500, fontSize: '13px' }}
                labelStyle={{ color: '#475569', fontWeight: 700, marginBottom: '8px', borderBottom: '1px solid #F1F5F9', paddingBottom: '4px' }}
                formatter={(value: any, name: string, item: any) => {
                  if (value === null || value === undefined) {
                    return ['Not Reported / Missing', name];
                  }
                  const valNum = Number(value);
                  let extra = '';
                  if (name.includes('Revised Cost') && item?.payload?.revised_cost_cr != null) {
                    extra = ` (₹${Number(item.payload.revised_cost_cr).toLocaleString()} Cr)`;
                  } else if (name.includes('Expenditure') && item?.payload?.expenditure_cr != null) {
                    extra = ` (₹${Number(item.payload.expenditure_cr).toLocaleString()} Cr)`;
                  }
                  return [`${valNum.toFixed(1)}%${extra}`, name];
                }}
                labelFormatter={(label: string, items: any[]) => {
                  const payload = items?.[0]?.payload;
                  if (!payload) return label;
                  const isFuture = payload.is_historical === false;
                  return isFuture ? `${label} • [ML Model Prediction]` : `${label} • [Authoritative PAIMANA Snapshot]`;
                }}
              />
              <Legend 
                wrapperStyle={{ paddingTop: '24px', fontSize: '13px', fontWeight: 600, color: '#334155' }} 
                iconType="circle"
                formatter={(value) => <span style={{ color: '#475569', marginLeft: '4px', marginRight: '16px' }}>{value}</span>}
              />
              {showReferenceLine && (
                <ReferenceLine 
                  x={referenceMonth} 
                  stroke="#0284C7" 
                  strokeDasharray="4 4" 
                  label={{ 
                    position: 'top', 
                    value: 'Model Prediction Horizon →', 
                    fill: '#0284C7', 
                    fontSize: 11, 
                    fontWeight: 600 
                  }} 
                />
              )}
              
              <Line 
                type="monotone" 
                dataKey="physical" 
                name="Physical Progress %" 
                stroke="#0284C7" 
                strokeWidth={3} 
                connectNulls={true}
                dot={displayData.length > 36 ? false : { r: 3, fill: '#FFFFFF', stroke: '#0284C7', strokeWidth: 2 }} 
                activeDot={{ r: 6 }}
                isAnimationActive={animate} 
                animationDuration={1500} 
                animationEasing="ease-out" 
              />
              <Line 
                type="monotone" 
                dataKey="revised_cost" 
                name="Total Revised Cost %" 
                stroke="#DC2626" 
                strokeWidth={3} 
                connectNulls={true}
                dot={displayData.length > 36 ? false : { r: 3, fill: '#FFFFFF', stroke: '#DC2626', strokeWidth: 2 }} 
                activeDot={{ r: 6 }}
                isAnimationActive={animate} 
                animationDuration={1500} 
                animationEasing="ease-out" 
              />
              <Line 
                type="monotone" 
                dataKey="expenditure" 
                name="Cumulative Expenditure %" 
                stroke="#F59E0B" 
                strokeWidth={3} 
                connectNulls={true}
                dot={displayData.length > 36 ? false : { r: 3, fill: '#FFFFFF', stroke: '#F59E0B', strokeWidth: 2 }} 
                activeDot={{ r: 6 }}
                isAnimationActive={animate} 
                animationDuration={1500} 
                animationEasing="ease-out" 
              />
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </div>

      <SnapshotsTableModal
        isOpen={showSnapshotsModal}
        onClose={() => setShowSnapshotsModal(false)}
        project={project}
        timelineData={timelineData}
        totalSnapshots={totalSnapshots}
      />
    </div>
  );
};
