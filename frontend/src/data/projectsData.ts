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

export const projectsData: Project[] = [
  {
    id: 'mumbai-metro-3',
    name: 'Mumbai Metro Phase III',
    ministry: 'Ministry of Railways',
    sector: 'Metro Rail',
    location: 'Mumbai, Maharashtra',
    agency: 'MMRC',
    costApproved: '₹850.00 Cr',
    costRevised: '₹920.00 Cr',
    costExpenditure: '₹640.00 Cr',
    costOverrunPct: '+8.24% overrun',
    progressPhysical: 52,
    progressPhysicalTarget: 55,
    progressFinancial: 70,
    expectedCompletion: 'Dec 2027',
    originalCompletion: 'Jan 2027',
    startDate: '15 Jan 2021',
    phase: 'Construction',
    type: 'Urban Rail',
    scheduleStatus: 'CRITICAL',
    costLabel: '₹920.00 Cr',
    costSubtext: '▲ 8.24%',
    riskScore: 87,
    riskLevel: 'High',
    description: 'Metro Line 3 is a 33.5 km long corridor running along Colaba-Bandra-SEEPZ. The project focuses on improving public transit capacity in Mumbai, reducing traffic congestion, and connecting major commercial hubs.',
    costRisk: 82,
    timeRisk: 91,
    implRisk: 76,
    overallRisk: 87
  },
  {
    id: 'mumbai-ahmedabad-bullet',
    name: 'Mumbai-Ahmedabad High Speed Rail',
    ministry: 'Railways',
    sector: 'High Speed Rail',
    location: 'Maharashtra/Gujarat',
    agency: 'NHSRCL',
    costApproved: '₹96,000 Cr',
    costRevised: '₹1,08,000 Cr',
    costExpenditure: '₹41,000 Cr',
    costOverrunPct: '+12% overrun',
    progressPhysical: 45,
    progressPhysicalTarget: 48,
    progressFinancial: 38,
    expectedCompletion: 'Aug 2028',
    originalCompletion: 'Dec 2023',
    startDate: '01 Jun 2018',
    phase: 'Construction',
    type: 'High Speed Rail',
    scheduleStatus: 'DELAYED',
    costLabel: '₹1,08,000 Cr',
    costSubtext: '+12% Rev',
    riskScore: 78,
    riskLevel: 'High',
    description: 'Mumbai-Ahmedabad High Speed Rail is India\'s first high-speed rail corridor connecting Mumbai with Ahmedabad. The project covers a distance of 508 km and runs through the states of Maharashtra and Gujarat.',
    costRisk: 75,
    timeRisk: 85,
    implRisk: 68,
    overallRisk: 78
  },
  {
    id: 'eastern-dedicated-freight',
    name: 'Eastern Dedicated Freight Corridor',
    ministry: 'Railways',
    sector: 'Freight Corridor',
    location: 'Multiple States',
    agency: 'DFCCIL',
    costApproved: '₹81,459 Cr',
    costRevised: '₹81,459 Cr',
    costExpenditure: '₹71,680 Cr',
    costOverrunPct: 'Baseline',
    progressPhysical: 92,
    progressPhysicalTarget: 92,
    progressFinancial: 88,
    expectedCompletion: 'Dec 2026',
    originalCompletion: 'Dec 2026',
    startDate: '10 Feb 2017',
    phase: 'Commissioning',
    type: 'Freight Rail',
    scheduleStatus: 'ON TRACK',
    costLabel: '₹81,459 Cr',
    costSubtext: 'Baseline',
    riskScore: 28,
    riskLevel: 'Low',
    description: 'The Eastern Dedicated Freight Corridor (EDFC) is a freight-only railway line covering 1,875 km between Ludhiana in Punjab and Dankuni in West Bengal. It is designed to speed up freight transit and support logistics industries.',
    costRisk: 25,
    timeRisk: 30,
    implRisk: 22,
    overallRisk: 28
  }
];
