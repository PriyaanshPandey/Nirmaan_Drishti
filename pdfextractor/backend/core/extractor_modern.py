"""
Modern Flash Report Table 6/7 Parser (June 2024 – June 2025).
Extracts all ongoing projects where Physical Progress (%) is explicitly published.
Handles multi-part PDFs (Part-I Synopsis and Part-II Tables).
"""

import re
import fitz
from typing import List, Dict, Any
from .schema import ProjectRecord, normalize_date, CAL_MONTH_MAP

SECTORS = [
    'ATOMIC ENERGY', 'CIVIL AVIATION', 'COAL', 'FERTILISERS', 'FERTILIZERS',
    'MINES', 'STEEL', 'PETROCHEMICALS', 'PETROLEUM', 'POWER',
    'HEAVY INDUSTRY', 'HEALTH AND FAMILY WELFARE', 'RAILWAYS',
    'ROAD TRANSPORT AND HIGHWAYS', 'SHIPPING AND PORTS', 'PORTS AND SHIPPING',
    'TELECOMMUNICATIONS', 'URBAN DEVELOPMENT', 'DEFENCE PRODUCTION',
    'WATER RESOURCES', 'FINANCE', 'INFORMATION TECHNOLOGY', 'HOUSING AND URBAN AFFAIRS'
]

def parse_modern_flash_pdf(pdf_path: str, month: str, year: int, fy: str) -> List[Dict[str, Any]]:
    """Parse Modern 2024-2025 Flash Report PDF into standardized ProjectRecord dictionaries."""
    doc = fitz.open(pdf_path)
    records = []
    
    current_sector = ""
    
    for pno in range(len(doc)):
        txt = doc[pno].get_text()
        if ('All Ongoing Projects' not in txt and 
            'Ongoing Projects as of' not in txt and 
            'Ongoing Projects of North-East' not in txt and
            'Table:-7' not in txt and 'Table:-6' not in txt):
            continue
            
        lines = [l.strip() for l in txt.splitlines() if l.strip()]
        i = 0
        while i < len(lines):
            line = lines[i]
            
            # Match sector
            matched_sec = None
            for s in SECTORS:
                if line.upper() == s or line.upper().startswith(s + ' '):
                    matched_sec = s
                    break
            if matched_sec:
                current_sector = matched_sec
                i += 1
                continue
                
            # Match project code (legacy like N04000100 or 6-digit)
            m_found = re.search(r'\[([Nn]?\d{6,10}[A-Za-z0-9_]*)\]|\(([Nn]\d{6,10}[A-Za-z0-9_]*\s*)\)|\(([0-9]{6,7}\s*)\)', line)
            
            if m_found and not any(k in line for k in ['TABLE', 'Costing Rs', 'Summary', 'Original Cost', 'Original /']):
                raw_id = (m_found.group(1) or m_found.group(2) or m_found.group(3)).strip()
                
                # Look backwards for Sl No and Name
                sl_no = None
                k = i - 1
                name_parts = []
                while k >= max(0, i - 12):
                    m_sl = re.match(r'^(\d{1,4})(?:\s+(.*))?$', lines[k])
                    if m_sl:
                        sl_no = int(m_sl.group(1))
                        if m_sl.group(2):
                            name_parts.insert(0, m_sl.group(2))
                        break
                    if (not lines[k].startswith('(') and 
                        'Sector' not in lines[k] and 
                        'Table' not in lines[k] and 
                        'MOSPI' not in lines[k] and
                        lines[k] not in SECTORS):
                        name_parts.insert(0, lines[k])
                    k -= 1
                proj_name = ' '.join(name_parts).strip()
                
                # Look forward for tokens
                j = i + 1
                tokens = []
                while j < min(len(lines), i + 30):
                    m_next = re.match(r'^(\d{1,4})\b', lines[j])
                    if sl_no is not None and m_next and int(m_next.group(1)) == sl_no + 1:
                        break
                    if (re.search(r'\[[Nn]?\d{6,10}\]|\([Nn]\d{6,10}\)', lines[j]) or
                        lines[j].startswith('Total') or 
                        lines[j].startswith('Table') or
                        lines[j] in SECTORS):
                        break
                    tokens.append(lines[j])
                    j += 1
                    
                dates = []
                nums = []
                state = ""
                for t in tokens:
                    m_dt = re.match(r'^[\[\(\{]?(\d{1,2}[/-]\d{4})[\]\)\}]?$', t)
                    if m_dt:
                        dates.append(m_dt.group(1).replace('-', '/'))
                        continue
                    m_cost = re.match(r'^[\[\(\{]?([\d,]+(?:\.\d+)?)[\]\)\}]?$', t)
                    if m_cost and '/' not in t:
                        try:
                            nums.append(float(m_cost.group(1).replace(',', '')))
                        except:
                            pass
                        continue
                    if re.match(r'^[A-Z\s]{4,30}$', t) and t not in SECTORS and not any(c.isdigit() for c in t):
                        state = t.strip()
                        
                while nums and (nums[-1] > 100.0 or (sl_no is not None and int(nums[-1]) == sl_no + 1)):
                    nums.pop()
                    
                # Dates: Approval, Original DoC, Revised DoC, Anticipated DoC
                doa = dates[0] if dates else ""
                orig_doc = dates[1] if len(dates) >= 2 else ""
                antic_doc = dates[-1] if len(dates) >= 3 else (dates[2] if len(dates) >= 3 else "")
                
                orig_cost = None
                rev_cost = None
                antic_cost = None
                cum_exp = None
                phys_prog = "0.00%"
                
                if len(nums) >= 5:
                    orig_cost = nums[0]
                    rev_cost = nums[1]
                    antic_cost = nums[2]
                    cum_exp = nums[-2]
                    phys_prog = f"{nums[-1]:.2f}%"
                elif len(nums) == 4:
                    orig_cost = nums[0]
                    rev_cost = nums[1]
                    cum_exp = nums[2]
                    phys_prog = f"{nums[3]:.2f}%"
                elif len(nums) == 3:
                    orig_cost = nums[0]
                    cum_exp = nums[1]
                    phys_prog = f"{nums[2]:.2f}%"
                elif len(nums) == 2:
                    cum_exp = nums[0]
                    phys_prog = f"{nums[1]:.2f}%"
                    
                # Determine project_id vs legacy_ocms_code
                pid = raw_id
                legacy_id = raw_id if raw_id.upper().startswith('N') else ""
                
                rec = ProjectRecord(
                    project_id=pid,
                    legacy_ocms_code=legacy_id,
                    PMGID="",
                    project_name=proj_name,
                    ministry_department=current_sector,
                    state=state,
                    Date_of_approval=normalize_date(doa),
                    Original_cost=orig_cost,
                    revised_cost=rev_cost,
                    Anticipated_cost=antic_cost or rev_cost or orig_cost,
                    cumulative_expenditure=cum_exp,
                    cost_revision_flag="Yes" if (orig_cost and rev_cost and abs(rev_cost - orig_cost) > 0.01) else "No",
                    original_date_of_commissioning=normalize_date(orig_doc),
                    anticipated_commissioning=normalize_date(antic_doc),
                    milestone_ratio="",
                    physical_progress=phys_prog,
                    financial_year=fy,
                    month=month,
                    year=year,
                    month_order=CAL_MONTH_MAP.get(month.capitalize(), None)
                )
                records.append(rec.to_dict())
                i = j - 1
            i += 1
            
    doc.close()
    return records
