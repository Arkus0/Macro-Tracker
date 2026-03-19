/**
 * Adaptive Coach Service — port of services/adaptive_coach.py.
 * Implements MacroFactor-style weekly check-ins with auto-adjusting targets.
 */

import { calculateWeightTrend } from "./weight-trend";

const KCAL_PER_KG = 7700.0;
const MAX_WEEKLY_KCAL_CHANGE = 200;
const MIN_WEIGHIN_DAYS = 3;
const MIN_DIARY_DAYS = 4;
const MIN_KCAL_TARGET = 1200;
const MAX_KCAL_TARGET = 6000;

export type WeightGoal = "lose" | "maintain" | "gain";

export type CheckInStatus = "ready" | "insufficient_data" | "not_enough_time" | "error";

export interface MacroPreset {
  key: string;
  displayName: string;
  description: string;
  proteinPct: number;
  carbsPct: number;
  fatPct: number;
}

export const PRESET_MAP: Record<string, MacroPreset> = {
  low_carb: {
    key: "low_carb",
    displayName: "Low Carb",
    description: "Bajo en carbohidratos, alto en grasas",
    proteinPct: 0.25,
    carbsPct: 0.45,
    fatPct: 0.30,
  },
  balanced: {
    key: "balanced",
    displayName: "Balanceado",
    description: "Distribucion equilibrada",
    proteinPct: 0.30,
    carbsPct: 0.35,
    fatPct: 0.35,
  },
  high_protein: {
    key: "high_protein",
    displayName: "High Protein",
    description: "Alto en proteinas para ganancia muscular",
    proteinPct: 0.40,
    carbsPct: 0.30,
    fatPct: 0.30,
  },
  high_carb: {
    key: "high_carb",
    displayName: "High Carb",
    description: "Alto en carbohidratos para energia",
    proteinPct: 0.25,
    carbsPct: 0.50,
    fatPct: 0.25,
  },
  keto: {
    key: "keto",
    displayName: "Keto",
    description: "Muy bajo en carbohidratos",
    proteinPct: 0.30,
    carbsPct: 0.05,
    fatPct: 0.65,
  },
  custom: {
    key: "custom",
    displayName: "Personalizado",
    description: "Macros ajustados manualmente",
    proteinPct: 0.30,
    carbsPct: 0.35,
    fatPct: 0.35,
  },
};

export interface MacroGrams {
  protein: number;
  carbs: number;
  fat: number;
  totalKcal: number;
}

export function calculateMacroGrams(preset: MacroPreset, totalKcal: number): MacroGrams {
  const protein = Math.round((totalKcal * preset.proteinPct) / 4);
  const carbs = Math.round((totalKcal * preset.carbsPct) / 4);
  const fat = Math.round((totalKcal * preset.fatPct) / 9);
  return { protein, carbs, fat, totalKcal: protein * 4 + carbs * 4 + fat * 9 };
}

export interface WeeklyData {
  startDate: string;
  endDate: string;
  avgDailyKcal: number;
  trendWeightStart: number;
  trendWeightEnd: number;
  daysWithDiary: number;
  daysWithWeighins: number;
  trendChangeKg: number;
  calculatedTdee: number;
  hasEnoughData: boolean;
}

export interface CheckInExplanation {
  line1: string;
  line2: string;
  line3: string;
  line4: string;
  line5: string;
  allLines: string[];
}

export interface CheckInResult {
  status: CheckInStatus;
  weeklyData: WeeklyData;
  estimatedTdee: number;
  proposedKcalTarget: number;
  proposedMacros: MacroGrams;
  explanation: CheckInExplanation;
  wasClamped: boolean;
  dailyAdjustmentKcal: number;
  errorMessage?: string;
}

export function getDailyAdjustment(goal: WeightGoal, weeklyRateKg: number): number {
  const adjustment = Math.round((weeklyRateKg * KCAL_PER_KG) / 7);
  if (goal === "lose") return -Math.abs(adjustment);
  if (goal === "gain") return Math.abs(adjustment);
  return 0;
}

export function calculateCheckin(
  plan: {
    goal: WeightGoal;
    weekly_rate_kg: number;
    current_kcal_target: number | null;
    initial_tdee: number;
    macro_preset: string;
  },
  weeklyData: WeeklyData
): CheckInResult {
  const emptyMacros: MacroGrams = { protein: 0, carbs: 0, fat: 0, totalKcal: 0 };

  if (!weeklyData.hasEnoughData) {
    return {
      status: "insufficient_data",
      weeklyData,
      estimatedTdee: 0,
      proposedKcalTarget: 2000,
      proposedMacros: emptyMacros,
      explanation: {
        line1: "",
        line2: "",
        line3: "",
        line4: "",
        line5: "",
        allLines: [],
      },
      wasClamped: false,
      dailyAdjustmentKcal: 0,
      errorMessage: `Se necesitan al menos ${MIN_DIARY_DAYS} dias de diario y ${MIN_WEIGHIN_DAYS} pesajes. Tienes: ${weeklyData.daysWithDiary} dias de diario, ${weeklyData.daysWithWeighins} pesajes.`,
    };
  }

  const calculatedTdee = weeklyData.calculatedTdee;
  const adjustment = getDailyAdjustment(plan.goal, plan.weekly_rate_kg);
  let newTarget = Math.round(calculatedTdee + adjustment);

  // Clamp: max weekly change
  let wasClamped = false;
  const previousTarget = plan.current_kcal_target || plan.initial_tdee;
  const minAllowed = previousTarget - MAX_WEEKLY_KCAL_CHANGE;
  const maxAllowed = previousTarget + MAX_WEEKLY_KCAL_CHANGE;

  if (newTarget < minAllowed) {
    newTarget = minAllowed;
    wasClamped = true;
  } else if (newTarget > maxAllowed) {
    newTarget = maxAllowed;
    wasClamped = true;
  }

  if (newTarget < MIN_KCAL_TARGET) {
    newTarget = MIN_KCAL_TARGET;
    wasClamped = true;
  } else if (newTarget > MAX_KCAL_TARGET) {
    newTarget = MAX_KCAL_TARGET;
    wasClamped = true;
  }

  // Calculate macros
  const preset = PRESET_MAP[plan.macro_preset] || PRESET_MAP.balanced;
  const macroGrams = calculateMacroGrams(preset, newTarget);

  // Build explanation
  const sign = weeklyData.trendChangeKg > 0 ? "+" : "";
  const adjText =
    adjustment < 0
      ? `${adjustment}kcal (deficit)`
      : adjustment > 0
        ? `+${adjustment}kcal (superavit)`
        : "0kcal (mantenimiento)";

  const explanation: CheckInExplanation = {
    line1: `Ingesta media: ${Math.round(weeklyData.avgDailyKcal)} kcal/dia`,
    line2: `Cambio de trend: ${sign}${weeklyData.trendChangeKg.toFixed(2)} kg`,
    line3: `TDEE estimado: ${Math.round(calculatedTdee)} kcal`,
    line4: `Ajuste objetivo: ${adjText}`,
    line5: `Nuevo target: ${newTarget} kcal`,
    allLines: [],
  };
  explanation.allLines = [
    explanation.line1,
    explanation.line2,
    explanation.line3,
    explanation.line4,
    explanation.line5,
  ];

  return {
    status: "ready",
    weeklyData,
    estimatedTdee: Math.round(calculatedTdee),
    proposedKcalTarget: newTarget,
    proposedMacros: macroGrams,
    explanation,
    wasClamped,
    dailyAdjustmentKcal: adjustment,
  };
}

export function buildWeeklyData(
  weightEntries: { fecha: string; peso: number | null }[],
  foodDailyTotals: { fecha: string; kcal: number }[],
  startDate: string,
  endDate: string
): WeeklyData {
  // Filter to period
  const periodWeights = weightEntries.filter(
    (w) => w.peso != null && w.fecha >= startDate && w.fecha <= endDate
  );
  const periodFood = foodDailyTotals.filter(
    (f) => f.fecha >= startDate && f.fecha <= endDate
  );

  // Avg daily kcal
  const kcalValues = periodFood.filter((f) => f.kcal > 0).map((f) => f.kcal);
  const avgKcal =
    kcalValues.length > 0
      ? kcalValues.reduce((a, b) => a + b, 0) / kcalValues.length
      : 0;

  // Trend weights
  let trendStart = 0;
  let trendEnd = 0;

  const allWeights = weightEntries.filter((w) => w.peso != null);
  if (allWeights.length >= 2) {
    const result = calculateWeightTrend(allWeights);
    trendEnd = result.emaWeight;

    const earlyWeights = allWeights.filter((w) => w.fecha <= startDate);
    if (earlyWeights.length >= 2) {
      const earlyResult = calculateWeightTrend(earlyWeights);
      trendStart = earlyResult.emaWeight;
    } else if (earlyWeights.length > 0) {
      trendStart = earlyWeights[earlyWeights.length - 1].peso!;
    } else {
      trendStart = trendEnd;
    }
  } else if (allWeights.length > 0) {
    trendStart = trendEnd = allWeights[0].peso!;
  }

  const trendChangeKg = trendEnd - trendStart;
  const startD = new Date(startDate + "T00:00:00");
  const endD = new Date(endDate + "T00:00:00");
  const days = Math.max(1, (endD.getTime() - startD.getTime()) / (1000 * 60 * 60 * 24));
  const calculatedTdee = avgKcal - (trendChangeKg * KCAL_PER_KG) / days;

  return {
    startDate,
    endDate,
    avgDailyKcal: avgKcal,
    trendWeightStart: trendStart,
    trendWeightEnd: trendEnd,
    daysWithDiary: kcalValues.length,
    daysWithWeighins: periodWeights.length,
    trendChangeKg,
    calculatedTdee,
    hasEnoughData:
      kcalValues.length >= MIN_DIARY_DAYS && periodWeights.length >= MIN_WEIGHIN_DAYS,
  };
}
