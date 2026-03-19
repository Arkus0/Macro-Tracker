import streamlit as st
import pandas as pd
from datetime import date

st.title("Registro de Peso")

CSV_FILE = "datos_peso.csv"

# ---------- CARGAR DATOS ----------
try:
    df = pd.read_csv(CSV_FILE)
    df["Fecha"] = pd.to_datetime(df["Fecha"], errors="coerce")
    df = df[df["Fecha"].notnull()]
except FileNotFoundError:
    df = pd.DataFrame(
        {
            "Fecha": pd.Series(dtype="datetime64[ns]"),
            "Peso": pd.Series(dtype="float"),
            "Kcal": pd.Series(dtype="float"),
        }
    )

# ---------- INPUT ----------
st.subheader("Nuevo registro")
col_fecha, col_peso, col_kcal = st.columns(3)
with col_fecha:
    fecha = st.date_input("Fecha", value=date.today())
with col_peso:
    peso = st.number_input(
        "Peso (kg)", min_value=0.0, max_value=300.0, step=0.1,
        value=None, placeholder="Tu peso",
    )
with col_kcal:
    kcal = st.number_input(
        "Kcal consumidas", min_value=0, max_value=10000, step=10,
        value=None, placeholder="Kcal del dia",
    )

fecha_ts = pd.Timestamp(fecha)
registro_existente = not df[df["Fecha"] == fecha_ts].empty

if registro_existente:
    st.warning("Ya existe un registro para esta fecha. Se sobrescribira.")

if st.button("Guardar", type="primary"):
    if peso is None and kcal is None:
        st.error("Introduce al menos peso o kcal.")
    else:
        nueva_fila = pd.DataFrame(
            {"Fecha": [fecha_ts], "Peso": [peso], "Kcal": [kcal]}
        )
        df = df[df["Fecha"] != fecha_ts]
        df = pd.concat([df, nueva_fila], ignore_index=True)
        df = df.sort_values("Fecha")
        df.to_csv(CSV_FILE, index=False)
        st.success("Guardado correctamente.")
        st.rerun()

# ---------- HISTORIAL ----------
if not df.empty:
    st.markdown("---")
    st.subheader("Historial reciente")
    df_display = df.sort_values("Fecha", ascending=False).head(14).copy()
    df_display["Fecha"] = df_display["Fecha"].dt.strftime("%d-%m-%Y")
    st.dataframe(df_display, use_container_width=True, hide_index=True)
