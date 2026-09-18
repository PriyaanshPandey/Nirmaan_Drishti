"""
FastAPI Backend Application for Standalone MoSPI PDF Extractor Suite.
Provides endpoints for file upload, format classification, live extraction,
preview datasets, styled Excel exports, pre-flight dataset verification,
and master dataset synchronization with automated ML model retraining.

Authentication: All functional endpoints require a valid JWT Bearer token
with role="impd_officer". Only IMPD officers may access the PDF Extractor.
"""

import os
import sys
import uuid
import shutil
from typing import Optional, List, Dict, Any
from pydantic import BaseModel
from fastapi import FastAPI, File, UploadFile, HTTPException, Query, Depends, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.security import OAuth2PasswordBearer

# JWT verification (uses same SECRET_KEY as main backend)
try:
    from jose import JWTError, jwt as _jose_jwt
    _JOSE_AVAILABLE = True
except ImportError:
    _JOSE_AVAILABLE = False

# Load SECRET_KEY from environment (same variable as main backend)
_PDF_SECRET_KEY = os.environ.get("SECRET_KEY", "CHANGE_ME_USE_ENV_VAR_IN_PRODUCTION")
_PDF_ALGORITHM = "HS256"

_pdf_oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")


def _require_impd_officer(token: str = Depends(_pdf_oauth2_scheme)):
    """
    FastAPI dependency: validates JWT and enforces impd_officer role.
    Raises HTTP 401 if token is missing/invalid, HTTP 403 if role is wrong.
    """
    if not _JOSE_AVAILABLE:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Authentication library not installed on this server."
        )
    try:
        payload = _jose_jwt.decode(token, _PDF_SECRET_KEY, algorithms=[_PDF_ALGORITHM])
        role: str = payload.get("role", "")
        username: str = payload.get("sub", "")
        if not username:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Could not validate credentials.",
                headers={"WWW-Authenticate": "Bearer"},
            )
        if role != "impd_officer":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied. PDF Extractor requires impd_officer role.",
            )
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials.",
            headers={"WWW-Authenticate": "Bearer"},
        )

# Convenience type alias for route signatures
_IMPDUser = Depends(_require_impd_officer)

# Ensure current directory is in sys.path
BASE_DIR = os.path.abspath(os.path.dirname(__file__))
if BASE_DIR not in sys.path:
    sys.path.insert(0, BASE_DIR)

from core.universal_engine import extract_pdf_to_canonical_dataset
from core.excel_exporter import export_records_to_styled_excel
from core.classifier import classify_pdf_report
from core.dataset_sync import check_dataset_exists, update_master_dataset, reconcile_and_heal_dataset

import tempfile

def get_writable_dir(dir_name: str) -> str:
    """Returns local dir if writable, else falls back to system temp directory (for Vercel/Lambda serverless)."""
    local_dir = os.path.join(BASE_DIR, dir_name)
    try:
        os.makedirs(local_dir, exist_ok=True)
        test_file = os.path.join(local_dir, ".writable_check")
        with open(test_file, "w") as f:
            f.write("ok")
        os.remove(test_file)
        return local_dir
    except OSError:
        temp_dir = os.path.join(tempfile.gettempdir(), "mospi_extractor", dir_name)
        os.makedirs(temp_dir, exist_ok=True)
        return temp_dir

UPLOAD_DIR = get_writable_dir("uploads")
EXPORT_DIR = get_writable_dir("exports")

# In-memory storage for full extracted records by file_id (for fast master sync)
LATEST_EXTRACTIONS: Dict[str, List[Dict[str, Any]]] = {}

app = FastAPI(
    title="MoSPI PDF Extractor API",
    description="Universal Adaptive Extractor for MoSPI Flash Report PDFs (2001 - 2026+) with Master Dataset Synchronization",
    version="2.1.0"
)

# Enable CORS for React frontend (Vite dev server default port 5173, etc.)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/api/health")
def health_check():
    return {
        "status": "healthy",
        "service": "MoSPI Universal PDF Extractor API",
        "version": "2.1.0",
        "supported_formats": ["PAIMANA (2025-2027+)", "Modern Flash (2024-2025)", "Legacy Milestone (2001-2024)", "Future-Adaptive Semantic"]
    }

@app.get("/api/sample-files", dependencies=[_IMPDUser])
def list_sample_files():
    """Lists representative sample files from the workspace for one-click testing."""
    def find_file(rel_paths):
        for p in rel_paths:
            if os.path.exists(p):
                return os.path.abspath(p)
        return None

    samples_def = [
        {
            "name": "May 2026 Flash Report (PAIMANA Portal Era)",
            "paths": [
                r"C:\Users\mridu\OneDrive\Desktop\New folder\2026-2027\FlashReport_May2026.pdf",
                os.path.abspath(os.path.join(BASE_DIR, "../../2026-2027/FlashReport_May2026.pdf")),
                r"C:\Users\mridu\OneDrive\Desktop\extracter\2026-2027\FlashReport_May2026.pdf"
            ],
            "era": "PAIMANA 2026-2027",
            "size": "2,200+ projects",
            "month": "May",
            "year": "2026"
        },
        {
            "name": "July 2024 Flash Report (Modern Table 6/7 Era)",
            "paths": [
                r"C:\Users\mridu\OneDrive\Desktop\New folder\2024-2025\July_Part-II.pdf",
                os.path.abspath(os.path.join(BASE_DIR, "../../2024-2025/July_Part-II.pdf"))
            ],
            "era": "Modern Flash 2024-2025",
            "size": "1,700+ projects",
            "month": "July",
            "year": "2024"
        },
        {
            "name": "May 2007 Flash Report (Historical Milestone Era)",
            "paths": [
                r"C:\Users\mridu\OneDrive\Desktop\New folder\2007-2008\FR_MAY_2007.pdf",
                r"C:\Users\mridu\OneDrive\Desktop\data\2007-2008\FR_MAY_2007.pdf",
                os.path.abspath(os.path.join(BASE_DIR, "../../2007-2008/FR_MAY_2007.pdf"))
            ],
            "era": "Legacy Milestones 2001-2024",
            "size": "900+ projects",
            "month": "May",
            "year": "2007"
        }
    ]

    available = []
    for s in samples_def:
        resolved = find_file(s["paths"])
        if resolved:
            available.append({
                "name": s["name"],
                "path": resolved,
                "era": s["era"],
                "size": s["size"],
                "month": s["month"],
                "year": s["year"]
            })

    return {"samples": available}

@app.get("/api/check-dataset", dependencies=[_IMPDUser])
def check_dataset_period(month: str = Query(...), year: str = Query(...)):
    """
    Pre-flight verification endpoint:
    Checks whether project records for a specific month and year
    are already present in the master dataset repository.
    """
    result = check_dataset_exists(month, year)
    return result

class MasterUpdateRequest(BaseModel):
    file_id: Optional[str] = None
    month: str
    year: str
    overwrite: bool = False
    records: Optional[List[Dict[str, Any]]] = None

@app.post("/api/update-master-dataset", dependencies=[_IMPDUser])
def update_dataset_endpoint(payload: MasterUpdateRequest):
    """
    Merges extracted records into the central master dataset (Features.csv)
    and triggers ML model retraining.
    """
    records_to_sync = payload.records
    if not records_to_sync and payload.file_id:
        records_to_sync = LATEST_EXTRACTIONS.get(payload.file_id)

    if not records_to_sync:
        raise HTTPException(
            status_code=400,
            detail="No extracted records found to update dataset. Please perform extraction first."
        )

    try:
        sync_result = update_master_dataset(
            records=records_to_sync,
            month=payload.month,
            year=payload.year,
            overwrite=payload.overwrite
        )
        return sync_result
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Failed to update master dataset: {str(e)}")

@app.post("/api/reconcile-dataset", dependencies=[_IMPDUser])
def reconcile_dataset_endpoint(payload: MasterUpdateRequest):
    """
    Self-healing dataset reconciliation endpoint:
    Cross-references extracted records with master dataset (Features.csv),
    auto-corrects any discrepancies/wrong values, and recalculates derived metrics.
    If period <= May 2026, model retraining is skipped (already trained).
    If period > May 2026, model retraining is triggered.
    """
    records_to_reconcile = payload.records
    if not records_to_reconcile and payload.file_id:
        records_to_reconcile = LATEST_EXTRACTIONS.get(payload.file_id)

    if not records_to_reconcile:
        raise HTTPException(
            status_code=400,
            detail="No extracted records found to reconcile dataset. Please perform extraction first."
        )

    try:
        reconcile_result = reconcile_and_heal_dataset(
            records=records_to_reconcile,
            month=payload.month,
            year=payload.year,
            overwrite=payload.overwrite
        )
        return reconcile_result
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Failed to reconcile dataset: {str(e)}")

@app.post("/api/classify", dependencies=[_IMPDUser])
async def classify_uploaded_pdf(file: UploadFile = File(...)):
    """Classifies a PDF and returns document metadata and detected structure."""
    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are supported.")
        
    temp_id = str(uuid.uuid4())[:8]
    temp_path = os.path.join(UPLOAD_DIR, f"{temp_id}_{file.filename}")
    with open(temp_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
        
    try:
        classification = classify_pdf_report(temp_path)
        return {"filename": file.filename, "classification": classification}
    finally:
        if os.path.exists(temp_path):
            os.remove(temp_path)

@app.post("/api/extract", dependencies=[_IMPDUser])
async def extract_pdf(
    file: UploadFile = File(...),
    month: Optional[str] = Query(None),
    year: Optional[str] = Query(None)
):
    """Upload and extract a MoSPI PDF into canonical 20-column dataset and styled Excel."""
    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are supported.")
        
    file_id = str(uuid.uuid4())[:8]
    clean_name = os.path.splitext(file.filename)[0]
    saved_pdf_path = os.path.join(UPLOAD_DIR, f"{file_id}_{file.filename}")
    
    try:
        with open(saved_pdf_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
            
        # Run universal extraction pipeline
        result = extract_pdf_to_canonical_dataset(saved_pdf_path)
        
        # Override month/year in summary metrics if provided by user
        if month:
            result['summary_metrics']['reporting_month'] = month
        if year:
            result['summary_metrics']['reporting_year'] = str(year)

        # Store in-memory for fast dataset synchronization
        LATEST_EXTRACTIONS[file_id] = result['records']

        # Export styled Excel file
        excel_filename = f"{clean_name}_Extracted_Canonical_{file_id}.xlsx"
        excel_path = os.path.join(EXPORT_DIR, excel_filename)
        export_records_to_styled_excel(result['records'], excel_path)
        
        # Build response
        return {
            "status": "success",
            "file_id": file_id,
            "filename": file.filename,
            "reporting_month": result['summary_metrics'].get('reporting_month', month),
            "reporting_year": result['summary_metrics'].get('reporting_year', year),
            "classification": result['classification'],
            "engine_used": result['engine_used'],
            "execution_time_seconds": result['execution_time_seconds'],
            "summary_metrics": result['summary_metrics'],
            "records_count": result['records_count'],
            "download_url": f"/api/download/{excel_filename}",
            "records_preview": result['records'][:200]  # First 200 for fast UI preview
        }
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Extraction failed: {str(e)}")
    finally:
        if os.path.exists(saved_pdf_path):
            try:
                os.remove(saved_pdf_path)
            except Exception:
                pass

class SampleExtractRequest(BaseModel):
    sample_path: Optional[str] = None
    path: Optional[str] = None
    month: Optional[str] = None
    year: Optional[str] = None

@app.post("/api/extract-sample", dependencies=[_IMPDUser])
async def extract_sample_pdf(
    sample_path: Optional[str] = Query(None),
    month: Optional[str] = Query(None),
    year: Optional[str] = Query(None),
    body: Optional[SampleExtractRequest] = None
):
    """Extract a pre-existing workspace sample PDF directly."""
    target_path = sample_path
    if not target_path and body:
        target_path = body.sample_path or body.path
        if not month:
            month = body.month
        if not year:
            year = body.year
        
    if not target_path or not os.path.exists(target_path):
        raise HTTPException(status_code=404, detail="Sample PDF not found on disk.")
        
    clean_name = os.path.splitext(os.path.basename(target_path))[0]
    file_id = str(uuid.uuid4())[:8]
    
    try:
        result = extract_pdf_to_canonical_dataset(target_path)
        
        if month:
            result['summary_metrics']['reporting_month'] = month
        if year:
            result['summary_metrics']['reporting_year'] = str(year)

        LATEST_EXTRACTIONS[file_id] = result['records']

        excel_filename = f"{clean_name}_Extracted_{file_id}.xlsx"
        excel_path = os.path.join(EXPORT_DIR, excel_filename)
        export_records_to_styled_excel(result['records'], excel_path)
        
        return {
            "status": "success",
            "file_id": file_id,
            "filename": os.path.basename(target_path),
            "reporting_month": result['summary_metrics'].get('reporting_month', month),
            "reporting_year": result['summary_metrics'].get('reporting_year', year),
            "classification": result['classification'],
            "engine_used": result['engine_used'],
            "execution_time_seconds": result['execution_time_seconds'],
            "summary_metrics": result['summary_metrics'],
            "records_count": result['records_count'],
            "download_url": f"/api/download/{excel_filename}",
            "records_preview": result['records'][:200]
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Sample extraction failed: {str(e)}")

@app.get("/api/download/{filename}", dependencies=[_IMPDUser])
def download_excel(filename: str):
    """Download generated styled Excel workbook."""
    file_path = os.path.join(EXPORT_DIR, filename)
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="Requested file does not exist.")
        
    return FileResponse(
        path=file_path,
        filename=filename,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    )

# Mount React static files if built
FRONTEND_DIST = os.path.abspath(os.path.join(BASE_DIR, "../frontend/dist"))
if os.path.exists(FRONTEND_DIST):
    from fastapi.staticfiles import StaticFiles
    app.mount("/", StaticFiles(directory=FRONTEND_DIST, html=True), name="static")
else:
    @app.get("/")
    def root_fallback():
        return {
            "status": "online",
            "service": "MoSPI Universal PDF Extractor API",
            "docs": "/docs",
            "health": "/api/health",
            "message": "FastAPI backend is running! Build frontend (npm run build in frontend/) to serve UI dashboard."
        }

if __name__ == "__main__":
    import uvicorn
    import threading
    import webbrowser
    import time

    def open_browser():
        time.sleep(1.2)
        print("\n>>> Web Dashboard ready! Opening http://localhost:8000 in your browser...")
        try:
            webbrowser.open("http://localhost:8000")
        except Exception as e:
            print(f"Could not open browser automatically: {e}")

    threading.Thread(target=open_browser, daemon=True).start()
    print("Starting MoSPI Universal PDF Extractor Server on http://localhost:8000 ...")
    uvicorn.run(app, host="0.0.0.0", port=8000)
