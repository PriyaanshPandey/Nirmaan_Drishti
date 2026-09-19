"""
Format Classifier for MoSPI Flash Report PDFs.
Detects whether a PDF report belongs to:
1. PAIMANA Portal format (July 2025 – 2027+)
2. Modern Flash Report format (June 2024 – June 2025)
3. Legacy Milestone format (2001 – May 2024)
4. Unknown / Future format (triggers Adaptive Layout Engine)
"""

import os
import re
import fitz
from typing import Dict, Any, Tuple

MONTH_NAMES = {
    'jan': 'January', 'feb': 'February', 'mar': 'March', 'apr': 'April',
    'may': 'May', 'jun': 'June', 'jul': 'July', 'aug': 'August',
    'sep': 'September', 'oct': 'October', 'nov': 'November', 'dec': 'December'
}

def extract_month_and_year_from_filename(filename: str) -> Tuple[str, int, str]:
    """Extract month name, calendar year, and fiscal year from filename."""
    fname = os.path.basename(filename).lower()
    month = None
    for k, v in MONTH_NAMES.items():
        if k in fname:
            month = v
            break
            
    m_yr = re.search(r'20\d{2}', fname)
    year = int(m_yr.group(0)) if m_yr else None
    
    # Financial year calculation
    fy = ""
    if year and month:
        m_idx = list(MONTH_NAMES.values()).index(month) + 1
        if m_idx >= 4: # April or later
            fy = f"{year}-{year+1}"
        else: # Jan - Mar
            fy = f"{year-1}-{year}"
            
    return month or "Unknown", year or 0, fy

def classify_pdf_report(pdf_path: str) -> Dict[str, Any]:
    """
    Analyzes document text, metadata, and headings to classify the report type.
    """
    doc = fitz.open(pdf_path)
    total_pages = len(doc)
    
    # Read first 5 pages and sample of middle pages
    first_pages_text = ""
    for p in range(min(5, total_pages)):
        first_pages_text += doc[p].get_text() + "\n"
        
    middle_pages_text = ""
    sample_indices = [total_pages // 4, total_pages // 2, (3 * total_pages) // 4]
    for p in sample_indices:
        if 0 <= p < total_pages:
            middle_pages_text += doc[p].get_text() + "\n"
            
    doc.close()
    
    combined_text = first_pages_text + "\n" + middle_pages_text
    
    # Month, Year, FY
    month, year, fy = extract_month_and_year_from_filename(pdf_path)
    
    # 1. PAIMANA Detection
    is_paimana = (
        'PAIMANA' in combined_text or 
        'paimana-proj.mospi.gov.in' in combined_text or
        'Project Assessment, Infrastructure Monitoring and Analytics' in combined_text or
        ('Table 6: All Ongoing Projects' in combined_text and 'Legacy OCMS Code' in combined_text)
    )
    if is_paimana:
        return {
            'format_type': 'PAIMANA',
            'version_era': '2025–2027+ Portal Era',
            'month': month,
            'year': year,
            'financial_year': fy,
            'total_pages': total_pages,
            'has_physical_progress': True,
            'has_milestones': False,
            'primary_identifier': '6-digit Project Code (e.g. 612786)'
        }
        
    # 2. Modern Flash Report Detection (June 2024 - June 2025)
    has_modern_table = (
        ('Table:-7' in combined_text or 'Table:-6' in combined_text or 'Table 6' in combined_text or 'Table 7' in combined_text) and
        ('Ongoing Projects as of' in combined_text or 'Ongoing Projects of North-East' in combined_text)
    )
    has_pp_header = bool(re.search(r'Physical\s+Progress\s*\(?%?\)?', combined_text, re.IGNORECASE))
    
    if has_modern_table and has_pp_header:
        return {
            'format_type': 'MODERN_FLASH',
            'version_era': 'June 2024 – June 2025 MoSPI Format',
            'month': month,
            'year': year,
            'financial_year': fy,
            'total_pages': total_pages,
            'has_physical_progress': True,
            'has_milestones': False,
            'primary_identifier': 'Legacy / Mixed Code'
        }
        
    # 3. Legacy Milestone Detection (2001 - May 2024)
    has_legacy_headers = (
        'Sector-Wise analysis of projects' in combined_text or
        'Sector-wise analysis of projects' in combined_text or
        'Sector Wise analysis of projects' in combined_text or
        'Sector-Wise' in combined_text or
        'Sector Wise' in combined_text or
        'Sector Wise Details' in combined_text or
        'Detail of ongoing Projects' in combined_text or
        'Details of ongoing Projects' in combined_text or
        'Annexure - III' in combined_text or
        'Annexure-III' in combined_text or
        'Central Sector Projects' in combined_text or
        'Milestones' in combined_text
    )
    has_milestone_pattern = bool(re.search(r'\b\d{1,3}\s*/\s*\d{1,3}\b', combined_text))
    is_legacy_year = bool(year and 2000 <= year <= 2024)
    
    if has_legacy_headers or has_milestone_pattern or (is_legacy_year and not has_modern_table):
        return {
            'format_type': 'LEGACY_MILESTONE',
            'version_era': '2001 – May 2024 Historical Format',
            'month': month,
            'year': year,
            'financial_year': fy,
            'total_pages': total_pages,
            'has_physical_progress': False,
            'has_milestones': True,
            'primary_identifier': 'Legacy ID / Serial Project Name'
        }
        
    # 4. Unknown / Future layout (Triggers Adaptive Parser)
    return {
        'format_type': 'FUTURE_ADAPTIVE',
        'version_era': 'Future / Unknown Layout Variant',
        'month': month,
        'year': year,
        'financial_year': fy,
        'total_pages': total_pages,
        'has_physical_progress': has_pp_header,
        'has_milestones': has_milestone_pattern,
        'primary_identifier': 'Dynamic Semantic Resolution'
    }
