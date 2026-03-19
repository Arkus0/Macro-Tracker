"""
Advanced weight trend analysis.
Port of Juan-Tracker's weight_trend_calculator.dart.
Implements EMA, Holt-Winters, phase detection, and predictions.
"""

from dataclasses import dataclass
from enum import Enum


class WeightPhase(Enum):
    LOSING = "losing"
    MAINTAINING = "maintaining"
    GAINING = "gaining"
    INSUFFICIENT_DATA = "insufficient_data"


@dataclass
class TrendConfig:
    ema_period: int = 7
    hw_period: int = 7
    phase_change_threshold: float = 0.2  # kg/week
    plateau_min_days: int = 14


@dataclass
class WeightTrendResult:
    # EMA
    ema_weight: float
    ema_history: list

    # Holt-Winters
    hw_level: float
    hw_trend: float  # kg/day
    hw_prediction_7d: float = None
    hw_prediction_30d: float = None

    # Phase
    phase: WeightPhase = WeightPhase.INSUFFICIENT_DATA
    days_in_phase: int = 0
    weekly_rate: float = 0.0  # kg/week

    # Data
    latest_weight: float = 0.0

    @property
    def trend_weight(self):
        return self.ema_weight


class WeightTrendCalculator:
    def __init__(self, config=None):
        self.config = config or TrendConfig()

    def calculate(self, weight_entries):
        """
        Calculate trend from weight entries.
        weight_entries: list of dicts with 'fecha' and 'peso' keys, sorted by date.
        Returns WeightTrendResult.
        """
        weights = [e["peso"] for e in weight_entries if e.get("peso") is not None]

        if not weights:
            return WeightTrendResult(
                ema_weight=0, ema_history=[], hw_level=0, hw_trend=0,
                latest_weight=0, phase=WeightPhase.INSUFFICIENT_DATA,
            )

        if len(weights) == 1:
            return WeightTrendResult(
                ema_weight=weights[0], ema_history=weights[:],
                hw_level=weights[0], hw_trend=0,
                latest_weight=weights[0], phase=WeightPhase.INSUFFICIENT_DATA,
            )

        # EMA
        ema_history = self._calculate_ema(weights)
        ema_weight = ema_history[-1]

        # Holt-Winters
        hw_level, hw_trend = self._calculate_holt_winters(weights)

        # Predictions
        hw_prediction_7d = hw_level + hw_trend * 7
        hw_prediction_30d = hw_level + hw_trend * 30

        # Phase detection
        weekly_rate = hw_trend * 7
        phase, days_in_phase = self._detect_phase(weights, weekly_rate)

        return WeightTrendResult(
            ema_weight=ema_weight,
            ema_history=ema_history,
            hw_level=hw_level,
            hw_trend=hw_trend,
            hw_prediction_7d=hw_prediction_7d,
            hw_prediction_30d=hw_prediction_30d,
            phase=phase,
            days_in_phase=days_in_phase,
            weekly_rate=weekly_rate,
            latest_weight=weights[-1],
        )

    def _calculate_ema(self, weights):
        """Exponential Moving Average."""
        alpha = 2.0 / (self.config.ema_period + 1)
        ema = [weights[0]]
        for w in weights[1:]:
            ema.append(alpha * w + (1 - alpha) * ema[-1])
        return ema

    def _calculate_holt_winters(self, weights):
        """
        Double exponential smoothing (Holt-Winters without seasonality).
        Returns (level, trend_per_day).
        """
        if len(weights) < 2:
            return weights[0] if weights else 0, 0

        alpha = 2.0 / (self.config.hw_period + 1)
        beta = 0.3  # Trend smoothing

        level = weights[0]
        trend = weights[1] - weights[0]

        for w in weights[1:]:
            prev_level = level
            level = alpha * w + (1 - alpha) * (level + trend)
            trend = beta * (level - prev_level) + (1 - beta) * trend

        return level, trend

    def _detect_phase(self, weights, weekly_rate):
        """Detect current weight phase."""
        threshold = self.config.phase_change_threshold

        if len(weights) < 7:
            return WeightPhase.INSUFFICIENT_DATA, 0

        if weekly_rate < -threshold:
            phase = WeightPhase.LOSING
        elif weekly_rate > threshold:
            phase = WeightPhase.GAINING
        else:
            phase = WeightPhase.MAINTAINING

        # Count days in phase (simplified: use last N weights)
        days = 0
        for i in range(len(weights) - 1, max(0, len(weights) - 90), -1):
            if i == 0:
                break
            local_rate = (weights[i] - weights[i - 1]) * 7
            if phase == WeightPhase.LOSING and local_rate >= threshold:
                break
            elif phase == WeightPhase.GAINING and local_rate <= -threshold:
                break
            elif phase == WeightPhase.MAINTAINING and abs(local_rate) > threshold:
                break
            days += 1

        return phase, max(days, 1)
