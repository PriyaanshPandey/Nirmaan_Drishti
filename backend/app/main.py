"""
Sanket-AI FastAPI Main Application Entrypoint.
National Infrastructure Early Warning & Predictive Monitoring API.
"""
import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.config import settings
from app.database import check_db_connection
from app.routes.health import router as health_router
from app.routes.auth import router as auth_router
from app.routes.projects import router as projects_router
from app.routes.dashboard import router as dashboard_router
from app.routes.risk import router as risk_router
from app.routes.alerts import router as alerts_router, action_centre_router
from app.routes.benchmark import router as benchmark_router
from app.routes.assistant import router as assistant_router
from app.routes.insights import router as insights_router
from app.routes.distribution import router as distribution_router
from app.ml_integration.risk_client import get_ml_client
from app.auth.dependencies import get_current_user

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)
logger = logging.getLogger("sanket_ai")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Application startup and shutdown event management.
    """
    logger.info("Initializing Sanket-AI Backend Service...")
    # Verify Database Connection & Auto-Create Tables / Seed Users
    if check_db_connection():
        logger.info("PostgreSQL Database connected successfully (national_infrastructure).")
        try:
            from app.database import engine, Base
            import app.models  # noqa: F401
            Base.metadata.create_all(bind=engine)
            logger.info("Database tables verified/created successfully.")

            from scripts.seed_users import seed_users
            seed_users()
            logger.info("Default auth users (vky2002, admin, etc.) verified/seeded successfully.")
        except Exception as db_err:
            logger.warning(f"Database auto-setup / user seeding note: {db_err}")
    else:
        logger.warning("Could not establish initial connection to PostgreSQL database.")

    # Warm up ML client and AI Engine
    try:
        from app.services.ai_engine_service import ai_engine
        ai_engine.initialize()
        logger.info("AI Engine initialized with models.")
    except Exception as e:
        logger.warning(f"AI Engine warmup note: {e}")

    try:
        ml = get_ml_client()
        logger.info("ML Risk Client initialized.")
    except Exception as e:
        logger.warning(f"ML client warmup note: {e}")

    yield

    logger.info("Shutting down Sanket-AI Backend Service...")


# Initialize FastAPI App
app = FastAPI(
    title=settings.PROJECT_NAME,
    description="""
    ## Sanket-AI: Predictive Analytics & Early Warning System for National Infrastructure
    Monitoring infrastructure projects via PAIMANA/OCMS data.
    
    ### Capabilities:
    * **Cost & Schedule Overrun Forecasting** (3-Month & 6-Month Horizons)
    * **Project Risk Scoring & SHAP Feature Explainability**
    * **National Health & Delay Factor Aggregations**
    * **AI Action Centre & Resolution Simulations**
    * **Comparative Sector Benchmarking**
    * **Project Intelligence Assistant**
    
    ### Authentication:
    All endpoints (except /health and /auth/login) require a valid Bearer JWT token.
    Obtain a token via **POST /api/auth/login**.
    """,
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan
)

# Configure CORS Middleware
# Enable credentials and allow origins dynamically (supporting Vercel deployments, localhost, and custom domains)
app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=r"https://.*\.vercel\.app|http://localhost:\d+|http://127\.0\.0\.1:\d+|.*",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)



# Global Exception Handler
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error(f"Unhandled error on {request.method} {request.url}: {exc}", exc_info=True)
    return JSONResponse(
        status_code=500,
        content={
            "status": "error",
            "message": "An internal server error occurred.",
            "detail": str(exc) if settings.DEBUG else None
        }
    )


# Register API Routers
api_prefix = settings.API_PREFIX

# ── Public routes (no auth required) ──
app.include_router(health_router, prefix=api_prefix)
app.include_router(auth_router, prefix=api_prefix)

# ── Protected routes (any authenticated user) ──
_auth_dep = [Depends(get_current_user)]

app.include_router(projects_router, prefix=api_prefix, dependencies=_auth_dep)
app.include_router(dashboard_router, prefix=api_prefix, dependencies=_auth_dep)
app.include_router(risk_router, prefix=api_prefix, dependencies=_auth_dep)
app.include_router(alerts_router, prefix=api_prefix, dependencies=_auth_dep)
app.include_router(action_centre_router, prefix=api_prefix, dependencies=_auth_dep)
app.include_router(benchmark_router, prefix=api_prefix, dependencies=_auth_dep)
app.include_router(assistant_router, prefix=api_prefix, dependencies=_auth_dep)
app.include_router(insights_router, prefix=api_prefix, dependencies=_auth_dep)
app.include_router(distribution_router, prefix=api_prefix, dependencies=_auth_dep)


@app.get("/", tags=["Root"])
def root():
    return {
        "name": settings.PROJECT_NAME,
        "version": "1.0.0",
        "docs": "/docs",
        "health": f"{settings.API_PREFIX}/health",
        "login": f"{settings.API_PREFIX}/auth/login",
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="127.0.0.1", port=8080, reload=True)
