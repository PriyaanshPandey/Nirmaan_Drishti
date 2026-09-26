"""
PAIMANA / Nirmaan Drishti ML Prediction CLI.

Runs next-period (T+1) predictions for a selected project using newly trained production models.

Usage:
    python ai/predict.py --project_id 400005
    python ai/predict.py --project_id 619075
    python ai/predict.py --project_id 400259
"""

import sys
import json
import argparse
from pathlib import Path

if hasattr(sys.stdout, "reconfigure"):
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass

ROOT_DIR = Path(__file__).resolve().parent.parent
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))
sys.path.insert(0, str(Path(__file__).parent))

from src.data_loader import load_master_csv, load_config
from src.predict import load_all_models
from src.project_service import get_full_prediction, load_project_history


def main():
    parser = argparse.ArgumentParser(description="Nirmaan Drishti T+1 Next-Period Prediction")
    parser.add_argument("--project_id", type=str, required=True,
                        help="Project ID to predict for")
    parser.add_argument("--csv_path", type=str, default=None,
                        help="Path to the Master CSV file")
    parser.add_argument("--models_dir", type=str, default=None,
                        help="Path to models directory")
    parser.add_argument("--output", type=str, default=None,
                        help="Path to save prediction JSON output")
    parser.add_argument("--explain", action="store_true",
                        help="Generate AI natural language explanation (Qwen3-8B)")
    args = parser.parse_args()

    config = load_config()
    df = load_master_csv(args.csv_path, config)

    models_dir = args.models_dir or str(Path(__file__).parent / "models")
    models = load_all_models(models_dir)

    if not models or "schedule_delay_model" not in models:
        print("[ERROR] No trained production T+1 models found. Run ai/train_t1_models.py first.")
        sys.exit(1)

    print(f"\n{'=' * 70}")
    print(f"NEXT-PERIOD (T+1) PREDICTION FOR PROJECT: {args.project_id}")
    print(f"{'=' * 70}")

    try:
        result = get_full_prediction(args.project_id, df, models)
    except ValueError as e:
        print(f"[ERROR] {e}")
        sys.exit(1)

    print(f"\nProject Name : {result['project_name']}")
    print(f"As of Month  : {result['as_of_month']}")

    # Completed Project handling
    if result.get("is_completed", False):
        print(f"\n--- [COMPLETED PROJECT SUMMARY] ---")
        for k, v in result["completed_summary"].items():
            print(f"  {k:<35}: {v}")
        print("\nNote: Future predictions are not applicable to completed projects.")
        return result

    # Active Project handling
    print(f"\n--- [1. CURRENT REPORTED STATUS AT TIME T] ---")
    curr = result["current_status"]
    print(f"  Physical Progress           : {curr.get('physical_progress_pct')}%")
    print(f"  Current Cost Overrun        : {curr.get('cost_overrun_pct')}% (₹{curr.get('cost_escalation_crore')} Cr)")
    print(f"  Original Cost               : ₹{curr.get('original_cost_crore')} Cr")
    print(f"  Revised Cost                : ₹{curr.get('revised_cost_crore')} Cr")
    print(f"  Cumulative Expenditure      : ₹{curr.get('cumulative_expenditure_crore')} Cr")
    print(f"  Expenditure Ratio           : {curr.get('expenditure_ratio_pct')}%")
    print(f"  Schedule Status             : {curr.get('schedule_status')}")
    print(f"  Schedule Extension          : {curr.get('schedule_extension_months')} months")
    print(f"  Overdue Days                : {curr.get('overdue_days')} days")

    print(f"\n--- [2. NEXT-PERIOD (T+1) RISK PREDICTIONS] ---")
    t1 = result.get("t1_prediction", {})
    sched_prob = t1.get("schedule_delay_probability", result.get("schedule_delay_probability", 0.0))
    cost_prob = t1.get("cost_overrun_probability", result.get("cost_overrun_probability", 0.0))
    sched_tier = t1.get("schedule_risk_tier", "HIGH" if sched_prob >= 0.5 else "LOW")
    cost_tier = t1.get("cost_risk_tier", "HIGH" if cost_prob >= 0.5 else "LOW")

    print(f"  T+1 Schedule Delay Risk     : {sched_prob * 100:.1f}% ({sched_tier})")
    print(f"  T+1 Cost Overrun Risk       : {cost_prob * 100:.1f}% ({cost_tier})")
    print(f"  Calibrated Risk Score       : {result.get('risk_score', 0.0)}/100 ({result.get('risk_level', 'Unknown')})")
    anom_status = "ANOMALY SIGNAL DETECTED" if result.get("is_anomaly") else "Normal Telemetry Pattern"
    print(f"  Telemetry Anomaly Monitor   : {anom_status} (Anomaly Score: {result.get('anomaly_score', 0.0)})")

    timeline = result.get("timeline", {})
    if timeline:
        print(f"\n--- [3. PROJECT TIMELINE METRICS] ---")
        print(f"  Time Elapsed Till Now               : {timeline.get('time_elapsed_till_now', 'N/A')}")
        print(f"  Time Remaining for Planned Completion: {timeline.get('time_remaining_planned_completion', 'N/A')}")

    print(f"\n--- [4. TOP RISK DRIVERS (SHAP TREEEXPLAINER)] ---")
    for model_name, explanation in result.get("explanations", {}).items():
        if model_name in ["time_3m", "cost_3m"]:
            continue  # Skip backwards-compatibility duplicates in CLI output
        print(f"\n  Target: {model_name.replace('_', ' ').title()}:")
        drivers = explanation.get("top_risk_drivers", [])[:5]
        if drivers:
            for driver in drivers:
                print(f"    • {driver['feature']:<35}: {driver['shap_value']:+.4f}")
        else:
            print("    • No positive risk drivers identified.")

    if args.explain:
        from src.qwen_service import QwenExplainer, build_explanation_payload
        explainer = QwenExplainer()
        status_info = explainer.get_status()
        print(f"\n======================================================================")
        print(f"AI PROJECT SUMMARY & GROUNDED DECISION ANALYSIS ({status_info['status_label']})")
        print(f"======================================================================")
        
        try:
            summary_res = explainer.generate_project_narrative_summary(args.project_id, df, result)
            print(f"\nStage Assessment: {summary_res.get('stage_case', 'Active Monitoring')}")
            print(f"\nExecutive Brief:")
            print(f"  {summary_res.get('summary', '')}")
            
            alerts = summary_res.get("key_alerts", [])
            alerts_title = summary_res.get("alerts_title", "Key Early Alerts")
            if alerts:
                print(f"\n{alerts_title}:")
                for a in alerts:
                    print(f"  • [{a.get('issue')}]")
                    print(f"     Details        : {a.get('evidence')}")
                    print(f"     Why It Matters : {a.get('why_it_matters')}")
        except Exception as e:
            print(f"  Could not generate AI project summary: {e}")

    if args.output:
        with open(args.output, "w", encoding="utf-8") as f:
            json.dump(result, f, indent=2, default=str)
        print(f"\nPrediction saved to: {args.output}")

    return result


if __name__ == "__main__":
    main()
