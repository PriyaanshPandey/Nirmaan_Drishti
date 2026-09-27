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
import { PdfExtractor } from './components/PdfExtractor';
import { AlertsPage } from './components/AlertsPage';
import type { TicketData } from './utils/pdfGenerator';
import { PageSlot } from './components/PageTransition';
import { Home } from './components/Home';
import { Footer } from './components/Footer';
import { LoginPage } from './components/LoginPage';
import { FidelityIndexDemo } from './components/FidelityIndexDemo';
import { AuthProvider, useAuth } from './auth/AuthContext';

// ── Inner app: handles authenticated and public views ─────────────────────────────
function MainApp() {
  const { user } = useAuth();

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
  const [stateFilter, setStateFilter] = useState<string>('All');
  const [stateFilterNonce, setStateFilterNonce] = useState<number>(0);
  const [projectSectorFilter, setProjectSectorFilter] = useState<string>('All');
  const [sectorFilterNonce, setSectorFilterNonce] = useState<number>(0);
  const [projectMinistryFilter, setProjectMinistryFilter] = useState<string>('All');
  const [ministryFilterNonce, setMinistryFilterNonce] = useState<number>(0);
  const [projectSearchFilter, setProjectSearchFilter] = useState<string>('');
  const [searchFilterNonce, setSearchFilterNonce] = useState<number>(0);
  const [showLoginModal, setShowLoginModal] = useState<boolean>(false);

  const isPublic = !user || user.role === 'public';
  const targetMinistry = user?.targetMinistry;
  const targetAgency = user?.targetAgency;

  const [ticketsList, setTicketsList] = useState<TicketData[]>(() => {
    try {
      const saved = localStorage.getItem('nirmaan_tickets');
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.error('Failed to parse saved tickets:', e);
    }
    return [{
      id: 'TCK-902145',
      projectName: 'Four Laning of Ramban to Banihal Section of NH-44',
      projectId: 'NHAI-JK-4402',
      actionTitle: 'Fast-track Right-of-Way (RoW) Clearance & Tunnel Support',
      routedOfficer: 'Member (Technical) - NHAI',
      status: 'OPEN',
      priority: 'Critical',
      dateCreated: '20/09/2026',
      ministry: 'Ministry of Road Transport and Highways',
      agency: 'National Highways Authority of India (NHAI)',
      description: 'Expedite statutory forest clearance for 4.2 km mountain tunnel bypass and deploy emergency slope stabilization equipment.'
    }];
  });

  useEffect(() => {
    try {
      localStorage.setItem('nirmaan_tickets', JSON.stringify(ticketsList));
    } catch (e) {
      console.error('Failed to save tickets:', e);
    }
  }, [ticketsList]);

  const handleCreateTicket = (ticket: TicketData) => {
    setTicketsList(prev => [ticket, ...prev]);
  };

  const handleUpdateTicketStatus = (ticketId: string, newStatus: string) => {
    setTicketsList(prev => prev.map(t => t.id === ticketId ? { ...t, status: newStatus } : t));
  };

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
      distribution: 'Benchmark Analytics',
      extractor: 'PDF Telemetry Extractor',
    };
    document.title = `Nirmaan Drishti — ${titles[activeTab] || 'Home'}`;
  }, [activeTab, selectedProjectId]);

  const handleTabChange = (rawTab: string) => {
    const tab = rawTab === 'project' ? 'projects' : rawTab;
    if (tab === 'home') {
      setHomeClickNonce(prev => prev + 1);
    }
    if (tab === 'projects' && selectedProjectId) {
      setSelectedProjectId(null);
      updateHistory({ tab: 'projects', projectId: null });
      return;
    }
    if (tab === activeTab && tab !== 'home') return;
    setSelectedProjectId(null);
    setActiveTab(tab);
    updateHistory({ tab, projectId: null });
  };

  const handleSelectProject = (id: string, initialSection?: string) => {
    if (isPublic) {
      setShowLoginModal(true);
      return;
    }
    setPreviousTab(activeTab);
    setSelectedProjectId(id);
    setActiveTab('projects');
    updateHistory({ tab: 'projects', projectId: id });

    if (initialSection) {
      setTimeout(() => {
        const el = document.getElementById(`section-${initialSection}`);
        if (el) {
          const headerOffset = 88;
          const elementTop = el.getBoundingClientRect().top + window.scrollY;
          window.scrollTo({ top: elementTop - headerOffset, behavior: 'smooth' });
        }
      }, 200);
    }
  };

  const handleTakeAction = (id: string) => {
    if (isPublic) {
      setShowLoginModal(true);
      return;
    }
    setPreviousTab(activeTab);
    setSelectedProjectId(id);
    setActiveTab('action-centre');
    updateHistory({ tab: 'action-centre', projectId: id });
  };

  const handleFilterStatus = (status: string) => {
    setProjectStatusFilter(status);
    setProjectRiskFilter('All');
    setStateFilter('All');
    setProjectSectorFilter('All');
    setProjectMinistryFilter('All');
    setProjectSearchFilter('');
    setStatusFilterNonce(prev => prev + 1);
    setSelectedProjectId(null);
    setActiveTab('projects');
    updateHistory({ tab: 'projects', projectId: null });
  };

  const handleFilterRisk = (risk: string) => {
    let mappedRisk = risk;
    if (risk.includes('Critical') || risk.toLowerCase().includes('crit')) mappedRisk = 'Critical';
    else if (risk.includes('High') || risk.toLowerCase().includes('high')) mappedRisk = 'High';
    else if (risk.includes('Med')) mappedRisk = 'Medium';
    else if (risk.includes('Low')) mappedRisk = 'Low';

    setProjectRiskFilter(mappedRisk);
    setProjectStatusFilter('All');
    setStateFilter('All');
    setProjectSectorFilter('All');
    setProjectMinistryFilter('All');
    setProjectSearchFilter('');
    setRiskFilterNonce(prev => prev + 1);
    setSelectedProjectId(null);
    setActiveTab('projects');
    updateHistory({ tab: 'projects', projectId: null });
  };

  const handleFilterState = (stateName: string) => {
    setStateFilter(stateName);
    setProjectStatusFilter('All');
    setProjectRiskFilter('All');
    setProjectSectorFilter('All');
    setProjectMinistryFilter('All');
    setProjectSearchFilter('');
    setStateFilterNonce(prev => prev + 1);
    setSelectedProjectId(null);
    setActiveTab('projects');
    updateHistory({ tab: 'projects', projectId: null });
  };

  const handleFilterSector = (sector: string) => {
    setProjectSectorFilter(sector);
    setProjectMinistryFilter('All');
    setStateFilter('All');
    setProjectStatusFilter('All');
    setProjectRiskFilter('All');
    setProjectSearchFilter('');
    setSectorFilterNonce(prev => prev + 1);
    setSelectedProjectId(null);
    setActiveTab('projects');
    updateHistory({ tab: 'projects', projectId: null });
  };

  const handleFilterMinistry = (ministry: string) => {
    setProjectMinistryFilter(ministry);
    setProjectSectorFilter('All');
    setStateFilter('All');
    setProjectStatusFilter('All');
    setProjectRiskFilter('All');
    setProjectSearchFilter('');
    setMinistryFilterNonce(prev => prev + 1);
    setSelectedProjectId(null);
    setActiveTab('projects');
    updateHistory({ tab: 'projects', projectId: null });
  };

  const handleFilterAgency = (agency: string) => {
    setProjectSearchFilter(agency);
    setProjectMinistryFilter('All');
    setProjectSectorFilter('All');
    setStateFilter('All');
    setProjectStatusFilter('All');
    setProjectRiskFilter('All');
    setSearchFilterNonce(prev => prev + 1);
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
        onOpenLoginModal={() => setShowLoginModal(true)}
      />

      {/* ── Main Application Content (Unified container) ── */}
      <div className="app-main-content">

        {/* ── Home ── */}
        <PageSlot id="home" activeTab={activeTab}>
          <Home
            activeTab={activeTab}
            onNavigateTab={handleTabChange}
            onFilterState={handleFilterState}
            onOpenLoginModal={() => setShowLoginModal(true)}
            homeClickNonce={homeClickNonce}
            isPublic={isPublic}
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
                <span>As of May 2026 — PAIMANA Portal</span>
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

            {/* Row 2: Priority Interventions (Top 10 Critical Projects - Click to view full details or take action) */}
            <section>
              <PriorityInterventions
                onSelectProject={handleSelectProject}
                onTakeAction={handleTakeAction}
              />
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
                onTakeAction={handleTakeAction}
                onFilterSector={handleFilterSector}
                onFilterMinistry={handleFilterMinistry}
                onFilterState={handleFilterState}
                onFilterAgency={handleFilterAgency}
              />
            ) : (
              <ProjectPortfolio
                onSelectProject={handleSelectProject}
                onTakeAction={handleTakeAction}
                initialStatus={projectStatusFilter}
                statusFilterNonce={statusFilterNonce}
                initialRisk={projectRiskFilter}
                riskFilterNonce={riskFilterNonce}
                initialState={stateFilter}
                stateFilterNonce={stateFilterNonce}
                initialSector={projectSectorFilter}
                sectorFilterNonce={sectorFilterNonce}
                initialMinistry={projectMinistryFilter}
                ministryFilterNonce={ministryFilterNonce}
                initialSearch={projectSearchFilter}
                searchFilterNonce={searchFilterNonce}
                targetMinistry={targetMinistry}
                targetAgency={targetAgency}
                isPublic={isPublic}
              />
            )}
          </main>
        </PageSlot>

        {/* ── Action Centre ── */}
        <PageSlot id="action-centre" activeTab={activeTab}>
          <main className="action-centre-content">
            <ActionCenter
              activeTab={activeTab}
              selectedProjectId={selectedProjectId}
              onSelectProject={handleSelectProject}
              onNavigateTab={handleTabChange}
              onTakeAction={handleTakeAction}
              onClearSelectedProject={() => setSelectedProjectId(null)}
              onCreateTicket={handleCreateTicket}
              targetMinistry={targetMinistry}
              targetAgency={targetAgency}
            />
          </main>
        </PageSlot>

        {/* ── Alerts & Signals ── */}
        <PageSlot id="alerts" activeTab={activeTab}>
          <main className="alerts-content">
            <AlertsPage
              onSelectProject={handleSelectProject}
              onTakeAction={handleTakeAction}
              ticketsList={ticketsList}
              onUpdateTicketStatus={handleUpdateTicketStatus}
              targetMinistry={targetMinistry}
              targetAgency={targetAgency}
            />
          </main>
        </PageSlot>

        {/* ── Distribution (Benchmark) ── */}
        <PageSlot id="distribution" activeTab={activeTab}>
          <main className="distribution-content">
            <ProjectDistribution
              activeTab={activeTab}
              onSelectProject={handleSelectProject}
              onNavigateTab={handleTabChange}
              onFilterStatus={handleFilterStatus}
              onFilterRisk={handleFilterRisk}
              targetMinistry={targetMinistry}
            />
          </main>
        </PageSlot>

        {/* ── Reporting Fidelity Index (Ghost Progress Audit) ── */}
        <PageSlot id="fidelity" activeTab={activeTab}>
          <main className="fidelity-content">
            <FidelityIndexDemo />
          </main>
        </PageSlot>

        {/* ── PDF Extractor (mospi_officer only) ── */}
        <PageSlot id="extractor" activeTab={activeTab}>
          <main className="extractor-content" style={{ padding: '24px 32px' }}>
            <PdfExtractor
              onNavigateTab={handleTabChange}
              onSelectProject={handleSelectProject}
            />
          </main>
        </PageSlot>
      </div>

      {/* Official Government MoSPI & PAIMANA Footer ending the page cleanly */}
      <Footer activeTab={activeTab} onNavigateTab={handleTabChange} />

      {/* Officer Sign-In Modal Overlay */}
      {showLoginModal && (
        <LoginPage
          onSuccess={() => setShowLoginModal(false)}
          onClose={() => setShowLoginModal(false)}
        />
      )}
    </div>
  );
}

// ── Root app: Public users always see MainApp immediately — no video intro gate ──
function AppGate() {
  const { isLoading, logout } = useAuth();

  useEffect(() => {
    const handleExpired = () => { logout(); };
    window.addEventListener('nd:auth:expired', handleExpired);
    return () => window.removeEventListener('nd:auth:expired', handleExpired);
  }, [logout]);

  if (isLoading) return null;

  // Always render MainApp — public users get public role via AuthContext.setPublicAccess()
  return <MainApp />;
}



// ── Main export ────────────────────────────────────────────────────────────
function App() {
  return (
    <AuthProvider>
      <AppGate />
    </AuthProvider>
  );
}

export default App;
