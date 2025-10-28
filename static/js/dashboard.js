// === Esperar a que cargue el DOM ===
document.addEventListener("DOMContentLoaded", () => {
  // ==========================
  // === GRÁFICO PRINCIPAL ===
  // ==========================
  if (typeof kpis !== "undefined" && kpis && Object.keys(kpis).length > 0) {
    const canvas = document.getElementById("grafico");
    if (!canvas) {
      console.warn("⚠️ No se encontró el canvas #grafico.");
      return;
    }

    const ctx = canvas.getContext("2d");

    // 🔹 Registrar plugin (evita errores silenciosos)
    if (typeof ChartDataLabels !== "undefined") {
      Chart.register(ChartDataLabels);
    } else {
      console.warn("⚠️ ChartDataLabels no está disponible, el gráfico no mostrará etiquetas.");
    }

    const estados = Object.keys(kpis).filter(k => k !== "total_tickets" && k !== "error");
    const cantidades = estados.map(k => kpis[k]);
    const total = kpis.total_tickets || cantidades.reduce((a, b) => a + b, 0);

    const colorMap = {
      'cerrado': '#28a745',
      'abierto': '#dc3545',
      'pendiente': '#ffc107',
      'rechazado': '#6c757d',
      'asignado': '#17a2b8',
      'atendido': '#6610f2',
      'proceso': '#20c997'
    };

    const colores = estados.map(e => {
      const key = e.toLowerCase();
      const match = Object.keys(colorMap).find(k => key.includes(k));
      return match ? colorMap[match] : '#0d6efd';
    });

    // 🧠 Depuración: muestra datos en consola
    console.log("📊 KPIs:", kpis);
    console.log("🎨 Colores usados:", colores);

    new Chart(ctx, {
      type: "doughnut",
      data: {
        labels: estados,
        datasets: [{
          data: cantidades,
          backgroundColor: colores,
          borderWidth: 1
        }]
      },
      options: {
        responsive: true,
        plugins: {
          legend: {
            position: "bottom",
            labels: { color: "#2c3e50", font: { size: 14 } }
          },
          datalabels: {
            color: "#fff",
            font: { weight: "bold", size: 14 },
            formatter: (value) => `${((value / total) * 100).toFixed(1)}%`
          },
          tooltip: {
            callbacks: {
              label: (ctx) => {
                const val = ctx.parsed;
                const perc = ((val / total) * 100).toFixed(1);
                return `${ctx.label}: ${val} (${perc}%)`;
              }
            }
          }
        }
      }
    });
  } else {
    console.warn("⚠️ No hay datos válidos para el gráfico.");
  }

  // =====================================
  // === INTERACCIÓN CON LOS KPI CARDS ===
  // =====================================
  let dataTable;

  document.querySelectorAll(".kpi-card").forEach(card => {
    const estado = card.querySelector(".fw-semibold")?.innerText?.trim();
    if (estado && estado.toLowerCase() !== "total tickets") {
      card.style.cursor = "pointer";
      card.addEventListener("click", () => cargarTabla(estado));
    }
  });

  // =========================================
  // === FUNCIÓN PRINCIPAL PARA CARGAR TABLA ===
  // =========================================
  async function cargarTabla(estado) {
    try {
      const res = await fetch(`/api/tickets?estado=${encodeURIComponent(estado)}`);
      const data = await res.json();

      if (!Array.isArray(data) || data.length === 0) {
        alert("No hay registros para este estado.");
        return;
      }

      document.getElementById("tabla-titulo").style.display = "block";
      document.getElementById("tabla-titulo").innerHTML =
        `🧾 Registros filtrados: <span class="text-primary">${estado}</span>`;
      document.getElementById("tabla-datos").style.display = "table";

      if (dataTable) dataTable.destroy();

      const tbody = document.querySelector("#tabla-datos tbody");
      tbody.innerHTML = "";

      data.forEach(row => {
        const tr = document.createElement("tr");
        tr.innerHTML = `
          <td>${row.TICKET || ""}</td>
          <td>${row["FECHA DE REGISTRO"] || ""}</td>
          <td>${row.DOCUMENTO || ""}</td>
          <td><button class="btn btn-outline-info btn-sm ver-datos" data-info='${JSON.stringify(row)}'>
              <i class="fa-solid fa-user"></i> Ver
          </button></td>
          <td>${row["TIPO REQUERIMIENTO"] || ""}</td>
          <td>${row.REQUERIMIENTO || ""}</td>
          <td><i class="fa-solid fa-eye text-primary ver-descripcion" data-desc="${row.DESCRIPCION || ''}" style="cursor:pointer;"></i></td>
          <td>
            ${
              row["ENLACE DE RECURSOS"]
              ? `<span class="enlace-recurso text-primary" data-enlace="${row["ENLACE DE RECURSOS"]}" style="cursor:pointer;">
                    <i class="fa-solid fa-link"></i> ${row["ENLACE DE RECURSOS"].slice(0, 25)}...
                 </span>`
              : ""
            }
          </td>
          <td>${row.DIRECCION || ""}</td>
          <td>${row.AREA || ""}</td>
          <td>${row.PROGRAMA || ""}</td>
          <td>${row.ESTADO || ""}</td>
          <td><i class="fa-solid fa-envelope text-success ver-respuesta" data-resp="${row.RESPUESTA || ''}" style="cursor:pointer;"></i></td>
          <td>${row["FECHA DE DERIVACIÓN"] || ""}</td>
          <td>${row["HORA DE DERIVACIÓN"] || ""}</td>
          <td>${row["FECHA DE ATENCIÓN"] || ""}</td>
          <td>${row["HORA DE ATENCIÓN"] || ""}</td>
          <td>${row["ÁREA TI"] || ""}</td>
          <td>${row["DNI_ESPECIALISTA FUNCIONAL"] || ""}</td>
          <td>${row["ESPECIALISTA FUNCIONAL TI"] || ""}</td>
          <td>${row["NIVEL DE AVANCE"] || ""}</td>
          <td>${row["ESPECIALISTA APOYO TI"] || ""}</td>
          <td>${row["FECHA DE ASIGNACIÓN AL ESPECIALISTA FUNCIONAL TI"] || ""}</td>
          <td>${row.PRIORIDAD || ""}</td>
          <td>${row["FECHA TENTATIVA REALIZACIÓN"] || ""}</td>
          <td>${row.PRODUCTO || ""}</td>
          <td>${row["TIPO TICKET"] || ""}</td>
          <td>${row["FECHA_FINAL_ATENCION"] || ""}</td>
        `;
        tbody.appendChild(tr);
      });

      // Inicializar DataTable
      dataTable = new DataTable("#tabla-datos", {
        pageLength: 10,
        lengthMenu: [10, 25, 50, 100],
        scrollX: true,
        responsive: true,
        destroy: true,
        language: { url: "https://cdn.datatables.net/plug-ins/1.13.7/i18n/es-ES.json" }
      });

      // === Asignar eventos ===
      // Modal Descripción
      $(document).on("click", ".ver-descripcion", function (e) {
        const desc = $(this).data("desc") || $(e.target).closest(".ver-descripcion").data("desc") || "Sin descripción disponible.";
        $("#descripcionContent").text(desc);
        new bootstrap.Modal($("#modalDescripcion")).show();
      });

      // Modal Respuesta
      $(document).on("click", ".ver-respuesta", function (e) {
        const resp = $(this).data("resp") || $(e.target).closest(".ver-respuesta").data("resp") || "Sin respuesta registrada.";
        $("#respuestaContent").text(resp);
        new bootstrap.Modal($("#modalRespuesta")).show();
      });

      document.querySelectorAll(".ver-datos").forEach(btn => {
        btn.addEventListener("click", e => {
          const info = JSON.parse(e.target.closest("button").dataset.info);
          document.getElementById("datosContent").innerHTML = `
            <p><b>Nombre:</b> ${info["NOMBRES Y APELLIDOS"] || "-"}</p>
            <p><b>Celular:</b> ${info.CELULAR || "-"}</p>
            <p><b>Correo:</b> ${info.CORREO || "-"}</p>
          `;
          new bootstrap.Modal(document.getElementById("modalDatos")).show();
        });
      });

      // === Copiar enlace al portapapeles ===
      document.querySelectorAll(".enlace-recurso").forEach(el => {
        el.addEventListener("click", async e => {
          const enlace = e.target.dataset.enlace || e.target.closest(".enlace-recurso")?.dataset.enlace;
          if (!enlace) return;

          try {
            await navigator.clipboard.writeText(enlace);
            const span = e.target.closest(".enlace-recurso");
            const original = span.innerHTML;
            span.innerHTML = `<i class="fa-solid fa-check text-success"></i> Copiado`;
            setTimeout(() => (span.innerHTML = original), 1500);
          } catch (err) {
            alert("No se pudo copiar el enlace.");
            console.error(err);
          }
        });
      });

    } catch (error) {
      console.error("Error cargando tabla:", error);
    }
  }

  // ===============================
  // === EXPORTAR TABLA A EXCEL ===
  // ===============================
  document.getElementById("btnExportar")?.addEventListener("click", () => {
    if (!dataTable) {
      alert("No hay datos para exportar.");
      return;
    }

    const estado = document.querySelector("#tabla-titulo span")?.innerText || "tickets";
    const rows = dataTable.rows().data().toArray();
    const headers = Array.from(document.querySelectorAll("#tabla-datos thead th")).map(th => th.innerText);

    const wb = XLSX.utils.book_new();
    const wsData = [headers, ...rows];
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    XLSX.utils.book_append_sheet(wb, ws, "Tickets");

    const nombreArchivo = `Tickets_${estado}_${new Date().toISOString().slice(0,10)}.xlsx`;
    XLSX.writeFile(wb, nombreArchivo);
  });
});


document.addEventListener("DOMContentLoaded", () => {
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("visible");
        }
      });
    },
    { threshold: 0.2 }
  );

  document.querySelectorAll(".panel-equal, .kpi-card, .chart-container").forEach((el) => {
    observer.observe(el);
  });
});
