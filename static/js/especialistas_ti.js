let dataGlobal = [];
let dataTable;
let choicesDireccion, choicesArea, choicesTipo;

document.addEventListener("DOMContentLoaded", async () => {
  
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

  // Estilos del loader
  const styleLoader = document.createElement("style");
  styleLoader.textContent = `
    #loader-inicial {
      position: fixed;
      top: 0; left: 0;
      width: 100vw; height: 100vh;
      background: rgba(255,255,255,0.92);
      display: flex;
      justify-content: center;
      align-items: center;
      z-index: 9999;
      opacity: 1;
      transition: opacity 0.6s ease;
    }
    #loader-inicial.hide {
      opacity: 0;
      pointer-events: none;
    }
    .loader-content {
      display: flex;
      align-items: center;
      font-size: 1.3rem;
    }
  `;
  document.head.appendChild(styleLoader);

  try {
    const res = await fetch("/api/tickets-completo");
    dataGlobal = await res.json();

    inicializarFiltros();
    actualizarTabla();



    // === Inicializar rango de fechas ===
    const hoy = new Date().toISOString().split("T")[0];
    document.getElementById("fechaInicio").value = hoy;
    document.getElementById("fechaFin").value = hoy;

    actualizarGrafico("semana");


    // Ocultar loader inicial (tanto si carga OK como si hay error)
    function ocultarLoader() {
      loaderInicio.classList.add("hide");
      setTimeout(() => loaderInicio.remove(), 700);
    }

    // Ocultar loader tras animación (~2.5s)
    setTimeout(ocultarLoader, 2500);


    // === Eventos para rango de fechas ===
    document.getElementById("selectRango").addEventListener("change", e => {
      const rango = e.target.value;
      const fechaInicio = document.getElementById("fechaInicio");
      const fechaFin = document.getElementById("fechaFin");
      const btn = document.getElementById("btnActualizarGrafico");

      if (rango === "rango") {
        fechaInicio.style.display = "inline-block";
        fechaFin.style.display = "inline-block";
        btn.style.display = "inline-block";
      } else {
        fechaInicio.style.display = "none";
        fechaFin.style.display = "none";
        btn.style.display = "none";
        actualizarGrafico(rango);
      }
    });

    document.getElementById("btnActualizarGrafico").addEventListener("click", () => {
      const inicio = document.getElementById("fechaInicio").value;
      const fin = document.getElementById("fechaFin").value;
      if (!inicio || !fin) return alert("Selecciona ambas fechas.");
      actualizarGrafico("rango", inicio, fin);
    });

  } catch (err) {
    console.error("❌ Error al cargar data:", err);
    ocultarLoader();
  }
});

// === Inicializar filtros dependientes con Choices.js ===
function inicializarFiltros() {
  const direcciones = [...new Set(dataGlobal.map(d => d.DIRECCION))].sort();
  llenarSelect("filtroDireccion", direcciones);

  // Inicialización Choices.js
  choicesDireccion = crearChoices("#filtroDireccion");
  choicesArea = crearChoices("#filtroArea");
  choicesTipo = crearChoices("#filtroTipo");

  // === Eventos ===
  document.getElementById("filtroDireccion").addEventListener("change", () => {
    const selDir = obtenerSeleccion(choicesDireccion);
    const base = dataGlobal.filter(d =>
      selDir.length === 0 || selDir.includes(d.DIRECCION)
    );
    const areas = [...new Set(base.map(d => d.AREA))].sort();
    llenarSelect("filtroArea", areas);
    choicesArea.destroy();
    choicesArea = crearChoices("#filtroArea");
    llenarSelect("filtroTipo", []);
    actualizarTabla();
  });

  document.getElementById("filtroArea").addEventListener("change", () => {
    const selDir = obtenerSeleccion(choicesDireccion);
    const selArea = obtenerSeleccion(choicesArea);
    const base = dataGlobal.filter(d =>
      (selDir.length === 0 || selDir.includes(d.DIRECCION)) &&
      (selArea.length === 0 || selArea.includes(d.AREA))
    );
    const tipos = [...new Set(base.map(d => d["TIPO REQUERIMIENTO"]))].sort();
    llenarSelect("filtroTipo", tipos);
    choicesTipo.destroy();
    choicesTipo = crearChoices("#filtroTipo");
    actualizarTabla();
  });

  document.getElementById("filtroTipo").addEventListener("change", actualizarTabla);
}

// === Crear instancia Choices.js ===
function crearChoices(selector) {
  return new Choices(selector, {
    removeItemButton: true,
    searchEnabled: true,
    searchPlaceholderValue: "Buscar...",
    noResultsText: "Sin coincidencias",
    itemSelectText: "",
    shouldSort: false,
    position: "bottom",
  });
}

// === Llenar select dinámicamente ===
function llenarSelect(id, opciones) {
  const sel = document.getElementById(id);
  sel.innerHTML = "";
  opciones.forEach(o => {
    const opt = document.createElement("option");
    opt.value = o;
    opt.textContent = o;
    sel.appendChild(opt);
  });
}

// === Obtener valores seleccionados desde Choices ===
function obtenerSeleccion(choicesInstance) {
  return choicesInstance.getValue(true);
}

// === Actualizar tabla según filtros ===
function actualizarTabla() {
  const dir = obtenerSeleccion(choicesDireccion);
  const area = obtenerSeleccion(choicesArea);
  const tipo = obtenerSeleccion(choicesTipo);

  const filtradas = dataGlobal.filter(d =>
    (dir.length === 0 || dir.includes(d.DIRECCION)) &&
    (area.length === 0 || area.includes(d.AREA)) &&
    (tipo.length === 0 || tipo.includes(d["TIPO REQUERIMIENTO"]))
  );

  generarTablaResumen(filtradas);
}

// === Generar tabla resumen ===
function generarTablaResumen(dataFiltrada) {
  const agrupado = {};
  dataFiltrada.forEach(r => {
    const esp = r["ESPECIALISTA FUNCIONAL TI"] || "SIN ASIGNAR";
    const estado = (r["ESTADO"] || "").toUpperCase();

    if (!agrupado[esp]) agrupado[esp] = { asignado: 0, proceso: 0, pendiente: 0, total: 0 };

    if (estado.includes("ASIGNADO")) agrupado[esp].asignado++;
    else if (estado.includes("PROCESO")) agrupado[esp].proceso++;
    else if (estado.includes("PENDIENTE")) agrupado[esp].pendiente++;

    agrupado[esp].total =
      agrupado[esp].asignado + agrupado[esp].proceso + agrupado[esp].pendiente;
  });

  let totAsig = 0, totProc = 0, totPend = 0, totTot = 0;
  const filas = [];

  Object.entries(agrupado).forEach(([esp, v]) => {
    if (v.total > 0) {
      totAsig += v.asignado;
      totProc += v.proceso;
      totPend += v.pendiente;
      totTot += v.total;
      filas.push(`
        <tr>
          <td class="text-start fw-semibold">${esp}</td>
          <td>${v.asignado}</td>
          <td>${v.proceso}</td>
          <td>${v.pendiente}</td>
          <td class="fw-bold text-primary">${v.total}</td>
        </tr>
      `);
    }
  });

  if (filas.length === 0) {
    document.querySelector("#tablaEspecialistas tbody").innerHTML = `
      <tr><td colspan="5" class="text-center text-muted py-3">
      Sin registros para los filtros seleccionados.</td></tr>`;
    return;
  }

  // Reemplaza tu bloque de fila total por esto:
  // Fila total corregida
  filas.push(`
    <tr class="fw-bold fila-total">
      <td><i class="fa-solid fa-file-lines text-primary me-1"></i> TOTAL DE REQUERIMIENTOS</td>
      <td>${totAsig}</td>
      <td>${totProc}</td>
      <td>${totPend}</td>
      <td class="text-primary fw-bold">${totTot}</td>
    </tr>
  `);


  document.querySelector("#tablaEspecialistas tbody").innerHTML = filas.join("");

  document.getElementById("kpi-total").textContent = totTot;
  document.getElementById("kpi-proceso").textContent = totProc;
  document.getElementById("kpi-especialistas").textContent = filas.length - 1;
}

function actualizarGrafico(rango = "semana", fechaInicio = null, fechaFin = null) {
  const ctx = document.getElementById("graficoAtendidos");
  const hoy = new Date();
  let inicio, fin;

  // === Determinar rango automático (ajustado para zona horaria local) ===
  if (rango === "hoy") {
    const yyyy = hoy.getFullYear();
    const mm = hoy.getMonth();
    const dd = hoy.getDate();

    // Usamos margen de ±12h para cubrir UTC y local
    inicio = new Date(yyyy, mm, dd, -12, 0, 0);
    fin = new Date(yyyy, mm, dd, 35, 59, 59); // equivale a 23:59 + 12h
    
  } else if (rango === "semana") {
    const yyyy = hoy.getFullYear();
    const mm = hoy.getMonth();
    const dd = hoy.getDate();
    inicio = new Date(yyyy, mm, dd - 7, 0, 0, 0);
    fin = new Date(yyyy, mm, dd, 23, 59, 59);
  } else if (rango === "rango") {
    inicio = new Date(`${fechaInicio}T00:00:00`);
    fin = new Date(`${fechaFin}T23:59:59`);
  }

  // === Filtrar data ===
  const datosFiltrados = dataGlobal.filter(d => {
    const estado = (d["ESTADO"] || "").toUpperCase().trim();
    if (!estado.includes("ATENDIDO")) return false;

    const fechaStr = d["FECHA_FINAL_ATENCION"];
    if (!fechaStr) return false;

    // === Convertir formatos dd/mm/yyyy o yyyy-mm-dd con hora neutra (mediodía local) ===
    let fecha;
    if (fechaStr.includes("/")) {
      const [dia, mes, anio] = fechaStr.split("/");
      // usar hora 12:00 evita que el desfase UTC reste un día
      fecha = new Date(parseInt(anio), parseInt(mes) - 1, parseInt(dia), 12, 0, 0);
    } else {
      const f = new Date(fechaStr);
      fecha = new Date(f.getFullYear(), f.getMonth(), f.getDate(), 12, 0, 0);
    }

    return fecha >= inicio && fecha <= fin;
  });

  // === Agrupar por fecha normalizada (dd/mm/yyyy) ===
  const conteo = {};
  datosFiltrados.forEach(d => {
    const fechaStr = d["FECHA_FINAL_ATENCION"];
    if (!fechaStr) return;

    let f;
    if (fechaStr.includes("/")) {
      f = fechaStr;
    } else {
      const dt = new Date(fechaStr);
      f = dt.toLocaleDateString("es-PE");
    }

    conteo[f] = (conteo[f] || 0) + 1;
  });

  const labels = Object.keys(conteo).sort((a, b) => {
    const [da, ma, aa] = a.split("/");
    const [db, mb, ab] = b.split("/");
    return new Date(aa, ma - 1, da) - new Date(ab, mb - 1, db);
  });

  const valores = labels.map(f => conteo[f]);

  // === Destruir gráfico anterior si existe ===
  if (window.graficoAtendidosChart) window.graficoAtendidosChart.destroy();

  // === Crear gráfico combinado ===
  window.graficoAtendidosChart = new Chart(ctx, {
    type: "bar",
    data: {
      labels,
      datasets: [
        {
          type: "bar",
          label: "Tickets atendidos",
          data: valores,
          backgroundColor: "rgba(25, 135, 84, 0.8)",
          borderRadius: 6,
          datalabels: {
            display: true,
            color: "#000",
            anchor: "end",
            align: "top",
            font: { weight: "bold" },
            formatter: (value) => value
          }
        },
        {
          type: "line",
          label: "Tendencia",
          data: valores,
          borderColor: "#0d6efd",
          borderWidth: 2,
          tension: 0.3,
          fill: false,
          pointBackgroundColor: "#0d6efd",
          datalabels: { display: false }
        }
      ]
    },
    options: {
      responsive: true,
      plugins: {
        legend: {
          position: "top",
          align: "center",
          labels: {
            padding: 25, // ✅ Separación moderada entre la leyenda y el gráfico
            boxWidth: 20,
            boxHeight: 12,
            font: { size: 13 },
            color: "#333"
          }
        },
        tooltip: { mode: "index", intersect: false }
      },
      scales: {
        x: {
          title: { display: true, text: "Fecha" },
          ticks: { font: { size: 11 } }
        },
        y: {
          beginAtZero: true,
          title: { display: true, text: "Cantidad" }
        }
      }
    },
    plugins: [ChartDataLabels]
  });

  // === Mostrar total del rango arriba del gráfico ===
  const total = valores.reduce((a, b) => a + b, 0);
  const titulo = document.querySelector("#tituloGraficoTotal");
  if (titulo) titulo.textContent = `Total de tickets atendidos: ${total}`;
}

