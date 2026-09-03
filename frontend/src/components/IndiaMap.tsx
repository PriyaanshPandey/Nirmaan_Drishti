import React, { useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Building2, Coins, TrendingUp, Clock } from 'lucide-react';
import './IndiaMap.css';
import { projectsData, type Project } from '../data/projectsData';
// @ts-ignore - no types available for this package
import indiaMapData from '@svg-maps/india';
import { AnimatedCounter } from './AnimatedCounter';

interface StateSummary {
  stateName: string;
  projectCount: number;
  originalCostCrore: number;
  revisedCostCrore: number;
  expenditureCrore: number;
  completedMonth: number;
  newlyAdded: number;
}

// Map SVG-map location id → our dataset state name
const ID_TO_STATE: Record<string, string> = {
  'an': 'Andaman and Nicobar',
  'ap': 'Andhra Pradesh',
  'ar': 'North-East Region',
  'as': 'Assam',
  'br': 'Bihar',
  'ch': 'Chandigarh',
  'ct': 'Chhattisgarh',
  'dn': 'Gujarat',
  'dd': 'Gujarat',
  'dl': 'Delhi',
  'ga': 'Goa',
  'gj': 'Gujarat',
  'hr': 'Haryana',
  'hp': 'Himachal Pradesh',
  'jk': 'Jammu & Kashmir',
  'jh': 'Jharkhand',
  'ka': 'Karnataka',
  'kl': 'Kerala',
  'ld': 'Lakshadweep',
  'mp': 'Madhya Pradesh',
  'mh': 'Maharashtra',
  'mn': 'North-East Region',
  'ml': 'North-East Region',
  'mz': 'North-East Region',
  'nl': 'North-East Region',
  'or': 'Odisha',
  'py': 'Tamil Nadu',
  'pb': 'Punjab',
  'rj': 'Rajasthan',
  'sk': 'Sikkim',
  'tn': 'Tamil Nadu',
  'tg': 'Telangana',
  'tr': 'North-East Region',
  'up': 'Uttar Pradesh',
  'ut': 'Uttarakhand',
  'wb': 'West Bengal',
};

// Map SVG-map location id → display label
const ID_TO_LABEL: Record<string, string> = {
  'an': 'Andaman & Nicobar',
  'ap': 'Andhra Pradesh',
  'ar': 'Arunachal Pradesh',
  'as': 'Assam',
  'br': 'Bihar',
  'ch': 'Chandigarh',
  'ct': 'Chhattisgarh',
  'dn': 'Dadra & Nagar Haveli',
  'dd': 'Daman & Diu',
  'dl': 'Delhi',
  'ga': 'Goa',
  'gj': 'Gujarat',
  'hr': 'Haryana',
  'hp': 'Himachal Pradesh',
  'jk': 'Jammu & Kashmir',
  'jh': 'Jharkhand',
  'ka': 'Karnataka',
  'kl': 'Kerala',
  'ld': 'Lakshadweep',
  'mp': 'Madhya Pradesh',
  'mh': 'Maharashtra',
  'mn': 'Manipur',
  'ml': 'Meghalaya',
  'mz': 'Mizoram',
  'nl': 'Nagaland',
  'or': 'Odisha',
  'py': 'Puducherry',
  'pb': 'Punjab',
  'rj': 'Rajasthan',
  'sk': 'Sikkim',
  'tn': 'Tamil Nadu',
  'tg': 'Telangana',
  'tr': 'Tripura',
  'up': 'Uttar Pradesh',
  'ut': 'Uttarakhand',
  'wb': 'West Bengal',
};

interface IndiaMapProps {
  activeTab?: string;
  resetKey?: string | number;
}

export const IndiaMap: React.FC<IndiaMapProps> = ({ activeTab, resetKey }) => {
  const [selectedStateId, setSelectedStateId] = useState<string>('up');
  const [hoveredStateId, setHoveredStateId] = useState<string | null>(null);
  const [tooltip, setTooltip] = useState<{ visible: boolean; x: number; y: number; name: string }>({
    visible: false,
    x: 0,
    y: 0,
    name: ''
  });

  const handleStateMouseEnter = (locId: string, locName: string, e: React.MouseEvent) => {
    setHoveredStateId(locId);
    const label = ID_TO_LABEL[locId] || locName;
    setTooltip({
      visible: true,
      x: e.clientX,
      y: e.clientY,
      name: label
    });
  };

  const handleStateMouseMove = (e: React.MouseEvent) => {
    setTooltip(prev => ({
      ...prev,
      x: e.clientX,
      y: e.clientY
    }));
  };

  const handleStateMouseLeave = () => {
    setHoveredStateId(null);
    setTooltip(prev => ({ ...prev, visible: false }));
  };

  const activeResetTrigger = `${selectedStateId}-${resetKey !== undefined ? resetKey : activeTab}`;

  // Helper parser: strips '₹', 'Cr', commas and returns numeric crore float
  const parseCrores = (val: any): number => {
    if (!val) return 0;
    const cleaned = val.toString().replace(/[^0-9.]/g, '');
    return parseFloat(cleaned) || 0;
  };

  // Compute 100% REAL state-by-state aggregations from projectsData (3,361 dataset)
  const stateDataMap = useMemo(() => {
    const map = new Map<string, StateSummary>();

    projectsData.forEach((p: Project) => {
      let loc = (p.location || '').replace(/\r\n/g, ' ').replace(/\n/g, ' ').trim();

      if (loc.includes('Uttar Pradesh')) loc = 'Uttar Pradesh';
      else if (loc.includes('Madhya Pradesh')) loc = 'Madhya Pradesh';
      else if (loc.includes('Maharashtra')) loc = 'Maharashtra';
      else if (loc.includes('Gujarat')) loc = 'Gujarat';
      else if (loc.includes('Karnataka')) loc = 'Karnataka';
      else if (loc.includes('Andhra Pradesh')) loc = 'Andhra Pradesh';
      else if (loc.includes('Tamil Nadu')) loc = 'Tamil Nadu';
      else if (loc.includes('Telangana')) loc = 'Telangana';
      else if (loc.includes('Bihar')) loc = 'Bihar';
      else if (loc.includes('Odisha')) loc = 'Odisha';
      else if (loc.includes('Jharkhand')) loc = 'Jharkhand';
      else if (loc.includes('West Bengal')) loc = 'West Bengal';
      else if (loc.includes('Chhattisgarh')) loc = 'Chhattisgarh';
      else if (loc.includes('Punjab')) loc = 'Punjab';
      else if (loc.includes('Jammu')) loc = 'Jammu & Kashmir';
      else if (loc.includes('Rajasthan')) loc = 'Rajasthan';
      else if (loc.includes('Assam')) loc = 'Assam';
      else if (loc.includes('Haryana')) loc = 'Haryana';
      else if (loc.includes('Uttarakhand')) loc = 'Uttarakhand';
      else if (loc.includes('Himachal')) loc = 'Himachal Pradesh';
      else if (loc.includes('Manipur') || loc.includes('Tripura') || loc.includes('Arunachal') || loc.includes('Mizoram') || loc.includes('Meghalaya') || loc.includes('Nagaland')) loc = 'North-East Region';
      else if (loc.includes('Goa')) loc = 'Goa';
      else if (loc.includes('Delhi')) loc = 'Delhi';
      else if (loc.includes('Sikkim')) loc = 'Sikkim';
      else if (loc.includes('Ladakh')) loc = 'Jammu & Kashmir';
      else if (loc.includes('Puducherry')) loc = 'Tamil Nadu';
      else if (loc.includes('Multi-State') || loc.includes('PAN India') || loc.includes('Offshore')) loc = 'Multi-State';

      const origCost = parseCrores(p.costApproved);
      const revCost = parseCrores(p.costRevised);
      const expCost = parseCrores(p.costExpenditure);

      if (!map.has(loc)) {
        map.set(loc, {
          stateName: loc,
          projectCount: 0,
          originalCostCrore: 0,
          revisedCostCrore: 0,
          expenditureCrore: 0,
          completedMonth: 0,
          newlyAdded: 0
        });
      }

      const entry = map.get(loc)!;
      entry.projectCount += 1;
      entry.originalCostCrore += origCost;
      entry.revisedCostCrore += revCost;
      entry.expenditureCrore += expCost;
    });

    return map;
  }, []);

  const selectedStateName = ID_TO_STATE[selectedStateId] || 'Uttar Pradesh';

  const currentStateSummary: StateSummary = useMemo(() => {
    return stateDataMap.get(selectedStateName) || {
      stateName: selectedStateName,
      projectCount: 0,
      originalCostCrore: 0,
      revisedCostCrore: 0,
      expenditureCrore: 0,
      completedMonth: 0,
      newlyAdded: 0
    };
  }, [selectedStateName, stateDataMap]);

  // Color generator based on project count (PAIMANA choropleth scale)
  const getStateFillColor = (stateId: string) => {
    const stateName = ID_TO_STATE[stateId] || '';
    if (stateId === selectedStateId) return '#1D2A54';
    if (stateId === hoveredStateId) return '#2D3A64';

    const count = stateDataMap.get(stateName)?.projectCount || 0;
    if (count > 250) return '#7F1D1D';
    if (count > 180) return '#991B1B';
    if (count > 130) return '#B91C1C';
    if (count > 90) return '#DC2626';
    if (count > 60) return '#E8866A';
    if (count > 30) return '#F4B99A';
    if (count > 10) return '#FDDCBF';
    return '#FFF5E1';
  };



  const mapLocations = indiaMapData.locations || [];
  const viewBox = indiaMapData.viewBox || '0 0 612 696';

  return (
    <div className="paimana-map-section">
      <div className="map-section-header">
        <div>
          <h2 className="map-section-title">State-wise Projects <span className="as-of-tag">(as of July, 2026)</span></h2>
          <p className="map-section-subtitle">Real-time geographic dataset &amp; approved financial outlay across India</p>
        </div>
      </div>

      <div className="paimana-map-container">
        {/* Left Side: PAIMANA State Metrics Card */}
        <div className="state-metrics-card">
          <div className="state-card-header">
            <span className="state-header-title">{ID_TO_LABEL[selectedStateId] || selectedStateName}</span>
          </div>

          <div className="state-metrics-grid">
            <div className="state-metric-item">
              <div className="metric-icon-box icon-box-blue">
                <Building2 size={20} color="#2563EB" />
              </div>
              <div className="metric-info">
                <span className="metric-lbl">Project Count (No.)</span>
                <span className="metric-val">
                  <AnimatedCounter value={currentStateSummary.projectCount} duration={800} resetKey={activeResetTrigger} />
                </span>
              </div>
            </div>

            <div className="state-metric-item">
              <div className="metric-icon-box icon-box-green">
                <Coins size={20} color="#059669" />
              </div>
              <div className="metric-info">
                <span className="metric-lbl">Original Cost (in Cr.)</span>
                <span className="metric-val">
                  ₹ <AnimatedCounter value={Math.round(currentStateSummary.originalCostCrore)} duration={800} resetKey={activeResetTrigger} />
                </span>
              </div>
            </div>

            <div className="state-metric-item">
              <div className="metric-icon-box icon-box-red">
                <TrendingUp size={20} color="#DC2626" />
              </div>
              <div className="metric-info">
                <span className="metric-lbl">Latest Revised Cost (in Cr.)</span>
                <span className="metric-val">
                  ₹ <AnimatedCounter value={Math.round(currentStateSummary.revisedCostCrore)} duration={800} resetKey={activeResetTrigger} />
                </span>
              </div>
            </div>

            <div className="state-metric-item">
              <div className="metric-icon-box icon-box-amber">
                <Clock size={20} color="#D97706" />
              </div>
              <div className="metric-info">
                <span className="metric-lbl">Expenditure(Cumm.) (in Cr.)</span>
                <span className="metric-val">
                  ₹ <AnimatedCounter value={Math.round(currentStateSummary.expenditureCrore)} duration={800} resetKey={activeResetTrigger} />
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Side: Real Accurate SVG Map of India from @svg-maps/india */}
        <div className="india-map-wrapper">
          <svg
            viewBox={viewBox}
            className="india-svg-map"
            preserveAspectRatio="xMidYMid meet"
          >
            {mapLocations.map((loc: any) => {
              const isSelected = loc.id === selectedStateId;
              const isHovered = loc.id === hoveredStateId;

              return (
                <path
                  key={loc.id}
                  d={loc.path}
                  fill={getStateFillColor(loc.id)}
                  stroke={isSelected ? '#38BDF8' : isHovered ? '#60A5FA' : '#475569'}
                  strokeWidth={isSelected ? 2.5 : isHovered ? 1.5 : 0.6}
                  strokeLinejoin="round"
                  strokeLinecap="round"
                  className="state-path-real"
                  onClick={() => setSelectedStateId(loc.id)}
                  onMouseEnter={(e) => handleStateMouseEnter(loc.id, loc.name, e)}
                  onMouseMove={handleStateMouseMove}
                  onMouseLeave={handleStateMouseLeave}
                  style={{
                    cursor: 'pointer',
                    transition: 'all 0.25s ease',
                    filter: isSelected ? 'drop-shadow(0 2px 6px rgba(29,42,84,0.4))' : 'none'
                  }}
                />
              );
            })}
          </svg>

          {/* Cursor-tracking Tooltip (exactly 2px above cursor) */}
          {tooltip.visible && createPortal(
            <div
              className="state-cursor-tooltip"
              style={{
                left: `${tooltip.x}px`,
                top: `${tooltip.y - 2}px`,
                transform: 'translate(-50%, -100%)',
              }}
            >
              {tooltip.name}
            </div>,
            document.body
          )}

          {/* PAIMANA Vertical Choropleth Legend */}
          <div className="choropleth-legend">
            <span className="legend-max">326</span>
            <div className="legend-gradient-bar" />
            <span className="legend-min">0</span>
          </div>
        </div>
      </div>
    </div>
  );
};
