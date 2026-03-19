import { SupabaseClient } from "@supabase/supabase-js";
import type {
  WeightEntry,
  FoodEntry,
  FoodCatalogEntry,
  CoachPlan,
  Targets,
  Recipe,
  RecipeItem,
  MealTemplate,
  MealTemplateItem,
  CheckinHistory,
  BodyMeasurement,
  FoodDailyTotals,
  FrequentFood,
  DayType,
  DayTypeSchedule,
  DayTypeOverride,
  MealType,
} from "./types";

// ============================================================================
// WEIGHT ENTRIES
// ============================================================================

export async function saveWeightEntry(
  supabase: SupabaseClient,
  userId: string,
  fecha: string,
  peso: number | null,
  kcal: number | null
) {
  const { error } = await supabase
    .from("weight_entries")
    .upsert({ user_id: userId, fecha, peso, kcal }, { onConflict: "user_id,fecha" });
  if (error) throw error;
}

export async function getWeightEntries(
  supabase: SupabaseClient,
  userId: string,
  limit?: number
): Promise<WeightEntry[]> {
  let query = supabase
    .from("weight_entries")
    .select("*")
    .eq("user_id", userId);

  if (limit) {
    query = query.order("fecha", { ascending: false }).limit(limit);
  } else {
    query = query.order("fecha", { ascending: true });
  }

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

export async function getWeightEntryByDate(
  supabase: SupabaseClient,
  userId: string,
  fecha: string
): Promise<WeightEntry | null> {
  const { data, error } = await supabase
    .from("weight_entries")
    .select("*")
    .eq("user_id", userId)
    .eq("fecha", fecha)
    .maybeSingle();
  if (error) throw error;
  return data;
}

// ============================================================================
// FOOD LOG
// ============================================================================

export async function addFoodEntry(
  supabase: SupabaseClient,
  userId: string,
  fecha: string,
  tipo: MealType,
  comida: string,
  marca: string | null,
  gramos: number,
  kcal: number,
  proteinas: number,
  carbs: number,
  grasas: number
) {
  const { error } = await supabase.from("food_log").insert({
    user_id: userId,
    fecha,
    tipo,
    comida,
    marca,
    gramos,
    kcal,
    proteinas,
    carbs,
    grasas,
  });
  if (error) throw error;
}

export async function getFoodEntries(
  supabase: SupabaseClient,
  userId: string,
  fecha?: string
): Promise<FoodEntry[]> {
  let query = supabase
    .from("food_log")
    .select("*")
    .eq("user_id", userId);

  if (fecha) {
    query = query.eq("fecha", fecha).order("id", { ascending: true });
  } else {
    query = query.order("fecha", { ascending: true }).order("id", { ascending: true });
  }

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

export async function deleteFoodEntry(supabase: SupabaseClient, entryId: number) {
  const { error } = await supabase.from("food_log").delete().eq("id", entryId);
  if (error) throw error;
}

export async function copyFoodEntries(
  supabase: SupabaseClient,
  userId: string,
  fromDate: string,
  toDate: string
) {
  const entries = await getFoodEntries(supabase, userId, fromDate);
  if (entries.length === 0) return;

  const newEntries = entries.map((e) => ({
    user_id: userId,
    fecha: toDate,
    tipo: e.tipo,
    comida: e.comida,
    marca: e.marca,
    gramos: e.gramos,
    kcal: e.kcal,
    proteinas: e.proteinas,
    carbs: e.carbs,
    grasas: e.grasas,
  }));

  const { error } = await supabase.from("food_log").insert(newEntries);
  if (error) throw error;
}

export async function getFoodDailyTotals(
  supabase: SupabaseClient,
  userId: string,
  startDate?: string,
  endDate?: string
): Promise<FoodDailyTotals[]> {
  const { data, error } = await supabase.rpc("get_food_daily_totals", {
    p_user_id: userId,
    p_start_date: startDate || null,
    p_end_date: endDate || null,
  });
  if (error) throw error;
  return data || [];
}

export async function getFrequentFoods(
  supabase: SupabaseClient,
  userId: string,
  limit: number = 20
): Promise<FrequentFood[]> {
  const { data, error } = await supabase.rpc("get_frequent_foods", {
    p_user_id: userId,
    p_limit: limit,
  });
  if (error) throw error;
  return data || [];
}

// ============================================================================
// FOOD CATALOG
// ============================================================================

export async function addCatalogEntry(
  supabase: SupabaseClient,
  userId: string,
  comida: string,
  marca: string | null,
  kcal100g: number,
  proteinas100g: number,
  carbs100g: number,
  grasas100g: number
) {
  // Check if already exists
  const { data: existing } = await supabase
    .from("food_catalog")
    .select("id")
    .eq("user_id", userId)
    .eq("comida", comida)
    .eq("marca", marca || "")
    .maybeSingle();

  if (!existing) {
    const { error } = await supabase.from("food_catalog").insert({
      user_id: userId,
      comida,
      marca,
      kcal_100g: kcal100g,
      proteinas_100g: proteinas100g,
      carbs_100g: carbs100g,
      grasas_100g: grasas100g,
    });
    if (error) throw error;
  }
}

export async function getCatalog(
  supabase: SupabaseClient,
  userId: string
): Promise<FoodCatalogEntry[]> {
  const { data, error } = await supabase
    .from("food_catalog")
    .select("*")
    .eq("user_id", userId)
    .order("comida");
  if (error) throw error;
  return data || [];
}

// ============================================================================
// COACH PLANS
// ============================================================================

export async function saveCoachPlan(
  supabase: SupabaseClient,
  userId: string,
  goal: string,
  weeklyRateKg: number,
  initialTdee: number,
  startingWeight: number,
  targetWeight: number | null,
  startDate: string,
  macroPreset: string = "balanced"
): Promise<number> {
  // Deactivate old plans
  await supabase
    .from("coach_plans")
    .update({ active: false })
    .eq("user_id", userId)
    .eq("active", true);

  const { data, error } = await supabase
    .from("coach_plans")
    .insert({
      user_id: userId,
      goal,
      weekly_rate_kg: weeklyRateKg,
      initial_tdee: initialTdee,
      starting_weight: startingWeight,
      target_weight: targetWeight,
      start_date: startDate,
      current_kcal_target: initialTdee,
      macro_preset: macroPreset,
      active: true,
    })
    .select("id")
    .single();
  if (error) throw error;
  return data.id;
}

export async function getActiveCoachPlan(
  supabase: SupabaseClient,
  userId: string
): Promise<CoachPlan | null> {
  const { data, error } = await supabase
    .from("coach_plans")
    .select("*")
    .eq("user_id", userId)
    .eq("active", true)
    .order("id", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function updateCoachPlan(
  supabase: SupabaseClient,
  planId: number,
  updates: Partial<CoachPlan>
) {
  const { error } = await supabase
    .from("coach_plans")
    .update(updates)
    .eq("id", planId);
  if (error) throw error;
}

// ============================================================================
// TARGETS
// ============================================================================

export async function saveTargets(
  supabase: SupabaseClient,
  userId: string,
  validFrom: string,
  kcalTarget: number,
  options: {
    proteinTarget?: number | null;
    carbsTarget?: number | null;
    fatTarget?: number | null;
    fiberTarget?: number | null;
    sugarLimit?: number | null;
    saturatedFatLimit?: number | null;
    sodiumLimit?: number | null;
    notes?: string | null;
    dayType?: DayType;
  } = {}
): Promise<number> {
  const { data, error } = await supabase
    .from("targets")
    .insert({
      user_id: userId,
      valid_from: validFrom,
      kcal_target: kcalTarget,
      protein_target: options.proteinTarget ?? null,
      carbs_target: options.carbsTarget ?? null,
      fat_target: options.fatTarget ?? null,
      fiber_target: options.fiberTarget ?? null,
      sugar_limit: options.sugarLimit ?? null,
      saturated_fat_limit: options.saturatedFatLimit ?? null,
      sodium_limit: options.sodiumLimit ?? null,
      notes: options.notes ?? null,
      day_type: options.dayType ?? "default",
    })
    .select("id")
    .single();
  if (error) throw error;
  return data.id;
}

export async function getActiveTargets(
  supabase: SupabaseClient,
  userId: string,
  forDate?: string,
  dayType?: DayType
): Promise<Targets | null> {
  const dateStr = forDate || new Date().toISOString().split("T")[0];

  let query = supabase
    .from("targets")
    .select("*")
    .eq("user_id", userId)
    .lte("valid_from", dateStr);

  if (dayType && dayType !== "default") {
    // Get day-specific target, fallback to default
    query = query.in("day_type", [dayType, "default"]);
  }

  const { data, error } = await query
    .order("valid_from", { ascending: false })
    .order("day_type", { ascending: true }) // specific type comes before 'default'
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function getTargetsHistory(
  supabase: SupabaseClient,
  userId: string
): Promise<Targets[]> {
  const { data, error } = await supabase
    .from("targets")
    .select("*")
    .eq("user_id", userId)
    .order("valid_from", { ascending: false });
  if (error) throw error;
  return data || [];
}

// ============================================================================
// RECIPES
// ============================================================================

export async function saveRecipe(
  supabase: SupabaseClient,
  userId: string,
  name: string,
  description: string | null,
  items: Omit<RecipeItem, "id" | "recipe_id">[],
  servings: number = 1,
  servingName: string | null = null
): Promise<number> {
  const totalKcal = items.reduce((s, i) => s + (i.kcal || 0), 0);
  const totalProtein = items.reduce((s, i) => s + (i.proteinas || 0), 0);
  const totalCarbs = items.reduce((s, i) => s + (i.carbs || 0), 0);
  const totalFat = items.reduce((s, i) => s + (i.grasas || 0), 0);
  const totalGrams = items.reduce((s, i) => s + (i.gramos || 0), 0);

  const { data, error } = await supabase
    .from("recipes")
    .insert({
      user_id: userId,
      name,
      description,
      total_kcal: totalKcal,
      total_protein: totalProtein,
      total_carbs: totalCarbs,
      total_fat: totalFat,
      total_grams: totalGrams,
      servings,
      serving_name: servingName,
    })
    .select("id")
    .single();
  if (error) throw error;

  const recipeId = data.id;
  const recipeItems = items.map((item) => ({
    recipe_id: recipeId,
    ...item,
  }));

  if (recipeItems.length > 0) {
    const { error: itemsError } = await supabase
      .from("recipe_items")
      .insert(recipeItems);
    if (itemsError) throw itemsError;
  }

  return recipeId;
}

export async function getRecipes(
  supabase: SupabaseClient,
  userId: string
): Promise<Recipe[]> {
  const { data, error } = await supabase
    .from("recipes")
    .select("*")
    .eq("user_id", userId)
    .order("name");
  if (error) throw error;
  return data || [];
}

export async function getRecipeItems(
  supabase: SupabaseClient,
  recipeId: number
): Promise<RecipeItem[]> {
  const { data, error } = await supabase
    .from("recipe_items")
    .select("*")
    .eq("recipe_id", recipeId)
    .order("id");
  if (error) throw error;
  return data || [];
}

export async function deleteRecipe(supabase: SupabaseClient, recipeId: number) {
  const { error } = await supabase.from("recipes").delete().eq("id", recipeId);
  if (error) throw error;
}

// ============================================================================
// MEAL TEMPLATES
// ============================================================================

export async function saveMealTemplate(
  supabase: SupabaseClient,
  userId: string,
  name: string,
  items: Omit<MealTemplateItem, "id" | "template_id">[]
): Promise<number> {
  const { data, error } = await supabase
    .from("meal_templates")
    .insert({ user_id: userId, name })
    .select("id")
    .single();
  if (error) throw error;

  const templateId = data.id;
  const templateItems = items.map((item) => ({
    template_id: templateId,
    ...item,
  }));

  if (templateItems.length > 0) {
    const { error: itemsError } = await supabase
      .from("meal_template_items")
      .insert(templateItems);
    if (itemsError) throw itemsError;
  }

  return templateId;
}

export async function getMealTemplates(
  supabase: SupabaseClient,
  userId: string
): Promise<MealTemplate[]> {
  const { data, error } = await supabase
    .from("meal_templates")
    .select("*")
    .eq("user_id", userId)
    .order("use_count", { ascending: false })
    .order("name");
  if (error) throw error;
  return data || [];
}

export async function getTemplateItems(
  supabase: SupabaseClient,
  templateId: number
): Promise<MealTemplateItem[]> {
  const { data, error } = await supabase
    .from("meal_template_items")
    .select("*")
    .eq("template_id", templateId)
    .order("id");
  if (error) throw error;
  return data || [];
}

export async function useMealTemplate(
  supabase: SupabaseClient,
  userId: string,
  templateId: number,
  fecha: string,
  tipo: MealType
) {
  const items = await getTemplateItems(supabase, templateId);

  const newEntries = items.map((item) => ({
    user_id: userId,
    fecha,
    tipo,
    comida: item.comida,
    marca: item.marca,
    gramos: item.gramos,
    kcal: item.kcal,
    proteinas: item.proteinas,
    carbs: item.carbs,
    grasas: item.grasas,
  }));

  if (newEntries.length > 0) {
    const { error } = await supabase.from("food_log").insert(newEntries);
    if (error) throw error;
  }

  // Update last_used timestamp
  await supabase
    .from("meal_templates")
    .update({ last_used: fecha })
    .eq("id", templateId);
}

export async function deleteMealTemplate(supabase: SupabaseClient, templateId: number) {
  const { error } = await supabase.from("meal_templates").delete().eq("id", templateId);
  if (error) throw error;
}

// ============================================================================
// CHECK-IN HISTORY
// ============================================================================

export async function saveCheckin(
  supabase: SupabaseClient,
  userId: string,
  checkinDate: string,
  estimatedTdee: number,
  avgDailyKcal: number,
  trendWeightStart: number,
  trendWeightEnd: number,
  proposedKcalTarget: number,
  applied: boolean = false
) {
  const { error } = await supabase.from("checkin_history").insert({
    user_id: userId,
    checkin_date: checkinDate,
    estimated_tdee: estimatedTdee,
    avg_daily_kcal: avgDailyKcal,
    trend_weight_start: trendWeightStart,
    trend_weight_end: trendWeightEnd,
    proposed_kcal_target: proposedKcalTarget,
    applied,
  });
  if (error) throw error;
}

export async function getCheckinHistory(
  supabase: SupabaseClient,
  userId: string
): Promise<CheckinHistory[]> {
  const { data, error } = await supabase
    .from("checkin_history")
    .select("*")
    .eq("user_id", userId)
    .order("checkin_date", { ascending: false });
  if (error) throw error;
  return data || [];
}

// ============================================================================
// BODY MEASUREMENTS
// ============================================================================

export async function saveBodyMeasurement(
  supabase: SupabaseClient,
  userId: string,
  fecha: string,
  measurements: {
    cintura?: number | null;
    pecho?: number | null;
    caderas?: number | null;
    brazos?: number | null;
    muslos?: number | null;
    cuello?: number | null;
    bodyFatPct?: number | null;
  }
) {
  const { error } = await supabase.from("body_measurements").insert({
    user_id: userId,
    fecha,
    cintura: measurements.cintura ?? null,
    pecho: measurements.pecho ?? null,
    caderas: measurements.caderas ?? null,
    brazos: measurements.brazos ?? null,
    muslos: measurements.muslos ?? null,
    cuello: measurements.cuello ?? null,
    body_fat_pct: measurements.bodyFatPct ?? null,
  });
  if (error) throw error;
}

export async function getBodyMeasurements(
  supabase: SupabaseClient,
  userId: string
): Promise<BodyMeasurement[]> {
  const { data, error } = await supabase
    .from("body_measurements")
    .select("*")
    .eq("user_id", userId)
    .order("fecha", { ascending: false });
  if (error) throw error;
  return data || [];
}

// ============================================================================
// DAY TYPE (MACRO CYCLING)
// ============================================================================

export async function getDayTypeForDate(
  supabase: SupabaseClient,
  userId: string,
  fecha: string
): Promise<DayType> {
  // 1. Check override
  const { data: override } = await supabase
    .from("day_type_overrides")
    .select("day_type")
    .eq("user_id", userId)
    .eq("fecha", fecha)
    .maybeSingle();

  if (override) return override.day_type as DayType;

  // 2. Check schedule
  const dayOfWeek = new Date(fecha + "T00:00:00").getDay();
  // Convert JS Sunday=0 to Monday=0 format
  const mappedDay = dayOfWeek === 0 ? 6 : dayOfWeek - 1;

  const { data: schedule } = await supabase
    .from("day_type_schedule")
    .select("day_type")
    .eq("user_id", userId)
    .eq("day_of_week", mappedDay)
    .maybeSingle();

  if (schedule) return schedule.day_type as DayType;

  // 3. Default
  return "default";
}

export async function saveDaySchedule(
  supabase: SupabaseClient,
  userId: string,
  schedule: { dayOfWeek: number; dayType: "training" | "rest" }[]
) {
  // Delete existing schedule
  await supabase.from("day_type_schedule").delete().eq("user_id", userId);

  if (schedule.length > 0) {
    const rows = schedule.map((s) => ({
      user_id: userId,
      day_of_week: s.dayOfWeek,
      day_type: s.dayType,
    }));
    const { error } = await supabase.from("day_type_schedule").insert(rows);
    if (error) throw error;
  }
}

export async function getDaySchedule(
  supabase: SupabaseClient,
  userId: string
): Promise<DayTypeSchedule[]> {
  const { data, error } = await supabase
    .from("day_type_schedule")
    .select("*")
    .eq("user_id", userId)
    .order("day_of_week");
  if (error) throw error;
  return data || [];
}

export async function saveDayOverride(
  supabase: SupabaseClient,
  userId: string,
  fecha: string,
  dayType: "training" | "rest"
) {
  const { error } = await supabase
    .from("day_type_overrides")
    .upsert(
      { user_id: userId, fecha, day_type: dayType },
      { onConflict: "user_id,fecha" }
    );
  if (error) throw error;
}

export async function deleteDayOverride(
  supabase: SupabaseClient,
  userId: string,
  fecha: string
) {
  const { error } = await supabase
    .from("day_type_overrides")
    .delete()
    .eq("user_id", userId)
    .eq("fecha", fecha);
  if (error) throw error;
}
