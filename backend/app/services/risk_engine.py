"""
Centralized Risk Engine for Nirmaan Drishti.

Computes a calibrated 0-100 Risk Score from ML model predicted Cost Overrun (%)
and Schedule Delay (months) using empirical quantile distributions derived from
159,016 historical infrastructure project snapshots.

Single Source of Truth for:
- Prediction APIs
- Dashboard
- Project Details
- Scenario Analysis & Simulation
"""
from typing import Dict, Any, NamedTuple, Optional, Tuple
import bisect
import math


# Configurable Weights (Single Source of Truth)
DEFAULT_WEIGHT_COST: float = 0.50
DEFAULT_WEIGHT_SCHEDULE: float = 0.50

# Configurable Risk Level Thresholds (Single Source of Truth)
RISK_LEVEL_THRESHOLDS: Tuple[Tuple[str, float], ...] = (
    ("Critical", 80.0),
    ("High", 60.0),
    ("Medium", 35.0),
    ("Low", 0.0),
)

# 101-point Empirical Percentile Quantiles (P0 through P100)
# Extracted directly from 159,016 historical project training snapshots in data/05_ml_features/train.parquet
# for positive escalation events (> 0).
COST_OVERRUN_QUANTILES = (
    0.0003, 0.0101, 0.0249, 0.0625, 0.1283, 0.2132, 0.5663, 1.0635, 1.7832, 2.2945,
    3.0665, 3.8421, 4.6800, 5.3180, 5.7050, 6.2532, 7.3865, 7.8619, 8.7834, 9.7650,
    10.4584, 10.9419, 11.5670, 12.4166, 13.6052, 14.2368, 15.4136, 16.0211, 16.6347, 17.6471,
    18.0333, 18.6642, 19.3548, 20.2803, 21.4974, 23.1625, 24.1525, 25.4969, 26.4444, 27.5991,
    29.0621, 29.4484, 30.5342, 31.7750, 32.7801, 33.8142, 35.5432, 36.7706, 37.9591, 39.0515,
    40.7711, 41.7073, 43.8173, 44.8002, 46.7166, 48.0820, 50.3094, 51.4852, 52.7694, 54.2546,
    55.6522, 58.1470, 60.4552, 62.3219, 63.3517, 65.7739, 67.8170, 69.3015, 71.1092, 73.2867,
    76.2115, 78.8285, 80.6824, 82.4888, 87.5351, 92.2524, 93.5596, 97.2629, 104.8837, 108.6594,
    112.8776, 117.0641, 122.6676, 131.8884, 135.9293, 145.1649, 154.4172, 162.2607, 173.7060, 186.3934,
    203.2197, 212.8080, 234.2704, 253.6037, 285.2941, 300.0000, 338.9052, 376.7773, 512.1992, 696.0000,
    5548.2598,
)

SCHEDULE_DELAY_QUANTILES = (
    1.0000, 1.0000, 2.0000, 3.0000, 3.0000, 3.0000, 4.0000, 5.0000, 5.0000, 6.0000,
    6.0000, 6.0000, 7.0000, 7.0000, 8.0000, 8.0000, 9.0000, 9.0000, 10.0000, 10.0000,
    11.0000, 11.0000, 12.0000, 12.0000, 12.0000, 12.0000, 12.0000, 13.0000, 14.0000, 14.0000,
    15.0000, 15.0000, 16.0000, 17.0000, 18.0000, 18.0000, 19.0000, 20.0000, 20.0000, 21.0000,
    21.0000, 22.0000, 23.0000, 23.0000, 24.0000, 24.0000, 24.0000, 24.0000, 24.0000, 25.0000,
    25.0000, 27.0000, 27.0000, 28.0000, 29.0000, 30.0000, 31.0000, 32.0000, 33.0000, 33.0000,
    35.0000, 36.0000, 36.0000, 36.0000, 37.0000, 38.0000, 39.0000, 40.0000, 41.0000, 42.0000,
    44.0000, 45.0000, 46.0000, 48.0000, 48.0000, 48.0000, 50.0000, 51.0000, 53.0000, 55.0000,
    57.0000, 59.0000, 60.0000, 62.0000, 64.0000, 66.0000, 69.0000, 71.0000, 72.0000, 74.0000,
    78.0000, 83.0000, 85.0000, 90.0000, 96.0000, 101.0000, 108.0000, 115.0000, 128.0000, 144.0000,
    360.0000,
)


class RiskScoreResult(NamedTuple):
    """Result container for the centralized risk engine calculation."""
    risk_score: float
    risk_level: str
    cost_risk_component: float
    schedule_risk_component: float

    def to_dict(self) -> Dict[str, Any]:
        return {
            "risk_score": self.risk_score,
            "risk_level": self.risk_level,
            "cost_risk_component": self.cost_risk_component,
            "schedule_risk_component": self.schedule_risk_component,
        }


def percentile_rank(
    val: Optional[float],
    quantiles: Tuple[float, ...] = COST_OVERRUN_QUANTILES
) -> float:
    """
    Interpolate empirical percentile rank in [0.0, 1.0] of a predicted metric against
    the empirical reference distribution using piecewise linear interpolation.

    Guarantees:
    - Strictly deterministic
    - Strictly monotonic: val1 <= val2 ==> percentile_rank(val1) <= percentile_rank(val2)
    - Strictly bounded in [0.0, 1.0]
    """
    if val is None or math.isnan(val) or val <= 0.0:
        return 0.0
    val_f = float(val)
    if val_f >= quantiles[-1]:
        return 1.0

    idx = bisect.bisect_right(quantiles, val_f)
    if idx <= 0:
        return 0.0
    if idx >= len(quantiles):
        return 1.0

    q_low = quantiles[idx - 1]
    q_high = quantiles[idx]

    if q_high == q_low:
        pct = float(idx)
    else:
        fraction = (val_f - q_low) / (q_high - q_low)
        pct = (idx - 1) + fraction

    return max(0.0, min(1.0, round(pct / 100.0, 4)))


def _interpolate_quantile(val: Optional[float], quantiles: Tuple[float, ...]) -> float:
    """Alias for backwards compatibility: returns percentile in [0.0, 100.0]."""
    return round(percentile_rank(val, quantiles) * 100.0, 2)


def get_risk_level(risk_score: float) -> str:
    """
    Centralized mapping of 0-100 Risk Score to categorical Risk Level.
    Configured via centralized RISK_LEVEL_THRESHOLDS.
    """
    for level, threshold in RISK_LEVEL_THRESHOLDS:
        if risk_score >= threshold:
            return level
    return "Low"


def calculate_risk_score(
    predicted_cost_overrun: Optional[float],
    predicted_schedule_delay: Optional[float],
    weight_cost: float = DEFAULT_WEIGHT_COST,
    weight_schedule: float = DEFAULT_WEIGHT_SCHEDULE,
) -> RiskScoreResult:
    """
    Calculate dynamic Risk Score and components from model-predicted Cost Overrun and Schedule Delay.

    Formula:
        cost_percentile = percentile_rank(predicted_cost_overrun)
        schedule_percentile = percentile_rank(predicted_schedule_delay)
        risk_score = 100.0 * (weight_cost * cost_percentile + weight_schedule * schedule_percentile)

    Guarantees:
        - Deterministic
        - Monotonic with respect to cost overrun and schedule delay
        - Strictly bounded 0-100
        - Zero arbitrary multipliers or offsets (empirical quantiles only)

    Args:
        predicted_cost_overrun: Predicted cost overrun percentage (%)
        predicted_schedule_delay: Predicted schedule delay/extension in months
        weight_cost: Configurable weight for cost risk component (default 0.50)
        weight_schedule: Configurable weight for schedule risk component (default 0.50)

    Returns:
        RiskScoreResult containing:
            - risk_score: Combined 0-100 score (rounded to 1 decimal place)
            - risk_level: 'Low' | 'Medium' | 'High' | 'Critical'
            - cost_risk_component: Normalized cost risk 0-100
            - schedule_risk_component: Normalized schedule risk 0-100
    """
    total_weight = weight_cost + weight_schedule
    if total_weight > 0:
        w_cost = weight_cost / total_weight
        w_sched = weight_schedule / total_weight
    else:
        w_cost = 0.50
        w_sched = 0.50

    cost_percentile = percentile_rank(predicted_cost_overrun, COST_OVERRUN_QUANTILES)
    schedule_percentile = percentile_rank(predicted_schedule_delay, SCHEDULE_DELAY_QUANTILES)

    # 100 * (0.50 * cost_percentile + 0.50 * schedule_percentile)
    raw_score = 100.0 * ((w_cost * cost_percentile) + (w_sched * schedule_percentile))
    risk_score = max(0.0, min(100.0, round(raw_score, 1)))

    cost_component = max(0.0, min(100.0, round(cost_percentile * 100.0, 1)))
    sched_component = max(0.0, min(100.0, round(schedule_percentile * 100.0, 1)))

    level = get_risk_level(risk_score)

    return RiskScoreResult(
        risk_score=risk_score,
        risk_level=level,
        cost_risk_component=cost_component,
        schedule_risk_component=sched_component,
    )
