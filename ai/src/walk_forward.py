"""
Walk-forward cross-validation for PAIMANA ML models.

Creates chronological expanding-window folds that ensure:
1. Training data is always before validation data.
2. Every validation target is actually observable in the dataset.
3. No future information leaks into training.
"""

import pandas as pd
import numpy as np
from typing import List, Tuple, Dict, Any


def generate_walk_forward_folds(
    df: pd.DataFrame,
    horizon_months: int,
    target_col: str,
    min_train_rows: int = 50,
    min_positive: int = 5,
    min_negative: int = 5,
) -> List[Dict[str, Any]]:
    """
    Generate chronological walk-forward folds with expanding training windows.

    For each fold:
    - Training: all rows with report_month <= cutoff AND valid target
    - Validation: rows with report_month == val_month AND valid target
    - Both train and validation targets must be observable in the dataset (not NaN).
    """
    valid_mask = df[target_col].notna()
    valid_df = df[valid_mask].copy()

    if len(valid_df) == 0:
        print(f"[WARNING] No valid targets for {target_col}. Cannot create folds.")
        return []

    all_months = sorted(df["report_month"].unique())

    # Determine validation months with observable future target
    valid_val_months = []
    for m in all_months:
        target_month = m + pd.DateOffset(months=horizon_months)
        if target_month in all_months:
            valid_val_months.append(m)

    if len(valid_val_months) < 2:
        print(f"[WARNING] Too few valid validation months for {horizon_months}M horizon.")
        return []

    folds = []
    fold_num = 0

    for val_idx_in_list in range(1, len(valid_val_months)):
        val_month = valid_val_months[val_idx_in_list]
        train_cutoff = valid_val_months[val_idx_in_list - 1]

        # Training: report_month <= train_cutoff AND valid target
        train_mask = (df["report_month"] <= train_cutoff) & valid_mask
        train_indices = df[train_mask].index.values

        # Validation: report_month == val_month AND valid target
        val_mask = (df["report_month"] == val_month) & valid_mask
        val_indices = df[val_mask].index.values

        if len(train_indices) < min_train_rows:
            continue

        if len(val_indices) == 0:
            continue

        # Check class balance in training (for classification targets)
        train_targets = df.loc[train_indices, target_col]
        if train_targets.nunique() < 2:
            continue

        is_classification = set(train_targets.dropna().unique()).issubset({0, 1, 0.0, 1.0})
        if is_classification:
            pos_count = int((train_targets == 1).sum())
            neg_count = int((train_targets == 0).sum())
            if pos_count < min_positive or neg_count < min_negative:
                continue

        fold_num += 1
        target_obs_month = val_month + pd.DateOffset(months=horizon_months)

        folds.append({
            "fold_num": fold_num,
            "train_indices": train_indices,
            "val_indices": val_indices,
            "train_cutoff": train_cutoff,
            "val_month": val_month,
            "val_target_month": target_obs_month,
            "n_train": len(train_indices),
            "n_val": len(val_indices),
            "train_months": f"{df.loc[train_indices, 'report_month'].min().strftime('%Y-%m')} to {train_cutoff.strftime('%Y-%m')}",
            "val_month_str": val_month.strftime("%Y-%m"),
            "target_observed_str": target_obs_month.strftime("%Y-%m"),
        })

    return folds


def print_fold_summary(folds: List[Dict[str, Any]], title: str = "Walk-Forward Folds") -> None:
    """Print clean summary of walk-forward folds."""
    print(f"\n{'=' * 60}")
    print(f"Walk-Forward Folds: {title}")
    print(f"{'=' * 60}")
    print(f"  Total folds: {len(folds)}")

    for fold in folds:
        print(f"\n  Fold {fold['fold_num']}:")
        print(f"    Train: {fold['train_months']} ({fold['n_train']} rows)")
        print(f"    Val:   {fold['val_month_str']} ({fold['n_val']} rows)")
        print(f"    Target observed at: {fold['target_observed_str']}")
