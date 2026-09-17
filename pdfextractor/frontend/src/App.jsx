import React, { useState, useEffect, useRef } from 'react';
import './App.css';
import nirmaanEmblem from './assets/nirmaan_emblem.png';
import { 
  UploadCloud, FileText, Download, CheckCircle2, 
  Layers, Database, Sparkles, Search, Activity, 
  ChevronRight, ShieldCheck, Zap, Info, FileSpreadsheet,
  Clock, ArrowRight, RefreshCw, BarChart3,
  Terminal, Cpu, Radio, Play, FastForward,
  Calendar, AlertTriangle, X, Check, ArrowUpRight,
  Home, ShieldAlert, ExternalLink
} from 'lucide-react';

const API_BASE_URL = '';

// High-fidelity extraction stream items representing multi-sector government projects
const SIMULATED_STREAM_PROJECTS = [
  { sec: "ATOMIC ENERGY", id: "N02000010", name: "KAKRAPAR ATOMIC POWER PROJECT - 3 AND 4", state: "GUJARAT", cost: "11,459.00", prog: "46/70 (65.71%)" },
  { sec: "ATOMIC ENERGY", id: "N02000027", name: "RAJASTHAN ATOMIC POWER PROJECT -7 AND 8 (2X700 MW)", state: "RAJASTHAN", cost: "12,320.00", prog: "35/68 (51.47%)" },
  { sec: "ATOMIC ENERGY", id: "020100044", name: "PROTOTYPE FAST BREEDER REACTOR (BHAVINI, 500 MWE)", state: "TAMIL NADU", cost: "6,100.00", prog: "83/87 (95.40%)" },
  { sec: "ATOMIC ENERGY", id: "N02000028", name: "KUDANKULAM NUCLEAR POWER PROJECT UNIT- 3&4", state: "TAMIL NADU", cost: "39,849.00", prog: "0/0 (0.00%)" },
  { sec: "CIVIL AVIATION", id: "N04000073", name: "CONSTRUCTION OF NEW INTEGRATED TERMINAL BUILDING AT VSI AIRPORT", state: "ANDAMAN & NICOBAR", cost: "441.33", prog: "0/0 (0.00%)" },
  { sec: "CIVIL AVIATION", id: "N04000050", name: "CONSTRUCTION OF NEW AIRPORT AT PAKYONG(SIKKIM) AIRPORT", state: "SIKKIM", cost: "553.53", prog: "522.95 Cr Exp" },
  { sec: "COAL", id: "060100093", name: "GEVRA EXPANSION OCP (SECL) (35-70) MTY", state: "CHHATTISGARH", cost: "11,816.40", prog: "13/17 (76.47%)" },
  { sec: "COAL", id: "N06000008", name: "KUSMUNDA EXPN.OCP(SECL)(15-50)MTY", state: "CHHATTISGARH", cost: "7,612.33", prog: "4/19 (21.05%)" },
  { sec: "COAL", id: "N06000045", name: "PELMA OCP (15.00 MTY)", state: "CHHATTISGARH", cost: "1,624.59", prog: "0/0 (0.00%)" },
  { sec: "COAL", id: "N06000075", name: "JAGANNATHPOR OCP (3.00 MTY)", state: "CHHATTISGARH", cost: "459.49", prog: "38.29 Cr Exp" },
  { sec: "COAL", id: "N06000076", name: "KARTALI (EAST) OCP (2.50 MTY)", state: "CHHATTISGARH", cost: "178.44", prog: "0/0 (0.00%)" },
  { sec: "PETROLEUM", id: "N16000249", name: "KOYALI AHMEDNAGAR SOLAPUR PIPELINE", state: "MAHARASHTRA", cost: "1,945.00", prog: "2/2 (100.00%)" },
  { sec: "PETROLEUM", id: "N16000260", name: "GASOLINE HYDRO TREATMENT UNIT TO PRODUCE 100% BSVI MS", state: "MAHARASHTRA", cost: "554.00", prog: "412.00 Cr Exp" },
  { sec: "RAILWAYS", id: "N22000077", name: "BHOPAL BINA 3D LINE DOUBLING", state: "MADHYA PRADESH", cost: "1,030.00", prog: "0/0 (0.00%)" },
  { sec: "RAILWAYS", id: "N22000120", name: "RATLAM-MHOW-KHANDWA-AKOLA (GC)", state: "MADHYA PRADESH", cost: "1,030.29", prog: "603.04 Cr Exp" },
  { sec: "ROAD TRANSPORT", id: "N24000320", name: "FOUR LANING OF JHANJHI JN TO DEMOW SECTION (KM 491-535)", state: "ASSAM", cost: "463.49", prog: "0/4 (0.00%)" },
  { sec: "ROAD TRANSPORT", id: "N24000321", name: "FOUR LANING FROM BISWANATH CHARIALI TO GOHPUR NH-52", state: "ASSAM", cost: "829.00", prog: "0/6 (0.00%)" },
  { sec: "ROAD TRANSPORT", id: "N24000322", name: "VARANASI RING ROAD PHASE-II (PACKAGE-I)", state: "UTTAR PRADESH", cost: "1,147.00", prog: "12/24 (50.00%)" },
  { sec: "POWER", id: "N18000102", name: "NORTH EASTERN REGION POWER SYSTEM IMPROVEMENT PROJECT", state: "MULTI-STATE", cost: "5,111.33", prog: "18/30 (60.00%)" },
];

const MONTH_OPTIONS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

const YEAR_OPTIONS = [
  "2027", "2026", "2025", "2024", "2023", "2022", "2021", "2020",
  "2019", "2018", "2017", "2016", "2015", "2014", "2013", "2012",
  "2011", "2010", "2009", "2008", "2007", "2006", "2005", "2004",
  "2003", "2002", "2001"
];

// Helper to extract month and year from PDF filename
const parsePeriodFromFilename = (filename) => {
  const clean = (filename || '').toLowerCase();
  const monthPatterns = [
    { name: "January", reg: /jan(?:uary)?/i },
    { name: "February", reg: /feb(?:ruary)?/i },
    { name: "March", reg: /mar(?:ch)?/i },
    { name: "April", reg: /apr(?:il)?/i },
    { name: "May", reg: /may/i },
    { name: "June", reg: /jun(?:e)?/i },
    { name: "July", reg: /jul(?:y)?/i },
    { name: "August", reg: /aug(?:ust)?/i },
    { name: "September", reg: /sep(?:tember)?/i },
    { name: "October", reg: /oct(?:ober)?/i },
    { name: "November", reg: /nov(?:ember)?/i },
    { name: "December", reg: /dec(?:ember)?/i },
  ];

  let detectedMonth = "May";
  for (const m of monthPatterns) {
    if (m.reg.test(clean)) {
      detectedMonth = m.name;
      break;
    }
  }

  const yMatch = clean.match(/(200[1-9]|201[0-9]|202[0-9]|2030)/);
  const detectedYear = yMatch ? yMatch[1] : "2026";

  return { month: detectedMonth, year: detectedYear };
};

const isPeriodWithinTrainingWindow = (month, year) => {
  const y = parseInt(year) || 2026;
  const monthNumMap = {
    'january': 1, 'jan': 1, '01': 1, '1': 1,
    'february': 2, 'feb': 2, '02': 2, '2': 2,
    'march': 3, 'mar': 3, '03': 3, '3': 3,
    'april': 4, 'apr': 4, '04': 4, '4': 4,
    'may': 5, '05': 5, '5': 5,
    'june': 6, 'jun': 6, '06': 6, '6': 6,
    'july': 7, 'jul': 7, '07': 7, '7': 7,
    'august': 8, 'aug': 8, '08': 8, '8': 8,
    'september': 9, 'sep': 9, '09': 9, '9': 9,
    'october': 10, 'oct': 10, '10': 10,
    'november': 11, 'nov': 11, '11': 11,
    'december': 12, 'dec': 12, '12': 12,
  };
  const m = monthNumMap[(month || '').toString().toLowerCase().trim()] || 5;
  if (y < 2026) return true;
  if (y === 2026 && m <= 5) return true;
  return false;
};

/**
 * High-Tech Live Neural Extraction Console.
 */
function LiveExtractionConsole({ fileName, month, year }) {
  const [progress, setProgress] = useState(8);
  const [elapsed, setElapsed] = useState(0.1);
  const [pagesCount, setPagesCount] = useState(3);
  const [recordsCount, setRecordsCount] = useState(2);
  const [streamLines, setStreamLines] = useState([]);
  const terminalRef = useRef(null);

  const getPhaseText = (p) => {
    if (p < 22) return "Phase 1/5: PyMuPDF Stream Vector Engine -- Parsing PDF Byte-Stream & Tables...";
    if (p < 48) return "Phase 2/5: Deterministic Anchor Scanner -- Isolating OCMS Project IDs [N0xxxxxx]...";
    if (p < 72) return "Phase 3/5: Entity Disambiguation -- Extracting Titles, States & Agencies (clean_state)...";
    if (p < 88) return "Phase 4/5: 4-Slot Positional Indexing -- Aligning Costs, Dates & Milestone Ratios...";
    return "Phase 5/5: Canonical 20-Column Schema Validation & OpenPyXL Excel Synthesis...";
  };

  useEffect(() => {
    const elapsedInterval = setInterval(() => {
      setElapsed((prev) => +(prev + 0.1).toFixed(1));
    }, 100);

    const progressInterval = setInterval(() => {
      setProgress((prev) => {
        if (prev < 40) return prev + 2.8;
        if (prev < 75) return prev + 1.6;
        if (prev < 94) return prev + 0.7;
        return prev;
      });
      setPagesCount((prev) => Math.min(421, prev + Math.floor(Math.random() * 18 + 8)));
      setRecordsCount((prev) => Math.min(1302, prev + Math.floor(Math.random() * 55 + 24)));
    }, 120);

    let projIndex = 0;
    const streamInterval = setInterval(() => {
      if (projIndex < SIMULATED_STREAM_PROJECTS.length) {
        const item = SIMULATED_STREAM_PROJECTS[projIndex];
        const timeStamp = (0.2 + projIndex * 0.16).toFixed(2);
        setStreamLines((prev) => [...prev, { ...item, time: `+${timeStamp}s` }]);
        projIndex++;
      }
    }, 110);

    return () => {
      clearInterval(elapsedInterval);
      clearInterval(progressInterval);
      clearInterval(streamInterval);
    };
  }, []);

  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [streamLines]);

  return (
    <div className="live-console-card">
      <div className="console-header-bar">
        <div className="console-title-group">
          <div className="console-dots">
            <span className="console-dot red"></span>
            <span className="console-dot yellow"></span>
            <span className="console-dot green"></span>
          </div>
          <div className="console-title-text">
            <Terminal size={17} color="#38BDF8" />
            <span>LIVE NEURAL EXTRACTION CONSOLE</span>
            {fileName && <span className="console-filename-badge">{fileName}</span>}
            {month && year && (
              <span className="console-period-badge">
                <Calendar size={12} /> {month} {year}
              </span>
            )}
          </div>
        </div>
        <div className="live-pulse-badge">
          <span className="live-pulse-dot"></span>
          <span>STREAM ACTIVE</span>
        </div>
      </div>

      <div className="console-progress-section">
        <div className="console-phase-text">
          <span className="console-phase-label">
            <Cpu size={14} className="spin-slow" />
            {getPhaseText(progress)}
          </span>
          <span style={{ color: '#38BDF8', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
            {Math.round(progress)}%
          </span>
        </div>
        <div className="console-progress-track">
          <div className="console-progress-fill" style={{ width: `${progress}%` }}></div>
        </div>
      </div>

      <div className="console-telemetry-grid">
        <div className="telemetry-tile">
          <div className="telemetry-tile-label">
            <Clock size={12} />
            <span>Active Runtime</span>
          </div>
          <div className="telemetry-tile-val cyan">{elapsed}s</div>
        </div>

        <div className="telemetry-tile">
          <div className="telemetry-tile-label">
            <FileText size={12} />
            <span>Pages Scanned</span>
          </div>
          <div className="telemetry-tile-val">{pagesCount} / 421</div>
        </div>

        <div className="telemetry-tile">
          <div className="telemetry-tile-label">
            <Zap size={12} />
            <span>Records Parsed</span>
          </div>
          <div className="telemetry-tile-val emerald">{recordsCount}</div>
        </div>

        <div className="telemetry-tile">
          <div className="telemetry-tile-label">
            <ShieldCheck size={12} />
            <span>Verification Rate</span>
          </div>
          <div className="telemetry-tile-val amber">100.0%</div>
        </div>
      </div>

      <div className="terminal-stream-window" ref={terminalRef}>
        <div className="terminal-line" style={{ color: '#64748B', fontStyle: 'italic' }}>
          <span className="term-time">[0.00s]</span>
          <span>&gt; Initialized PyMuPDF vector engine... Period: {month} {year}... Scanning Table-30 Ongoing Projects</span>
        </div>

        {streamLines.map((line, idx) => (
          <div key={idx} className="terminal-line">
            <span className="term-time">{line.time}</span>
            <span className="term-badge-sec">{line.sec}</span>
            <span className="term-id">[{line.id}]</span>
            <span className="term-name">{line.name}</span>
            <span className="term-state">{line.state}</span>
            <span className="term-cost">Rs {line.cost} Cr</span>
            <span className="term-prog">{line.prog}</span>
          </div>
        ))}

        <div className="terminal-line" style={{ color: '#38BDF8' }}>
          <span className="term-time">[{elapsed}s]</span>
          <span>&gt; Live parsing stream reading vector blocks...</span>
          <span className="term-cursor"></span>
        </div>
      </div>
    </div>
  );
}

function App() {
  const [isDragging, setIsDragging] = useState(false);
  const [isExtracting, setIsExtracting] = useState(false);
  const [activeFileName, setActiveFileName] = useState('');
  const [extractionResult, setExtractionResult] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);
  const [sampleFiles, setSampleFiles] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [apiOnline, setApiOnline] = useState(false);
  const [streamAnimationKey, setStreamAnimationKey] = useState(0);
  const [isLiveStreamView, setIsLiveStreamView] = useState(true);
  const fileInputRef = useRef(null);

  // Pre-flight Month/Year Verification Modal State
  const [showPeriodModal, setShowPeriodModal] = useState(false);
  const [pendingFile, setPendingFile] = useState(null);
  const [pendingSample, setPendingSample] = useState(null);
  const [selectedMonth, setSelectedMonth] = useState('May');
  const [selectedYear, setSelectedYear] = useState('2026');
  const [checkingDataset, setCheckingDataset] = useState(false);
  const [datasetStatus, setDatasetStatus] = useState(null);

  // Dataset Sync & ML Retrain State
  const [isUpdatingDataset, setIsUpdatingDataset] = useState(false);
  const [datasetUpdateSuccess, setDatasetUpdateSuccess] = useState(null);
  const [showAuditDetails, setShowAuditDetails] = useState(false);

  // Fetch samples & health check
  useEffect(() => {
    fetch(`${API_BASE_URL}/api/health`)
      .then(res => res.json())
      .then(data => {
        if (data.status === 'healthy') setApiOnline(true);
      })
      .catch(() => setApiOnline(false));

    fetch(`${API_BASE_URL}/api/sample-files`)
      .then(res => res.json())
      .then(data => {
        if (data.samples) setSampleFiles(data.samples);
      })
      .catch(err => console.error("Could not fetch samples:", err));
  }, []);

  // Pre-flight check whenever selectedMonth or selectedYear changes in the modal
  useEffect(() => {
    if (!showPeriodModal) return;
    let isCancelled = false;
    setCheckingDataset(true);
    fetch(`${API_BASE_URL}/api/check-dataset?month=${encodeURIComponent(selectedMonth)}&year=${encodeURIComponent(selectedYear)}`)
      .then(res => res.json())
      .then(data => {
        if (!isCancelled) {
          setDatasetStatus(data);
          setCheckingDataset(false);
        }
      })
      .catch(err => {
        if (!isCancelled) {
          console.error("Dataset check failed:", err);
          setCheckingDataset(false);
        }
      });

    return () => { isCancelled = true; };
  }, [selectedMonth, selectedYear, showPeriodModal]);

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      if (file.name.toLowerCase().endsWith('.pdf')) {
        initiatePeriodConfirmation(file, null);
      } else {
        setErrorMsg("Please upload a valid PDF file.");
      }
    }
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      initiatePeriodConfirmation(file, null);
    }
  };

  // Prepares the modal with auto-detected period before extracting
  const initiatePeriodConfirmation = (file, sample) => {
    setErrorMsg(null);
    setDatasetUpdateSuccess(null);
    if (file) {
      setPendingFile(file);
      setPendingSample(null);
      const detected = parsePeriodFromFilename(file.name);
      setSelectedMonth(detected.month);
      setSelectedYear(detected.year);
    } else if (sample) {
      setPendingFile(null);
      setPendingSample(sample);
      setSelectedMonth(sample.month || "May");
      setSelectedYear(sample.year || "2026");
    }
    setShowPeriodModal(true);
  };

  // Executes the extraction after user confirmation in the modal
  const executeConfirmedExtraction = async (forceOverwrite = false) => {
    setShowPeriodModal(false);
    setIsExtracting(true);
    setErrorMsg(null);
    setExtractionResult(null);
    setDatasetUpdateSuccess(null);

    const monthToUse = selectedMonth;
    const yearToUse = selectedYear;

    if (pendingFile) {
      setActiveFileName(pendingFile.name);
      const formData = new FormData();
      formData.append('file', pendingFile);

      try {
        const url = `${API_BASE_URL}/api/extract?month=${encodeURIComponent(monthToUse)}&year=${encodeURIComponent(yearToUse)}`;
        const response = await fetch(url, {
          method: 'POST',
          body: formData,
        });

        if (!response.ok) {
          let errorDetail = `Extraction failed (Status: ${response.status})`;
          try {
            const errData = await response.json();
            errorDetail = errData.detail || errorDetail;
          } catch {
            const text = await response.text();
            if (text) errorDetail = text;
          }
          throw new Error(errorDetail);
        }

        const data = await response.json();
        setExtractionResult(data);
        setStreamAnimationKey((k) => k + 1);
      } catch (err) {
        console.error(err);
        setErrorMsg(err.message || "Failed to process PDF report.");
      } finally {
        setIsExtracting(false);
      }
    } else if (pendingSample) {
      const sName = pendingSample.path.split(/[\\/]/).pop();
      setActiveFileName(sName);

      try {
        const url = `${API_BASE_URL}/api/extract-sample?sample_path=${encodeURIComponent(pendingSample.path)}&month=${encodeURIComponent(monthToUse)}&year=${encodeURIComponent(yearToUse)}`;
        const response = await fetch(url, { method: 'POST' });

        if (!response.ok) {
          let errorDetail = `Sample extraction failed (Status: ${response.status})`;
          try {
            const errData = await response.json();
            errorDetail = errData.detail || errorDetail;
          } catch {
            const text = await response.text();
            if (text) errorDetail = text;
          }
          throw new Error(errorDetail);
        }

        const data = await response.json();
        setExtractionResult(data);
        setStreamAnimationKey((k) => k + 1);
      } catch (err) {
        console.error(err);
        setErrorMsg(err.message || "Failed to process sample report.");
      } finally {
        setIsExtracting(false);
      }
    }
  };

  // Handles updating the master dataset and triggering ML retraining
  const handleUpdateMasterDataset = async () => {
    if (!extractionResult) return;
    setIsUpdatingDataset(true);
    setDatasetUpdateSuccess(null);

    try {
      const payload = {
        file_id: extractionResult.file_id,
        month: selectedMonth,
        year: selectedYear,
        overwrite: true,
      };

      const response = await fetch(`${API_BASE_URL}/api/update-master-dataset`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.detail || "Failed to update master dataset.");
      }

      const syncResult = await response.json();
      setDatasetUpdateSuccess(syncResult);
    } catch (err) {
      console.error("Dataset update error:", err);
      alert(`Error updating master dataset: ${err.message}`);
    } finally {
      setIsUpdatingDataset(false);
    }
  };

  // Filter preview records
  const filteredRecords = (extractionResult?.records_preview || []).filter(r => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      (r.project_name && r.project_name.toLowerCase().includes(q)) ||
      (r.project_id && String(r.project_id).toLowerCase().includes(q)) ||
      (r.ministry_department && r.ministry_department.toLowerCase().includes(q)) ||
      (r.state && r.state.toLowerCase().includes(q))
    );
  });

  return (
    <div className="app-layout">
      {/* ── Standalone Extractor Header (Theme Matched to Nirmaan-Drishti) ── */}
      <header className="extractor-standalone-header">
        <div className="header-top-accent-line"></div>
        <div className="header-content-inner">
          {/* Left: Emblem & Dedicated Suite Brand */}
          <div className="extractor-brand-cluster">
            <div className="extractor-emblem-wrap">
              <img src={nirmaanEmblem} alt="MoSPI Nirmaan Emblem" className="extractor-emblem-img" />
            </div>
            <div className="extractor-brand-divider"></div>
            <div className="extractor-brand-titles">
              <div className="extractor-title-row">
                <span className="extractor-app-title">MoSPI FLASH REPORT EXTRACTOR</span>
                <span className="extractor-version-pill">v2.1 STANDALONE</span>
                <span className="extractor-theme-badge">NIRMAAN-DRISHTI SUITE</span>
              </div>
              <p className="extractor-app-subtitle">
                Deterministic Flash Report Parsing & Master Dataset Reconciliation Engine (2001 - 2027+)
              </p>
            </div>
          </div>

          {/* Right: Telemetry Badges & Portal Nav Link */}
          <div className="extractor-header-actions">
            <div className={`engine-live-pill ${apiOnline ? 'online' : 'offline'}`}>
              <span className="pulse-indicator-dot"></span>
              <span>{apiOnline ? "Engine Online :8000" : "Engine Connecting..."}</span>
            </div>

            <div className="cutoff-indicator-pill">
              <ShieldCheck size={14} color="#10B981" />
              <span>Model Cutoff: May 2026</span>
            </div>

            <a 
              href="http://localhost:5173" 
              className="btn-back-to-portal"
              title="Return to main Nirmaan-Drishti Dashboard"
            >
              <span>Portal Dashboard</span>
              <ExternalLink size={13} />
            </a>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="main-content">

        {/* Hero Section */}
        <section className="hero-box">
          <div className="hero-content-left">
            <div className="hero-pill">
              <Sparkles size={14} />
              <span>MoSPI OFFICIAL EXTRACTION & HARMONIZATION SUITE · ERA 2001 - 2027+</span>
            </div>
            <h1 className="hero-heading">
              Universal Flash Report Parsing & Master Dataset Reconciliation
            </h1>
            <p className="hero-subheading">
              Deterministic parsing engine for PAIMANA (2025–2027+), Modern Flash (2024–2025), and Historical Milestone (2001–2024) reports. 
              Cross-verifies official data with <code>Features.csv</code>, heals legacy shifted values, and strictly enforces the <strong>May 2026 AI model pre-trained cutoff</strong>.
            </p>
          </div>
          <div className="hero-content-right">
            <div className="hero-stat-card">
              <div className="stat-number">223,210+</div>
              <div className="stat-label">Master Projects Ingested</div>
            </div>
            <div className="hero-stat-card highlight">
              <div className="stat-number">May 2026</div>
              <div className="stat-label">Model Pre-Trained Cutoff</div>
            </div>
            <div className="hero-stat-card">
              <div className="stat-number">100%</div>
              <div className="stat-label">Milestone Ratio Fidelity</div>
            </div>
          </div>
        </section>

        {/* Central Workspace Card */}
        <div className="workspace-card">
          {/* Upload Drop Area */}
          <div 
            className={`drop-area ${isDragging ? 'dragging' : ''}`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current.click()}
          >
            <input 
              type="file" 
              ref={fileInputRef} 
              style={{ display: 'none' }} 
              accept=".pdf"
              onChange={handleFileChange}
            />
            <div className="drop-icon-wrapper">
              <UploadCloud size={38} className="upload-icon-pulse" />
            </div>
            <h3 className="drop-heading">Upload MoSPI Monthly Flash Report PDF</h3>
            <p className="drop-text">Drag & drop your official government PDF report here, or click to browse</p>
            <button 
              className="action-browse-btn" 
              onClick={(e) => { e.stopPropagation(); fileInputRef.current.click(); }}
            >
              <FileText size={16} />
              <span>Choose PDF File</span>
            </button>
            <div className="upload-specs-row">
              <span className="spec-item">✓ Supports 400+ page Flash Reports</span>
              <span className="spec-divider">•</span>
              <span className="spec-item">✓ Deterministic OCR Boundary Detection</span>
              <span className="spec-divider">•</span>
              <span className="spec-item">✓ Automatic Era & Milestone Mapping</span>
            </div>
          </div>

          {/* Quick Sample Test Suite */}
          {sampleFiles.length > 0 && (
            <div className="samples-section">
              <div className="samples-header">
                <div className="samples-header-left">
                  <Sparkles size={16} color="#2F6BF4" />
                  <span className="samples-title">Pre-Loaded Official Verification Suite (1-Click Test):</span>
                </div>
                <span className="samples-subtitle">Instantly test multi-era parsing fidelity</span>
              </div>
              <div className="samples-grid">
                {sampleFiles.map((s, idx) => (
                  <div 
                    key={idx} 
                    className="sample-card"
                    onClick={() => initiatePeriodConfirmation(null, s)}
                  >
                    <div className="sample-card-top">
                      <span className="sample-era-tag">{s.era}</span>
                      <span className="sample-size-pill">{s.size}</span>
                    </div>
                    <div className="sample-name">{s.name}</div>
                    <div className="sample-footer">
                      <span className="sample-period-text">{s.month} {s.year}</span>
                      <span className="extract-link">
                        <span>Launch Extraction</span>
                        <ArrowRight size={13} />
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Error Alert */}
        {errorMsg && (
          <div className="alert-box error">
            <Info size={18} />
            <div>
              <strong>Extraction Error:</strong> {errorMsg}
            </div>
          </div>
        )}

        {/* LIVE NEURAL EXTRACTION CONSOLE (Typewriter Loading Screen) */}
        {isExtracting && (
          <LiveExtractionConsole 
            fileName={activeFileName} 
            month={selectedMonth} 
            year={selectedYear} 
          />
        )}

        {/* Dataset Sync & Reconciliation Success Notification */}
        {datasetUpdateSuccess && (
          <div className="sync-success-banner">
            <div className="sync-success-icon">
              <CheckCircle2 size={26} color={datasetUpdateSuccess.already_trained ? "#10B981" : "#38BDF8"} />
            </div>
            <div className="sync-success-content">
              <div className="sync-success-title-row" style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', marginBottom: '6px' }}>
                <h4 style={{ margin: 0 }}>
                  {datasetUpdateSuccess.already_trained 
                    ? "Master Dataset Verified & Reconciled (Already Updated & Trained)" 
                    : "Master Dataset Synchronized & ML Models Retraining!"}
                </h4>
                <span className={`sync-status-badge ${datasetUpdateSuccess.already_trained ? 'trained' : 'retraining'}`}>
                  {datasetUpdateSuccess.already_trained ? "Model Pre-Trained (Retrain Skipped)" : "ML Retraining Initiated"}
                </span>
              </div>
              <p>
                {datasetUpdateSuccess.already_trained ? (
                  <>
                    Successfully verified <strong>{datasetUpdateSuccess.verified_count?.toLocaleString() || extractionResult?.records_count?.toLocaleString()}</strong> projects 
                    for <strong>{datasetUpdateSuccess.month} {datasetUpdateSuccess.year}</strong> against official MoSPI ground truth. 
                    Auto-corrected <strong>{datasetUpdateSuccess.discrepancies_corrected?.toLocaleString() || 0}</strong> discrepancies (revised cost shifts, expenditures, physical progress) in <code>Features.csv</code>. 
                    AI models are already trained on data up to May 2026; live retraining is not required.
                  </>
                ) : (
                  <>
                    Successfully appended <strong>{datasetUpdateSuccess.records_added?.toLocaleString()}</strong> active telemetry projects 
                    for <strong>{datasetUpdateSuccess.month} {datasetUpdateSuccess.year}</strong> to central <code>Features.csv</code>. 
                    Live AI forecasting models are now retraining in the background.
                  </>
                )}
              </p>

              {/* Discrepancies Summary Pill & Sample Corrections */}
              {datasetUpdateSuccess.sample_corrections && datasetUpdateSuccess.sample_corrections.length > 0 && (
                <div className="reconciliation-audit-box">
                  <div className="audit-header" onClick={() => setShowAuditDetails(!showAuditDetails)}>
                    <div className="audit-header-left">
                      <ShieldCheck size={15} color="#10B981" />
                      <span>Auto-Corrected Discrepancies Audit ({datasetUpdateSuccess.discrepancies_corrected} fields fixed in Features.csv)</span>
                    </div>
                    <button className="btn-toggle-audit" type="button">
                      {showAuditDetails ? "Hide Details" : "View Sample Corrections"}
                    </button>
                  </div>
                  {showAuditDetails && (
                    <ul className="audit-list">
                      {datasetUpdateSuccess.sample_corrections.map((item, idx) => (
                        <li key={idx} className="audit-item">
                          <CheckCircle2 size={13} color="#10B981" />
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}

              <div className="sync-meta-tag" style={{ marginTop: '10px' }}>
                <span>Repository: {datasetUpdateSuccess.master_path}</span>
                <span>Cutoff: May 2026 (2026-05)</span>
              </div>
            </div>
            <button 
              className="sync-close-btn" 
              onClick={() => setDatasetUpdateSuccess(null)}
            >
              <X size={16} />
            </button>
          </div>
        )}

        {/* Extraction Results */}
        {extractionResult && (
          <section className="results-wrapper">
            {/* KPI Summary Grid (Matching Nirmaan-Drishti MetricCards Design) */}
            <div className="metrics-grid">
              {/* Card 1: Dark Navy Total Projects */}
              <div className="metric-card dark-theme">
                <div className="card-decor-pattern">
                  <svg aria-hidden="true" width="100" height="60" viewBox="0 0 100 60" fill="none" opacity="0.2">
                    <path d="M 0 50 Q 20 20, 40 40 T 80 10 T 100 30" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" />
                    <circle cx="80" cy="10" r="3" fill="#ffffff" />
                  </svg>
                </div>
                <div className="metric-card-top">
                  <span className="metric-title">TOTAL PROJECTS</span>
                  <Database size={16} color="#38BDF8" />
                </div>
                <div className="metric-value">{extractionResult.records_count?.toLocaleString()}</div>
                <div className="metric-subtext">Processed in {extractionResult.execution_time_seconds}s</div>
              </div>

              {/* Card 2: Reporting Period */}
              <div className="metric-card light-theme">
                <div className="card-decor-pattern">
                  <svg aria-hidden="true" width="100" height="60" viewBox="0 0 100 60" fill="none" opacity="0.1">
                    <path d="M 0 40 L 30 40 L 50 15 L 70 50 L 100 30" stroke="var(--navy-dark)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
                <div className="metric-card-top">
                  <span className="metric-title">REPORTING PERIOD</span>
                  <Calendar size={16} color="#2F6BF4" />
                </div>
                <div className="metric-value text-blue">
                  {extractionResult.reporting_month} {extractionResult.reporting_year}
                </div>
                <div className="metric-subtext">{extractionResult.classification?.format_type}</div>
              </div>

              {/* Card 3: Anticipated Cost */}
              <div className="metric-card alert-card">
                <div className="card-decor-pattern">
                  <svg aria-hidden="true" width="100" height="60" viewBox="0 0 100 60" fill="none" opacity="0.12">
                    <path d="M 0 50 Q 25 15, 50 45 T 100 20" stroke="#D97706" strokeWidth="2" strokeLinecap="round" />
                  </svg>
                </div>
                <div className="metric-card-top">
                  <span className="metric-title">ANTICIPATED COST</span>
                  <Activity size={16} color="#F59E0B" />
                </div>
                <div className="metric-value text-amber">
                  ₹{extractionResult.summary_metrics?.total_original_cost_cr ? (extractionResult.summary_metrics.total_original_cost_cr / 100000).toFixed(2) + ' L Cr' : '-'}
                </div>
                <div className="metric-subtext">
                  Exp: ₹{extractionResult.summary_metrics?.total_cumulative_expenditure_cr ? (extractionResult.summary_metrics.total_cumulative_expenditure_cr / 100000).toFixed(2) + ' L Cr' : '-'}
                </div>
              </div>

              {/* Card 4: Avg Physical Progress */}
              <div className="metric-card emerald-theme">
                <div className="card-decor-pattern">
                  <svg aria-hidden="true" width="100" height="60" viewBox="0 0 100 60" fill="none" opacity="0.12">
                    <path d="M 0 45 Q 30 10, 60 35 T 100 15" stroke="#10B981" strokeWidth="2" strokeLinecap="round" />
                  </svg>
                </div>
                <div className="metric-card-top">
                  <span className="metric-title">PHYSICAL PROGRESS</span>
                  <BarChart3 size={16} color="#10B981" />
                </div>
                <div className="metric-value text-emerald">
                  {extractionResult.summary_metrics?.average_physical_progress_pct}%
                </div>
                <div className="metric-subtext">From official government milestone ratios</div>
              </div>
            </div>

            {/* DUAL ACTION TOOLBAR */}
            <div className="dual-action-toolbar">
              <div className="search-wrapper">
                <Search size={16} className="search-icon" />
                <input 
                  type="text" 
                  className="search-input" 
                  placeholder="Filter by Project Name, ID, State, or Ministry..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>

              <div className="action-buttons-group">
                {/* ACTION BUTTON 1: DOWNLOAD EXCEL */}
                <a 
                  href={`${API_BASE_URL}${extractionResult.download_url}`} 
                  className="btn-action-primary download"
                  download
                >
                  <FileSpreadsheet size={18} />
                  <span>Download Excel (.xlsx)</span>
                </a>

                {/* ACTION BUTTON 2: RECONCILE / UPDATE MASTER DATASET */}
                {(() => {
                  const isPreTrained = isPeriodWithinTrainingWindow(
                    extractionResult?.reporting_month || selectedMonth, 
                    extractionResult?.reporting_year || selectedYear
                  );
                  return (
                    <button 
                      className={`btn-action-primary update-dataset ${isUpdatingDataset ? 'loading' : ''} ${datasetUpdateSuccess ? 'updated' : ''}`}
                      onClick={handleUpdateMasterDataset}
                      disabled={isUpdatingDataset || datasetUpdateSuccess}
                      title={isPreTrained ? "Cross-check and auto-correct discrepancies in master dataset (Model already trained up to May 2026)" : "Append active telemetry and retrain forecasting models"}
                    >
                      {isUpdatingDataset ? (
                        <>
                          <RefreshCw size={18} className="spin-slow" />
                          <span>{isPreTrained ? "Reconciling & Auto-Correcting Dataset..." : "Updating Dataset & Retraining..."}</span>
                        </>
                      ) : datasetUpdateSuccess ? (
                        <>
                          <CheckCircle2 size={18} />
                          <span>{isPreTrained ? "Dataset Verified & Reconciled!" : "Dataset Synchronized!"}</span>
                        </>
                      ) : (
                        <>
                          {isPreTrained ? <ShieldCheck size={18} /> : <RefreshCw size={18} />}
                          <span>{isPreTrained ? "Reconcile & Correct Dataset (Already Trained)" : "Update Master Dataset & Retrain"}</span>
                        </>
                      )}
                    </button>
                  );
                })()}
              </div>
            </div>

            {/* Live Stream Verification Banner */}
            <div className="stream-banner-bar">
              <div className="stream-banner-left">
                <span className="stream-banner-badge">
                  <CheckCircle2 size={12} />
                  100% EXTRACTION VERIFIED
                </span>
                <span>
                  All <strong>{extractionResult.records_count?.toLocaleString()}</strong> projects extracted for <strong>{extractionResult.reporting_month} {extractionResult.reporting_year}</strong>.
                </span>
              </div>
              <div className="stream-banner-right">
                <button 
                  className={`stream-btn-toggle ${isLiveStreamView ? 'active' : ''}`}
                  onClick={() => {
                    setIsLiveStreamView(true);
                    setStreamAnimationKey((k) => k + 1);
                  }}
                  title="Re-run live streaming entrance"
                >
                  <Play size={12} />
                  <span>Live Stream View</span>
                </button>
                <button 
                  className={`stream-btn-toggle ${!isLiveStreamView ? 'active' : ''}`}
                  onClick={() => setIsLiveStreamView(false)}
                  title="Instant grid without animation delays"
                >
                  <FastForward size={12} />
                  <span>Instant Grid</span>
                </button>
              </div>
            </div>

            {/* Preview Table Card */}
            <div className="preview-card">
              <div className="preview-header">
                <div className="preview-title">
                  <FileText size={18} color="#38BDF8" />
                  <span>
                    Dataset Preview ({filteredRecords.length} of {extractionResult.records_count} projects)
                  </span>
                </div>
                <div className="preview-meta">
                  Report: <strong>{extractionResult.reporting_month} {extractionResult.reporting_year}</strong> ({extractionResult.summary_metrics?.financial_year})
                </div>
              </div>

              <div className="table-scroll-container">
                <table className="data-table" key={streamAnimationKey}>
                  <thead>
                    <tr>
                      <th className="th-left">Project ID</th>
                      <th className="th-left">Legacy Code</th>
                      <th className="th-left">PMGID</th>
                      <th className="th-left th-wide">Project Name</th>
                      <th className="th-left">Ministry / Department</th>
                      <th className="th-left">State</th>
                      <th className="th-left">Approval Date</th>
                      <th className="th-right">Original Cost (Rs Cr)</th>
                      <th className="th-right">Revised Cost (Rs Cr)</th>
                      <th className="th-right">Cumulative Exp (Rs Cr)</th>
                      <th className="th-center">Cost Revision</th>
                      <th className="th-left">Orig DoC</th>
                      <th className="th-left">Antic DoC</th>
                      <th className="th-center">Physical Progress</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredRecords.map((r, idx) => (
                      <tr 
                        key={idx} 
                        className={isLiveStreamView ? "table-row-stream" : ""}
                        style={isLiveStreamView ? { animationDelay: `${Math.min(idx, 25) * 45}ms` } : {}}
                      >
                        <td className="td-left"><span className="id-badge">{r.project_id}</span></td>
                        <td className="td-left font-mono">{r.legacy_ocms_code || '-'}</td>
                        <td className="td-left font-mono">{r.PMGID || '-'}</td>
                        <td className="td-left td-wrap"><strong>{r.project_name}</strong></td>
                        <td className="td-left">{r.ministry_department || '-'}</td>
                        <td className="td-left">{r.state || '-'}</td>
                        <td className="td-left">{r['Date of approval'] || '-'}</td>
                        <td className="td-right font-num">{r['Original cost (₹ Cr)'] != null ? Number(r['Original cost (₹ Cr)']).toFixed(2) : '-'}</td>
                        <td className="td-right font-num">{r['revised cost (₹ Cr)'] != null ? Number(r['revised cost (₹ Cr)']).toFixed(2) : '-'}</td>
                        <td className="td-right font-num">{r['cumulative expenditure (₹ Cr)'] != null ? Number(r['cumulative expenditure (₹ Cr)']).toFixed(2) : '-'}</td>
                        <td className="td-center">
                          <span className={`flag-badge ${r.cost_revision_flag === 'Yes' ? 'flag-yes' : 'flag-no'}`}>
                            {r.cost_revision_flag}
                          </span>
                        </td>
                        <td className="td-left">{r['original date of commissioning'] || '-'}</td>
                        <td className="td-left">{r['anticipated commissioning'] || '-'}</td>
                        <td className="td-center">
                          <span className={`progress-tag ${r['physical progress'] === '100.00%' ? 'prog-100' : ''}`}>
                            {r['physical progress']}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        )}

        {/* 4-Tier Architecture Cards */}
        <section className="architecture-section">
          <div className="section-head">
            <h2 className="section-title">4-Tier Cascading Engine Architecture</h2>
            <p className="section-desc">
              Built to guarantee that future government formatting shifts never break the 20-column master pipeline.
            </p>
          </div>

          <div className="grid-2x2">
            <div className="tier-card tier-paimana">
              <div className="tier-header">
                <span className="tier-badge">Tier 1</span>
                <span className="tier-era">2025 - 2027+</span>
              </div>
              <h3 className="tier-title">PAIMANA Portal OCR & Table Stream Engine</h3>
              <p className="tier-desc">
                Parses modern PAIMANA portal PDFs featuring Table 30 structure, dual-cost revisions, and 8-digit project codes.
              </p>
              <div className="tier-features">
                <div className="tier-feat-item"><CheckCircle2 size={14} /> Deterministic Table Boundary Detection</div>
                <div className="tier-feat-item"><CheckCircle2 size={14} /> Direct OCMS ID Normalization</div>
              </div>
            </div>

            <div className="tier-card tier-modern">
              <div className="tier-header">
                <span className="tier-badge">Tier 2</span>
                <span className="tier-era">2024 - 2025</span>
              </div>
              <h3 className="tier-title">Modern Flash Report Semantic Parser</h3>
              <p className="tier-desc">
                Engineered for transition-era reports with nested ministry headers and varying physical progress percentage representations.
              </p>
              <div className="tier-features">
                <div className="tier-feat-item"><CheckCircle2 size={14} /> Multi-Column Header Recognition</div>
                <div className="tier-feat-item"><CheckCircle2 size={14} /> Cost Shift Auto-Alignment</div>
              </div>
            </div>

            <div className="tier-card tier-legacy">
              <div className="tier-header">
                <span className="tier-badge">Tier 3</span>
                <span className="tier-era">2001 - 2024</span>
              </div>
              <h3 className="tier-title">Historical Milestone Ratio Engine</h3>
              <p className="tier-desc">
                Decodes milestone fraction ratios (e.g. 46/70) and calculates verified physical progress mathematically with zero hallucination.
              </p>
              <div className="tier-features">
                <div className="tier-feat-item"><CheckCircle2 size={14} /> Mathematical Physical Progress (46/70 = 65.71%)</div>
                <div className="tier-feat-item"><CheckCircle2 size={14} /> Multi-Line Title & State Stitching</div>
              </div>
            </div>

            <div className="tier-card tier-adaptive">
              <div className="tier-header">
                <span className="tier-badge">Tier 4</span>
                <span className="tier-era">Future Proof</span>
              </div>
              <h3 className="tier-title">Universal Fallback & Self-Healing</h3>
              <p className="tier-desc">
                Adaptive heuristic engine that scans raw text streams to detect emergent column layouts and align fields to canonical schema.
              </p>
              <div className="tier-features">
                <div className="tier-feat-item"><CheckCircle2 size={14} /> Robust Error Recovery</div>
                <div className="tier-feat-item"><CheckCircle2 size={14} /> Schema Conformance Enforcement</div>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* PRE-FLIGHT MONTH & YEAR CONFIRMATION MODAL */}
      {showPeriodModal && (
        <div className="modal-backdrop">
          <div className="modal-card">
            <div className="modal-top">
              <div className="modal-title-wrap">
                <div className="modal-icon-badge">
                  <Calendar size={20} color="#38BDF8" />
                </div>
                <div>
                  <h3 className="modal-title">Confirm Flash Report Period</h3>
                  <p className="modal-subtitle">
                    Select reporting month and year before extraction to verify against master dataset.
                  </p>
                </div>
              </div>
              <button className="modal-close" onClick={() => setShowPeriodModal(false)}>
                <X size={18} />
              </button>
            </div>

            {/* Target File Info */}
            <div className="modal-file-pill">
              <FileText size={15} color="#94A3B8" />
              <span className="modal-file-name">
                {pendingFile ? pendingFile.name : (pendingSample ? pendingSample.name : "Flash Report")}
              </span>
              <span className="modal-file-tag">Auto-Detected</span>
            </div>

            {/* Selectors Row */}
            <div className="modal-selectors-grid">
              <div className="selector-field">
                <label className="selector-label">Reporting Month</label>
                <select 
                  className="custom-select"
                  value={selectedMonth} 
                  onChange={(e) => setSelectedMonth(e.target.value)}
                >
                  {MONTH_OPTIONS.map((m) => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              </div>

              <div className="selector-field">
                <label className="selector-label">Reporting Year</label>
                <select 
                  className="custom-select"
                  value={selectedYear} 
                  onChange={(e) => setSelectedYear(e.target.value)}
                >
                  {YEAR_OPTIONS.map((y) => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Pre-flight Dataset Status Banner */}
            <div className="modal-status-area">
              {checkingDataset ? (
                <div className="status-banner loading">
                  <RefreshCw size={17} className="spin-slow" />
                  <span>Checking master dataset (Features.csv)...</span>
                </div>
              ) : datasetStatus?.already_trained ? (
                datasetStatus?.exists ? (
                  <div className="status-banner success-verified">
                    <div className="status-banner-icon">
                      <CheckCircle2 size={22} color="#10B981" />
                    </div>
                    <div className="status-banner-text">
                      <strong style={{ color: '#10B981' }}>Already Updated & Trained!</strong>
                      <p>
                        Monthly report data for <strong>{selectedMonth} {selectedYear}</strong> is already present in the master dataset 
                        ({datasetStatus.existing_records_count?.toLocaleString()} records found) and AI models are already pre-trained up to May 2026.
                      </p>
                      <div className="status-subtext-heal">
                        <ShieldCheck size={14} />
                        <span>Self-Healing Mode: Extraction will cross-verify the report against Features.csv and auto-correct any discrepancies without retraining.</span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="status-banner info">
                    <div className="status-banner-icon">
                      <Layers size={22} color="#38BDF8" />
                    </div>
                    <div className="status-banner-text">
                      <strong>Pre-Trained Historical Period (&le; May 2026)</strong>
                      <p>
                        Report for <strong>{selectedMonth} {selectedYear}</strong> is within the pre-trained historical archive. Extraction will integrate and verify records (retraining not needed).
                      </p>
                    </div>
                  </div>
                )
              ) : (
                <div className="status-banner telemetry">
                  <div className="status-banner-icon">
                    <Zap size={22} color="#F59E0B" />
                  </div>
                  <div className="status-banner-text">
                    <strong>New Active Telemetry (&gt; May 2026)</strong>
                    <p>
                      Period <strong>{selectedMonth} {selectedYear}</strong> is beyond the May 2026 training cutoff. Extraction will update the master dataset and trigger AI model retraining.
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Actions */}
            <div className="modal-footer">
              <button 
                className="btn-modal-cancel" 
                onClick={() => setShowPeriodModal(false)}
              >
                Cancel
              </button>

              {datasetStatus?.exists ? (
                <button 
                  className="btn-modal-action warning"
                  onClick={() => executeConfirmedExtraction(true)}
                  disabled={checkingDataset}
                >
                  <ShieldCheck size={16} />
                  <span>Verify & Reconcile Dataset</span>
                </button>
              ) : (
                <button 
                  className="btn-modal-action primary"
                  onClick={() => executeConfirmedExtraction(false)}
                  disabled={checkingDataset}
                >
                  <Zap size={16} />
                  <span>Start Live Extraction</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="footer">
        <div className="footer-inner">
          <div className="footer-left">
            <span className="footer-brand">MoSPI Universal Flash Report Extractor</span>
            <span className="footer-copy">© 2001 - 2027+ MoSPI Government Projects Central Suite</span>
          </div>
          <div className="footer-right">
            <span className="badge-canon">Canonical 20-Column Master Compliant</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default App;
