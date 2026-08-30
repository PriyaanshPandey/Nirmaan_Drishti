import { useState } from 'react';
import { Navbar } from './components/Navbar';
import { Header } from './components/Header';
import { MetricCards } from './components/MetricCards';
import { DonutChart } from './components/DonutChart';
import { PriorityInterventions } from './components/PriorityInterventions';
import { RiskTrendChart } from './components/RiskTrendChart';
import { DelayFactors } from './components/DelayFactors';
import { AIActionCenter } from './components/AIActionCenter';
import { ProjectPortfolio } from './components/ProjectPortfolio';
import { ProjectDetails } from './components/ProjectDetails';
import { AIInsights } from './components/AIInsights';
import { RiskAnalysis } from './components/RiskAnalysis';
import { ActionCenter } from './components/ActionCenter';
import { ProjectDistribution } from './components/ProjectDistribution';
function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [previousTab, setPreviousTab] = useState<string>('projects');

  const handleTabChange = (tab: string) => {
    const targetTab = tab === 'home' ? 'dashboard' : tab;
    if (targetTab === activeTab) return;
    setSelectedProjectId(null);
    setActiveTab(targetTab);
  };

  const handleSelectProject = (id: string) => {
    setPreviousTab(activeTab);
    setSelectedProjectId(id);
    setActiveTab('projects');
  };

  const handleBack = () => {
    setSelectedProjectId(null);
    if (previousTab && previousTab !== 'projects') {
      setActiveTab(previousTab);
    }
  };

  return (
    <>
      {/* Pill-shaped Top Navbar */}
      <Navbar activeTab={activeTab} setActiveTab={handleTabChange} />
      
      {/* Render Main Content */}
      {activeTab === 'dashboard' && (
        <>
          {/* Title block with subtitle and status badges */}
          <Header />
          
          <main className="dashboard-content animation-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {/* Row 1: Metrics (Col 1), Health Donut Chart (Col 2), Table Interventions (Col 3) */}
            <section className="dashboard-grid">
              <div className="grid-col-1">
                <MetricCards />
              </div>
              <div className="grid-col-2">
                <DonutChart />
              </div>
              <div className="grid-col-3">
                <PriorityInterventions onSelectProject={handleSelectProject} />
              </div>
            </section>

            {/* Row 2: Trend Line Graph (Col 1), Progress Bars Factors (Col 2), AI Card Center (Col 3) */}
            <section className="dashboard-row-2">
              <div className="grid-col-1">
                <RiskTrendChart />
              </div>
              <div className="grid-col-2">
                <DelayFactors />
              </div>
              <div className="grid-col-3">
                <AIActionCenter onNavigateTab={handleTabChange} />
              </div>
            </section>
          </main>
        </>
      )}

      {activeTab === 'projects' && (
        <main className="projects-content animation-fade-in">
          {selectedProjectId ? (
            <ProjectDetails 
              projectId={selectedProjectId} 
              onBack={handleBack} 
            />
          ) : (
            <ProjectPortfolio 
              onSelectProject={handleSelectProject} 
            />
          )}
        </main>
      )}

      {activeTab === 'insights' && (
        <main className="insights-content">
          <AIInsights 
            onSelectProject={handleSelectProject} 
            onNavigateTab={handleTabChange}
          />
        </main>
      )}

      {activeTab === 'risk' && (
        <main className="risk-content">
          <RiskAnalysis 
            onSelectProject={handleSelectProject} 
            onNavigateTab={handleTabChange} 
          />
        </main>
      )}

      {activeTab === 'action-centre' && (
        <main className="action-centre-content">
          <ActionCenter 
            onSelectProject={handleSelectProject} 
            onNavigateTab={handleTabChange} 
          />
        </main>
      )}

      {activeTab === 'distribution' && (
        <main className="distribution-content">
          <ProjectDistribution />
        </main>
      )}

      {activeTab !== 'dashboard' && activeTab !== 'projects' && activeTab !== 'insights' && activeTab !== 'risk' && activeTab !== 'action-centre' && activeTab !== 'distribution' && (
        <div style={{ padding: '80px 20px', textAlign: 'center', backgroundColor: '#FFFFFF', borderRadius: '16px', border: '1px dashed #CBD5E1', marginTop: '20px' }}>
          <h2 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--navy-dark)' }}>
            {activeTab.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')} Section
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '13px', marginTop: '8px' }}>
            This section is placeholder and will display details for the select item.
          </p>
        </div>
      )}
    </>
  );
}

export default App;

