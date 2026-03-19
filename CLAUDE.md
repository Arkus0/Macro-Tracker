# Pocket Diet — Macro Tracker

## Que es este proyecto

Pocket Diet es un tracker de nutricion y peso personal con paridad de features con MacroFactor.
El proyecto tiene dos versiones:

1. **Legacy (Streamlit + SQLite)**: La version original en Python, en la raiz del repo. DB efimera en Streamlit Cloud.
2. **Next.js (produccion)**: Reescritura completa en `next-app/`. Mobile-first, DB persistente con Supabase, AI integrada.

La version Next.js es la activa y reemplaza a la version Streamlit.

## Tech Stack (Next.js)

| Capa | Tecnologia |
|------|-----------|
| Framework | Next.js 14 (App Router) |
| Lenguaje | TypeScript |
| UI | Tailwind CSS (dark theme, mobile-first) |
| Charts | Recharts |
| DB | Supabase (PostgreSQL) con Row Level Security |
| Auth | Supabase Auth (email/password) |
| AI | Anthropic Claude API (food estimation + label OCR) |
| Barcode | Open Food Facts API |
| Deploy | Vercel |

## Estructura del proyecto

```
next-app/                           # App Next.js (produccion)
  src/
    app/
      layout.tsx                    # Root layout, dark mode, system font
      login/page.tsx                # Login/registro con Supabase Auth
      (authenticated)/
        layout.tsx                  # Auth guard + AppShell wrapper
        page.tsx                    # Home dashboard (peso, kcal, target)
        peso/page.tsx               # Registro de peso + historial
        food-log/page.tsx           # Food log (7 tabs de entrada)
        analytics/page.tsx          # TDEE, graficas, tendencias, export CSV
        coach/page.tsx              # Coach adaptativo + check-ins
        targets/page.tsx            # Macro targets + cycling config
        recetas/page.tsx            # Recetas multi-ingrediente
        medidas/page.tsx            # Medidas corporales + graficas
      api/
        ai-estimate/route.ts        # Claude API: texto -> macros
        label-scan/route.ts         # Claude Vision: foto etiqueta -> macros
        barcode-lookup/route.ts     # Open Food Facts: barcode -> producto
    components/
      app-shell.tsx                 # Sidebar (desktop) + bottom nav (mobile)
      macro-display.tsx             # Barras de progreso kcal/P/C/G
    lib/
      db.ts                         # Supabase data access layer (~30 funciones)
      types.ts                      # Interfaces TypeScript para todas las entidades
      utils.ts                      # cn(), formatDate(), todayISO(), round helpers
      supabase/
        client.ts                   # Browser client (createBrowserClient)
        server.ts                   # Server client (createServerClient)
        middleware.ts               # Auth middleware (session refresh)
      algorithms/
        weight-trend.ts             # EMA + Holt-Winters + predicciones
        adaptive-coach.ts           # Check-ins, TDEE, 6 macro presets
        goal-projection.ts          # ETA, progreso %, pace ratio
    middleware.ts                    # Route protection
  supabase/
    migrations/
      001_initial_schema.sql        # 12 tablas + RLS + indices
      002_macro_cycling.sql         # day_type_schedule + day_type_overrides
      003_rpc_functions.sql         # get_food_daily_totals, get_frequent_foods

# Legacy (Streamlit) - en la raiz del repo
app.py                              # Home + auth gate
auth.py                             # Login/registro PBKDF2
db.py                               # SQLite database layer
services/                           # Algoritmos Python (originales)
pages/                              # 7 paginas Streamlit
```

## Como ejecutar (Next.js)

### Requisitos previos
1. Crear proyecto en [supabase.com](https://supabase.com)
2. Ejecutar las 3 migraciones SQL en orden (en Supabase SQL Editor)
3. Obtener API key de Anthropic (para AI features)

### Setup local
```bash
cd next-app
cp .env.local.example .env.local
# Editar .env.local con tus credenciales
npm install
npm run dev
```

### Variables de entorno
```
NEXT_PUBLIC_SUPABASE_URL=https://tu-proyecto.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=tu-anon-key
ANTHROPIC_API_KEY=tu-api-key
```

### Deploy en Vercel
1. Conectar repo en Vercel
2. Root directory: `next-app`
3. Configurar las mismas env vars en Vercel dashboard

## Arquitectura de datos (Supabase)

### PostgreSQL con Row Level Security

Todas las tablas tienen `user_id UUID REFERENCES auth.users(id)` y RLS policies con `auth.uid() = user_id`.

**14 tablas:**
- `weight_entries` — Peso y kcal diarias (UNIQUE user_id+fecha, UPSERT)
- `food_log` — Registro detallado de comidas con macros por tipo de comida
- `food_catalog` — Catalogo personal de alimentos favoritos
- `coach_plans` — Plan de coaching activo (objetivo, velocidad, preset)
- `targets` — Targets versionados de kcal y macros (con valid_from + day_type)
- `recipes` / `recipe_items` — Recetas multi-ingrediente
- `meal_templates` / `meal_template_items` — Templates de comidas reutilizables
- `checkin_history` — Historial de check-ins semanales
- `body_measurements` — Medidas corporales (7 metricas + body fat %)
- `day_type_schedule` — Patron semanal entrenamiento/descanso (UNIQUE user_id+day_of_week)
- `day_type_overrides` — Excepciones por fecha (UNIQUE user_id+fecha)

### RPC Functions (PostgreSQL)
- `get_food_daily_totals(p_user_id, p_start_date, p_end_date)` — GROUP BY fecha + SUM macros
- `get_frequent_foods(p_user_id, p_limit)` — GROUP BY comida+marca + COUNT + AVG

### Patron de acceso en db.ts

Todas las funciones reciben `supabase: SupabaseClient` y `userId: string` como primeros parametros.
Funciones clave:
- `saveWeightEntry()` — UPSERT con `onConflict: "user_id,fecha"`
- `getFoodEntries()`, `addFoodEntry()`, `deleteFoodEntry()`, `copyFoodEntries()`
- `getFoodDailyTotals()`, `getFrequentFoods()` — via `.rpc()`
- `saveTargets()` — con day_type para macro cycling
- `getActiveTargets()` — con fallback: day_type especifico → 'default'
- `getDayTypeForDate()` — override > schedule > 'default'
- `saveDaySchedule()`, `getDaySchedule()`, `saveDayOverride()`

## Food Log — 7 metodos de entrada

El food log (`food-log/page.tsx`) es la pagina mas compleja. Ofrece 7 tabs para agregar comidas:

1. **Buscar** — Open Food Facts API (busqueda por nombre)
2. **Frecuentes** — Alimentos mas usados (RPC query con COUNT + AVG)
3. **Catalogo** — Favoritos guardados del usuario
4. **Templates** — Comidas guardadas completas (reutilizables)
5. **IA** — Texto libre → Claude API estima macros (POST /api/ai-estimate)
6. **Escanear** — Barcode (Open Food Facts) + foto etiqueta (Claude Vision)
7. **Manual** — Entrada directa con inputs por 100g + gramos

Cada dia se divide en 4 tipos de comida: Desayuno, Comida, Cena, Snack.
Soporta: copiar dia anterior, guardar dia como template, eliminar comidas.

## Macro Cycling

Sistema de targets diferenciados por tipo de dia:

- **day_type_schedule**: Patron semanal (Lun-Dom → training/rest)
- **day_type_overrides**: Excepciones por fecha especifica
- **targets con day_type**: Targets separados para 'training', 'rest', y 'default'
- **Resolucion**: override > schedule > 'default'
- **Quick split**: +10%/+15%/+20% carbs en dias de entrenamiento

## Algoritmos (TypeScript)

Portados de Python (originalmente de Juan-Tracker en Dart):

### TDEE Dinamico (28 dias)
```
TDEE = Kcal_promedio_diarias - ((CambioPesoTendencia * 7700) / Dias)
```

### Coach Adaptativo (`adaptive-coach.ts`)
- Check-in semanal: analiza 7 dias de peso + diario
- Safety clamps: max ±200 kcal/semana, min 1200, max 6000 kcal
- 6 macro presets: Low Carb, Balanced, High Protein, High Carb, Keto, Custom
- Requisitos minimos: 3 pesajes + 4 dias de diario por semana

### Weight Trend (`weight-trend.ts`)
- EMA: smoothing factor = 2/(period+1)
- Holt-Winters doble: alpha = 2/(period+1), beta = 0.3
- Deteccion de fase: losing/maintaining/gaining (umbral: 0.2 kg/sem)
- Predicciones a 7 y 30 dias

### Goal Projection (`goal-projection.ts`)
- ETA en dias, progreso % (0-150%), pace ratio
- Linea de proyeccion para charts

## AI Features

### AI Food Estimation (POST /api/ai-estimate)
- Input: `{ description: string }` (ej: "un plato de arroz con pollo")
- Model: Claude claude-sonnet-4-20250514
- Output: `{ items: [{ comida, gramos, kcal, proteinas, carbs, grasas }] }`
- Prompt en espanol, porciones tipicas espanolas/latinas

### Label Scanner (POST /api/label-scan)
- Input: `{ image: string }` (base64)
- Model: Claude claude-sonnet-4-20250514 con Vision
- Output: `{ nutrition: { kcal_100g, proteinas_100g, carbs_100g, grasas_100g, ... } }`

### Barcode Lookup (POST /api/barcode-lookup)
- Input: `{ barcode: string }`
- API: Open Food Facts `https://world.openfoodfacts.org/api/v0/product/{barcode}.json`
- Output: `{ product: { name, brand, kcal_100g, proteinas_100g, carbs_100g, grasas_100g } }`

## Convenciones de desarrollo

- Todo el codigo y UI en espanol (variables en ingles o espanol segun contexto)
- Sin tildes en el codigo fuente (compatibilidad)
- TypeScript estricto (`tsc --noEmit` debe pasar limpio)
- Mobile-first: bottom nav en movil, sidebar en desktop
- Dark theme por defecto (bg: #0E1117, brand: #FF6B35)
- Fechas como ISO strings (YYYY-MM-DD)
- Supabase client se crea por componente via `createClient()` (browser) o `createServerClient()` (server)

## Dependencias principales

```json
{
  "next": "^14",
  "react": "^18",
  "@supabase/supabase-js": "^2",
  "@supabase/ssr": "^0.5",
  "recharts": "^2",
  "@anthropic-ai/sdk": "^0.30",
  "tailwindcss": "^3",
  "clsx": "^2",
  "tailwind-merge": "^2",
  "lucide-react": "latest"
}
```

## Referencia: Juan-Tracker

El repositorio `/home/user/Juan-Tracker` (Flutter/Dart) se uso como referencia para portar los algoritmos:

| Algoritmo | Dart (referencia) | TypeScript (implementacion) |
|-----------|-------------------|---------------------------|
| Coach adaptativo | `adaptive_coach_service.dart` | `lib/algorithms/adaptive-coach.ts` |
| Weight trend | `weight_trend_calculator.dart` | `lib/algorithms/weight-trend.ts` |
| Goal projection | `goal_projection_model.dart` | `lib/algorithms/goal-projection.ts` |

## FUNCIONALIDADES

### IMPLEMENTADO (Next.js)

| Feature | Estado | Notas |
|---------|--------|-------|
| DB persistente (Supabase) | OK | PostgreSQL con RLS, datos persisten entre deploys |
| UI mobile-first | OK | Bottom nav movil, sidebar desktop, Tailwind responsive |
| Auth (Supabase Auth) | OK | Email/password, middleware protege rutas |
| Registro de peso diario | OK | UPSERT, historial 14 dias |
| Food log con macros (P/C/G) | OK | 4 tipos de comida, 7 tabs de entrada |
| Busqueda Open Food Facts | OK | Tab "Buscar" en food log |
| Catalogo personal | OK | Tab "Catalogo" + guardar desde manual |
| Smart history (frecuentes) | OK | Tab "Frecuentes" con RPC query |
| Meal templates | OK | Guardar/reutilizar dias completos |
| AI food logging | OK | Claude API, texto libre → macros estimados |
| Barcode lookup | OK | Open Food Facts por codigo de barras |
| Label scanner (OCR) | OK | Claude Vision, foto → macros |
| TDEE dinamico | OK | Formula basada en tendencia EMA |
| Tendencia de peso (EMA + HW) | OK | Holt-Winters doble exponencial |
| Graficas peso + tendencia | OK | Recharts con linea de goal |
| Grafica kcal vs TDEE | OK | Con linea de target |
| Predicciones 7d/30d | OK | Holt-Winters |
| Deteccion de fase | OK | Losing/maintaining/gaining |
| Adherence tracking | OK | Resumen on-target/close/out |
| TDEE historico | OK | Desde checkin_history |
| Export CSV | OK | Peso + totales de comida |
| Coach adaptativo | OK | Check-ins semanales, TDEE, safety clamps |
| Goal management | OK | ETA, pace ratio, progreso %, proyeccion |
| Macro targets con presets | OK | 6 presets + micronutrientes |
| Macro cycling | OK | Training/rest con schedule semanal + overrides |
| Recetas multi-ingrediente | OK | Builder + log al diario con porciones |
| Medidas corporales | OK | 7 metricas, graficas multi-linea, comparativa |
| Copiar dia anterior | OK | En food log |
| Promedios semanales | OK | Ultimos 7 dias de macros |

### PENDIENTE

#### PRIORIDAD MEDIA

| Feature | Descripcion | Complejidad |
|---------|-------------|-------------|
| **Micronutrientes en food log** | Tracking de fibra, azucar, grasa sat, sodio en cada comida | MEDIA |
| **Base de datos verificada** | DB curada (Open Food Facts no siempre es preciso) | ALTA |

#### PRIORIDAD BAJA — Nice to have

| Feature | Descripcion | Complejidad |
|---------|-------------|-------------|
| **Progress photos** | Fotos de progreso vinculadas a fechas | BAJA |
| **Habit tracker** | Seguimiento de habitos personalizados | BAJA |
| **Calorie banking** | Distribuir kcal semanales entre dias | MEDIA |
| **Integraciones** | Apple Health, Google Fit | ALTA |
| **Multi-day planning** | Planificar comidas con antelacion | MEDIA |
