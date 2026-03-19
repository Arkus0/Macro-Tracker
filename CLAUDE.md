# Pocket Diet — Macro Tracker

## Que es este proyecto

Pocket Diet es un tracker de nutricion y peso personal con paridad de features con MacroFactor.
App web multi-usuario construida con Streamlit + SQLite, pensada para desplegar en Streamlit Community Cloud.
Cada dispositivo/usuario tiene sus propios datos aislados via autenticacion.

## Tech Stack

- **Frontend/Backend**: Streamlit (Python)
- **Base de datos**: SQLite (pocket_diet.db, multi-usuario con WAL mode)
- **Autenticacion**: Login/registro con PBKDF2 password hashing
- **Visualizacion**: Altair
- **API externa**: Open Food Facts (busqueda de alimentos)
- **Algoritmos**: Port de Juan-Tracker (Flutter/Dart) a Python
- **Despliegue**: Streamlit Community Cloud

## Estructura del proyecto

```
app.py                          # Home + auth gate + quick stats
auth.py                         # Login/registro, session management
db.py                           # SQLite database layer (12 tablas, CRUD completo)
services/
  __init__.py
  adaptive_coach.py             # Coach adaptativo (check-ins, TDEE, macro presets)
  weight_trend.py               # EMA, Holt-Winters, deteccion de fase
  goal_projection.py            # ETA, progreso, predicciones de peso
pages/
  1_Registro_Peso.py            # Registro diario de peso y kcal
  2_Food_Log.py                 # Food log con macros, templates, frecuentes
  3_Analytics.py                # TDEE, tendencias, adherencia, exportar
  4_Coach.py                    # Coach adaptativo + check-ins semanales
  5_Targets.py                  # Macro targets con presets + micros
  6_Recetas.py                  # Recetas multi-ingrediente
  7_Medidas.py                  # Medidas corporales
requirements.txt                # Dependencias Python
.streamlit/config.toml          # Configuracion de tema y servidor
.gitignore                      # Excluye pocket_diet.db, __pycache__
```

## Como ejecutar

```bash
pip install -r requirements.txt
streamlit run app.py
```

La base de datos SQLite (pocket_diet.db) se crea automaticamente en el primer uso.
Los usuarios se registran desde la pantalla de login. Opcion de importar CSVs legacy al registrarse.

## Arquitectura de datos

### SQLite multi-usuario

Todas las tablas tienen `user_id` como foreign key. Cada query filtra por usuario.
WAL mode habilitado para lecturas concurrentes (multiples sesiones Streamlit).

**12 tablas:**
- `users` — Autenticacion (username, password_hash PBKDF2)
- `weight_entries` — Peso y kcal diarias (UNIQUE user_id+fecha)
- `food_log` — Registro detallado de comidas con macros
- `food_catalog` — Catalogo personal de alimentos favoritos
- `coach_plans` — Plan de coaching activo (objetivo, velocidad, preset)
- `targets` — Targets versionados de kcal y macros (con valid_from)
- `recipes` / `recipe_items` — Recetas multi-ingrediente
- `meal_templates` / `meal_template_items` — Templates de comidas reutilizables
- `checkin_history` — Historial de check-ins semanales
- `body_measurements` — Medidas corporales (7 metricas + body fat %)

### Patron de acceso

Cada pagina llama `require_auth()` de `auth.py` al inicio, que retorna `user_id` o muestra login y hace `st.stop()`.
Todas las funciones de `db.py` reciben `user_id` como primer parametro.

## Algoritmos clave

### TDEE Dinamico (28 dias)
```
TDEE = Kcal_promedio_diarias - ((CambioPesoTendencia * 7700) / Dias)
```
Usa EMA de 7 dias para suavizar el peso. Requiere minimo 7 dias de datos.

### Coach Adaptativo (port de Juan-Tracker)
- Check-in semanal: analiza 7 dias de peso + diario
- Formula: `TDEE = avg_kcal - (trend_change_kg * 7700 / days)`
- Ajuste: `new_target = TDEE + daily_adjustment` (deficit o superavit)
- Safety clamps: max ±200 kcal/semana, min 1200, max 6000 kcal
- 6 macro presets: Low Carb, Balanced, High Protein, High Carb, Keto, Custom
- Requisitos minimos: 3 pesajes + 4 dias de diario por semana

### Weight Trend (EMA + Holt-Winters)
- EMA (Exponential Moving Average): smoothing factor = 2/(period+1)
- Holt-Winters doble: nivel + tendencia (kg/dia)
- Deteccion de fase: losing/maintaining/gaining (umbral: 0.2 kg/sem)
- Predicciones a 7 y 30 dias

### Goal Projection
- ETA en dias basado en trend actual
- Progreso % (0-150%), pace ratio (actual vs target)
- Generacion de linea de proyeccion para charts

## Convenciones de desarrollo

- Todo el codigo y UI en espanol (nombres de variables en ingles o espanol segun contexto)
- Sin tildes en el codigo fuente (compatibilidad)
- SQLite como almacenamiento (multi-usuario, WAL mode)
- Cada pagina llama `require_auth()` al inicio
- Usar `st.rerun()` tras modificar datos para refrescar la UI
- Las funciones de db.py manejan conexiones internamente (context manager `get_db()`)
- Fechas se almacenan como ISO strings (YYYY-MM-DD) en SQLite

## Despliegue en Streamlit Cloud

1. Push del repo a GitHub
2. Ir a share.streamlit.io
3. Conectar repo, seleccionar `app.py` como entry point
4. Deploy

Nota: SQLite persiste en el filesystem del servidor. En Streamlit Community Cloud el filesystem
es efimero (se resetea en cada deploy). Para produccion, usar VPS con filesystem persistente.

## Referencia: Juan-Tracker

El repositorio `/home/user/Juan-Tracker` (Flutter/Dart) se uso como referencia para portar
los algoritmos de coaching, weight trend, y goal projection. Archivos clave:

| Algoritmo | Archivo referencia |
|-----------|-------------------|
| Coach adaptativo | `lib/diet/services/adaptive_coach_service.dart` |
| Weight trend | `lib/diet/services/weight_trend_calculator.dart` |
| Goal projection | `lib/diet/models/goal_projection_model.dart` |
| Targets model | `lib/diet/models/targets_model.dart` |
| Recipe model | `lib/diet/models/recipe_model.dart` |
| Meal templates | `lib/diet/models/meal_template.dart` |
| Adherence | `lib/diet/providers/adherence_providers.dart` |

---

## FUNCIONALIDADES: Pocket Diet vs MacroFactor

### IMPLEMENTADO

| Feature | Estado | Notas |
|---------|--------|-------|
| Registro de peso diario | OK | Con deteccion de duplicados (UPSERT) |
| Registro de kcal diarias | OK | En pagina de peso |
| Food log con macros (P/C/G) | OK | Por tipo de comida |
| Busqueda Open Food Facts | OK | API externa |
| Catalogo personal de favoritos | OK | SQLite por usuario |
| TDEE dinamico (28 dias) | OK | Formula basada en tendencia EMA |
| Tendencia de peso (EMA + HW) | OK | Holt-Winters doble exponencial |
| Graficas de peso + tendencia | OK | Altair interactivo |
| Grafica kcal vs TDEE | OK | Con linea de target |
| Comparativa mensual | OK | Peso y kcal mes a mes |
| Progreso hacia metas | OK | Barra de progreso |
| Promedios semanales macros | OK | Ultimos 7 dias |
| Copiar comidas dia anterior | OK | Quick action |
| Exportar datos CSV | OK | Download button |
| Editar/eliminar comidas | OK | En food log |
| **Multi-usuario (SQLite + auth)** | OK | Login/registro, datos aislados por usuario |
| **Coach adaptativo** | OK | Check-ins semanales, ajuste auto de targets |
| **Macro targets con presets** | OK | 6 presets + micronutrientes + historial versionado |
| **Check-ins semanales** | OK | Analisis 7 dias, TDEE, propuesta transparente |
| **Goal management avanzado** | OK | ETA, pace ratio, proyeccion de peso |
| **TDEE historico** | OK | Grafica de TDEE a lo largo del tiempo |
| **Recetas multi-ingrediente** | OK | Auto-calculo macros, porciones, log al diario |
| **Meal templates** | OK | Guardar/reutilizar, tracking de uso |
| **Smart history (frecuentes)** | OK | Alimentos ordenados por frecuencia |
| **Adherence tracking** | OK | Calendar heatmap (verde/ambar/rojo) |
| **Medidas corporales** | OK | 7 metricas + body fat %, graficas, comparativa |
| **Predicciones de peso** | OK | 7d y 30d con Holt-Winters |
| **Deteccion de fase** | OK | Perdiendo/manteniendo/ganando peso |

### FALTA (para paridad total con MacroFactor)

#### PRIORIDAD MEDIA — Experiencia de usuario

| Feature | Descripcion | Complejidad |
|---------|-------------|-------------|
| **Micronutrientes en food log** | Tracking de fibra, azucar, grasa saturada, sodio en cada comida (targets ya soportan micros) | MEDIA |
| **AI food logging** | Describir comida en texto libre y que la IA estime macros (util para restaurantes) | MEDIA |
| **Barcode scanner** | Escaneo de codigo de barras (limitado en web, posible con camara) | MEDIA |
| **Label scanner** | Escanear etiqueta nutricional con la camara | ALTA |
| **Base de datos verificada** | DB curada y verificada (Open Food Facts no siempre es preciso) | ALTA |
| **Macro cycling** | Dias de entrenamiento/descanso con macros diferenciados | MEDIA |

#### PRIORIDAD BAJA — Nice to have

| Feature | Descripcion | Complejidad |
|---------|-------------|-------------|
| **Progress photos** | Fotos de progreso vinculadas a fechas | BAJA |
| **Habit tracker** | Seguimiento de habitos personalizados | BAJA |
| **Period tracker** | Ciclo menstrual (afecta retencion de liquidos y peso) | BAJA |
| **Expenditure modifier** | Ajuste fino del TDEE con datos de pasos/actividad | MEDIA |
| **Calorie banking** | Distribuir kcal semanales de forma flexible entre dias | MEDIA |
| **Integraciones** | Apple Health, Google Fit, importar historico | ALTA |
| **Dark/light mode toggle** | Ya tenemos dark por defecto, falta toggle | BAJA |
| **Multi-day planning** | Planificar comidas con antelacion | MEDIA |
| **Coaching portal** | Compartir datos con un coach externo | ALTA |

### ROADMAP SIGUIENTE

**Fase 1 — Micronutrientes**
1. Agregar fibra/azucar/grasa sat/sodio al food log y recetas
2. Mostrar progreso de micros vs targets en dashboard

**Fase 2 — Macro cycling**
3. Configurar dias entrenamiento/descanso
4. Targets diferenciados por tipo de dia

**Fase 3 — AI y scanners**
5. AI food logging (texto libre -> macros)
6. Barcode scanner via camara web
7. Label scanner OCR

**Fase 4 — Extras**
8. Progress photos
9. Calorie banking
10. Integraciones externas
