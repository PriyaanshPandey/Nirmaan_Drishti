"""
Data loader for PAIMANA Master CSV.

Loads the project-month dataset, parses dates, sorts chronologically,
and enriches trajectory features without temporal leakage.
Never modifies the source CSV.
"""

import os
import pandas as pd
import yaml
from pathlib import Path
from src.feature_selection import enrich_trajectory_features


def load_config(config_path: str = None) -> dict:
    """Load configuration from YAML file."""
    if config_path is None:
        config_path = Path(__file__).parent.parent / "config" / "config.yaml"
    with open(config_path, "r") as f:
        return yaml.safe_load(f)


def load_master_csv(csv_path: str = None, config: dict = None) -> pd.DataFrame:
    """
    Load the PAIMANA Master CSV and compute trajectory features.

    Parameters
    ----------
    csv_path : str, optional
        Path to the CSV file. If None, uses the config default.
    config : dict, optional
        Configuration dict. Loaded from default if None.

    Returns
    -------
    pd.DataFrame
        Loaded, sorted dataframe with parsed dates and trajectory features.
    """
    if config is None:
        config = load_config()

    if csv_path is None:
        project_root = Path(__file__).parent.parent
        csv_path = project_root / config["data"]["default_csv_path"]

    csv_path = Path(csv_path)

    if not csv_path.exists():
        raise FileNotFoundError(f"CSV file not found: {csv_path}")

    print(f"Loading dataset from: {csv_path}")
    df = pd.read_csv(csv_path)

    if df.empty:
        raise ValueError("CSV file is empty.")

    # Check critical columns
    critical_cols = ["project_id", "report_month"]
    missing_critical = [c for c in critical_cols if c not in df.columns]
    if missing_critical:
        raise ValueError(f"Missing critical columns: {missing_critical}")

    # Parse report_month as datetime
    df["report_month"] = pd.to_datetime(df["report_month"])

    # Parse date columns if present
    date_cols = ["approval_start", "original_target_doc", "revised_doc"]
    for col in date_cols:
        if col in df.columns:
            df[col] = pd.to_datetime(df[col], errors="coerce")

    # Sort by project_id and report_month
    df = df.sort_values(["project_id", "report_month"]).reset_index(drop=True)

    # Enrich trajectory features strictly from past data
    df = enrich_trajectory_features(df)

    print(f"Loaded {len(df)} rows, {df['project_id'].nunique()} unique projects")
    print(f"Report months: {df['report_month'].min().strftime('%Y-%m')} to {df['report_month'].max().strftime('%Y-%m')}")

    return df
