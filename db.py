"""
Database layer for Pocket Diet.
SQLite-based, multi-user storage replacing CSV files.
"""

import sqlite3
import hashlib
import os
from datetime import date, datetime
from contextlib import contextmanager

DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "pocket_diet.db")


def get_connection():
    """Get SQLite connection with WAL mode for concurrent reads."""
    conn = sqlite3.connect(DB_PATH, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA foreign_keys=ON")
    return conn


@contextmanager
def get_db():
    """Context manager for database operations."""
    conn = get_connection()
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def init_db():
    """Create all tables if they don't exist."""
    with get_db() as conn:
        conn.executescript("""
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT UNIQUE NOT NULL,
                password_hash TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS weight_entries (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                fecha DATE NOT NULL,
                peso REAL,
                kcal REAL,
                UNIQUE(user_id, fecha),
                FOREIGN KEY (user_id) REFERENCES users(id)
            );

            CREATE TABLE IF NOT EXISTS food_log (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                fecha DATE NOT NULL,
                tipo TEXT NOT NULL,
                comida TEXT NOT NULL,
                marca TEXT,
                gramos REAL,
                kcal REAL,
                proteinas REAL,
                carbs REAL,
                grasas REAL,
                FOREIGN KEY (user_id) REFERENCES users(id)
            );

            CREATE TABLE IF NOT EXISTS food_catalog (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                comida TEXT NOT NULL,
                marca TEXT,
                kcal_100g REAL,
                proteinas_100g REAL,
                carbs_100g REAL,
                grasas_100g REAL,
                FOREIGN KEY (user_id) REFERENCES users(id)
            );

            CREATE TABLE IF NOT EXISTS coach_plans (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                goal TEXT NOT NULL,
                weekly_rate_kg REAL NOT NULL,
                initial_tdee INTEGER NOT NULL,
                starting_weight REAL NOT NULL,
                target_weight REAL,
                start_date DATE NOT NULL,
                last_checkin_date DATE,
                current_kcal_target INTEGER,
                macro_preset TEXT DEFAULT 'balanced',
                auto_apply_checkin BOOLEAN DEFAULT 0,
                active BOOLEAN DEFAULT 1,
                FOREIGN KEY (user_id) REFERENCES users(id)
            );

            CREATE TABLE IF NOT EXISTS targets (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
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
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id)
            );

            CREATE TABLE IF NOT EXISTS recipes (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                name TEXT NOT NULL,
                description TEXT,
                total_kcal INTEGER,
                total_protein REAL,
                total_carbs REAL,
                total_fat REAL,
                total_grams REAL,
                servings INTEGER DEFAULT 1,
                serving_name TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id)
            );

            CREATE TABLE IF NOT EXISTS recipe_items (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                recipe_id INTEGER NOT NULL,
                comida TEXT NOT NULL,
                marca TEXT,
                gramos REAL,
                kcal REAL,
                proteinas REAL,
                carbs REAL,
                grasas REAL,
                FOREIGN KEY (recipe_id) REFERENCES recipes(id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS meal_templates (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                name TEXT NOT NULL,
                use_count INTEGER DEFAULT 0,
                last_used DATE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id)
            );

            CREATE TABLE IF NOT EXISTS meal_template_items (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                template_id INTEGER NOT NULL,
                comida TEXT NOT NULL,
                marca TEXT,
                gramos REAL,
                kcal REAL,
                proteinas REAL,
                carbs REAL,
                grasas REAL,
                FOREIGN KEY (template_id) REFERENCES meal_templates(id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS checkin_history (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                checkin_date DATE NOT NULL,
                estimated_tdee INTEGER,
                avg_daily_kcal REAL,
                trend_weight_start REAL,
                trend_weight_end REAL,
                proposed_kcal_target INTEGER,
                applied BOOLEAN DEFAULT 0,
                FOREIGN KEY (user_id) REFERENCES users(id)
            );

            CREATE TABLE IF NOT EXISTS body_measurements (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                fecha DATE NOT NULL,
                cintura REAL,
                pecho REAL,
                caderas REAL,
                brazos REAL,
                muslos REAL,
                cuello REAL,
                body_fat_pct REAL,
                FOREIGN KEY (user_id) REFERENCES users(id)
            );
        """)


# ============================================================================
# AUTH
# ============================================================================

def hash_password(password):
    """Hash password with SHA-256 + salt."""
    salt = os.urandom(16)
    hashed = hashlib.pbkdf2_hmac("sha256", password.encode(), salt, 100000)
    return salt.hex() + ":" + hashed.hex()


def verify_password(password, stored_hash):
    """Verify password against stored hash."""
    salt_hex, hash_hex = stored_hash.split(":")
    salt = bytes.fromhex(salt_hex)
    hashed = hashlib.pbkdf2_hmac("sha256", password.encode(), salt, 100000)
    return hashed.hex() == hash_hex


def create_user(username, password):
    """Create a new user. Returns user_id or None if username taken."""
    with get_db() as conn:
        try:
            cursor = conn.execute(
                "INSERT INTO users (username, password_hash) VALUES (?, ?)",
                (username, hash_password(password)),
            )
            return cursor.lastrowid
        except sqlite3.IntegrityError:
            return None


def authenticate(username, password):
    """Authenticate user. Returns user_id or None."""
    with get_db() as conn:
        row = conn.execute(
            "SELECT id, password_hash FROM users WHERE username = ?",
            (username,),
        ).fetchone()
        if row and verify_password(password, row["password_hash"]):
            return row["id"]
        return None


# ============================================================================
# WEIGHT ENTRIES
# ============================================================================

def save_weight_entry(user_id, fecha, peso=None, kcal=None):
    """Save or update a weight entry (upsert)."""
    fecha_str = fecha.isoformat() if isinstance(fecha, (date, datetime)) else str(fecha)
    with get_db() as conn:
        conn.execute(
            """INSERT INTO weight_entries (user_id, fecha, peso, kcal)
               VALUES (?, ?, ?, ?)
               ON CONFLICT(user_id, fecha) DO UPDATE SET
                 peso = excluded.peso,
                 kcal = excluded.kcal""",
            (user_id, fecha_str, peso, kcal),
        )


def get_weight_entries(user_id, limit=None):
    """Get weight entries sorted by date."""
    with get_db() as conn:
        query = "SELECT * FROM weight_entries WHERE user_id = ? ORDER BY fecha"
        if limit:
            query += f" DESC LIMIT {limit}"
        return [dict(r) for r in conn.execute(query, (user_id,)).fetchall()]


def get_weight_entry_by_date(user_id, fecha):
    """Check if entry exists for date."""
    fecha_str = fecha.isoformat() if isinstance(fecha, (date, datetime)) else str(fecha)
    with get_db() as conn:
        row = conn.execute(
            "SELECT * FROM weight_entries WHERE user_id = ? AND fecha = ?",
            (user_id, fecha_str),
        ).fetchone()
        return dict(row) if row else None


# ============================================================================
# FOOD LOG
# ============================================================================

def add_food_entry(user_id, fecha, tipo, comida, marca, gramos, kcal, proteinas, carbs, grasas):
    """Add a food log entry."""
    fecha_str = fecha.isoformat() if isinstance(fecha, (date, datetime)) else str(fecha)
    with get_db() as conn:
        conn.execute(
            """INSERT INTO food_log (user_id, fecha, tipo, comida, marca, gramos, kcal, proteinas, carbs, grasas)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (user_id, fecha_str, tipo, comida, marca, gramos, kcal, proteinas, carbs, grasas),
        )


def get_food_entries(user_id, fecha=None):
    """Get food log entries, optionally filtered by date."""
    with get_db() as conn:
        if fecha:
            fecha_str = fecha.isoformat() if isinstance(fecha, (date, datetime)) else str(fecha)
            rows = conn.execute(
                "SELECT * FROM food_log WHERE user_id = ? AND fecha = ? ORDER BY id",
                (user_id, fecha_str),
            ).fetchall()
        else:
            rows = conn.execute(
                "SELECT * FROM food_log WHERE user_id = ? ORDER BY fecha, id",
                (user_id,),
            ).fetchall()
        return [dict(r) for r in rows]


def delete_food_entry(entry_id):
    """Delete a food log entry by ID."""
    with get_db() as conn:
        conn.execute("DELETE FROM food_log WHERE id = ?", (entry_id,))


def copy_food_entries(user_id, from_date, to_date):
    """Copy all food entries from one date to another."""
    from_str = from_date.isoformat() if isinstance(from_date, (date, datetime)) else str(from_date)
    to_str = to_date.isoformat() if isinstance(to_date, (date, datetime)) else str(to_date)
    with get_db() as conn:
        conn.execute(
            """INSERT INTO food_log (user_id, fecha, tipo, comida, marca, gramos, kcal, proteinas, carbs, grasas)
               SELECT user_id, ?, tipo, comida, marca, gramos, kcal, proteinas, carbs, grasas
               FROM food_log WHERE user_id = ? AND fecha = ?""",
            (to_str, user_id, from_str),
        )


def get_food_daily_totals(user_id, start_date=None, end_date=None):
    """Get daily totals for food log entries."""
    with get_db() as conn:
        query = """SELECT fecha, SUM(kcal) as kcal, SUM(proteinas) as proteinas,
                   SUM(carbs) as carbs, SUM(grasas) as grasas
                   FROM food_log WHERE user_id = ?"""
        params = [user_id]
        if start_date:
            start_str = start_date.isoformat() if isinstance(start_date, (date, datetime)) else str(start_date)
            query += " AND fecha >= ?"
            params.append(start_str)
        if end_date:
            end_str = end_date.isoformat() if isinstance(end_date, (date, datetime)) else str(end_date)
            query += " AND fecha <= ?"
            params.append(end_str)
        query += " GROUP BY fecha ORDER BY fecha"
        return [dict(r) for r in conn.execute(query, params).fetchall()]


def get_frequent_foods(user_id, limit=20):
    """Get most frequently logged foods."""
    with get_db() as conn:
        rows = conn.execute(
            """SELECT comida, marca, COUNT(*) as freq,
                      AVG(kcal * 100.0 / NULLIF(gramos, 0)) as kcal_100g,
                      AVG(proteinas * 100.0 / NULLIF(gramos, 0)) as proteinas_100g,
                      AVG(carbs * 100.0 / NULLIF(gramos, 0)) as carbs_100g,
                      AVG(grasas * 100.0 / NULLIF(gramos, 0)) as grasas_100g
               FROM food_log WHERE user_id = ? AND gramos > 0
               GROUP BY comida, marca ORDER BY freq DESC LIMIT ?""",
            (user_id, limit),
        ).fetchall()
        return [dict(r) for r in rows]


# ============================================================================
# FOOD CATALOG
# ============================================================================

def add_catalog_entry(user_id, comida, marca, kcal_100g, proteinas_100g, carbs_100g, grasas_100g):
    """Add to personal food catalog."""
    with get_db() as conn:
        existing = conn.execute(
            "SELECT id FROM food_catalog WHERE user_id = ? AND comida = ? AND marca = ?",
            (user_id, comida, marca),
        ).fetchone()
        if not existing:
            conn.execute(
                """INSERT INTO food_catalog (user_id, comida, marca, kcal_100g, proteinas_100g, carbs_100g, grasas_100g)
                   VALUES (?, ?, ?, ?, ?, ?, ?)""",
                (user_id, comida, marca, kcal_100g, proteinas_100g, carbs_100g, grasas_100g),
            )


def get_catalog(user_id):
    """Get user's food catalog."""
    with get_db() as conn:
        return [dict(r) for r in conn.execute(
            "SELECT * FROM food_catalog WHERE user_id = ? ORDER BY comida",
            (user_id,),
        ).fetchall()]


# ============================================================================
# COACH PLANS
# ============================================================================

def save_coach_plan(user_id, goal, weekly_rate_kg, initial_tdee, starting_weight,
                    target_weight, start_date, macro_preset="balanced"):
    """Create or update the active coach plan."""
    start_str = start_date.isoformat() if isinstance(start_date, (date, datetime)) else str(start_date)
    with get_db() as conn:
        # Deactivate old plans
        conn.execute(
            "UPDATE coach_plans SET active = 0 WHERE user_id = ? AND active = 1",
            (user_id,),
        )
        cursor = conn.execute(
            """INSERT INTO coach_plans (user_id, goal, weekly_rate_kg, initial_tdee,
               starting_weight, target_weight, start_date, current_kcal_target, macro_preset, active)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)""",
            (user_id, goal, weekly_rate_kg, initial_tdee, starting_weight,
             target_weight, start_str, initial_tdee, macro_preset),
        )
        return cursor.lastrowid


def get_active_coach_plan(user_id):
    """Get the active coach plan."""
    with get_db() as conn:
        row = conn.execute(
            "SELECT * FROM coach_plans WHERE user_id = ? AND active = 1 ORDER BY id DESC LIMIT 1",
            (user_id,),
        ).fetchone()
        return dict(row) if row else None


def update_coach_plan(plan_id, **kwargs):
    """Update specific fields of a coach plan."""
    if not kwargs:
        return
    set_parts = []
    values = []
    for key, val in kwargs.items():
        set_parts.append(f"{key} = ?")
        if isinstance(val, (date, datetime)):
            values.append(val.isoformat())
        else:
            values.append(val)
    values.append(plan_id)
    with get_db() as conn:
        conn.execute(
            f"UPDATE coach_plans SET {', '.join(set_parts)} WHERE id = ?",
            values,
        )


# ============================================================================
# TARGETS
# ============================================================================

def save_targets(user_id, valid_from, kcal_target, protein_target=None,
                 carbs_target=None, fat_target=None, fiber_target=None,
                 sugar_limit=None, saturated_fat_limit=None, sodium_limit=None, notes=None):
    """Save a new versioned target."""
    valid_str = valid_from.isoformat() if isinstance(valid_from, (date, datetime)) else str(valid_from)
    with get_db() as conn:
        cursor = conn.execute(
            """INSERT INTO targets (user_id, valid_from, kcal_target, protein_target,
               carbs_target, fat_target, fiber_target, sugar_limit, saturated_fat_limit,
               sodium_limit, notes)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (user_id, valid_str, kcal_target, protein_target, carbs_target,
             fat_target, fiber_target, sugar_limit, saturated_fat_limit,
             sodium_limit, notes),
        )
        return cursor.lastrowid


def get_active_targets(user_id, for_date=None):
    """Get active targets for a date (most recent valid_from <= date)."""
    if for_date is None:
        for_date = date.today()
    date_str = for_date.isoformat() if isinstance(for_date, (date, datetime)) else str(for_date)
    with get_db() as conn:
        row = conn.execute(
            """SELECT * FROM targets WHERE user_id = ? AND valid_from <= ?
               ORDER BY valid_from DESC LIMIT 1""",
            (user_id, date_str),
        ).fetchone()
        return dict(row) if row else None


def get_targets_history(user_id):
    """Get all targets sorted by date."""
    with get_db() as conn:
        return [dict(r) for r in conn.execute(
            "SELECT * FROM targets WHERE user_id = ? ORDER BY valid_from DESC",
            (user_id,),
        ).fetchall()]


# ============================================================================
# RECIPES
# ============================================================================

def save_recipe(user_id, name, description, items, servings=1, serving_name=None):
    """Save a recipe with its items. items = list of dicts with comida, marca, gramos, kcal, proteinas, carbs, grasas."""
    total_kcal = sum(i.get("kcal", 0) or 0 for i in items)
    total_protein = sum(i.get("proteinas", 0) or 0 for i in items)
    total_carbs = sum(i.get("carbs", 0) or 0 for i in items)
    total_fat = sum(i.get("grasas", 0) or 0 for i in items)
    total_grams = sum(i.get("gramos", 0) or 0 for i in items)

    with get_db() as conn:
        cursor = conn.execute(
            """INSERT INTO recipes (user_id, name, description, total_kcal, total_protein,
               total_carbs, total_fat, total_grams, servings, serving_name)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (user_id, name, description, total_kcal, total_protein,
             total_carbs, total_fat, total_grams, servings, serving_name),
        )
        recipe_id = cursor.lastrowid
        for item in items:
            conn.execute(
                """INSERT INTO recipe_items (recipe_id, comida, marca, gramos, kcal, proteinas, carbs, grasas)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
                (recipe_id, item["comida"], item.get("marca", ""),
                 item.get("gramos", 0), item.get("kcal", 0),
                 item.get("proteinas", 0), item.get("carbs", 0), item.get("grasas", 0)),
            )
        return recipe_id


def get_recipes(user_id):
    """Get all recipes for user."""
    with get_db() as conn:
        return [dict(r) for r in conn.execute(
            "SELECT * FROM recipes WHERE user_id = ? ORDER BY name",
            (user_id,),
        ).fetchall()]


def get_recipe_items(recipe_id):
    """Get items for a recipe."""
    with get_db() as conn:
        return [dict(r) for r in conn.execute(
            "SELECT * FROM recipe_items WHERE recipe_id = ? ORDER BY id",
            (recipe_id,),
        ).fetchall()]


def delete_recipe(recipe_id):
    """Delete recipe and its items (cascade)."""
    with get_db() as conn:
        conn.execute("DELETE FROM recipes WHERE id = ?", (recipe_id,))


# ============================================================================
# MEAL TEMPLATES
# ============================================================================

def save_meal_template(user_id, name, items):
    """Save meal template. items = list of dicts."""
    with get_db() as conn:
        cursor = conn.execute(
            "INSERT INTO meal_templates (user_id, name) VALUES (?, ?)",
            (user_id, name),
        )
        template_id = cursor.lastrowid
        for item in items:
            conn.execute(
                """INSERT INTO meal_template_items (template_id, comida, marca, gramos, kcal, proteinas, carbs, grasas)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
                (template_id, item["comida"], item.get("marca", ""),
                 item.get("gramos", 0), item.get("kcal", 0),
                 item.get("proteinas", 0), item.get("carbs", 0), item.get("grasas", 0)),
            )
        return template_id


def get_meal_templates(user_id):
    """Get meal templates sorted by usage."""
    with get_db() as conn:
        return [dict(r) for r in conn.execute(
            "SELECT * FROM meal_templates WHERE user_id = ? ORDER BY use_count DESC, name",
            (user_id,),
        ).fetchall()]


def get_template_items(template_id):
    """Get items for a template."""
    with get_db() as conn:
        return [dict(r) for r in conn.execute(
            "SELECT * FROM meal_template_items WHERE template_id = ? ORDER BY id",
            (template_id,),
        ).fetchall()]


def use_meal_template(user_id, template_id, fecha, tipo):
    """Apply a meal template to a date and increment use count."""
    items = get_template_items(template_id)
    fecha_str = fecha.isoformat() if isinstance(fecha, (date, datetime)) else str(fecha)
    with get_db() as conn:
        for item in items:
            conn.execute(
                """INSERT INTO food_log (user_id, fecha, tipo, comida, marca, gramos, kcal, proteinas, carbs, grasas)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                (user_id, fecha_str, tipo, item["comida"], item["marca"],
                 item["gramos"], item["kcal"], item["proteinas"], item["carbs"], item["grasas"]),
            )
        conn.execute(
            "UPDATE meal_templates SET use_count = use_count + 1, last_used = ? WHERE id = ?",
            (fecha_str, template_id),
        )


def delete_meal_template(template_id):
    """Delete template and its items."""
    with get_db() as conn:
        conn.execute("DELETE FROM meal_templates WHERE id = ?", (template_id,))


# ============================================================================
# CHECK-IN HISTORY
# ============================================================================

def save_checkin(user_id, checkin_date, estimated_tdee, avg_daily_kcal,
                 trend_weight_start, trend_weight_end, proposed_kcal_target, applied=False):
    """Save a check-in result."""
    date_str = checkin_date.isoformat() if isinstance(checkin_date, (date, datetime)) else str(checkin_date)
    with get_db() as conn:
        conn.execute(
            """INSERT INTO checkin_history (user_id, checkin_date, estimated_tdee, avg_daily_kcal,
               trend_weight_start, trend_weight_end, proposed_kcal_target, applied)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
            (user_id, date_str, estimated_tdee, avg_daily_kcal,
             trend_weight_start, trend_weight_end, proposed_kcal_target, applied),
        )


def get_checkin_history(user_id):
    """Get check-in history."""
    with get_db() as conn:
        return [dict(r) for r in conn.execute(
            "SELECT * FROM checkin_history WHERE user_id = ? ORDER BY checkin_date DESC",
            (user_id,),
        ).fetchall()]


# ============================================================================
# BODY MEASUREMENTS
# ============================================================================

def save_body_measurement(user_id, fecha, cintura=None, pecho=None, caderas=None,
                          brazos=None, muslos=None, cuello=None, body_fat_pct=None):
    """Save body measurement."""
    fecha_str = fecha.isoformat() if isinstance(fecha, (date, datetime)) else str(fecha)
    with get_db() as conn:
        conn.execute(
            """INSERT INTO body_measurements (user_id, fecha, cintura, pecho, caderas,
               brazos, muslos, cuello, body_fat_pct)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (user_id, fecha_str, cintura, pecho, caderas, brazos, muslos, cuello, body_fat_pct),
        )


def get_body_measurements(user_id):
    """Get body measurements sorted by date."""
    with get_db() as conn:
        return [dict(r) for r in conn.execute(
            "SELECT * FROM body_measurements WHERE user_id = ? ORDER BY fecha DESC",
            (user_id,),
        ).fetchall()]


# ============================================================================
# CSV MIGRATION
# ============================================================================

def migrate_csv_to_db(user_id):
    """Import existing CSV data for a user."""
    import pandas as pd
    imported = {"peso": 0, "comidas": 0, "catalogo": 0}

    # Weight entries
    try:
        df = pd.read_csv("datos_peso.csv")
        df["Fecha"] = pd.to_datetime(df["Fecha"], errors="coerce")
        df = df[df["Fecha"].notnull()]
        for _, row in df.iterrows():
            save_weight_entry(
                user_id,
                row["Fecha"].date(),
                peso=row.get("Peso") if pd.notna(row.get("Peso")) else None,
                kcal=row.get("Kcal") if pd.notna(row.get("Kcal")) else None,
            )
            imported["peso"] += 1
    except (FileNotFoundError, Exception):
        pass

    # Food log
    try:
        df = pd.read_csv("comidas.csv")
        df["Fecha"] = pd.to_datetime(df["Fecha"], errors="coerce")
        df = df[df["Fecha"].notnull()]
        for _, row in df.iterrows():
            add_food_entry(
                user_id,
                row["Fecha"].date(),
                row.get("Tipo", ""),
                row.get("Comida", ""),
                row.get("Marca", ""),
                row.get("Gramos", 0),
                row.get("Kcal", 0),
                row.get("Proteinas", 0),
                row.get("Carbs", 0),
                row.get("Grasas", 0),
            )
            imported["comidas"] += 1
    except (FileNotFoundError, Exception):
        pass

    # Catalog
    try:
        df = pd.read_csv("catalogo_comidas.csv")
        for _, row in df.iterrows():
            add_catalog_entry(
                user_id,
                row.get("Comida", ""),
                row.get("Marca", ""),
                row.get("Kcal_100g", 0),
                row.get("Proteinas_100g", 0),
                row.get("Carbs_100g", 0),
                row.get("Grasas_100g", 0),
            )
            imported["catalogo"] += 1
    except (FileNotFoundError, Exception):
        pass

    return imported
