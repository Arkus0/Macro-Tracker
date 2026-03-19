-- ============================================================================
-- Pocket Diet: Initial Schema for Supabase (PostgreSQL)
-- Migrated from SQLite. All tables use auth.users(id) as user reference.
-- ============================================================================

-- Weight entries (daily weight + kcal)
CREATE TABLE weight_entries (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    fecha DATE NOT NULL,
    peso REAL,
    kcal REAL,
    UNIQUE(user_id, fecha)
);

-- Food log (individual food entries with macros)
CREATE TABLE food_log (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    fecha DATE NOT NULL,
    tipo TEXT NOT NULL,
    comida TEXT NOT NULL,
    marca TEXT,
    gramos REAL,
    kcal REAL,
    proteinas REAL,
    carbs REAL,
    grasas REAL
);

-- Personal food catalog (favorites)
CREATE TABLE food_catalog (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    comida TEXT NOT NULL,
    marca TEXT,
    kcal_100g REAL,
    proteinas_100g REAL,
    carbs_100g REAL,
    grasas_100g REAL
);

-- Coach plans (adaptive coaching configuration)
CREATE TABLE coach_plans (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    goal TEXT NOT NULL,
    weekly_rate_kg REAL NOT NULL,
    initial_tdee INTEGER NOT NULL,
    starting_weight REAL NOT NULL,
    target_weight REAL,
    start_date DATE NOT NULL,
    last_checkin_date DATE,
    current_kcal_target INTEGER,
    macro_preset TEXT DEFAULT 'balanced',
    auto_apply_checkin BOOLEAN DEFAULT false,
    active BOOLEAN DEFAULT true
);

-- Macro targets (versioned, with day_type for cycling support)
CREATE TABLE targets (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    valid_from DATE NOT NULL,
    kcal_target INTEGER NOT NULL,
    protein_target REAL,
    carbs_target REAL,
    fat_target REAL,
    fiber_target REAL,
    sugar_limit REAL,
    saturated_fat_limit REAL,
    sodium_limit REAL,
    notes TEXT,
    day_type TEXT DEFAULT 'default',
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Recipes (multi-ingredient)
CREATE TABLE recipes (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    total_kcal INTEGER,
    total_protein REAL,
    total_carbs REAL,
    total_fat REAL,
    total_grams REAL,
    servings INTEGER DEFAULT 1,
    serving_name TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Recipe ingredients
CREATE TABLE recipe_items (
    id BIGSERIAL PRIMARY KEY,
    recipe_id BIGINT NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
    comida TEXT NOT NULL,
    marca TEXT,
    gramos REAL,
    kcal REAL,
    proteinas REAL,
    carbs REAL,
    grasas REAL
);

-- Meal templates (reusable meal sets)
CREATE TABLE meal_templates (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    use_count INTEGER DEFAULT 0,
    last_used DATE,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Meal template items
CREATE TABLE meal_template_items (
    id BIGSERIAL PRIMARY KEY,
    template_id BIGINT NOT NULL REFERENCES meal_templates(id) ON DELETE CASCADE,
    comida TEXT NOT NULL,
    marca TEXT,
    gramos REAL,
    kcal REAL,
    proteinas REAL,
    carbs REAL,
    grasas REAL
);

-- Check-in history (weekly coach check-ins)
CREATE TABLE checkin_history (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    checkin_date DATE NOT NULL,
    estimated_tdee INTEGER,
    avg_daily_kcal REAL,
    trend_weight_start REAL,
    trend_weight_end REAL,
    proposed_kcal_target INTEGER,
    applied BOOLEAN DEFAULT false
);

-- Body measurements
CREATE TABLE body_measurements (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    fecha DATE NOT NULL,
    cintura REAL,
    pecho REAL,
    caderas REAL,
    brazos REAL,
    muslos REAL,
    cuello REAL,
    body_fat_pct REAL
);

-- ============================================================================
-- Indexes
-- ============================================================================

CREATE INDEX idx_weight_entries_user_fecha ON weight_entries(user_id, fecha);
CREATE INDEX idx_food_log_user_fecha ON food_log(user_id, fecha);
CREATE INDEX idx_food_catalog_user ON food_catalog(user_id);
CREATE INDEX idx_coach_plans_user_active ON coach_plans(user_id, active);
CREATE INDEX idx_targets_user_valid ON targets(user_id, valid_from);
CREATE INDEX idx_recipes_user ON recipes(user_id);
CREATE INDEX idx_meal_templates_user ON meal_templates(user_id);
CREATE INDEX idx_checkin_history_user ON checkin_history(user_id);
CREATE INDEX idx_body_measurements_user ON body_measurements(user_id, fecha);

-- ============================================================================
-- Row Level Security (RLS)
-- ============================================================================

ALTER TABLE weight_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE food_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE food_catalog ENABLE ROW LEVEL SECURITY;
ALTER TABLE coach_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE targets ENABLE ROW LEVEL SECURITY;
ALTER TABLE recipes ENABLE ROW LEVEL SECURITY;
ALTER TABLE recipe_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE meal_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE meal_template_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE checkin_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE body_measurements ENABLE ROW LEVEL SECURITY;

-- Policies: users can only access their own data
CREATE POLICY "Users access own weight_entries" ON weight_entries FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users access own food_log" ON food_log FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users access own food_catalog" ON food_catalog FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users access own coach_plans" ON coach_plans FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users access own targets" ON targets FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users access own recipes" ON recipes FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users access own meal_templates" ON meal_templates FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users access own checkin_history" ON checkin_history FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users access own body_measurements" ON body_measurements FOR ALL USING (auth.uid() = user_id);

-- Recipe items: accessible if user owns the parent recipe
CREATE POLICY "Users access own recipe_items" ON recipe_items FOR ALL
  USING (EXISTS (SELECT 1 FROM recipes WHERE recipes.id = recipe_items.recipe_id AND recipes.user_id = auth.uid()));

-- Template items: accessible if user owns the parent template
CREATE POLICY "Users access own meal_template_items" ON meal_template_items FOR ALL
  USING (EXISTS (SELECT 1 FROM meal_templates WHERE meal_templates.id = meal_template_items.template_id AND meal_templates.user_id = auth.uid()));
