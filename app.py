import streamlit as st
import db
from auth import require_auth, get_username, logout

st.set_page_config(
    page_title="Pocket Diet",
    page_icon="🏋️",
    layout="wide",
    initial_sidebar_state="expanded",
)

db.init_db()
user_id = require_auth()

# Sidebar user info
st.sidebar.markdown(f"**Usuario:** {get_username()}")
if st.sidebar.button("Cerrar sesion"):
    logout()
    st.rerun()

st.title("Pocket Diet")
st.caption("by Jotacorp · Lightweight baby!")
st.markdown("---")

st.markdown("""
### Bienvenido a Pocket Diet

Tu tracker de nutricion y peso personal. Usa el menu lateral para navegar:

- **Registro de Peso** — Registra tu peso diario y visualiza tendencias
- **Food Log** — Registra comidas con macros, busca en Open Food Facts o tu catalogo
- **Analytics** — TDEE dinamico, comparativas mensuales, progreso hacia metas
- **Coach** — Coach adaptativo con check-ins semanales y ajuste automatico
- **Targets** — Objetivos diarios de macros y kcal
- **Recetas** — Crea recetas multi-ingrediente con macros automaticos
- **Medidas** — Tracking de medidas corporales
""")

# Quick stats
weight_entries = db.get_weight_entries(user_id, limit=1)
if weight_entries:
    latest = weight_entries[0]
    col1, col2, col3 = st.columns(3)
    if latest.get("peso"):
        col1.metric("Ultimo peso", f"{latest['peso']:.1f} kg")
    if latest.get("kcal"):
        col2.metric("Ultimas kcal", f"{latest['kcal']:.0f}")

    targets = db.get_active_targets(user_id)
    if targets:
        col3.metric("Target kcal", f"{targets['kcal_target']}")
