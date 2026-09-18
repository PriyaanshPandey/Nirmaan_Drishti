"""
Universal Extraction Engine for MoSPI Flash Report PDFs.
Orchestrates format classification, parser execution, multi-strategy fallback,
and deduplication into the canonical 20-column master schema.
"""

import os
import time
from typing import Dict, Any, List
import pandas as pd

from .schema import CANONICAL_COLUMNS
from .classifier import classify_pdf_report
from .extractor_paimana import parse_paimana_pdf
from .extractor_modern import parse_modern_flash_pdf
from .extractor_legacy import parse_legacy_pdf
from .extractor_adaptive import parse_adaptive_pdf

def extract_pdf_to_canonical_dataset(pdf_path: str) -> Dict[str, Any]:
    """
    Main extraction pipeline:
    1. Classifies PDF format (PAIMANA, Modern, Legacy, or Unknown).
    2. Runs the optimal parser for that format.
    3. If optimal parser yields fewer than 10 records, triggers Adaptive Heuristic fallback.
    4. Deduplicates and aligns all columns to the exact 20-column canonical schema.
    5. Returns records and extraction telemetry metrics.
    """
    t0 = time.time()
    if not os.path.exists(pdf_path):
        raise FileNotFoundError(f"PDF file not found: {pdf_path}")

    # 1. Classification
    classification = classify_pdf_report(pdf_path)
    fmt = classification['format_type']
    month = classification['month']
    year = classification['year']
    fy = classification['financial_year']

    records = []
    engine_used = ""

    # 2. Strategy Execution
    try:
        if fmt == 'PAIMANA':
            records = parse_paimana_pdf(pdf_path, month, year, fy)
            engine_used = "PAIMANA Portal Table-6 Engine"
        elif fmt == 'MODERN_FLASH':
            records = parse_modern_flash_pdf(pdf_path, month, year, fy)
            engine_used = "Modern Flash Report Table-6/7 Engine"
        elif fmt == 'LEGACY_MILESTONE':
            records = parse_legacy_pdf(pdf_path, month, year, fy)
            engine_used = "Historical Annexure-III Milestone Engine"
    except Exception as e:
        print(f"Primary extractor encountered error: {e}. Falling back to Adaptive Engine...")
        records = []

    # 3. Fallback to Adaptive Engine if primary engine yielded minimal results
    if len(records) < 5:
        print("Triggering Future-Adaptive Semantic Extractor...")
        adaptive_recs = parse_adaptive_pdf(pdf_path, month, year, fy)
        if len(adaptive_recs) > len(records):
            records = adaptive_recs
            engine_used = "Future-Adaptive Semantic Layout Engine"

    # 4. Standardize and Deduplicate
    seen_ids = set()
    cleaned_records = []
    for r in records:
        pid = str(r.get('project_id', '')).strip()
        if not pid or pid in seen_ids:
            continue
        seen_ids.add(pid)
        # Ensure all canonical columns exist in exact order
        canonical_row = {}
        for col in CANONICAL_COLUMNS:
            canonical_row[col] = r.get(col, None)
        cleaned_records.append(canonical_row)

    duration = round(time.time() - t0, 2)

    # 5. Metrics calculation
    df_temp = pd.DataFrame(cleaned_records)
    total_projects = len(cleaned_records)
    total_cost = 0.0
    total_exp = 0.0
    avg_progress = 0.0

    if not df_temp.empty:
        if 'Original cost (₹ Cr)' in df_temp.columns:
            total_cost = round(float(pd.to_numeric(df_temp['Original cost (₹ Cr)'], errors='coerce').sum()), 2)
        if 'cumulative expenditure (₹ Cr)' in df_temp.columns:
            total_exp = round(float(pd.to_numeric(df_temp['cumulative expenditure (₹ Cr)'], errors='coerce').sum()), 2)
        if 'physical progress' in df_temp.columns:
            pp_vals = pd.to_numeric(df_temp['physical progress'].astype(str).str.replace('%', ''), errors='coerce').dropna()
            if not pp_vals.empty:
                avg_progress = round(float(pp_vals.mean()), 2)

    return {
        'status': 'success',
        'file_name': os.path.basename(pdf_path),
        'file_path': pdf_path,
        'classification': classification,
        'engine_used': engine_used,
        'records_count': total_projects,
        'execution_time_seconds': duration,
        'summary_metrics': {
            'total_projects': total_projects,
            'total_original_cost_cr': total_cost,
            'total_cumulative_expenditure_cr': total_exp,
            'average_physical_progress_pct': avg_progress,
            'reporting_month': month,
            'reporting_year': year,
            'financial_year': fy
        },
        'records': cleaned_records
    }
