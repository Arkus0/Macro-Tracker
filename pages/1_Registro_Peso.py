import streamlit as st
import pandas as pd
from datetime import date
from auth import require_auth
import db

user_id = require_auth()

st.title("Registro de Peso")

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

existing = db.get_weight_entry_by_date(user_id, fecha)
if existing:
    st.warning("Ya existe un registro para esta fecha. Se sobrescribira.")

if st.button("Guardar", type="primary"):
    if peso is None and kcal is None:
        st.error("Introduce al menos peso o kcal.")
    else:
        db.save_weight_entry(user_id, fecha, peso=peso, kcal=kcal)
        st.success("Guardado correctamente.")
        st.rerun()

# ---------- HISTORIAL ----------
entries = db.get_weight_entries(user_id, limit=14)
if entries:
    st.markdown("---")
    st.subheader("Historial reciente")
    df_display = pd.DataFrame(entries)
    df_display["fecha"] = pd.to_datetime(df_display["fecha"]).dt.strftime("%d-%m-%Y")
    df_display = df_display[["fecha", "peso", "kcal"]].rename(
        columns={"fecha": "Fecha", "peso": "Peso (kg)", "kcal": "Kcal"}
    )
    st.dataframe(df_display, use_container_width=True, hide_index=True)
