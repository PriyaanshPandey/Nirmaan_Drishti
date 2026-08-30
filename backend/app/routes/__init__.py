"""
Routes package initialization.
"""
from app.routes.health import router as health_router
from app.routes.projects import router as projects_router
from app.routes.dashboard import router as dashboard_router
from app.routes.risk import router as risk_router
from app.routes.alerts import router as alerts_router
from app.routes.benchmark import router as benchmark_router
from app.routes.assistant import router as assistant_router

__all__ = [
    "health_router",
    "projects_router",
    "dashboard_router",
    "risk_router",
    "alerts_router",
    "benchmark_router",
    "assistant_router",
]
