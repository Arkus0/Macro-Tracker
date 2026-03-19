/**
 * Goal projection and ETA calculations.
 * Port of services/goal_projection.py (originally from Juan-Tracker).
 */

import type { WeightTrendResult } from "./weight-trend";

export interface GoalProjection {
  goalWeightKg: number;
  currentTrendWeight: number;
  latestWeight: number;
  dailyTrendRate: number; // kg/day, positive = gaining
  goal: string; // 'lose', 'maintain', 'gain'
  targetWeeklyRateKg: number;
  planStartDate: string;
  daysSinceStart: number;
  weightDelta: number;
  isOnTrack: boolean;
  goalReached: boolean;
  estimatedDaysToGoal: number | null;
  estimatedGoalDate: string | null;
  currentWeeklyRate: number;
  paceRatio: number;
  progressPercentage: number;
  progressMessage: string;
  paceMessage: string;
}

export interface ProjectionPoint {
  fecha: string;
  projected: number;
  goal: number;
}

function formatRate(rate: number): string {
  const sign = rate >= 0 ? "+" : "";
  return `${sign}${rate.toFixed(2)} kg/sem`;
}

export function calculateProjection(
  plan: {
    goal: string;
    target_weight: number | null;
    starting_weight: number;
    start_date: string;
    weekly_rate_kg: number;
  },
  trendResult: WeightTrendResult
): GoalProjection | null {
  if (!plan || !trendResult) return null;

  const goal = plan.goal;
  let targetWeight = plan.target_weight;

  if (!targetWeight) {
    const starting = plan.starting_weight;
    if (goal === "lose") targetWeight = Math.max(40, starting - 5);
    else if (goal === "gain") targetWeight = Math.min(200, starting + 5);
    else targetWeight = starting;
  }

  const today = new Date();
  const planStart = new Date(plan.start_date + "T00:00:00");
  const daysSinceStart = Math.floor(
    (today.getTime() - planStart.getTime()) / (1000 * 60 * 60 * 24)
  );

  const currentTrendWeight = trendResult.emaWeight;
  const dailyTrendRate = trendResult.hwTrend;
  const weightDelta = currentTrendWeight - targetWeight;
  const currentWeeklyRate = dailyTrendRate * 7;

  const goalReached = Math.abs(weightDelta) <= 0.5;

  let isOnTrack = false;
  if (goal === "maintain") isOnTrack = true;
  else if (goal === "lose") isOnTrack = dailyTrendRate < 0;
  else if (goal === "gain") isOnTrack = dailyTrendRate > 0;

  // Estimated days to goal
  let estimatedDaysToGoal: number | null = null;
  if (goalReached) {
    estimatedDaysToGoal = 0;
  } else if (Math.abs(dailyTrendRate) >= 0.001) {
    if (goal === "lose" && dailyTrendRate >= 0) {
      estimatedDaysToGoal = null;
    } else if (goal === "gain" && dailyTrendRate <= 0) {
      estimatedDaysToGoal = null;
    } else {
      const daysNeeded = Math.abs(weightDelta / dailyTrendRate);
      estimatedDaysToGoal = daysNeeded <= 730 ? Math.round(daysNeeded) : null;
    }
  }

  // Estimated goal date
  let estimatedGoalDate: string | null = null;
  if (estimatedDaysToGoal != null) {
    const goalDate = new Date(today);
    goalDate.setDate(goalDate.getDate() + estimatedDaysToGoal);
    estimatedGoalDate = goalDate.toISOString().split("T")[0];
  }

  // Pace ratio
  let paceRatio = 1.0;
  if (Math.abs(plan.weekly_rate_kg) >= 0.01) {
    paceRatio = Math.min(3.0, Math.max(0.0, Math.abs(currentWeeklyRate) / Math.abs(plan.weekly_rate_kg)));
  }

  // Progress %
  const startWeight = currentTrendWeight - dailyTrendRate * daysSinceStart;
  const targetChange = targetWeight - startWeight;
  let progressPercentage = 100.0;
  if (Math.abs(targetChange) >= 0.1) {
    const totalChange = currentTrendWeight - startWeight;
    progressPercentage = Math.max(0, Math.min(150, (totalChange / targetChange) * 100));
  }

  // Messages
  let progressMessage: string;
  if (goalReached) {
    progressMessage = "Meta alcanzada!";
  } else if (estimatedDaysToGoal == null) {
    if (!isOnTrack) {
      progressMessage = goal === "lose" ? "Ajusta para empezar a perder" : "Ajusta para empezar a ganar";
    } else {
      progressMessage = "Calculando proyeccion...";
    }
  } else if (estimatedDaysToGoal === 0) {
    progressMessage = "Meta alcanzada!";
  } else if (estimatedDaysToGoal < 7) {
    progressMessage = `~${estimatedDaysToGoal} dias para tu meta`;
  } else if (estimatedDaysToGoal < 30) {
    const weeks = Math.round(estimatedDaysToGoal / 7);
    progressMessage = `~${weeks} ${weeks === 1 ? "semana" : "semanas"} para tu meta`;
  } else if (estimatedDaysToGoal < 365) {
    const months = Math.round(estimatedDaysToGoal / 30);
    progressMessage = `~${months} ${months === 1 ? "mes" : "meses"} para tu meta`;
  } else {
    progressMessage = "Meta a largo plazo";
  }

  let paceMessage: string;
  if (goal === "maintain") {
    if (Math.abs(currentWeeklyRate) < 0.1) {
      paceMessage = "Peso estable";
    } else {
      paceMessage = `Fluctuacion: ${formatRate(currentWeeklyRate)}`;
    }
  } else {
    const currentStr = formatRate(currentWeeklyRate);
    const targetRate = goal === "lose" ? -plan.weekly_rate_kg : plan.weekly_rate_kg;
    const targetStr = formatRate(targetRate);

    if (paceRatio < 0.5) {
      paceMessage = `Ritmo: ${currentStr} (objetivo: ${targetStr})`;
    } else if (paceRatio > 1.2) {
      paceMessage = `Ritmo: ${currentStr} — mas rapido que objetivo`;
    } else {
      paceMessage = `Ritmo: ${currentStr} — en objetivo`;
    }
  }

  return {
    goalWeightKg: targetWeight,
    currentTrendWeight,
    latestWeight: trendResult.latestWeight,
    dailyTrendRate,
    goal,
    targetWeeklyRateKg: plan.weekly_rate_kg,
    planStartDate: plan.start_date,
    daysSinceStart,
    weightDelta,
    isOnTrack,
    goalReached,
    estimatedDaysToGoal,
    estimatedGoalDate,
    currentWeeklyRate,
    paceRatio,
    progressPercentage,
    progressMessage,
    paceMessage,
  };
}

export function generateGoalLine(
  projection: GoalProjection,
  maxDays: number = 90
): ProjectionPoint[] {
  const points: ProjectionPoint[] = [];
  const today = new Date();
  const endDays = projection.estimatedDaysToGoal ?? maxDays;
  const daysToPlot = Math.max(7, Math.min(maxDays, endDays));

  // Start point
  points.push({
    fecha: today.toISOString().split("T")[0],
    projected: projection.currentTrendWeight,
    goal: projection.goalWeightKg,
  });

  // Intermediate points every 7 days
  for (let day = 7; day <= daysToPlot; day += 7) {
    let projected = projection.currentTrendWeight + projection.dailyTrendRate * day;

    if (projection.goal === "lose") {
      projected = Math.max(projected, projection.goalWeightKg);
    } else if (projection.goal === "gain") {
      projected = Math.min(projected, projection.goalWeightKg);
    }

    const futureDate = new Date(today);
    futureDate.setDate(futureDate.getDate() + day);

    points.push({
      fecha: futureDate.toISOString().split("T")[0],
      projected,
      goal: projection.goalWeightKg,
    });
  }

  return points;
}
