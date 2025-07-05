
import streamlit as st
import pandas as pd
import altair as alt
from datetime import date

# ---------- SPLASH INICIAL ----------
st.title("Pocket Diet")
st.caption("by Jotacorp · Lightweight baby! 🏋️‍♂️🔥")
st.markdown("---")

# ---------- CONFIG ----------
CSV_FILE = 'datos_peso.csv'
EXCEL_FILE = 'datos_peso.xlsx'

# ---------- CARGAR DATOS EXISTENTES ----------
try:
    df = pd.read_csv(CSV_FILE)
    df['Fecha'] = pd.to_datetime(df['Fecha'], errors='coerce')
    df = df[df['Fecha'].notnull()]
except FileNotFoundError:
    df = pd.DataFrame({
        'Fecha': pd.Series(dtype='datetime64[ns]'),
        'Peso': pd.Series(dtype='float'),
        'Kcal': pd.Series(dtype='float')
    })

# ---------- PESTAÑAS ----------
tab1, tab2 = st.tabs(["Introducir datos", "Resumen y progreso"])

# ---------- PESTAÑA 1: INPUT ----------
with tab1:
    fecha = st.date_input('Fecha para registrar', value=date.today())
    fecha_ts = pd.Timestamp(fecha)

    peso = st.number_input('Peso (kg)', min_value=0.0, max_value=300.0, step=0.1, value=None, placeholder="Introduce tu peso")
    kcal = st.number_input('Kcal consumidas', min_value=0, max_value=10000, step=10, value=None, placeholder="Introduce tus kcal")

    registro_existente = not df[df['Fecha'] == fecha_ts].empty

    if registro_existente:
        st.warning('Ya existe un registro para esta fecha. Al guardar, se sobrescribirá.')

    if st.button('Guardar'):
        nueva_fila = pd.DataFrame({
            'Fecha': [fecha_ts],
            'Peso': [float(peso)],
            'Kcal': [float(kcal)]
        })
        df = df[df['Fecha'] != fecha_ts]
        df = pd.concat([df, nueva_fila], ignore_index=True)
        df['Fecha'] = pd.to_datetime(df['Fecha'], errors='coerce')
        df = df[df['Fecha'].notnull()]
        df = df.sort_values('Fecha')
        df.to_csv(CSV_FILE, index=False)
        try:
            df.to_excel(EXCEL_FILE, index=False)
        except PermissionError:
            st.warning("⚠️ No se pudo guardar el archivo Excel porque está abierto. Ciérralo y vuelve a intentarlo.")
        st.success('Datos guardados correctamente. Recarga la página para ver las actualizaciones.')

# ---------- PESTAÑA 2: RESUMEN ----------
with tab2:
    objetivo_peso = st.number_input('Peso objetivo final (kg)', min_value=30.0, max_value=300.0, step=0.1, value=70.0)
    meta_1 = st.number_input('Meta intermedia (kg)', min_value=30.0, max_value=300.0, step=0.1, value=80.0)

    if not df.empty and len(df) > 1:
        df = df.sort_values('Fecha')
        st.subheader("Análisis por rango de fechas")
        fecha_min = df['Fecha'].min().date()
        fecha_max = df['Fecha'].max().date()
        rango = st.slider("Selecciona el rango", min_value=fecha_min, max_value=fecha_max, value=(fecha_min, fecha_max))
        df_rango = df[df['Fecha'].between(pd.Timestamp(rango[0]), pd.Timestamp(rango[1]))]
        
        if df_rango.empty:
            st.warning("No hay datos en el rango seleccionado.")
        else:
            peso_trend = df_rango['Peso'].rolling(window=7, min_periods=1).mean().iloc[-1]
            fecha_max_rango = df_rango['Fecha'].max()
            fecha_min_4w = fecha_max_rango - pd.Timedelta(days=27)
            df_4w = df_rango[df_rango['Fecha'].between(fecha_min_4w, fecha_max_rango)]
            if df_4w.empty:
                df_4w = df_rango.copy()
            peso_inicio = df_4w.iloc[0]['Peso']
            peso_actual = df_4w.iloc[-1]['Peso']
            dias = (df_4w.iloc[-1]['Fecha'] - df_4w.iloc[0]['Fecha']).days or 1
            cambio_peso = peso_actual - peso_inicio
            total_kcal = df_4w['Kcal'].sum()
            kcal_diarias_prom = total_kcal / len(df_4w)
            if dias > 0:
                kg_estimados_por_kcal = (cambio_peso * 7700) / dias
                tdee_dinamico = kcal_diarias_prom - kg_estimados_por_kcal
            else:
                tdee_dinamico = kcal_diarias_prom

            col1, col2, col3 = st.columns(3)
            col1.metric("Peso tendencia", f"{peso_trend:.1f} kg")
            col2.metric("TDEE dinámico", f"{tdee_dinamico:.0f} kcal")
            col3.metric("Kcal promedio 4w", f"{kcal_diarias_prom:.0f} kcal")

            st.subheader("Comparativa mensual")
            df_rango.set_index('Fecha', inplace=True)
            mensual = df_rango.resample('M').mean().round(2)
            df_rango.reset_index(inplace=True)

            if len(mensual) > 1:
                for i in range(1, len(mensual)):
                    peso_diff = mensual['Peso'].iloc[i] - mensual['Peso'].iloc[i-1]
                    kcal_diff = mensual['Kcal'].iloc[i] - mensual['Kcal'].iloc[i-1]
                    st.write(f"{mensual.index[i-1].strftime('%B')} → {mensual.index[i].strftime('%B')}: ")
                    st.write(f"- Peso: {mensual['Peso'].iloc[i-1]:.1f} kg → {mensual['Peso'].iloc[i]:.1f} kg (Δ {peso_diff:+.1f} kg)")
                    st.write(f"- Kcal: {mensual['Kcal'].iloc[i-1]:.0f} → {mensual['Kcal'].iloc[i]:.0f} (Δ {kcal_diff:+.0f} kcal)")
            else:
                st.info("No hay datos suficientes para comparación mensual.")

            st.subheader('Progreso hacia metas')
            for meta, label in zip([meta_1, objetivo_peso], ["Meta intermedia", "Meta final"]):
                if peso_actual != meta:
                    if peso_inicio != meta:
                        porcentaje_meta = max(0, min(1, (peso_inicio - peso_actual) / (peso_inicio - meta)))
                    else:
                        porcentaje_meta = 1
                else:
                    porcentaje_meta = 1

                st.write(f"{label}: {meta:.1f} kg")
                st.progress(porcentaje_meta)

            st.subheader('Gráfica de peso')
            df_graf = df_rango.copy()
            df_graf['Media_movil'] = df_graf['Peso'].rolling(window=7, min_periods=1).mean()
            y_min = df_graf['Peso'].min() - 2
            y_max = df_graf['Peso'].max() + 2
            chart_peso = alt.Chart(df_graf).transform_fold(
                ['Peso', 'Media_movil'],
                as_=['Variable', 'Valor']
            ).mark_line().encode(
                x='Fecha:T',
                y=alt.Y('Valor:Q', scale=alt.Scale(domain=[y_min, y_max])),
                color='Variable:N'
            ).properties(width=700, height=400)
            st.altair_chart(chart_peso, use_container_width=True)

            st.subheader('Gráfica de kcal vs TDEE')
            df_graf['TDEE'] = tdee_dinamico
            chart_kcal = alt.Chart(df_graf).transform_fold(
                ['Kcal', 'TDEE'],
                as_=['Variable', 'Valor']
            ).mark_line().encode(
                x='Fecha:T',
                y='Valor:Q',
                color='Variable:N'
            ).properties(width=700, height=300)
            st.altair_chart(chart_kcal, use_container_width=True)

    else:
        st.info('Agrega al menos dos registros para mostrar resúmenes y gráficas.')
