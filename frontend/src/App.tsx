import { useState } from 'react';
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
  const [activeTab, setActiveTab] = useState('home');
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [previousTab, setPreviousTab] = useState<string>('projects');
  const [homeClickNonce, setHomeClickNonce] = useState<number>(0);
  const [projectStatusFilter, setProjectStatusFilter] = useState<string>('All');
  const [statusFilterNonce, setStatusFilterNonce] = useState<number>(0);

  const handleTabChange = (tab: string) => {
    if (tab === 'home') {
      setHomeClickNonce(prev => prev + 1);
    }
    if (tab === activeTab && tab !== 'home') return;
    setSelectedProjectId(null);
    setActiveTab(tab);
  };

  const handleSelectProject = (id: string) => {
    setPreviousTab(activeTab);
    setSelectedProjectId(id);
    setActiveTab('projects');
  };

  const handleFilterStatus = (status: string) => {
    if (projectStatusFilter === status) {
      setProjectStatusFilter('All');
    } else {
      setProjectStatusFilter(status);
    }
    setStatusFilterNonce(prev => prev + 1);
    setSelectedProjectId(null);
    setActiveTab('projects');
  };

  const handleBack = () => {
    setSelectedProjectId(null);
    if (previousTab && previousTab !== 'projects') {
      setActiveTab(previousTab);
    }
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
          <div className="dashboard-subbar">
            <div className="dashboard-subbar-left">
              <span className="dashboard-subbar-title">National Executive Overview</span>
              <span className="dashboard-subbar-tag">3,361 Central Assets</span>
            </div>
            <div className="insight-badge">
              <span className="badge-dot"></span>
              <span className="badge-text">Monitoring Period: July 2025 – May 2026</span>
            </div>
          </div>
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
                initialStatus={projectStatusFilter}
                statusFilterNonce={statusFilterNonce}
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
      <Footer activeTab={activeTab} onNavigateTab={handleTabChange} />
    </div>
  );
}

export default App;
