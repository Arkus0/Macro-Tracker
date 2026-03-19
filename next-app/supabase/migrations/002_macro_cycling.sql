-- ============================================================================
-- Macro Cycling: day type schedule and overrides
-- ============================================================================

-- Weekly schedule (which days are training/rest)
CREATE TABLE day_type_schedule (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    day_of_week INTEGER NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
    day_type TEXT NOT NULL DEFAULT 'rest',
    UNIQUE(user_id, day_of_week)
);

-- Per-date overrides (e.g., skipped training, added extra session)
CREATE TABLE day_type_overrides (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    fecha DATE NOT NULL,
    day_type TEXT NOT NULL,
    UNIQUE(user_id, fecha)
);

-- Indexes
CREATE INDEX idx_day_type_schedule_user ON day_type_schedule(user_id);
CREATE INDEX idx_day_type_overrides_user_fecha ON day_type_overrides(user_id, fecha);

-- RLS
ALTER TABLE day_type_schedule ENABLE ROW LEVEL SECURITY;
ALTER TABLE day_type_overrides ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users access own day_type_schedule" ON day_type_schedule FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users access own day_type_overrides" ON day_type_overrides FOR ALL USING (auth.uid() = user_id);
