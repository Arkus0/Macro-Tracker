import streamlit as st
import pandas as pd
import altair as alt
from datetime import date
from auth import require_auth
import db

user_id = require_auth()

st.title("Medidas Corporales")

# ---------- NUEVO REGISTRO ----------
st.subheader("Nuevo registro")

with st.form("body_measurement"):
    fecha = st.date_input("Fecha", value=date.today())

    col1, col2, col3 = st.columns(3)
    with col1:
        cintura = st.number_input("Cintura (cm)", min_value=0.0, max_value=200.0, step=0.5, value=None, placeholder="cm")
        pecho = st.number_input("Pecho (cm)", min_value=0.0, max_value=200.0, step=0.5, value=None, placeholder="cm")
        caderas = st.number_input("Caderas (cm)", min_value=0.0, max_value=200.0, step=0.5, value=None, placeholder="cm")
    with col2:
        brazos = st.number_input("Brazos (cm)", min_value=0.0, max_value=100.0, step=0.5, value=None, placeholder="cm")
        muslos = st.number_input("Muslos (cm)", min_value=0.0, max_value=100.0, step=0.5, value=None, placeholder="cm")
        cuello = st.number_input("Cuello (cm)", min_value=0.0, max_value=100.0, step=0.5, value=None, placeholder="cm")
    with col3:
        body_fat = st.number_input("% Grasa corporal", min_value=0.0, max_value=60.0, step=0.5, value=None, placeholder="%")

    submitted = st.form_submit_button("Guardar", type="primary")
    if submitted:
        has_data = any(v is not None for v in [cintura, pecho, caderas, brazos, muslos, cuello, body_fat])
        if not has_data:
            st.error("Introduce al menos una medida.")
        else:
            db.save_body_measurement(
                user_id, fecha,
                cintura=cintura, pecho=pecho, caderas=caderas,
                brazos=brazos, muslos=muslos, cuello=cuello,
                body_fat_pct=body_fat,
            )
            st.success("Medidas guardadas.")
            st.rerun()

# ---------- HISTORIAL ----------
measurements = db.get_body_measurements(user_id)

if measurements:
    st.markdown("---")
    st.subheader("Historial")

    df = pd.DataFrame(measurements)
    df["Fecha"] = pd.to_datetime(df["fecha"])

    # Table
    display_cols = {
        "fecha": "Fecha", "cintura": "Cintura", "pecho": "Pecho",
        "caderas": "Caderas", "brazos": "Brazos", "muslos": "Muslos",
        "cuello": "Cuello", "body_fat_pct": "% Grasa",
    }
    df_display = df[[c for c in display_cols if c in df.columns]].rename(columns=display_cols)
    st.dataframe(df_display, use_container_width=True, hide_index=True)

    # Charts
    st.subheader("Graficas")
    medida_options = {
        "cintura": "Cintura", "pecho": "Pecho", "caderas": "Caderas",
        "brazos": "Brazos", "muslos": "Muslos", "cuello": "Cuello",
        "body_fat_pct": "% Grasa",
    }

    selected = st.multiselect("Medidas a graficar", list(medida_options.values()), default=["Cintura"])
    reverse_map = {v: k for k, v in medida_options.items()}
    cols_to_plot = [reverse_map[s] for s in selected if reverse_map.get(s) in df.columns]

    if cols_to_plot:
        df_plot = df[["Fecha"] + cols_to_plot].copy()
        df_plot = df_plot.sort_values("Fecha")
        # Rename for display
        rename_map = {c: medida_options[c] for c in cols_to_plot}
        df_plot = df_plot.rename(columns=rename_map)
        display_names = list(rename_map.values())

        chart = (
            alt.Chart(df_plot)
            .transform_fold(display_names, as_=["Medida", "Valor"])
            .mark_line(point=True)
            .encode(
                x="Fecha:T",
                y=alt.Y("Valor:Q", title="cm / %"),
                color="Medida:N",
            )
            .properties(height=350)
        )
        st.altair_chart(chart, use_container_width=True)

    # Comparison first vs last
    if len(df) >= 2:
        st.subheader("Comparativa")
        first = df.iloc[-1]  # oldest (sorted DESC)
        last = df.iloc[0]    # newest
        st.write(f"**{first['fecha']}** vs **{last['fecha']}**")
        for col_key, col_name in medida_options.items():
            v1 = first.get(col_key)
            v2 = last.get(col_key)
            if v1 is not None and v2 is not None and pd.notna(v1) and pd.notna(v2):
                diff = v2 - v1
                unit = "%" if col_key == "body_fat_pct" else "cm"
                st.write(f"- **{col_name}**: {v1:.1f} -> {v2:.1f} ({diff:+.1f} {unit})")
else:
    st.info("No hay medidas registradas. Anade tu primera medicion arriba.")
