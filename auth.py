"""
Authentication module for Pocket Diet.
Provides login/register UI and session management.
"""

import streamlit as st
import db


def require_auth():
    """
    Call at the top of every page. Returns user_id if authenticated.
    Shows login/register form and stops execution if not authenticated.
    """
    db.init_db()

    if "user_id" in st.session_state and st.session_state["user_id"]:
        return st.session_state["user_id"]

    _show_auth_form()
    st.stop()


def get_username():
    """Get current logged-in username."""
    return st.session_state.get("username", "")


def logout():
    """Log out current user."""
    for key in ["user_id", "username"]:
        if key in st.session_state:
            del st.session_state[key]


def _show_auth_form():
    """Display login/register form."""
    st.markdown("## Pocket Diet")
    st.caption("Inicia sesion o crea una cuenta para continuar")

    tab_login, tab_register = st.tabs(["Iniciar sesion", "Crear cuenta"])

    with tab_login:
        with st.form("login_form"):
            username = st.text_input("Usuario", key="login_user")
            password = st.text_input("Contrasena", type="password", key="login_pass")
            submitted = st.form_submit_button("Entrar", type="primary")
            if submitted:
                if not username or not password:
                    st.error("Completa todos los campos.")
                else:
                    user_id = db.authenticate(username, password)
                    if user_id:
                        st.session_state["user_id"] = user_id
                        st.session_state["username"] = username
                        st.rerun()
                    else:
                        st.error("Usuario o contrasena incorrectos.")

    with tab_register:
        with st.form("register_form"):
            new_user = st.text_input("Usuario", key="reg_user")
            new_pass = st.text_input("Contrasena", type="password", key="reg_pass")
            new_pass2 = st.text_input("Confirmar contrasena", type="password", key="reg_pass2")
            import_csv = st.checkbox("Importar datos existentes (CSV)", value=False)
            submitted = st.form_submit_button("Crear cuenta", type="primary")
            if submitted:
                if not new_user or not new_pass:
                    st.error("Completa todos los campos.")
                elif len(new_pass) < 4:
                    st.error("La contrasena debe tener al menos 4 caracteres.")
                elif new_pass != new_pass2:
                    st.error("Las contrasenas no coinciden.")
                else:
                    user_id = db.create_user(new_user, new_pass)
                    if user_id:
                        st.session_state["user_id"] = user_id
                        st.session_state["username"] = new_user
                        if import_csv:
                            result = db.migrate_csv_to_db(user_id)
                            total = sum(result.values())
                            if total > 0:
                                st.success(
                                    f"Cuenta creada. Importados: {result['peso']} registros de peso, "
                                    f"{result['comidas']} comidas, {result['catalogo']} del catalogo."
                                )
                            else:
                                st.success("Cuenta creada. No se encontraron CSVs para importar.")
                        else:
                            st.success("Cuenta creada correctamente.")
                        st.rerun()
                    else:
                        st.error("Ese nombre de usuario ya existe.")
