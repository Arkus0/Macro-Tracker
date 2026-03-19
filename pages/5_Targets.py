import streamlit as st
import pandas as pd
from datetime import date
from auth import require_auth
import db
from services.adaptive_coach import MacroPreset, PRESET_MAP

user_id = require_auth()

st.title("Macro Targets")

# ---------- TARGETS ACTUALES ----------
targets = db.get_active_targets(user_id)

if targets:
    st.subheader("Objetivos actuales")
    col1, col2, col3, col4 = st.columns(4)
    col1.metric("Kcal", f"{targets['kcal_target']}")
    col2.metric("Proteinas", f"{targets['protein_target']:.0f} g" if targets.get("protein_target") else "—")
    col3.metric("Carbs", f"{targets['carbs_target']:.0f} g" if targets.get("carbs_target") else "—")
    col4.metric("Grasas", f"{targets['fat_target']:.0f} g" if targets.get("fat_target") else "—")

    # Micros
    if any(targets.get(k) for k in ["fiber_target", "sugar_limit", "saturated_fat_limit", "sodium_limit"]):
        st.markdown("**Micronutrientes:**")
        c1, c2, c3, c4 = st.columns(4)
        if targets.get("fiber_target"):
            c1.metric("Fibra", f"{targets['fiber_target']:.0f} g")
        if targets.get("sugar_limit"):
            c2.metric("Azucar (lim)", f"<{targets['sugar_limit']:.0f} g")
        if targets.get("saturated_fat_limit"):
            c3.metric("Grasa sat. (lim)", f"<{targets['saturated_fat_limit']:.0f} g")
        if targets.get("sodium_limit"):
            c4.metric("Sodio (lim)", f"<{targets['sodium_limit']:.1f} g")

    if targets.get("notes"):
        st.caption(targets["notes"])
else:
    st.info("No tienes targets configurados. Usa el Coach para generar targets automaticos, o crealos manualmente abajo.")

# ---------- EDITAR / CREAR TARGETS ----------
st.markdown("---")
st.subheader("Editar targets")

with st.form("targets_form"):
    # Quick preset
    preset_options = {"Manual": None}
    for name, p in PRESET_MAP.items():
        if name != "custom":
            preset_options[p.display_name] = name
    selected = st.selectbox("Preset rapido", list(preset_options.keys()))

    kcal = st.number_input("Kcal objetivo", min_value=1000, max_value=6000, step=50,
                           value=targets["kcal_target"] if targets else 2000)

    # Auto-fill from preset
    preset_key = preset_options[selected]
    if preset_key:
        preset = PRESET_MAP[preset_key]
        macros = preset.calculate_grams(kcal)
        default_p = macros.protein
        default_c = macros.carbs
        default_f = macros.fat
    else:
        default_p = int(targets["protein_target"]) if targets and targets.get("protein_target") else 150
        default_c = int(targets["carbs_target"]) if targets and targets.get("carbs_target") else 200
        default_f = int(targets["fat_target"]) if targets and targets.get("fat_target") else 70

    col1, col2, col3 = st.columns(3)
    with col1:
        protein = st.number_input("Proteinas (g)", min_value=0, max_value=500, step=5, value=default_p)
    with col2:
        carbs = st.number_input("Carbs (g)", min_value=0, max_value=800, step=5, value=default_c)
    with col3:
        fat = st.number_input("Grasas (g)", min_value=0, max_value=300, step=5, value=default_f)

    # Verify kcal from macros
    kcal_from_macros = (protein * 4) + (carbs * 4) + (fat * 9)
    st.caption(f"Kcal de macros: {kcal_from_macros} (objetivo: {kcal})")

    # Micros
    with st.expander("Micronutrientes (opcional)"):
        c1, c2 = st.columns(2)
        with c1:
            fiber = st.number_input("Fibra objetivo (g)", min_value=0, max_value=100, step=5,
                                    value=int(targets["fiber_target"]) if targets and targets.get("fiber_target") else 25)
            sugar_lim = st.number_input("Limite azucar (g)", min_value=0, max_value=200, step=5,
                                        value=int(targets["sugar_limit"]) if targets and targets.get("sugar_limit") else 50)
        with c2:
            sat_fat_lim = st.number_input("Limite grasa saturada (g)", min_value=0, max_value=100, step=5,
                                           value=int(targets["saturated_fat_limit"]) if targets and targets.get("saturated_fat_limit") else 20)
            sodium_lim = st.number_input("Limite sodio (g)", min_value=0.0, max_value=10.0, step=0.1,
                                          value=float(targets["sodium_limit"]) if targets and targets.get("sodium_limit") else 2.3)

    valid_from = st.date_input("Valido desde", value=date.today())
    notes = st.text_input("Notas (opcional)", value="")

    submitted = st.form_submit_button("Guardar targets", type="primary")
    if submitted:
        db.save_targets(
            user_id, valid_from, kcal,
            protein_target=protein, carbs_target=carbs, fat_target=fat,
            fiber_target=fiber if fiber > 0 else None,
            sugar_limit=sugar_lim if sugar_lim > 0 else None,
            saturated_fat_limit=sat_fat_lim if sat_fat_lim > 0 else None,
            sodium_limit=sodium_lim if sodium_lim > 0 else None,
            notes=notes or None,
        )
        # Also update coach plan if active
        plan = db.get_active_coach_plan(user_id)
        if plan:
            db.update_coach_plan(plan["id"], current_kcal_target=kcal)
        st.success("Targets guardados.")
        st.rerun()

# ---------- HISTORIAL ----------
st.markdown("---")
st.subheader("Historial de targets")
history = db.get_targets_history(user_id)
if history:
    df_hist = pd.DataFrame(history)[["valid_from", "kcal_target", "protein_target", "carbs_target", "fat_target", "notes"]]
    df_hist.columns = ["Desde", "Kcal", "Proteinas", "Carbs", "Grasas", "Notas"]
    st.dataframe(df_hist, use_container_width=True, hide_index=True)
else:
    st.info("No hay historial de targets.")
