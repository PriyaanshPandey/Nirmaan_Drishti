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
        # Auto-combine tracked constituent CSVs if the 110MB master is omitted from git
        p1 = csv_path.parent / "New_data_2011-jun25.csv"
        p2 = csv_path.parent / "New_data_july2025-may26.csv"
        if p1.exists() and p2.exists():
            print(f"Combining {p1.name} and {p2.name} into {csv_path}...")
            df1 = pd.read_csv(p1, dtype={"project_id": str}, low_memory=False)
            df2 = pd.read_csv(p2, dtype={"project_id": str}, low_memory=False)
            combined = pd.concat([df1, df2], ignore_index=True)
            csv_path.parent.mkdir(parents=True, exist_ok=True)
            combined.to_csv(csv_path, index=False)
        else:
            raise FileNotFoundError(f"CSV file not found: {csv_path}")

    print(f"Loading dataset from: {csv_path}")
    df = pd.read_csv(csv_path, dtype={"project_id": str}, low_memory=False)

    if df.empty:
        raise ValueError("CSV file is empty.")

    # Check critical columns
    critical_cols = ["project_id", "report_month"]
    missing_critical = [c for c in critical_cols if c not in df.columns]
    if missing_critical:
        raise ValueError(f"Missing critical columns: {missing_critical}")

    # Parse report_month as datetime and standardize project_id as str
    df["project_id"] = df["project_id"].astype(str).str.strip()
    df["report_month"] = pd.to_datetime(df["report_month"], format="mixed", dayfirst=True)

    # Parse date columns if present
    date_cols = ["approval_start", "original_target_doc", "revised_doc"]
    for col in date_cols:
        if col in df.columns:
            df[col] = pd.to_datetime(df[col], errors="coerce", format="mixed", dayfirst=True)

    # Sort by project_id and report_month
    df = df.sort_values(["project_id", "report_month"]).reset_index(drop=True)

    # Enrich trajectory features strictly from past data
    df = enrich_trajectory_features(df)

    print(f"Loaded {len(df)} rows, {df['project_id'].nunique()} unique projects")
    print(f"Report months: {df['report_month'].min().strftime('%Y-%m')} to {df['report_month'].max().strftime('%Y-%m')}")

    return df
