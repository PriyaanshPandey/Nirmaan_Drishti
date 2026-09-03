"""
SHAP explainability for PAIMANA ML models.

Generates per-prediction SHAP explanations using TreeExplainer.
All explanations come from the actual model — never from an LLM.
"""

import numpy as np
import shap
from typing import Dict, Any, List, Optional


def get_shap_explanation(model, X: np.ndarray, feature_names: List[str],
                         top_n: int = 10) -> Dict[str, Any]:
    """
    Generate SHAP explanation for a single prediction.

    Parameters
    ----------
    model : fitted model
        XGBoost model (classifier or regressor).
    X : np.ndarray
        Single-row feature matrix (1, n_features).
    feature_names : list
        Feature names matching the columns.
    top_n : int
        Number of top drivers to return.

    Returns
    -------
    dict
        Explanation with top positive/negative drivers and all contributions.
    """
    explainer = shap.TreeExplainer(model)
    shap_values = explainer.shap_values(X)

    # For binary classifier, shap_values may be 2D
    if isinstance(shap_values, list):
        # Take positive class
        sv = shap_values[1][0] if len(shap_values) > 1 else shap_values[0][0]
    elif len(shap_values.shape) == 2:
        sv = shap_values[0]
    else:
        sv = shap_values

    # Build feature contributions
    contributions = []
    for i, fname in enumerate(feature_names):
        if i < len(sv):
            contributions.append({
                "feature": fname,
                "shap_value": round(float(sv[i]), 4),
            })

    # Sort by absolute SHAP value
    contributions.sort(key=lambda x: abs(x["shap_value"]), reverse=True)

    # Top positive (risk drivers)
    positive_drivers = [c for c in contributions if c["shap_value"] > 0][:top_n]

    # Top negative (protective factors)
    negative_drivers = [c for c in contributions if c["shap_value"] < 0]
    negative_drivers.sort(key=lambda x: x["shap_value"])
    negative_drivers = negative_drivers[:top_n]

    return {
        "top_risk_drivers": positive_drivers,
        "top_protective_factors": negative_drivers,
        "all_contributions": contributions[:top_n * 2],
        "base_value": round(float(explainer.expected_value if np.isscalar(explainer.expected_value)
                                  else explainer.expected_value[1] if len(explainer.expected_value) > 1
                                  else explainer.expected_value[0]), 4),
    }


def get_global_feature_importance(model, X: np.ndarray,
                                  feature_names: List[str],
                                  max_samples: int = 500) -> Dict[str, float]:
    """
    Compute global SHAP feature importance.

    Parameters
    ----------
    model : fitted model
        XGBoost model.
    X : np.ndarray
        Feature matrix (can be subset of training data).
    feature_names : list
        Feature names.
    max_samples : int
        Max samples for SHAP computation.

    Returns
    -------
    dict
        {feature_name: mean_abs_shap_value} sorted descending.
    """
    if len(X) > max_samples:
        indices = np.random.RandomState(42).choice(len(X), max_samples, replace=False)
        X_sample = X[indices]
    else:
        X_sample = X

    explainer = shap.TreeExplainer(model)
    shap_values = explainer.shap_values(X_sample)

    if isinstance(shap_values, list):
        sv = shap_values[1] if len(shap_values) > 1 else shap_values[0]
    else:
        sv = shap_values

    mean_abs = np.mean(np.abs(sv), axis=0)

    importance = {}
    for i, fname in enumerate(feature_names):
        if i < len(mean_abs):
            importance[fname] = round(float(mean_abs[i]), 4)

    # Sort descending
    importance = dict(sorted(importance.items(), key=lambda x: x[1], reverse=True))

    return importance


def save_feature_importance(importance: Dict[str, float],
                            model_name: str,
                            output_path: str) -> None:
    """Save feature importance to CSV."""
    import pandas as pd
    from pathlib import Path

    rows = [{"model": model_name, "feature": k, "mean_abs_shap": v}
            for k, v in importance.items()]
    df = pd.DataFrame(rows)

    path = Path(output_path)
    if path.exists():
        existing = pd.read_csv(path)
        df = pd.concat([existing, df], ignore_index=True)

    df.to_csv(path, index=False)
