import streamlit as st
import pandas as pd
import altair as alt

st.title("Analytics")

CSV_FILE = "datos_peso.csv"
COMIDAS_FILE = "comidas.csv"

# ---------- CARGAR DATOS ----------
try:
    df = pd.read_csv(CSV_FILE)
    df["Fecha"] = pd.to_datetime(df["Fecha"], errors="coerce")
    df = df[df["Fecha"].notnull()].sort_values("Fecha")
except FileNotFoundError:
    df = pd.DataFrame(columns=["Fecha", "Peso", "Kcal"])

try:
    df_comidas = pd.read_csv(COMIDAS_FILE)
    df_comidas["Fecha"] = pd.to_datetime(df_comidas["Fecha"], errors="coerce")
    df_comidas = df_comidas[df_comidas["Fecha"].notnull()]
except FileNotFoundError:
    df_comidas = pd.DataFrame(columns=["Fecha", "Kcal", "Proteinas", "Carbs", "Grasas"])

if df.empty or len(df) < 2:
    st.info("Necesitas al menos 2 registros de peso para ver analytics.")
    st.stop()

# ---------- CONFIGURACION ----------
st.sidebar.subheader("Objetivos")
objetivo_peso = st.sidebar.number_input("Peso objetivo (kg)", min_value=30.0, max_value=300.0, step=0.1, value=70.0)
meta_intermedia = st.sidebar.number_input("Meta intermedia (kg)", min_value=30.0, max_value=300.0, step=0.1, value=80.0)

# ---------- RANGO DE FECHAS ----------
fecha_min = df["Fecha"].min().date()
fecha_max = df["Fecha"].max().date()
rango = st.slider("Rango de fechas", min_value=fecha_min, max_value=fecha_max, value=(fecha_min, fecha_max))
df_rango = df[df["Fecha"].between(pd.Timestamp(rango[0]), pd.Timestamp(rango[1]))].copy()

if df_rango.empty:
    st.warning("No hay datos en el rango seleccionado.")
    st.stop()

# ---------- CALCULAR TDEE DINAMICO ----------
# Ventana de 28 dias (como MacroFactor)
ANALYSIS_WINDOW = 28
CALORIES_PER_KG = 7700

fecha_max_rango = df_rango["Fecha"].max()
fecha_min_4w = fecha_max_rango - pd.Timedelta(days=ANALYSIS_WINDOW - 1)
df_4w = df_rango[df_rango["Fecha"] >= fecha_min_4w]
if df_4w.empty:
    df_4w = df_rango.copy()

# Media movil 7 dias para tendencia
df_rango["Tendencia"] = df_rango["Peso"].rolling(window=7, min_periods=1).mean()

# TDEE con tendencias (no pesos brutos) para mayor precision
peso_trend_inicio = df_4w["Peso"].rolling(window=7, min_periods=1).mean().dropna().iloc[0]
peso_trend_actual = df_rango["Tendencia"].iloc[-1]
dias = (df_4w.iloc[-1]["Fecha"] - df_4w.iloc[0]["Fecha"]).days or 1

# Combinar kcal de registro de peso y food log
kcal_peso = df_4w[df_4w["Kcal"].notna()]["Kcal"]
kcal_diarias_prom = kcal_peso.mean() if not kcal_peso.empty else 0

if dias >= 7 and kcal_diarias_prom > 0:
    cambio_peso = peso_trend_actual - peso_trend_inicio
    surplus_diario = (cambio_peso * CALORIES_PER_KG) / dias
    tdee_dinamico = kcal_diarias_prom - surplus_diario
else:
    tdee_dinamico = kcal_diarias_prom if kcal_diarias_prom > 0 else 2000

# ---------- METRICAS PRINCIPALES ----------
st.subheader("Metricas clave")
col1, col2, col3, col4 = st.columns(4)
col1.metric("Peso tendencia", f"{peso_trend_actual:.1f} kg")
col2.metric("TDEE dinamico", f"{tdee_dinamico:.0f} kcal")
col3.metric("Kcal prom (4w)", f"{kcal_diarias_prom:.0f} kcal")
deficit = kcal_diarias_prom - tdee_dinamico if kcal_diarias_prom > 0 else 0
col4.metric("Balance diario", f"{deficit:+.0f} kcal")

# ---------- PROGRESO HACIA METAS ----------
st.subheader("Progreso hacia metas")
peso_actual = df_rango["Peso"].iloc[-1]
peso_inicio = df_rango["Peso"].iloc[0]

for meta_val, meta_label in [(meta_intermedia, "Meta intermedia"), (objetivo_peso, "Meta final")]:
    if peso_inicio != meta_val:
        progreso = max(0.0, min(1.0, (peso_inicio - peso_actual) / (peso_inicio - meta_val)))
    else:
        progreso = 1.0
    col_l, col_r = st.columns([1, 3])
    col_l.write(f"**{meta_label}**: {meta_val:.1f} kg")
    col_r.progress(progreso, text=f"{progreso * 100:.0f}%")

# ---------- GRAFICA DE PESO ----------
st.subheader("Evolucion del peso")
df_graf = df_rango[["Fecha", "Peso", "Tendencia"]].copy()
y_min = df_graf["Peso"].min() - 2
y_max = df_graf["Peso"].max() + 2

chart_peso = (
    alt.Chart(df_graf)
    .transform_fold(["Peso", "Tendencia"], as_=["Variable", "Valor"])
    .mark_line()
    .encode(
        x=alt.X("Fecha:T", title="Fecha"),
        y=alt.Y("Valor:Q", scale=alt.Scale(domain=[y_min, y_max]), title="kg"),
        color=alt.Color("Variable:N"),
        strokeDash=alt.condition(
            alt.datum.Variable == "Tendencia",
            alt.value([5, 5]),
            alt.value([0]),
        ),
    )
    .properties(height=400)
)

# Linea de objetivo
objetivo_line = (
    alt.Chart(pd.DataFrame({"y": [objetivo_peso]}))
    .mark_rule(color="green", strokeDash=[3, 3])
    .encode(y="y:Q")
)

st.altair_chart(chart_peso + objetivo_line, use_container_width=True)

# ---------- GRAFICA KCAL VS TDEE ----------
st.subheader("Kcal vs TDEE")
df_kcal = df_rango[df_rango["Kcal"].notna()][["Fecha", "Kcal"]].copy()
if not df_kcal.empty:
    df_kcal["TDEE"] = tdee_dinamico
    chart_kcal = (
        alt.Chart(df_kcal)
        .transform_fold(["Kcal", "TDEE"], as_=["Variable", "Valor"])
        .mark_line()
        .encode(
            x="Fecha:T",
            y=alt.Y("Valor:Q", title="kcal"),
            color="Variable:N",
            strokeDash=alt.condition(
                alt.datum.Variable == "TDEE",
                alt.value([5, 5]),
                alt.value([0]),
            ),
        )
        .properties(height=300)
    )
    st.altair_chart(chart_kcal, use_container_width=True)

# ---------- COMPARATIVA MENSUAL ----------
st.subheader("Comparativa mensual")
df_mensual = df_rango.set_index("Fecha").resample("ME").mean(numeric_only=True).round(2)

if len(df_mensual) > 1:
    for i in range(1, len(df_mensual)):
        mes_ant = df_mensual.index[i - 1].strftime("%B %Y")
        mes_act = df_mensual.index[i].strftime("%B %Y")
        peso_diff = df_mensual["Peso"].iloc[i] - df_mensual["Peso"].iloc[i - 1]
        kcal_diff = df_mensual["Kcal"].iloc[i] - df_mensual["Kcal"].iloc[i - 1]
        st.write(f"**{mes_ant} -> {mes_act}**")
        c1, c2 = st.columns(2)
        c1.metric(
            "Peso",
            f"{df_mensual['Peso'].iloc[i]:.1f} kg",
            f"{peso_diff:+.1f} kg",
            delta_color="inverse",
        )
        c2.metric(
            "Kcal",
            f"{df_mensual['Kcal'].iloc[i]:.0f}",
            f"{kcal_diff:+.0f}",
        )
else:
    st.info("Necesitas datos de al menos 2 meses para comparativas.")

# ---------- MACROS SEMANALES (desde food log) ----------
if not df_comidas.empty:
    st.subheader("Macros semanales (Food Log)")
    df_macros = df_comidas.groupby(df_comidas["Fecha"].dt.date).agg(
        {"Kcal": "sum", "Proteinas": "sum", "Carbs": "sum", "Grasas": "sum"}
    )
    if len(df_macros) > 0:
        ultimos_7 = df_macros.tail(7)
        c1, c2, c3, c4 = st.columns(4)
        c1.metric("Kcal/dia", f"{ultimos_7['Kcal'].mean():.0f}")
        c2.metric("Prot/dia", f"{ultimos_7['Proteinas'].mean():.0f} g")
        c3.metric("Carbs/dia", f"{ultimos_7['Carbs'].mean():.0f} g")
        c4.metric("Grasas/dia", f"{ultimos_7['Grasas'].mean():.0f} g")

# ---------- EXPORTAR ----------
st.markdown("---")
st.subheader("Exportar datos")
col_exp1, col_exp2 = st.columns(2)
with col_exp1:
    csv_peso = df.to_csv(index=False).encode("utf-8")
    st.download_button("Descargar peso (CSV)", csv_peso, "datos_peso.csv", "text/csv")
with col_exp2:
    if not df_comidas.empty:
        csv_comidas = df_comidas.to_csv(index=False).encode("utf-8")
        st.download_button("Descargar comidas (CSV)", csv_comidas, "comidas.csv", "text/csv")
