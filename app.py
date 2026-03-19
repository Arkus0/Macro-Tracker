import streamlit as st

st.set_page_config(
    page_title="Pocket Diet",
    page_icon="🏋️",
    layout="wide",
    initial_sidebar_state="expanded",
)

st.title("Pocket Diet")
st.caption("by Jotacorp · Lightweight baby!")
st.markdown("---")

st.markdown("""
### Bienvenido a Pocket Diet

Tu tracker de nutricion y peso personal. Usa el menu lateral para navegar:

- **Registro de Peso** — Registra tu peso diario y visualiza tendencias
- **Food Log** — Registra comidas con macros, busca en Open Food Facts o tu catalogo
- **Analytics** — TDEE dinamico, comparativas mensuales, progreso hacia metas
""")
