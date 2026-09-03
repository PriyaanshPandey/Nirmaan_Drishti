"""
Script to inspect raw datasets in data/raw/ and report stats.
"""
import os
import pandas as pd
from pathlib import Path

DATA_RAW_DIR = Path(__file__).resolve().parent.parent.parent / "data" / "raw"

def inspect():
    print(f"Inspecting files in {DATA_RAW_DIR}:")
    files = list(DATA_RAW_DIR.glob("*.csv")) + list(DATA_RAW_DIR.glob("*.xlsx"))
    for f in sorted(files):
        print(f"\n{'='*60}")
        print(f"FILE: {f.name} ({f.stat().st_size:,} bytes)")
        print(f"{'='*60}")
        try:
            if f.suffix == ".csv":
                df = pd.read_csv(f, low_memory=False)
            else:
                df = pd.read_excel(f)
            print(f"Shape: {df.shape[0]} rows x {df.shape[1]} columns")
            print("\nColumns and non-null counts:")
            for col in df.columns:
                dtype = str(df[col].dtype)
                nulls = df[col].isnull().sum()
                sample = df[col].dropna().iloc[0] if not df[col].dropna().empty else "ALL NULL"
                print(f" - {col:<35} | {dtype:<10} | Nulls: {nulls:<6} | Sample: {str(sample)[:40]}")
            if "project_id" in df.columns:
                print(f"\nUnique project_ids: {df['project_id'].nunique()}")
            if "report_month" in df.columns:
                print(f"Unique report_months: {sorted(df['report_month'].dropna().unique())}")
        except Exception as e:
            print(f"Error reading {f.name}: {e}")

if __name__ == "__main__":
    inspect()
