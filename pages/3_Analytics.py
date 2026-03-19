import streamlit as st
import pandas as pd
import altair as alt
from datetime import date, timedelta
from auth import require_auth
import db
from services.weight_trend import WeightTrendCalculator, WeightPhase

user_id = require_auth()

st.title("Analytics")

# ---------- CARGAR DATOS ----------
weight_entries = db.get_weight_entries(user_id)
all_food_totals = db.get_food_daily_totals(user_id)
checkin_history = db.get_checkin_history(user_id)

if not weight_entries or len(weight_entries) < 2:
    st.info("Necesitas al menos 2 registros de peso para ver analytics.")
    st.stop()

df = pd.DataFrame(weight_entries)
df["Fecha"] = pd.to_datetime(df["fecha"])
df["Peso"] = df["peso"].astype(float)
df["Kcal"] = pd.to_numeric(df["kcal"], errors="coerce")
df = df.sort_values("Fecha")

# ---------- CONFIGURACION ----------
st.sidebar.subheader("Objetivos")
plan = db.get_active_coach_plan(user_id)
default_goal = plan["target_weight"] if plan and plan.get("target_weight") else 70.0
objetivo_peso = st.sidebar.number_input("Peso objetivo (kg)", min_value=30.0, max_value=300.0, step=0.1, value=float(default_goal))

# ---------- RANGO DE FECHAS ----------
fecha_min = df["Fecha"].min().date()
fecha_max = df["Fecha"].max().date()
rango = st.slider("Rango de fechas", min_value=fecha_min, max_value=fecha_max, value=(fecha_min, fecha_max))
df_rango = df[df["Fecha"].between(pd.Timestamp(rango[0]), pd.Timestamp(rango[1]))].copy()

if df_rango.empty:
    st.warning("No hay datos en el rango seleccionado.")
    st.stop()

# ---------- WEIGHT TREND AVANZADO ----------
trend_calc = WeightTrendCalculator()
trend_entries = [{"fecha": r["fecha"], "peso": r["Peso"]} for _, r in df_rango.iterrows() if pd.notna(r["Peso"])]
trend_result = trend_calc.calculate(trend_entries)

# EMA trend column
df_rango["Tendencia"] = None
if trend_result.ema_history and len(trend_result.ema_history) == len(df_rango[df_rango["Peso"].notna()]):
    peso_mask = df_rango["Peso"].notna()
    df_rango.loc[peso_mask, "Tendencia"] = trend_result.ema_history

# ---------- CALCULAR TDEE DINAMICO ----------
ANALYSIS_WINDOW = 28
CALORIES_PER_KG = 7700

fecha_max_rango = df_rango["Fecha"].max()
fecha_min_4w = fecha_max_rango - pd.Timedelta(days=ANALYSIS_WINDOW - 1)
df_4w = df_rango[df_rango["Fecha"] >= fecha_min_4w]
if df_4w.empty:
    df_4w = df_rango.copy()

# Use trend for TDEE calc
peso_trend_inicio = trend_result.ema_history[0] if trend_result.ema_history else df_4w["Peso"].iloc[0]
peso_trend_actual = trend_result.ema_weight
dias = (df_4w.iloc[-1]["Fecha"] - df_4w.iloc[0]["Fecha"]).days or 1

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

# Phase indicator
phase_labels = {
    WeightPhase.LOSING: "Perdiendo peso",
    WeightPhase.MAINTAINING: "Manteniendo peso",
    WeightPhase.GAINING: "Ganando peso",
    WeightPhase.INSUFFICIENT_DATA: "Datos insuficientes",
}
st.info(f"Fase actual: **{phase_labels[trend_result.phase]}** | Ritmo: {trend_result.weekly_rate:+.2f} kg/sem")

# Predictions
if trend_result.hw_prediction_7d and trend_result.hw_prediction_30d:
    c1, c2 = st.columns(2)
    c1.metric("Prediccion 7 dias", f"{trend_result.hw_prediction_7d:.1f} kg")
    c2.metric("Prediccion 30 dias", f"{trend_result.hw_prediction_30d:.1f} kg")

# ---------- PROGRESO HACIA METAS ----------
st.subheader("Progreso hacia metas")
peso_actual = df_rango["Peso"].iloc[-1]
peso_inicio = df_rango["Peso"].iloc[0]

if peso_inicio != objetivo_peso:
    progreso = max(0.0, min(1.0, (peso_inicio - peso_actual) / (peso_inicio - objetivo_peso)))
else:
    progreso = 1.0
col_l, col_r = st.columns([1, 3])
col_l.write(f"**Meta**: {objetivo_peso:.1f} kg")
col_r.progress(progreso, text=f"{progreso * 100:.0f}%")

# ---------- GRAFICA DE PESO ----------
st.subheader("Evolucion del peso")
df_graf = df_rango[["Fecha", "Peso", "Tendencia"]].copy()
df_graf = df_graf[df_graf["Peso"].notna()]
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

    # Show target line if available
    targets = db.get_active_targets(user_id)
    if targets:
        df_kcal["Target"] = targets["kcal_target"]

    fold_cols = ["Kcal", "TDEE"] + (["Target"] if targets else [])
    chart_kcal = (
        alt.Chart(df_kcal)
        .transform_fold(fold_cols, as_=["Variable", "Valor"])
        .mark_line()
        .encode(
            x="Fecha:T",
            y=alt.Y("Valor:Q", title="kcal"),
            color="Variable:N",
            strokeDash=alt.condition(
                alt.datum.Variable == "Kcal",
                alt.value([0]),
                alt.value([5, 5]),
            ),
        )
        .properties(height=300)
    )
    st.altair_chart(chart_kcal, use_container_width=True)

# ---------- TDEE HISTORICO ----------
if checkin_history:
    st.subheader("TDEE historico")
    df_tdee = pd.DataFrame(checkin_history)
    df_tdee["Fecha"] = pd.to_datetime(df_tdee["checkin_date"])
    df_tdee["TDEE"] = df_tdee["estimated_tdee"]

    chart_tdee = (
        alt.Chart(df_tdee)
        .mark_line(point=True)
        .encode(
            x="Fecha:T",
            y=alt.Y("TDEE:Q", title="TDEE (kcal)"),
        )
        .properties(height=250)
    )
    st.altair_chart(chart_tdee, use_container_width=True)

# ---------- ADHERENCE TRACKING ----------
targets = db.get_active_targets(user_id)
if targets and all_food_totals:
    st.subheader("Adherencia al plan")
    target_kcal = targets["kcal_target"]

    adherence_data = []
    for day_data in all_food_totals:
        day_kcal = day_data.get("kcal", 0) or 0
        if target_kcal > 0 and day_kcal > 0:
            deviation = abs(day_kcal - target_kcal) / target_kcal
            if deviation <= 0.10:
                status = "En objetivo"
            elif deviation <= 0.25:
                status = "Cercano"
            else:
                status = "Fuera"
            adherence_data.append({"fecha": day_data["fecha"], "status": status, "kcal": day_kcal})

    if adherence_data:
        df_adh = pd.DataFrame(adherence_data)
        df_adh["Fecha"] = pd.to_datetime(df_adh["fecha"])

        # Summary
        total_days = len(df_adh)
        on_target = len(df_adh[df_adh["status"] == "En objetivo"])
        close = len(df_adh[df_adh["status"] == "Cercano"])
        st.write(f"**{on_target}/{total_days}** dias en objetivo ({on_target/total_days*100:.0f}%) | "
                 f"**{close}** cercanos | **{total_days - on_target - close}** fuera")

        # Heatmap
        color_map = {"En objetivo": "#22c55e", "Cercano": "#eab308", "Fuera": "#ef4444"}
        chart_adh = (
            alt.Chart(df_adh)
            .mark_rect()
            .encode(
                x=alt.X("date(Fecha):O", title="Dia"),
                y=alt.Y("month(Fecha):O", title="Mes"),
                color=alt.Color("status:N", scale=alt.Scale(
                    domain=list(color_map.keys()),
                    range=list(color_map.values()),
                )),
                tooltip=["Fecha:T", "kcal:Q", "status:N"],
            )
            .properties(height=200)
        )
        st.altair_chart(chart_adh, use_container_width=True)

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
        c1.metric("Peso", f"{df_mensual['Peso'].iloc[i]:.1f} kg", f"{peso_diff:+.1f} kg", delta_color="inverse")
        c2.metric("Kcal", f"{df_mensual['Kcal'].iloc[i]:.0f}", f"{kcal_diff:+.0f}")
else:
    st.info("Necesitas datos de al menos 2 meses para comparativas.")

# ---------- MACROS SEMANALES ----------
if all_food_totals:
    st.subheader("Macros semanales (Food Log)")
    recent = [d for d in all_food_totals if d.get("kcal")][-7:]
    if recent:
        c1, c2, c3, c4 = st.columns(4)
        c1.metric("Kcal/dia", f"{sum(d['kcal'] or 0 for d in recent)/len(recent):.0f}")
        c2.metric("Prot/dia", f"{sum(d['proteinas'] or 0 for d in recent)/len(recent):.0f} g")
        c3.metric("Carbs/dia", f"{sum(d['carbs'] or 0 for d in recent)/len(recent):.0f} g")
        c4.metric("Grasas/dia", f"{sum(d['grasas'] or 0 for d in recent)/len(recent):.0f} g")

# ---------- EXPORTAR ----------
st.markdown("---")
st.subheader("Exportar datos")
col_exp1, col_exp2 = st.columns(2)
with col_exp1:
    csv_peso = df.to_csv(index=False).encode("utf-8")
    st.download_button("Descargar peso (CSV)", csv_peso, "datos_peso.csv", "text/csv")
with col_exp2:
    if all_food_totals:
        df_food = pd.DataFrame(db.get_food_entries(user_id))
        csv_comidas = df_food.to_csv(index=False).encode("utf-8")
        st.download_button("Descargar comidas (CSV)", csv_comidas, "comidas.csv", "text/csv")
