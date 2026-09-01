import React, { useState, useEffect } from 'react';
import { TrendingUp, Clock } from 'lucide-react';
import './GlobalOverrunGraphs.css';
import { api } from '../services/api';
import { AnimatedCounter } from './AnimatedCounter';

export interface SectorOverrun {
  sector_name: string;
  total_projects: number;
  total_original_cost: number;
  total_revised_cost: number;
  total_cost_escalation: number;
  avg_cost_overrun_pct: number;
  delayed_projects_count: number;
  avg_delay_months: number;
  max_delay_months: number;
}

const DEFAULT_SECTORS: SectorOverrun[] = [
  { sector_name: 'Railways', total_projects: 420, total_original_cost: 650000, total_revised_cost: 820000, total_cost_escalation: 170000, avg_cost_overrun_pct: 26.2, delayed_projects_count: 210, avg_delay_months: 28.5, max_delay_months: 72 },
  { sector_name: 'Road Transport', total_projects: 980, total_original_cost: 920000, total_revised_cost: 1050000, total_cost_escalation: 130000, avg_cost_overrun_pct: 14.1, delayed_projects_count: 310, avg_delay_months: 18.2, max_delay_months: 48 },
  { sector_name: 'Petroleum & Gas', total_projects: 310, total_original_cost: 450000, total_revised_cost: 530000, total_cost_escalation: 80000, avg_cost_overrun_pct: 17.8, delayed_projects_count: 95, avg_delay_months: 15.0, max_delay_months: 36 },
  { sector_name: 'Power & Energy', total_projects: 450, total_original_cost: 510000, total_revised_cost: 585000, total_cost_escalation: 75000, avg_cost_overrun_pct: 14.7, delayed_projects_count: 140, avg_delay_months: 21.0, max_delay_months: 60 },
  { sector_name: 'Urban & Metro', total_projects: 180, total_original_cost: 380000, total_revised_cost: 440000, total_cost_escalation: 60000, avg_cost_overrun_pct: 15.8, delayed_projects_count: 75, avg_delay_months: 24.5, max_delay_months: 54 },
  { sector_name: 'Coal & Mining', total_projects: 220, total_original_cost: 180000, total_revised_cost: 210000, total_cost_escalation: 30000, avg_cost_overrun_pct: 16.7, delayed_projects_count: 80, avg_delay_months: 19.8, max_delay_months: 42 }
];

interface Svg3DCuboidProps {
  valText: string;
  heightPct: number;
  frontColor: string;
  topColor: string;
  sideColor: string;
  textColor: string;
  isHovered: boolean;
  mounted: boolean;
  sectorName: string;
  tooltipContent: { val: string; sub: string };
  onHover: (hovered: boolean) => void;
}

const Svg3DCuboidBar: React.FC<Svg3DCuboidProps> = ({
  valText,
  heightPct,
  frontColor,
  topColor,
  sideColor,
  textColor,
  isHovered,
  mounted,
  sectorName,
  tooltipContent,
  onHover
}) => {
  const chartHeight = 150;
  const barWidth = 32;
  const depthX = 10;
  const depthY = 8;
  const maxBarH = 115;
  const minBarH = 12;

  const actualBarH = Math.max(minBarH, (heightPct / 100) * maxBarH);
  const targetH = mounted ? actualBarH : 0;

  const bottomY = chartHeight;
  const topY = bottomY - targetH;

  return (
    <div
      className={`svg-bar-column ${isHovered ? 'bar-hovered' : ''}`}
      onMouseEnter={() => onHover(true)}
      onMouseLeave={() => onHover(false)}
    >
      {/* 3D Floating Tooltip */}
      {isHovered && (
        <div className="v-bar-3d-tooltip">
          <span className="tooltip-title">{sectorName}</span>
          <span className="tooltip-val" style={{ color: frontColor }}>{tooltipContent.val}</span>
          <span className="tooltip-sub">{tooltipContent.sub}</span>
        </div>
      )}

      {/* SVG Canvas for 100% Crisp 3D Cuboid */}
      <div className="svg-wrapper">
        <svg
          width="48"
          height="175"
          viewBox="0 0 48 175"
          className="iso-3d-svg"
        >
          {/* Top Value Tag */}
          <text
            x={barWidth / 2 + 2}
            y={Math.max(16, topY - 10)}
            textAnchor="middle"
            fontSize="11.5"
            fontWeight="850"
            fill={textColor}
            style={{ transition: 'y 1.4s cubic-bezier(0.16, 1, 0.3, 1)' }}
          >
            {valText}
          </text>

          {/* 3D Cuboid Pillar */}
          <g className="cuboid-group" style={{ transform: isHovered ? 'translateY(-3px)' : 'none', transition: 'transform 0.2s ease' }}>
            {/* Front Solid Face */}
            <polygon
              points={`2,${topY} ${2 + barWidth},${topY} ${2 + barWidth},${bottomY} 2,${bottomY}`}
              fill={frontColor}
              style={{ transition: 'points 1.4s cubic-bezier(0.16, 1, 0.3, 1), fill 0.2s ease' }}
            />

            {/* Top Cap Face */}
            <polygon
              points={`2,${topY} ${2 + depthX},${topY - depthY} ${2 + barWidth + depthX},${topY - depthY} ${2 + barWidth},${topY}`}
              fill={topColor}
              style={{ transition: 'points 1.4s cubic-bezier(0.16, 1, 0.3, 1), fill 0.2s ease' }}
            />

            {/* Right Side Shadow Face */}
            <polygon
              points={`${2 + barWidth},${topY} ${2 + barWidth + depthX},${topY - depthY} ${2 + barWidth + depthX},${bottomY - depthY} ${2 + barWidth},${bottomY}`}
              fill={sideColor}
              style={{ transition: 'points 1.4s cubic-bezier(0.16, 1, 0.3, 1), fill 0.2s ease' }}
            />
          </g>
        </svg>
      </div>

      {/* X-Axis Sector Label */}
      <span className="v-bar-sector-lbl" title={sectorName}>
        {sectorName.split(' ')[0]}
      </span>
    </div>
  );
};

interface GlobalOverrunGraphsProps {
  activeTab?: string;
}

export const GlobalOverrunGraphs: React.FC<GlobalOverrunGraphsProps> = ({ activeTab }) => {
  const [sectors, setSectors] = useState<SectorOverrun[]>(DEFAULT_SECTORS);
  const [mounted, setMounted] = useState<boolean>(false);
  const [hoveredCostIndex, setHoveredCostIndex] = useState<number | null>(null);
  const [hoveredTimeIndex, setHoveredTimeIndex] = useState<number | null>(null);

  useEffect(() => {
    let isMounted = true;

    // Reset height forming animation whenever tab changes back to dashboard
    setMounted(false);
    const t = setTimeout(() => setMounted(true), 100);

    api.getDashboardSummary().then((res) => {
      if (!isMounted) return;
      if (res && res.sector_overruns && res.sector_overruns.length > 0) {
        setSectors(res.sector_overruns);
      }
    }).catch(() => {
      // keep default sectors
    });

    return () => {
      isMounted = false;
      clearTimeout(t);
    };
  }, [activeTab]);

  const maxEscalation = Math.max(...sectors.map(s => s.total_cost_escalation), 1);
  const maxDelay = Math.max(...sectors.map(s => s.avg_delay_months), 1);

  const totalEscalationCrore = sectors.reduce((sum, s) => sum + s.total_cost_escalation, 0);
  const totalDelayedProjects = sectors.reduce((sum, s) => sum + s.delayed_projects_count, 0);

  return (
    <div className="global-overruns-grid-2">
      {/* Card 1 (Left): Global Cost Escalation (₹ Cr) */}
      <div className="card overrun-card-col">
        <div className="overrun-card-header">
          <div className="overrun-header-left">
            <div className="overrun-icon-circle icon-teal">
              <TrendingUp size={18} color="#0284C7" />
            </div>
            <div>
              <h2 className="card-title">Global Cost Escalation</h2>
              <p className="card-subtitle">Real cost drift by sector (₹ Crore)</p>
            </div>
          </div>
          <div className="metric-chip-pill chip-teal">
            <span className="chip-label">TOTAL COST DRIFT</span>
            <span className="chip-value">
              ₹<AnimatedCounter value={Math.round(totalEscalationCrore)} resetKey={activeTab} /> Cr
            </span>
          </div>
        </div>

        {/* Crisp SVG 3D Solid Bar Graph for Cost Escalation */}
        <div className="vertical-chart-area">
          <div className="v-bars-flex-container">
            {sectors.map((sec, idx) => {
              const heightPct = Math.min(100, Math.max(16, (sec.total_cost_escalation / maxEscalation) * 100));

              return (
                <Svg3DCuboidBar
                  key={sec.sector_name}
                  valText={`₹${(sec.total_cost_escalation / 1000).toFixed(0)}k`}
                  heightPct={heightPct}
                  frontColor="#0284C7"
                  topColor="#38BDF8"
                  sideColor="#0369A1"
                  textColor="#0284C7"
                  isHovered={hoveredCostIndex === idx}
                  mounted={mounted}
                  sectorName={sec.sector_name}
                  tooltipContent={{
                    val: `₹${sec.total_cost_escalation.toLocaleString()} Cr`,
                    sub: `+${sec.avg_cost_overrun_pct}% avg overrun`
                  }}
                  onHover={(h) => setHoveredCostIndex(h ? idx : null)}
                />
              );
            })}
          </div>
        </div>
      </div>

      {/* Card 2 (Right): Global Time Overrun (Months) */}
      <div className="card overrun-card-col">
        <div className="overrun-card-header">
          <div className="overrun-header-left">
            <div className="overrun-icon-circle icon-gold">
              <Clock size={18} color="#D97706" />
            </div>
            <div>
              <h2 className="card-title">Global Schedule Delays</h2>
              <p className="card-subtitle">Average delay extension by sector (Months)</p>
            </div>
          </div>
          <div className="metric-chip-pill chip-gold">
            <span className="chip-label">PROJECTS DELAYED</span>
            <span className="chip-value">
              <AnimatedCounter value={totalDelayedProjects} resetKey={activeTab} /> Assets
            </span>
          </div>
        </div>

        {/* Crisp SVG 3D Solid Bar Graph for Time Overrun */}
        <div className="vertical-chart-area">
          <div className="v-bars-flex-container">
            {sectors.map((sec, idx) => {
              const heightPct = Math.min(100, Math.max(16, (sec.avg_delay_months / maxDelay) * 100));

              return (
                <Svg3DCuboidBar
                  key={sec.sector_name}
                  valText={`${sec.avg_delay_months}m`}
                  heightPct={heightPct}
                  frontColor="#D97706"
                  topColor="#FBBF24"
                  sideColor="#B45309"
                  textColor="#D97706"
                  isHovered={hoveredTimeIndex === idx}
                  mounted={mounted}
                  sectorName={sec.sector_name}
                  tooltipContent={{
                    val: `+${sec.avg_delay_months} Months Avg`,
                    sub: `${sec.delayed_projects_count} Delayed Assets`
                  }}
                  onHover={(h) => setHoveredTimeIndex(h ? idx : null)}
                />
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
