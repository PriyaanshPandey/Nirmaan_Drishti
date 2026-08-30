"""
Common Pydantic Schemas.
"""
from typing import Generic, TypeVar, List, Optional
from pydantic import BaseModel

T = TypeVar("T")


class PaginatedResponse(BaseModel, Generic[T]):
    items: List[T]
    total: int
    page: int
    page_size: int
    total_pages: int


class MessageResponse(BaseModel):
    message: str
    status: str = "success"


class HealthResponse(BaseModel):
    status: str
    database: str
    version: str
    timestamp: str
