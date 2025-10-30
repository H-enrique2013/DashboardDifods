import os
import pandas as pd
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
# 🔹 CLASIFICACIÓN AUTOMÁTICA DE TICKETS
# =====================================
def clasificar_ticket(descripcion_ticket: str):
    """
    Analiza el texto del ticket y clasifica tipo, requerimiento, prioridad y área.
    Para tipo_requerimiento y requerimiento: debe elegir solo de las listas de la hoja.
    Para área_asignada y prioridad: puede inferir libremente o usar las opciones predefinidas.
    """
    if not descripcion_ticket or descripcion_ticket.strip() == "":
        return {"error": "Descripción vacía"}

    # === Validar URL y convertir si no es CSV ===
    sheet_url = SHEET_URL_ASIGNACION.strip()
    if "export?format=csv" not in sheet_url:
        sheet_url = sheet_url.replace("/edit#gid=", "/export?format=csv&gid=")

    # === Leer hoja de asignaciones ===
    try:
        df_asignacion = pd.read_csv(
            sheet_url,
            dtype={
                "DNI_ENCARGO_PROCESO": str,
                "DNI_COORDINADOR_PROCESO": str
            },
            on_bad_lines='skip',
            engine='python'
        ).fillna("")
    except Exception as e:
        print("❌ Error al leer Google Sheet:", e)
        return {"error": f"No se pudo leer la hoja de asignación: {e}"}

    # === Generar listas únicas ===
    try:
        tipos = sorted(df_asignacion["CATEGORIA_REQUERIMIENTO"].dropna().unique().tolist())
        requerimientos = sorted(df_asignacion["REQUERIMIENTO"].dropna().unique().tolist())
        areas = sorted(df_asignacion["EQUIPO"].dropna().unique().tolist())
    except KeyError as e:
        print("❌ Error: faltan columnas en la hoja:", e)
        return {"error": f"Faltan columnas esperadas en la hoja: {e}"}

    # === Convertir listas a string limpio ===
    lista_tipos = ", ".join(tipos)
    lista_requerimientos = ", ".join(requerimientos)
    lista_areas = ", ".join(areas)

    # === Log de depuración ===
    print("📄 Tipos detectados:", len(tipos))
    print("📄 Requerimientos detectados:", len(requerimientos))
    print("📄 Áreas detectadas:", len(areas))

    # === Prompt específico y controlado ===
    prompt = f"""
    Eres un analista de soporte técnico y automatización en una plataforma educativa del MINEDU (SIFODS).
    Analiza el siguiente texto y devuelve ÚNICAMENTE un JSON con las siguientes claves exactas:

    {{
      "tipo_requerimiento": "Debe elegir exactamente uno de esta lista: {lista_tipos}",
      "requerimiento": "Debe elegir exactamente uno de esta lista: {lista_requerimientos}",
      "prioridad": "Alta, Media o Baja (elige según el contexto del texto)",
      "area_asignada": "Puede inferir el área más adecuada o elegir una existente entre: {lista_areas} o considerar 'Automatización', 'Aulas Virtuales', 'Reportes', 'Plataforma'",
      "resumen_corto": "Máximo 20 palabras, resumen claro del ticket"
    }}

    Si no existe coincidencia exacta en las listas dadas, elige el valor más cercano semánticamente 
    y no inventes nuevos nombres.

    Texto del ticket:
    \"\"\"{descripcion_ticket}\"\"\"
    """

    try:
        response = client.responses.create(
            model="gpt-4o-mini",
            input=prompt,
            response_format={"type": "json_object"}
        )

        result = response.output_parsed or {}
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
        "dni_coordinador": str(fila.get("DNI_COORDINADOR_PROCESO", "")),
        "encargado": fila.get("Encargado del proceso", ""),
        "rol_proceso": fila.get("Rol del proceso", ""),
        "equipo": fila.get("EQUIPO", ""),
        "categoria_requerimiento": fila.get("CATEGORIA_REQUERIMIENTO", ""),
        "requerimiento": fila.get("REQUERIMIENTO", "")
    }

# =====================================
# 🔹 BÚSQUEDA DE TDR POR DNI
# =====================================
def obtener_tdr_por_dni(dni):
    """
    Devuelve todos los TDR (actividades, productos, entregables) de un especialista.
    """
    if not dni:
        return []
    
    df_tdr = pd.read_csv(
        SHEET_URL_TDR, 
        dtype={"DNI": str},
        on_bad_lines='skip',
        engine='python'
        )

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
    dni = especialista["dni_coordinador"] if especialista else None
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
    #print("Respuesta :",respuesta)
    #print("Especialista :",especialista)
    #print("Clasificacion :",clasificacion)
    #print("Tdr :",tdr)
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
    datos_usuario = {"NOMBRES Y APELLIDOS": "Carlos Ramos", "TICKET": "TK-1024"}

    resultado = analizar_ticket_completo(descripcion, datos_usuario)
    print(resultado)
