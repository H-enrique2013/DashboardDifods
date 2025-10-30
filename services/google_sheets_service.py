import pandas as pd
import os
from dotenv import load_dotenv
# === CONFIGURACIÓN ===
# Reemplaza con tu URL pública de Google Sheets (formato CSV export)
load_dotenv()
SHEET_URL = os.getenv("SHEET_URL")


def get_tickets_data():
    try:
        # Cargar solo las columnas críticas como string
        df = pd.read_csv(
            SHEET_URL,
            dtype={
                "DOCUMENTO": str,
                "DNI_ESPECIALISTA FUNCIONAL": str
            }
        )
        df = df.fillna("")
        # Asegurarte de que no haya ".0" si Excel las exportó como float
        df["DOCUMENTO"] = df["DOCUMENTO"].astype(str).str.replace(r"\.0$", "", regex=True)
        df["DNI_ESPECIALISTA FUNCIONAL"] = df["DNI_ESPECIALISTA FUNCIONAL"].astype(str).str.replace(r"\.0$", "", regex=True)

        return df.to_dict(orient="records")

    except Exception as e:
        return {"error": f"No se pudo leer la hoja: {e}"}

