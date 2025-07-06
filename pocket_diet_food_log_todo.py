
import streamlit as st
import pandas as pd
import requests
from datetime import date, timedelta

st.title("Pocket Diet - Food Log Completo 🍽️")
st.caption("by Jotacorp · Lightweight baby! 🏋️‍♂️🔥")
st.markdown("---")

CSV_FILE = 'comidas.csv'
CATALOGO_FILE = 'catalogo_comidas.csv'

# ---------- CARGAR COMIDAS EXISTENTES ----------
try:
    df_comidas = pd.read_csv(CSV_FILE)
    df_comidas['Fecha'] = pd.to_datetime(df_comidas['Fecha'], errors='coerce').dt.date
except FileNotFoundError:
    df_comidas = pd.DataFrame(columns=['Fecha', 'Comida', 'Marca', 'Gramos', 'Kcal', 'Proteínas', 'Carbs', 'Grasas'])

# ---------- CARGAR CATÁLOGO ----------
try:
    df_catalogo = pd.read_csv(CATALOGO_FILE)
except FileNotFoundError:
    df_catalogo = pd.DataFrame(columns=['Comida', 'Marca', 'Kcal_100g', 'Proteínas_100g', 'Carbs_100g', 'Grasas_100g'])

# ---------- SELECCIONAR FECHA ----------
fecha = st.date_input('Fecha', value=date.today())

# ---------- COPIAR DÍA ANTERIOR ----------
if st.button("Copiar comidas del día anterior"):
    dia_anterior = fecha - timedelta(days=1)
    df_ayer = df_comidas[df_comidas['Fecha'] == dia_anterior]
    if not df_ayer.empty:
        copia = df_ayer.copy()
        copia['Fecha'] = fecha
        df_comidas = pd.concat([df_comidas, copia], ignore_index=True)
        df_comidas.to_csv(CSV_FILE, index=False)
        st.success("¡Comidas copiadas del día anterior!")
    else:
        st.info("No hay comidas en el día anterior.")

# ---------- BUSCADOR OPEN FOOD FACTS ----------
st.subheader("Buscador en Open Food Facts (opcional)")
busqueda = st.text_input("Buscar alimento en Open Food Facts")

if st.button("Buscar"):
    if busqueda:
        url = f"https://world.openfoodfacts.org/cgi/search.pl?search_terms={busqueda}&search_simple=1&action=process&json=1&page_size=5"
        response = requests.get(url)
        if response.status_code == 200:
            data = response.json()
            hits = data.get("products", [])
            for prod in hits:
                nombre = prod.get("product_name", "Desconocido")
                kcal = prod.get("nutriments", {}).get("energy-kcal_100g", 0)
                prote = prod.get("nutriments", {}).get("proteins_100g", 0)
                carbs = prod.get("nutriments", {}).get("carbohydrates_100g", 0)
                grasas = prod.get("nutriments", {}).get("fat_100g", 0)
                st.write(f"**{nombre}** — {kcal} kcal, {prote}g proteína, {carbs}g carbs, {grasas}g grasas (por 100g)")
        else:
            st.error("Error al buscar en Open Food Facts.")
    else:
        st.warning("Introduce un término para buscar.")

# ---------- SELECCIONAR COMIDA DEL CATÁLOGO ----------
if not df_catalogo.empty:
    df_catalogo['Etiqueta'] = df_catalogo['Comida'] + " (" + df_catalogo['Marca'] + ")"
    seleccion_catalogo = st.selectbox("Selecciona alimento del catálogo (opcional)", [""] + list(df_catalogo['Etiqueta']))
    if seleccion_catalogo and seleccion_catalogo != "":
        alimento_sel = df_catalogo[df_catalogo['Etiqueta'] == seleccion_catalogo].iloc[0]
        nombre_default = alimento_sel['Comida']
        marca_default = alimento_sel['Marca']
        kcal_100g_default = alimento_sel['Kcal_100g']
        prote_100g_default = alimento_sel['Proteínas_100g']
        carbs_100g_default = alimento_sel['Carbs_100g']
        grasas_100g_default = alimento_sel['Grasas_100g']
    else:
        nombre_default = ""
        marca_default = ""
        kcal_100g_default = 0
        prote_100g_default = 0
        carbs_100g_default = 0
        grasas_100g_default = 0
else:
    nombre_default = ""
    marca_default = ""
    kcal_100g_default = 0
    prote_100g_default = 0
    carbs_100g_default = 0
    grasas_100g_default = 0

# ---------- INPUTS ----------
nombre = st.text_input('Nombre de la comida', value=nombre_default)
marca = st.text_input('Marca', value=marca_default)
gramos = st.number_input('Gramos consumidos', min_value=1, max_value=5000, step=10)

kcal_100g = st.number_input('Kcal por 100g', min_value=0, max_value=900, step=1, value=int(kcal_100g_default))
prote_100g = st.number_input('Proteínas por 100g', min_value=0, max_value=100, step=1, value=int(prote_100g_default))
carbs_100g = st.number_input('Carbs por 100g', min_value=0, max_value=200, step=1, value=int(carbs_100g_default))
grasas_100g = st.number_input('Grasas por 100g', min_value=0, max_value=100, step=1, value=int(grasas_100g_default))

kcal_total = kcal_100g * gramos / 100
prote_total = prote_100g * gramos / 100
carbs_total = carbs_100g * gramos / 100
grasas_total = grasas_100g * gramos / 100

st.info(f"Totales calculados: {kcal_total:.0f} kcal, {prote_total:.0f} g proteína, {carbs_total:.0f} g carbs, {grasas_total:.0f} g grasas.")

guardar_catalogo = st.checkbox("Guardar en catálogo de favoritos")

if st.button('Añadir comida'):
    nueva = pd.DataFrame({
        'Fecha': [fecha],
        'Comida': [nombre],
        'Marca': [marca],
        'Gramos': [gramos],
        'Kcal': [kcal_total],
        'Proteínas': [prote_total],
        'Carbs': [carbs_total],
        'Grasas': [grasas_total]
    })
    df_comidas = pd.concat([df_comidas, nueva], ignore_index=True)
    df_comidas.to_csv(CSV_FILE, index=False)
    if guardar_catalogo and not df_catalogo[(df_catalogo['Comida'] == nombre) & (df_catalogo['Marca'] == marca)].any().any():
        nuevo_catalogo = pd.DataFrame({
            'Comida': [nombre],
            'Marca': [marca],
            'Kcal_100g': [kcal_100g],
            'Proteínas_100g': [prote_100g],
            'Carbs_100g': [carbs_100g],
            'Grasas_100g': [grasas_100g]
        })
        df_catalogo = pd.concat([df_catalogo, nuevo_catalogo], ignore_index=True)
        df_catalogo.to_csv(CATALOGO_FILE, index=False)
    st.success("¡Comida añadida!")

# ---------- EDITAR Y ELIMINAR COMIDAS DEL DÍA ----------
df_dia = df_comidas[df_comidas['Fecha'] == fecha]

st.subheader("Comidas del día")
if not df_dia.empty:
    seleccion_editar = st.selectbox("Selecciona comida para editar/eliminar", [""] + list(df_dia['Comida'] + " (" + df_dia['Marca'] + ")"))

    if seleccion_editar and seleccion_editar != "":
        idx = df_dia[df_dia['Comida'] + " (" + df_dia['Marca'] + ")" == seleccion_editar].index[0]
        st.write("Editar valores:")
        nuevo_nombre = st.text_input('Nuevo nombre', value=df_dia.loc[idx, 'Comida'], key='edit_nombre')
        nueva_marca = st.text_input('Nueva marca', value=df_dia.loc[idx, 'Marca'], key='edit_marca')
        nuevo_gramos = st.number_input('Nuevos gramos', min_value=1, max_value=5000, step=10, value=int(df_dia.loc[idx, 'Gramos']), key='edit_gramos')
        nueva_kcal = st.number_input('Nuevas kcal', min_value=0, max_value=5000, step=10, value=int(df_dia.loc[idx, 'Kcal']), key='edit_kcal')
        nueva_prote = st.number_input('Nuevas proteínas', min_value=0, max_value=300, step=1, value=int(df_dia.loc[idx, 'Proteínas']), key='edit_prote')
        nueva_carbs = st.number_input('Nuevos carbs', min_value=0, max_value=500, step=1, value=int(df_dia.loc[idx, 'Carbs']), key='edit_carbs')
        nueva_grasas = st.number_input('Nuevas grasas', min_value=0, max_value=200, step=1, value=int(df_dia.loc[idx, 'Grasas']), key='edit_grasas')

        if st.button("Guardar cambios"):
            df_comidas.loc[idx, ['Comida', 'Marca', 'Gramos', 'Kcal', 'Proteínas', 'Carbs', 'Grasas']] =                 [nuevo_nombre, nueva_marca, nuevo_gramos, nueva_kcal, nueva_prote, nueva_carbs, nueva_grasas]
            df_comidas.to_csv(CSV_FILE, index=False)
            st.success("¡Comida actualizada!")

        if st.button("Eliminar comida"):
            df_comidas = df_comidas.drop(idx)
            df_comidas.to_csv(CSV_FILE, index=False)
            st.success("¡Comida eliminada!")

    st.dataframe(df_dia[['Comida', 'Marca', 'Gramos', 'Kcal', 'Proteínas', 'Carbs', 'Grasas']], use_container_width=True)

    st.subheader("Totales del día")
    col1, col2, col3, col4 = st.columns(4)
    col1.metric("Kcal", f"{df_dia['Kcal'].sum():.0f}")
    col2.metric("Proteínas", f"{df_dia['Proteínas'].sum():.0f} g")
    col3.metric("Carbs", f"{df_dia['Carbs'].sum():.0f} g")
    col4.metric("Grasas", f"{df_dia['Grasas'].sum():.0f} g")
else:
    st.info("No hay comidas registradas para este día.")

# ---------- TOTALES SEMANALES ----------
st.subheader("Totales últimos 7 días")
ultima_fecha = fecha
semana_inicio = ultima_fecha - timedelta(days=6)
df_semana = df_comidas[(df_comidas['Fecha'] >= semana_inicio) & (df_comidas['Fecha'] <= ultima_fecha)]
if not df_semana.empty:
    st.write(f"Del {semana_inicio.strftime('%d-%m-%Y')} al {ultima_fecha.strftime('%d-%m-%Y')}")
    st.metric("Kcal promedio/día", f"{df_semana.groupby('Fecha')['Kcal'].sum().mean():.0f}")
    st.metric("Proteínas promedio/día", f"{df_semana.groupby('Fecha')['Proteínas'].sum().mean():.0f} g")
    st.metric("Carbs promedio/día", f"{df_semana.groupby('Fecha')['Carbs'].sum().mean():.0f} g")
    st.metric("Grasas promedio/día", f"{df_semana.groupby('Fecha')['Grasas'].sum().mean():.0f} g")
else:
    st.info("No hay datos suficientes para mostrar totales semanales.")
