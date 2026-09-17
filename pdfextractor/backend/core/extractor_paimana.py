"""
PAIMANA Table 6 Parser (July 2025 – 2027+).
Extracts all ongoing projects from the PAIMANA web-generated portal layout.
Features bulletproof Sl. No. boundary isolation to prevent serial number bleeding.
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
    'WATER RESOURCES', 'FINANCE', 'INFORMATION TECHNOLOGY', 'HOUSING AND URBAN AFFAIRS',
    'NEW AND RENEWABLE ENERGY', 'CHEMICALS AND PETROCHEMICALS'
]

def parse_paimana_pdf(pdf_path: str, month: str, year: int, fy: str) -> List[Dict[str, Any]]:
    """Parse PAIMANA Flash Report PDF into standardized ProjectRecord dictionaries."""
    doc = fitz.open(pdf_path)
    records = []
    
    current_ministry = ""
    
    for pno in range(len(doc)):
        txt = doc[pno].get_text()
        if 'All Ongoing Projects' not in txt:
            continue
            
        lines = [l.strip() for l in txt.splitlines() if l.strip()]
        i = 0
        while i < len(lines):
            line = lines[i]
            
            # Detect Ministry heading
            if (line.startswith('Ministry of ') or line.startswith('Department of ') or
                line in ['Atomic Energy', 'Telecommunications', 'Railways',
                         'Road Transport and Highways', 'Petroleum and Natural Gas',
                         'Power', 'Coal', 'Mines', 'Steel', 'Civil Aviation',
                         'Ports, Shipping and Waterways', 'Housing and Urban Affairs',
                         'Health and Family Welfare', 'Heavy Industries',
                         'Chemicals and Petrochemicals', 'Fertilizers',
                         'New and Renewable Energy',
                         'Water Resources, River Development and Ganga Rejuvenation']):
                current_ministry = line
                i += 1
                continue
                
            m_code = re.match(r'^\((\d{6})\)$', line)
            if m_code:
                code_6 = m_code.group(1)
                
                # Look backwards for Sl No and Project Name
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
                        'Ministry' not in lines[k] and 
                        'All Ongoing' not in lines[k] and 
                        'Sector' not in lines[k] and
                        lines[k] not in SECTORS):
                        name_parts.insert(0, lines[k])
                    k -= 1
                proj_name = ' '.join(name_parts).strip()
                
                # Check next line for legacy code and PMGID: e.g. (N04000106) (4353) or (-) (-)
                legacy_code = ""
                pmgid = ""
                j = i + 1
                if j < len(lines):
                    m_leg_pmg = re.search(r'\((?:([A-Za-z0-9_]+)|-)\)\s*\((?:([A-Za-z0-9_]+)|-)\)', lines[j])
                    if m_leg_pmg:
                        legacy_code = m_leg_pmg.group(1) or ""
                        pmgid = m_leg_pmg.group(2) or ""
                        j += 1
                    else:
                        m_single = re.search(r'\(([A-Za-z0-9_]+)\)', lines[j])
                        if m_single and not re.match(r'^\(\d{6}\)$', lines[j]):
                            val = m_single.group(1)
                            if val.startswith('N') or len(val) >= 7:
                                legacy_code = val
                            elif val.isdigit():
                                pmgid = val
                            j += 1
                            
                # State identification: next line usually state
                state = ""
                if j < len(lines) and not re.match(r'^\(?\d{1,2}/\d{4}\)?$', lines[j]) and not re.match(r'^\(?[\d,.]+\)?$', lines[j]):
                    state = lines[j].strip('()')
                    j += 1
                    
                # Collect remaining tokens up to boundary
                tokens = []
                while j < min(len(lines), i + 30):
                    m_next = re.match(r'^(\d{1,4})\b', lines[j])
                    if sl_no is not None and m_next and int(m_next.group(1)) == sl_no + 1:
                        break
                    if (re.match(r'^\(\d{6}\)$', lines[j]) or 
                        lines[j].startswith('Total') or 
                        lines[j].startswith('Ministry') or 
                        lines[j].startswith('Department') or
                        lines[j].startswith('Table')):
                        break
                    tokens.append(lines[j])
                    j += 1
                    
                # Parse dates and numbers
                dates = []
                nums = []
                for t in tokens:
                    m_dt = re.match(r'^\(?(\d{1,2}/\d{4})\)?$', t)
                    if m_dt:
                        dates.append(m_dt.group(1))
                        continue
                    m_num = re.match(r'^\(?([\d,]+(?:\.\d+)?)\)?$', t)
                    if m_num and not re.match(r'^\d{1,2}/\d{4}$', t):
                        try:
                            nums.append(float(m_num.group(1).replace(',', '')))
                        except:
                            pass
                            
                # Boundary isolation: pop any trailing number matching next sl_no or > 100
                while nums and (nums[-1] > 100.0 or (sl_no is not None and int(nums[-1]) == sl_no + 1)):
                    nums.pop()
                    
                # In PAIMANA:
                # Dates: Approval, (Start Date), Original DoC, (Revised DoC)
                doa = dates[0] if dates else ""
                orig_doc = dates[2] if len(dates) >= 3 else (dates[1] if len(dates) >= 2 else "")
                rev_doc = dates[3] if len(dates) >= 4 else (dates[-1] if len(dates) >= 2 and dates[-1] != orig_doc else "")
                
                # Numbers: Original Cost, Revised Cost, Cumulative Expenditure, Physical Progress
                orig_cost = None
                rev_cost = None
                cum_exp = None
                phys_prog = "0.00%"
                
                if len(nums) >= 4:
                    orig_cost = nums[0]
                    rev_cost = nums[1]
                    cum_exp = nums[-2]
                    phys_prog = f"{nums[-1]:.2f}%"
                elif len(nums) == 3:
                    orig_cost = nums[0]
                    rev_cost = nums[0]
                    cum_exp = nums[1]
                    phys_prog = f"{nums[2]:.2f}%"
                elif len(nums) == 2:
                    cum_exp = nums[0]
                    phys_prog = f"{nums[1]:.2f}%"
                elif len(nums) == 1:
                    phys_prog = f"{nums[0]:.2f}%" if 0.0 <= nums[0] <= 100.0 else "0.00%"
                    
                rec = ProjectRecord(
                    project_id=code_6,
                    legacy_ocms_code=legacy_code,
                    PMGID=pmgid,
                    project_name=proj_name,
                    ministry_department=current_ministry,
                    state=state,
                    Date_of_approval=normalize_date(doa),
                    Original_cost=orig_cost,
                    revised_cost=rev_cost,
                    Anticipated_cost=rev_cost,
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
                i = j - 1
            i += 1
            
    doc.close()
    return records
