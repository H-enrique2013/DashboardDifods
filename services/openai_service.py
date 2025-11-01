import os
import pandas as pd
import json
from openai import OpenAI
from dotenv import load_dotenv

# =====================================
# 🔹 CONFIGURACIÓN
# =====================================
load_dotenv()

client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))
SHEET_URL = os.getenv("SHEET_URL")  # si lo usas para tus tickets
SHEET_URL_ASIGNACION = os.getenv("SHEET_URL_ASIGNACION")
SHEET_URL_TDR = os.getenv("SHEET_URL_TDR")  # ❌ sin espacio al final


# =====================================
# CLASIFICACIÓN AUTOMÁTICA DE TICKETS
# =====================================
def clasificar_ticket(descripcion_ticket: str):
    """
    Analiza el texto del ticket y clasifica tipo, requerimiento, prioridad y área.
    Para tipo_requerimiento y requerimiento: debe elegir solo de las listas de la hoja.
    Para área_asignada y prioridad: puede inferir libremente o usar las opciones predefinidas.
    """
    import json

    if not descripcion_ticket or descripcion_ticket.strip() == "":
        return {"error": "Descripción vacía"}

    try:
        # === Leer hoja de asignaciones ===
        df_asignacion = pd.read_csv(
            SHEET_URL_ASIGNACION,
            dtype={
                "DNI_ENCARGO_PROCESO": str,
                "DNI_COORDINADOR_PROCESO": str
            },
            on_bad_lines='skip',
            engine='python'
        ).fillna("")

        # === Generar lista global de tipos ===
        tipos = sorted(df_asignacion["CATEGORIA_REQUERIMIENTO"].dropna().unique().tolist())
        lista_tipos = ", ".join(tipos)

    except Exception as e:
        print(f"❌ Error cargando hoja de asignaciones: {e}")
        return {"error": f"No se pudo leer la hoja de asignaciones: {e}"}

    # === Prompt inicial para determinar tipo principal ===
    prompt_tipo = f"""
    Eres un analista de soporte técnico y automatización del MINEDU (SIFODS).
    Clasifica el siguiente ticket y devuelve SOLO el tipo de requerimiento en formato JSON:
    {{
      "tipo_requerimiento": "uno de los siguientes: {lista_tipos}"
    }}

    Texto del ticket:
    \"\"\"{descripcion_ticket}\"\"\"
    """

    try:
        resp_tipo = client.responses.create(model="gpt-4o-mini", input=prompt_tipo)
        tipo_result = resp_tipo.output_text.strip().replace("```json", "").replace("```", "").strip()
        tipo_data = json.loads(tipo_result)
        tipo_requerimiento = tipo_data.get("tipo_requerimiento", "")
    except Exception as e:
        print("⚠️ No se pudo determinar tipo_requerimiento:", e)
        tipo_requerimiento = ""

    # === Filtrar requerimientos asociados a ese tipo ===
    lista_requerimientos = []
    if tipo_requerimiento:
        lista_requerimientos = df_asignacion.loc[
            df_asignacion["CATEGORIA_REQUERIMIENTO"].str.strip().str.upper() == tipo_requerimiento.strip().upper(),
            "REQUERIMIENTO"
        ].dropna().unique().tolist()

    lista_requerimientos_texto = ", ".join(lista_requerimientos) if lista_requerimientos else "N/A"

    # === Prompt completo final ===
    prompt = f"""
    Responde SOLO en formato JSON válido y sin texto adicional.

    Eres un analista de soporte técnico y automatización del MINEDU (SIFODS).
    Clasifica el siguiente ticket de soporte según su descripción.

    Reglas:
    - "tipo_requerimiento": uno de los siguientes → {lista_tipos}
    - "requerimiento": debe elegirse entre → {lista_requerimientos_texto}
    - "prioridad": elige entre Alta, Media o Baja según el contexto.
    - "area_asignada": puede inferirse o elegirse entre las que correspondan a ese tipo y requerimiento.
    - "resumen_corto": máximo 20 palabras, resumen claro.

    Texto del ticket:
    \"\"\"{descripcion_ticket}\"\"\"
    """

    try:
        response = client.responses.create(model="gpt-4o-mini", input=prompt)
        texto = response.output_text.strip()
        print("🧠 Texto IA crudo:", texto)

        texto_limpio = texto.replace("```json", "").replace("```", "").strip()

        try:
            result = json.loads(texto_limpio)
        except json.JSONDecodeError as err:
            print("⚠️ No se pudo parsear el JSON:", err)
            result = {"raw_text": texto_limpio}

        print("✅ Clasificación IA:", result)
        return result

    except Exception as e:
        print("❌ Error en clasificar_ticket:", e)
        return {"error": str(e)}




# =====================================
# 🔹 BÚSQUEDA DE ESPECIALISTA
# =====================================
def obtener_especialista(tipo, requerimiento, area,df_asignacion):
    """
    Busca en la hoja de asignaciones el especialista responsable según tipo, requerimiento y área.
    """
    df = df_asignacion.fillna("").copy()
    tipo, req, area = tipo.lower(), requerimiento.lower(), area.lower()

    # Coincidencia exacta
    exact = df[
        (df["CATEGORIA_REQUERIMIENTO"].str.lower() == tipo) &
        (df["REQUERIMIENTO"].str.lower() == req) &
        (df["EQUIPO"].str.lower() == area)
    ]
    if not exact.empty:
        fila = exact.iloc[0]
    else:
        # Coincidencia parcial si no hay exacta
        parcial = df[
            df["CATEGORIA_REQUERIMIENTO"].str.lower().str.contains(tipo, na=False) &
            df["REQUERIMIENTO"].str.lower().str.contains(req, na=False)
        ]
        fila = parcial.iloc[0] if not parcial.empty else None

    if fila is None:
        return None

    return {
        "dni_encargado_proceso": str(fila.get("DNI_ENCARGO_PROCESO", "")),
        "encargado": fila.get("Encargado del proceso", ""),
        "rol_proceso": fila.get("Rol del proceso", ""),
        "dni_coordinador": str(fila.get("DNI_COORDINADOR_PROCESO", "")),
        "equipo": fila.get("EQUIPO", ""),
        "categoria_requerimiento": fila.get("CATEGORIA_REQUERIMIENTO", ""),
        "requerimiento": fila.get("REQUERIMIENTO", "")
    }

# =====================================
# 🔹 BÚSQUEDA DE TDR POR DNI
# =====================================
def obtener_tdr_por_dni(dni,df_tdr):
    """
    Devuelve todos los TDR (actividades, productos, entregables) de un especialista.
    """
    if not dni:
        return []
    
    df = df_tdr.fillna("").copy()
    registros = df[df["DNI"].astype(str) == str(dni)]
    if registros.empty:
        return []
    return registros.to_dict(orient="records")

# =====================================
# 🔹 RESPUESTA SUGERIDA POR IA
# =====================================
def generar_respuesta(ticket_info: dict):
    """
    Genera una respuesta formal y empática al usuario según el contexto del ticket.
    """
    try:
        nombre = ticket_info.get("NOMBRES Y APELLIDOS", "usuario")
        ticket_id = ticket_info.get("TICKET", "0000")
        descripcion = ticket_info.get("DESCRIPCION", "")
        area = ticket_info.get("area_asignada", "soporte técnico")
        especialista = ticket_info.get("especialista", {}).get("encargado", "nuestro equipo")

        prompt = f"""
        Redacta una respuesta profesional y empática en español para el usuario {nombre},
        respecto al ticket N°{ticket_id}. El texto del ticket es:
        "{descripcion}"

        Informa que el requerimiento ha sido clasificado y será atendido por {especialista}
        del área de {area}. Mantén el mensaje cordial, con lenguaje claro y amable, y termina
        agradeciendo al usuario por su comunicación.
        """

        response = client.responses.create(model="gpt-4o-mini", input=prompt)
        return {"respuesta_sugerida": response.output_text.strip()}
    except Exception as e:
        return {"error": str(e)}

# =====================================
# 🔹 ORQUESTADOR GENERAL
# =====================================
def analizar_ticket_completo(descripcion_ticket, datos_usuario=None):
    """
    Analiza el ticket: clasificación IA + búsqueda de especialista + TDR + respuesta sugerida.
    """
    # Cargar las hojas desde Google Sheets directamente
    df_tdr = pd.read_csv(
        SHEET_URL_TDR, 
        dtype={"DNI": str},
        on_bad_lines='skip',
        engine='python'
        )
    df_asignacion = pd.read_csv(
        SHEET_URL_ASIGNACION,
        dtype={
            "DNI_ENCARGO_PROCESO": str,
            "DNI_COORDINADOR_PROCESO": str
        },
        on_bad_lines='skip',
        engine='python'
    )

    clasificacion = clasificar_ticket(descripcion_ticket)
    if "error" in clasificacion:
        return clasificacion

    tipo = clasificacion.get("tipo_requerimiento", "")
    req = clasificacion.get("requerimiento", "")
    area = clasificacion.get("area_asignada", "")

    especialista = obtener_especialista(tipo, req, area, df_asignacion)
    dni = especialista["dni_encargado_proceso"] if especialista else None
    tdr = obtener_tdr_por_dni(dni, df_tdr) if dni else []

    # Preparar información para respuesta
    ticket_info = {
        "NOMBRES Y APELLIDOS": datos_usuario.get("NOMBRES Y APELLIDOS", "usuario") if datos_usuario else "usuario",
        "TICKET": datos_usuario.get("TICKET", "0000") if datos_usuario else "0000",
        "DESCRIPCION": descripcion_ticket,
        "area_asignada": area,
        "especialista": especialista or {}
    }

    respuesta = generar_respuesta(ticket_info)

    return {
        "clasificacion": clasificacion,
        "especialista": especialista or "No encontrado",
        "tdr": tdr,
        "respuesta": respuesta
    }

# =====================================
# 🔹 EJEMPLO DE USO LOCAL
# =====================================
if __name__ == "__main__":
    descripcion = "No puedo crear un aula virtual nueva, el sistema muestra error al guardar."
    datos_usuario = {"NOMBRES Y APELLIDOS": "Carlos Ramos", "TICKET": "4"}
    resultado = analizar_ticket_completo(descripcion, datos_usuario)
    print(resultado)
