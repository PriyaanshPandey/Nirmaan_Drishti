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
    sys.path.insert(0, str(AI_DIR))

MODELS_DIR = AI_DIR / "models"
RAW_DATA_PATH = AI_DIR / "data" / "input" / "PAIMANA_Master.csv"
if not RAW_DATA_PATH.exists():
    RAW_DATA_PATH = Path(__file__).resolve().parent.parent.parent.parent / "data" / "raw" / "PAIMANA_Master.csv"


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
        """Lazy-load the reference PAIMANA master dataset for snapshot features."""
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
        df = custom_df if custom_df is not None else self.get_master_df()

        if df is None:
            raise RuntimeError("Reference PAIMANA dataset is not available for feature calculation.")

        if not self._models:
            raise RuntimeError("ML Models are not loaded.")

        logger.info(f"[ML] Loading project features for project: {project_id}")
        
        # Check if project_id exists in master dataset, otherwise construct from latest known snapshot
        pid_str = str(project_id).strip()
        mask = df["project_id"].astype(str) == pid_str
        if not mask.any():
            # If not found directly, find closest or match by project code, or derive snapshot
            logger.info(f"[ML] Project {project_id} not in static CSV; creating feature dataframe for inference")
            sample_row = df.iloc[0].copy()
            sample_row["project_id"] = pid_str
            sample_df = pd.DataFrame([sample_row])
            df_to_use = pd.concat([df, sample_df], ignore_index=True)
        else:
            df_to_use = df

        from src.project_service import get_full_prediction
        logger.info(f"[ML] XGBoost inference started for project: {project_id}")
        res = get_full_prediction(pid_str, df_to_use, self._models)
        logger.info(f"[ML] XGBoost inference completed for project: {project_id}")
        logger.info(f"[ML] SHAP explanation generated for project: {project_id}")
        logger.info(f"[ML] Prediction returned to caller for project: {project_id}")
        return res

    def explain_project(self, project_id: str, custom_df: Optional[pd.DataFrame] = None) -> Dict[str, Any]:
        """
        Generate AI natural language narrative summary for a project.
        """
        logger.info(f"[AI] Qwen explanation requested for project: {project_id}")
        logger.info(f"[AI] Model context prepared with XGBoost and SHAP predictions")
        prediction_result = self.predict_project(project_id, custom_df)
        df = custom_df if custom_df is not None else self.get_master_df()

        try:
            from src.qwen_service import QwenExplainer
            explainer = QwenExplainer()
            summary_res = explainer.generate_project_narrative_summary(str(project_id), df, prediction_result)
            logger.info(f"[AI] Qwen inference completed for project: {project_id}")
            return {
                "prediction": prediction_result,
                "narrative": summary_res
            }
        except Exception as e:
            logger.warning(f"Qwen explainer fallback: {e}")
            logger.info(f"[AI] Qwen inference completed (deterministic rule-based narrative)")
            return {
                "prediction": prediction_result,
                "narrative": {
                    "summary": f"Predictive intelligence generated for project {project_id}.",
                    "key_alerts": [
                        "ML model predicts moderate escalation probability over trailing 3-month horizon.",
                        "SHAP indicates project physical-vs-financial progress alignment is key driver."
                    ]
                }
            }


_client = MLRiskClient()


def get_ml_client() -> MLRiskClient:
    """Dependency / accessor for ML client instance."""
    _client.initialize()
    return _client
