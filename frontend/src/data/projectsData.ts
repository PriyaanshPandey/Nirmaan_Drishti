export interface Project {
  id: string;
  name: string;
  ministry: string;
  sector: string;
  location: string;
  agency: string;
  costApproved: string;
  costRevised: string;
  costExpenditure: string;
  costOverrunPct: string;
  progressPhysical: number;
  progressPhysicalTarget: number;
  progressFinancial: number;
  expectedCompletion: string;
  originalCompletion: string;
  startDate: string;
  phase: string;
  type: string;
  scheduleStatus: 'DELAYED' | 'ON TRACK' | 'CRITICAL';
  costLabel: string;
  costSubtext: string;
  riskScore: number; // 0 to 100
  riskLevel: 'Low' | 'Medium' | 'High' | 'Critical';
  description: string;
  
  // Dials / Risks
  costRisk: number;
  timeRisk: number;
  implRisk: number;
  overallRisk: number;
}

export interface ProjectMilestone {
  id: number;
  name: string;
  target_date?: string;
  actual_date?: string;
  status: string;
  delay_months?: number;
}

export interface ProjectBenchmark {
  project_id: string;
  project_name: string;
  sector_name: string;
  cost_benchmark: Array<{ label: string; projectVal: string; avg: string; benchmark: string; isAlert?: boolean }>;
  delay_benchmark: Array<{ label: string; projectVal: string; avg: string; benchmark: string; isAlert?: boolean }>;
  tech_benchmark: Array<{ label: string; projectVal: string; avg: string; benchmark: string; isAlert?: boolean }>;
  recommendation: string;
}

