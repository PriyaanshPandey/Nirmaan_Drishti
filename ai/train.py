"""
PAIMANA ML Training Orchestrator.

Runs the complete incremental training pipeline:
1. Load dataset & enrich trajectory features
2. Validate data quality & distribution
3. Generate rolling incremental targets (cost & schedule)
4. Train cost models (walk-forward CV with calibration)
5. Train schedule models (walk-forward CV with calibration)
6. Generate SHAP feature importance
7. Save models and metadata

Usage:
    python train.py
    python train.py --csv_path path/to/data.csv
"""

import sys
import os
import json
import argparse
import datetime
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from src.data_loader import load_master_csv, load_config
from src.validation import validate_dataset, print_validation_report, check_minimum_requirements
from src.feature_selection import validate_features, get_available_feature_split
from src.target_generation import generate_all_targets, save_training_datasets, report_target_availability
from src.train_cost import train_cost_models
from src.train_time import train_time_models
from src.evaluate import save_metrics
from src.explain import get_global_feature_importance, save_feature_importance
from src.preprocessing import transform_features, get_feature_names

import joblib


def save_model_metadata(config: dict, cost_results: dict, time_results: dict,
                        df, models_dir: str = None):
    """Save model metadata for reproducibility."""
    if models_dir is None:
        models_dir = Path(__file__).parent / config["output"]["models_dir"]
    models_dir = Path(models_dir)

    cost_threshold = config.get("cost", {}).get("additional_escalation_threshold_pct", 0.0)
    sched_threshold = config.get("schedule", {}).get("additional_delay_threshold_months", 0.0)

    metadata = {
        "version": config.get("version", "2.0.0"),
        "training_date": datetime.datetime.now().isoformat(),
        "training_period": {
            "min_month": str(df["report_month"].min().date()),
            "max_month": str(df["report_month"].max().date()),
        },
        "dataset": {
            "total_rows": len(df),
            "unique_projects": int(df["project_id"].nunique()),
            "report_months": int(df["report_month"].nunique()),
        },
        "horizons": config["prediction"]["horizons"],
        "target_definitions": {
            "cost_classification": f"additional_cost_overrun_pct > {cost_threshold} pp (probability of further cost escalation)",
            "cost_regression": "additional_cost_overrun_pct (incremental change in cost overrun %)",
            "time_classification": f"additional_delay_months > {sched_threshold} mo (probability of further schedule delay)",
            "time_regression": "additional_delay_months (incremental change in schedule extension months)",
            "authoritative_fields": {
                "schedule": "schedule_extension_months",
                "cost_amount": "cost_escalation_crore = revised_cost_crore - original_cost_crore",
                "cost_pct": "cost_overrun_pct = (cost_escalation_crore / original_cost_crore) * 100",
            },
        },
        "calibration": config.get("models", {}).get("calibration", {}),
        "feature_count": len(get_available_feature_split(df)["categorical"]) +
                         len(get_available_feature_split(df)["numeric"]),
        "features": {
            "categorical": get_available_feature_split(df)["categorical"],
            "numeric": get_available_feature_split(df)["numeric"],
        },
    }

    all_results = {**cost_results, **time_results}
    metrics_summary = {}
    for name, result in all_results.items():
        if isinstance(result, dict) and "aggregated" in result:
            metrics_summary[name] = result["aggregated"]
    metadata["metrics"] = metrics_summary

    path = models_dir / "model_metadata.json"
    with open(path, "w") as f:
        json.dump(metadata, f, indent=2, default=str)
    print(f"\nModel metadata saved to: {path}")


def generate_shap_importance(df, config, models_dir=None, results_dir=None):
    """Generate and save global SHAP feature importance for all models."""
    if models_dir is None:
        models_dir = Path(__file__).parent / config["output"]["models_dir"]
    if results_dir is None:
        results_dir = Path(__file__).parent / config["output"]["results_dir"]
    models_dir = Path(models_dir)
    results_dir = Path(results_dir)
    results_dir.mkdir(parents=True, exist_ok=True)

    importance_path = results_dir / "feature_importance.csv"
    if importance_path.exists():
        importance_path.unlink()

    feature_split = get_available_feature_split(df)
    feature_cols = feature_split["categorical"] + feature_split["numeric"]

    model_specs = [
        ("cost_classifier_3m", "cost_cls_3m_preprocessor"),
        ("cost_classifier_6m", "cost_cls_6m_preprocessor"),
        ("cost_regressor_3m", "cost_reg_3m_preprocessor"),
        ("cost_regressor_6m", "cost_reg_6m_preprocessor"),
        ("time_classifier_3m", "time_cls_3m_preprocessor"),
        ("time_classifier_6m", "time_cls_6m_preprocessor"),
        ("time_regressor_3m", "time_reg_3m_preprocessor"),
        ("time_regressor_6m", "time_reg_6m_preprocessor"),
    ]

    for model_name, prep_name in model_specs:
        model_path = models_dir / f"{model_name}.pkl"
        prep_path = models_dir / f"preprocessing/{prep_name}.pkl"

        if not model_path.exists() or not prep_path.exists():
            continue

        print(f"\nGenerating SHAP importance for: {model_name}")
        model = joblib.load(model_path)
        preprocessor = joblib.load(prep_path)

        sample = df[feature_cols].sample(n=min(500, len(df)), random_state=42)
        X = transform_features(sample, preprocessor)
        feature_names = get_feature_names(preprocessor)

        try:
            importance = get_global_feature_importance(model, X, feature_names)
            save_feature_importance(importance, model_name, str(importance_path))
        except Exception as e:
            print(f"[WARNING] SHAP computation skipped for {model_name}: {e}")

    print(f"\n[OK] Feature importance saved to: {importance_path}")


def main():
    parser = argparse.ArgumentParser(description="PAIMANA ML Incremental Training Pipeline")
    parser.add_argument("--csv_path", type=str, default=None,
                        help="Path to the Master CSV file")
    parser.add_argument("--config_path", type=str, default=None,
                        help="Path to config.yaml")
    args = parser.parse_args()

    print("=" * 70)
    print("PAIMANA ML — INCREMENTAL TRAINING PIPELINE")
    print("=" * 70)

    # 1. Load config
    config = load_config(args.config_path)
    print(f"\nConfig loaded. Version: {config.get('version', '?')}")

    # 2. Load dataset & enrich trajectory features
    print("\n" + "=" * 70)
    print("STEP 1: LOADING DATASET & TRAJECTORY ENRICHMENT")
    print("=" * 70)
    df = load_master_csv(args.csv_path, config)

    # 3. Validate dataset
    print("\n" + "=" * 70)
    print("STEP 2: DATA VALIDATION")
    print("=" * 70)
    report = validate_dataset(df)
    print_validation_report(report)
    if not check_minimum_requirements(report):
        print("\n[ERROR] Dataset does not meet minimum requirements. Aborting.")
        sys.exit(1)

    # 4. Validate features
    print("\n" + "=" * 70)
    print("STEP 3: FEATURE VALIDATION")
    print("=" * 70)
    available, missing = validate_features(df)
    print(f"Available features: {len(available)}")
    if missing:
        print(f"Missing features (will be handled): {missing}")

    # 5. Generate incremental targets
    print("\n" + "=" * 70)
    print("STEP 4: INCREMENTAL TARGET GENERATION")
    print("=" * 70)
    df = generate_all_targets(df, config)

    # Report target availability
    target_summary = report_target_availability(df, config)
    print("\n--- Incremental Target Availability Summary ---")
    for horizon, info in target_summary.items():
        print(f"\n  {horizon}:")
        for target_type, details in info.items():
            print(f"    {target_type}: {details}")

    # Save training datasets
    save_training_datasets(df, config)

    # 6. Train incremental cost models
    print("\n" + "=" * 70)
    print("STEP 5: TRAINING INCREMENTAL COST MODELS")
    print("=" * 70)
    cost_results = train_cost_models(df, config)

    # 7. Train incremental schedule models
    print("\n" + "=" * 70)
    print("STEP 6: TRAINING INCREMENTAL SCHEDULE MODELS")
    print("=" * 70)
    time_results = train_time_models(df, config)

    # 8. Save all metrics
    print("\n" + "=" * 70)
    print("STEP 7: SAVING METRICS")
    print("=" * 70)
    all_results = {**cost_results, **time_results}
    save_metrics(all_results)

    # 9. Generate SHAP importance
    print("\n" + "=" * 70)
    print("STEP 8: GENERATING SHAP FEATURE IMPORTANCE")
    print("=" * 70)
    generate_shap_importance(df, config)

    # 10. Save metadata
    print("\n" + "=" * 70)
    print("STEP 9: SAVING MODEL METADATA")
    print("=" * 70)
    save_model_metadata(config, cost_results, time_results, df)

    print("\n" + "=" * 70)
    print("[OK] INCREMENTAL TRAINING PIPELINE COMPLETE")
    print("=" * 70)
    print(f"\nModels saved to: {Path(__file__).parent / config['output']['models_dir']}")
    print(f"Results saved to: {Path(__file__).parent / config['output']['results_dir']}")
    print(f"\nTo run predictions:")
    print(f"  python predict.py --project_id <PROJECT_ID>")
    print(f"\nTo launch Streamlit UI:")
    print(f"  streamlit run app/streamlit_app.py")


if __name__ == "__main__":
    main()
