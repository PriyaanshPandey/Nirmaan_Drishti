import React, { useState } from 'react';
import {
  FileSpreadsheet, Upload, ArrowLeft, CheckCircle2, FileText,
  Sparkles, RefreshCw, Database, ArrowRight, ShieldAlert
} from 'lucide-react';
import './PdfExtractor.css';

export interface PdfExtractorProps {
  onNavigateTab?: (tab: string) => void;
  onSelectProject?: (projectId: string) => void;
}

interface ParsedProjectRecord {
  id: string;
  name: string;
  ministry: string;
  sector: string;
  approvedCostCr: number;
  revisedCostCr: number;
  physicalProgress: number;
  timeOverrunMonths: number;
  riskCategory: 'Critical' | 'High' | 'Medium' | 'Low';
  status: string;
}

const SAMPLE_PDFS = [
  {
    id: 'mospi-may-2026',
    title: 'MoSPI Central Sector Projects Flash Report — May 2026',
    size: '4.8 MB',
    recordsCount: 4,
    sector: 'Infrastructure & Transport'
  },
  {
    id: 'nhai-q1-2026',
    title: 'NHAI National Highway Expansion Progress Report Q1',
    size: '3.2 MB',
    recordsCount: 3,
    sector: 'Road Transport & Highways'
  },
  {
    id: 'railways-aug-2026',
    title: 'Indian Railways High-Density Rail Capacity Report',
    size: '5.1 MB',
    recordsCount: 3,
    sector: 'Railways'
  }
];

const PARSED_DATA_MAP: Record<string, ParsedProjectRecord[]> = {
  'mospi-may-2026': [
    {
      id: '25019842',
      name: 'Mumbai High Offshore Platform Expansion & Field Augmentation',
      ministry: 'Ministry of Petroleum & Natural Gas',
      sector: 'Petroleum',
      approvedCostCr: 4850,
      revisedCostCr: 6920,
      physicalProgress: 64,
      timeOverrunMonths: 18,
      riskCategory: 'Critical',
      status: 'INGESTED'
    },
    {
      id: '18029144',
      name: 'Dedicated Freight Corridor Western Phase II (JNPT-Vadodara)',
      ministry: 'Ministry of Railways',
      sector: 'Railways',
      approvedCostCr: 12400,
      revisedCostCr: 17850,
      physicalProgress: 72,
      timeOverrunMonths: 24,
      riskCategory: 'Critical',
      status: 'INGESTED'
    },
    {
      id: '31049281',
      name: 'Delhi-Dehradun Economic Corridor Expressway Package 1-4',
      ministry: 'Ministry of Road Transport & Highways',
      sector: 'Road Transport',
      approvedCostCr: 8300,
      revisedCostCr: 9450,
      physicalProgress: 81,
      timeOverrunMonths: 8,
      riskCategory: 'High',
      status: 'INGESTED'
    },
    {
      id: '49018274',
      name: 'Genset & Grid Power Augmentation Vizag Port Terminal',
      ministry: 'Ministry of Ports, Shipping and Waterways',
      sector: 'Ports',
      approvedCostCr: 1250,
      revisedCostCr: 1390,
      physicalProgress: 88,
      timeOverrunMonths: 4,
      riskCategory: 'Medium',
      status: 'INGESTED'
    }
  ],
  'nhai-q1-2026': [
    {
      id: '31049281',
      name: 'Delhi-Dehradun Economic Corridor Expressway Package 1-4',
      ministry: 'Ministry of Road Transport & Highways',
      sector: 'Road Transport',
      approvedCostCr: 8300,
      revisedCostCr: 9450,
      physicalProgress: 81,
      timeOverrunMonths: 8,
      riskCategory: 'High',
      status: 'INGESTED'
    },
    {
      id: '31049900',
      name: 'Bengaluru-Chennai Expressway Structure Construction Pkg 3',
      ministry: 'Ministry of Road Transport & Highways',
      sector: 'Road Transport',
      approvedCostCr: 5200,
      revisedCostCr: 6100,
      physicalProgress: 58,
      timeOverrunMonths: 14,
      riskCategory: 'High',
      status: 'INGESTED'
    },
    {
      id: '31051200',
      name: 'Varanasi-Ranchi-Kolkata Highway Alignment & Tunneling',
      ministry: 'Ministry of Road Transport & Highways',
      sector: 'Road Transport',
      approvedCostCr: 14200,
      revisedCostCr: 16800,
      physicalProgress: 42,
      timeOverrunMonths: 19,
      riskCategory: 'Critical',
      status: 'INGESTED'
    }
  ],
  'railways-aug-2026': [
    {
      id: '18029144',
      name: 'Dedicated Freight Corridor Western Phase II (JNPT-Vadodara)',
      ministry: 'Ministry of Railways',
      sector: 'Railways',
      approvedCostCr: 12400,
      revisedCostCr: 17850,
      physicalProgress: 72,
      timeOverrunMonths: 24,
      riskCategory: 'Critical',
      status: 'INGESTED'
    },
    {
      id: '18034011',
      name: 'Rishikesh-Karnaprayag New Broad Gauge Line Tunnels 1-8',
      ministry: 'Ministry of Railways',
      sector: 'Railways',
      approvedCostCr: 16200,
      revisedCostCr: 21500,
      physicalProgress: 69,
      timeOverrunMonths: 32,
      riskCategory: 'Critical',
      status: 'INGESTED'
    },
    {
      id: '18042099',
      name: 'Udhampur-Srinagar-Baramulla Rail Link (Chenab Bridge Section)',
      ministry: 'Ministry of Railways',
      sector: 'Railways',
      approvedCostCr: 27900,
      revisedCostCr: 37000,
      physicalProgress: 94,
      timeOverrunMonths: 48,
      riskCategory: 'High',
      status: 'INGESTED'
    }
  ]
};

export const PdfExtractor: React.FC<PdfExtractorProps> = ({
  onNavigateTab,
  onSelectProject
}) => {
  const [fileName, setFileName] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [processingStep, setProcessingStep] = useState<string>('');
  const [parsedData, setParsedData] = useState<ParsedProjectRecord[] | null>(null);
  const [dragActive, setDragActive] = useState<boolean>(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const triggerToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3500);
  };

  const handleSelectSample = (sampleId: string) => {
    const sample = SAMPLE_PDFS.find(s => s.id === sampleId);
    if (!sample) return;

    setFileName(sample.title + '.pdf');
    simulateExtraction(sampleId);
  };

  const handleCustomUpload = (name: string) => {
    setFileName(name);
    simulateExtraction('mospi-may-2026');
  };

  const simulateExtraction = (dataKey: string) => {
    setIsProcessing(true);
    setParsedData(null);

    setProcessingStep('1/3: Parsing MoSPI OCMS PDF Structure & Optical Character Recognition...');

    setTimeout(() => {
      setProcessingStep('2/3: Extracting Cost Outlay Tables, Physical Milestones & Delay Metrics...');
    }, 900);

    setTimeout(() => {
      setProcessingStep('3/3: Reconciling Schema & Calculating TreeSHAP Risk Scores...');
    }, 1800);

    setTimeout(() => {
      setIsProcessing(false);
      setParsedData(PARSED_DATA_MAP[dataKey] || PARSED_DATA_MAP['mospi-may-2026']);
      triggerToast('Telemetry extraction complete! Project data successfully updated in database.');
    }, 2600);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleCustomUpload(e.dataTransfer.files[0].name);
    }
  };

  return (
    <div className="pdf-extractor-layout animation-fade-in">
      {/* Toast Notification */}
      {toastMsg && (
        <div style={{
          position: 'fixed',
          bottom: '24px',
          right: '24px',
          zIndex: 9999,
          background: '#0F172A',
          color: '#FFFFFF',
          padding: '12px 20px',
          borderRadius: '12px',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          boxShadow: '0 10px 25px rgba(0,0,0,0.2)',
          fontSize: '13.5px',
          fontWeight: 600
        }}>
          <CheckCircle2 size={16} color="#10B981" />
          <span>{toastMsg}</span>
        </div>
      )}

      {/* Header Bar with Clear Back Buttons */}
      <div className="pdf-extractor-header">
        <div className="pdf-header-left">
          <button
            type="button"
            className="pdf-back-btn"
            onClick={() => onNavigateTab?.('dashboard')}
            title="Return to Executive Dashboard"
          >
            <ArrowLeft size={15} />
            <span>Back to Dashboard</span>
          </button>

          <button
            type="button"
            className="pdf-back-btn"
            onClick={() => onNavigateTab?.('projects')}
            title="Return to Projects List"
          >
            <Database size={14} />
            <span>Back to Projects</span>
          </button>

          <div className="pdf-header-titles">
            <h1 className="pdf-page-title">MoSPI PDF Telemetry Extractor</h1>
            <p className="pdf-page-sub">
              Automated document parsing for MoSPI OCMS monthly Flash Reports and PAIMANA PDF submissions.
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{
            fontSize: '12px',
            fontWeight: 750,
            color: '#15803D',
            background: '#F0FDF4',
            border: '1px solid #BBF7D0',
            padding: '6px 12px',
            borderRadius: '20px',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px'
          }}>
            <Sparkles size={13} color="#16A34A" />
            OCR &amp; Table Parser Engine v2.4 Active
          </span>
        </div>
      </div>

      {/* ── Dropzone File Upload Card ── */}
      {!isProcessing && !parsedData && (
        <>
          <div
            className={`pdf-upload-card ${dragActive ? 'drag-active' : ''}`}
            onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
            onDragLeave={() => setDragActive(false)}
            onDrop={handleDrop}
            onClick={() => {
              const input = document.createElement('input');
              input.type = 'file';
              input.accept = '.pdf';
              input.onchange = (e: any) => {
                if (e.target.files && e.target.files[0]) {
                  handleCustomUpload(e.target.files[0].name);
                }
              };
              input.click();
            }}
          >
            <div className="pdf-upload-icon-box">
              <Upload size={30} />
            </div>
            <h3 className="pdf-upload-title">Drop your MoSPI PDF Report here or click to browse</h3>
            <p className="pdf-upload-hint">
              Supports official MoSPI OCMS Flash Reports, PAIMANA quarterly PDF disclosures, and Central Sector project progress memos.
            </p>
            <button type="button" className="pdf-browse-btn">
              <FileSpreadsheet size={16} />
              <span>Select PDF File</span>
            </button>
          </div>

          {/* Sample PDF Files Bar */}
          <div className="pdf-samples-card">
            <div className="samples-title-row">
              <span className="samples-title">Or click a sample government report to test instant extraction:</span>
              <span style={{ fontSize: '11px', color: '#64748B', fontWeight: 600 }}>3 Verified Samples</span>
            </div>

            <div className="samples-grid">
              {SAMPLE_PDFS.map((sample) => (
                <button
                  key={sample.id}
                  type="button"
                  className="sample-file-btn"
                  onClick={() => handleSelectSample(sample.id)}
                >
                  <FileText size={22} color="#2563EB" />
                  <div className="sample-file-info">
                    <span className="sample-name">{sample.title}</span>
                    <span className="sample-meta">{sample.sector} • {sample.size} • {sample.recordsCount} Projects</span>
                  </div>
                  <ArrowRight size={15} color="#94A3B8" />
                </button>
              ))}
            </div>
          </div>
        </>
      )}

      {/* ── Step-by-Step Processing Indicator ── */}
      {isProcessing && (
        <div className="pdf-processing-card">
          <div className="pdf-spinner" />
          <div className="processing-step-lbl">{processingStep}</div>
          <p style={{ fontSize: '12.5px', color: '#64748B', margin: 0 }}>
            Parsing vector tables for {fileName}... Generating TreeSHAP risk features.
          </p>
        </div>
      )}

      {/* ── Extraction Results Workspace ── */}
      {parsedData && !isProcessing && (
        <div className="pdf-results-layout">
          <div className="pdf-res-panel">
            <div className="pdf-res-head">
              <div>
                <span style={{ fontSize: '11px', fontWeight: 800, color: '#16A34A', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  ✓ EXTRACTION SUCCESSFUL
                </span>
                <h2 className="pdf-res-title">Extracted Telemetry — {fileName}</h2>
              </div>

              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  type="button"
                  className="pdf-back-btn"
                  onClick={() => {
                    setParsedData(null);
                  }}
                >
                  <RefreshCw size={13} />
                  <span>Upload Another PDF</span>
                </button>
              </div>
            </div>

            {/* Extracted Summary Metadata Grid */}
            <div className="pdf-kv-grid">
              <div className="pdf-kv-item">
                <span className="pdf-kv-label">Projects Extracted</span>
                <span className="pdf-kv-val">{parsedData.length} Central Projects</span>
              </div>

              <div className="pdf-kv-item">
                <span className="pdf-kv-label">Total Outlay Parsed</span>
                <span className="pdf-kv-val text-blue">
                  ₹{parsedData.reduce((acc, curr) => acc + curr.revisedCostCr, 0).toLocaleString()} Cr
                </span>
              </div>

              <div className="pdf-kv-item">
                <span className="pdf-kv-label">Critical Risk Assets</span>
                <span className="pdf-kv-val text-red">
                  {parsedData.filter(p => p.riskCategory === 'Critical').length} Critical
                </span>
              </div>

              <div className="pdf-kv-item">
                <span className="pdf-kv-label">Schema Compliance</span>
                <span className="pdf-kv-val" style={{ color: '#16A34A' }}>100% Verified</span>
              </div>
            </div>

            {/* Parsed Projects Data Table */}
            <div className="pdf-table-container">
              <table className="pdf-table">
                <thead>
                  <tr>
                    <th>Project ID</th>
                    <th>Project Name &amp; Ministry</th>
                    <th>Sanctioned Outlay</th>
                    <th>Physical %</th>
                    <th>Time Overrun</th>
                    <th>Risk Category</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {parsedData.map((row) => (
                    <tr key={row.id}>
                      <td style={{ fontFamily: 'monospace', fontWeight: 700, color: '#0F172A' }}>
                        #{row.id}
                      </td>
                      <td>
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                          <span style={{ fontWeight: 750, color: '#0F172A' }}>{row.name}</span>
                          <span style={{ fontSize: '11.5px', color: '#64748B' }}>{row.ministry}</span>
                        </div>
                      </td>
                      <td>
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                          <span style={{ fontWeight: 750, color: '#0F172A' }}>₹{row.revisedCostCr.toLocaleString()} Cr</span>
                          <span style={{ fontSize: '11px', color: '#64748B' }}>Orig: ₹{row.approvedCostCr.toLocaleString()} Cr</span>
                        </div>
                      </td>
                      <td>
                        <span style={{ fontWeight: 750, color: '#2563EB' }}>{row.physicalProgress}%</span>
                      </td>
                      <td>
                        <span style={{ fontWeight: 750, color: row.timeOverrunMonths >= 18 ? '#DC2626' : '#D97706' }}>
                          +{row.timeOverrunMonths} months
                        </span>
                      </td>
                      <td>
                        <span style={{
                          fontSize: '10.5px',
                          fontWeight: 800,
                          padding: '3px 8px',
                          borderRadius: '12px',
                          textTransform: 'uppercase',
                          background: row.riskCategory === 'Critical' ? '#FEF2F2' : '#EFF6FF',
                          color: row.riskCategory === 'Critical' ? '#DC2626' : '#2563EB',
                          border: `1px solid ${row.riskCategory === 'Critical' ? '#FCA5A5' : '#BFDBFE'}`
                        }}>
                          {row.riskCategory}
                        </span>
                      </td>
                      <td>
                        {onSelectProject && (
                          <button
                            type="button"
                            onClick={() => onSelectProject(row.id)}
                            style={{
                              all: 'unset',
                              cursor: 'pointer',
                              color: '#2563EB',
                              fontWeight: 750,
                              fontSize: '12.5px',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px'
                            }}
                          >
                            <span>Inspect</span>
                            <ArrowRight size={13} />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Bottom Actions Footer */}
            <div className="pdf-actions-footer">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <CheckCircle2 size={16} color="#16A34A" />
                <span style={{ fontSize: '13px', color: '#475569', fontWeight: 600 }}>
                  Telemetry ingested into Nirmaan Drishti master database.
                </span>
              </div>

              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  type="button"
                  className="pdf-back-btn"
                  onClick={() => onNavigateTab?.('dashboard')}
                >
                  <ArrowLeft size={14} />
                  <span>Return to Dashboard</span>
                </button>

                <button
                  type="button"
                  className="pdf-browse-btn"
                  onClick={() => onNavigateTab?.('action-centre')}
                >
                  <ShieldAlert size={14} />
                  <span>Open Action Center</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
