<div align="center">

<h1>🔮 Nirmaan Dristi</h1>
<h3>National Infrastructure Early Warning &amp; Predictive Monitoring Platform</h3>

<p><em>Smart India Hackathon 2026 — Team Sanket-AI</em></p>

<p>
  <img src="https://img.shields.io/badge/Python-3.10+-3776AB?style=for-the-badge&logo=python&logoColor=white" />
  <img src="https://img.shields.io/badge/FastAPI-0.100+-009688?style=for-the-badge&logo=fastapi&logoColor=white" />
  <img src="https://img.shields.io/badge/React-19-61DAFB?style=for-the-badge&logo=react&logoColor=black" />
  <img src="https://img.shields.io/badge/PostgreSQL-14+-4169E1?style=for-the-badge&logo=postgresql&logoColor=white" />
  <img src="https://img.shields.io/badge/XGBoost-ML-FF6600?style=for-the-badge" />
  <img src="https://img.shields.io/badge/Qwen3--8B-LLM-7C3AED?style=for-the-badge" />
</p>

<p>
  <strong>Predict cost overruns and schedule delays in Central Sector infrastructure projects — before they happen.</strong>
</p>

</div>

---

## 🌟 What is Nirmaan Drishti?

**Nirmaan Drishti** (meaning *"Vision of Construction"*) is an end-to-end **AI-powered infrastructure project intelligence platform** built for the Government of India's Project Monitoring Group (PMG). It monitors national infrastructure projects across **17 ministries** and **22 sectors**, providing:

- 🎯 **Next-Period ($T+1$) ML Classification** — Predicts whether an infrastructure project will experience schedule delay or budget overrun at the next operational observation ($T+1$) using state-of-the-art XGBoost classifiers trained with zero temporal leakage.
- ⚖️ **Imbalance-Aware Prediction** — Employs class-weighted gradient boosting to reliably detect cost overruns despite severe class imbalance.
- 🔍 **Unsupervised Anomaly Detection** — Isolation Forest anomaly detector flags abnormal reporting patterns and unexpected trajectory deviations.
- 🧠 **Explainable AI (TreeSHAP)** — Identifies which specific project features drive risk or serve as protective factors, making every prediction fully auditable.
- 🤖 **Qwen3-8B Natural Language Engine** — Converts complex ML outputs into plain-English executive summaries and answers natural language queries.
- 📊 **Real-time Risk Scoring** — Continuously computes composite risk indices $[0, 100]$ across cost, schedule, and trajectory health dimensions.
- 🚨 **Early Warning Alerts** — Flags at-risk projects before deadlines slip, enabling proactive PMG intervention.

> **Note on Strategy**: The ML pipeline operates strictly on a **Single Next-Period ($T \to T+1$) Prediction Strategy** combining calibrated risk classification (XGBoost) with scale-invariant continuous regression (Stacking Regressor for Schedule Delay, HistGradientBoosting for Cost Multiplier $\to$ Future Cost). All models are trained with zero temporal leakage across 212,024 chronological transitions.

---

## 🏗️ System Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                         Nirmaan Dristi                              │
├───────────────┬─────────────────────┬───────────────────────────────┤
│   Frontend    │      Backend        │          AI / ML              │
│  React + Vite │  FastAPI + Uvicorn  │   XGBoost + SHAP + Qwen3-8B  │
│  (Port 5173)  │  (Port 8000)        │   (Integrated in Backend)     │
│               │  PostgreSQL DB      │   Streamlit Demo (Port 8501)  │
└───────────────┴─────────────────────┴───────────────────────────────┘
```

**Data Flow:**

```
PAIMANA CSV → FastAPI Ingestion → PostgreSQL → XGBoost Inference
                                                      ↓
Frontend Dashboard ← REST API ← FastAPI ← TreeSHAP + Qwen3-8B
```

---

## 📁 Project Structure

```
Sanket-AI/
│
├── 📂 frontend/               # React + TypeScript + Vite web dashboard
│   ├── src/                   # Application source (pages, components, API clients)
│   ├── public/                # Static assets
│   ├── index.html             # App entry point
│   ├── vite.config.ts         # Vite build configuration
│   └── package.json           # Node.js dependencies
│
├── 📂 backend/                # FastAPI REST API server
│   ├── app/
│   │   ├── main.py            # FastAPI app entrypoint, CORS, router registration
│   │   ├── config.py          # Environment variable configuration
│   │   ├── database.py        # SQLAlchemy engine & session factory
│   │   ├── audit.py           # Audit logging middleware
│   │   ├── models/            # SQLAlchemy ORM models (Project, Ministry, Sector…)
│   │   ├── schemas/           # Pydantic request / response schemas
│   │   ├── routes/            # API route handlers
│   │   │   ├── projects.py    # CRUD for infrastructure projects
│   │   │   ├── dashboard.py   # National summary & health distribution
│   │   │   ├── risk.py        # ML risk scoring & XGBoost predictions
│   │   │   ├── assistant.py   # AI Q&A assistant (Qwen3-8B + rule-based)
│   │   │   ├── benchmark.py   # Sector & national benchmarking
│   │   │   ├── insights.py    # Portfolio insights
│   │   │   └── health.py      # Service health check
│   │   └── ml_integration/
│   │       └── risk_client.py # Bridge between FastAPI and AI/ML models
│   ├── alembic/               # Database migration scripts
│   ├── scripts/
│   │   └── import_data.py     # PAIMANA CSV → PostgreSQL ingestion script
│   ├── tests/                 # Pytest API test suite
│   ├── requirements.txt       # Python dependencies
│   └── .env.example           # Environment variable template
│
├── 📂 ai/                     # ML prediction engine (Nirmaan Dristi Core)
│   ├── src/
│   │   ├── data_loader.py     # CSV ingestion & temporal feature engineering
│   │   ├── validation.py      # Data schema & sanity checks
│   │   ├── feature_selection.py  # Feature definitions & categorical/numerical splits
│   │   ├── target_generation.py  # Delta target calculation (3-month)
│   │   ├── preprocessing.py   # Imputation & OneHotEncoder pipeline
│   │   ├── walk_forward.py    # Chronological expanding-window cross-validation
│   │   ├── train_cost.py      # Cost model training & Platt-scaling calibration
│   │   ├── train_time.py      # Schedule model training & calibration
│   │   ├── evaluate.py        # Metrics (ROC-AUC, Brier, MedAE, MAE, RMSE)
│   │   ├── predict.py         # XGBoost inference with mathematical consistency
│   │   ├── explain.py         # TreeSHAP feature attribution module
│   │   ├── qwen_service.py    # Qwen3-8B LLM engine + deterministic fallback
│   │   └── project_service.py # High-level prediction API layer
│   ├── app/
│   │   └── streamlit_app.py   # Optional standalone Streamlit dashboard
│   ├── models/                # Pre-trained serialised model files (.pkl)
│   ├── config/
│   │   └── config.yaml        # Model hyperparameters & decision thresholds
│   ├── data/input/            # PAIMANA master CSV dataset
│   ├── train.py               # Full training pipeline orchestrator
│   ├── predict.py             # CLI prediction interface
│   └── requirements.txt       # AI module Python dependencies
│
├── 📂 data/
│   └── raw/                   # Raw PAIMANA master dataset files
│       └── PAIMANA_Master.csv # 3,361 projects × 14,979 monthly snapshots
│
└── 📂 pdfextractor/           # PDF extraction utilities (upcoming)
```

---

## ⚙️ Prerequisites

| Tool | Version | Purpose |
|:---|:---|:---|
| Python | 3.10+ | Backend & AI engine |
| Node.js | 18+ | Frontend development |
| PostgreSQL | 14+ | Project database |
| Git | Any | Version control |

---

## 🚀 Setup & Installation

### Step 1 — Clone the Repository

```bash
git clone <repository-url>
cd Sanket-AI
```

---

### Step 2 — Backend Setup (FastAPI)

```powershell
cd backend

# Create and activate virtual environment
python -m venv venv
.\venv\Scripts\Activate.ps1

# Install dependencies
pip install -r requirements.txt
```

**Configure environment:**

```powershell
copy .env.example .env
```

Edit `backend/.env` with your values:

```ini
DATABASE_URL=postgresql+psycopg2://postgres:YOUR_PASSWORD@localhost:5432/national_infrastructure
CORS_ORIGINS=http://localhost:5173,http://localhost:3000,http://127.0.0.1:5173
API_PREFIX=/api
ENVIRONMENT=development
DASHSCOPE_API_KEY=your_dashscope_api_key_here   # Optional — enables live Qwen3-8B
```

> 💡 Special characters in passwords (e.g. `@`) are automatically URL-encoded by the config module.

---

### Step 3 — Database Setup (PostgreSQL)

```sql
-- In pgAdmin or psql:
CREATE DATABASE national_infrastructure;
```

```powershell
# From backend/ — run migrations then import data
alembic upgrade head
python scripts/import_data.py
```

This ingests **3,361 projects** · **17 ministries** · **22 sectors** · **14,979 monthly snapshots** · **2,500 milestones**.

---

### Step 4 — AI Models

Pre-trained XGBoost models are already included in `ai/models/` — **no training required**.

```
ai/models/
├── cost_classifier_3m.pkl     ← 3-month cost escalation risk classifier
├── cost_regressor_3m.pkl      ← 3-month cost delta magnitude regressor
├── time_classifier_3m.pkl     ← 3-month schedule delay risk classifier
├── time_regressor_3m.pkl      ← 3-month delay magnitude regressor
└── preprocessing/             ← Serialised ColumnTransformer pipelines
```

*Optional — retrain from scratch if dataset changes:*

```bash
cd ai
python train.py
```

---

### Step 5 — Frontend Setup (React + Vite)

```bash
cd frontend
npm install
```

---

## ▶️ Running the Application

Open **three separate terminals**:

**Terminal 1 — Backend API**
```powershell
cd backend
.\venv\Scripts\Activate.ps1
uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```

**Terminal 2 — Frontend**
```bash
cd frontend
npm run dev
```

**Terminal 3 — AI Standalone Dashboard *(optional)***
```bash
cd ai
streamlit run app/streamlit_app.py
```

| Service | URL |
|:---|:---|
| 🖥️ Frontend Dashboard | http://localhost:5173 |
| ⚡ Backend API | http://127.0.0.1:8000 |
| 📖 Swagger API Docs | http://127.0.0.1:8000/docs |
| 📘 ReDoc API Docs | http://127.0.0.1:8000/redoc |
| 💚 Health Check | http://127.0.0.1:8000/api/health |
| 🔮 Streamlit AI Dashboard | http://localhost:8501 *(optional)* |

---

## 🔌 API Overview

| Method | Endpoint | Description |
|:---:|:---|:---|
| `GET` | `/api/health` | Service & database connectivity check |
| `GET` | `/api/projects` | Filtered, paginated project list |
| `GET` | `/api/projects/{id}` | Full project details, milestones & progress |
| `POST` | `/api/projects` | Create a new project |
| `PATCH` | `/api/projects/{id}` | Update project fields |
| `DELETE` | `/api/projects/{id}` | Remove a project |
| `GET` | `/api/dashboard/summary` | National metrics & health distribution |
| `GET` | `/api/dashboard/health-distribution` | Donut chart segment counts & percentages |
| `GET` | `/api/dashboard/priority-interventions` | High-risk intervention queue |
| `GET` | `/api/dashboard/risk-trend` | Time-series risk trend curves |
| `GET` | `/api/dashboard/delay-factors` | National delay cause breakdown |
| `GET` | `/api/risk/summary` | High-risk counts & percentage distributions |
| `GET` | `/api/risk/high-risk` | Ranked critical risk project list |
| `POST` | `/api/risk/projects/{id}/predict` | **XGBoost ML prediction + SHAP drivers** |
| `GET` | `/api/benchmark/{id}` | Sector & national benchmarking |
| `GET` | `/api/alerts/summary` | Action Centre queue & exposure metrics |
| `POST` | `/api/assistant/query` | **AI natural language Q&A assistant** |
| `POST` | `/api/assistant/explain/{id}` | **AI narrative summary for a project** |

---

## 🤖 AI & ML Features

### Forecasting Engine

- **3-Month Incremental Prediction**: Predicts future *additional* cost overrun Δ% and schedule delay Δ months at a **3-month** forward horizon — not cumulative re-estimates from day one
- **Mathematical Consistency Guarantees**: All derived totals (forecasted final cost, revised completion date) are computed via strict additive delta formulas
- **Calibrated Probabilities**: XGBoost classifiers calibrated with Platt scaling for well-calibrated risk probability scores
- **Walk-Forward Validation**: Models are evaluated on chronological expanding windows — zero temporal data leakage

### Explainability (TreeSHAP)

- **Local Explanations**: Per-project feature attribution showing exactly which factors are increasing or decreasing that project's risk
- **Global Importance**: Portfolio-wide feature ranking charts

### Natural Language Layer

| Mode | Description |
|:---|:---|
| **Live (Qwen3-8B)** | Set `DASHSCOPE_API_KEY` for LLM-generated executive summaries & interactive Q&A |
| **Offline Fallback** | Built-in deterministic rule engine generates SHAP-grounded explanations — works with **no API key** |

---

## 📊 Dataset

| Metric | Value |
|:---|:---|
| Total Projects | 3,361 unique infrastructure projects |
| Monthly Snapshots | 14,979 PAIMANA progress reports |
| Ministries Covered | 17 central government ministries |
| Sectors | 22 infrastructure sectors |
| Data Source | PAIMANA — Project Appraisal & Implementation Monitoring ANAlysis |

---

## 🧪 Testing

```powershell
# From backend/ directory
pytest tests/test_api.py -v
```

---

## 💻 Tech Stack

| Layer | Technologies |
|:---|:---|
| **Frontend** | React 19, TypeScript, Vite, Lucide React |
| **Backend** | FastAPI, Uvicorn, SQLAlchemy 2.x, Alembic, Pydantic |
| **Database** | PostgreSQL 14+ |
| **ML / AI** | XGBoost, Scikit-Learn, SHAP (TreeExplainer), Joblib |
| **LLM** | Qwen3-8B via DashScope (OpenAI-compatible API) |
| **AI Visualization** | Streamlit, Plotly, Matplotlib |
| **Data Processing** | Pandas, NumPy |
| **Config** | PyYAML, Python-Dotenv |

---

## 📄 License

Developed for **Smart India Hackathon 2026** under the **Nirmaan Dristi** initiative for monitoring and predictive analytics of Central Sector Infrastructure Projects managed by the Project Monitoring Group (PMG), Government of India.

---

<div align="center">
  <sub>Built with ❤️ by Team Sanket-AI for SIH 2026</sub>
</div>
