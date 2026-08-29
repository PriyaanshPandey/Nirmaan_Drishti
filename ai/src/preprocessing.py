"""
Preprocessing pipeline for PAIMANA ML models.

Builds sklearn ColumnTransformer for categorical encoding and
numeric imputation. Fitted ONLY on training data.
"""

import numpy as np
import pandas as pd
import joblib
from pathlib import Path
from sklearn.compose import ColumnTransformer
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder, StandardScaler
from sklearn.impute import SimpleImputer
from typing import List, Tuple, Optional

from src.feature_selection import get_available_feature_split


def build_preprocessor(df_train: pd.DataFrame,
                       categorical_features: List[str] = None,
                       numeric_features: List[str] = None) -> ColumnTransformer:
    """
    Build and fit a preprocessing pipeline on training data.

    Parameters
    ----------
    df_train : pd.DataFrame
        Training data (features only).
    categorical_features : list, optional
        Categorical column names. Auto-detected if None.
    numeric_features : list, optional
        Numeric column names. Auto-detected if None.

    Returns
    -------
    ColumnTransformer
        Fitted preprocessor.
    """
    if categorical_features is None or numeric_features is None:
        split = get_available_feature_split(df_train)
        if categorical_features is None:
            categorical_features = split["categorical"]
        if numeric_features is None:
            numeric_features = split["numeric"]

    # Filter to only columns present in the data
    categorical_features = [c for c in categorical_features if c in df_train.columns]
    numeric_features = [c for c in numeric_features if c in df_train.columns]

    # Numeric pipeline: impute median, then standard scale
    numeric_pipeline = Pipeline([
        ("imputer", SimpleImputer(strategy="median")),
        ("scaler", StandardScaler()),
    ])

    # Categorical pipeline: impute with 'UNKNOWN', then one-hot encode
    categorical_pipeline = Pipeline([
        ("imputer", SimpleImputer(strategy="constant", fill_value="UNKNOWN")),
        ("encoder", OneHotEncoder(handle_unknown="ignore", sparse_output=False)),
    ])

    preprocessor = ColumnTransformer(
        transformers=[
            ("num", numeric_pipeline, numeric_features),
            ("cat", categorical_pipeline, categorical_features),
        ],
        remainder="drop",  # Drop any columns not in the lists
    )

    # Fit on training data only
    preprocessor.fit(df_train)

    print(f"Preprocessor fitted:")
    print(f"  Numeric features: {len(numeric_features)}")
    print(f"  Categorical features: {len(categorical_features)}")

    return preprocessor


def get_feature_names(preprocessor: ColumnTransformer) -> List[str]:
    """Get feature names from the fitted preprocessor."""
    feature_names = []

    for name, transformer, columns in preprocessor.transformers_:
        if name == "num":
            feature_names.extend(columns)
        elif name == "cat":
            # Get one-hot feature names
            encoder = transformer.named_steps["encoder"]
            cat_features = encoder.get_feature_names_out(columns)
            feature_names.extend(cat_features)

    return feature_names


def transform_features(df: pd.DataFrame,
                       preprocessor: ColumnTransformer) -> np.ndarray:
    """
    Transform features using fitted preprocessor.

    Parameters
    ----------
    df : pd.DataFrame
        Raw features dataframe.
    preprocessor : ColumnTransformer
        Fitted preprocessor.

    Returns
    -------
    np.ndarray
        Transformed feature matrix.
    """
    return preprocessor.transform(df)


def save_preprocessor(preprocessor: ColumnTransformer,
                      path: str = None) -> str:
    """Save fitted preprocessor to disk."""
    if path is None:
        path = Path(__file__).parent.parent / "models" / "preprocessing" / "preprocessor.pkl"
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    joblib.dump(preprocessor, path)
    print(f"Preprocessor saved to: {path}")
    return str(path)


def load_preprocessor(path: str = None) -> ColumnTransformer:
    """Load fitted preprocessor from disk."""
    if path is None:
        path = Path(__file__).parent.parent / "models" / "preprocessing" / "preprocessor.pkl"
    path = Path(path)
    if not path.exists():
        raise FileNotFoundError(f"Preprocessor not found: {path}")
    return joblib.load(path)
