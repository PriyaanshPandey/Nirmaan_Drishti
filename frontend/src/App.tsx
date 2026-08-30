import { useState, useEffect, useRef } from 'react';
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
import { PageSlot } from './components/PageTransition';
import { Home } from './components/Home';
import { PageLoader } from './components/PageLoader';

function App() {
  const [activeTab, setActiveTab] = useState('home');
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [previousTab, setPreviousTab] = useState<string>('projects');

  // Dashboard first-load skeleton state
  const [dashboardReady, setDashboardReady] = useState(false);
  const dashboardOpenedRef = useRef(false);

  const handleTabChange = (tab: string) => {
    if (tab === activeTab) return;
    setSelectedProjectId(null);

    // Show the skeleton loader the first time dashboard is opened
    if (tab === 'dashboard' && !dashboardOpenedRef.current) {
      dashboardOpenedRef.current = true;
      setDashboardReady(false);
      setActiveTab(tab);
      // Keep the loader visible for 1.5 s so the API calls can settle
      setTimeout(() => setDashboardReady(true), 1500);
    } else {
      setActiveTab(tab);
    }
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

  // If the app opens directly on home (default), mark dashboard as not yet opened
  useEffect(() => {
    dashboardOpenedRef.current = false;
  }, []);

  return (
    <>
      {/* Pill-shaped Top Navbar */}
      <Navbar activeTab={activeTab} setActiveTab={handleTabChange} />

      {/* ── Home Welcome Page ── */}
      <PageSlot id="home" activeTab={activeTab}>
        <Home onNavigateTab={handleTabChange} />
      </PageSlot>

      {/* ── Dashboard ── */}
      <PageSlot id="dashboard" activeTab={activeTab}>
        {!dashboardReady ? (
          <PageLoader />
        ) : (
          <>
            <Header />
            <main className="dashboard-content" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {/* Row 1: Metrics | Health Donut | Priority Interventions */}
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

              {/* Row 2: Trend Graph | Delay Factors | AI Action Center */}
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
      </PageSlot>

      {/* ── Projects ── */}
      <PageSlot id="projects" activeTab={activeTab}>
        <main className="projects-content">
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
      </PageSlot>

      {/* ── AI Insights ── */}
      <PageSlot id="insights" activeTab={activeTab}>
        <main className="insights-content">
          <AIInsights
            onSelectProject={handleSelectProject}
            onNavigateTab={handleTabChange}
          />
        </main>
      </PageSlot>

      {/* ── Risk Analysis ── */}
      <PageSlot id="risk" activeTab={activeTab}>
        <main className="risk-content">
          <RiskAnalysis
            onSelectProject={handleSelectProject}
            onNavigateTab={handleTabChange}
          />
        </main>
      </PageSlot>

      {/* ── Action Centre ── */}
      <PageSlot id="action-centre" activeTab={activeTab}>
        <main className="action-centre-content">
          <ActionCenter
            onSelectProject={handleSelectProject}
            onNavigateTab={handleTabChange}
          />
        </main>
      </PageSlot>

      {/* ── Distribution ── */}
      <PageSlot id="distribution" activeTab={activeTab}>
        <main className="distribution-content">
          <ProjectDistribution />
        </main>
      </PageSlot>
    </>
  );
}

export default App;
