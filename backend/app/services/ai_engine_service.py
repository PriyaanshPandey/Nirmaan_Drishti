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

        # Unify historical OCMS records to primary project_id deterministically
        try:
            mapping_report = ROOT_DIR / "data" / "07_validation_reports" / "ocms_project_id_transition_report.csv"
            if mapping_report.exists():
                map_df = pd.read_csv(mapping_report)
                verified = map_df[map_df["mapping_status"] == "ACTIVE_VERIFIED"]
                ocms_map = {}
                for _, r in verified.iterrows():
                    o = str(r["legacy_ocms_code"]).strip()
                    p = str(r["project_id"]).strip()
                    if o.endswith(".0"): o = o[:-2]
                    if p.endswith(".0"): p = p[:-2]
                    ocms_map[o] = p
                ocms_map["N06000152"] = "400259"

                if "legacy_ocms_code" not in self.df_cache.columns:
                    self.df_cache["legacy_ocms_code"] = None

                # For rows where project_id is in ocms_map, record legacy_ocms_code and map project_id
                mask_ocms = self.df_cache["project_id"].astype(str).isin(ocms_map)
                if mask_ocms.any():
                    self.df_cache.loc[mask_ocms, "legacy_ocms_code"] = self.df_cache.loc[mask_ocms, "project_id"]
                    self.df_cache.loc[mask_ocms, "project_id"] = self.df_cache.loc[mask_ocms, "project_id"].astype(str).map(ocms_map)
                    logger.info("Unified %d historical snapshots in df_cache using ProjectIdentityResolver", mask_ocms.sum())
        except Exception as e:
            logger.warning("Could not apply identity mappings to df_cache: %s", e)

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
        clean_pid = str(pid_str).strip()
        if clean_pid.endswith(".0"):
            clean_pid = clean_pid[:-2]

        mask = (self.df_cache["project_id"].astype(str) == clean_pid)
        if not mask.any() and "legacy_ocms_code" in self.df_cache.columns:
            mask = (self.df_cache["legacy_ocms_code"].astype(str) == clean_pid)

        try:
            from app.database import SessionLocal
            from app.models.project import Project
            db = SessionLocal()
            try:
                proj = db.query(Project).filter(
                    (Project.id == clean_pid) | (Project.project_code == clean_pid) | (Project.legacy_ocms_code == clean_pid)
                ).first()
                if proj:
                    if mask.any():
                        sorted_sub = self.df_cache[mask].sort_values("report_month")
                        last_idx = sorted_sub.index[-1]
                        cur_p = float(self.df_cache.loc[last_idx, "physical_progress_pct"] or 0)
                        if proj.physical_progress is not None and float(proj.physical_progress) > cur_p:
                            self.df_cache.loc[last_idx, "physical_progress_pct"] = float(proj.physical_progress)
                        cur_e = float(self.df_cache.loc[last_idx, "cumulative_expenditure_crore"] or 0)
                        if proj.cumulative_expenditure is not None and float(proj.cumulative_expenditure) > cur_e:
                            self.df_cache.loc[last_idx, "cumulative_expenditure_crore"] = float(proj.cumulative_expenditure)
                        if proj.schedule_extension_months is not None and float(proj.schedule_extension_months) > 0:
                            self.df_cache.loc[last_idx, "schedule_extension_months"] = float(proj.schedule_extension_months)
                        if proj.name:
                            self.df_cache.loc[mask, "project_name"] = proj.name
                    else:
                        logger.info("Project %s not in master CSV; looking up in PostgreSQL to construct real feature snapshot", clean_pid)
                        orig_c = float(proj.original_cost or 0.0)
                        rev_c = float(proj.revised_cost or orig_c)
                        cum_e = float(proj.cumulative_expenditure or 0.0)
                        phys_p = float(proj.physical_progress or 0.0)
                        sched_ext = float(proj.schedule_extension_months or 0.0)
                        eff_doc = proj.actual_completion_date or proj.expected_completion_date or proj.original_completion_date

                        real_row = {
                            "project_id": str(proj.id),
                            "project_name": proj.name or "Unknown Project",
                            "agency": proj.agency or "Other",
                            "sector": proj.sector or "Other",
                            "state": proj.state or "Multi-State",
                            "ministry_department": proj.ministry or "Other",
                            "report_month": pd.Timestamp.now().strftime("%Y-%m-01"),
                            "original_cost_crore": orig_c,
                            "revised_cost_crore": rev_c,
                            "cost_escalation_crore": max(0.0, rev_c - orig_c),
                            "cost_overrun_pct": ((rev_c - orig_c) / orig_c * 100.0) if orig_c > 0 else 0.0,
                            "cumulative_expenditure_crore": cum_e,
                            "expenditure_ratio_pct": (cum_e / rev_c * 100.0) if rev_c > 0 else 0.0,
                            "physical_progress_pct": phys_p,
                            "schedule_extension_months": sched_ext,
                            "original_duration_months": 36.0,
                            "revised_remaining_months": 12.0,
                            "planned_remaining_months": 12.0,
                            "project_age_months": 24.0,
                            "remaining_budget_crore": max(0.0, rev_c - cum_e),
                            "expenditure_velocity_crore_month": (cum_e / 24.0) if cum_e > 0 else 5.0,
                            "physical_financial_gap": ((cum_e / rev_c * 100.0) if rev_c > 0 else 0.0) - phys_p,
                            "progress_minus_expenditure_gap": phys_p - ((cum_e / rev_c * 100.0) if rev_c > 0 else 0.0),
                            "expenditure_vs_progress_ratio": ((cum_e / rev_c * 100.0) if rev_c > 0 else 0.0) / max(phys_p, 0.1),
                            "cost_overrun_negative_flag": 1.0 if rev_c < orig_c else 0.0,
                            "is_extended_flag": 1.0 if sched_ext > 0 else 0.0,
                            "is_overdue_flag": 1.0 if sched_ext > 0 else 0.0,
                            "extension_rate_pct": (sched_ext / 36.0 * 100.0),
                            "original_target_doc": pd.Timestamp(eff_doc) if eff_doc else None,
                            "revised_doc": pd.Timestamp(eff_doc) if eff_doc else None,
                            "snapshot_history_count": 1,
                            "consecutive_stagnant_months": 0,
                            "physical_progress_delta_1m": 0.0,
                            "physical_progress_delta_3m": 0.0,
                            "physical_progress_delta_6m": 0.0,
                            "progress_velocity_3m": 0.0,
                            "progress_velocity_6m": 0.0,
                            "progress_trend_slope": 0.0,
                            "physical_financial_gap_pct": abs(phys_p - ((cum_e / rev_c * 100.0) if rev_c > 0 else 0.0)),
                            "physical_to_expenditure_ratio": (phys_p / (cum_e / rev_c * 100.0)) if (cum_e > 0 and rev_c > 0) else 1.0,
                            "progress_expenditure_mismatch_flag": 0,
                            "high_expenditure_low_progress_flag": 0,
                            "days_to_original_target": 0.0,
                            "days_to_revised_target": 0.0,
                            "schedule_status": proj.schedule_status,
                            "overdue_days": float(proj.delay_days or 0),
                            "extension_count": 1 if sched_ext > 0 else 0,
                            "cost_overrun_delta_1m": 0.0,
                            "cost_overrun_delta_3m": 0.0,
                            "cost_overrun_trend_slope": 0.0,
                            "expenditure_ratio_delta_1m": 0.0,
                            "expenditure_ratio_delta_3m": 0.0,
                            "schedule_extension_delta_1m": 0.0,
                            "risk_signal_count": 0,
                            "legacy_ocms_code": proj.legacy_ocms_code
                        }
                        self.df_cache = pd.concat([self.df_cache, pd.DataFrame([real_row])], ignore_index=True)
            finally:
                db.close()
        except Exception as e:
            logger.warning("Could not sync project status with DB (offline/db error): %s", e)

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
        res = self.explainer.generate_project_narrative_summary(pid_str, self.df_cache, pred)
        if not res.get("project_name") or res.get("project_name") in (f"Project {pid_str}", "Unknown Project", "This project"):
            res["project_name"] = pred.get("project_name") or f"Project {pid_str}"
        return res

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
