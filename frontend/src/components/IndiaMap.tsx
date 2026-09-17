import React, { useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Building2, Coins, TrendingUp, Clock } from 'lucide-react';
import './IndiaMap.css';
import type { Project } from '../data/projectsData';
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

  const displayedStateId = hoveredStateId || selectedStateId;
  const activeResetTrigger = `${displayedStateId}-${resetKey !== undefined ? resetKey : activeTab}`;

  // Helper parser: strips '₹', 'Cr', commas and returns numeric crore float
  const parseCrores = (val: any): number => {
    if (!val) return 0;
    const cleaned = val.toString().replace(/[^0-9.]/g, '');
    return parseFloat(cleaned) || 0;
  };

  const [projectsList, setProjectsList] = React.useState<Project[]>([]);

  React.useEffect(() => {
    import('../data/projectsData').then(mod => setProjectsList(mod.projectsData));
  }, []);

  // Compute 100% REAL state-by-state aggregations from projectsData (3,361 dataset)
  const stateDataMap = useMemo(() => {
    const map = new Map<string, StateSummary>();

    projectsList.forEach((p: Project) => {
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

  const selectedStateName = ID_TO_STATE[displayedStateId] || 'Uttar Pradesh';

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

  const maxProjectCount = useMemo(() => {
    let max = 0;
    stateDataMap.forEach((v) => {
      if (v.projectCount > max) max = v.projectCount;
    });
    return max > 0 ? Math.ceil(max / 50) * 50 : 750;
  }, [stateDataMap]);

  // Color generator based on project count (calibrated across full portfolio range to make differences clearly visible)
  const getStateFillColor = (stateId: string) => {
    const stateName = ID_TO_STATE[stateId] || '';
    if (stateId === hoveredStateId) return '#1A1F4C';

    const count = stateDataMap.get(stateName)?.projectCount || 0;
    if (count > maxProjectCount * 0.85) return '#7F1D1D';
    if (count > maxProjectCount * 0.65) return '#991B1B';
    if (count > maxProjectCount * 0.48) return '#B91C1C';
    if (count > maxProjectCount * 0.35) return '#DC2626';
    if (count > maxProjectCount * 0.24) return '#EA580C';
    if (count > maxProjectCount * 0.15) return '#FB923C';
    if (count > maxProjectCount * 0.08) return '#FDBA74';
    if (count > maxProjectCount * 0.03) return '#FED7AA';
    if (count > 0) return '#FFEDD5';
    return '#FFF7ED';
  };



  const mapLocations = indiaMapData.locations || [];
  const viewBox = indiaMapData.viewBox || '0 0 612 696';

  return (
    <section className="paimana-map-section" aria-labelledby="india-map-title">
      <div className="map-section-header">
        <div>
          <h2 id="india-map-title" className="map-section-title">State-wise Projects <span className="as-of-tag">(as of July, 2026)</span></h2>
          <p className="map-section-subtitle">Real-time geographic dataset &amp; approved financial outlay across India</p>
        </div>
      </div>

      <div className="paimana-map-container">
        {/* Left Side: PAIMANA State Metrics Card */}
        <div className="state-metrics-card">
          <div className="state-card-header">
            <span className="state-header-title">{ID_TO_LABEL[displayedStateId] || selectedStateName}</span>
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
          <p className="sr-only" id="india-map-description">
            Interactive map of India showing project counts by state. The displayed state is {ID_TO_LABEL[displayedStateId] || selectedStateName}, with {currentStateSummary.projectCount} monitored projects, original cost of {Math.round(currentStateSummary.originalCostCrore)} crore rupees, revised cost of {Math.round(currentStateSummary.revisedCostCrore)} crore rupees, and expenditure of {Math.round(currentStateSummary.expenditureCrore)} crore rupees.
          </p>
          <svg
            viewBox={viewBox}
            className="india-svg-map"
            preserveAspectRatio="xMidYMid meet"
            role="group"
            aria-labelledby="india-map-title india-map-description"
          >
            {mapLocations.map((loc: any) => {
              const isSelected = loc.id === selectedStateId;
              const isHovered = loc.id === hoveredStateId;

              return (
                <path
                  key={loc.id}
                  d={loc.path}
                  fill={getStateFillColor(loc.id)}
                  stroke={isHovered ? '#1A1F4C' : '#334155'}
                  strokeWidth={isHovered ? 1.4 : 0.8}
                  strokeLinejoin="round"
                  strokeLinecap="round"
                  className="state-path-real"
                  onClick={() => setSelectedStateId(loc.id)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      setSelectedStateId(loc.id);
                    }
                  }}
                  onMouseEnter={(e) => handleStateMouseEnter(loc.id, loc.name, e)}
                  onMouseMove={handleStateMouseMove}
                  onMouseLeave={handleStateMouseLeave}
                  onFocus={() => setHoveredStateId(loc.id)}
                  onBlur={() => setHoveredStateId(null)}
                  style={{
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    filter: isHovered 
                      ? 'drop-shadow(0 2px 8px rgba(26, 31, 76, 0.35))' 
                      : 'none',
                    outline: 'none'
                  }}
                  role="button"
                  tabIndex={0}
                  aria-label={`${ID_TO_LABEL[loc.id] || loc.name}: ${stateDataMap.get(ID_TO_STATE[loc.id] || '')?.projectCount || 0} projects`}
                  aria-pressed={isSelected}
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
            <span className="sr-only">Map colors show the number of monitored projects in each state. Each state is also identified by its accessible state name and project count.</span>
            <span className="legend-max">{maxProjectCount}</span>
            <div className="legend-gradient-bar" />
            <span className="legend-min">0</span>
          </div>
        </div>
      </div>
    </section>
  );
};
