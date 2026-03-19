"""
Adaptive Coach Service — port of Juan-Tracker's adaptive_coach_service.dart.
Implements MacroFactor-style weekly check-ins with auto-adjusting targets.
"""

from dataclasses import dataclass, field
from enum import Enum
from typing import Optional
from datetime import date, timedelta

KCAL_PER_KG = 7700.0
MAX_WEEKLY_KCAL_CHANGE = 200
MIN_WEIGHIN_DAYS = 3
MIN_DIARY_DAYS = 4
MIN_KCAL_TARGET = 1200
MAX_KCAL_TARGET = 6000


class WeightGoal(Enum):
    LOSE = "lose"
    MAINTAIN = "maintain"
    GAIN = "gain"


class CheckInStatus(Enum):
    READY = "ready"
    INSUFFICIENT_DATA = "insufficient_data"
    NOT_ENOUGH_TIME = "not_enough_time"
    ERROR = "error"


class MacroPreset(Enum):
    LOW_CARB = ("Low Carb", "Bajo en carbohidratos, alto en grasas", 0.25, 0.45, 0.30)
    BALANCED = ("Balanceado", "Distribucion equilibrada", 0.30, 0.35, 0.35)
    HIGH_PROTEIN = ("High Protein", "Alto en proteinas para ganancia muscular", 0.40, 0.30, 0.30)
    HIGH_CARB = ("High Carb", "Alto en carbohidratos para energia", 0.25, 0.50, 0.25)
    KETO = ("Keto", "Muy bajo en carbohidratos", 0.30, 0.05, 0.65)
    CUSTOM = ("Personalizado", "Macros ajustados manualmente", 0.30, 0.35, 0.35)

    def __init__(self, display_name, description, protein_pct, carbs_pct, fat_pct):
        self.display_name = display_name
        self.description = description
        self.protein_pct = protein_pct
        self.carbs_pct = carbs_pct
        self.fat_pct = fat_pct

    def calculate_grams(self, total_kcal):
        """Calculate macro grams from total kcal."""
        protein_g = round((total_kcal * self.protein_pct) / 4)
        carbs_g = round((total_kcal * self.carbs_pct) / 4)
        fat_g = round((total_kcal * self.fat_pct) / 9)
        return MacroGrams(protein=protein_g, carbs=carbs_g, fat=fat_g)


PRESET_MAP = {
    "low_carb": MacroPreset.LOW_CARB,
    "balanced": MacroPreset.BALANCED,
    "high_protein": MacroPreset.HIGH_PROTEIN,
    "high_carb": MacroPreset.HIGH_CARB,
    "keto": MacroPreset.KETO,
    "custom": MacroPreset.CUSTOM,
}


@dataclass
class MacroGrams:
    protein: int
    carbs: int
    fat: int

    @property
    def total_kcal(self):
        return (self.protein * 4) + (self.carbs * 4) + (self.fat * 9)


@dataclass
class WeeklyData:
    start_date: date
    end_date: date
    avg_daily_kcal: float
    trend_weight_start: float
    trend_weight_end: float
    days_with_diary: int
    days_with_weighins: int

    @property
    def trend_change_kg(self):
        return self.trend_weight_end - self.trend_weight_start

    @property
    def calculated_tdee(self):
        """TDEE = avg_kcal - (delta_trend_weight * 7700 / days)"""
        days = (self.end_date - self.start_date).days
        if days <= 0:
            return self.avg_daily_kcal
        delta_kcal = self.trend_change_kg * KCAL_PER_KG / days
        return self.avg_daily_kcal - delta_kcal

    @property
    def has_enough_data(self):
        return self.days_with_diary >= MIN_DIARY_DAYS and self.days_with_weighins >= MIN_WEIGHIN_DAYS


@dataclass
class CheckInExplanation:
    line1: str = ""  # Ingesta media
    line2: str = ""  # Cambio de peso
    line3: str = ""  # TDEE estimado
    line4: str = ""  # Ajuste objetivo
    line5: str = ""  # Nuevo target

    @property
    def all_lines(self):
        return [self.line1, self.line2, self.line3, self.line4, self.line5]


@dataclass
class CheckInResult:
    status: CheckInStatus
    weekly_data: WeeklyData
    estimated_tdee: int = 0
    proposed_kcal_target: int = 2000
    proposed_macros: MacroGrams = field(default_factory=lambda: MacroGrams(0, 0, 0))
    explanation: CheckInExplanation = field(default_factory=CheckInExplanation)
    was_clamped: bool = False
    daily_adjustment_kcal: int = 0
    error_message: Optional[str] = None


def get_daily_adjustment(goal, weekly_rate_kg):
    """Calculate daily kcal adjustment from goal and weekly rate."""
    # kg/week * 7700 kcal/kg / 7 days = kcal/day
    adjustment = round(weekly_rate_kg * KCAL_PER_KG / 7)
    if goal == WeightGoal.LOSE or goal == "lose":
        return -abs(adjustment)
    elif goal == WeightGoal.GAIN or goal == "gain":
        return abs(adjustment)
    return 0


def calculate_checkin(plan, weekly_data):
    """
    Calculate weekly check-in.
    plan: dict from db (coach_plans row)
    weekly_data: WeeklyData instance
    Returns CheckInResult.
    """
    # Validate data
    if not weekly_data.has_enough_data:
        return CheckInResult(
            status=CheckInStatus.INSUFFICIENT_DATA,
            weekly_data=weekly_data,
            error_message=(
                f"Se necesitan al menos {MIN_DIARY_DAYS} dias de diario "
                f"y {MIN_WEIGHIN_DAYS} pesajes. "
                f"Tienes: {weekly_data.days_with_diary} dias de diario, "
                f"{weekly_data.days_with_weighins} pesajes."
            ),
        )

    # Calculate TDEE from data
    calculated_tdee = weekly_data.calculated_tdee

    # Get goal adjustment
    goal = plan["goal"]
    weekly_rate = plan["weekly_rate_kg"]
    adjustment = get_daily_adjustment(goal, weekly_rate)

    # New target = TDEE + adjustment (negative for deficit)
    new_target = round(calculated_tdee + adjustment)

    # Clamp: max weekly change
    was_clamped = False
    previous_target = plan.get("current_kcal_target") or plan["initial_tdee"]

    min_allowed = previous_target - MAX_WEEKLY_KCAL_CHANGE
    max_allowed = previous_target + MAX_WEEKLY_KCAL_CHANGE

    if new_target < min_allowed:
        new_target = min_allowed
        was_clamped = True
    elif new_target > max_allowed:
        new_target = max_allowed
        was_clamped = True

    # Clamp: absolute health limits
    if new_target < MIN_KCAL_TARGET:
        new_target = MIN_KCAL_TARGET
        was_clamped = True
    elif new_target > MAX_KCAL_TARGET:
        new_target = MAX_KCAL_TARGET
        was_clamped = True

    # Calculate macros
    preset_name = plan.get("macro_preset", "balanced")
    preset = PRESET_MAP.get(preset_name, MacroPreset.BALANCED)
    macro_grams = preset.calculate_grams(new_target)

    # Build explanation
    sign = "+" if weekly_data.trend_change_kg > 0 else ""
    adj_text = f"{adjustment}kcal (deficit)" if adjustment < 0 else (
        f"+{adjustment}kcal (superavit)" if adjustment > 0 else "0kcal (mantenimiento)"
    )

    explanation = CheckInExplanation(
        line1=f"Ingesta media: {round(weekly_data.avg_daily_kcal)} kcal/dia",
        line2=f"Cambio de trend: {sign}{weekly_data.trend_change_kg:.2f} kg",
        line3=f"TDEE estimado: {round(calculated_tdee)} kcal",
        line4=f"Ajuste objetivo: {adj_text}",
        line5=f"Nuevo target: {new_target} kcal",
    )

    return CheckInResult(
        status=CheckInStatus.READY,
        weekly_data=weekly_data,
        estimated_tdee=round(calculated_tdee),
        proposed_kcal_target=new_target,
        proposed_macros=macro_grams,
        explanation=explanation,
        was_clamped=was_clamped,
        daily_adjustment_kcal=adjustment,
    )


def build_weekly_data(weight_entries, food_daily_totals, start_date, end_date, trend_calculator=None):
    """
    Build WeeklyData from raw entries.
    weight_entries: list of dicts with fecha, peso
    food_daily_totals: list of dicts with fecha, kcal
    """
    from services.weight_trend import WeightTrendCalculator

    if trend_calculator is None:
        trend_calculator = WeightTrendCalculator()

    # Filter to period
    period_weights = [
        w for w in weight_entries
        if w.get("peso") is not None and start_date <= _parse_date(w["fecha"]) <= end_date
    ]
    period_food = [
        f for f in food_daily_totals
        if start_date <= _parse_date(f["fecha"]) <= end_date
    ]

    # Avg daily kcal
    kcal_values = [f["kcal"] for f in period_food if f.get("kcal") and f["kcal"] > 0]
    avg_kcal = sum(kcal_values) / len(kcal_values) if kcal_values else 0

    # Trend weights
    trend_start = 0
    trend_end = 0

    all_weights = [w for w in weight_entries if w.get("peso") is not None]
    if len(all_weights) >= 2:
        result = trend_calculator.calculate(all_weights)
        trend_end = result.ema_weight

        # For start, use EMA up to start_date
        early_weights = [
            w for w in all_weights if _parse_date(w["fecha"]) <= start_date
        ]
        if len(early_weights) >= 2:
            early_result = trend_calculator.calculate(early_weights)
            trend_start = early_result.ema_weight
        elif early_weights:
            trend_start = early_weights[-1]["peso"]
        else:
            trend_start = trend_end
    elif all_weights:
        trend_start = trend_end = all_weights[0]["peso"]

    return WeeklyData(
        start_date=start_date,
        end_date=end_date,
        avg_daily_kcal=avg_kcal,
        trend_weight_start=trend_start,
        trend_weight_end=trend_end,
        days_with_diary=len(kcal_values),
        days_with_weighins=len(period_weights),
    )


def _parse_date(d):
    """Parse date from string or date object."""
    if isinstance(d, date):
        return d
    from datetime import datetime
    try:
        return datetime.fromisoformat(str(d)).date()
    except (ValueError, TypeError):
        return date.today()
