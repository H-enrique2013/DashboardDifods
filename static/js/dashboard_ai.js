document.addEventListener("DOMContentLoaded", () => {
  // ============================
  // 🔷 LOADER VISUAL GLOBAL
  // ============================
  const loader = document.createElement("div");
  loader.id = "loader-overlay";
  loader.innerHTML = `
    <div class="loader-content">
      <div class="spinner-border text-primary" role="status"></div>
      <span class="ms-3 fw-semibold text-primary">Cargando datos...</span>
    </div>
  `;
  document.body.appendChild(loader);

  // Estilos del loader
  const style = document.createElement("style");
  style.textContent = `
    #loader-overlay {
      position: fixed;
      top: 0; left: 0;
      width: 100vw; height: 100vh;
      background: rgba(255,255,255,0.9);
      display: flex;
      justify-content: center;
      align-items: center;
      z-index: 9999;
      opacity: 1;
      transition: opacity 0.6s ease;
    }
    #loader-overlay.hide {
      opacity: 0;
      pointer-events: none;
    }
    .loader-content {
      display: flex;
      align-items: center;
      font-size: 1.3rem;
    }
  `;
  document.head.appendChild(style);

  // Ocultar el loader después de que se renderice todo el dashboard
  setTimeout(() => {
    loader.classList.add("hide");
    setTimeout(() => loader.remove(), 700);
  }, 2000);

  // ============================
  // 📊 DASHBOARD IA
  // ============================
  console.log("📈 Dashboard IA iniciado");
  console.log("KPIs cargados:", kpis);

  // === Generar tarjetas KPI dinámicas ===
  const kpiContainer = document.getElementById("kpi-container");
  kpiContainer.innerHTML = "";

  const colores = [
    "#007bff", "#28a745", "#6610f2", "#ffc107",
    "#dc3545", "#17a2b8", "#20c997", "#6c757d"
  ];

  const estados = Object.keys(kpis).filter(k => k !== "total_tickets");
  const valores = estados.map(k => kpis[k]);
  const total = kpis.total_tickets || valores.reduce((a, b) => a + b, 0);

  estados.forEach((estado, idx) => {
    const color = colores[idx % colores.length];
    const nombre = estado.replaceAll("_", " ").toUpperCase();

    const card = `
      <div class="kpi-card border-top" style="border-color:${color};">
        <div class="fw-semibold" style="color:${color}">
          <i class="fa-solid fa-circle me-1"></i> ${nombre}
        </div>
        <div class="kpi-value" style="color:${color}">${kpis[estado]}</div>
      </div>
    `;
    kpiContainer.insertAdjacentHTML("beforeend", card);
  });

  // === Gráfico dinámico con porcentajes ===
  const ctx = document.getElementById("grafico").getContext("2d");
  const coloresGrafico = estados.map((_, i) => colores[i % colores.length]);

  // 🔹 Texto central (total)
  const centerTextPlugin = {
    id: "centerText",
    afterDraw(chart) {
      const { ctx, chartArea: { width, height } } = chart;
      ctx.save();
      ctx.font = "bold 16px Segoe UI";
      ctx.fillStyle = "#2c3e50";
      ctx.textAlign = "center";
      ctx.fillText(`Total: ${total}`, width / 2, height / 2 + 10);
    }
  };

  if (typeof ChartDataLabels !== "undefined") Chart.register(ChartDataLabels);

  new Chart(ctx, {
    type: "doughnut",
    data: {
      labels: estados.map(e => e.replaceAll("_", " ").toUpperCase()),
      datasets: [{
        data: valores,
        backgroundColor: coloresGrafico,
        borderWidth: 1
      }]
    },
    options: {
      responsive: true,
      plugins: {
        legend: { position: "bottom", labels: { font: { size: 13 } } },
        tooltip: {
          callbacks: {
            label: (ctx) => {
              const val = ctx.parsed;
              const perc = ((val / total) * 100).toFixed(1);
              return `${ctx.label}: ${val} (${perc}%)`;
            }
          }
        },
        datalabels: {
          color: "#fff",
          font: { weight: "bold", size: 14 },
          formatter: (value) => `${((value / total) * 100).toFixed(1)}%`
        }
      }
    },
    plugins: [centerTextPlugin]
  });

  // ============================
  // 🤖 IA - ANÁLISIS POR TICKET
  // ============================
  const btnAnalizar = document.getElementById("btnActualizar");
  const resultDiv = document.getElementById("aiResultado");

  // Funciones loader IA
  function mostrarLoaderAI() {
    const loader = document.createElement("div");
    loader.id = "loader-overlay";
    loader.innerHTML = `
      <div class="loader-content">
        <div class="spinner-border text-info" role="status"></div>
        <span class="ms-3 fw-semibold text-info">Analizando con IA...</span>
      </div>
    `;
    document.body.appendChild(loader);
  }

  function ocultarLoaderAI() {
    const loader = document.getElementById("loader-overlay");
    if (loader) {
      loader.classList.add("hide");
      setTimeout(() => loader.remove(), 700);
    }
  }


  btnAnalizar.addEventListener("click", async () => {
    const ticketId = document.getElementById("ticketInput").value.trim();
    const resultDiv = document.getElementById("aiResultado");

    if (!ticketId) {
      resultDiv.innerHTML = "<p class='text-danger'>❗ Ingrese un ID de ticket válido.</p>";
      return;
    }

    mostrarLoaderAI();

    try {
      // 🔹 Nueva versión: método POST con JSON
      const response = await fetch("/api/ai-ticket", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ticket_id: ticketId })
      });

      const data = await response.json();
      console.log("Analisis AI:", data);

      if (data.error) {
        resultDiv.innerHTML = `<p class='text-danger'>${data.error}</p>`;
        return;
      }

      // 🔹 Renderizado profesional del resultado
      resultDiv.innerHTML = `
        <div class="fade-in">
          <h5 class="fw-bold text-primary mb-2">🎟 Ticket Analizado: ${data.ticket}</h5>
          <p><b>📝 Descripción:</b> ${data.descripcion || "Sin descripción disponible"}</p>
          
          <hr>

          <h5 class="text-success mt-3"><i class="fa-solid fa-brain"></i> Clasificación IA</h5>
          <div class="ms-3">
            <p><b>Tipo:</b> ${data.clasificacion?.tipo_requerimiento || "-"}</p>
            <p><b>Requerimiento:</b> ${data.clasificacion?.requerimiento || "-"}</p>
            <p><b>Área Asignada:</b> ${data.clasificacion?.area_asignada || "-"}</p>
            <p><b>Prioridad:</b> ${data.clasificacion?.prioridad || "-"}</p>
            <p><b>Resumen:</b> ${data.clasificacion?.resumen_corto || "-"}</p>
          </div>

          <hr>

          <h5 class="text-info mt-3"><i class="fa-solid fa-user-tie"></i> Especialista Asignado</h5>
          ${
            data.especialista && data.especialista !== "No encontrado"
              ? `
              <div class="ms-3">
                <p><b>📄 DNI Encargado:</b> ${data.especialista.dni_encargado_proceso || "-"}</p>
                <p><b>👤 Encargado:</b> ${data.especialista.encargado || "-"}</p>
                <p><b>📄 DNI Coordinador:</b> ${data.especialista.dni_coordinador || "-"}</p>
                <p><b>👤 Coordinador:</b> ${data.especialista.coordinador || "-"}</p>
                <p><b>💼 Rol del Proceso:</b> ${data.especialista.rol_proceso || "-"}</p>
                <p><b>🏢 Equipo:</b> ${data.especialista.equipo || "-"}</p>
              </div>
            `
              : "<p class='text-muted ms-3'>No se encontró especialista asignado.</p>"
          }

          <hr>

          <h5 class="text-warning mt-3"><i class="fa-solid fa-file-lines"></i> TDR Asociados</h5>
          ${
            Array.isArray(data.tdr) && data.tdr.length > 0
              ? `
              <div class="table-responsive ms-2">
                <table class="table table-sm table-striped align-middle">
                  <thead class="table-light">
                    <tr>
                      <th>Especialista</th>
                      <th>Actividades</th>
                      <th>Denominación</th>
                      <th>Entregable</th>
                      <th>Productos</th>
                      </tr>
                  </thead>
                  <tbody>
                    ${data.tdr
                      .map(
                        tdr => `
                        <tr>
                          <td>${tdr.CONTRATISTA || "-"}</td>
                          <td>${tdr.Actividades || "-"}</td>
                          <td>${tdr.DENOMINACIÓN || "-"}</td>
                          <td>${tdr.ENTREGABLE || "-"}</td>
                          <td>${tdr.PRODUCTOS || "-"}</td>
                        </tr>
                      `
                      )
                      .join("")}
                  </tbody>
                </table>
              </div>`
              : "<p class='text-muted ms-3'>No se encontraron TDR para este especialista.</p>"
          }

          <hr>

          <h5 class="text-primary mt-3"><i class="fa-solid fa-envelope-open-text"></i> Respuesta Sugerida</h5>
          <pre class="p-3 bg-light border rounded">${data.respuesta?.respuesta_sugerida || "No se generó respuesta."}</pre>
        </div>
      `;
    } catch (error) {
      console.error("❌ Error IA:", error);
      resultDiv.innerHTML = `<p class='text-danger'>Error al conectar con el servidor.</p>`;
    } finally {
      ocultarLoaderAI();
    }
  });
});
