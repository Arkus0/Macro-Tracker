// ============================================================================
// Database entity types for Pocket Diet
// ============================================================================

export interface WeightEntry {
  id: number;
  user_id: string;
  fecha: string; // ISO date YYYY-MM-DD
  peso: number | null;
  kcal: number | null;
}

export interface FoodEntry {
  id: number;
  user_id: string;
  fecha: string;
  tipo: MealType;
  comida: string;
  marca: string | null;
  gramos: number;
  kcal: number;
  proteinas: number;
  carbs: number;
  grasas: number;
}

export type MealType = "Desayuno" | "Comida" | "Cena" | "Snack";

export const MEAL_TYPES: MealType[] = ["Desayuno", "Comida", "Cena", "Snack"];

export interface FoodCatalogEntry {
  id: number;
  user_id: string;
  comida: string;
  marca: string | null;
  kcal_100g: number;
  proteinas_100g: number;
  carbs_100g: number;
  grasas_100g: number;
}

export interface CoachPlan {
  id: number;
  user_id: string;
  goal: "lose" | "maintain" | "gain";
  weekly_rate_kg: number;
  initial_tdee: number;
  starting_weight: number;
  target_weight: number | null;
  start_date: string;
  last_checkin_date: string | null;
  current_kcal_target: number;
  macro_preset: string;
  auto_apply_checkin: boolean;
  active: boolean;
}

export interface Targets {
  id: number;
  user_id: string;
  valid_from: string;
  kcal_target: number;
  protein_target: number | null;
  carbs_target: number | null;
  fat_target: number | null;
  fiber_target: number | null;
  sugar_limit: number | null;
  saturated_fat_limit: number | null;
  sodium_limit: number | null;
  notes: string | null;
  day_type: DayType;
  created_at: string;
}

export type DayType = "default" | "training" | "rest";

export interface Recipe {
  id: number;
  user_id: string;
  name: string;
  description: string | null;
  total_kcal: number;
  total_protein: number;
  total_carbs: number;
  total_fat: number;
  total_grams: number;
  servings: number;
  serving_name: string | null;
  created_at: string;
}

export interface RecipeItem {
  id: number;
  recipe_id: number;
  comida: string;
  marca: string | null;
  gramos: number;
  kcal: number;
  proteinas: number;
  carbs: number;
  grasas: number;
}

export interface MealTemplate {
  id: number;
  user_id: string;
  name: string;
  use_count: number;
  last_used: string | null;
  created_at: string;
}

export interface MealTemplateItem {
  id: number;
  template_id: number;
  comida: string;
  marca: string | null;
  gramos: number;
  kcal: number;
  proteinas: number;
  carbs: number;
  grasas: number;
}

export interface CheckinHistory {
  id: number;
  user_id: string;
  checkin_date: string;
  estimated_tdee: number;
  avg_daily_kcal: number;
  trend_weight_start: number;
  trend_weight_end: number;
  proposed_kcal_target: number;
  applied: boolean;
}

export interface BodyMeasurement {
  id: number;
  user_id: string;
  fecha: string;
  cintura: number | null;
  pecho: number | null;
  caderas: number | null;
  brazos: number | null;
  muslos: number | null;
  cuello: number | null;
  body_fat_pct: number | null;
}

export interface DayTypeSchedule {
  id: number;
  user_id: string;
  day_of_week: number; // 0=Monday, 6=Sunday
  day_type: "training" | "rest";
}

export interface DayTypeOverride {
  id: number;
  user_id: string;
  fecha: string;
  day_type: "training" | "rest";
}

export interface UserProfile {
  id: number;
  user_id: string;
  height_cm: number | null;
  birth_year: number | null;
  sex: "M" | "F" | null;
  activity_level: "sedentary" | "light" | "moderate" | "active" | "very_active" | null;
  created_at: string;
  updated_at: string;
}

// ============================================================================
// Derived / computed types
// ============================================================================

export interface FoodDailyTotals {
  fecha: string;
  kcal: number;
  proteinas: number;
  carbs: number;
  grasas: number;
}

export interface FrequentFood {
  comida: string;
  marca: string | null;
  freq: number;
  kcal_100g: number;
  proteinas_100g: number;
  carbs_100g: number;
  grasas_100g: number;
}

export interface MacroPreset {
  name: string;
  key: string;
  protein_pct: number;
  carbs_pct: number;
  fat_pct: number;
}

export interface FoodPer100g {
  comida: string;
  marca: string | null;
  kcal_100g: number;
  proteinas_100g: number;
  carbs_100g: number;
  grasas_100g: number;
}
