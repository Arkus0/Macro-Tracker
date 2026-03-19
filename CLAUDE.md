# Pocket Diet — Macro Tracker

## Que es este proyecto

Pocket Diet es un tracker de nutricion y peso personal inspirado en MacroFactor.
App web construida con Streamlit, pensada para desplegar en Streamlit Community Cloud.

## Tech Stack

- **Frontend/Backend**: Streamlit (Python)
- **Datos**: CSV local (datos_peso.csv, comidas.csv, catalogo_comidas.csv)
- **Visualizacion**: Altair
- **API externa**: Open Food Facts (busqueda de alimentos)
- **Despliegue**: Streamlit Community Cloud

## Estructura del proyecto

```
app.py                      # Pagina principal (home)
pages/
  1_Registro_Peso.py        # Registro diario de peso y kcal
  2_Food_Log.py             # Registro de comidas con macros
  3_Analytics.py            # TDEE dinamico, graficas, comparativas
requirements.txt            # Dependencias Python
.streamlit/config.toml      # Configuracion de tema y servidor
lib/                        # Modulos Dart/Flutter (legacy, no en uso)
```

## Como ejecutar

```bash
pip install -r requirements.txt
streamlit run app.py
```

## Algoritmo TDEE Dinamico

Ventana de analisis: 28 dias. Formula:
```
TDEE = Kcal_promedio_diarias - ((CambioPesoTendencia * 7700) / Dias)
```
Usa media movil de 7 dias para suavizar el peso (tendencia vs peso bruto).
Requiere minimo 7 dias de datos para calcular.

## Convenciones de desarrollo

- Todo el codigo y UI en espanol (nombres de variables en ingles o espanol segun contexto)
- Sin tildes en el codigo fuente (compatibilidad)
- Archivos CSV como almacenamiento (no base de datos)
- Cada pagina es autocontenida (carga sus propios datos)
- Usar `st.rerun()` tras modificar datos para refrescar la UI

## Despliegue en Streamlit Cloud

1. Push del repo a GitHub
2. Ir a share.streamlit.io
3. Conectar repo, seleccionar `app.py` como entry point
4. Deploy

---

## FUNCIONALIDADES: Pocket Diet vs MacroFactor

### IMPLEMENTADO (tenemos)

| Feature | Estado | Notas |
|---------|--------|-------|
| Registro de peso diario | OK | Con deteccion de duplicados |
| Registro de kcal diarias | OK | En pagina de peso |
| Food log con macros (P/C/G) | OK | Por tipo de comida |
| Busqueda Open Food Facts | OK | API externa |
| Catalogo personal de favoritos | OK | CSV local |
| TDEE dinamico (28 dias) | OK | Formula basada en tendencia |
| Tendencia de peso (media movil 7d) | OK | Rolling average |
| Graficas de peso + tendencia | OK | Altair interactivo |
| Grafica kcal vs TDEE | OK | Linea de referencia |
| Comparativa mensual | OK | Peso y kcal mes a mes |
| Progreso hacia metas | OK | Barra de progreso |
| Promedios semanales macros | OK | Ultimos 7 dias |
| Copiar comidas dia anterior | OK | Quick action |
| Exportar datos CSV | OK | Download button |
| Editar/eliminar comidas | OK | En food log |

### FALTA (para paridad con MacroFactor)

#### PRIORIDAD ALTA — Core de MacroFactor

| Feature | Descripcion | Complejidad |
|---------|-------------|-------------|
| **Coaching algorithm** | Ajuste automatico semanal de macros/kcal segun TDEE y objetivo. 3 modos: Coached (auto), Collaborative (usuario pone macros, app ajusta kcal), Manual | ALTA |
| **Macro targets diarios** | Objetivos personalizados de P/C/G por dia. 4 splits: Balanced, Low Fat, Low Carb, Keto | MEDIA |
| **Check-ins semanales** | Sistema de check-in donde el coach AI pregunta, sugiere cambios, y ajusta el plan. Adherence-neutral (funciona aunque no sigas el plan al 100%) | ALTA |
| **Goal management avanzado** | Velocidad de perdida/ganancia (kg/semana), ETA estimado para llegar al objetivo, historial de goals | MEDIA |
| **Expenditure over time** | Grafica de TDEE a lo largo del tiempo (no solo valor actual) | BAJA |

#### PRIORIDAD MEDIA — Experiencia de usuario

| Feature | Descripcion | Complejidad |
|---------|-------------|-------------|
| **Recetas** | Crear recetas multi-ingrediente con peso total, porciones, y macros calculados automaticamente | MEDIA |
| **Meal templates** | Guardar comidas completas (multiples alimentos) para reutilizar | MEDIA |
| **Smart history** | Historial inteligente: alimentos mas usados aparecen primero, sugerencias basadas en hora del dia | MEDIA |
| **Micronutrientes** | Tracking de vitaminas y minerales (no solo macros) | ALTA |
| **AI food logging** | Describir comida en texto libre y que la IA estime macros (util para restaurantes) | MEDIA |
| **Barcode scanner** | Escaneo de codigo de barras (limitado en web, posible con camara) | MEDIA |
| **Label scanner** | Escanear etiqueta nutricional con la camara | ALTA |
| **Base de datos verificada** | DB curada y verificada (Open Food Facts no siempre es preciso) | ALTA |

#### PRIORIDAD BAJA — Nice to have

| Feature | Descripcion | Complejidad |
|---------|-------------|-------------|
| **Medidas corporales** | Tracking de cintura, pecho, brazos, etc. | BAJA |
| **Progress photos** | Fotos de progreso vinculadas a fechas | BAJA |
| **Habit tracker** | Seguimiento de habitos personalizados | BAJA |
| **Period tracker** | Ciclo menstrual (afecta retencion de liquidos y peso) | BAJA |
| **Expenditure modifier** | Ajuste fino del TDEE con datos de pasos/actividad | MEDIA |
| **Calorie banking** | Distribuir kcal semanales de forma flexible entre dias | MEDIA |
| **Adherence tracking** | Medir adherencia al plan (% de dias dentro del target) | BAJA |
| **Integraciones** | Apple Health, Google Fit, importar historico | ALTA |
| **Dark/light mode toggle** | Ya tenemos dark por defecto, falta toggle | BAJA |
| **Multi-day planning** | Planificar comidas con antelacion | MEDIA |
| **Coaching portal** | Compartir datos con un coach externo | ALTA |
| **Widgets** | Widget para home screen (solo nativo) | N/A web |

### ROADMAP SUGERIDO

**Fase 1 — Coaching basico**
1. Macro targets diarios con splits (Balanced/Low Fat/Low Carb/Keto)
2. Goal management: velocidad + ETA
3. Grafica de TDEE historico

**Fase 2 — Recetas y UX**
4. Sistema de recetas multi-ingrediente
5. Meal templates
6. Smart history (frecuencia + hora)

**Fase 3 — Coaching inteligente**
7. Check-ins semanales automaticos
8. Coaching algorithm (ajuste semanal de targets)
9. Adherence tracking

**Fase 4 — Datos avanzados**
10. Micronutrientes
11. Medidas corporales
12. AI food logging (texto libre -> macros)
13. Barcode/label scanner (via camara web)

**Fase 5 — Extras**
14. Progress photos
15. Habit tracker
16. Period tracker
17. Calorie banking
18. Expenditure modifier con pasos
