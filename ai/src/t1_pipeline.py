"""
t1_pipeline.py - Core Next-Period (T+1) Prediction Data Pipeline for Nirmaan Drishti.

Implements:
1. Chronological project observation sorting.
2. Next-period (T+1) future target derivation:
   - future_schedule_delay(T): 1 if schedule_extension_months(T+1) >= 1.0 or schedule_slippage(T+1) >= 1.0 else 0
   - future_cost_overrun(T): 1 if cumulative_expenditure_cr(T+1) > original_cost_cr(T) else 0
3. Strict zero-leakage verification:
   - Asserts NO target or future T+1 fields enter feature matrix X(T).
4. Strict chronological partitioning:
   - TRAIN: April 2001 to December 2022
   - VAL  : January 2023 to June 2024
   - TEST : July 2024 to April 2026
   - CURRENT INFERENCE: May 2026
   - Guarantee: max(train) < min(val) < max(val) < min(test) < min(inference)
"""

import sys
import json
from pathlib import Path
from typing import Tuple, Dict, List, Any
import numpy as np
import pandas as pd
from sklearn.base import BaseEstimator, RegressorMixin, clone
from sklearn.linear_model import Ridge
from sklearn.model_selection import TimeSeriesSplit
from sklearn.compose import ColumnTransformer
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler, OneHotEncoder
from sklearn.impute import SimpleImputer

WORKSPACE_ROOT = Path(__file__).resolve().parent.parent.parent
DATA_DIR = WORKSPACE_ROOT / "data"
ML_DIR = DATA_DIR / "05_ml_features"
TRAJECTORY_PARQUET = DATA_DIR / "04_project_trajectories" / "project_trajectories_with_similarity.parquet"


def load_canonical_trajectory_data() -> pd.DataFrame:
    """
    Loads full trajectory panel. Prefers data/05_ml_features/ Parquet splits which
    contain all 201 engineered features, or falls back to data/04_project_trajectories/.
    """
    tr_path = ML_DIR / "train.parquet"
    va_path = ML_DIR / "val.parquet"
    te_path = ML_DIR / "test.parquet"

    if tr_path.exists() and va_path.exists() and te_path.exists():
        print(f"Loading full canonical panel from {ML_DIR} splits...")
        df_tr = pd.read_parquet(tr_path)
        df_va = pd.read_parquet(va_path)
        df_te = pd.read_parquet(te_path)
        df = pd.concat([df_tr, df_va, df_te], ignore_index=True)
    elif TRAJECTORY_PARQUET.exists():
        print(f"Loading panel from {TRAJECTORY_PARQUET}...")
        df = pd.read_parquet(TRAJECTORY_PARQUET)
    else:
        alt_path = DATA_DIR / "04_project_trajectories" / "project_trajectories.parquet"
        print(f"Loading panel from {alt_path}...")
        df = pd.read_parquet(alt_path)

    return df

FORBIDDEN_LEAKAGE_TERMS = [
    "target", "future", "t_plus_1", "t1", "outcome", "lead",
    "next_period", "actual_completion_date", "final_cost", "final_delay",
    "cum_exp_t1", "antic_cost_t1", "rev_cost_t1"
]


def assert_zero_leakage(feature_cols: List[str]):
    """
    Automated leakage check: Raises ValueError if any target, future,
    or forward-looking column enters feature set X(T).
    """
    leaks = []
    for col in feature_cols:
        col_lower = col.lower()
        for term in FORBIDDEN_LEAKAGE_TERMS:
            if term in col_lower:
                leaks.append((col, term))
    if leaks:
        raise ValueError(
            f"[DATA LEAKAGE DETECTED] The following features violate zero-leakage policy: {leaks}"
        )


def get_t1_feature_definitions() -> Tuple[List[str], List[str]]:
    """
    Returns canonical (categorical_cols, numeric_cols) demonstrably available at or prior to observation time T.
    """
    categorical_cols = [
        "sector",
        "agency",
        "state",
        "ministry_department"
    ]

    numeric_cols = [
        # Baseline Project State at T
        "original_cost_cr",
        "revised_cost_cr",
        "anticipated_cost_cr",
        "cumulative_expenditure_cr",
        "physical_progress_pct",
        "cost_overrun_pct",
        "expenditure_ratio_pct",
        "cost_escalation_crore",
        "schedule_extension_months",
        "project_age_months",
        "remaining_duration_months",
        "remaining_work_pct",
        "expenditure_vs_original_cost",

        # Dynamic Trajectory & Velocities (<= T)
        "progress_velocity",
        "progress_velocity_3m",
        "progress_velocity_6m",
        "progress_velocity_12m",
        "progress_acceleration",
        "progress_deceleration",
        "financial_progress_velocity",
        "physical_financial_divergence",
        "absolute_progress_gap",
        "divergence_delta_3m",
        "divergence_delta_6m",
        "expenditure_velocity",
        "expenditure_growth_rate",
        "expenditure_efficiency",
        "delay_velocity",
        "cost_escalation_velocity",
        "physical_progress_delta_1m",
        "physical_progress_delta_3m",
        "physical_progress_delta_6m",
        "cost_overrun_roll_mean_3m",
        "cost_overrun_roll_mean_6m",
        "cost_overrun_roll_std_3m",
        "delay_roll_mean_3m",
        "delay_roll_mean_6m",
        "delay_roll_std_3m",
        "progress_roll_mean_3m",
        "progress_roll_mean_6m",
        "progress_roll_std_3m",
        "consecutive_stagnant_months",
        "cost_revision_count",
        "extension_count",

        # Longitudinal Schedule Dynamics (<= T)
        "delay_change_1m",
        "delay_change_3m",
        "delay_change_6m",
        "delay_trend_3m",
        "delay_trend_6m",
        "delay_acceleration",
        "delay_deceleration",
        "delay_roll_median_3m",
        "delay_roll_median_6m",
        "max_historical_delay",
        "min_historical_delay",
        "delay_volatility",
        "delay_divergence_recent_vs_longterm",
        "consecutive_increasing_delay_months",
        "consecutive_recovery_months",
        "schedule_revision_frequency",
        "extension_frequency",
        "original_doc_revision_count",
        "anticipated_doc_revision_count",
        "elapsed_duration_ratio",
        "planned_vs_observed_gap",
        "milestone_velocity",
        "milestone_stagnation_months",

        # Scope & Reporting Metrics (<= T)
        "milestone_progress_pct",
        "milestones_completed",
        "milestones_total",
        "scope_expansion_flag",
        "scope_reduction_flag",
        "scope_change_ratio",
        "milestone_revision_flag",
        "cumulative_scope_expansion",
        "scope_instability_score",
        "reporting_gap_months",
        "reporting_staleness_flag",
        "reporting_reliability_score",
        "reporting_frequency",
        "number_of_reporting_gaps",
        "snapshot_history_count",
        "historical_coverage_ratio",

        # Similarity Representations
        "nearest_project_similarity",
        "mean_similarity_top_k",
        "median_delay_top_k",
        "mean_cost_escalation_top_k",
        "high_delay_fraction_top_k",
        "high_cost_escalation_fraction_top_k",

        # Missingness Indicators (<= T)
        "missing_project_id_flag",
        "missing_revised_cost_flag",
        "missing_original_cost_flag",
        "missing_anticipated_cost_flag",
        "missing_expenditure_flag",
        "missing_progress_flag",
        "missing_original_doc_flag",
        "missing_anticipated_doc_flag",

        # Physics-Informed Slippage Dynamics (<= T)
        "schedule_progress_gap_pct",
        "elapsed_duration_pct",
        "progress_per_elapsed_month",
        "required_completion_velocity",
        "velocity_deficit",
        "imminent_slippage_flag",
        "past_doc_flag",
        "stagnant_near_deadline",
        "remaining_budget_headroom",
    ]

    # Verify zero leakage automatically
    assert_zero_leakage(categorical_cols + numeric_cols)

    return categorical_cols, numeric_cols


def add_t1_dynamic_physics_features(df: pd.DataFrame) -> pd.DataFrame:
    """
    Derives physical and financial progress urgency indicators strictly at observation time T.
    Resilient to column aliases between master CSV and trajectory Parquet.
    """
    df = df.copy()

    # Reconcile aliases
    if "original_cost_cr" not in df.columns and "original_cost_crore" in df.columns:
        df["original_cost_cr"] = df["original_cost_crore"]
    if "revised_cost_cr" not in df.columns and "revised_cost_crore" in df.columns:
        df["revised_cost_cr"] = df["revised_cost_crore"]
    if "anticipated_cost_cr" not in df.columns and "anticipated_cost_crore" in df.columns:
        df["anticipated_cost_cr"] = df["anticipated_cost_crore"]
    if "cumulative_expenditure_cr" not in df.columns and "cumulative_expenditure_crore" in df.columns:
        df["cumulative_expenditure_cr"] = df["cumulative_expenditure_crore"]

    if "remaining_duration_months" not in df.columns:
        if "revised_remaining_months" in df.columns:
            df["remaining_duration_months"] = df["revised_remaining_months"].fillna(df.get("planned_remaining_months", 12.0)).fillna(12.0)
        elif "planned_remaining_months" in df.columns:
            df["remaining_duration_months"] = df["planned_remaining_months"].fillna(12.0)
        else:
            df["remaining_duration_months"] = 12.0

    prog = df.get("physical_progress_pct", pd.Series(0.0, index=df.index)).fillna(0.0).clip(0.0, 100.0)
    rem_work = np.maximum(0.0, 100.0 - prog)
    rem_dur = df["remaining_duration_months"].fillna(12.0)
    age = df.get("project_age_months", pd.Series(1.0, index=df.index)).fillna(1.0).clip(lower=1.0)
    orig_c = df.get("original_cost_cr", pd.Series(0.0, index=df.index)).fillna(0.0)
    cum_e = df.get("cumulative_expenditure_cr", pd.Series(0.0, index=df.index)).fillna(0.0)

    # 1. Schedule Progress Gap %
    df["schedule_progress_gap_pct"] = np.maximum(0.0, rem_work - rem_dur).clip(0.0, 200.0)

    # 2. Elapsed Duration %
    total_planned = age + np.maximum(0.0, rem_dur)
    df["elapsed_duration_pct"] = (age / np.maximum(1.0, total_planned) * 100.0).clip(0.0, 300.0)

    # 3. Progress per elapsed month
    df["progress_per_elapsed_month"] = (prog / age).clip(0.0, 50.0)

    # 4. Required completion velocity
    df["required_completion_velocity"] = np.where(
        rem_dur > 0,
        rem_work / np.maximum(1.0, rem_dur),
        rem_work
    ).clip(0.0, 100.0)

    # 5. Velocity deficit
    vel = df.get("progress_velocity_6m", pd.Series(0.0, index=df.index)).fillna(0.0).clip(lower=0.0)
    df["velocity_deficit"] = df["required_completion_velocity"] - vel

    # 6. Imminent slippage & stagnancy flags
    df["imminent_slippage_flag"] = ((rem_dur <= 6.0) & (prog < 85.0)).astype(float)
    df["past_doc_flag"] = (rem_dur <= 0.0).astype(float)
    stag = df.get("consecutive_stagnant_months", pd.Series(0.0, index=df.index)).fillna(0.0)
    df["stagnant_near_deadline"] = ((rem_dur <= 12.0) & (stag >= 3)).astype(float)

    # 7. Remaining budget headroom
    df["remaining_budget_headroom"] = np.maximum(0.0, orig_c - cum_e)

    return df


def construct_t1_targets(df: pd.DataFrame) -> Tuple[pd.DataFrame, Dict[str, Any]]:
    """
    Constructs next-period T+1 classification targets:
    - future_schedule_delay: 1 if schedule_extension_months(T+1) >= 1.0 or slippage(T+1) >= 1.0 else 0
    - future_cost_overrun: 1 if cumulative_expenditure_cr(T+1) > original_cost_cr(T) else 0

    Drops rows where valid T+1 does not exist.
    """
    df = df.sort_values(["effective_project_key", "report_month"]).reset_index(drop=True)
    total_rows_before = len(df)
    unique_projects_before = df["effective_project_key"].nunique()

    grouped = df.groupby("effective_project_key", sort=False)

    # Next observation fields
    next_report_month = grouped["report_month"].shift(-1)
    next_sched_ext = grouped["schedule_extension_months"].shift(-1)
    next_cum_exp = grouped["cumulative_expenditure_cr"].shift(-1)

    # Month gap between T and T+1
    month_gap = (next_report_month.dt.year - df["report_month"].dt.year) * 12 + (next_report_month.dt.month - df["report_month"].dt.month)

    # Valid T+1 exists
    has_valid_t1 = next_report_month.notna()

    df["has_valid_t1"] = has_valid_t1
    df["month_gap_to_next"] = month_gap
    df["_next_sched_ext"] = next_sched_ext
    df["_next_cum_exp"] = next_cum_exp

    # Filter to usable T+1 dataset
    df_usable = df[has_valid_t1].copy().reset_index(drop=True)
    rows_with_valid_t1 = len(df_usable)
    rows_dropped = total_rows_before - rows_with_valid_t1
    projects_retained = df_usable["effective_project_key"].nunique()

    # Target A: future_schedule_delay
    # 1 if schedule_extension_months(T+1) >= 1.0 else 0
    df_usable["future_schedule_delay"] = (df_usable["_next_sched_ext"] >= 1.0).astype(int)

    # Target B: future_cost_overrun
    # 1 if cumulative_expenditure_cr(T+1) > original_cost_cr(T) and original_cost_cr(T) > 0 else 0
    orig_c = df_usable["original_cost_cr"]
    cum_exp_t1 = df_usable["_next_cum_exp"]

    df_usable["future_cost_overrun"] = np.where(
        cum_exp_t1.isna() | orig_c.isna() | (orig_c <= 0),
        np.nan,
        (cum_exp_t1 > orig_c).astype(float)
    )

    # Clean temporary future shift columns from usable dataframe
    df_usable = df_usable.drop(columns=["_next_sched_ext", "_next_cum_exp", "has_valid_t1"])

    pos_sched = int(df_usable["future_schedule_delay"].sum())
    rate_sched = float(df_usable["future_schedule_delay"].mean())

    cost_valid_mask = df_usable["future_cost_overrun"].notna()
    pos_cost = int(df_usable.loc[cost_valid_mask, "future_cost_overrun"].sum())
    rate_cost = float(df_usable.loc[cost_valid_mask, "future_cost_overrun"].mean())

    stats = {
        "total_rows_before": total_rows_before,
        "unique_projects_before": unique_projects_before,
        "rows_with_valid_t1": rows_with_valid_t1,
        "rows_dropped": rows_dropped,
        "projects_retained": projects_retained,
        "schedule_delay_positive_count": pos_sched,
        "schedule_delay_positive_rate": round(rate_sched, 4),
        "cost_overrun_valid_rows": int(cost_valid_mask.sum()),
        "cost_overrun_positive_count": pos_cost,
        "cost_overrun_positive_rate": round(rate_cost, 4),
    }

    return df_usable, stats


def construct_t1_regression_targets(df: pd.DataFrame) -> Tuple[pd.DataFrame, Dict[str, Any]]:
    """
    Constructs next-period T+1 continuous regression targets:
    1. Schedule:
       - future_delay_months: schedule_extension_months(T+1) [Direct Formulation]
       - target_delta_delay_months: schedule_extension_months(T+1) - schedule_extension_months(T) [Delta Formulation]
    2. Cost (Unified Scale-Invariant Architecture):
       - target_cost_multiplier: anticipated_cost_cr(T+1) / original_cost_cr(T)
       - future_anticipated_cost: anticipated_cost_cr(T+1)
       - target_future_cost_overrun_pct: (anticipated_cost_cr(T+1) - original_cost_cr(T)) / original_cost_cr(T) * 100.0

    Also reports transition gap analysis (exact 1-month vs multi-month gaps).
    """
    df = df.sort_values(["effective_project_key", "report_month"]).reset_index(drop=True)
    total_rows_before = len(df)
    unique_projects_before = df["effective_project_key"].nunique()

    # Reconcile anticipated_cost and original_cost aliases if not already done
    if "anticipated_cost_cr" not in df.columns:
        if "anticipated_cost_crore" in df.columns:
            df["anticipated_cost_cr"] = df["anticipated_cost_crore"]
        elif "revised_cost_cr" in df.columns:
            df["anticipated_cost_cr"] = df["revised_cost_cr"]
        elif "revised_cost_crore" in df.columns:
            df["anticipated_cost_cr"] = df["revised_cost_crore"]
        elif "original_cost_cr" in df.columns:
            df["anticipated_cost_cr"] = df["original_cost_cr"]

    if "original_cost_cr" not in df.columns and "original_cost_crore" in df.columns:
        df["original_cost_cr"] = df["original_cost_crore"]

    grouped = df.groupby("effective_project_key", sort=False)

    next_report_month = grouped["report_month"].shift(-1)
    next_sched_ext = grouped["schedule_extension_months"].shift(-1)
    next_antic_cost = grouped["anticipated_cost_cr"].shift(-1)

    has_valid_t1 = next_report_month.notna()

    # Transition gap calculation (months)
    month_gap = (next_report_month.dt.year - df["report_month"].dt.year) * 12 + (next_report_month.dt.month - df["report_month"].dt.month)

    df["has_valid_t1"] = has_valid_t1
    df["transition_month_gap"] = month_gap
    df["_next_sched_ext"] = next_sched_ext
    df["_next_antic_cost"] = next_antic_cost

    df_usable = df[has_valid_t1].copy().reset_index(drop=True)
    rows_with_valid_t1 = len(df_usable)
    rows_dropped = total_rows_before - rows_with_valid_t1
    projects_retained = df_usable["effective_project_key"].nunique()

    gaps = df_usable["transition_month_gap"]
    exact_1m = int((gaps == 1).sum())
    multi_m = int((gaps > 1).sum())

    gap_stats = {
        "total_transitions": rows_with_valid_t1,
        "exact_1m_count": exact_1m,
        "exact_1m_pct": round(exact_1m / rows_with_valid_t1 * 100.0, 2),
        "multi_month_count": multi_m,
        "multi_month_pct": round(multi_m / rows_with_valid_t1 * 100.0, 2),
        "gap_2_3m_count": int(((gaps >= 2) & (gaps <= 3)).sum()),
        "gap_2_3m_pct": round(float(((gaps >= 2) & (gaps <= 3)).mean()) * 100.0, 2),
        "gap_4_6m_count": int(((gaps >= 4) & (gaps <= 6)).sum()),
        "gap_4_6m_pct": round(float(((gaps >= 4) & (gaps <= 6)).mean()) * 100.0, 2),
        "gap_7_12m_count": int(((gaps >= 7) & (gaps <= 12)).sum()),
        "gap_7_12m_pct": round(float(((gaps >= 7) & (gaps <= 12)).mean()) * 100.0, 2),
        "gap_gt_12m_count": int((gaps > 12).sum()),
        "gap_gt_12m_pct": round(float((gaps > 12).mean()) * 100.0, 2),
    }

    # 1. Schedule Targets
    curr_sched = df_usable["schedule_extension_months"].fillna(0.0)
    next_sched = df_usable["_next_sched_ext"].fillna(curr_sched)
    df_usable["future_delay_months"] = next_sched
    df_usable["target_delta_delay_months"] = next_sched - curr_sched

    # 2. Unified Scale-Invariant Cost Targets
    orig_cost = df_usable["original_cost_cr"]
    next_antic = df_usable["_next_antic_cost"]
    df_usable["future_anticipated_cost"] = next_antic

    valid_cost_mask = (orig_cost > 0) & next_antic.notna() & orig_cost.notna()
    df_usable["target_cost_multiplier"] = np.where(
        valid_cost_mask,
        next_antic / orig_cost,
        np.nan
    )
    df_usable["target_future_cost_overrun_pct"] = np.where(
        valid_cost_mask,
        (next_antic - orig_cost) / orig_cost * 100.0,
        np.nan
    )

    # Clean temporary shift columns
    df_usable = df_usable.drop(columns=["_next_sched_ext", "_next_antic_cost", "has_valid_t1"])

    stats = {
        "total_rows_before": total_rows_before,
        "unique_projects_before": unique_projects_before,
        "rows_with_valid_t1": rows_with_valid_t1,
        "rows_dropped": rows_dropped,
        "projects_retained": projects_retained,
        "valid_cost_rows": int(valid_cost_mask.sum()),
        "gap_analysis": gap_stats,
    }

    return df_usable, stats


def apply_chronological_splits(df: pd.DataFrame) -> Tuple[pd.DataFrame, pd.DataFrame, pd.DataFrame, pd.DataFrame]:
    """
    Strict chronological partitioning:
    - TRAIN: report_month <= 2022-12-01
    - VAL  : 2023-01-01 <= report_month <= 2024-06-01
    - TEST : 2024-07-01 <= report_month <= 2026-04-01
    - CURRENT INFERENCE: report_month >= 2026-05-01 (Latest real-world project state)

    Guarantees:
    max(train_date) < min(val_date) < max(val_date) < min(test_date) < max(test_date) < min(inference_date)
    """
    train_mask = df["report_month"] <= pd.Timestamp("2022-12-01")
    val_mask = (df["report_month"] >= pd.Timestamp("2023-01-01")) & (df["report_month"] <= pd.Timestamp("2024-06-01"))
    test_mask = (df["report_month"] >= pd.Timestamp("2024-07-01")) & (df["report_month"] <= pd.Timestamp("2026-04-01"))
    inference_mask = df["report_month"] >= pd.Timestamp("2026-05-01")

    df_train = df[train_mask].copy()
    df_val = df[val_mask].copy()
    df_test = df[test_mask].copy()
    df_inf = df[inference_mask].copy()

    # Integrity assertions
    assert df_train["report_month"].max() < df_val["report_month"].min(), "Train/Val temporal leakage!"
    assert df_val["report_month"].max() < df_test["report_month"].min(), "Val/Test temporal leakage!"
    if len(df_inf) > 0:
        assert df_test["report_month"].max() < df_inf["report_month"].min(), "Test/Inference temporal leakage!"

    return df_train, df_val, df_test, df_inf


def build_t1_preprocessor(categorical_cols: List[str], numeric_cols: List[str]) -> ColumnTransformer:
    """
    Constructs robust, leakage-safe preprocessor to be fitted STRICTLY on training data:
    - Numeric: SimpleImputer(strategy='median') + StandardScaler()
    - Categorical: SimpleImputer(strategy='constant') + OneHotEncoder(handle_unknown='ignore')
    """
    num_pipe = Pipeline([
        ("imputer", SimpleImputer(strategy="median")),
        ("scaler", StandardScaler()),
    ])

    cat_pipe = Pipeline([
        ("imputer", SimpleImputer(strategy="constant", fill_value="UNKNOWN")),
        ("encoder", OneHotEncoder(handle_unknown="ignore", sparse_output=False)),
    ])

    preprocessor = ColumnTransformer(
        transformers=[
            ("num", num_pipe, numeric_cols),
            ("cat", cat_pipe, categorical_cols),
        ],
        remainder="drop"
    )

    return preprocessor


def get_preprocessor_feature_names(preprocessor: ColumnTransformer,
                                   categorical_cols: List[str],
                                   numeric_cols: List[str]) -> List[str]:
    """Extract ordered transformed feature names from fitted ColumnTransformer."""
    names = list(numeric_cols)
    try:
        cat_encoder = preprocessor.named_transformers_["cat"].named_steps["encoder"]
        cat_names = cat_encoder.get_feature_names_out(categorical_cols)
        names.extend(list(cat_names))
    except Exception:
        pass
    return names


class ChronologicalStackingRegressor(BaseEstimator, RegressorMixin):
    """
    Stacking Regressor using expanding TimeSeriesSplit on the training set
    to generate out-of-fold meta-features without future temporal data leakage.
    """
    def __init__(self, estimators: List[Tuple[str, Any]], final_estimator: Any = None, n_splits: int = 3):
        self.estimators = estimators
        self.final_estimator = final_estimator or Ridge(alpha=1.0)
        self.n_splits = n_splits

    def fit(self, X: np.ndarray, y: np.ndarray):
        n_samples = len(X)
        n_estimators = len(self.estimators)
        meta_X = np.full((n_samples, n_estimators), np.nan)

        tscv = TimeSeriesSplit(n_splits=self.n_splits)
        valid_indices = []

        for train_idx, test_idx in tscv.split(X):
            valid_indices.extend(test_idx)
            for j, (name, est) in enumerate(self.estimators):
                cloned_est = clone(est)
                cloned_est.fit(X[train_idx], y[train_idx])
                meta_X[test_idx, j] = cloned_est.predict(X[test_idx])

        valid_mask = np.array(sorted(list(set(valid_indices))))
        self.final_estimator_ = clone(self.final_estimator)
        self.final_estimator_.fit(meta_X[valid_mask], y[valid_mask])

        # Fit all base estimators on full training dataset
        self.fitted_estimators_ = []
        for name, est in self.estimators:
            fitted = clone(est)
            fitted.fit(X, y)
            self.fitted_estimators_.append((name, fitted))
        return self

    def predict(self, X: np.ndarray) -> np.ndarray:
        meta_X = np.zeros((len(X), len(self.fitted_estimators_)))
        for j, (name, est) in enumerate(self.fitted_estimators_):
            meta_X[:, j] = est.predict(X)
        return self.final_estimator_.predict(meta_X)

