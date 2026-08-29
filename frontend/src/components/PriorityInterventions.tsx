import React from 'react';
import './PriorityInterventions.css';

interface InterventionItem {
  id: string;
  project: string;
  riskScore: number;
  concern: string;
}

export const PriorityInterventions: React.FC = () => {
  const items: InterventionItem[] = [
    { id: 'mumbai-metro', project: 'Mumbai Metro Line 3', riskScore: 92, concern: 'Clearance' },
    { id: 'eastern-freight', project: 'Eastern Freight Corridor', riskScore: 88, concern: 'Land Acq.' },
    { id: 'solar-park', project: 'Solar Park X', riskScore: 78, concern: 'Contractor' },
    { id: 'highway-y', project: 'National Highway Y', riskScore: 71, concern: 'Fund Flow' },
    { id: 'water-phase-2', project: 'Water Supply Phase 2', riskScore: 65, concern: 'Procurement' },
  ];

  const getRiskBadgeClass = (score: number) => {
    if (score >= 80) return 'badge-critical';
    if (score >= 70) return 'badge-warning';
    return 'badge-info';
  };

  return (
    <div className="card interventions-card">
      <div className="interventions-header">
        <div>
          <h2 className="card-title">Priority Interventions</h2>
          <p className="card-subtitle">High-risk projects</p>
        </div>
        <button className="view-all-link" onClick={() => alert('View All clicked')}>
          View All
        </button>
      </div>

      <div className="table-responsive">
        <table className="interventions-table">
          <thead>
            <tr>
              <th className="th-project">PROJECT</th>
              <th className="th-risk">RISK</th>
              <th className="th-concern">CONCERN</th>
              <th className="th-action">ACTION</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id}>
                <td className="td-project">{item.project}</td>
                <td className="td-risk">
                  <span className={`risk-badge ${getRiskBadgeClass(item.riskScore)}`}>
                    {item.riskScore}/100
                  </span>
                </td>
                <td className="td-concern">{item.concern}</td>
                <td className="td-action">
                  <button className="review-btn" onClick={() => alert(`Reviewing ${item.project}`)}>
                    Review
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
