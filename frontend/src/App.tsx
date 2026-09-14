import { useEffect, useState } from 'react';
import { Navbar } from './components/Navbar';
import { Header } from './components/Header';
import { MetricCards } from './components/MetricCards';
import { DonutChart } from './components/DonutChart';
import { NationalRiskCard } from './components/NationalRiskCard';
import { PriorityInterventions } from './components/PriorityInterventions';
import { GlobalOverrunGraphs } from './components/GlobalOverrunGraphs';
import { ProjectPortfolio } from './components/ProjectPortfolio';
import { ProjectDetails } from './components/ProjectDetails';
import { AIInsights } from './components/AIInsights';
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
      insights: 'AI Insights',
      'action-centre': 'Action Centre',
      distribution: 'Distribution',
    };
    document.title = `Nirmaan Drishti — ${titles[activeTab] || 'Home'}`;
  }, [activeTab, selectedProjectId]);

  const handleTabChange = (tab: string) => {
    if (tab === activeTab) return;
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
      {/* ── Main Application Content (Unified 1360px container with Top Navbar) ── */}
      <div className="app-main-content">
        {/* Pill-shaped Top Navbar across all pages */}
        <Navbar activeTab={activeTab} setActiveTab={handleTabChange} />

        {/* ── Home ── */}
        <PageSlot id="home" activeTab={activeTab}>
          <Home activeTab={activeTab} onNavigateTab={handleTabChange} />
        </PageSlot>

        {/* ── Dashboard ── */}
        <PageSlot id="dashboard" activeTab={activeTab}>
          <Header />
          <main className="dashboard-content" style={{ display: 'flex', flexDirection: 'column', gap: '24px', paddingBottom: '32px' }}>
            {/* Row 1: Top Dashboard Grid (Left 3 Metrics Stacked | Middle Health Donut | Right National Risk Donut) */}
            <section className="dashboard-grid">
              <div className="grid-col-1">
                <MetricCards activeTab={activeTab} />
              </div>
              <div className="grid-col-2">
                <DonutChart activeTab={activeTab} />
              </div>
              <div className="grid-col-3">
                <NationalRiskCard activeTab={activeTab} />
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
      </div>

      {/* Official Government MoSPI & PAIMANA Footer ending the page cleanly with 0 whitespace */}
      <Footer onNavigateTab={handleTabChange} />
    </div>
  );
}

export default App;
