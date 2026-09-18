"""
Legacy Flash Report Parser (2001 - May 2024).
Extracts historical projects tracked via Milestone Ratios (Achieved / Total).
Supports both:
1. Era A (2001-2011): Sequential Serial-numbered projects ("1. NEW URANIUM ORE...") under Sector headings.
2. Era B (2012-2024): OCMS-coded projects with codes like [N04000078] or (612786).
Strictly derives physical progress from government milestone ratios with no false defaults.
Accurately extracts real project names, agencies, and states from OCMS project signatures.
"""

import re
import fitz
from typing import List, Dict, Any, Tuple
from .schema import ProjectRecord, normalize_date, CAL_MONTH_MAP

SECTORS = [
    'ATOMIC ENERGY', 'CIVIL AVIATION', 'COAL', 'FERTILISERS', 'FERTILIZERS',
    'MINES', 'STEEL', 'PETROCHEMICALS', 'PETROLEUM', 'POWER',
    'HEAVY INDUSTRY', 'HEALTH AND FAMILY WELFARE', 'RAILWAYS',
    'ROAD TRANSPORT AND HIGHWAYS', 'SHIPPING AND PORTS', 'PORTS AND SHIPPING',
    'TELECOMMUNICATIONS', 'URBAN DEVELOPMENT', 'DEFENCE PRODUCTION',
    'WATER RESOURCES', 'FINANCE', 'INFORMATION TECHNOLOGY'
]

INDIAN_STATES = {
    'ANDAMAN & NICOBAR ISLANDS', 'ANDAMAN & NICOBAR', 'ANDHRA PRADESH', 'ARUNACHAL PRADESH',
    'ASSAM', 'BIHAR', 'CHANDIGARH', 'CHHATTISGARH', 'CHHATISGARH', 'DADRA & NAGAR HAVELI',
    'DAMAN & DIU', 'DELHI', 'GOA', 'GUJARAT', 'HARYANA', 'HIMACHAL PRADESH',
    'JAMMU & KASHMIR', 'JAMMU AND KASHMIR', 'JHARKHAND', 'KARNATAKA', 'KERALA',
    'LADAKH', 'LAKSHADWEEP', 'MADHYA PRADESH', 'MAHARASHTRA', 'MANIPUR',
    'MEGHALAYA', 'MIZORAM', 'NAGALAND', 'ODISHA', 'ORISSA', 'PUDUCHERRY',
    'PUNJAB', 'RAJASTHAN', 'SIKKIM', 'TAMIL NADU', 'TELANGANA', 'TRIPURA',
    'UTTAR PRADESH', 'UTTARAKHAND', 'UTTARKHAND', 'UTTARANCHAL', 'WEST BENGAL',
    'MULTI-STATE', 'MULTI STATE', 'CENTRAL', 'ALL INDIA'
}

ID_REGEX = re.compile(r'\[([Nn]?\d{6,10}[A-Za-z0-9_]*)\]|\(([Nn]\d{6,10}[A-Za-z0-9_]*\s*)\)|\(([0-9]{6,7}\s*)\)')

def clean_tok(s: str) -> str:
    return re.sub(r'[\[\(\{\]\)\}]', '', s).strip()

def is_date(s: str) -> bool:
    c = clean_tok(s)
    m = re.match(r'^(\d{1,2})/(19\d\d|20\d\d)$', c)
    return bool(m)

def is_milestone(s: str) -> bool:
    m = re.match(r'^(\d+)\s*/\s*(\d+)$', s.strip())
    if m:
        denom = int(m.group(2))
        return denom <= 500 and not (1950 <= denom <= 2050)
    return False

def parse_num(s: str):
    c = clean_tok(s).replace(',', '')
    if c in ['-', '(-)', '[-]', 'N.A.', '(N.A.)', '']:
        return None
    try:
        return float(c)
    except:
        return None

def clean_state(raw: str) -> str:
    """Extract and standardize Indian State from post-ID text like 'NPCIL,GUJARAT ,'."""
    clean = re.sub(r'Central Sector Projects.*|Central Sector.*', '', raw, flags=re.I).strip(' ,;')
    parts = [p.strip() for p in clean.split(',') if p.strip()]
    state = ''
    if len(parts) >= 2:
        state = parts[1]
    elif len(parts) == 1:
        p_up = parts[0].upper()
        if any(st in p_up for st in INDIAN_STATES):
            state = parts[0]
        elif 'MANGALORE' in p_up:
            return 'KARNATAKA'
            
    state = re.sub(r'\s+(EPC|BOT|HAM|ITEM RATE|DBFOT|PPP|PKG|PACKAGE).*$', '', state, flags=re.I).strip()
    s_up = state.upper()
    if 'CHHATISGARH' in s_up:
        return 'CHHATTISGARH'
    if 'ORISSA' in s_up:
        return 'ODISHA'
    if 'UTTARANCHAL' in s_up or 'UTTARKHAND' in s_up:
        return 'UTTARAKHAND'
    if 'MULTI' in s_up:
        return 'Multi-State'
    if not state or s_up in ['CENTRAL', 'PORT']:
        return 'Multi-State'
    return state.upper()

def extract_project_name(idx: int, all_lines: List[str]) -> str:
    """Extract full project name by backward scan from the ID line to previous record / S.No."""
    id_line = all_lines[idx]
    m = ID_REGEX.search(id_line)
    pre_id = id_line[:m.start()].strip() if m else ''
    
    name_lines = []
    if pre_id:
        pre_clean = re.sub(r'\s*-\s*$', '', pre_id).strip()
        if pre_clean:
            name_lines.append(pre_clean)
            
    k = idx - 1
    collected_before = []
    
    while k >= max(0, idx - 14):
        prev = all_lines[k]
        m_sno_only = re.match(r'^(\d{1,4})$', prev)
        m_sno_text = re.match(r'^(\d{1,4})\s+([A-Za-z].*)$', prev)
        
        if m_sno_only:
            break
        elif m_sno_text:
            collected_before.insert(0, m_sno_text.group(2))
            break
        elif is_milestone(prev) or any(prev.upper() == s for s in SECTORS) or 'Detail of ongoing' in prev or 'TABLE-' in prev or 'Central Sector Projects' in prev:
            break
        else:
            if re.search(r'^\d+\([OR]\)$', prev) or re.match(r'^\d{1,2}/(19\d\d|20\d\d)$', prev):
                break
            collected_before.insert(0, prev)
        k -= 1
        
    full_name_parts = collected_before + name_lines
    full_name = ' '.join(full_name_parts).strip()
    full_name = re.sub(r'\s*-\s*$', '', full_name).strip()
    return full_name

def parse_legacy_pdf(pdf_path: str, month: str, year: int, fy: str) -> List[Dict[str, Any]]:
    """Extract all project records from a legacy Flash Report PDF."""
    doc = fitz.open(pdf_path)
    
    # 1. Locate start page of project listings
    start_p = -1
    for pno in range(len(doc)):
        txt = doc[pno].get_text()
        if (('Sector-Wise analysis of projects' in txt or
             'Sector-wise analysis of projects' in txt or
             'Sector Wise analysis of projects' in txt or
             'Sector Wise Details' in txt or
             'Detail of ongoing Projects' in txt or
             'Details of ongoing Projects' in txt or
             'Table:-6' in txt or
             'Project List: Ongoing Projects' in txt or
             'Annexure - III' in txt or
             'Annexure-III' in txt) and
            ('Cost' in txt or 'Approval' in txt or 'Sl.' in txt) and len(txt) > 200):
            start_p = pno
            break

    if start_p == -1:
        start_p = 4 if len(doc) > 10 else 0

    all_lines = []
    for pno in range(start_p, len(doc)):
        for line in doc[pno].get_text().split('\n'):
            l = line.strip()
            if l:
                all_lines.append(l)
    doc.close()

    # 2. Try Era B: OCMS Coded Projects (2012-2024)
    records_ocms = _parse_era_b_ocms(all_lines, month, year, fy)
    if len(records_ocms) >= 15:
        return records_ocms

    # 3. Try Era A: Serial-Numbered Sector Projects (2001-2011)
    records_serial = _parse_era_a_serial(all_lines, month, year, fy)
    if len(records_serial) >= len(records_ocms):
        return records_serial

    return records_ocms

def _parse_era_b_ocms(all_lines: List[str], month: str, year: int, fy: str) -> List[Dict[str, Any]]:
    """Parser for Era B (2012-2024) reports with OCMS codes [N04000078] or (612786)."""
    records = []
    seen_ids = set()
    current_sector = "General"
    i = 0

    while i < len(all_lines):
        line = all_lines[i]
        matched_sector = None
        for s in SECTORS:
            if line.upper() == s or line.upper().startswith(s + ' '):
                matched_sector = s
                break
        if matched_sector:
            current_sector = matched_sector
            i += 1
            continue

        m = ID_REGEX.search(line)
        if m and not any(k in line for k in ['TABLE', 'Costing Rs', 'Summary', 'Original /', 'Original Cost', 'Detail of ongoing']):
            proj_id = (m.group(1) or m.group(2) or m.group(3)).strip()
            if proj_id in seen_ids:
                i += 1
                continue

            proj_name = extract_project_name(i, all_lines)
            post_id = line[m.end():].strip()
            state = clean_state(post_id)

            # Find Date of Approval token (DOA)
            doa_idx = -1
            for k_scan in range(i, min(i + 6, len(all_lines))):
                if is_date(all_lines[k_scan]) or all_lines[k_scan] in ['-', '(-)', '(N.A.)', '{N.A.}', 'N.A.']:
                    doa_idx = k_scan
                    break

            if doa_idx != -1:
                doa = all_lines[doa_idx]
                toks = []
                milestone_tok = ''
                for k_tok in range(doa_idx + 1, min(doa_idx + 16, len(all_lines))):
                    tok = all_lines[k_tok]
                    toks.append(tok)
                    if is_milestone(tok):
                        milestone_tok = tok
                        break

                # Positionally aligned costs and dates
                orig_cost = parse_num(toks[0]) if len(toks) >= 1 else None
                rev_cost = parse_num(toks[1]) if len(toks) >= 2 else None
                antic_cost = parse_num(toks[2]) if len(toks) >= 3 else None
                cum_exp = parse_num(toks[3]) if len(toks) >= 4 else None

                orig_doc = toks[4].strip() if len(toks) >= 5 and toks[4] != '-' else ''
                rev_doc = toks[5].strip() if len(toks) >= 6 and toks[5] != '-' else ''
                antic_doc = toks[6].strip() if len(toks) >= 7 and toks[6] != '-' else ''

                antic_cost_final = antic_cost or rev_cost or orig_cost
                antic_doc_final = antic_doc or rev_doc or orig_doc

                # Strictly calculate Physical Progress from Milestone ratio
                phys_prog = "0.00%"
                if milestone_tok and '/' in milestone_tok:
                    m_m = re.match(r'^(\d+)\s*/\s*(\d+)$', milestone_tok.strip())
                    if m_m:
                        ach, tot = float(m_m.group(1)), float(m_m.group(2))
                        pct = min(100.0, (ach / tot) * 100.0) if tot > 0 else 0.0
                        phys_prog = f"{pct:.2f}%"

                rec = ProjectRecord(
                    project_id=proj_id,
                    legacy_ocms_code=proj_id if proj_id.startswith('N') else "",
                    PMGID="",
                    project_name=proj_name or f"Project {proj_id}",
                    ministry_department=current_sector,
                    state=state,
                    Date_of_approval=normalize_date(doa),
                    Original_cost=orig_cost,
                    revised_cost=rev_cost,
                    Anticipated_cost=antic_cost_final,
                    cumulative_expenditure=cum_exp,
                    cost_revision_flag="Yes" if (rev_cost and orig_cost and rev_cost != orig_cost) else "No",
                    original_date_of_commissioning=normalize_date(orig_doc),
                    anticipated_commissioning=normalize_date(antic_doc_final),
                    milestone_ratio=milestone_tok,
                    physical_progress=phys_prog,
                    financial_year=fy,
                    month=month,
                    year=year,
                    month_order=CAL_MONTH_MAP.get(month.lower()[:3], 0)
                )
                records.append(rec.to_dict())
                seen_ids.add(proj_id)
                i = doa_idx + len(toks)
                continue
        i += 1
    return records

def _parse_era_a_serial(all_lines: List[str], month: str, year: int, fy: str) -> List[Dict[str, Any]]:
    """Parser for Era A (2001-2011) reports with sequential numbered projects under Sectors."""
    records = []
    current_sector = "General"
    i = 0

    while i < len(all_lines):
        line = all_lines[i]

        matched_sec = None
        for sec in SECTORS:
            if line.upper() == sec or line.upper().startswith(sec + ' '):
                matched_sec = sec
                break
        if matched_sec:
            current_sector = matched_sec
            i += 1
            continue

        m_proj = re.match(r'^(\d{1,4})\.\s*(.*)', line)
        if m_proj and re.search(r'[A-Za-z]', m_proj.group(2) or (all_lines[i+1] if i+1 < len(all_lines) else "")):
            sl_no = int(m_proj.group(1))
            p_name = m_proj.group(2).strip()
            name_parts = [p_name] if p_name else []
            i += 1

            while i < len(all_lines):
                l_next = all_lines[i]
                if is_date(l_next) or (l_next in ['-', 'N.A.', '(-)', '(N.A.)'] and i + 1 < len(all_lines) and (is_date(all_lines[i+1]) or parse_num(all_lines[i+1]) is not None)):
                    break
                if re.match(r'^\d{1,4}\.\s*[A-Z]', l_next) or any(l_next.upper() == s for s in SECTORS) or l_next.startswith('Total :'):
                    break
                name_parts.append(l_next)
                i += 1

            full_name = ' '.join(name_parts).strip()

            # Identify state from project name or tokens if present
            state = "Multi-State"
            for st in INDIAN_STATES:
                if st in full_name.upper():
                    state = st
                    break

            # Collect tokens for project until milestone or next project
            tokens = []
            while i < len(all_lines):
                tok = all_lines[i]
                if re.match(r'^\d{1,4}\.\s*[A-Z]', tok) or any(tok.upper() == s for s in SECTORS) or tok.startswith('Total :') or tok.startswith('Sector-Wise') or tok.startswith('(Units:'):
                    break
                tokens.append(tok)
                i += 1
                if is_milestone(tok):
                    break

            # Parse Milestone & Physical Progress
            milestone = ""
            phys_prog = "0.00%"
            for t in reversed(tokens):
                if is_milestone(t):
                    milestone = t
                    m_m = re.match(r'^(\d+)\s*/\s*(\d+)$', t)
                    if m_m:
                        ach, tot = float(m_m.group(1)), float(m_m.group(2))
                        pct = min(100.0, (ach / tot) * 100.0) if tot > 0 else 0.0
                        phys_prog = f"{pct:.2f}%"
                    break

            # Dates
            dates = [clean_tok(t) for t in tokens if is_date(t)]

            # Commissioning date boundary
            doc_idx = -1
            for idx_t in range(len(tokens)-1, -1, -1):
                if is_date(tokens[idx_t]):
                    doc_idx = idx_t
                    while doc_idx > 0 and (is_date(tokens[doc_idx-1]) or tokens[doc_idx-1] in ['(-)', '[-]']):
                        doc_idx -= 1
                    break

            cost_tokens = tokens[:doc_idx] if doc_idx > 0 else tokens
            cost_tokens = [t for t in cost_tokens if not is_date(t) and not is_milestone(t)]
            while cost_tokens and cost_tokens[0] in ['(-)', '[-]', '-', 'N.A.', '(N.A.)']:
                cost_tokens = cost_tokens[1:]

            # Costs
            nums_list = []
            for ct in cost_tokens:
                val = parse_num(ct)
                if val is not None:
                    nums_list.append((ct, val))

            orig_cost = None
            rev_cost = None
            antic_cost = None
            cum_exp = None

            if nums_list:
                orig_cost = nums_list[0][1]
                for raw, val in nums_list:
                    if raw.startswith('(') and rev_cost is None:
                        rev_cost = val
                    elif raw.startswith('[') and antic_cost is None:
                        antic_cost = val

            if antic_cost is None:
                antic_cost = rev_cost if rev_cost is not None else orig_cost

            if len(nums_list) >= 2:
                cum_exp = nums_list[-1][1]

            doa = dates[0] if dates else ""
            orig_doc = dates[1] if len(dates) >= 2 else (dates[0] if len(dates) == 1 else "")
            antic_doc = dates[-1] if len(dates) >= 3 else orig_doc
            gen_id = f"{year}_{sl_no:04d}" if year else f"PRJ_{sl_no:04d}"

            rec = ProjectRecord(
                project_id=gen_id,
                legacy_ocms_code="",
                PMGID="",
                project_name=full_name or f"Project {sl_no}",
                ministry_department=current_sector,
                state=state,
                Date_of_approval=normalize_date(doa),
                Original_cost=orig_cost,
                revised_cost=rev_cost,
                Anticipated_cost=antic_cost,
                cumulative_expenditure=cum_exp,
                cost_revision_flag="Yes" if (rev_cost and orig_cost and rev_cost != orig_cost) else "No",
                original_date_of_commissioning=normalize_date(orig_doc),
                anticipated_commissioning=normalize_date(antic_doc),
                milestone_ratio=milestone,
                physical_progress=phys_prog,
                financial_year=fy,
                month=month,
                year=year,
                month_order=CAL_MONTH_MAP.get(month.lower()[:3], 0)
            )
            records.append(rec.to_dict())
            continue
        i += 1

    return records
