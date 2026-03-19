/**
 * Advanced weight trend analysis.
 * Port of services/weight_trend.py (originally from Juan-Tracker).
 * Implements EMA, Holt-Winters, phase detection, and predictions.
 */

export type WeightPhase = "losing" | "maintaining" | "gaining" | "insufficient_data";

export interface TrendConfig {
  emaPeriod: number;
  hwPeriod: number;
  phaseChangeThreshold: number; // kg/week
}

const DEFAULT_CONFIG: TrendConfig = {
  emaPeriod: 7,
  hwPeriod: 7,
  phaseChangeThreshold: 0.2,
};

export interface WeightTrendResult {
  emaWeight: number;
  emaHistory: number[];
  hwLevel: number;
  hwTrend: number; // kg/day
  hwPrediction7d: number;
  hwPrediction30d: number;
  phase: WeightPhase;
  daysInPhase: number;
  weeklyRate: number; // kg/week
  latestWeight: number;
  trendWeight: number;
}

export function calculateWeightTrend(
  weightEntries: { fecha: string; peso: number | null }[],
  config: TrendConfig = DEFAULT_CONFIG
): WeightTrendResult {
  const weights = weightEntries
    .filter((e) => e.peso != null)
    .map((e) => e.peso as number);

  if (weights.length === 0) {
    return {
      emaWeight: 0,
      emaHistory: [],
      hwLevel: 0,
      hwTrend: 0,
      hwPrediction7d: 0,
      hwPrediction30d: 0,
      phase: "insufficient_data",
      daysInPhase: 0,
      weeklyRate: 0,
      latestWeight: 0,
      trendWeight: 0,
    };
  }

  if (weights.length === 1) {
    return {
      emaWeight: weights[0],
      emaHistory: [weights[0]],
      hwLevel: weights[0],
      hwTrend: 0,
      hwPrediction7d: weights[0],
      hwPrediction30d: weights[0],
      phase: "insufficient_data",
      daysInPhase: 0,
      weeklyRate: 0,
      latestWeight: weights[0],
      trendWeight: weights[0],
    };
  }

  // EMA
  const emaHistory = calculateEMA(weights, config.emaPeriod);
  const emaWeight = emaHistory[emaHistory.length - 1];

  // Holt-Winters
  const [hwLevel, hwTrend] = calculateHoltWinters(weights, config.hwPeriod);

  // Predictions
  const hwPrediction7d = hwLevel + hwTrend * 7;
  const hwPrediction30d = hwLevel + hwTrend * 30;

  // Phase detection
  const weeklyRate = hwTrend * 7;
  const { phase, daysInPhase } = detectPhase(weights, weeklyRate, config.phaseChangeThreshold);

  return {
    emaWeight,
    emaHistory,
    hwLevel,
    hwTrend,
    hwPrediction7d,
    hwPrediction30d,
    phase,
    daysInPhase,
    weeklyRate,
    latestWeight: weights[weights.length - 1],
    trendWeight: emaWeight,
  };
}

function calculateEMA(weights: number[], period: number): number[] {
  const alpha = 2.0 / (period + 1);
  const ema = [weights[0]];
  for (let i = 1; i < weights.length; i++) {
    ema.push(alpha * weights[i] + (1 - alpha) * ema[ema.length - 1]);
  }
  return ema;
}

function calculateHoltWinters(
  weights: number[],
  period: number
): [number, number] {
  if (weights.length < 2) {
    return [weights.length > 0 ? weights[0] : 0, 0];
  }

  const alpha = 2.0 / (period + 1);
  const beta = 0.3;

  let level = weights[0];
  let trend = weights[1] - weights[0];

  for (let i = 1; i < weights.length; i++) {
    const prevLevel = level;
    level = alpha * weights[i] + (1 - alpha) * (level + trend);
    trend = beta * (level - prevLevel) + (1 - beta) * trend;
  }

  return [level, trend];
}

function detectPhase(
  weights: number[],
  weeklyRate: number,
  threshold: number
): { phase: WeightPhase; daysInPhase: number } {
  if (weights.length < 7) {
    return { phase: "insufficient_data", daysInPhase: 0 };
  }

  let phase: WeightPhase;
  if (weeklyRate < -threshold) {
    phase = "losing";
  } else if (weeklyRate > threshold) {
    phase = "gaining";
  } else {
    phase = "maintaining";
  }

  // Count days in phase
  let days = 0;
  for (let i = weights.length - 1; i > Math.max(0, weights.length - 90); i--) {
    if (i === 0) break;
    const localRate = (weights[i] - weights[i - 1]) * 7;
    if (phase === "losing" && localRate >= threshold) break;
    if (phase === "gaining" && localRate <= -threshold) break;
    if (phase === "maintaining" && Math.abs(localRate) > threshold) break;
    days++;
  }

  return { phase, daysInPhase: Math.max(days, 1) };
}
