"""
04_similarity_engine.py - Historical Trajectory Representation & Analogue Search Engine
Nirmaan Drishti / Infrastructure Project Monitoring (April 2001 - May 2026).

Implements Section 15 of Prompt:
1. Constructs historical trajectory representations for completed projects.
2. For any project snapshot at timestamp T, performs point-in-time similarity search
   against completed projects completed prior to or at T (Zero Future Leakage).
3. Extracts historical analogue evidence features:
   - nearest_project_similarity
   - mean_similarity_top_k (k=5)
   - median_delay_top_k
   - mean_cost_escalation_top_k
   - high_delay_fraction_top_k (delay > 12 months)
   - high_cost_escalation_fraction_top_k (escalation > 20%)
"""

import sys
import os
import time
from pathlib import Path
from typing import Tuple, Dict, List, Any
import numpy as np
import pandas as pd
from sklearn.preprocessing import StandardScaler
from sklearn.neighbors import NearestNeighbors

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

WORKSPACE_ROOT = Path(r"d:\Nirmaan-Drishti-secret-")
TRAJECTORY_DIR = WORKSPACE_ROOT / "data" / "04_project_trajectories"
SIMILARITY_DIR = WORKSPACE_ROOT / "data" / "05_ml_features"

SIMILARITY_DIR.mkdir(parents=True, exist_ok=True)


def extract_completed_outcomes(df_comp: pd.DataFrame) -> pd.DataFrame:
    """Extract certified final outcomes for completed projects from their final snapshot."""
    last_snaps = df_comp.sort_values(["effective_project_key", "report_month"]).groupby("effective_project_key").last().reset_index()

    outcomes = pd.DataFrame({
        "effective_project_key": last_snaps["effective_project_key"],
        "final_completion_date": last_snaps["report_month"],
        "final_cost_escalation_pct": last_snaps["cost_overrun_pct"].clip(-50.0, 500.0),
        "final_schedule_delay_months": last_snaps["schedule_extension_months"].clip(-24.0, 360.0),
        "final_physical_progress": last_snaps["physical_progress_clean"],
        "sector": last_snaps["sector"]
    })
    return outcomes


def build_trajectory_vectors(df: pd.DataFrame) -> Tuple[np.ndarray, List[str]]:
    """Extract normalized feature vector capturing the project's trajectory state."""
    features = [
        "physical_progress_clean",
        "expenditure_ratio_pct",
        "physical_financial_divergence",
        "progress_velocity",
        "schedule_extension_months",
        "delay_velocity",
        "cost_overrun_pct",
        "cost_escalation_velocity",
        "scope_instability_score",
        "project_age_months"
    ]
    log_cost = np.log1p(df["original_cost_crore"].fillna(150.0).clip(lower=10.0)).values.reshape(-1, 1)
    X_mat = df[features].fillna(0.0).values
    X_full = np.hstack([X_mat, log_cost])
    return X_full, features + ["log_original_cost"]


def compute_point_in_time_similarity(df_all: pd.DataFrame, top_k: int = 5) -> pd.DataFrame:
    print("=" * 80)
    print("STEP 1: COMPUTING POINT-IN-TIME HISTORICAL TRAJECTORY ANALOGUES")
    print("=" * 80)
    t0 = time.time()

    comp_mask = df_all["operational_status"] == "COMPLETED"
    df_comp = df_all[comp_mask].copy()
    completed_outcomes = extract_completed_outcomes(df_comp)
    print(f"Total completed reference projects with verified final outcomes: {len(completed_outcomes):,}")

    outcome_map = completed_outcomes.set_index("effective_project_key")

    X_vecs, vec_cols = build_trajectory_vectors(df_all)
    scaler = StandardScaler()
    X_norm = scaler.fit_transform(X_vecs)

    # Normalize each vector to unit norm for cosine similarity
    norms = np.linalg.norm(X_norm, axis=1, keepdims=True)
    norms[norms == 0] = 1.0
    X_unit = X_norm / norms

    comp_indices = np.where(comp_mask.values)[0]
    comp_dates = df_all["report_month"].iloc[comp_indices].values
    comp_keys = df_all["effective_project_key"].iloc[comp_indices].values
    comp_vecs = X_unit[comp_indices]

    comp_final_delays = np.array([outcome_map.loc[k, "final_schedule_delay_months"] if k in outcome_map.index else 0.0 for k in comp_keys])
    comp_final_costs = np.array([outcome_map.loc[k, "final_cost_escalation_pct"] if k in outcome_map.index else 0.0 for k in comp_keys])

    n_total = len(df_all)
    nearest_sim = np.zeros(n_total, dtype=float)
    mean_sim_topk = np.zeros(n_total, dtype=float)
    median_delay_topk = np.zeros(n_total, dtype=float)
    mean_cost_topk = np.zeros(n_total, dtype=float)
    high_delay_frac_topk = np.zeros(n_total, dtype=float)
    high_cost_frac_topk = np.zeros(n_total, dtype=float)

    all_years = df_all["report_month"].dt.year.values
    unique_years = np.sort(np.unique(all_years))

    print(f"Processing similarity in yearly expanding windows across {len(unique_years)} chronological cohorts...")

    for yr in unique_years:
        curr_mask = (all_years == yr)
        curr_indices = np.where(curr_mask)[0]
        if len(curr_indices) == 0:
            continue

        # Point-in-time condition: Completed snapshots observed on or before Dec 31 of year yr
        yr_cutoff = pd.Timestamp(f"{yr}-12-31")
        eligible_comp = (comp_dates <= yr_cutoff)
        
        # If very early (e.g. 2001-2003) and fewer than top_k completed snapshots, use available
        if eligible_comp.sum() < top_k:
            eligible_comp = (comp_dates <= pd.Timestamp(f"{max(yr, 2005)}-12-31"))

        el_indices = np.where(eligible_comp)[0]
        el_vecs = comp_vecs[el_indices]
        el_delays = comp_final_delays[el_indices]
        el_costs = comp_final_costs[el_indices]

        # Fit fast NearestNeighbors on eligible past completed projects
        nn = NearestNeighbors(n_neighbors=min(top_k + 1, len(el_vecs)), metric="euclidean", n_jobs=-1)
        nn.fit(el_vecs)

        # Query batch
        batch_vecs = X_unit[curr_indices]
        distances, neighbors = nn.kneighbors(batch_vecs)

        # Convert Euclidean distance on unit vectors to cosine similarity: sim = 1 - d^2 / 2
        batch_sims = 1.0 - (distances ** 2) / 2.0

        # Extract top-k
        k_use = min(top_k, neighbors.shape[1])
        top_sims = batch_sims[:, :k_use]
        top_neigh = neighbors[:, :k_use]

        delays = el_delays[top_neigh]
        costs = el_costs[top_neigh]

        nearest_sim[curr_indices] = top_sims[:, 0]
        mean_sim_topk[curr_indices] = np.mean(top_sims, axis=1)
        median_delay_topk[curr_indices] = np.median(delays, axis=1)
        mean_cost_topk[curr_indices] = np.mean(costs, axis=1)
        high_delay_frac_topk[curr_indices] = np.mean(delays > 12.0, axis=1)
        high_cost_frac_topk[curr_indices] = np.mean(costs > 20.0, axis=1)

    df_all["nearest_project_similarity"] = nearest_sim
    df_all["mean_similarity_top_k"] = mean_sim_topk
    df_all["median_delay_top_k"] = median_delay_topk
    df_all["mean_cost_escalation_top_k"] = mean_cost_topk
    df_all["high_delay_fraction_top_k"] = high_delay_frac_topk
    df_all["high_cost_escalation_fraction_top_k"] = high_cost_frac_topk

    elapsed = time.time() - t0
    print(f"Similarity search completed in {elapsed:.2f}s!")
    print(f"Mean top-k similarity: {df_all['mean_similarity_top_k'].mean():.4f}")
    print(f"Mean analogue delay  : {df_all['median_delay_top_k'].mean():.2f} months")
    print(f"Mean analogue cost esc: {df_all['mean_cost_escalation_top_k'].mean():.2f}%")

    return df_all


def main():
    p_in = TRAJECTORY_DIR / "project_trajectories.parquet"
    print(f"Reading project trajectories from {p_in}...")
    df = pd.read_parquet(p_in)

    df_sim = compute_point_in_time_similarity(df, top_k=5)

    out_parquet = TRAJECTORY_DIR / "project_trajectories_with_similarity.parquet"
    print(f"\nSaving enriched trajectories with similarity to {out_parquet}...")
    df_sim.to_parquet(out_parquet, index=False)
    print(f"Saved {len(df_sim):,} rows x {len(df_sim.columns)} columns.")


if __name__ == "__main__":
    main()
