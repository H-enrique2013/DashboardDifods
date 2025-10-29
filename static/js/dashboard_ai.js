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

    if (!ticketId) {
      resultDiv.innerHTML = "<p class='text-danger'>❗ Ingrese un ID de ticket válido.</p>";
      return;
    }

    mostrarLoaderAI();

    try {
      const response = await fetch(`/api/ai-ticket/${ticketId}`);
      const data = await response.json();

      if (data.error) {
        resultDiv.innerHTML = `<p class='text-danger'>${data.error}</p>`;
        return;
      }

      resultDiv.innerHTML = `
        <div class="fade-in">
          <p><b>🎟 Ticket:</b> ${data.ticket}</p>
          <p><b>📝 Descripción:</b> ${data.descripcion}</p>
          <h5 class="mt-3">🧩 Clasificación AI</h5>
          <ul>
            <li><b>Tipo:</b> ${data.clasificacion.tipo_requerimiento}</li>
            <li><b>Prioridad:</b> ${data.clasificacion.prioridad}</li>
            <li><b>Área:</b> ${data.clasificacion.area_asignada}</li>
            <li><b>Resumen:</b> ${data.clasificacion.resumen_corto}</li>
          </ul>
          <h5>✉️ Respuesta sugerida</h5>
          <pre>${data.respuesta.respuesta_sugerida}</pre>
        </div>
      `;
    } catch (error) {
      resultDiv.innerHTML = `<p class='text-danger'>Error al conectar con el servidor.</p>`;
      console.error("❌ Error IA:", error);
    } finally {
      ocultarLoaderAI();
    }
  });
});
