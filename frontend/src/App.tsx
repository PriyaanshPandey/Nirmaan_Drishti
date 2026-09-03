import { useState } from 'react';
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
import { RiskAnalysis } from './components/RiskAnalysis';
import { ActionCenter } from './components/ActionCenter';
import { ProjectDistribution } from './components/ProjectDistribution';
import { PageSlot } from './components/PageTransition';
import { Home } from './components/Home';
import { Footer } from './components/Footer';

function App() {
  const [activeTab, setActiveTab] = useState('home');
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [previousTab, setPreviousTab] = useState<string>('projects');

  const handleTabChange = (tab: string) => {
    if (tab === activeTab) return;
    setSelectedProjectId(null);
    setActiveTab(tab);
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
    <div className="app-layout">
      <div className="app-main-content">
        {/* Pill-shaped Top Navbar */}
        <Navbar activeTab={activeTab} setActiveTab={handleTabChange} />

        {/* ── Home Welcome Page ── */}
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
      </div>

      {/* Official Government MoSPI & PAIMANA Footer ending the page cleanly with 0 whitespace */}
      <Footer onNavigateTab={handleTabChange} />
    </div>
  );
}

export default App;
