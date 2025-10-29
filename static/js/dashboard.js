document.addEventListener("DOMContentLoaded", () => {
  let dataTable;

  // ============================================================
  // 🔵 LOADER INICIAL - CARGANDO DATOS
  // ============================================================
  const loaderInicio = document.createElement("div");
  loaderInicio.id = "loader-inicial";
  loaderInicio.innerHTML = `
    <div class="loader-content">
      <div class="spinner-border text-primary" role="status"></div>
      <span class="ms-3 fw-semibold text-primary">Cargando datos...</span>
    </div>
  `;
  document.body.appendChild(loaderInicio);

  // ============================================================
  // 🟢 LOADER SECUNDARIO - CARGANDO TABLA
  // ============================================================
  const loaderTabla = document.createElement("div");
  loaderTabla.id = "loader-tabla";
  loaderTabla.innerHTML = `
    <div class="loader-content">
        <div class="spinner-border text-info" role="status"></div>
        <span class="ms-3 fw-semibold text-info">Cargando tabla... por favor espere!</span>
    </div>
  `;
  document.body.appendChild(loaderTabla);

  // === Estilos compartidos de loaders ===
  const style = document.createElement("style");
  style.textContent = `
    #loader-inicial, #loader-tabla {
      position: fixed;
      top: 0; left: 0;
      width: 100vw; height: 100vh;
      background: rgba(255,255,255,0.95);
      display: flex;
      justify-content: center;
      align-items: center;
      z-index: 9999;
      opacity: 1;
      transition: opacity 0.6s ease;
    }
    #loader-inicial.hide, #loader-tabla.hide {
      opacity: 0;
      pointer-events: none;
    }
    .loader-content {
      display: flex;
      align-items: center;
      font-size: 1.3rem;
    }
    #loader-tabla {
      background: rgba(255,255,255,0.9);
      z-index: 10000;
      opacity: 0;
      pointer-events: none;
    }
    #loader-tabla.show {
      opacity: 1;
      pointer-events: auto;
    }
  `;
  document.head.appendChild(style);

  // ============================================================
  // ✨ ANIMACIÓN INICIAL DE PANEL Y KPI + OCULTAR LOADER INICIAL
  // ============================================================
  const panels = document.querySelectorAll(".panel-equal");
  const cards = document.querySelectorAll(".kpi-card");

  panels.forEach((panel, i) => {
    setTimeout(() => panel.classList.add("visible"), 150 * i);
  });

  cards.forEach((card, i) => {
    setTimeout(() => card.classList.add("visible"), 200 * i);
  });

  // Ocultar loader inicial tras animación (~2.5s)
  setTimeout(() => {
    loaderInicio.classList.add("hide");
    setTimeout(() => loaderInicio.remove(), 700);
  }, 2500);

  // ============================================================
  // 🔶 GRÁFICO PRINCIPAL
  // ============================================================
  if (typeof kpis !== "undefined" && kpis && Object.keys(kpis).length > 0) {
    const ctx = document.getElementById("grafico")?.getContext("2d");
    if (!ctx) return;
    if (typeof ChartDataLabels !== "undefined") Chart.register(ChartDataLabels);

    const estados = Object.keys(kpis).filter(k => k !== "total_tickets" && k !== "error");
    const cantidades = estados.map(k => kpis[k]);
    const total = kpis.total_tickets || cantidades.reduce((a, b) => a + b, 0);

    const colorMap = {
      cerrado: "#28a745", abierto: "#dc3545", pendiente: "#ffc107",
      rechazado: "#6c757d", asignado: "#17a2b8", atendido: "#6610f2", proceso: "#20c997"
    };

    const colores = estados.map(e => {
      const key = e.toLowerCase();
      const match = Object.keys(colorMap).find(k => key.includes(k));
      return match ? colorMap[match] : "#0d6efd";
    });

    new Chart(ctx, {
      type: "doughnut",
      data: { labels: estados, datasets: [{ data: cantidades, backgroundColor: colores, borderWidth: 1 }] },
      options: {
        responsive: true,
        plugins: {
          legend: { position: "bottom", labels: { color: "#2c3e50", font: { size: 14 } } },
          datalabels: {
            color: "#fff",
            font: { weight: "bold", size: 14 },
            formatter: v => `${((v / total) * 100).toFixed(1)}%`
          }
        }
      }
    });
  }

  // ============================================================
  // 🧠 CLICK EN KPI PARA CARGAR TABLA
  // ============================================================
  document.querySelectorAll(".kpi-card").forEach(card => {
    const estado = card.querySelector(".fw-semibold")?.innerText?.trim();
    if (estado && estado.toLowerCase() !== "total tickets") {
      card.style.cursor = "pointer";
      card.addEventListener("click", () => cargarTabla(estado));
    }
  });

  // ============================================================
  // 📄 FUNCIÓN PRINCIPAL PARA CARGAR TABLA
  // ============================================================
  async function cargarTabla(estado) {
    mostrarLoaderTabla();

    try {
      const res = await fetch(`/api/tickets?estado=${encodeURIComponent(estado)}`);
      const data = await res.json();

      if (!Array.isArray(data) || data.length === 0) {
        alert("No hay registros para este estado.");
        ocultarLoaderTabla();
        return;
      }

      document.getElementById("tabla-titulo").style.display = "block";
      document.getElementById("tabla-titulo").innerHTML =
        `🧾 Registros filtrados: <span class="text-primary">${estado}</span>`;
      document.getElementById("tabla-datos").style.display = "table";

      if (!dataTable) {
        dataTable = $("#tabla-datos").DataTable({
          data: [],
          columns: Array.from(document.querySelectorAll("#tabla-datos thead th")).map(th => ({ title: th.innerText })),
          pageLength: 25,
          deferRender: true,
          scrollX: true,
          scroller: true,
          processing: true,
          language: { url: "https://cdn.datatables.net/plug-ins/1.13.7/i18n/es-ES.json" },
        });
      }

      dataTable.clear();
      dataTable.rows.add(
        data.map(row => {
          const infoJSON = encodeURIComponent(JSON.stringify(row));
          return [
            row.TICKET || "",
            row["FECHA DE REGISTRO"] || "",
            row.DOCUMENTO || "",
            `<button class='btn btn-outline-info btn-sm ver-datos' data-info="${infoJSON}" title="Ver datos personales">
              <i class='fa-solid fa-user'></i> Ver
            </button>`,
            row["TIPO REQUERIMIENTO"] || "",
            row.REQUERIMIENTO || "",
            `<i class='fa-solid fa-eye text-primary ver-descripcion' data-desc="${row.DESCRIPCION || ''}" style='cursor:pointer;'></i>`,
            row["ENLACE DE RECURSOS"]
              ? `<span class='enlace-recurso text-primary' data-enlace='${row["ENLACE DE RECURSOS"]}' style='cursor:pointer;'>
                  <i class='fa-solid fa-link'></i> ${row["ENLACE DE RECURSOS"].slice(0, 25)}...
                </span>` : "",
            row.DIRECCION || "",
            row.AREA || "",
            row.PROGRAMA || "",
            row.ESTADO || "",
            `<i class='fa-solid fa-envelope text-success ver-respuesta' data-resp="${row.RESPUESTA || ''}" style='cursor:pointer;'></i>`,
            row["FECHA DE DERIVACIÓN"] || "",
            row["HORA DE DERIVACIÓN"] || "",
            row["FECHA DE ATENCIÓN"] || "",
            row["HORA DE ATENCIÓN"] || "",
            row["ÁREA TI"] || "",
            row["DNI_ESPECIALISTA FUNCIONAL"] || "",
            row["ESPECIALISTA FUNCIONAL TI"] || "",
            row["NIVEL DE AVANCE"] || "",
            row["ESPECIALISTA APOYO TI"] || "",
            row["FECHA DE ASIGNACIÓN AL ESPECIALISTA FUNCIONAL TI"] || "",
            row.PRIORIDAD || "",
            row["FECHA TENTATIVA REALIZACIÓN"] || "",
            row.PRODUCTO || "",
            row["TIPO TICKET"] || "",
            row["FECHA_FINAL_ATENCION"] || ""
          ];
        })
      ).draw();
    } catch (error) {
      console.error("Error cargando tabla:", error);
      alert("Error al cargar los registros.");
    } finally {
      ocultarLoaderTabla();
    }
  }
  
  // ============================
  // 📌 EVENTOS DE MODALES Y ENLACES
  // ============================
  $(document).on("click", ".ver-descripcion", function () {
    $("#descripcionContent").text($(this).data("desc") || "Sin descripción disponible.");
    new bootstrap.Modal($("#modalDescripcion")).show();
  });

  $(document).on("click", ".ver-respuesta", function () {
    $("#respuestaContent").text($(this).data("resp") || "Sin respuesta registrada.");
    new bootstrap.Modal($("#modalRespuesta")).show();
  });

  $(document).on("click", ".ver-datos", function () {
  const info = JSON.parse(decodeURIComponent(this.dataset.info));
    $("#datosContent").html(`
      <p><b>Nombre:</b> ${info["NOMBRES Y APELLIDOS"] || "-"}</p>
      <p><b>Celular:</b> ${info.CELULAR || "-"}</p>
      <p><b>Correo:</b> ${info.CORREO || "-"}</p>
    `);
    new bootstrap.Modal($("#modalDatos")).show();
  });
  $(document).on("click", ".enlace-recurso", async function () {
    const enlace = $(this).data("enlace");
    if (!enlace) return;
    try {
      await navigator.clipboard.writeText(enlace);
      const original = $(this).html();
      $(this).html("<i class='fa-solid fa-check text-success'></i> Copiado");
      setTimeout(() => $(this).html(original), 1500);
    } catch {
      alert("No se pudo copiar el enlace.");
    }
  });

  // ============================================================
  // ⚙️ FUNCIONES AUXILIARES DE LOS LOADERS
  // ============================================================
  function mostrarLoaderTabla() {
    loaderTabla.classList.add("show");
  }

  function ocultarLoaderTabla() {
    loaderTabla.classList.remove("show");
  }
});
