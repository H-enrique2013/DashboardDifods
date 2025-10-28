import pandas as pd
import numpy as np
import random

# ============================================================
# FUNCIÓN: Predicción simulada de riesgo SLA
# ============================================================
def predict_sla_risk(data):
    """
    Recibe una lista de tickets (diccionarios o dataframe)
    y devuelve un listado con la probabilidad simulada de riesgo SLA.
    """
    df = pd.DataFrame(data)
    if df.empty:
        return []

    resultados = []
    for _, row in df.iterrows():
        riesgo = random.uniform(0, 1)
        resultados.append({
            "TICKET": row.get("TICKET", ""),
            "PRIORIDAD": row.get("PRIORIDAD", ""),
            "riesgo_sla": round(riesgo, 2),
            "alerta": "ALTA" if riesgo > 0.7 else "MEDIA" if riesgo > 0.4 else "BAJA"
        })
    return resultados
