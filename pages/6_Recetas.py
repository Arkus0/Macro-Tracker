import streamlit as st
import pandas as pd
import requests
from datetime import date
from auth import require_auth
import db

user_id = require_auth()

st.title("Recetas")

# ============================================================================
# LISTA DE RECETAS
# ============================================================================
recipes = db.get_recipes(user_id)

if recipes:
    st.subheader("Mis recetas")
    for recipe in recipes:
        servings = recipe.get("servings", 1) or 1
        kcal_per = round(recipe["total_kcal"] / servings) if recipe.get("total_kcal") else 0
        prot_per = round((recipe.get("total_protein") or 0) / servings)
        carbs_per = round((recipe.get("total_carbs") or 0) / servings)
        fat_per = round((recipe.get("total_fat") or 0) / servings)

        with st.expander(f"{recipe['name']} — {kcal_per} kcal/porcion ({servings} porciones)"):
            if recipe.get("description"):
                st.caption(recipe["description"])

            # Macro summary
            col1, col2, col3, col4 = st.columns(4)
            col1.metric("Kcal/porcion", kcal_per)
            col2.metric("Prot", f"{prot_per} g")
            col3.metric("Carbs", f"{carbs_per} g")
            col4.metric("Grasas", f"{fat_per} g")

            # Items
            items = db.get_recipe_items(recipe["id"])
            if items:
                df_items = pd.DataFrame(items)[["comida", "gramos", "kcal", "proteinas", "carbs", "grasas"]]
                df_items.columns = ["Ingrediente", "Gramos", "Kcal", "Prot", "Carbs", "Grasas"]
                st.dataframe(df_items, use_container_width=True, hide_index=True)

            # Actions
            col_log, col_del = st.columns(2)
            with col_log:
                porciones = st.number_input("Porciones", min_value=0.5, max_value=10.0, step=0.5,
                                            value=1.0, key=f"porc_{recipe['id']}")
                fecha_log = st.date_input("Fecha", value=date.today(), key=f"fecha_{recipe['id']}")
                tipo = st.selectbox("Tipo", ["Desayuno", "Comida", "Cena", "Snack"], key=f"tipo_{recipe['id']}")
                if st.button("Registrar en diario", key=f"log_{recipe['id']}"):
                    factor = porciones / servings
                    db.add_food_entry(
                        user_id, fecha_log, tipo,
                        f"{recipe['name']} ({porciones} porc.)",
                        "", round((recipe.get("total_grams") or 0) * factor),
                        round((recipe.get("total_kcal") or 0) * factor),
                        round((recipe.get("total_protein") or 0) * factor, 1),
                        round((recipe.get("total_carbs") or 0) * factor, 1),
                        round((recipe.get("total_fat") or 0) * factor, 1),
                    )
                    st.success(f"Registrado: {recipe['name']} x{porciones}")
                    st.rerun()
            with col_del:
                st.write("")
                if st.button("Eliminar receta", key=f"del_{recipe['id']}"):
                    db.delete_recipe(recipe["id"])
                    st.success("Receta eliminada.")
                    st.rerun()

# ============================================================================
# CREAR RECETA
# ============================================================================
st.markdown("---")
st.subheader("Crear nueva receta")

# Initialize recipe builder in session state
if "recipe_items" not in st.session_state:
    st.session_state["recipe_items"] = []

with st.form("recipe_info"):
    col1, col2 = st.columns(2)
    with col1:
        recipe_name = st.text_input("Nombre de la receta")
        recipe_desc = st.text_input("Descripcion (opcional)")
    with col2:
        recipe_servings = st.number_input("Porciones", min_value=1, max_value=50, value=1)
        recipe_serving_name = st.text_input("Nombre de porcion (ej: plato, taza)", value="porcion")
    st.form_submit_button("Actualizar info", disabled=True)

# Add ingredients
st.markdown("**Agregar ingrediente:**")
tab_search, tab_catalog, tab_manual = st.tabs(["Buscar OFF", "Catalogo", "Manual"])

with tab_search:
    busq = st.text_input("Buscar en Open Food Facts", key="recipe_search")
    if busq:
        try:
            url = f"https://world.openfoodfacts.org/cgi/search.pl?search_terms={busq}&search_simple=1&action=process&json=1&page_size=5"
            resp = requests.get(url, timeout=5)
            if resp.status_code == 200:
                for prod in resp.json().get("products", []):
                    nombre = prod.get("product_name", "Desconocido")
                    nut = prod.get("nutriments", {})
                    if st.button(f"{nombre} — {nut.get('energy-kcal_100g', 0)} kcal/100g", key=f"radd_{nombre}"):
                        st.session_state["ri_nombre"] = nombre
                        st.session_state["ri_marca"] = prod.get("brands", "")
                        st.session_state["ri_kcal"] = int(nut.get("energy-kcal_100g", 0) or 0)
                        st.session_state["ri_prot"] = int(nut.get("proteins_100g", 0) or 0)
                        st.session_state["ri_carbs"] = int(nut.get("carbohydrates_100g", 0) or 0)
                        st.session_state["ri_grasas"] = int(nut.get("fat_100g", 0) or 0)
                        st.rerun()
        except requests.RequestException:
            st.error("Error de conexion.")

with tab_catalog:
    catalog = db.get_catalog(user_id)
    if catalog:
        options = [""] + [f"{c['comida']} ({c['marca'] or ''})" for c in catalog]
        sel = st.selectbox("Del catalogo", options, key="recipe_cat_sel")
        if sel:
            idx = options.index(sel) - 1
            c = catalog[idx]
            st.session_state["ri_nombre"] = c["comida"]
            st.session_state["ri_marca"] = c["marca"] or ""
            st.session_state["ri_kcal"] = int(c["kcal_100g"] or 0)
            st.session_state["ri_prot"] = int(c["proteinas_100g"] or 0)
            st.session_state["ri_carbs"] = int(c["carbs_100g"] or 0)
            st.session_state["ri_grasas"] = int(c["grasas_100g"] or 0)

with tab_manual:
    st.info("Introduce los datos manualmente.")

# Ingredient form
col1, col2 = st.columns(2)
with col1:
    ing_nombre = st.text_input("Ingrediente", value=st.session_state.get("ri_nombre", ""))
    ing_gramos = st.number_input("Gramos", min_value=1, max_value=5000, step=10, value=100, key="ing_g")
with col2:
    ing_kcal = st.number_input("Kcal/100g", min_value=0, max_value=900, step=1, value=st.session_state.get("ri_kcal", 0))
    ing_prot = st.number_input("Prot/100g", min_value=0, max_value=100, step=1, value=st.session_state.get("ri_prot", 0))
    ing_carbs = st.number_input("Carbs/100g", min_value=0, max_value=200, step=1, value=st.session_state.get("ri_carbs", 0))
    ing_grasas = st.number_input("Grasas/100g", min_value=0, max_value=100, step=1, value=st.session_state.get("ri_grasas", 0))

if st.button("Agregar ingrediente"):
    if ing_nombre:
        item = {
            "comida": ing_nombre,
            "marca": st.session_state.get("ri_marca", ""),
            "gramos": ing_gramos,
            "kcal": round(ing_kcal * ing_gramos / 100, 1),
            "proteinas": round(ing_prot * ing_gramos / 100, 1),
            "carbs": round(ing_carbs * ing_gramos / 100, 1),
            "grasas": round(ing_grasas * ing_gramos / 100, 1),
        }
        st.session_state["recipe_items"].append(item)
        for k in ["ri_nombre", "ri_marca", "ri_kcal", "ri_prot", "ri_carbs", "ri_grasas"]:
            if k in st.session_state:
                del st.session_state[k]
        st.rerun()

# Show current items
if st.session_state["recipe_items"]:
    st.markdown("**Ingredientes actuales:**")
    df_items = pd.DataFrame(st.session_state["recipe_items"])
    st.dataframe(df_items, use_container_width=True, hide_index=True)

    total_kcal = sum(i["kcal"] for i in st.session_state["recipe_items"])
    total_prot = sum(i["proteinas"] for i in st.session_state["recipe_items"])
    total_carbs = sum(i["carbs"] for i in st.session_state["recipe_items"])
    total_grasas = sum(i["grasas"] for i in st.session_state["recipe_items"])

    svgs = recipe_servings or 1
    st.info(f"**Total:** {total_kcal:.0f} kcal | {total_prot:.0f}g prot | {total_carbs:.0f}g carbs | {total_grasas:.0f}g grasas\n\n"
            f"**Por porcion ({svgs}):** {total_kcal/svgs:.0f} kcal | {total_prot/svgs:.0f}g prot | "
            f"{total_carbs/svgs:.0f}g carbs | {total_grasas/svgs:.0f}g grasas")

    col_save, col_clear = st.columns(2)
    with col_save:
        if st.button("Guardar receta", type="primary"):
            if recipe_name:
                db.save_recipe(
                    user_id, recipe_name, recipe_desc,
                    st.session_state["recipe_items"],
                    servings=recipe_servings,
                    serving_name=recipe_serving_name,
                )
                st.session_state["recipe_items"] = []
                st.success(f"Receta '{recipe_name}' guardada.")
                st.rerun()
            else:
                st.error("Introduce un nombre para la receta.")
    with col_clear:
        if st.button("Limpiar ingredientes"):
            st.session_state["recipe_items"] = []
            st.rerun()
