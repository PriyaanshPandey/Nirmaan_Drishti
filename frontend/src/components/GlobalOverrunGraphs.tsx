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
  { sector_name: 'Railways', total_projects: 1261, total_original_cost: 1997722, total_revised_cost: 2285394, total_cost_escalation: 287672, avg_cost_overrun_pct: 14.4, delayed_projects_count: 780, avg_delay_months: 21.9, max_delay_months: 72 },
  { sector_name: 'Power', total_projects: 521, total_original_cost: 1583402, total_revised_cost: 1858914, total_cost_escalation: 275512, avg_cost_overrun_pct: 17.4, delayed_projects_count: 310, avg_delay_months: 23.2, max_delay_months: 60 },
  { sector_name: 'Water', total_projects: 136, total_original_cost: 167224, total_revised_cost: 334950, total_cost_escalation: 167726, avg_cost_overrun_pct: 100.3, delayed_projects_count: 95, avg_delay_months: 39.3, max_delay_months: 80 },
  { sector_name: 'Petroleum', total_projects: 580, total_original_cost: 1324657, total_revised_cost: 1463746, total_cost_escalation: 139089, avg_cost_overrun_pct: 10.5, delayed_projects_count: 240, avg_delay_months: 18.0, max_delay_months: 48 },
  { sector_name: 'Telecom', total_projects: 75, total_original_cost: 192853, total_revised_cost: 316472, total_cost_escalation: 123619, avg_cost_overrun_pct: 64.1, delayed_projects_count: 45, avg_delay_months: 28.2, max_delay_months: 54 },
  { sector_name: 'Roads', total_projects: 3031, total_original_cost: 2367270, total_revised_cost: 2480899, total_cost_escalation: 113629, avg_cost_overrun_pct: 4.8, delayed_projects_count: 1420, avg_delay_months: 24.9, max_delay_months: 65 },
  { sector_name: 'Urban', total_projects: 112, total_original_cost: 651655, total_revised_cost: 689451, total_cost_escalation: 37796, avg_cost_overrun_pct: 5.8, delayed_projects_count: 65, avg_delay_months: 28.0, max_delay_months: 50 },
  { sector_name: 'Steel', total_projects: 92, total_original_cost: 138836, total_revised_cost: 161744, total_cost_escalation: 22908, avg_cost_overrun_pct: 16.5, delayed_projects_count: 40, avg_delay_months: 25.8, max_delay_months: 42 }
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
  barIndex: number;
  totalBars: number;
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
  onHover,
  barIndex,
  totalBars
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
  const labelY = Math.max(11, topY - 14);

  const tooltipTop = Math.max(-52, labelY - 75);

  const ratio = totalBars > 1 ? barIndex / (totalBars - 1) : 0.5;
  const shiftX = -18 + ratio * (-82 - -18);
  const caretX = Math.min(82, Math.max(18, -shiftX));

  return (
    <div
      className={`svg-bar-column ${isHovered ? 'bar-hovered' : ''}`}
      onMouseEnter={() => onHover(true)}
      onMouseLeave={() => onHover(false)}
      onFocus={() => onHover(true)}
      onBlur={() => onHover(false)}
      tabIndex={0}
      role="img"
      aria-label={`${sectorName}: ${tooltipContent.val}, ${tooltipContent.sub}`}
    >
      {/* 3D Floating Tooltip */}
      {isHovered && (
        <div
          className="v-bar-3d-tooltip"
          style={{
            top: `${tooltipTop}px`,
            transform: `translateX(${shiftX.toFixed(1)}%)`,
            ['--caret-x' as any]: `${caretX.toFixed(1)}%`,
          }}
        >
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
          aria-hidden="true"
        >
          {/* Top Value Tag */}
          <text
            x={barWidth / 2 + 2}
            y={labelY}
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
        {sectorName}
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
    setMounted(false);
    const t = setTimeout(() => setMounted(true), 100);

    api.getDashboardSummary().then((res) => {
      if (!isMounted) return;
      if (res && res.sector_overruns && res.sector_overruns.length > 0) {
        // Enforce top 8 consolidated sectors
        setSectors(res.sector_overruns.slice(0, 8));
      }
    }).catch(() => {
      // keep default sectors
    });

    return () => {
      isMounted = false;
      clearTimeout(t);
    };
  }, [activeTab]);

  const displayedSectors = sectors.slice(0, 8);
  const maxEscalation = Math.max(...displayedSectors.map(s => s.total_cost_escalation), 1);
  const maxDelay = Math.max(...displayedSectors.map(s => s.avg_delay_months), 1);

  const totalEscalationCrore = displayedSectors.reduce((sum, s) => sum + s.total_cost_escalation, 0);
  const totalDelayedProjects = displayedSectors.reduce((sum, s) => sum + s.delayed_projects_count, 0);

  return (
    <div className="global-overruns-grid-2">
      {/* Card 1 (Left): Global Cost Escalation */}
      <div className="card overrun-card-col">
        <div className="overrun-card-header">
          <div className="overrun-header-left">
            <div className="overrun-icon-circle icon-teal">
              <TrendingUp size={18} color="#0284C7" />
            </div>
            <div>
              <h2 className="card-title" style={{ margin: 0 }}>Global Cost Escalation</h2>
              <p className="card-subtitle">Real cost drift by sector (Crore)</p>
            </div>
          </div>
          <div className="metric-chip-pill chip-teal">
            <span className="chip-label">TOTAL COST DRIFT</span>
            <span className="chip-value">
              <AnimatedCounter value={Math.round(totalEscalationCrore)} resetKey={activeTab} /> Cr
            </span>
          </div>
        </div>

        {/* Crisp SVG 3D Solid Bar Graph for Cost Escalation */}
        <div className="vertical-chart-area">
          <p className="sr-only">Cost escalation by sector. {displayedSectors.map((sector) => `${sector.sector_name}: ${sector.total_cost_escalation.toLocaleString()} crore, plus ${sector.avg_cost_overrun_pct}% average overrun.`).join(' ')}</p>
          <div className="v-bars-flex-container">
            {displayedSectors.map((sec, idx) => {
              const heightPct = Math.min(100, Math.max(16, (sec.total_cost_escalation / maxEscalation) * 100));

              return (
                <Svg3DCuboidBar
                  key={sec.sector_name}
                  valText={`${Math.round(sec.total_cost_escalation / 1000)}k`}
                  heightPct={heightPct}
                  frontColor="#0284C7"
                  topColor="#0E7490"
                  sideColor="#0369A1"
                  textColor="#0284C7"
                  isHovered={hoveredCostIndex === idx}
                  mounted={mounted}
                  sectorName={sec.sector_name}
                  tooltipContent={{
                    val: `₹${Math.round(sec.total_cost_escalation).toLocaleString()} Cr`,
                    sub: `+${sec.avg_cost_overrun_pct}% avg overrun`
                  }}
                  onHover={(h) => setHoveredCostIndex(h ? idx : null)}
                  barIndex={idx}
                  totalBars={displayedSectors.length}
                />
              );
            })}
          </div>
        </div>
      </div>

      {/* Card 2 (Right): Global Schedule Delays */}
      <div className="card overrun-card-col">
        <div className="overrun-card-header">
          <div className="overrun-header-left">
            <div className="overrun-icon-circle icon-gold">
              <Clock size={18} color="#D97706" />
            </div>
            <div>
              <h2 className="card-title" style={{ margin: 0 }}>Global Schedule Delays</h2>
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
          <p className="sr-only">Average schedule delay by sector. {displayedSectors.map((sector) => `${sector.sector_name}: ${sector.avg_delay_months} months, ${sector.delayed_projects_count} delayed assets.`).join(' ')}</p>
          <div className="v-bars-flex-container">
            {displayedSectors.map((sec, idx) => {
              const heightPct = Math.min(100, Math.max(16, (sec.avg_delay_months / maxDelay) * 100));

              return (
                <Svg3DCuboidBar
                  key={sec.sector_name}
                  valText={`${Math.round(sec.avg_delay_months)} mo`}
                  heightPct={heightPct}
                  frontColor="#D97706"
                  topColor="#B45309"
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
                  barIndex={idx}
                  totalBars={displayedSectors.length}
                />
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
