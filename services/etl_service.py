import pandas as pd

def compute_kpis(data):
    df = pd.DataFrame(data)
    if df.empty:
        return {"error": "Sin datos"}

    # Verificar si existe la columna ESTADO
    if "ESTADO" not in df.columns:
        return {"error": "No se encuentra la columna 'ESTADO'"}

    # Total de tickets
    total = len(df)

    # Contar dinámicamente todos los estados únicos
    estado_counts = df["ESTADO"].value_counts(dropna=False).to_dict()

    # Convertir las claves a string para evitar problemas con NaN o None
    estado_counts = {str(k): int(v) for k, v in estado_counts.items()}

    # Construir el diccionario base
    kpis = {"total_tickets": total}
    kpis.update(estado_counts)

    return kpis


