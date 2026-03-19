import streamlit as st
import pandas as pd
import altair as alt
from datetime import date, timedelta
from auth import require_auth
import db
from services.adaptive_coach import (
    MacroPreset, PRESET_MAP, WeightGoal, CheckInStatus,
    calculate_checkin, build_weekly_data, get_daily_adjustment,
)
from services.weight_trend import WeightTrendCalculator
from services.goal_projection import calculate_projection

user_id = require_auth()

st.title("Coach Adaptativo")

plan = db.get_active_coach_plan(user_id)

# ============================================================================
# SETUP — Crear plan si no existe
# ============================================================================
if not plan:
    st.subheader("Configurar tu plan")
    st.info("Configura tu objetivo y el coach ajustara tus macros automaticamente cada semana.")

    with st.form("setup_plan"):
        col1, col2 = st.columns(2)
        with col1:
            goal = st.selectbox("Objetivo", ["Perder peso", "Mantener peso", "Ganar peso"])
            target_weight = st.number_input("Peso objetivo (kg)", min_value=30.0, max_value=300.0, step=0.1, value=70.0)
            rate = st.number_input(
                "Velocidad (kg/semana)", min_value=0.0, max_value=1.5, step=0.1, value=0.5,
                help="Recomendado: 0.3-0.7 para perdida, 0.2-0.5 para ganancia",
            )
        with col2:
            initial_tdee = st.number_input("TDEE estimado inicial (kcal)", min_value=1000, max_value=6000, step=50, value=2200,
                                           help="Si no sabes, usa 2200 para hombres o 1800 para mujeres. Se ajustara solo.")
            starting_weight = st.number_input("Peso actual (kg)", min_value=30.0, max_value=300.0, step=0.1, value=80.0)

            preset_options = {p.display_name: name for name, p in PRESET_MAP.items()}
            selected_preset = st.selectbox("Distribucion de macros", list(preset_options.keys()))
            preset_key = preset_options[selected_preset]

        submitted = st.form_submit_button("Crear plan", type="primary")
        if submitted:
            goal_map = {"Perder peso": "lose", "Mantener peso": "maintain", "Ganar peso": "gain"}
            plan_id = db.save_coach_plan(
                user_id=user_id,
                goal=goal_map[goal],
                weekly_rate_kg=rate,
                initial_tdee=initial_tdee,
                starting_weight=starting_weight,
                target_weight=target_weight,
                start_date=date.today(),
                macro_preset=preset_key,
            )
            # Create initial targets
            preset = PRESET_MAP[preset_key]
            adjustment = get_daily_adjustment(goal_map[goal], rate)
            target_kcal = initial_tdee + adjustment
            macros = preset.calculate_grams(target_kcal)
            db.save_targets(
                user_id, date.today(), target_kcal,
                protein_target=macros.protein, carbs_target=macros.carbs, fat_target=macros.fat,
                notes=f"Inicial — Coach adaptativo ({selected_preset})",
            )
            st.success("Plan creado. El coach ajustara tus macros semanalmente.")
            st.rerun()
    st.stop()

# ============================================================================
# DASHBOARD — Plan activo
# ============================================================================
st.subheader("Tu plan")

goal_labels = {"lose": "Perder peso", "maintain": "Mantener peso", "gain": "Ganar peso"}
preset = PRESET_MAP.get(plan.get("macro_preset", "balanced"), MacroPreset.BALANCED)

col1, col2, col3, col4 = st.columns(4)
col1.metric("Objetivo", goal_labels.get(plan["goal"], plan["goal"]))
col2.metric("Velocidad", f"{plan['weekly_rate_kg']:.1f} kg/sem")
col3.metric("Target kcal", f"{plan.get('current_kcal_target', plan['initial_tdee'])}")
col4.metric("Preset", preset.display_name)

targets = db.get_active_targets(user_id)
if targets:
    st.markdown("**Macros diarios:**")
    c1, c2, c3, c4 = st.columns(4)
    c1.metric("Kcal", f"{targets['kcal_target']}")
    if targets.get("protein_target"):
        c2.metric("Proteinas", f"{targets['protein_target']:.0f} g")
    if targets.get("carbs_target"):
        c3.metric("Carbs", f"{targets['carbs_target']:.0f} g")
    if targets.get("fat_target"):
        c4.metric("Grasas", f"{targets['fat_target']:.0f} g")

# ============================================================================
# GOAL PROJECTION
# ============================================================================
weight_entries = db.get_weight_entries(user_id)
if len(weight_entries) >= 3:
    trend_calc = WeightTrendCalculator()
    trend_entries = [{"fecha": w["fecha"], "peso": w["peso"]} for w in weight_entries if w.get("peso")]
    if len(trend_entries) >= 2:
        trend_result = trend_calc.calculate(trend_entries)
        projection = calculate_projection(plan, trend_result)

        if projection:
            st.markdown("---")
            st.subheader("Proyeccion")
            col1, col2, col3 = st.columns(3)
            col1.metric("Peso tendencia", f"{projection.current_trend_weight:.1f} kg")
            col2.metric("Meta", f"{projection.goal_weight_kg:.1f} kg")
            col3.metric("Progreso", f"{projection.progress_percentage:.0f}%")

            st.info(f"{projection.progress_message} | {projection.pace_message}")

            if projection.progress_percentage > 0:
                st.progress(min(1.0, projection.progress_percentage / 100))

            # Goal projection chart
            goal_line = projection.generate_goal_line()
            if goal_line:
                df_proj = pd.DataFrame(goal_line)
                df_proj["Fecha"] = pd.to_datetime(df_proj["fecha"])

                chart = (
                    alt.Chart(df_proj)
                    .transform_fold(["projected", "goal"], as_=["Variable", "Valor"])
                    .mark_line()
                    .encode(
                        x="Fecha:T",
                        y=alt.Y("Valor:Q", title="kg"),
                        color="Variable:N",
                        strokeDash=alt.condition(
                            alt.datum.Variable == "goal",
                            alt.value([5, 5]),
                            alt.value([0]),
                        ),
                    )
                    .properties(height=300)
                )
                st.altair_chart(chart, use_container_width=True)

# ============================================================================
# WEEKLY CHECK-IN
# ============================================================================
st.markdown("---")
st.subheader("Check-in semanal")

last_checkin = plan.get("last_checkin_date")
if last_checkin:
    from datetime import datetime
    if isinstance(last_checkin, str):
        last_checkin = datetime.fromisoformat(last_checkin).date()
    days_since = (date.today() - last_checkin).days
    st.write(f"Ultimo check-in: **{last_checkin}** ({days_since} dias)")
    if days_since < 7:
        st.info(f"Espera {7 - days_since} dias mas para el proximo check-in.")
else:
    days_since = 999
    st.write("Aun no has hecho ningun check-in.")

if days_since >= 7 or not last_checkin:
    if st.button("Hacer check-in semanal", type="primary"):
        # Get data
        end_date = date.today()
        start_date = end_date - timedelta(days=6)

        food_totals = db.get_food_daily_totals(user_id, start_date, end_date)
        weight_all = db.get_weight_entries(user_id)

        weekly_data = build_weekly_data(weight_all, food_totals, start_date, end_date)
        result = calculate_checkin(plan, weekly_data)

        if result.status == CheckInStatus.READY:
            st.success("Check-in calculado!")

            for line in result.explanation.all_lines:
                if line:
                    st.write(f"- {line}")

            if result.was_clamped:
                st.warning("El cambio fue limitado para seguridad (max ±200 kcal/semana).")

            st.write(f"**Macros propuestos:** {result.proposed_macros.protein}g prot | "
                     f"{result.proposed_macros.carbs}g carbs | {result.proposed_macros.fat}g grasas")

            col_apply, col_dismiss = st.columns(2)
            with col_apply:
                if st.button("Aplicar cambios", type="primary"):
                    # Save targets
                    db.save_targets(
                        user_id, end_date, result.proposed_kcal_target,
                        protein_target=result.proposed_macros.protein,
                        carbs_target=result.proposed_macros.carbs,
                        fat_target=result.proposed_macros.fat,
                        notes=f"Check-in {end_date} — TDEE: {result.estimated_tdee}",
                    )
                    # Update plan
                    db.update_coach_plan(
                        plan["id"],
                        last_checkin_date=end_date,
                        current_kcal_target=result.proposed_kcal_target,
                    )
                    # Save history
                    db.save_checkin(
                        user_id, end_date, result.estimated_tdee,
                        weekly_data.avg_daily_kcal, weekly_data.trend_weight_start,
                        weekly_data.trend_weight_end, result.proposed_kcal_target, applied=True,
                    )
                    st.success("Targets actualizados!")
                    st.rerun()
            with col_dismiss:
                if st.button("Descartar"):
                    db.save_checkin(
                        user_id, end_date, result.estimated_tdee,
                        weekly_data.avg_daily_kcal, weekly_data.trend_weight_start,
                        weekly_data.trend_weight_end, result.proposed_kcal_target, applied=False,
                    )
                    db.update_coach_plan(plan["id"], last_checkin_date=end_date)
                    st.info("Check-in guardado sin aplicar cambios.")
                    st.rerun()
        else:
            st.warning(result.error_message or "No hay suficientes datos para el check-in.")

# ============================================================================
# CHECK-IN HISTORY
# ============================================================================
checkins = db.get_checkin_history(user_id)
if checkins:
    st.markdown("---")
    st.subheader("Historial de check-ins")
    df_ci = pd.DataFrame(checkins)[["checkin_date", "estimated_tdee", "avg_daily_kcal", "proposed_kcal_target", "applied"]]
    df_ci.columns = ["Fecha", "TDEE", "Kcal prom", "Target propuesto", "Aplicado"]
    df_ci["Aplicado"] = df_ci["Aplicado"].map({1: "Si", 0: "No", True: "Si", False: "No"})
    st.dataframe(df_ci, use_container_width=True, hide_index=True)

# ============================================================================
# RESET PLAN
# ============================================================================
st.markdown("---")
with st.expander("Opciones avanzadas"):
    if st.button("Resetear plan"):
        db.update_coach_plan(plan["id"], active=0)
        st.success("Plan desactivado. Puedes crear uno nuevo.")
        st.rerun()
