"""
PAIMANA ML Prediction CLI.

Runs incremental and final predictions for a selected project using saved models.

Usage:
    python predict.py --project_id 400005
    python predict.py --project_id 619075
    python predict.py --project_id 400259
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

sys.path.insert(0, str(Path(__file__).parent))

from src.data_loader import load_master_csv, load_config
from src.predict import load_all_models
from src.project_service import get_full_prediction, load_project_history


def main():
    parser = argparse.ArgumentParser(description="PAIMANA ML Incremental Prediction")
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

    models_dir = args.models_dir or str(Path(__file__).parent / config["output"]["models_dir"])
    models = load_all_models(models_dir)

    if not models:
        print("[ERROR] No trained models found. Run train.py first.")
        sys.exit(1)

    print(f"\n{'=' * 70}")
    print(f"PREDICTION FOR PROJECT: {args.project_id}")
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
        print("\nNote: Future 3M/6M predictions are not applicable to completed projects.")
        return result

    # Active Project handling
    print(f"\n--- [1. CURRENT REPORTED STATUS] ---")
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

    print(f"\n--- [2. COST OVERRUN FORECAST] ---")
    for horizon, pred in result["cost_prediction"].items():
        print(f"\n  [{horizon.replace('_', ' ').upper()}]")
        print(f"    Additional Escalation Risk : {pred.get('additional_escalation_probability', 0) * 100:.1f}%")
        print(f"    Predicted Additional Overrun: {pred.get('predicted_additional_overrun_pct'):+.2f}% (+₹{pred.get('predicted_additional_cost_crore'):.2f} Cr)")
        print(f"    Predicted Final Overrun     : {pred.get('predicted_final_cost_overrun_pct'):.2f}% (₹{pred.get('predicted_final_cost_escalation_crore'):.2f} Cr)")
        print(f"    Predicted Final Revised Cost: ₹{pred.get('predicted_final_revised_cost_crore'):.2f} Cr")

    print(f"\n--- [3. SCHEDULE DELAY FORECAST] ---")
    timeline = result.get("timeline", {})
    if timeline:
        print(f"  Time Elapsed Till Now               : {timeline.get('time_elapsed_till_now', 'N/A')}")
        print(f"  Time Remaining for Planned Completion: {timeline.get('time_remaining_planned_completion', 'N/A')}")

    for horizon, pred in result["time_prediction"].items():
        print(f"\n  [{horizon.replace('_', ' ').upper()}]")
        print(f"    Additional Delay Risk                : {pred.get('additional_delay_probability', 0) * 100:.1f}%")
        print(f"    Predicted Additional Delay           : {pred.get('predicted_additional_delay', 'N/A')}")
        print(f"    Estimated Time Needed for Completion : {pred.get('estimated_time_needed_completion', 'N/A')}")
        print(f"    Tentative Completion Date            : {pred.get('tentative_completion_date', 'N/A')}")
        print(f"    Forecasted Total Schedule Extension  : {pred.get('predicted_total_schedule_extension_months'):.2f} months")

    print(f"\n--- [4. TOP RISK DRIVERS (SHAP)] ---")
    for model_name, explanation in result.get("explanations", {}).items():
        print(f"\n  {model_name}:")
        for driver in explanation.get("top_risk_drivers", [])[:5]:
            print(f"    {driver['feature']:<35}: {driver['shap_value']:+.4f}")

    if args.explain:
        from src.qwen_service import QwenExplainer, build_explanation_payload
        explainer = QwenExplainer()
        status_info = explainer.get_status()
        print(f"\n======================================================================")
        print(f"AI PROJECT SUMMARY & GROUNDED DECISION ANALYSIS ({status_info['status_label']})")
        print(f"======================================================================")
        
        try:
            summary_res = explainer.generate_project_narrative_summary(args.project_id, df, result)
            print(f"\nStage Assessment: {summary_res['stage_case']}")
            print(f"\nExecutive Brief:")
            print(f"  {summary_res['summary']}")
            
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

        print(f"\n----------------------------------------------------------------------")
        print(f"AI NATURAL LANGUAGE HORIZON EXPLANATIONS")
        print(f"----------------------------------------------------------------------")
        
        for ftype in ["schedule", "cost"]:
            for h in ["3_month", "6_month"]:
                try:
                    payload = build_explanation_payload(args.project_id, df, result, ftype, h)
                    exp = explainer.generate_explanation(payload)
                    print(f"\n--- [{h.replace('_', ' ').upper()} {ftype.upper()} FORECAST EXPLANATION] ---")
                    print(f"Summary:")
                    print(f"  {exp.get('summary')}")
                    print(f"\nPrimary Contributing Reasons:")
                    for r in exp.get("primary_reasons", []):
                        print(f"  • {r}")
                    if exp.get("risk_reducing_factors"):
                        print(f"\nRisk-Reducing Factors:")
                        for rr in exp.get("risk_reducing_factors", []):
                            print(f"  • {rr}")
                except Exception as e:
                    pass

    if args.output:
        with open(args.output, "w") as f:
            json.dump(result, f, indent=2, default=str)
        print(f"\nPrediction saved to: {args.output}")

    return result


if __name__ == "__main__":
    main()
