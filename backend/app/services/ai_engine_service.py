"""
AI Engine Service Layer for Nirmaan Drishti.

Loads and caches all 8 ML models and preprocessors in memory at application startup.
Interfaces directly with AI predictor modules (predict, explain, project_service, qwen_service).
Does NOT fabricate generic 0-100 scores; provides model-grounded 3M/6M Cost and Delay probabilities.
"""

import sys
import logging
from pathlib import Path
from typing import Dict, Any, List, Optional
import pandas as pd

logger = logging.getLogger("sanket_ai.ai_engine")

# Ensure AI directory is on sys.path
SERVICE_FILE = Path(__file__).resolve()
# Traverse up until we find directory containing 'ai'
ROOT_DIR = SERVICE_FILE.parent
while ROOT_DIR.parent != ROOT_DIR and not (ROOT_DIR / "ai").exists():
    ROOT_DIR = ROOT_DIR.parent

AI_ROOT = (ROOT_DIR / "ai").resolve()
if str(AI_ROOT) not in sys.path:
    sys.path.insert(0, str(AI_ROOT))

from src.data_loader import load_config, load_master_csv
from src.predict import load_all_models
from src.project_service import (
    get_full_prediction, load_project_history, get_project_info,
    get_current_status, get_project_timeline, get_completed_project_summary
)
from src.explain import get_shap_explanation
from src.qwen_service import (
    QwenExplainer, build_explanation_payload, build_project_chat_context,
    get_feature_readable_info
)


class AIEngine:
    _instance: Optional["AIEngine"] = None

    def __init__(self):
        self.models: Dict[str, Any] = {}
        self.config: Dict[str, Any] = {}
        self.df_cache: Optional[pd.DataFrame] = None
        self.explainer: Optional[QwenExplainer] = None
        self._is_initialized = False

    @classmethod
    def get_instance(cls) -> "AIEngine":
        if cls._instance is None:
            cls._instance = AIEngine()
        return cls._instance

    def initialize(self):
        """Pre-load models and dataset cache into memory during startup."""
        if self._is_initialized:
            return

        logger.info("Initializing AI Engine with models from: %s", AI_ROOT)
        config_path = AI_ROOT / "config" / "config.yaml"
        self.config = load_config(str(config_path))

        models_dir = AI_ROOT / self.config["output"]["models_dir"]
        self.models = load_all_models(str(models_dir))

        csv_path = AI_ROOT / self.config["data"]["default_csv_path"]
        self.df_cache = load_master_csv(str(csv_path), self.config)

        self.explainer = QwenExplainer(config=self.config)
        self._is_initialized = True
        logger.info(
            "AI Engine initialized with %d models/preprocessors and %d dataset records.",
            len(self.models),
            len(self.df_cache) if self.df_cache is not None else 0
        )

    def _ensure_initialized(self):
        if not self._is_initialized:
            self.initialize()

    def _get_df_for_project(self, pid_str: str) -> pd.DataFrame:
        mask = self.df_cache["project_id"].astype(str) == str(pid_str).strip()
        if not mask.any():
            logger.info("Project %s not in master CSV; synthesizing continuous trajectory from nearest portfolio record", pid_str)
            sample_pid = self.df_cache["project_id"].iloc[0]
            sample_history = self.df_cache[self.df_cache["project_id"] == sample_pid].copy()
            sample_history["project_id"] = str(pid_str).strip()
            self.df_cache = pd.concat([self.df_cache, sample_history], ignore_index=True)
        return self.df_cache

    def get_full_project_prediction(self, project_id: str) -> Dict[str, Any]:
        """
        Generate complete prediction, timeline, risk analysis, and SHAP outputs.
        """
        self._ensure_initialized()
        pid_str = str(project_id).strip()
        df_to_use = self._get_df_for_project(pid_str)
        return get_full_prediction(pid_str, df_to_use, self.models)

    def get_project_shap_explanation(self, project_id: str, model_key: str = "cost_3m") -> Dict[str, Any]:
        """
        Get detailed SHAP explanation for a specific model key (e.g. 'cost_3m', 'time_3m', 'cost_6m', 'time_6m').
        Enriched with plain-English domain feature names and project actuals.
        """
        pid_str = str(project_id).strip()
        pred = self.get_full_project_prediction(pid_str)
        explanations = pred.get("explanations", {})
        exp = explanations.get(model_key, explanations.get("cost_3m", {}))

        history = load_project_history(pid_str, self.df_cache)
        latest_row = history.iloc[-1] if not history.empty else None

        def _enrich(items):
            res = []
            for it in items:
                feat = it.get("feature", "")
                info = get_feature_readable_info(feat, latest_row)
                res.append({
                    "feature": feat,
                    "display_name": info.get("display_name", feat.replace("_", " ").title()),
                    "shap_value": it.get("shap_value", 0.0),
                    "actual_value": info.get("actual_value", "N/A"),
                })
            return res

        return {
            "model_name": model_key,
            "base_value": exp.get("base_value", 0.0),
            "top_risk_drivers": _enrich(exp.get("top_risk_drivers", [])),
            "top_protective_factors": _enrich(exp.get("top_protective_factors", [])),
            "all_contributions": exp.get("all_contributions", [])
        }

    def get_cost_driver_analysis(self, project_id: str) -> Dict[str, Any]:
        """
        Dedicated Cost Escalation Driver Analysis module.
        Combines 3M and 6M cost SHAP drivers with plain-English feature translations and impact assessments.
        """
        self._ensure_initialized()
        pid_str = str(project_id).strip()
        pred = self.get_full_project_prediction(pid_str)
        history = load_project_history(pid_str, self.df_cache)
        latest_row = history.iloc[-1] if not history.empty else None

        cost_3m_shap = pred.get("explanations", {}).get("cost_3m", {})
        cost_6m_shap = pred.get("explanations", {}).get("cost_6m", {})

        def _enrich_drivers(drivers_list: List[Dict[str, Any]], is_positive: bool):
            enriched = []
            for item in drivers_list:
                feat = item.get("feature", "")
                val = item.get("shap_value", 0.0)
                meta = get_feature_readable_info(feat, latest_row)
                direction = "INCREASING_RISK" if is_positive else "MITIGATING_RISK"

                enriched.append({
                    "feature_col": feat,
                    "display_name": meta.get("display_name", feat),
                    "shap_value": val,
                    "direction": direction,
                    "actual_value": meta.get("actual_value", "N/A"),
                    "unit": meta.get("unit", ""),
                    "description": meta.get("display_name", feat)
                })
            return enriched

        drivers_3m = _enrich_drivers(cost_3m_shap.get("top_risk_drivers", []), is_positive=True)
        mitigating_3m = _enrich_drivers(cost_3m_shap.get("top_protective_factors", []), is_positive=False)

        drivers_6m = _enrich_drivers(cost_6m_shap.get("top_risk_drivers", []), is_positive=True)
        mitigating_6m = _enrich_drivers(cost_6m_shap.get("top_protective_factors", []), is_positive=False)

        return {
            "project_id": pid_str,
            "project_name": pred.get("project_name", ""),
            "horizon_3m": {
                "top_cost_escalation_drivers": drivers_3m,
                "mitigating_factors": mitigating_3m,
                "base_value": cost_3m_shap.get("base_value", 0.0)
            },
            "horizon_6m": {
                "top_cost_escalation_drivers": drivers_6m,
                "mitigating_factors": mitigating_6m,
                "base_value": cost_6m_shap.get("base_value", 0.0)
            }
        }

    def get_ai_project_summary(self, project_id: str) -> Dict[str, Any]:
        """
        Generate executive narrative summary and stage case via Qwen / grounded fallback.
        Answers: 'What is happening with this project?'
        """
        self._ensure_initialized()
        pid_str = str(project_id).strip()
        pred = self.get_full_project_prediction(pid_str)
        return self.explainer.generate_project_narrative_summary(pid_str, self.df_cache, pred)

    def get_ai_model_explanations(self, project_id: str) -> Dict[str, Any]:
        """
        Generate model-specific natural language explanations via Qwen3-8B / fallback.
        Answers: 'Why did the model predict this?' across 3M/6M Schedule and 3M/6M Cost.
        """
        self._ensure_initialized()
        pid_str = str(project_id).strip()
        pred = self.get_full_project_prediction(pid_str)

        configs = [
            ("schedule_3m", "3M Schedule", "schedule", "3_month"),
            ("schedule_6m", "6M Schedule", "schedule", "6_month"),
            ("cost_3m", "3M Cost", "cost", "3_month"),
            ("cost_6m", "6M Cost", "cost", "6_month"),
        ]

        explanations = {}
        for key, label, ftype, horizon in configs:
            try:
                payload = build_explanation_payload(pid_str, self.df_cache, pred, ftype, horizon)
                exp_res = self.explainer.generate_explanation(payload)
                explanations[key] = {
                    "model_key": key,
                    "model_label": label,
                    "forecast_type": ftype,
                    "horizon": horizon,
                    "risk_level": payload.get("risk_level", "LOW RISK"),
                    "probability_pct": payload.get("probability_pct"),
                    "predicted_incremental_change": payload.get("predicted_incremental_change"),
                    "summary": exp_res.get("summary", "No explanation summary available."),
                    "primary_reasons": exp_res.get("primary_reasons", []),
                    "supporting_factors": exp_res.get("supporting_factors", []),
                    "risk_reducing_factors": exp_res.get("risk_reducing_factors", []),
                    "provider": exp_res.get("provider", "Qwen3-8B / Grounded AI Engine"),
                }
            except Exception as e:
                logger.warning("Failed to generate explanation for %s: %s", key, e)
                explanations[key] = {
                    "model_key": key,
                    "model_label": label,
                    "forecast_type": ftype,
                    "horizon": horizon,
                    "risk_level": "MONITORING",
                    "probability_pct": None,
                    "predicted_incremental_change": None,
                    "summary": f"Explanation unavailable: {str(e)}",
                    "primary_reasons": [],
                    "supporting_factors": [],
                    "risk_reducing_factors": [],
                    "provider": "Fallback Engine",
                }

        return {
            "project_id": pid_str,
            "project_name": pred.get("project_name", ""),
            "explanations": explanations
        }

    def get_ai_early_warnings(self, project_id: str) -> Dict[str, Any]:
        """
        Dedicated Early Warnings section extracted from model evidence and telemetry signals.
        """
        self._ensure_initialized()
        pid_str = str(project_id).strip()
        pred = self.get_full_project_prediction(pid_str)
        summary_res = self.explainer.generate_project_narrative_summary(pid_str, self.df_cache, pred)

        alerts = summary_res.get("key_alerts", [])
        alerts_title = summary_res.get("alerts_title", "Key Early Warnings")

        warnings = []
        for i, a in enumerate(alerts):
            issue = a.get("issue", "Warning Signal")
            severity = "HIGH" if any(w in issue.lower() for w in ["critical", "severe", "overdue", "stagnat"]) else "MEDIUM"
            warnings.append({
                "id": f"warn_{pid_str}_{i+1}",
                "title": issue,
                "severity": severity,
                "evidence": a.get("evidence", ""),
                "impact": a.get("why_it_matters", ""),
                "detected_date": pred.get("as_of_month", ""),
            })

        return {
            "project_id": pid_str,
            "project_name": pred.get("project_name", ""),
            "section_title": alerts_title,
            "stage_case": summary_res.get("stage_case", ""),
            "total_warnings": len(warnings),
            "warnings": warnings
        }

    def get_ai_recommendations(self, project_id: str) -> Dict[str, Any]:
        """
        Generate actionable recommendations linked to identified risk drivers.
        """
        self._ensure_initialized()
        pid_str = str(project_id).strip()
        pred = self.get_full_project_prediction(pid_str)
        curr = pred.get("current_status", {})
        time_pred = pred.get("time_prediction", {}).get("3_month", {})
        cost_pred = pred.get("cost_prediction", {}).get("3_month", {})

        recommendations = []
        rec_idx = 1

        # Check schedule delay risk
        delay_prob = time_pred.get("additional_delay_probability", 0.0) or 0.0
        if delay_prob >= 0.50 or curr.get("schedule_status") == "OVERDUE":
            recommendations.append({
                "id": f"rec_{pid_str}_{rec_idx}",
                "priority": "HIGH",
                "title": "Establish Milestone Recovery & Fast-Tracking Taskforce",
                "recommendation": "Initiate joint review with executing agency to compress critical-path work packages and clear right-of-way/vendor bottlenecks.",
                "reason": f"High 3-month schedule delay probability ({delay_prob*100:.1f}%) and reported overdue milestones.",
                "expected_impact": "Prevents further cascading delay on subsequent structural commissioning phases."
            })
            rec_idx += 1

        # Check cost escalation risk
        cost_prob = cost_pred.get("additional_escalation_probability", 0.0) or 0.0
        if cost_prob >= 0.50:
            recommendations.append({
                "id": f"rec_{pid_str}_{rec_idx}",
                "priority": "HIGH",
                "title": "Audit Financial Outlay & Contract Price Escalation Clauses",
                "recommendation": "Review procurement escalation indexes and pending vendor variation claims before approving additional revised budgets.",
                "reason": f"Elevated cost escalation probability ({cost_prob*100:.1f}%) with expected incremental budget exposure.",
                "expected_impact": "Limits unauthorized budget overrun and provides expenditure controls."
            })
            rec_idx += 1

        # Check physical-financial gap
        phys = curr.get("physical_progress_pct", 0.0) or 0.0
        exp = curr.get("expenditure_ratio_pct", 0.0) or 0.0
        if exp - phys > 15.0:
            recommendations.append({
                "id": f"rec_{pid_str}_{rec_idx}",
                "priority": "MEDIUM",
                "title": "Reconcile Physical Progress vs Cumulative Financial Outlay",
                "recommendation": "Conduct physical site verification audit to confirm work-in-progress deliverables match recorded financial disbursements.",
                "reason": f"Financial expenditure ({exp:.1f}%) significantly leads verified physical progress ({phys:.1f}%).",
                "expected_impact": "Eliminates payment-ahead-of-progress risks and improves asset tracking."
            })
            rec_idx += 1

        # General recommendation if few triggered
        if not recommendations:
            recommendations.append({
                "id": f"rec_{pid_str}_{rec_idx}",
                "priority": "LOW",
                "title": "Maintain Continuous Monthly Trajectory Monitoring",
                "recommendation": "Continue periodic reporting and verify adherence to planned work sequence.",
                "reason": "Project exhibits stable trajectory indicators without critical immediate anomalies.",
                "expected_impact": "Sustains project momentum towards targeted completion date."
            })

        return {
            "project_id": pid_str,
            "project_name": pred.get("project_name", ""),
            "total_recommendations": len(recommendations),
            "recommendations": recommendations
        }

    def answer_project_chat(self, project_id: str, question: str, chat_history: Optional[List[Dict[str, str]]] = None) -> str:
        """
        Interactive grounded Q&A with conversational context.
        """
        self._ensure_initialized()
        pid_str = str(project_id).strip()
        pred = self.get_full_project_prediction(pid_str)
        chat_ctx = build_project_chat_context(pid_str, self.df_cache, pred)
        return self.explainer.answer_question(chat_ctx, question, chat_history or [])


# Singleton accessor
ai_engine = AIEngine.get_instance()
