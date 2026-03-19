import streamlit as st
import pandas as pd
import requests
from datetime import date, timedelta

st.title("Food Log")

COMIDAS_FILE = "comidas.csv"
CATALOGO_FILE = "catalogo_comidas.csv"

# ---------- CARGAR DATOS ----------
try:
    df_comidas = pd.read_csv(COMIDAS_FILE)
    df_comidas["Fecha"] = pd.to_datetime(df_comidas["Fecha"], errors="coerce").dt.date
    if "Tipo" not in df_comidas.columns:
        df_comidas["Tipo"] = ""
except FileNotFoundError:
    df_comidas = pd.DataFrame(
        columns=["Fecha", "Tipo", "Comida", "Marca", "Gramos", "Kcal", "Proteinas", "Carbs", "Grasas"]
    )

try:
    df_catalogo = pd.read_csv(CATALOGO_FILE)
except FileNotFoundError:
    df_catalogo = pd.DataFrame(
        columns=["Comida", "Marca", "Kcal_100g", "Proteinas_100g", "Carbs_100g", "Grasas_100g"]
    )

# ---------- FECHA Y ACCIONES RAPIDAS ----------
col_f, col_copy = st.columns([2, 1])
with col_f:
    fecha = st.date_input("Fecha", value=date.today())
with col_copy:
    st.write("")
    st.write("")
    if st.button("Copiar dia anterior"):
        dia_anterior = fecha - timedelta(days=1)
        df_ayer = df_comidas[df_comidas["Fecha"] == dia_anterior]
        if not df_ayer.empty:
            copia = df_ayer.copy()
            copia["Fecha"] = fecha
            df_comidas = pd.concat([df_comidas, copia], ignore_index=True)
            df_comidas.to_csv(COMIDAS_FILE, index=False)
            st.success("Comidas copiadas del dia anterior.")
            st.rerun()
        else:
            st.info("No hay comidas en el dia anterior.")

# ---------- TOTALES DEL DIA ----------
df_dia = df_comidas[df_comidas["Fecha"] == fecha]
st.subheader("Totales del dia")
col1, col2, col3, col4 = st.columns(4)
col1.metric("Kcal", f"{df_dia['Kcal'].sum():.0f}")
col2.metric("Proteinas", f"{df_dia['Proteinas'].sum():.0f} g")
col3.metric("Carbs", f"{df_dia['Carbs'].sum():.0f} g")
col4.metric("Grasas", f"{df_dia['Grasas'].sum():.0f} g")

# ---------- COMIDAS POR TIPO ----------
if not df_dia.empty:
    for t in ["Desayuno", "Comida", "Cena", "Snack"]:
        df_tipo = df_dia[df_dia["Tipo"] == t]
        if not df_tipo.empty:
            st.markdown(f"**{t}**")
            st.dataframe(
                df_tipo[["Comida", "Marca", "Gramos", "Kcal", "Proteinas", "Carbs", "Grasas"]],
                use_container_width=True, hide_index=True,
            )

st.markdown("---")

# ---------- ANADIR ALIMENTO ----------
st.subheader("Anadir alimento")
tipo_comida = st.selectbox("Tipo de comida", ["Desayuno", "Comida", "Cena", "Snack"])

tab_off, tab_catalog, tab_manual = st.tabs(["Buscar en Open Food Facts", "Catalogo personal", "Entrada manual"])

# Session state defaults
for key in ["nombre_sel", "marca_sel", "kcal_sel", "prote_sel", "carbs_sel", "grasas_sel"]:
    if key not in st.session_state:
        st.session_state[key] = "" if "nombre" in key or "marca" in key else 0

with tab_off:
    busqueda = st.text_input("Buscar alimento")
    if busqueda:
        try:
            url = f"https://world.openfoodfacts.org/cgi/search.pl?search_terms={busqueda}&search_simple=1&action=process&json=1&page_size=5"
            response = requests.get(url, timeout=5)
            if response.status_code == 200:
                productos = response.json().get("products", [])
                for prod in productos:
                    nombre = prod.get("product_name", "Desconocido")
                    nutriments = prod.get("nutriments", {})
                    kcal = nutriments.get("energy-kcal_100g", 0)
                    prote = nutriments.get("proteins_100g", 0)
                    carbs = nutriments.get("carbohydrates_100g", 0)
                    grasas = nutriments.get("fat_100g", 0)
                    marca = prod.get("brands", "")
                    if st.button(f"{nombre} — {kcal} kcal/100g", key=f"off_{nombre}_{kcal}"):
                        st.session_state["nombre_sel"] = nombre
                        st.session_state["marca_sel"] = marca
                        st.session_state["kcal_sel"] = int(kcal or 0)
                        st.session_state["prote_sel"] = int(prote or 0)
                        st.session_state["carbs_sel"] = int(carbs or 0)
                        st.session_state["grasas_sel"] = int(grasas or 0)
                        st.rerun()
        except requests.RequestException:
            st.error("Error al conectar con Open Food Facts.")

with tab_catalog:
    if not df_catalogo.empty:
        filtro = st.text_input("Filtrar catalogo", "")
        df_filtrado = df_catalogo
        if filtro:
            df_filtrado = df_catalogo[df_catalogo["Comida"].str.contains(filtro, case=False, na=False)]
        if not df_filtrado.empty:
            df_filtrado = df_filtrado.copy()
            df_filtrado["Etiqueta"] = df_filtrado["Comida"] + " (" + df_filtrado["Marca"].fillna("") + ")"
            seleccion = st.selectbox("Selecciona del catalogo", [""] + list(df_filtrado["Etiqueta"]))
            if seleccion:
                al = df_filtrado[df_filtrado["Etiqueta"] == seleccion].iloc[0]
                st.session_state["nombre_sel"] = al["Comida"]
                st.session_state["marca_sel"] = al["Marca"] if pd.notna(al["Marca"]) else ""
                st.session_state["kcal_sel"] = int(al["Kcal_100g"])
                st.session_state["prote_sel"] = int(al["Proteinas_100g"])
                st.session_state["carbs_sel"] = int(al["Carbs_100g"])
                st.session_state["grasas_sel"] = int(al["Grasas_100g"])
    else:
        st.info("Tu catalogo esta vacio. Anade comidas y marcalas como favoritas.")

with tab_manual:
    st.info("Introduce los valores manualmente abajo.")

# ---------- FORMULARIO FINAL ----------
nombre = st.text_input("Nombre", value=st.session_state.get("nombre_sel", ""))
marca = st.text_input("Marca", value=st.session_state.get("marca_sel", ""))
gramos = st.number_input("Gramos consumidos", min_value=1, max_value=5000, step=10, value=100)
kcal_100g = st.number_input("Kcal/100g", min_value=0, max_value=900, step=1, value=st.session_state.get("kcal_sel", 0))
prote_100g = st.number_input("Proteinas/100g", min_value=0, max_value=100, step=1, value=st.session_state.get("prote_sel", 0))
carbs_100g = st.number_input("Carbs/100g", min_value=0, max_value=200, step=1, value=st.session_state.get("carbs_sel", 0))
grasas_100g = st.number_input("Grasas/100g", min_value=0, max_value=100, step=1, value=st.session_state.get("grasas_sel", 0))

kcal_total = kcal_100g * gramos / 100
prote_total = prote_100g * gramos / 100
carbs_total = carbs_100g * gramos / 100
grasas_total = grasas_100g * gramos / 100

st.info(f"Totales: {kcal_total:.0f} kcal | {prote_total:.0f}g prot | {carbs_total:.0f}g carbs | {grasas_total:.0f}g grasas")

guardar_catalogo = st.checkbox("Guardar en catalogo de favoritos")

if st.button("Anadir comida", type="primary"):
    if not nombre:
        st.error("Introduce un nombre para la comida.")
    else:
        nueva = pd.DataFrame(
            {
                "Fecha": [fecha],
                "Tipo": [tipo_comida],
                "Comida": [nombre],
                "Marca": [marca],
                "Gramos": [gramos],
                "Kcal": [kcal_total],
                "Proteinas": [prote_total],
                "Carbs": [carbs_total],
                "Grasas": [grasas_total],
            }
        )
        df_comidas = pd.concat([df_comidas, nueva], ignore_index=True)
        df_comidas.to_csv(COMIDAS_FILE, index=False)
        if guardar_catalogo:
            existe = df_catalogo[
                (df_catalogo["Comida"] == nombre) & (df_catalogo["Marca"] == marca)
            ]
            if existe.empty:
                nuevo_cat = pd.DataFrame(
                    {
                        "Comida": [nombre],
                        "Marca": [marca],
                        "Kcal_100g": [kcal_100g],
                        "Proteinas_100g": [prote_100g],
                        "Carbs_100g": [carbs_100g],
                        "Grasas_100g": [grasas_100g],
                    }
                )
                df_catalogo = pd.concat([df_catalogo, nuevo_cat], ignore_index=True)
                df_catalogo.to_csv(CATALOGO_FILE, index=False)
        st.success("Comida anadida.")
        # Clear selection
        for key in ["nombre_sel", "marca_sel", "kcal_sel", "prote_sel", "carbs_sel", "grasas_sel"]:
            st.session_state[key] = "" if "nombre" in key or "marca" in key else 0
        st.rerun()

# ---------- EDITAR / ELIMINAR ----------
if not df_dia.empty:
    st.markdown("---")
    st.subheader("Editar / Eliminar")
    opciones = df_dia.apply(lambda r: f"{r['Comida']} ({r['Marca']}) - {r['Kcal']:.0f} kcal", axis=1)
    seleccion_editar = st.selectbox("Selecciona comida", [""] + list(opciones))
    if seleccion_editar:
        idx = opciones[opciones == seleccion_editar].index[0]
        if st.button("Eliminar esta comida"):
            df_comidas = df_comidas.drop(idx)
            df_comidas.to_csv(COMIDAS_FILE, index=False)
            st.success("Comida eliminada.")
            st.rerun()

# ---------- PROMEDIOS SEMANALES ----------
st.markdown("---")
st.subheader("Promedios ultimos 7 dias")
semana_inicio = fecha - timedelta(days=6)
df_semana = df_comidas[(df_comidas["Fecha"] >= semana_inicio) & (df_comidas["Fecha"] <= fecha)]
if not df_semana.empty:
    diario = df_semana.groupby("Fecha").agg({"Kcal": "sum", "Proteinas": "sum", "Carbs": "sum", "Grasas": "sum"})
    c1, c2, c3, c4 = st.columns(4)
    c1.metric("Kcal/dia", f"{diario['Kcal'].mean():.0f}")
    c2.metric("Prot/dia", f"{diario['Proteinas'].mean():.0f} g")
    c3.metric("Carbs/dia", f"{diario['Carbs'].mean():.0f} g")
    c4.metric("Grasas/dia", f"{diario['Grasas'].mean():.0f} g")
else:
    st.info("No hay datos de la ultima semana.")
