# Sanket-AI: National Infrastructure Early Warning & Predictive Monitoring Backend

FastAPI + PostgreSQL + SQLAlchemy 2.x + Alembic backend service for National Infrastructure project monitoring, predictive cost/schedule overrun forecasting, risk scoring, and intelligence assistant.

---

## 1. Prerequisites

* **Python 3.10+** (Tested on Python 3.14)
* **PostgreSQL 14+** (Running locally on port 5432)
* **Node.js 18+** (For frontend)

---

## 2. Setup & Virtual Environment (Windows)

Open PowerShell in the repository root `c:\Eren_websites\Navd\Sanket-AI`:

```powershell
# Navigate to backend directory
cd backend

# Create virtual environment (optional if using global python)
python -m venv venv

# Activate virtual environment
.\venv\Scripts\Activate.ps1

# Install required dependencies
pip install -r requirements.txt
```

---

## 3. Environment Configuration

Copy `.env.example` to `.env` (or configure `backend/.env`):

```ini
DATABASE_URL=postgresql+psycopg2://postgres:YOUR_PASSWORD@localhost:5432/national_infrastructure
CORS_ORIGINS=http://localhost:5173,http://localhost:3000,http://127.0.0.1:5173
API_PREFIX=/api
ENVIRONMENT=development
DASHSCOPE_API_KEY=your_dashscope_key_here
```

> **Note**: Special characters in passwords (such as `@`) are automatically sanitized and URL-encoded by the application configuration.

---

## 4. PostgreSQL Database & Migrations

1. Ensure the PostgreSQL database `national_infrastructure` is created in pgAdmin or psql:
   ```sql
   CREATE DATABASE national_infrastructure;
   ```

2. Run Alembic migrations to create all relational tables:
   ```powershell
   alembic upgrade head
   ```

---

## 5. Import Real PAIMANA Master Dataset

Run the automated data ingestion script to import historical infrastructure monitoring records:

```powershell
python scripts/import_data.py
```

This ingests:
* **3,361 Unique Infrastructure Projects**
* **17 Ministries** & **22 Sectors**
* **14,979 Monthly Progress Snapshots**
* **2,500 Milestones**

---

## 6. Start FastAPI Backend Server

```powershell
uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```

---

## 7. Interactive API Documentation

Once the backend is running, access:
* **Swagger UI**: [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs)
* **ReDoc**: [http://127.0.0.1:8000/redoc](http://127.0.0.1:8000/redoc)
* **Health Check**: [http://127.0.0.1:8000/api/health](http://127.0.0.1:8000/api/health)

---

## 8. Run Automated Test Suite

Run the full pytest suite:

```powershell
pytest tests/test_api.py -v
```

---

## 9. API Overview

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/health` | Service and PostgreSQL connectivity status |
| `GET` | `/api/projects` | Filtered, paginated list of all infrastructure projects |
| `GET` | `/api/projects/{id}` | Detailed project metadata, milestones & progress |
| `POST` | `/api/projects` | Create a new project |
| `PATCH` | `/api/projects/{id}` | Update existing project |
| `DELETE` | `/api/projects/{id}` | Delete project |
| `GET` | `/api/dashboard/summary` | Live national metrics, health distribution, interventions |
| `GET` | `/api/dashboard/health-distribution` | Donut chart segment counts & percentages |
| `GET` | `/api/dashboard/priority-interventions` | High-risk intervention list |
| `GET` | `/api/dashboard/risk-trend` | Time-series SVG spline curves |
| `GET` | `/api/dashboard/delay-factors` | National delay cause breakdown |
| `GET` | `/api/risk/summary` | High-risk counts & percentage distributions |
| `GET` | `/api/risk/high-risk` | Ranked list of critical risk projects |
| `POST` | `/api/risk/projects/{id}/predict` | Real XGBoost ML prediction with SHAP drivers |
| `GET` | `/api/alerts/summary` | Action Centre queue and exposure metrics |
| `GET` | `/api/benchmark/{id}` | Comparative sector & national performance metrics |
| `POST` | `/api/assistant/query` | AI Infrastructure Intelligence querying |
| `POST` | `/api/assistant/explain/{id}` | AI natural language narrative summary |
