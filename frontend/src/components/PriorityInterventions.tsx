import React, { useState, useEffect } from 'react';
import './PriorityInterventions.css';
import { api } from '../services/api';

interface InterventionItem {
  id: string;
  project: string;
  riskScore: number;
  concern: string;
}

interface PriorityInterventionsProps {
  onSelectProject?: (projectId: string) => void;
}

export const PriorityInterventions: React.FC<PriorityInterventionsProps> = ({ onSelectProject }) => {
  const [items, setItems] = useState<InterventionItem[] | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<boolean>(false);

  useEffect(() => {
    let isMounted = true;
    api.getDashboardSummary().then((res) => {
      if (!isMounted) return;
      if (res && res.priority_interventions) {
        setItems(res.priority_interventions.map(item => ({
          id: item.id,
          project: item.project,
          riskScore: item.riskScore,
          concern: item.concern,
        })));
        setError(false);
      } else {
        setError(true);
      }
      setLoading(false);
    }).catch(() => {
      if (isMounted) {
        setError(true);
        setLoading(false);
      }
    });

    return () => {
      isMounted = false;
    };
  }, []);

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
      </div>

      <div className="table-responsive">
        {loading ? (
          <div style={{ padding: '30px', textAlign: 'center', color: '#94A3B8', fontSize: '13px' }}>
            Loading priority interventions...
          </div>
        ) : error || !items ? (
          <div style={{ padding: '30px', textAlign: 'center', color: '#EF4444', fontSize: '13px' }}>
            Unable to load data from backend.
          </div>
        ) : items.length === 0 ? (
          <div style={{ padding: '30px', textAlign: 'center', color: '#64748B', fontSize: '13px' }}>
            No priority interventions required at this time.
          </div>
        ) : (
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
                    <button 
                      className="review-btn" 
                      onClick={() => onSelectProject && onSelectProject(item.id)}
                    >
                      Review
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};
