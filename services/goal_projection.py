"""
Goal projection and ETA calculations.
Port of Juan-Tracker's goal_projection_model.dart.
"""

from dataclasses import dataclass
from datetime import date, datetime, timedelta
from typing import Optional


@dataclass
class GoalProjection:
    goal_weight_kg: float
    current_trend_weight: float
    latest_weight: float
    daily_trend_rate: float  # kg/day, positive = gaining
    goal: str  # 'lose', 'maintain', 'gain'
    target_weekly_rate_kg: float
    plan_start_date: date
    days_since_start: int

    @property
    def weight_delta(self):
        """Positive = above goal, negative = below goal."""
        return self.current_trend_weight - self.goal_weight_kg

    @property
    def is_on_track(self):
        if self.goal == "maintain":
            return True
        if self.goal == "lose":
            return self.daily_trend_rate < 0
        if self.goal == "gain":
            return self.daily_trend_rate > 0
        return False

    @property
    def goal_reached(self):
        return abs(self.weight_delta) <= 0.5

    @property
    def estimated_days_to_goal(self) -> Optional[int]:
        if self.goal_reached:
            return 0
        if abs(self.daily_trend_rate) < 0.001:
            return None
        if self.goal == "lose" and self.daily_trend_rate >= 0:
            return None
        if self.goal == "gain" and self.daily_trend_rate <= 0:
            return None

        days_needed = abs(self.weight_delta / self.daily_trend_rate)
        if days_needed > 730:
            return None
        return round(days_needed)

    @property
    def estimated_goal_date(self) -> Optional[date]:
        days = self.estimated_days_to_goal
        if days is None:
            return None
        return date.today() + timedelta(days=days)

    def predict_weight_in_days(self, days):
        if days <= 0:
            return self.current_trend_weight
        return self.current_trend_weight + (self.daily_trend_rate * days)

    @property
    def current_weekly_rate(self):
        return self.daily_trend_rate * 7

    @property
    def pace_ratio(self):
        """1.0 = on target, <1.0 = slower, >1.0 = faster."""
        if abs(self.target_weekly_rate_kg) < 0.01:
            return 1.0
        return min(3.0, max(0.0, abs(self.current_weekly_rate) / abs(self.target_weekly_rate_kg)))

    @property
    def progress_percentage(self):
        """0-150% progress toward goal."""
        start_weight = self.current_trend_weight - (self.daily_trend_rate * self.days_since_start)
        target_change = self.goal_weight_kg - start_weight
        if abs(target_change) < 0.1:
            return 100.0
        total_change = self.current_trend_weight - start_weight
        return max(0.0, min(150.0, (total_change / target_change) * 100))

    @property
    def progress_message(self):
        if self.goal_reached:
            return "Meta alcanzada!"
        days = self.estimated_days_to_goal
        if days is None:
            if not self.is_on_track:
                return "Ajusta para empezar a perder" if self.goal == "lose" else "Ajusta para empezar a ganar"
            return "Calculando proyeccion..."
        if days == 0:
            return "Meta alcanzada!"
        if days < 7:
            return f"~{days} dias para tu meta"
        if days < 30:
            weeks = round(days / 7)
            return f"~{weeks} {'semana' if weeks == 1 else 'semanas'} para tu meta"
        if days < 365:
            months = round(days / 30)
            return f"~{months} {'mes' if months == 1 else 'meses'} para tu meta"
        return "Meta a largo plazo"

    @property
    def pace_message(self):
        if self.goal == "maintain":
            if abs(self.current_weekly_rate) < 0.1:
                return "Peso estable"
            return f"Fluctuacion: {self._format_rate(self.current_weekly_rate)}"

        current_str = self._format_rate(self.current_weekly_rate)
        target_rate = -self.target_weekly_rate_kg if self.goal == "lose" else self.target_weekly_rate_kg
        target_str = self._format_rate(target_rate)

        if self.pace_ratio < 0.5:
            return f"Ritmo: {current_str} (objetivo: {target_str})"
        elif self.pace_ratio > 1.2:
            return f"Ritmo: {current_str} — mas rapido que objetivo"
        else:
            return f"Ritmo: {current_str} — en objetivo"

    def _format_rate(self, rate):
        sign = "+" if rate >= 0 else ""
        return f"{sign}{rate:.2f} kg/sem"

    def generate_goal_line(self, max_days=90):
        """Generate projection points for chart."""
        points = []
        today = date.today()
        end_days = self.estimated_days_to_goal or max_days
        days_to_plot = max(7, min(max_days, end_days))

        # Start point
        points.append({
            "fecha": today,
            "projected": self.current_trend_weight,
            "goal": self.goal_weight_kg,
        })

        # Intermediate points every 7 days
        for day in range(7, days_to_plot + 1, 7):
            projected = self.predict_weight_in_days(day)
            # Clamp to not go past goal
            if self.goal == "lose":
                projected = max(projected, self.goal_weight_kg)
            elif self.goal == "gain":
                projected = min(projected, self.goal_weight_kg)

            points.append({
                "fecha": today + timedelta(days=day),
                "projected": projected,
                "goal": self.goal_weight_kg,
            })

        return points


def calculate_projection(plan, trend_result):
    """
    Calculate goal projection from coach plan and weight trend.
    plan: dict from DB
    trend_result: WeightTrendResult
    """
    if not plan or not trend_result:
        return None

    goal = plan["goal"]
    target_weight = plan.get("target_weight")

    # If no target weight, estimate one
    if not target_weight:
        starting = plan["starting_weight"]
        if goal == "lose":
            target_weight = max(40, starting - 5)
        elif goal == "gain":
            target_weight = min(200, starting + 5)
        else:
            target_weight = starting

    plan_start = plan["start_date"]
    if isinstance(plan_start, str):
        plan_start = datetime.fromisoformat(plan_start).date()

    return GoalProjection(
        goal_weight_kg=target_weight,
        current_trend_weight=trend_result.ema_weight,
        latest_weight=trend_result.latest_weight,
        daily_trend_rate=trend_result.hw_trend,
        goal=goal,
        target_weekly_rate_kg=plan["weekly_rate_kg"],
        plan_start_date=plan_start,
        days_since_start=(date.today() - plan_start).days,
    )
