import pandas as pd
import os

# === CONFIGURACIÓN ===
# Reemplaza con tu URL pública de Google Sheets (formato CSV export)
SHEET_URL = os.getenv(
    "SHEET_URL",
    "https://docs.google.com/spreadsheets/d/10fO3D243d89WleBo384J2xf19CTLNh0NtonvLrwwI_o/export?format=csv&gid=0"
)

def get_tickets_data():
    try:
        df = pd.read_csv(SHEET_URL)
        df = df.fillna("")
        return df.to_dict(orient="records")
    except Exception as e:
        return {"error": f"No se pudo leer la hoja: {e}"}
