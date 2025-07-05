import streamlit as st
import pandas as pd
from datetime import date, timedelta

# ---------- CONFIG ----------
CSV_FILE = 'datos_peso.csv'
EXCEL_FILE = 'datos_peso.xlsx'

# ---------- CARGAR DATOS EXISTENTES ----------
try:
    df = pd.read_csv(CSV_FILE)
    if 'Fecha' in df.columns:
        df['Fecha'] = pd.to_datetime(df['Fecha'], errors='coerce')
except FileNotFoundError:
    df = pd.DataFrame(columns=['Fecha', 'Peso', 'Kcal'])

# ---------- INPUTS ----------
st.title('Seguimiento de Peso y Kcal (mejorado)')

fecha = st.date_input('Fecha', value=date.today())
peso = st.number_input('Peso (kg)', min_value=30.0, max_value=300.0, step=0.1)
kcal = st.number_input('Kcal consumidas', min_value=500, max_value=10000, step=10)
objetivo_peso = st.number_input('Peso objetivo (kg)', min_value=30.0, max_value=300.0, step=0.1, value=70.0)

# ---------- VALIDACIÓN ----------
registro_existente = not df[df['Fecha'] == pd.to_datetime(fecha)].empty

if registro_existente:
    st.warning('Ya existe un registro para esta fecha. Al guardar, se sobrescribirá.')

if st.button('Guardar'):
    nueva_fila = pd.DataFrame({'Fecha': [fecha], 'Peso': [peso], 'Kcal': [kcal]})
    df = df[df['Fecha'] != pd.to_datetime(fecha)]  # Eliminar fila existente si la hay
    df = pd.concat([df, nueva_fila], ignore_index=True)

    # Convertir fechas antes de ordenar
    if 'Fecha' in df.columns:
        df['Fecha'] = pd.to_datetime(df['Fecha'], errors='coerce')
    df = df.sort_values('Fecha')

    # Guardar CSV y Excel
    df.to_csv(CSV_FILE, index=False)
    df.to_excel(EXCEL_FILE, index=False)

    st.success('Datos guardados correctamente. Recarga la página para ver las actualizaciones.')

# ---------- CÁLCULOS ----------
if not df.empty and len(df) > 1:
    df = df.sort_values('Fecha')

    peso_inicio = df.iloc[0]['Peso']
    peso_actual = df.iloc[-1]['Peso']
    dias = (df.iloc[-1]['Fecha'] - df.iloc[0]['Fecha']).days or 1

    cambio_peso = peso_actual - peso_inicio
    cambio_peso_kg = round(cambio_peso, 2)

    total_kcal = df['Kcal'].sum()
    kcal_diarias_prom = total_kcal / len(df)

    if dias > 0:
        kg_estimados_por_kcal = (cambio_peso * 7700) / dias
        mantenimiento_estimado = kcal_diarias_prom - kg_estimados_por_kcal
    else:
        mantenimiento_estimado = kcal_diarias_prom

    deficit_actual = mantenimiento_estimado - kcal_diarias_prom

    # Estadísticas rápidas
    peso_min = df['Peso'].min()
    peso_max = df['Peso'].max()
    peso_prom = df['Peso'].mean()
    kcal_prom = df['Kcal'].mean()

    dias_deficit = len(df[df['Kcal'] < mantenimiento_estimado])
    dias_superavit = len(df[df['Kcal'] > mantenimiento_estimado])

    st.subheader('Resumen')
    st.write(f"Cambio de peso: {cambio_peso_kg} kg en {dias} días") 
    st.write(f"Kcal promedio: {kcal_diarias_prom:.0f}") 
    st.write(f"Mantenimiento estimado: {mantenimiento_estimado:.0f} kcal/día") 
    st.write(f"Déficit aproximado actual: {deficit_actual:.0f} kcal/día") 

    st.subheader('Estadísticas rápidas')
    st.write(f"Peso mínimo: {peso_min:.1f} kg") 
    st.write(f"Peso máximo: {peso_max:.1f} kg") 
    st.write(f"Peso promedio: {peso_prom:.1f} kg") 
    st.write(f"Kcal promedio: {kcal_prom:.0f}") 
    st.write(f"Días en déficit: {dias_deficit}") 
    st.write(f"Días en superávit: {dias_superavit}") 

    # Proyección hacia objetivo
    if deficit_actual != 0:
        kg_a_perder = peso_actual - objetivo_peso
        dias_estimados_objetivo = (kg_a_perder * 7700) / deficit_actual if deficit_actual != 0 else float('inf')
        dias_estimados_objetivo = max(0, dias_estimados_objetivo)
    else:
        dias_estimados_objetivo = float('inf')

    st.subheader('Progreso hacia objetivo')
    st.write(f"Peso actual: {peso_actual:.1f} kg") 
    st.write(f"Peso objetivo: {objetivo_peso:.1f} kg") 

    if dias_estimados_objetivo != float('inf'):
        st.write(f"Días estimados para alcanzar el objetivo: {dias_estimados_objetivo:.0f}") 
    else:
        st.write("No hay déficit actual para estimar los días.") 

    porcentaje_progreso = max(0, min(1, (peso_inicio - peso_actual) / (peso_inicio - objetivo_peso))) if peso_inicio != objetivo_peso else 1
    st.progress(porcentaje_progreso)

    # Gráfico con media móvil
    st.subheader('Tendencia de peso (con media móvil)')
    df_graf = df.copy()
    df_graf['Fecha'] = pd.to_datetime(df_graf['Fecha'])
    df_graf = df_graf.sort_values('Fecha')
    df_graf['Media_movil'] = df_graf['Peso'].rolling(window=7, min_periods=1).mean()

    st.line_chart(df_graf.set_index('Fecha')[['Peso', 'Media_movil']])

else:
    st.info('Agrega al menos dos registros para calcular tendencias y estimaciones.')
