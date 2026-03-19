import streamlit as st
import pandas as pd
import requests
from datetime import date, timedelta
from auth import require_auth
import db

user_id = require_auth()

st.title("Food Log")

# ---------- FECHA Y ACCIONES RAPIDAS ----------
col_f, col_copy = st.columns([2, 1])
with col_f:
    fecha = st.date_input("Fecha", value=date.today())
with col_copy:
    st.write("")
    st.write("")
    if st.button("Copiar dia anterior"):
        dia_anterior = fecha - timedelta(days=1)
        entries_ayer = db.get_food_entries(user_id, dia_anterior)
        if entries_ayer:
            db.copy_food_entries(user_id, dia_anterior, fecha)
            st.success("Comidas copiadas del dia anterior.")
            st.rerun()
        else:
            st.info("No hay comidas en el dia anterior.")

# ---------- TOTALES DEL DIA ----------
entries_dia = db.get_food_entries(user_id, fecha)
st.subheader("Totales del dia")
total_kcal = sum(e.get("kcal", 0) or 0 for e in entries_dia)
total_prot = sum(e.get("proteinas", 0) or 0 for e in entries_dia)
total_carbs = sum(e.get("carbs", 0) or 0 for e in entries_dia)
total_grasas = sum(e.get("grasas", 0) or 0 for e in entries_dia)

# Show targets if available
targets = db.get_active_targets(user_id, fecha)

col1, col2, col3, col4 = st.columns(4)
kcal_label = f"{total_kcal:.0f}"
if targets:
    kcal_label += f" / {targets['kcal_target']}"
col1.metric("Kcal", kcal_label)

prot_label = f"{total_prot:.0f} g"
if targets and targets.get("protein_target"):
    prot_label += f" / {targets['protein_target']:.0f}"
col2.metric("Proteinas", prot_label)

carbs_label = f"{total_carbs:.0f} g"
if targets and targets.get("carbs_target"):
    carbs_label += f" / {targets['carbs_target']:.0f}"
col3.metric("Carbs", carbs_label)

grasas_label = f"{total_grasas:.0f} g"
if targets and targets.get("fat_target"):
    grasas_label += f" / {targets['fat_target']:.0f}"
col4.metric("Grasas", grasas_label)

# Target progress bars
if targets:
    if targets["kcal_target"] > 0:
        pct = min(1.0, total_kcal / targets["kcal_target"])
        st.progress(pct, text=f"Kcal: {pct*100:.0f}%")

# ---------- COMIDAS POR TIPO ----------
if entries_dia:
    for t in ["Desayuno", "Comida", "Cena", "Snack"]:
        entries_tipo = [e for e in entries_dia if e.get("tipo") == t]
        if entries_tipo:
            st.markdown(f"**{t}**")
            df_tipo = pd.DataFrame(entries_tipo)[["comida", "marca", "gramos", "kcal", "proteinas", "carbs", "grasas"]]
            df_tipo.columns = ["Comida", "Marca", "Gramos", "Kcal", "Proteinas", "Carbs", "Grasas"]
            st.dataframe(df_tipo, use_container_width=True, hide_index=True)

st.markdown("---")

# ---------- ANADIR ALIMENTO ----------
st.subheader("Anadir alimento")
tipo_comida = st.selectbox("Tipo de comida", ["Desayuno", "Comida", "Cena", "Snack"])

tab_off, tab_freq, tab_catalog, tab_template, tab_manual = st.tabs([
    "Open Food Facts", "Frecuentes", "Catalogo", "Templates", "Manual"
])

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

with tab_freq:
    frequent = db.get_frequent_foods(user_id)
    if frequent:
        for f in frequent:
            label = f"{f['comida']} ({f['marca'] or ''}) — {f['freq']}x"
            if st.button(label, key=f"freq_{f['comida']}_{f['marca']}"):
                st.session_state["nombre_sel"] = f["comida"]
                st.session_state["marca_sel"] = f["marca"] or ""
                st.session_state["kcal_sel"] = int(f["kcal_100g"] or 0)
                st.session_state["prote_sel"] = int(f["proteinas_100g"] or 0)
                st.session_state["carbs_sel"] = int(f["carbs_100g"] or 0)
                st.session_state["grasas_sel"] = int(f["grasas_100g"] or 0)
                st.rerun()
    else:
        st.info("Aun no tienes alimentos frecuentes.")

with tab_catalog:
    catalog = db.get_catalog(user_id)
    if catalog:
        filtro = st.text_input("Filtrar catalogo", "")
        filtered = catalog
        if filtro:
            filtered = [c for c in catalog if filtro.lower() in c["comida"].lower()]
        if filtered:
            options = [""] + [f"{c['comida']} ({c['marca'] or ''})" for c in filtered]
            seleccion = st.selectbox("Selecciona del catalogo", options)
            if seleccion:
                idx = options.index(seleccion) - 1
                al = filtered[idx]
                st.session_state["nombre_sel"] = al["comida"]
                st.session_state["marca_sel"] = al["marca"] or ""
                st.session_state["kcal_sel"] = int(al["kcal_100g"] or 0)
                st.session_state["prote_sel"] = int(al["proteinas_100g"] or 0)
                st.session_state["carbs_sel"] = int(al["carbs_100g"] or 0)
                st.session_state["grasas_sel"] = int(al["grasas_100g"] or 0)
    else:
        st.info("Tu catalogo esta vacio. Anade comidas y marcalas como favoritas.")

with tab_template:
    templates = db.get_meal_templates(user_id)
    if templates:
        for tmpl in templates:
            items = db.get_template_items(tmpl["id"])
            total = sum(i.get("kcal", 0) or 0 for i in items)
            label = f"{tmpl['name']} ({len(items)} items, {total:.0f} kcal) — usado {tmpl['use_count']}x"
            col_t, col_del = st.columns([4, 1])
            with col_t:
                if st.button(f"Aplicar: {label}", key=f"tmpl_{tmpl['id']}"):
                    db.use_meal_template(user_id, tmpl["id"], fecha, tipo_comida)
                    st.success(f"Template '{tmpl['name']}' aplicado.")
                    st.rerun()
            with col_del:
                if st.button("Eliminar", key=f"del_tmpl_{tmpl['id']}"):
                    db.delete_meal_template(tmpl["id"])
                    st.rerun()
    else:
        st.info("No tienes templates. Guarda comidas del dia como template abajo.")

    # Save current meals as template
    if entries_dia:
        st.markdown("---")
        tmpl_name = st.text_input("Nombre del template")
        if st.button("Guardar comidas del dia como template"):
            if tmpl_name:
                items = [
                    {"comida": e["comida"], "marca": e.get("marca", ""),
                     "gramos": e.get("gramos", 0), "kcal": e.get("kcal", 0),
                     "proteinas": e.get("proteinas", 0), "carbs": e.get("carbs", 0),
                     "grasas": e.get("grasas", 0)}
                    for e in entries_dia
                ]
                db.save_meal_template(user_id, tmpl_name, items)
                st.success(f"Template '{tmpl_name}' guardado.")
                st.rerun()
            else:
                st.error("Introduce un nombre para el template.")

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
        db.add_food_entry(
            user_id, fecha, tipo_comida, nombre, marca,
            gramos, kcal_total, prote_total, carbs_total, grasas_total,
        )
        if guardar_catalogo:
            db.add_catalog_entry(user_id, nombre, marca, kcal_100g, prote_100g, carbs_100g, grasas_100g)
        st.success("Comida anadida.")
        for key in ["nombre_sel", "marca_sel", "kcal_sel", "prote_sel", "carbs_sel", "grasas_sel"]:
            st.session_state[key] = "" if "nombre" in key or "marca" in key else 0
        st.rerun()

# ---------- EDITAR / ELIMINAR ----------
if entries_dia:
    st.markdown("---")
    st.subheader("Editar / Eliminar")
    opciones = {
        f"{e['comida']} ({e.get('marca', '')}) - {e.get('kcal', 0):.0f} kcal": e["id"]
        for e in entries_dia
    }
    seleccion_editar = st.selectbox("Selecciona comida", [""] + list(opciones.keys()))
    if seleccion_editar:
        if st.button("Eliminar esta comida"):
            db.delete_food_entry(opciones[seleccion_editar])
            st.success("Comida eliminada.")
            st.rerun()

# ---------- PROMEDIOS SEMANALES ----------
st.markdown("---")
st.subheader("Promedios ultimos 7 dias")
semana_inicio = fecha - timedelta(days=6)
daily_totals = db.get_food_daily_totals(user_id, semana_inicio, fecha)
if daily_totals:
    avg_kcal = sum(d["kcal"] or 0 for d in daily_totals) / len(daily_totals)
    avg_prot = sum(d["proteinas"] or 0 for d in daily_totals) / len(daily_totals)
    avg_carbs = sum(d["carbs"] or 0 for d in daily_totals) / len(daily_totals)
    avg_grasas = sum(d["grasas"] or 0 for d in daily_totals) / len(daily_totals)
    c1, c2, c3, c4 = st.columns(4)
    c1.metric("Kcal/dia", f"{avg_kcal:.0f}")
    c2.metric("Prot/dia", f"{avg_prot:.0f} g")
    c3.metric("Carbs/dia", f"{avg_carbs:.0f} g")
    c4.metric("Grasas/dia", f"{avg_grasas:.0f} g")
else:
    st.info("No hay datos de la ultima semana.")
