/**
 * Sanket-AI API Service Layer.
 * Connects the frontend React UI to the FastAPI PostgreSQL Backend (http://localhost:8080/api).
 * Single Source of Truth: All metrics, calculations, and data originate strictly from PostgreSQL/AI backend.
 */

import { type Project, type ProjectBenchmark } from '../data/projectsData';

const API_BASE_URL = (import.meta.env.VITE_API_URL as string) || 'http://localhost:8080/api';

export interface DashboardSummaryData {
  metrics: {
    total_projects: number;
    total_projects_subtext: string;
    total_original_cost: number;
    total_original_cost_formatted: string;
    total_revised_cost: number;
    total_revised_cost_formatted: string;
    cost_overrun_percentage: number;
    cost_overrun_formatted: string;
  };
  health_distribution: Array<{
    id: string;
    name: string;
    count: number;
    color: string;
    percentage: number;
  }>;
  priority_interventions: Array<{
    id: string;
    project: string;
    riskScore: number;
    concern: string;
  }>;
  delay_factors: Array<{
    id: string;
    label: string;
    impact: string;
    percentage: number;
    color: string;
  }>;
  risk_trend: {
    cost: { path: string; fillPath: string; points: Array<{ x: number; y: number; label: string; value: string }> };
    time: { path: string; fillPath: string; points: Array<{ x: number; y: number; label: string; value: string }> };
    impl: { path: string; fillPath: string; points: Array<{ x: number; y: number; label: string; value: string }> };
  };
  ai_action_center: {
    total_interventions_needed: number;
    critical_count: number;
    high_count: number;
    medium_count: number;
    critical_pct: number;
    high_pct: number;
    medium_pct: number;
    actions: Array<{ id: string; category: string; detail: string }>;
  };
  total_projects: number;
  as_of_date: string;
}

export interface RiskSummaryData {
  total_analyzed: number;
  high_risk_count: number;
  high_risk_pct: number;
  time_overrun_count: number;
  time_overrun_pct: number;
  cost_overrun_count: number;
  cost_overrun_pct: number;
  early_warning_count: number;
  early_warning_pct: number;
  low_risk_count: number;
  low_risk_pct: number;
  avg_risk_score: number;
  distribution_categories: Array<{ category: string; count: number; color: string }>;
}

export interface DistributionSummaryData {
  total: number;
  high: number;
  highPct: string;
  medium: number;
  mediumPct: string;
  low: number;
  lowPct: string;
  sectors: Array<{
    name: string;
    total: number;
    high: number;
    highPct: number;
    medium: number;
    mediumPct: number;
    low: number;
    lowPct: number;
    avgRisk: number;
  }>;
}

export interface ActionCenterData {
  total_projects_requiring_intervention: number;
  critical_count: number;
  high_count: number;
  medium_count: number;
  total_financial_exposure_formatted: string;
  total_delay_exposure_formatted: string;
  action_items: Array<{
    id: number;
    project: string;
    projectId: string;
    ministry: string;
    riskEvent: string;
    severity: 'Critical' | 'High' | 'Medium';
    priorityScore: number;
    financialExposure: string;
    delayExposure: string;
    overdue: string;
    dueDate: string;
    status: 'Open' | 'In Progress' | 'Pending';
  }>;
  simulator_scenarios: Record<string, {
    currentDelay: string;
    currentCost: string;
    projDelay: string;
    projDelayReduction: string;
    projSaving: string;
    confidence: number;
  }>;
  prioritization_weights: Array<{
    label: string;
    pct: number;
    color: string;
  }>;
}

export interface RiskPredictionData {
  id?: number;
  project_id: string;
  prediction_date: string;
  horizon_months: number;
  risk_score: number;
  risk_level: string;
  cost_overrun_probability: number;
  time_overrun_probability: number;
  predicted_additional_overrun_pct: number;
  predicted_additional_cost_crore: number;
  predicted_final_cost_overrun_pct: number;
  predicted_final_revised_cost_crore: number;
  predicted_additional_delay_months: number;
  predicted_total_schedule_extension_months: number;
  tentative_completion_date: string;
  estimated_time_needed: string;
  top_risk_drivers: Array<{
    feature: string;
    label: string;
    shap_value: number;
  }>;
  top_protective_factors: Array<{
    feature: string;
    label: string;
    shap_value: number;
  }>;
  explanation: string;
  model_version: string;
}

export interface AIExplanationData {
  prediction: any;
  narrative: {
    stage_case?: string;
    alerts_title?: string;
    summary: string;
    key_alerts: Array<{
      issue: string;
      evidence: string;
      why_it_matters: string;
    }>;
    provider?: string;
  };
}

export const api = {
  /**
   * System & Database Health Check
   */
  async getHealth(): Promise<{ status: string; database: string }> {
    const res = await fetch(`${API_BASE_URL}/health`);
    if (!res.ok) throw new Error('Health check failed');
    return await res.json();
  },

  /**
   * Fetch National Infrastructure Dashboard Aggregates
   */
  async getDashboardSummary(): Promise<DashboardSummaryData | null> {
    try {
      const res = await fetch(`${API_BASE_URL}/dashboard/summary`);
      if (!res.ok) return null;
      return await res.json();
    } catch (e) {
      console.error('API Error: getDashboardSummary', e);
      return null;
    }
  },

  /**
   * Fetch Paginated Projects directly from PostgreSQL
   */
  async getProjects(page = 1, pageSize = 50, search = '', ministryId?: number, sectorId?: number, scheduleStatus?: string): Promise<{ items: Project[]; total: number }> {
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        page_size: pageSize.toString()
      });
      if (search) params.append('search', search);
      if (ministryId !== undefined) params.append('ministry_id', ministryId.toString());
      if (sectorId !== undefined) params.append('sector_id', sectorId.toString());
      if (scheduleStatus && scheduleStatus !== 'All') params.append('schedule_status', scheduleStatus);

      const res = await fetch(`${API_BASE_URL}/projects?${params.toString()}`);
      if (!res.ok) return { items: [], total: 0 };
      const data = await res.json();

      const mapped: Project[] = (data.items || []).map((p: any) => ({
        id: p.id,
        name: p.name,
        ministry: p.ministry?.name || 'Ministry of Infrastructure',
        sector: p.sector?.name || 'Infrastructure',
        location: p.location || p.state || 'India',
        agency: p.implementing_agency || 'Government of India',
        costApproved: p.costApproved || `₹${p.original_cost || 0} Cr`,
        costRevised: p.costRevised || `₹${p.revised_cost || 0} Cr`,
        costExpenditure: p.costExpenditure || `₹${p.cumulative_expenditure || 0} Cr`,
        costOverrunPct: p.costOverrunFormatted || `${p.cost_overrun_pct || 0}%`,
        progressPhysical: p.physical_progress || 0,
        progressPhysicalTarget: p.physical_progress_target || p.physical_progress || 0,
        progressFinancial: p.financial_progress || 0,
        expectedCompletion: p.expectedCompletionFormatted || 'N/A',
        originalCompletion: p.originalCompletionFormatted || 'N/A',
        startDate: p.startDateFormatted || 'N/A',
        phase: p.phase || 'Construction',
        type: p.type || 'Infrastructure',
        scheduleStatus: p.schedule_status || 'ON TRACK',
        costLabel: p.costLabel || `₹${p.revised_cost || 0} Cr`,
        costSubtext: p.costSubtext || '',
        riskScore: p.risk_score || 30,
        riskLevel: p.risk_level || 'Low',
        description: p.description || '',
        costRisk: p.cost_risk || 20,
        timeRisk: p.time_risk || 20,
        implRisk: p.impl_risk || 20,
        overallRisk: p.overall_risk || 20,
      }));

      return { items: mapped, total: data.total || 0 };
    } catch (e) {
      console.error('API Error: getProjects', e);
      return { items: [], total: 0 };
    }
  },

  /**
   * Fetch Single Project Live Details
   */
  async getProjectById(projectId: string): Promise<Project | null> {
    try {
      const res = await fetch(`${API_BASE_URL}/projects/${projectId}`);
      if (!res.ok) return null;
      const p = await res.json();
      return {
        id: p.id,
        name: p.name,
        ministry: p.ministry?.name || 'Ministry of Infrastructure',
        sector: p.sector?.name || 'Infrastructure',
        location: p.location || p.state || 'India',
        agency: p.implementing_agency || 'Government of India',
        costApproved: p.costApproved || `₹${p.original_cost || 0} Cr`,
        costRevised: p.costRevised || `₹${p.revised_cost || 0} Cr`,
        costExpenditure: p.costExpenditure || `₹${p.cumulative_expenditure || 0} Cr`,
        costOverrunPct: p.costOverrunFormatted || `${p.cost_overrun_pct || 0}%`,
        progressPhysical: p.physical_progress || 0,
        progressPhysicalTarget: p.physical_progress_target || p.physical_progress || 0,
        progressFinancial: p.financial_progress || 0,
        expectedCompletion: p.expectedCompletionFormatted || 'N/A',
        originalCompletion: p.originalCompletionFormatted || 'N/A',
        startDate: p.startDateFormatted || 'N/A',
        phase: p.phase || 'Construction',
        type: p.type || 'Infrastructure',
        scheduleStatus: p.schedule_status || 'ON TRACK',
        costLabel: p.costLabel || `₹${p.revised_cost || 0} Cr`,
        costSubtext: p.costSubtext || '',
        riskScore: p.risk_score || 30,
        riskLevel: p.risk_level || 'Low',
        description: p.description || '',
        costRisk: p.cost_risk || 20,
        timeRisk: p.time_risk || 20,
        implRisk: p.impl_risk || 20,
        overallRisk: p.overall_risk || 20,
      };
    } catch (e) {
      console.error('API Error: getProjectById', e);
      return null;
    }
  },

  /**
   * Fetch Live Benchmark Peer Comparison for Project
   */
  async getProjectBenchmark(projectId: string): Promise<ProjectBenchmark | null> {
    try {
      const res = await fetch(`${API_BASE_URL}/benchmark/${projectId}`);
      if (!res.ok) return null;
      return await res.json();
    } catch (e) {
      console.error('API Error: getProjectBenchmark', e);
      return null;
    }
  },

  /**
   * Fetch National Risk Analysis Summary
   */
  async getRiskSummary(): Promise<RiskSummaryData | null> {
    try {
      const res = await fetch(`${API_BASE_URL}/risk/summary`);
      if (!res.ok) return null;
      return await res.json();
    } catch (e) {
      console.error('API Error: getRiskSummary', e);
      return null;
    }
  },

  /**
   * Fetch High Risk Projects List
   */
  async getHighRiskProjects(limit = 50): Promise<Project[]> {
    try {
      const res = await fetch(`${API_BASE_URL}/risk/high-risk?limit=${limit}`);
      if (!res.ok) return [];
      const items = await res.json();
      return items.map((p: any) => ({
        id: p.id,
        name: p.name,
        ministry: p.ministry?.name || 'Ministry of Infrastructure',
        sector: p.sector?.name || 'Infrastructure',
        location: p.location || p.state || 'India',
        agency: p.implementing_agency || 'Government of India',
        costApproved: p.costApproved || `₹${p.original_cost || 0} Cr`,
        costRevised: p.costRevised || `₹${p.revised_cost || 0} Cr`,
        costExpenditure: p.costExpenditure || `₹${p.cumulative_expenditure || 0} Cr`,
        costOverrunPct: p.costOverrunFormatted || `${p.cost_overrun_pct || 0}%`,
        progressPhysical: p.physical_progress || 0,
        progressPhysicalTarget: p.physical_progress_target || p.physical_progress || 0,
        progressFinancial: p.financial_progress || 0,
        expectedCompletion: p.expectedCompletionFormatted || 'N/A',
        originalCompletion: p.originalCompletionFormatted || 'N/A',
        startDate: p.startDateFormatted || 'N/A',
        phase: p.phase || 'Construction',
        type: p.type || 'Infrastructure',
        scheduleStatus: p.schedule_status || 'CRITICAL',
        costLabel: p.costLabel || `₹${p.revised_cost || 0} Cr`,
        costSubtext: p.costSubtext || '',
        riskScore: p.risk_score || 80,
        riskLevel: p.risk_level || 'High',
        description: p.description || '',
        costRisk: p.cost_risk || 80,
        timeRisk: p.time_risk || 80,
        implRisk: p.impl_risk || 70,
        overallRisk: p.overall_risk || 80,
      }));
    } catch (e) {
      console.error('API Error: getHighRiskProjects', e);
      return [];
    }
  },

  /**
   * Fetch Action Centre Summary & Queue
   */
  async getActionCenterSummary(): Promise<ActionCenterData | null> {
    try {
      const res = await fetch(`${API_BASE_URL}/alerts/summary`);
      if (!res.ok) return null;
      return await res.json();
    } catch (e) {
      console.error('API Error: getActionCenterSummary', e);
      return null;
    }
  },

  /**
   * Fetch Sectoral & Geographical Distribution Summary
   */
  async getDistributionSummary(): Promise<DistributionSummaryData | null> {
    try {
      const res = await fetch(`${API_BASE_URL}/distribution/summary`);
      if (!res.ok) return null;
      return await res.json();
    } catch (e) {
      console.error('API Error: getDistributionSummary', e);
      return null;
    }
  },

  /**
   * Fetch Ministries and Sectors
   */
  async getMinistries(): Promise<Array<{ id: number; name: string; code: string; total_projects: number }>> {
    try {
      const res = await fetch(`${API_BASE_URL}/projects/ministries`);
      if (!res.ok) return [];
      return await res.json();
    } catch (e) {
      console.error('API Error: getMinistries', e);
      return [];
    }
  },

  async getSectors(): Promise<Array<{ id: number; name: string; code: string; total_projects: number }>> {
    try {
      const res = await fetch(`${API_BASE_URL}/projects/sectors`);
      if (!res.ok) return [];
      return await res.json();
    } catch (e) {
      console.error('API Error: getSectors', e);
      return [];
    }
  },

  /**
   * Export Action Plan as CSV
   */
  async exportActionPlan(): Promise<boolean> {
    try {
      const res = await fetch(`${API_BASE_URL}/alerts/export`);
      if (!res.ok) throw new Error('Export endpoint returned error');

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `action_centre_report_${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      return true;
    } catch (e) {
      console.error('API Export Error:', e);
      return false;
    }
  },

  /**
   * Fetch AI Insights Summary
   */
  async getInsightsSummary(): Promise<any | null> {
    try {
      const res = await fetch(`${API_BASE_URL}/insights/summary`);
      if (!res.ok) return null;
      return await res.json();
    } catch (e) {
      console.error('API Error: getInsightsSummary', e);
      return null;
    }
  },



  /**
   * Execute real XGBoost ML model prediction for a project
   */
  async getProjectRisk(projectId: string, horizon = 3): Promise<RiskPredictionData | null> {
    try {
      const res = await fetch(`${API_BASE_URL}/risk/projects/${projectId}/predict?horizon=${horizon}`, {
        method: 'POST',
      });
      if (!res.ok) return null;
      return await res.json();
    } catch (e) {
      console.error('API Error: getProjectRisk', e);
      return null;
    }
  },

  /**
   * Retrieve SHAP risk drivers and protective forces
   */
  async getProjectDrivers(projectId: string): Promise<{ top_risk_drivers: any[]; top_protective_factors: any[] } | null> {
    try {
      const res = await fetch(`${API_BASE_URL}/risk/projects/${projectId}/drivers`);
      if (!res.ok) return null;
      return await res.json();
    } catch (e) {
      console.error('API Error: getProjectDrivers', e);
      return null;
    }
  },

  /**
   * Generate Qwen + XGBoost + SHAP Grounded Narrative Explanation for Project
   */
  async explainProject(projectId: string): Promise<AIExplanationData | null> {
    try {
      const res = await fetch(`${API_BASE_URL}/assistant/explain/${projectId}`, {
        method: 'POST',
      });
      if (!res.ok) return null;
      return await res.json();
    } catch (e) {
      console.error('API Error: explainProject', e);
      return null;
    }
  },

  /**
   * Ask Assistant
   */
  async queryAssistant(query: string, projectId?: string) {
    try {
      const res = await fetch(`${API_BASE_URL}/assistant/query`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, project_id: projectId }),
      });
      if (!res.ok) throw new Error('Assistant query failed');
      return await res.json();
    } catch (e) {
      console.error('API Error: queryAssistant', e);
      return null;
    }
  }
};
