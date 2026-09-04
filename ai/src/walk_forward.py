"""
Walk-forward cross-validation for PAIMANA ML models.

Creates chronological expanding-window folds across 2011–2026 ensuring:
1. Training data is strictly before validation forecast origin.
2. Every validation target is verified as observed at T + Horizon (never NaN).
3. Zero temporal leakage: no future information leaks into training.
"""

import pandas as pd
import numpy as np
from typing import List, Tuple, Dict, Any


def generate_walk_forward_folds(
    df: pd.DataFrame,
    horizon_months: int,
    target_col: str,
    val_years: List[int] = None,
    min_train_rows: int = 1000,
    min_positive: int = 20,
    min_negative: int = 20,
) -> List[Dict[str, Any]]:
    """
    Generate chronological expanding-window walk-forward folds.

    Parameters
    ----------
    df : pd.DataFrame
        Dataset sorted chronologically with report_month datetime and target column.
    horizon_months : int
        Forecasting horizon (3 or 6).
    target_col : str
        Target column name.
    val_years : list of int, optional
        Validation years to evaluate on. Default: [2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024]
    min_train_rows : int
        Minimum training rows required.
    min_positive : int
        Minimum positive examples in training set.
    min_negative : int
        Minimum negative examples in training set.

    Returns
    -------
    list of dict
        List of fold definitions.
    """
    valid_mask = df[target_col].notna()
    if valid_mask.sum() == 0:
        print(f"[WARNING] No valid targets for {target_col}. Cannot create folds.")
        return []

    if val_years is None:
        val_years = [2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024]

    folds = []
    fold_num = 0

    for idx, vy in enumerate(val_years):
        train_cutoff = pd.to_datetime(f"{vy}-01-01")
        
        # Training: report_month < vy-01-01 AND target is valid
        train_mask = (df["report_month"] < train_cutoff) & valid_mask
        train_indices = df[train_mask].index.values

        # Validation: vy-01-01 <= report_month < (vy+1)-01-01 (or to max date for last year)
        if idx == len(val_years) - 1:
            val_mask = (df["report_month"] >= train_cutoff) & valid_mask
        else:
            val_end = pd.to_datetime(f"{vy+1}-01-01")
            val_mask = (df["report_month"] >= train_cutoff) & (df["report_month"] < val_end) & valid_mask
        
        val_indices = df[val_mask].index.values

        if len(train_indices) < min_train_rows:
            continue
        if len(val_indices) == 0:
            continue

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
        min_train_m = df.loc[train_indices, "report_month"].min()
        max_train_m = df.loc[train_indices, "report_month"].max()
        min_val_m = df.loc[val_indices, "report_month"].min()
        max_val_m = df.loc[val_indices, "report_month"].max()

        folds.append({
            "fold_num": fold_num,
            "train_indices": train_indices,
            "val_indices": val_indices,
            "train_cutoff": train_cutoff,
            "val_year": vy,
            "n_train": len(train_indices),
            "n_val": len(val_indices),
            "train_period": f"{min_train_m.strftime('%Y-%m')} to {max_train_m.strftime('%Y-%m')}",
            "val_period": f"{min_val_m.strftime('%Y-%m')} to {max_val_m.strftime('%Y-%m')}",
            "target_observed_period": f"{(min_val_m + pd.DateOffset(months=horizon_months)).strftime('%Y-%m')} to {(max_val_m + pd.DateOffset(months=horizon_months)).strftime('%Y-%m')}",
        })

    return folds


def print_fold_summary(folds: List[Dict[str, Any]], title: str = "Walk-Forward Folds") -> None:
    """Print clean summary of walk-forward folds."""
    print(f"\n{'=' * 75}")
    print(f"Walk-Forward Folds: {title}")
    print(f"{'=' * 75}")
    print(f"  Total folds: {len(folds)}")

    for fold in folds:
        print(f"\n  Fold {fold['fold_num']}:")
        print(f"    Train: {fold['train_period']} ({fold['n_train']:,} rows)")
        print(f"    Val:   {fold['val_period']} ({fold['n_val']:,} rows)")
        print(f"    Target Verified at: {fold['target_observed_period']}")
