import { useEffect, useState } from 'react';
import { Header } from './components/Header';
import { MetricCards } from './components/MetricCards';
import { DonutChart } from './components/DonutChart';
import { NationalRiskCard } from './components/NationalRiskCard';
import { PriorityInterventions } from './components/PriorityInterventions';
import { GlobalOverrunGraphs } from './components/GlobalOverrunGraphs';
import { ProjectPortfolio } from './components/ProjectPortfolio';
import { ProjectDetails } from './components/ProjectDetails';
import { ActionCenter } from './components/ActionCenter';
import { ProjectDistribution } from './components/ProjectDistribution';
import { PageSlot } from './components/PageTransition';
import { Home } from './components/Home';
import { Footer } from './components/Footer';

function App() {
  type NavigationState = { tab: string; projectId: string | null };
  const initialNavigation = (window.history.state as NavigationState | null) || { tab: 'home', projectId: null };
  const [activeTab, setActiveTab] = useState(initialNavigation.tab);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(initialNavigation.projectId);
  const [previousTab, setPreviousTab] = useState<string>('projects');
  const [homeClickNonce, setHomeClickNonce] = useState<number>(0);
  const [projectStatusFilter, setProjectStatusFilter] = useState<string>('All');
  const [statusFilterNonce, setStatusFilterNonce] = useState<number>(0);
  const [projectRiskFilter, setProjectRiskFilter] = useState<string>('All');
  const [riskFilterNonce, setRiskFilterNonce] = useState<number>(0);

  const updateHistory = (navigation: NavigationState) => {
    window.history.pushState(navigation, '', window.location.href);
  };

  useEffect(() => {
    const currentState = window.history.state as NavigationState | null;
    if (!currentState || !currentState.tab) {
      window.history.replaceState({ tab: activeTab, projectId: selectedProjectId }, '', window.location.href);
    }

    const handlePopState = (event: PopStateEvent) => {
      const navigation = (event.state as NavigationState | null) || { tab: 'home', projectId: null };
      setActiveTab(navigation.tab);
      setSelectedProjectId(navigation.projectId);
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  useEffect(() => {
    const titles: Record<string, string> = {
      home: 'Home',
      dashboard: 'Dashboard',
      projects: selectedProjectId ? `Project Details — ${selectedProjectId}` : 'Projects',
      'action-centre': 'Action Center',
      distribution: 'Distribution',
    };
    document.title = `Nirmaan Drishti — ${titles[activeTab] || 'Home'}`;
  }, [activeTab, selectedProjectId]);

  const handleTabChange = (rawTab: string) => {
    const tab = rawTab === 'project' ? 'projects' : rawTab;
    if (tab === 'home') {
      setHomeClickNonce(prev => prev + 1);
    }
    if (tab === activeTab && tab !== 'home') return;
    setSelectedProjectId(null);
    setActiveTab(tab);
    updateHistory({ tab, projectId: null });
  };

  const handleSelectProject = (id: string) => {
    setPreviousTab(activeTab);
    setSelectedProjectId(id);
    setActiveTab('projects');
    updateHistory({ tab: 'projects', projectId: id });
  };

  const handleFilterStatus = (status: string) => {
    setProjectStatusFilter(status);
    setProjectRiskFilter('All');
    setStatusFilterNonce(prev => prev + 1);
    setSelectedProjectId(null);
    setActiveTab('projects');
    updateHistory({ tab: 'projects', projectId: null });
  };

  const handleFilterRisk = (risk: string) => {
    let mappedRisk = risk;
    if (risk.includes('High') || risk.includes('Critical')) mappedRisk = 'High';
    else if (risk.includes('Med')) mappedRisk = 'Medium';
    else if (risk.includes('Low')) mappedRisk = 'Low';

    setProjectRiskFilter(mappedRisk);
    setProjectStatusFilter('All');
    setRiskFilterNonce(prev => prev + 1);
    setSelectedProjectId(null);
    setActiveTab('projects');
    updateHistory({ tab: 'projects', projectId: null });
  };

  const handleBack = () => {
    if (window.history.length > 1) {
      window.history.back();
      return;
    }

    setSelectedProjectId(null);
    setActiveTab(previousTab && previousTab !== 'projects' ? previousTab : 'projects');
  };

  return (
    <div className="app-layout">
      {/* ── Official National Infrastructure Intelligence Portal Header with Integrated Rectangular Navbar ── */}
      <Header
        activeTab={activeTab}
        onNavigateTab={handleTabChange}
        onSelectProject={handleSelectProject}
        onFilterStatus={handleFilterStatus}
        currentStatusFilter={projectStatusFilter}
      />

      {/* ── Main Application Content (Unified container) ── */}
      <div className="app-main-content">

        {/* ── Home ── */}
        <PageSlot id="home" activeTab={activeTab}>
          <Home
            activeTab={activeTab}
            onNavigateTab={handleTabChange}
            homeClickNonce={homeClickNonce}
          />
        </PageSlot>

        {/* ── Dashboard ── */}
        <PageSlot id="dashboard" activeTab={activeTab}>
          <main className="dashboard-content" style={{ display: 'flex', flexDirection: 'column', gap: '24px', paddingBottom: '32px' }}>
            {/* National Executive Overview Header */}
            <div className="dashboard-header-block">
              <div className="dashboard-header-text">
                <h1 className="dashboard-main-title">Nirmaan Drishti</h1>
                <p className="dashboard-main-subtitle">National Infrastructure Early Warning &amp; Predictive Monitoring Platform</p>
              </div>
              <div className="dashboard-period-badge">
                <span className="period-badge-dot" />
                <span>July 2025 – May 2026</span>
              </div>
            </div>

            {/* Row 1: Top Dashboard Grid (Left 3 Metrics Stacked | Middle Health Donut | Right National Risk Donut) */}
            <section className="dashboard-grid">
              <div className="grid-col-1">
                <MetricCards activeTab={activeTab} />
              </div>
              <div className="grid-col-2">
                <DonutChart activeTab={activeTab} onSelectHealthStatus={handleFilterStatus} />
              </div>
              <div className="grid-col-3">
                <NationalRiskCard activeTab={activeTab} onSelectRiskLevel={handleFilterRisk} />
              </div>
            </section>

            {/* Row 2: Priority Interventions (Top 10 Critical Projects - Click to view full details) */}
            <section>
              <PriorityInterventions onSelectProject={handleSelectProject} />
            </section>

            {/* Row 3: Global Cost Escalation & Time Delay Bar Graphs */}
            <section>
              <GlobalOverrunGraphs activeTab={activeTab} />
            </section>
          </main>
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
                initialStatus={projectStatusFilter}
                statusFilterNonce={statusFilterNonce}
                initialRisk={projectRiskFilter}
                riskFilterNonce={riskFilterNonce}
              />
            )}
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
            <ProjectDistribution
              onSelectProject={handleSelectProject}
              onNavigateTab={handleTabChange}
            />
          </main>
        </PageSlot>
      </div>

      {/* Official Government MoSPI & PAIMANA Footer ending the page cleanly with 0 whitespace */}
      <Footer activeTab={activeTab} onNavigateTab={handleTabChange} />
    </div>
  );
}

export default App;
