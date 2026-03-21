// ============================================================================
// Formula-based TDEE (Mifflin-St Jeor)
// SECONDARY source — empirical TDEE from coach is the source of truth
// ============================================================================

type Sex = "M" | "F";
type ActivityLevel = "sedentary" | "light" | "moderate" | "active" | "very_active";

const ACTIVITY_FACTORS: Record<ActivityLevel, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
  very_active: 1.9,
};

/**
 * Mifflin-St Jeor equation for BMR, multiplied by activity factor.
 *
 * Men:   (10 * weight_kg) + (6.25 * height_cm) - (5 * age) + 5
 * Women: (10 * weight_kg) + (6.25 * height_cm) - (5 * age) - 161
 *
 * Use this ONLY when:
 * - Coach has no empirical data (< 3 weigh-ins or < 4 diary days)
 * - Last check-in is older than 30 days
 * - No active coach plan exists
 */
export function calculateFormulaTDEE(
  weightKg: number,
  heightCm: number,
  age: number,
  sex: Sex,
  activityLevel: ActivityLevel
): number {
  const bmr =
    sex === "M"
      ? 10 * weightKg + 6.25 * heightCm - 5 * age + 5
      : 10 * weightKg + 6.25 * heightCm - 5 * age - 161;

  return Math.round(bmr * ACTIVITY_FACTORS[activityLevel]);
}

/**
 * Calculate BMI from weight and height.
 */
export function calculateBMI(weightKg: number, heightCm: number): number {
  const heightM = heightCm / 100;
  return weightKg / (heightM * heightM);
}

/**
 * Get BMI category label.
 */
export function getBMICategory(bmi: number): string {
  if (bmi < 18.5) return "Bajo peso";
  if (bmi < 25) return "Normal";
  if (bmi < 30) return "Sobrepeso";
  return "Obesidad";
}
