"""
Standardized Schema & Data Models for MoSPI Project Data Extractor.
Defines the universal 20-column schema matching the master dataset format.
"""

from typing import Optional, Dict, Any, List
from pydantic import BaseModel, Field
import re
import pandas as pd

# The exact 20-column canonical master schema in exact order
CANONICAL_COLUMNS: List[str] = [
    'project_id',
    'legacy_ocms_code',
    'PMGID',
    'project_name',
    'ministry_department',
    'state',
    'Date of approval',
    'Original cost (₹ Cr)',
    'revised cost (₹ Cr)',
    'Anticipated cost (₹ Cr)',
    'cumulative expenditure (₹ Cr)',
    'cost_revision_flag',
    'original date of commissioning',
    'anticipated commissioning',
    'ministry_department/milestone',
    'physical progress',
    'financial_year',
    'month',
    'year',
    'month_order'
]

CAL_MONTH_MAP = {
    'January': 1, 'February': 2, 'March': 3, 'April': 4,
    'May': 5, 'June': 6, 'July': 7, 'August': 8,
    'September': 9, 'October': 10, 'November': 11, 'December': 12
}

class ProjectRecord(BaseModel):
    project_id: str = ""
    legacy_ocms_code: str = ""
    PMGID: str = ""
    project_name: str = ""
    ministry_department: str = ""
    state: str = ""
    Date_of_approval: str = Field(default="", alias="Date of approval")
    Original_cost: Optional[float] = Field(default=None, alias="Original cost (₹ Cr)")
    revised_cost: Optional[float] = Field(default=None, alias="revised cost (₹ Cr)")
    Anticipated_cost: Optional[float] = Field(default=None, alias="Anticipated cost (₹ Cr)")
    cumulative_expenditure: Optional[float] = Field(default=None, alias="cumulative expenditure (₹ Cr)")
    cost_revision_flag: str = "No"
    original_date_of_commissioning: str = ""
    anticipated_commissioning: str = ""
    milestone_ratio: str = Field(default="", alias="ministry_department/milestone")
    physical_progress: str = Field(default="0.00%", alias="physical progress")
    financial_year: str = ""
    month: str = ""
    year: Optional[int] = None
    month_order: Optional[int] = None

    class Config:
        populate_by_name = True

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary with exact canonical column keys."""
        # Calculate cost revision flag
        cost_flag = "No"
        try:
            if self.Original_cost and self.revised_cost and abs(self.revised_cost - self.Original_cost) > 0.01:
                cost_flag = "Yes"
        except:
            pass

        # Calculate month order
        m_order = self.month_order
        if not m_order and self.month:
            m_order = CAL_MONTH_MAP.get(self.month.capitalize(), None)

        return {
            'project_id': str(self.project_id or '').strip(),
            'legacy_ocms_code': str(self.legacy_ocms_code or '').strip(),
            'PMGID': str(self.PMGID or '').strip(),
            'project_name': str(self.project_name or '').strip(),
            'ministry_department': str(self.ministry_department or '').strip(),
            'state': str(self.state or '').strip(),
            'Date of approval': str(self.Date_of_approval or '').strip(),
            'Original cost (₹ Cr)': round(float(self.Original_cost), 2) if self.Original_cost is not None else None,
            'revised cost (₹ Cr)': round(float(self.revised_cost), 2) if self.revised_cost is not None else None,
            'Anticipated cost (₹ Cr)': round(float(self.Anticipated_cost), 2) if self.Anticipated_cost is not None else None,
            'cumulative expenditure (₹ Cr)': round(float(self.cumulative_expenditure), 2) if self.cumulative_expenditure is not None else None,
            'cost_revision_flag': cost_flag,
            'original date of commissioning': str(self.original_date_of_commissioning or '').strip(),
            'anticipated commissioning': str(self.anticipated_commissioning or '').strip(),
            'ministry_department/milestone': str(self.milestone_ratio or '').strip(),
            'physical progress': str(self.physical_progress or '0.00%').strip(),
            'financial_year': str(self.financial_year or '').strip(),
            'month': str(self.month or '').capitalize().strip(),
            'year': int(self.year) if self.year else None,
            'month_order': int(m_order) if m_order else None
        }

def clean_key(s: Any) -> str:
    """Standardized alphanumeric uppercase key for matching projects."""
    if not s: return ''
    s = str(s).upper()
    s = re.sub(r'\[[^\]]*\]|\([^\)]*\)|[^A-Z0-9]', '', s)
    return s.strip()

def normalize_date(s: Any) -> str:
    """Normalize dates to MM/YYYY format."""
    if not s or pd.isna(s): return ''
    val = str(s).strip()
    if val in ['-', '(-)', 'N.A.', 'NA', 'None', 'nan', '']:
        return ''
    m = re.search(r'(\d{1,2})[/-](\d{4})', val)
    if m:
        return f"{int(m.group(1)):02d}/{m.group(2)}"
    m_yr = re.search(r'([A-Za-z]{3})[-/](\d{2,4})', val)
    if m_yr:
        return val
    return val
