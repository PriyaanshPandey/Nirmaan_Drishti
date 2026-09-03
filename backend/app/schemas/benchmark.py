"""
Benchmarking Pydantic Schemas.
"""
from typing import List, Dict, Any, Optional
from pydantic import BaseModel


class BenchmarkRow(BaseModel):
    label: str
    projectVal: str
    avg: str
    benchmark: str
    isAlert: bool = False


class ProjectBenchmarkResponse(BaseModel):
    project_id: str
    project_name: str
    sector_name: str
    cost_benchmark: List[BenchmarkRow]
    delay_benchmark: List[BenchmarkRow]
    tech_benchmark: List[BenchmarkRow]
    recommendation: str
