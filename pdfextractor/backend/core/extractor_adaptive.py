"""
Future-Proof Adaptive Semantic PDF Extractor.
Uses semantic entity recognition (dates, currencies, codes, percentages, states, agencies)
to dynamically reconstruct the canonical 20-column schema even if report layout, table headers,
or column orders change in future MoSPI reports.
"""

import re
import fitz
from typing import List, Dict, Any, Tuple
from .schema import ProjectRecord, normalize_date, CAL_MONTH_MAP, clean_key

INDIAN_STATES = [
    'ANDHRA PRADESH', 'ARUNACHAL PRADESH', 'ASSAM', 'BIHAR', 'CHHATTISGARH',
    'GOA', 'GUJARAT', 'HARYANA', 'HIMACHAL PRADESH', 'JHARKHAND', 'KARNATAKA',
    'KERALA', 'MADHYA PRADESH', 'MAHARASHTRA', 'MANIPUR', 'MEGHALAYA', 'MIZORAM',
    'NAGALAND', 'ODISHA', 'PUNJAB', 'RAJASTHAN', 'SIKKIM', 'TAMIL NADU', 'TELANGANA',
    'TRIPURA', 'UTTAR PRADESH', 'UTTARAKHAND', 'WEST BENGAL', 'DELHI', 'JAMMU & KASHMIR',
    'JAMMU AND KASHMIR', 'LADAKH', 'PUDUCHERRY', 'CHANDIGARH', 'MULTI-STATES', 'MULTISTATE'
]

MINISTRIES = [
    'CIVIL AVIATION', 'COAL', 'POWER', 'PETROLEUM', 'RAILWAYS', 'ROAD TRANSPORT',
    'SHIPPING', 'PORTS', 'TELECOMMUNICATIONS', 'STEEL', 'MINES', 'FERTILISERS',
    'ATOMIC ENERGY', 'URBAN DEVELOPMENT', 'HOUSING AND URBAN AFFAIRS', 'HEALTH',
    'WATER RESOURCES', 'HEAVY INDUSTRY', 'DEFENCE PRODUCTION', 'FINANCE'
]

def extract_dates_from_block(tokens: List[str]) -> List[str]:
    """Extract and normalize all dates from tokens."""
    dates = []
    for t in tokens:
        m = re.search(r'\b(\d{1,2})[/-](\d{4})\b', t)
        if m:
            dates.append(f"{int(m.group(1)):02d}/{m.group(2)}")
    return dates

def extract_nums_from_block(tokens: List[str]) -> List[float]:
    """Extract all currency / float quantities from tokens, ignoring dates."""
    nums = []
    for t in tokens:
        if re.search(r'\b\d{1,2}/\d{4}\b', t):
            continue
        m = re.search(r'^\(?([\d,]+(?:\.\d+)?)\)?$', t.strip())
        if m:
            try:
                nums.append(float(m.group(1).replace(',', '')))
            except:
                pass
    return nums

def extract_state_from_block(tokens: List[str]) -> str:
    """Identify Indian state or multi-state string from tokens."""
    for t in tokens:
        t_clean = t.upper().replace('(', '').replace(')', '').strip()
        for st in INDIAN_STATES:
            if st in t_clean:
                return t_clean
    return ""

def extract_ministry_from_block(tokens: List[str]) -> str:
    """Identify Ministry or Sector from tokens."""
    for t in tokens:
        t_upper = t.upper()
        for m in MINISTRIES:
            if m in t_upper:
                return t.strip()
    return ""

def parse_adaptive_pdf(pdf_path: str, month: str, year: int, fy: str) -> List[Dict[str, Any]]:
    """
    Adaptive heuristic extractor that segments project blocks using anchor tokens
    and classifies fields semantically to construct the standard 20-column schema.
    """
    doc = fitz.open(pdf_path)
    records = []
    
    for pno in range(len(doc)):
        txt = doc[pno].get_text()
        if len(txt) < 100:
            continue
            
        lines = [l.strip() for l in txt.splitlines() if l.strip()]
        
        # Segment page into project chunks by locating anchor tokens
        # Anchors: 6-digit codes in parentheses, e.g. (612786) or Sl.No markers
        anchor_indices = []
        for idx, line in enumerate(lines):
            if re.match(r'^\(\d{6}\)$', line) or re.match(r'^\[[A-Za-z0-9_]{6,12}\]$', line):
                anchor_indices.append(idx)
                
        # If no standard parenthesized code found, look for Sl.No patterns
        if not anchor_indices:
            for idx, line in enumerate(lines):
                if re.match(r'^\d{1,4}$', line) and idx + 1 < len(lines):
                    if not re.match(r'^\d', lines[idx+1]) and not re.match(r'^\d{1,2}/\d{4}$', lines[idx+1]):
                        anchor_indices.append(idx)
                        
        if not anchor_indices:
            continue
            
        for a_idx, curr_anchor in enumerate(anchor_indices):
            next_anchor = anchor_indices[a_idx + 1] if a_idx + 1 < len(anchor_indices) else min(curr_anchor + 35, len(lines))
            chunk = lines[max(0, curr_anchor - 5) : next_anchor]
            
            # Extract primary identifier
            pid = ""
            legacy_id = ""
            pmgid = ""
            
            for line in chunk:
                m_6 = re.search(r'\b(\d{6})\b', line)
                if m_6 and not pid:
                    pid = m_6.group(1)
                m_leg = re.search(r'\b([Nn]\d{6,10}[A-Za-z0-9_]*)\b', line)
                if m_leg and not legacy_id:
                    legacy_id = m_leg.group(1)
                m_pmg = re.search(r'\((\d{3,5})\)', line)
                if m_pmg and not pmgid:
                    pmgid = m_pmg.group(1)
                    
            if not pid and legacy_id:
                pid = legacy_id
            if not pid:
                continue
                
            # Extract project name (longest meaningful text string in chunk)
            candidate_names = []
            for line in chunk:
                if (len(line) > 15 and 
                    not line.startswith('(') and 
                    not any(s in line.upper() for s in ['MINISTRY', 'TABLE', 'PAGE', 'TOTAL']) and
                    not re.search(r'^\d', line)):
                    candidate_names.append(line)
            proj_name = ' '.join(candidate_names[:2]).strip()
            
            # Extract dates
            dates = extract_dates_from_block(chunk)
            doa = dates[0] if dates else ""
            orig_doc = dates[1] if len(dates) >= 2 else ""
            rev_doc = dates[-1] if len(dates) >= 3 else orig_doc
            
            # Extract numbers
            nums = extract_nums_from_block(chunk)
            
            # Pop trailing next sl_no if needed
            while nums and nums[-1] > 100.0 and len(nums) >= 5:
                nums.pop()
                
            orig_cost = None
            rev_cost = None
            cum_exp = None
            phys_prog = "0.00%"
            
            # Identify physical progress: number between 0.0 and 100.0 at the end of metrics
            if nums:
                if 0.0 <= nums[-1] <= 100.0 and len(nums) >= 2:
                    phys_prog = f"{nums[-1]:.2f}%"
                    cum_exp = nums[-2]
                    if len(nums) >= 4:
                        orig_cost = nums[0]
                        rev_cost = nums[1]
                    elif len(nums) == 3:
                        orig_cost = rev_cost = nums[0]
                elif len(nums) >= 3:
                    orig_cost = nums[0]
                    rev_cost = nums[1]
                    cum_exp = nums[2]
                    
            state = extract_state_from_block(chunk)
            ministry = extract_ministry_from_block(chunk)
            
            rec = ProjectRecord(
                project_id=pid,
                legacy_ocms_code=legacy_id,
                PMGID=pmgid,
                project_name=proj_name,
                ministry_department=ministry,
                state=state,
                Date_of_approval=normalize_date(doa),
                Original_cost=orig_cost,
                revised_cost=rev_cost,
                Anticipated_cost=rev_cost or orig_cost,
                cumulative_expenditure=cum_exp,
                cost_revision_flag="Yes" if (orig_cost and rev_cost and abs(rev_cost - orig_cost) > 0.01) else "No",
                original_date_of_commissioning=normalize_date(orig_doc),
                anticipated_commissioning=normalize_date(rev_doc),
                milestone_ratio="",
                physical_progress=phys_prog,
                financial_year=fy,
                month=month,
                year=year,
                month_order=CAL_MONTH_MAP.get(month.capitalize(), None)
            )
            records.append(rec.to_dict())
            
    doc.close()
    return records
