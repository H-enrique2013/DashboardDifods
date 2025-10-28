import os
from openai import OpenAI
from dotenv import load_dotenv
# Cargar variables del .env
load_dotenv()
# Inicializa el cliente OpenAI
client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

# ============================================================
# FUNCIÓN 1: Clasificación automática de tickets
# ============================================================
def clasificar_ticket(descripcion_ticket: str):
    """
    Clasifica un ticket según su texto usando el modelo GPT.
    Devuelve un JSON con tipo de requerimiento, prioridad y área sugerida.
    """
    if not descripcion_ticket or descripcion_ticket.strip() == "":
        return {"error": "Descripción vacía"}

    prompt = f"""
    Eres un analista de soporte técnico en una plataforma de cursos y evaluaciones.
    Analiza el siguiente texto y responde únicamente en formato JSON con:
    - tipo_requerimiento (por ejemplo: Soporte Técnico, Problema de Acceso, Error en Evaluación, Consulta General)
    - prioridad (Alta, Media, Baja)
    - area_asignada (TI, Pedagógico, Plataforma)
    - resumen_corto (máx. 20 palabras)

    Texto del ticket: "{descripcion_ticket}"
    """

    try:
        response = client.responses.create(
            model="gpt-4o-mini",
            input=prompt,
            response_format={"type": "json_object"}
        )
        return response.output_parsed
    except Exception as e:
        return {"error": str(e)}


# ============================================================
# FUNCIÓN 2: Generar una respuesta sugerida para el usuario
# ============================================================
def generar_respuesta(ticket_info: dict):
    """
    Genera una respuesta formal y empática al usuario.
    ticket_info debe incluir al menos: NOMBRES Y APELLIDOS, TICKET, DESCRIPCION.
    """
    try:
        nombre = ticket_info.get("NOMBRES Y APELLIDOS", "usuario")
        ticket_id = ticket_info.get("TICKET", "0000")
        descripcion = ticket_info.get("DESCRIPCION", "")

        prompt = f"""
        Redacta una respuesta profesional y amable para el usuario {nombre}, respecto al ticket N°{ticket_id}.
        El texto del ticket es: "{descripcion}"

        La respuesta debe:
        - Tener un tono empático y claro
        - Estar en español
        - Terminar agradeciendo al usuario
        """

        response = client.responses.create(
            model="gpt-4o-mini",
            input=prompt
        )

        texto = response.output_text.strip()
        return {"respuesta_sugerida": texto}
    except Exception as e:
        return {"error": str(e)}
