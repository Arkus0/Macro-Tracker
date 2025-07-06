
import streamlit as st
import pandas as pd
from datetime import date

st.title("Pocket Diet - Food Log Avanzado 🍽️")
st.caption("by Jotacorp · Lightweight baby! 🏋️‍♂️🔥")
st.markdown("---")

CSV_FILE = 'comidas.csv'
CATALOGO_FILE = 'catalogo_comidas.csv'

# ---------- CARGAR COMIDAS EXISTENTES ----------
try:
    df_comidas = pd.read_csv(CSV_FILE)
    df_comidas['Fecha'] = pd.to_datetime(df_comidas['Fecha'], errors='coerce').dt.date
except FileNotFoundError:
    df_comidas = pd.DataFrame(columns=['Fecha', 'Comida', 'Marca', 'Kcal', 'Proteínas', 'Carbs', 'Grasas'])

# ---------- CARGAR CATÁLOGO ----------
try:
    df_catalogo = pd.read_csv(CATALOGO_FILE)
except FileNotFoundError:
    df_catalogo = pd.DataFrame(columns=['Comida', 'Marca', 'Kcal', 'Proteínas', 'Carbs', 'Grasas'])

# ---------- SELECCIONAR FECHA ----------
fecha = st.date_input('Fecha', value=date.today())

# ---------- SELECCIONAR COMIDA DEL CATÁLOGO ----------
if not df_catalogo.empty:
    seleccion_catalogo = st.selectbox("Selecciona alimento del catálogo (opcional)", [""] + df_catalogo['Comida'] + " (" + df_catalogo['Marca'] + ")")
    if seleccion_catalogo and seleccion_catalogo != "":
        idx = df_catalogo[df_catalogo['Comida'] + " (" + df_catalogo['Marca'] + ")" == seleccion_catalogo].index[0]
        alimento_seleccionado = df_catalogo.loc[idx]
        nombre_default = alimento_seleccionado['Comida']
        marca_default = alimento_seleccionado['Marca']
        kcal_default = alimento_seleccionado['Kcal']
        prote_default = alimento_seleccionado['Proteínas']
        carbs_default = alimento_seleccionado['Carbs']
        grasas_default = alimento_seleccionado['Grasas']
    else:
        nombre_default = ""
        marca_default = ""
        kcal_default = 0
        prote_default = 0
        carbs_default = 0
        grasas_default = 0
else:
    nombre_default = ""
    marca_default = ""
    kcal_default = 0
    prote_default = 0
    carbs_default = 0
    grasas_default = 0

# ---------- INPUTS ----------
nombre = st.text_input('Nombre de la comida', value=nombre_default)
marca = st.text_input('Marca', value=marca_default)
kcal = st.number_input('Kcal', min_value=0, max_value=5000, step=10, value=int(kcal_default))
prote = st.number_input('Proteínas (g)', min_value=0, max_value=300, step=1, value=int(prote_default))
carbs = st.number_input('Carbs (g)', min_value=0, max_value=500, step=1, value=int(carbs_default))
grasas = st.number_input('Grasas (g)', min_value=0, max_value=200, step=1, value=int(grasas_default))

guardar_catalogo = st.checkbox("Guardar en catálogo de favoritos")

if st.button('Añadir comida'):
    nueva = pd.DataFrame({
        'Fecha': [fecha],
        'Comida': [nombre],
        'Marca': [marca],
        'Kcal': [kcal],
        'Proteínas': [prote],
        'Carbs': [carbs],
        'Grasas': [grasas]
    })
    df_comidas = pd.concat([df_comidas, nueva], ignore_index=True)
    df_comidas.to_csv(CSV_FILE, index=False)
    if guardar_catalogo and not df_catalogo[(df_catalogo['Comida'] == nombre) & (df_catalogo['Marca'] == marca)].any().any():
        df_catalogo = pd.concat([df_catalogo, nueva.drop(columns=['Fecha'])], ignore_index=True)
        df_catalogo.to_csv(CATALOGO_FILE, index=False)
    st.success("¡Comida añadida!")

# ---------- FILTRAR COMIDAS DEL DÍA ----------
df_dia = df_comidas[df_comidas['Fecha'] == fecha]

st.subheader("Comidas del día")
if not df_dia.empty:
    seleccion_editar = st.selectbox("Selecciona comida para editar/eliminar", [""] + list(df_dia['Comida'] + " (" + df_dia['Marca'] + ")"))

    if seleccion_editar and seleccion_editar != "":
        idx = df_dia[df_dia['Comida'] + " (" + df_dia['Marca'] + ")" == seleccion_editar].index[0]
        st.write("Editar valores:")

        nuevo_nombre = st.text_input('Nuevo nombre', value=df_dia.loc[idx, 'Comida'], key='edit_nombre')
        nueva_marca = st.text_input('Nueva marca', value=df_dia.loc[idx, 'Marca'], key='edit_marca')
        nueva_kcal = st.number_input('Nuevas kcal', min_value=0, max_value=5000, step=10, value=int(df_dia.loc[idx, 'Kcal']), key='edit_kcal')
        nueva_prote = st.number_input('Nuevas proteínas', min_value=0, max_value=300, step=1, value=int(df_dia.loc[idx, 'Proteínas']), key='edit_prote')
        nueva_carbs = st.number_input('Nuevos carbs', min_value=0, max_value=500, step=1, value=int(df_dia.loc[idx, 'Carbs']), key='edit_carbs')
        nueva_grasas = st.number_input('Nuevas grasas', min_value=0, max_value=200, step=1, value=int(df_dia.loc[idx, 'Grasas']), key='edit_grasas')

        if st.button("Guardar cambios"):
            df_comidas.loc[idx, 'Comida'] = nuevo_nombre
            df_comidas.loc[idx, 'Marca'] = nueva_marca
            df_comidas.loc[idx, 'Kcal'] = nueva_kcal
            df_comidas.loc[idx, 'Proteínas'] = nueva_prote
            df_comidas.loc[idx, 'Carbs'] = nueva_carbs
            df_comidas.loc[idx, 'Grasas'] = nueva_grasas
            df_comidas.to_csv(CSV_FILE, index=False)
            st.success("¡Comida actualizada!")

        if st.button("Eliminar comida"):
            df_comidas = df_comidas.drop(idx)
            df_comidas.to_csv(CSV_FILE, index=False)
            st.success("¡Comida eliminada!")

    st.dataframe(df_dia[['Comida', 'Marca', 'Kcal', 'Proteínas', 'Carbs', 'Grasas']], use_container_width=True)

    st.subheader("Totales del día")
    col1, col2, col3, col4 = st.columns(4)
    col1.metric("Kcal", f"{df_dia['Kcal'].sum():.0f}")
    col2.metric("Proteínas", f"{df_dia['Proteínas'].sum():.0f} g")
    col3.metric("Carbs", f"{df_dia['Carbs'].sum():.0f} g")
    col4.metric("Grasas", f"{df_dia['Grasas'].sum():.0f} g")
else:
    st.info("No hay comidas registradas para este día.")
