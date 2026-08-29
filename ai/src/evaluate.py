"""
Evaluation metrics for PAIMANA ML models.

Computes classification and regression metrics,
supports per-fold and aggregated reporting.
"""

import numpy as np
import pandas as pd
from sklearn.metrics import (
    roc_auc_score, average_precision_score, precision_score, recall_score,
    f1_score, confusion_matrix, brier_score_loss, mean_absolute_error,
    mean_squared_error, r2_score, median_absolute_error
)
from typing import Dict, List, Any, Optional
from pathlib import Path


def evaluate_classifier(y_true: np.ndarray, y_pred_proba: np.ndarray,
                        threshold: float = 0.5) -> Dict[str, Any]:
    """
    Evaluate a binary classifier.

    Parameters
    ----------
    y_true : array
        True binary labels.
    y_pred_proba : array
        Predicted probabilities for the positive class.
    threshold : float
        Classification threshold.

    Returns
    -------
    dict
        Metrics dictionary.
    """
    y_pred = (y_pred_proba >= threshold).astype(int)

    metrics = {}

    try:
        metrics["roc_auc"] = round(float(roc_auc_score(y_true, y_pred_proba)), 4)
    except (ValueError, TypeError):
        metrics["roc_auc"] = None

    try:
        metrics["pr_auc"] = round(float(average_precision_score(y_true, y_pred_proba)), 4)
    except (ValueError, TypeError):
        metrics["pr_auc"] = None

    metrics["precision"] = round(float(precision_score(y_true, y_pred, zero_division=0)), 4)
    metrics["recall"] = round(float(recall_score(y_true, y_pred, zero_division=0)), 4)
    metrics["f1"] = round(float(f1_score(y_true, y_pred, zero_division=0)), 4)
    metrics["brier_score"] = round(float(brier_score_loss(y_true, y_pred_proba)), 4)

    cm = confusion_matrix(y_true, y_pred)
    metrics["confusion_matrix"] = cm.tolist()

    metrics["total_samples"] = int(len(y_true))
    metrics["positive_count"] = int(y_true.sum())
    metrics["negative_count"] = int(len(y_true) - y_true.sum())
    metrics["threshold"] = threshold

    return metrics


def evaluate_regressor(y_true: np.ndarray, y_pred: np.ndarray) -> Dict[str, Any]:
    """
    Evaluate a regressor.

    Parameters
    ----------
    y_true : array
        True values.
    y_pred : array
        Predicted values.

    Returns
    -------
    dict
        Metrics dictionary.
    """
    metrics = {
        "mae": round(float(mean_absolute_error(y_true, y_pred)), 4),
        "medae": round(float(median_absolute_error(y_true, y_pred)), 4),
        "rmse": round(float(np.sqrt(mean_squared_error(y_true, y_pred))), 4),
        "r2": round(float(r2_score(y_true, y_pred)), 4),
        "total_samples": int(len(y_true)),
        "y_true_mean": round(float(np.mean(y_true)), 4),
        "y_true_std": round(float(np.std(y_true)), 4),
        "y_pred_mean": round(float(np.mean(y_pred)), 4),
    }
    return metrics


def aggregate_fold_metrics(fold_metrics: List[Dict[str, Any]]) -> Dict[str, Any]:
    """
    Aggregate metrics across walk-forward folds.

    Returns mean and std for each numeric metric.
    """
    if not fold_metrics:
        return {}

    aggregated = {}
    keys = [k for k in fold_metrics[0].keys() if k != "confusion_matrix"]

    for key in keys:
        values = [f[key] for f in fold_metrics if f.get(key) is not None and not np.isnan(f.get(key, np.nan))]
        if values and isinstance(values[0], (int, float, np.number)):
            aggregated[f"{key}_mean"] = round(float(np.mean(values)), 4)
            aggregated[f"{key}_std"] = round(float(np.std(values)), 4)
            aggregated[f"{key}_min"] = round(float(np.min(values)), 4)
            aggregated[f"{key}_max"] = round(float(np.max(values)), 4)

    aggregated["n_folds"] = len(fold_metrics)
    return aggregated


def print_metrics(metrics: Dict[str, Any], title: str = "Evaluation Metrics") -> None:
    """Pretty-print metrics."""
    print(f"\n  {title}")
    print("  " + "-" * 40)
    for k, v in metrics.items():
        if k == "confusion_matrix":
            print(f"    {k:<25} {v}")
        elif isinstance(v, float):
            print(f"    {k:<25} {v:.4f}")
        elif isinstance(v, (int, str)):
            print(f"    {k:<25} {v}")


def print_comparison(baseline: Dict, xgb: Dict, model_name: str) -> None:
    """Print side-by-side comparison between baseline and XGBoost."""
    print(f"\n{'=' * 60}")
    print(f"COMPARISON: {model_name}")
    print(f"{'=' * 60}")
    print(f"  {'Metric':<28} {'Baseline':>10} {'XGBoost':>12} {'Diff':>10}")
    print(f"  {'-' * 60}")

    all_keys = sorted(set(list(baseline.keys()) + list(xgb.keys())))
    for k in all_keys:
        if k in ("confusion_matrix", "n_folds"):
            continue
        b_val = baseline.get(k, None)
        x_val = xgb.get(k, None)
        if b_val is not None and x_val is not None and isinstance(b_val, (int, float)) and isinstance(x_val, (int, float)):
            diff = x_val - b_val
            sign = "+" if diff > 0 else ""
            print(f"  {k:<28} {b_val:>10.4f} {x_val:>12.4f} {sign}{diff:>9.4f}")


def save_metrics(results: Dict[str, Any], output_dir: str = None) -> None:
    """Save all evaluation metrics to CSV and JSON."""
    if output_dir is None:
        output_dir = Path(__file__).parent.parent / "results"
    output_dir = Path(output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    summary_rows = []
    per_fold_rows = []

    for name, result in results.items():
        if isinstance(result, dict) and "aggregated" in result:
            row = {"model": name}
            row.update(result["aggregated"])
            summary_rows.append(row)

        if isinstance(result, dict) and "folds" in result:
            for i, fold in enumerate(result["folds"]):
                f_row = {"model": name, "fold": i + 1}
                for k, v in fold.items():
                    if k != "confusion_matrix" and isinstance(v, (int, float)):
                        f_row[k] = v
                per_fold_rows.append(f_row)

    if summary_rows:
        summary_df = pd.DataFrame(summary_rows)
        path = output_dir / "model_metrics.csv"
        summary_df.to_csv(path, index=False)
        print(f"Metrics saved to: {path}")

    if per_fold_rows:
        fold_df = pd.DataFrame(per_fold_rows)
        path = output_dir / "model_metrics_per_fold.csv"
        fold_df.to_csv(path, index=False)
        print(f"Per-fold metrics saved to: {path}")
