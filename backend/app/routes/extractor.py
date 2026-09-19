"""
FastAPI Extractor Router for Nirmaan-Drishti National Infrastructure Intelligence Platform.
Unifies the MoSPI Universal PDF Extractor suite directly into the core FastAPI backend.
Provides endpoints for:
- PDF upload and format classification
- Live stream & table vector extraction (PAIMANA, Modern Flash, Legacy Milestones)
- Pre-loaded workspace sample PDF extraction
- Styled canonical OpenPyXL Excel exports
- Direct PostgreSQL Database & ML Feature Store Synchronization with zero inter-service latency
"""

import os
import sys
import uuid
import shutil
import tempfile
import logging
from typing import Optional, List, Dict, Any
from pydantic import BaseModel
from fastapi import APIRouter, File, UploadFile, HTTPException, Query, Depends, Request
from fastapi.responses import FileResponse, JSONResponse
from sqlalchemy.orm import Session

from app.database import get_db, check_db_connection
from app.models.project import Project
from app.extractor.universal_engine import extract_pdf_to_canonical_dataset
from app.extractor.excel_exporter import export_records_to_styled_excel
from app.extractor.classifier import classify_pdf_report
from app.extractor.dataset_sync import check_dataset_exists, update_master_dataset, reconcile_and_heal_dataset

logger = logging.getLogger("sanket_ai.extractor")

router = APIRouter(tags=["MoSPI PDF Extractor"])

BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))

def get_writable_dir(dir_name: str) -> str:
    """Returns local dir if writable, else falls back to system temp directory."""
    local_dir = os.path.join(BASE_DIR, dir_name)
    try:
        os.makedirs(local_dir, exist_ok=True)
        test_file = os.path.join(local_dir, ".writable_check")
        with open(test_file, "w") as f:
            f.write("ok")
        os.remove(test_file)
        return local_dir
    except OSError:
        temp_dir = os.path.join(tempfile.gettempdir(), "nirmaan_drishti", dir_name)
        os.makedirs(temp_dir, exist_ok=True)
        return temp_dir

UPLOAD_DIR = get_writable_dir("uploads")
EXPORT_DIR = get_writable_dir("exports")

# In-memory storage for full extracted records by file_id (for zero-latency dataset sync)
LATEST_EXTRACTIONS: Dict[str, List[Dict[str, Any]]] = {}

# Alternate export paths for backward compatibility
ALT_EXPORT_DIRS = [
    os.path.abspath(os.path.join(BASE_DIR, "../../pdfextractor/backend/exports")),
    os.path.abspath(os.path.join(BASE_DIR, "../exports")),
    os.path.abspath(os.path.join(BASE_DIR, "exports")),
]


@router.get("/extractor/health", summary="Extractor Engine Health Check")
@router.get("/health/extractor", summary="Extractor Engine Health Check (Alias)")
def extractor_health():
    """Returns operational telemetry for the embedded extraction engine."""
    return {
        "status": "healthy",
        "service": "Nirmaan-Drishti Unified MoSPI Extraction Engine",
        "version": "2.2.0",
        "supported_formats": [
            "PAIMANA Portal (2025-2027+)",
            "Modern Flash Reports (2024-2025)",
            "Legacy Milestone Reports (2001-2024)",
            "Future-Adaptive Semantic Schema Healer"
        ],
        "database_integrated": check_db_connection()
    }


@router.get("/sample-files", summary="List Pre-Loaded Representative Flash Reports")
@router.get("/extractor/sample-files", summary="List Sample Reports (Alias)")
def list_sample_files():
    """Lists representative sample reports embedded inside the repository for 1-click verification."""
    internal_samples_dir = os.path.abspath(os.path.join(BASE_DIR, "samples"))
    pdfextractor_samples_dir = os.path.abspath(os.path.join(BASE_DIR, "../../pdfextractor/samples"))

    def find_file(rel_paths: List[str]) -> Optional[str]:
        for p in rel_paths:
            if p and os.path.exists(p):
                return os.path.abspath(p)
        return None

    samples_def = [
        {
            "name": "May 2026 Flash Report (PAIMANA Portal Era)",
            "paths": [
                os.path.join(internal_samples_dir, "FlashReport_May2026.pdf"),
                os.path.join(pdfextractor_samples_dir, "FlashReport_May2026.pdf"),
                os.path.abspath(os.path.join(BASE_DIR, "../../../2026-2027/FlashReport_May2026.pdf")),
            ],
            "era": "PAIMANA 2026-2027",
            "size": "1,990+ projects",
            "month": "May",
            "year": "2026"
        },
        {
            "name": "February 2015 Flash Report (Legacy Milestone Era)",
            "paths": [
                os.path.join(internal_samples_dir, "FR_feb_2015.pdf"),
                os.path.join(pdfextractor_samples_dir, "FR_feb_2015.pdf"),
                os.path.abspath(os.path.join(BASE_DIR, "../../../2014-2015/FR_feb_2015.pdf")),
            ],
            "era": "Legacy Milestones 2001-2024",
            "size": "750 projects",
            "month": "February",
            "year": "2015"
        },
        {
            "name": "July 2024 Flash Report (Modern Table 6/7 Era)",
            "paths": [
                os.path.join(internal_samples_dir, "July_Part-II.pdf"),
                os.path.join(pdfextractor_samples_dir, "July_Part-II.pdf"),
                os.path.abspath(os.path.join(BASE_DIR, "../../../2024-2025/July_Part-II.pdf")),
            ],
            "era": "Modern Flash 2024-2025",
            "size": "1,700+ projects",
            "month": "July",
            "year": "2024"
        },
        {
            "name": "May 2007 Flash Report (Historical Milestone Era)",
            "paths": [
                os.path.join(internal_samples_dir, "FR_MAY_2007.pdf"),
                os.path.join(pdfextractor_samples_dir, "FR_MAY_2007.pdf"),
                os.path.abspath(os.path.join(BASE_DIR, "../../../2007-2008/FR_MAY_2007.pdf")),
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


@router.post("/classify", summary="Classify Uploaded PDF Report")
@router.post("/extractor/classify", summary="Classify PDF Report (Alias)")
async def classify_uploaded_pdf(file: UploadFile = File(...)):
    """Classifies a PDF and returns document metadata and detected structure."""
    if not file.filename or not file.filename.lower().endswith(".pdf"):
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


@router.post("/extract", summary="Extract Uploaded PDF to Canonical Dataset & Styled Excel")
@router.post("/extractor/extract", summary="Extract PDF (Alias)")
async def extract_pdf(
    file: UploadFile = File(...),
    month: Optional[str] = Query(None),
    year: Optional[str] = Query(None)
):
    """Upload and extract a MoSPI PDF into canonical 20-column dataset and styled Excel."""
    if not file.filename or not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are supported.")
        
    file_id = str(uuid.uuid4())[:8]
    clean_name = os.path.splitext(file.filename)[0]
    saved_pdf_path = os.path.join(UPLOAD_DIR, f"{file_id}_{file.filename}")
    
    try:
        with open(saved_pdf_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
            
        result = extract_pdf_to_canonical_dataset(saved_pdf_path)
        
        if month:
            result['summary_metrics']['reporting_month'] = month
        if year:
            result['summary_metrics']['reporting_year'] = str(year)

        LATEST_EXTRACTIONS[file_id] = result['records']

        excel_filename = f"{clean_name}_Extracted_Canonical_{file_id}.xlsx"
        excel_path = os.path.join(EXPORT_DIR, excel_filename)
        export_records_to_styled_excel(result['records'], excel_path)
        
        return {
            "status": "success",
            "success": True,
            "file_id": file_id,
            "filename": file.filename,
            "reporting_month": result['summary_metrics'].get('reporting_month', month),
            "reporting_year": result['summary_metrics'].get('reporting_year', year),
            "classification": result['classification'],
            "engine_used": result['engine_used'],
            "execution_time_seconds": result['execution_time_seconds'],
            "summary_metrics": result['summary_metrics'],
            "metadata": result['summary_metrics'],
            "records_count": result['records_count'],
            "total_projects": result['records_count'],
            "excel_file": excel_filename,
            "download_url": f"/api/download/{excel_filename}",
            "records": result['records'][:200],
            "records_preview": result['records'][:200]
        }
    except Exception as e:
        logger.error(f"PDF extraction error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Extraction failed: {str(e)}")
    finally:
        if os.path.exists(saved_pdf_path):
            try:
                os.remove(saved_pdf_path)
            except Exception:
                pass


class SampleExtractRequest(BaseModel):
    sample_path: Optional[str] = None
    filename: Optional[str] = None
    path: Optional[str] = None
    month: Optional[str] = None
    year: Optional[str] = None


@router.post("/extract-sample", summary="Extract Pre-Loaded Sample PDF Directly")
@router.post("/extractor/extract-sample", summary="Extract Sample PDF (Alias)")
async def extract_sample_pdf(
    sample_path: Optional[str] = Query(None),
    filename: Optional[str] = Query(None),
    path: Optional[str] = Query(None),
    month: Optional[str] = Query(None),
    year: Optional[str] = Query(None),
    body: Optional[SampleExtractRequest] = None
):
    """Extract a pre-existing workspace sample PDF directly."""
    target_path = sample_path or filename or path
    if not target_path and body:
        target_path = body.sample_path or body.filename or body.path
        if not month:
            month = body.month
        if not year:
            year = body.year
        
    candidate_dirs = [
        os.path.abspath(os.path.join(BASE_DIR, "samples")),
        os.path.abspath(os.path.join(BASE_DIR, "../../pdfextractor/samples")),
        os.path.abspath(os.path.join(BASE_DIR, "..")),
        os.path.abspath(os.path.join(BASE_DIR, "../../samples"))
    ]
    if target_path and not os.path.exists(target_path):
        target_name = os.path.basename(target_path)
        for cdir in candidate_dirs:
            candidate = os.path.join(cdir, target_name)
            if os.path.exists(candidate):
                target_path = candidate
                break
    elif not target_path and filename:
        for cdir in candidate_dirs:
            candidate = os.path.join(cdir, filename)
            if os.path.exists(candidate):
                target_path = candidate
                break

    if not target_path or not os.path.exists(target_path):
        raise HTTPException(status_code=404, detail=f"Sample PDF '{target_path or filename}' not found on disk.")
        
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
            "success": True,
            "file_id": file_id,
            "filename": os.path.basename(target_path),
            "reporting_month": result['summary_metrics'].get('reporting_month', month),
            "reporting_year": result['summary_metrics'].get('reporting_year', year),
            "classification": result['classification'],
            "engine_used": result['engine_used'],
            "execution_time_seconds": result['execution_time_seconds'],
            "summary_metrics": result['summary_metrics'],
            "metadata": result['summary_metrics'],
            "records_count": result['records_count'],
            "total_projects": result['records_count'],
            "excel_file": excel_filename,
            "download_url": f"/api/download/{excel_filename}",
            "records": result['records'][:200],
            "records_preview": result['records'][:200]
        }
    except Exception as e:
        logger.error(f"Sample extraction error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Sample extraction failed: {str(e)}")


@router.get("/download/{filename}", summary="Download Styled Excel Workbook")
@router.get("/extractor/download/{filename}", summary="Download Excel Workbook (Alias)")
def download_excel(filename: str):
    """Download generated styled Excel workbook."""
    file_path = os.path.join(EXPORT_DIR, filename)
    if not os.path.exists(file_path):
        # Search alternate export directories
        found = False
        for alt_dir in ALT_EXPORT_DIRS:
            candidate = os.path.join(alt_dir, filename)
            if os.path.exists(candidate):
                file_path = candidate
                found = True
                break
        if not found:
            raise HTTPException(status_code=404, detail=f"Requested file '{filename}' does not exist on server.")
        
    return FileResponse(
        path=file_path,
        filename=filename,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'}
    )


@router.get("/check-dataset", summary="Pre-Flight Master Dataset Check")
@router.get("/extractor/check-dataset", summary="Check Dataset (Alias)")
def check_dataset_period(month: str = Query(...), year: str = Query(...)):
    """Checks whether project records for a specific month and year are already in the master dataset."""
    result = check_dataset_exists(month, year)
    return result


class MasterUpdateRequest(BaseModel):
    file_id: Optional[str] = None
    month: str
    year: str
    overwrite: bool = False
    records: Optional[List[Dict[str, Any]]] = None


@router.post("/update-master-dataset", summary="Synchronize Extracted Projects to Master Database & Retrain ML")
@router.post("/extractor/update-master-dataset", summary="Update Master Dataset (Alias)")
def update_dataset_endpoint(payload: MasterUpdateRequest, db: Optional[Session] = Depends(get_db)):
    """
    Merges extracted records into the central master dataset (Features.csv),
    DIRECTLY syncs records into the PostgreSQL projects database table (zero inter-service latency),
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

    # 1. Update central features CSV and trigger ML retrain pipeline
    try:
        csv_sync_result = update_master_dataset(
            records=records_to_sync,
            month=payload.month,
            year=payload.year,
            overwrite=payload.overwrite
        )
    except Exception as e:
        logger.error(f"CSV sync error: {e}", exc_info=True)
        csv_sync_result = {"status": "partial", "error": str(e)}

    # 2. Direct PostgreSQL Database Ingestion (Zero Latency)
    db_ingested_count = 0
    if db is not None:
        try:
            for r in records_to_sync:
                p_id = str(r.get("project_id") or "")
                if not p_id:
                    continue

                existing = db.query(Project).filter(Project.id == p_id).first()
                orig = float(r.get("Original cost (₹ Cr)") or 0.0)
                rev = float(r.get("revised cost (₹ Cr)") or orig)
                exp = float(r.get("cumulative expenditure (₹ Cr)") or 0.0)
                phys_str = str(r.get("physical progress") or "0").replace("%", "").strip()
                try:
                    phys = float(phys_str)
                except ValueError:
                    phys = 0.0

                if existing:
                    if rev > 0:
                        existing.revised_cost = rev
                    if exp > 0:
                        existing.cumulative_expenditure = exp
                    if phys > 0:
                        existing.physical_progress = phys
                    db_ingested_count += 1
                else:
                    new_p = Project(
                        id=p_id,
                        project_code=r.get("PMGID") or f"PMG-{p_id}",
                        legacy_ocms_code=r.get("legacy_ocms_code") or f"OCMS-{p_id}",
                        name=r.get("project_name") or "Extracted Project",
                        state=r.get("state"),
                        original_cost=orig,
                        revised_cost=rev,
                        cumulative_expenditure=exp,
                        physical_progress=phys,
                        schedule_status="CRITICAL" if phys < 70 else "DELAYED",
                        project_status="ACTIVE"
                    )
                    db.add(new_p)
                    db_ingested_count += 1

            db.commit()
            logger.info(f"Directly synced {db_ingested_count} extracted projects to PostgreSQL database.")
        except Exception as db_err:
            logger.warning(f"PostgreSQL direct sync note (running with in-memory fallback): {db_err}")
            if db:
                db.rollback()

    if isinstance(csv_sync_result, dict):
        csv_sync_result["database_synced_count"] = db_ingested_count

    return csv_sync_result


@router.post("/reconcile-dataset", summary="Self-Healing Dataset Reconciliation")
@router.post("/extractor/reconcile-dataset", summary="Reconcile Dataset (Alias)")
def reconcile_dataset_endpoint(payload: MasterUpdateRequest):
    """
    Self-healing dataset reconciliation endpoint:
    Cross-references extracted records with master dataset (Features.csv),
    auto-corrects any discrepancies/wrong values, and recalculates derived metrics.
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
        logger.error(f"Reconcile error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to reconcile dataset: {str(e)}")
