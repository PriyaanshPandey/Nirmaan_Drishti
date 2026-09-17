"""
ML Risk Client Module.
Provides a clean service boundary between FastAPI and the AI/ML layer.
Loads trained XGBoost/scikit-learn models and triggers predictions.
"""
import sys
import logging
from pathlib import Path
from typing import Dict, Any, Optional, List
import pandas as pd

logger = logging.getLogger(__name__)

# Add AI module directory to path for clean imports
AI_DIR = Path(__file__).resolve().parent.parent.parent.parent / "ai"
if str(AI_DIR) not in sys.path:
    sys.path.append(str(AI_DIR))

MODELS_DIR = AI_DIR / "models"
RAW_DATA_PATH = Path(__file__).resolve().parent.parent.parent.parent / "data" / "New_data_2011-26.csv"
if not RAW_DATA_PATH.exists():
    RAW_DATA_PATH = AI_DIR / "data" / "input" / "PAIMANA_Master.csv"


class MLRiskClient:
    """
    Singleton client for loading and executing trained PAIMANA ML models.
    """
    _instance = None
    _models: Optional[Dict[str, Any]] = None
    _master_df: Optional[pd.DataFrame] = None

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super(MLRiskClient, cls).__new__(cls)
        return cls._instance

    def initialize(self):
        """Preload models into memory."""
        if self._models is None:
            try:
                from src.predict import load_all_models
                if MODELS_DIR.exists():
                    self._models = load_all_models(str(MODELS_DIR))
                    logger.info(f"Loaded {len(self._models)} ML models and preprocessors from {MODELS_DIR}")
                else:
                    logger.warning(f"Models directory not found at {MODELS_DIR}")
                    self._models = {}
            except Exception as e:
                logger.error(f"Failed to load ML models: {e}")
                self._models = {}

    def get_master_df(self) -> Optional[pd.DataFrame]:
        """Lazy-load or reuse the reference PAIMANA master dataset from AIEngine."""
        try:
            from app.services.ai_engine_service import AIEngine
            engine_inst = AIEngine.get_instance()
            if engine_inst.df_cache is not None:
                return engine_inst.df_cache
        except Exception:
            pass

        if self._master_df is None and RAW_DATA_PATH.exists():
            try:
                from src.data_loader import load_master_csv
                self._master_df = load_master_csv(str(RAW_DATA_PATH))
                logger.info(f"Loaded master dataframe with {len(self._master_df)} rows")
            except Exception as e:
                logger.error(f"Failed to load master dataset: {e}")
        return self._master_df

    def predict_project(self, project_id: str, custom_df: Optional[pd.DataFrame] = None) -> Dict[str, Any]:
        """
        Execute prediction pipeline for a given project.
        Returns complete prediction dictionary with cost, time, and SHAP explainability.
        """
        logger.info(f"[ML] Prediction requested for project: {project_id}")
        self.initialize()
        from app.services.ai_engine_service import AIEngine
        return AIEngine.get_instance().get_full_project_prediction(project_id)

    def explain_project(self, project_id: str, custom_df: Optional[pd.DataFrame] = None) -> Dict[str, Any]:
        """
        Generate AI natural language narrative summary for a project.
        """
        logger.info(f"[AI] Qwen explanation requested for project: {project_id}")
        prediction_result = self.predict_project(project_id, custom_df)
        from app.services.ai_engine_service import AIEngine
        summary_res = AIEngine.get_instance().get_ai_project_summary(project_id)
        return {
            "prediction": prediction_result,
            "narrative": summary_res
        }


_client = MLRiskClient()


def get_ml_client() -> MLRiskClient:
    """Dependency / accessor for ML client instance."""
    _client.initialize()
    return _client
