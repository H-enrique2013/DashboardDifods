from flask import Flask, jsonify, render_template, request
from services.google_sheets_service import get_tickets_data
from services.etl_service import compute_kpis
from services.model_predict_service import predict_sla_risk
from services.openai_service import clasificar_ticket, generar_respuesta

app = Flask(__name__)

# ============================================================
# HOME PRINCIPAL CON BIENVENIDA
# ============================================================
@app.route('/')
def home():
    return render_template('home.html')


# ============================================================
# DASHBOARD GENERAL
# ============================================================
@app.route('/dashboard')
def dashboard():
    # === 1️⃣ Obtener los datos crudos ===
    data = get_tickets_data()  # Retorna lista o DataFrame con tus registros

    # === 2️⃣ Calcular los KPI ===
    kpis_raw = compute_kpis(data)  # Ejemplo: {'Cerrado': 2508, 'Atendido': 1306, ...}

    # === 3️⃣ Normalizar las claves ===
    # Convierte todo a minúsculas y reemplaza espacios por guiones bajos
    kpis = {k.lower().replace(" ", "_"): v for k, v in kpis_raw.items()}
    kpis = dict(kpis)  # <-- 🔹 fuerza a tipo dict
    # === 5️⃣ Enviar al frontend ===
    return render_template('dashboard.html', kpis=kpis)


# ============================================================
# DASHBOARD PRINCIPAL DE ESPECIALISTAS
# ============================================================
@app.route('/dashboard-especialistas')
def dashboard_especialistas():
    return render_template('especialistas_ti.html')

# ============================================================
# API - DATOS PARA DASHBOARD DE ESPECIALISTAS
# ============================================================
@app.route("/api/tickets-completo")
def api_tickets_completo():
    data = get_tickets_data()
    import pandas as pd
    df = pd.DataFrame(data)

    # Normalización básica
    df["DIRECCION"] = df["DIRECCION"].fillna("SIN DATO").str.upper()
    df["AREA"] = df["AREA"].fillna("SIN DATO").str.upper()
    df["TIPO REQUERIMIENTO"] = df["TIPO REQUERIMIENTO"].fillna("SIN DATO").str.upper()
    df["FECHA_FINAL_ATENCION"] = pd.to_datetime(
        df["FECHA_FINAL_ATENCION"], 
        format="%d/%m/%Y", 
        errors="coerce"
    )


    # Convertir fechas a string (por JSON)
    df["FECHA_FINAL_ATENCION"] = df["FECHA_FINAL_ATENCION"].dt.strftime("%Y-%m-%d")

    return df.to_json(orient="records", force_ascii=False)



# ============================================================
# DASHBOARD + IA (análisis inteligente)
# ============================================================
@app.route('/dashboard-ai')
def dashboard_ai():
    data = get_tickets_data()
    kpis = compute_kpis(data)
    return render_template('dashboard_ai.html', kpis=kpis, data=data)


# ============================================================
# API: Tickets, KPIs y Predicción
# ============================================================

@app.route('/api/kpis')
def api_kpis():
    data = get_tickets_data()
    kpis = compute_kpis(data)
    return jsonify(kpis)


@app.route('/api/predict')
def api_predict():
    data = get_tickets_data()
    predictions = predict_sla_risk(data)
    return jsonify(predictions)


# ============================================================
# API: Integración con OpenAI
# ============================================================
@app.route('/api/ai-clasificar', methods=['POST'])
def api_ai_clasificar():
    data = request.get_json()
    descripcion = data.get("descripcion", "")
    resultado = clasificar_ticket(descripcion)
    return jsonify(resultado)


@app.route('/api/ai-respuesta', methods=['POST'])
def api_ai_respuesta():
    data = request.get_json()
    resultado = generar_respuesta(data)
    return jsonify(resultado)


@app.route('/api/ai-ticket/<ticket_id>', methods=['GET'])
def api_ai_ticket(ticket_id):
    data = get_tickets_data()
    ticket = next((t for t in data if str(t.get("TICKET", "")) == str(ticket_id)), None)

    if not ticket:
        return jsonify({"error": f"No se encontró el ticket {ticket_id}"}), 404

    descripcion = ticket.get("DESCRIPCION", "")
    clasificacion = clasificar_ticket(descripcion)
    respuesta = generar_respuesta(ticket)

    return jsonify({
        "ticket": ticket.get("TICKET"),
        "descripcion": descripcion,
        "clasificacion": clasificacion,
        "respuesta": respuesta
    })

@app.route('/api/tickets')
def api_tickets():
    data = get_tickets_data()
    estado = request.args.get("estado")

    if estado:
        data = [d for d in data if str(d.get("ESTADO", "")).lower() == estado.lower()]

    return jsonify(data)


# ============================================================
# EJECUCIÓN LOCAL
# ============================================================
if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000)
