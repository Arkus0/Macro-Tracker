-- ============================================================================
-- RPC functions for aggregate queries (not supported via PostgREST REST API)
-- ============================================================================

-- Get daily food totals (GROUP BY + SUM)
CREATE OR REPLACE FUNCTION get_food_daily_totals(
    p_user_id UUID,
    p_start_date DATE DEFAULT NULL,
    p_end_date DATE DEFAULT NULL
)
RETURNS TABLE (
    fecha DATE,
    kcal REAL,
    proteinas REAL,
    carbs REAL,
    grasas REAL
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT
        fl.fecha,
        COALESCE(SUM(fl.kcal), 0)::REAL AS kcal,
        COALESCE(SUM(fl.proteinas), 0)::REAL AS proteinas,
        COALESCE(SUM(fl.carbs), 0)::REAL AS carbs,
        COALESCE(SUM(fl.grasas), 0)::REAL AS grasas
    FROM food_log fl
    WHERE fl.user_id = p_user_id
      AND (p_start_date IS NULL OR fl.fecha >= p_start_date)
      AND (p_end_date IS NULL OR fl.fecha <= p_end_date)
    GROUP BY fl.fecha
    ORDER BY fl.fecha;
END;
$$;

-- Get most frequently logged foods (GROUP BY + AVG + COUNT)
CREATE OR REPLACE FUNCTION get_frequent_foods(
    p_user_id UUID,
    p_limit INTEGER DEFAULT 20
)
RETURNS TABLE (
    comida TEXT,
    marca TEXT,
    freq BIGINT,
    kcal_100g REAL,
    proteinas_100g REAL,
    carbs_100g REAL,
    grasas_100g REAL
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT
        fl.comida,
        fl.marca,
        COUNT(*)::BIGINT AS freq,
        AVG(fl.kcal * 100.0 / NULLIF(fl.gramos, 0))::REAL AS kcal_100g,
        AVG(fl.proteinas * 100.0 / NULLIF(fl.gramos, 0))::REAL AS proteinas_100g,
        AVG(fl.carbs * 100.0 / NULLIF(fl.gramos, 0))::REAL AS carbs_100g,
        AVG(fl.grasas * 100.0 / NULLIF(fl.gramos, 0))::REAL AS grasas_100g
    FROM food_log fl
    WHERE fl.user_id = p_user_id AND fl.gramos > 0
    GROUP BY fl.comida, fl.marca
    ORDER BY freq DESC
    LIMIT p_limit;
END;
$$;
