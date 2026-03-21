# Plan: Base de Alimentos Verificada

## Problema

Open Food Facts (OFF) es crowdsourced:
- Datos inconsistentes (muchos productos sin macros completos)
- Valores frecuentemente incorrectos o desactualizados
- Cobertura desigual por region (pocos productos españoles/latinos)
- Sin garantia de precision nutricional

## Solucion propuesta: Base curada multi-fuente

### Fuentes de datos (por prioridad)

| Prioridad | Fuente | Tipo | Precision | Cobertura |
|-----------|--------|------|-----------|-----------|
| 1 | **USDA FoodData Central** | API publica (gratuita) | Alta (datos de laboratorio) | Excelente (genéricos + branded) |
| 2 | **BEDCA** (Base Española de Datos de Composicion de Alimentos) | Descarga CSV | Alta | Buena para alimentos españoles |
| 3 | **Open Food Facts** | API REST | Variable | Amplia para productos envasados |
| 4 | **Entradas verificadas por usuarios** | DB interna | Media-alta | Crece con uso |

### USDA FoodData Central API

- **URL**: `https://api.nal.usda.gov/fdc/v1/`
- **API Key**: Gratuita, requiere registro en https://fdc.nal.usda.gov/api-key-signup.html
- **Endpoints clave**:
  - `POST /foods/search` — Busqueda por texto
  - `GET /food/{fdcId}` — Detalle de alimento
- **Datasets**: Foundation (genericos), SR Legacy (USDA standard), Branded (productos comerciales)
- **Datos**: Energia (kcal), proteina, carbohidratos, grasas, fibra, azucar, etc. por 100g
- **Rate limit**: 1000 requests/hora (gratuito)

### Modelo de datos propuesto

```sql
CREATE TABLE verified_foods (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  brand TEXT,
  source TEXT NOT NULL, -- 'usda', 'bedca', 'off', 'user_verified'
  source_id TEXT,       -- ID externo (fdc_id, off_barcode, etc)
  kcal_100g NUMERIC NOT NULL,
  proteinas_100g NUMERIC NOT NULL,
  carbs_100g NUMERIC NOT NULL,
  grasas_100g NUMERIC NOT NULL,
  fibra_100g NUMERIC,
  azucar_100g NUMERIC,
  grasa_sat_100g NUMERIC,
  sodio_100g NUMERIC,
  confidence TEXT DEFAULT 'verified', -- 'verified', 'crowdsourced', 'estimated'
  category TEXT,        -- 'frutas', 'carnes', 'lacteos', etc
  search_terms TEXT,    -- Terminos adicionales para busqueda
  verified_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_verified_foods_name ON verified_foods USING gin(to_tsvector('spanish', name));
CREATE INDEX idx_verified_foods_source ON verified_foods(source);
CREATE INDEX idx_verified_foods_category ON verified_foods(category);
```

### Integracion en la app

#### Opcion recomendada: Mejorar tab "Buscar" existente

En vez de añadir un tab nuevo, mejorar el tab "Buscar" actual:

1. **Buscar primero en `verified_foods`** (DB interna, mas rapido y preciso)
2. **Fallback a OFF** solo si no hay resultados verificados
3. **Mostrar badge de confianza** junto a cada resultado:
   - 🟢 Verificado (USDA/BEDCA)
   - 🟡 Crowdsourced (OFF)
   - 🔵 Estimado (AI)

#### API route propuesta

```
POST /api/food-search
  body: { query: string, source?: 'all' | 'verified' | 'off' }

  1. Buscar en verified_foods (full-text search PostgreSQL)
  2. Si results < 5, buscar en OFF como complemento
  3. Devolver resultados combinados con campo `confidence`
```

### Estrategia de poblacion

#### Fase 1: Seed inicial (500-1000 alimentos)
- Top 200 alimentos USDA mas comunes (frutas, verduras, carnes, cereales, lacteos)
- Top 100 alimentos españoles de BEDCA (tortilla, jamon, aceite oliva, garbanzos, etc)
- Top 100 alimentos latinoamericanos (frijoles, arroz, platano, arepa, etc)
- Script: `scripts/seed-verified-foods.ts` que llama a USDA API y guarda en DB

#### Fase 2: Enriquecimiento automatico
- Cuando un usuario busca en OFF y añade un alimento, guardarlo en `verified_foods` con `source: 'off'` y `confidence: 'crowdsourced'`
- Alimentos usados >10 veces por diferentes usuarios → marcar como "community verified"

#### Fase 3: Curacion manual
- Panel admin simple para revisar y aprobar entradas
- Corregir valores incorrectos de OFF comparando con USDA
- Añadir alimentos regionales que no estan en ninguna API

### Variables de entorno adicionales

```
USDA_API_KEY=tu-api-key  # Gratuita, https://fdc.nal.usda.gov/api-key-signup.html
```

### Migracion gradual

1. **Paso 1**: Crear tabla `verified_foods` + API route + seed script
2. **Paso 2**: Integrar en tab "Buscar" con fallback a OFF
3. **Paso 3**: Añadir badge de confianza en resultados
4. **Paso 4**: Poblacion automatica desde uso de OFF
5. **Paso 5**: Panel de curacion (opcional)

OFF sigue como fallback indefinidamente — la transicion es gradual y no destructiva.

### Estimacion de esfuerzo

| Tarea | Complejidad | Dependencias |
|-------|-------------|--------------|
| Tabla SQL + migracion | Baja | Ninguna |
| API route `/api/food-search` | Media | API key USDA |
| Seed script USDA | Media | API key USDA |
| Seed script BEDCA | Media | CSV BEDCA |
| Integracion en tab Buscar | Media | API route |
| Badge de confianza | Baja | Integracion |
| Poblacion automatica | Media | Tab integrado |
| Panel curacion | Alta | Todo lo anterior |

### Referencias

- USDA FoodData Central: https://fdc.nal.usda.gov/
- USDA API docs: https://fdc.nal.usda.gov/api-guide.html
- BEDCA: https://www.bedca.net/
- Open Food Facts API: https://world.openfoodfacts.org/data
