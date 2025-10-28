let dataGlobal = [];
let dataTable;

document.addEventListener("DOMContentLoaded", async () => {
  try {
    const res = await fetch("/api/tickets-completo");
    dataGlobal = await res.json();

    inicializarFiltros();
    actualizarTabla();

    // === Inicializar rango de fechas por defecto ===
    const hoy = new Date().toISOString().split("T")[0];
    document.getElementById("fechaInicio").value = hoy;
    document.getElementById("fechaFin").value = hoy;

    // === Mostrar gráfico de la última semana al cargar ===
    actualizarGrafico("semana");

    // === Evento: cambio de rango (Hoy / Semana / Rango) ===
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

    // === Evento: botón "Actualizar" ===
    document.getElementById("btnActualizarGrafico").addEventListener("click", () => {
      const inicio = document.getElementById("fechaInicio").value;
      const fin = document.getElementById("fechaFin").value;
      if (!inicio || !fin) {
        alert("Selecciona ambas fechas de inicio y fin.");
        return;
      }
      actualizarGrafico("rango", inicio, fin);
    });

  } catch (err) {
    console.error("❌ Error al cargar data:", err);
  }
});


// === Inicializar filtros dependientes ===
function inicializarFiltros() {
  const direcciones = [...new Set(dataGlobal.map(d => d.DIRECCION))].sort();
  llenarSelect("filtroDireccion", direcciones);

  // Dirección → Área
  $('#filtroDireccion').on('change.select2', () => {
    const selDir = obtenerSeleccion("filtroDireccion");
    const base = dataGlobal.filter(d =>
      selDir.length === 0 || selDir.includes("__all__") || selDir.includes(d.DIRECCION)
    );

    const areas = [...new Set(base.map(d => d.AREA))].sort();
    llenarSelect("filtroArea", areas);
    llenarSelect("filtroTipo", []); // Reset tipo

    actualizarTabla();
  });

  // Área → Tipo
  $('#filtroArea').on('change.select2', () => {
    const selDir = obtenerSeleccion("filtroDireccion");
    const selArea = obtenerSeleccion("filtroArea");

    const base = dataGlobal.filter(d =>
      (selDir.length === 0 || selDir.includes("__all__") || selDir.includes(d.DIRECCION)) &&
      (selArea.length === 0 || selArea.includes("__all__") || selArea.includes(d.AREA))
    );

    const tipos = [...new Set(base.map(d => d["TIPO REQUERIMIENTO"]))].sort();
    llenarSelect("filtroTipo", tipos);

    actualizarTabla();
  });

  // Tipo → actualiza tabla
  $('#filtroTipo').on('change.select2', actualizarTabla);
}


// === Llenar selects con Select2 y “Seleccionar todo” ===
function llenarSelect(id, opciones) {
  const sel = document.getElementById(id);
  sel.innerHTML = '<option value="__all__">✅ Seleccionar todo</option>' +
    opciones.map(o => `<option value="${o}">${o}</option>`).join("");

  // Evitar duplicación de instancias Select2
  if ($(`#${id}`).data('select2')) {
    $(`#${id}`).select2('destroy');
  }

  $(`#${id}`).select2({
    theme: "bootstrap-5",
    placeholder: "Selecciona una o varias opciones",
    allowClear: true,
    closeOnSelect: false,
    width: "100%",
    language: { noResults: () => "Sin resultados" },
    dropdownAutoWidth: true
  });

  // Opción “Seleccionar todo”
  $(`#${id}`).on("select2:select", function (e) {
    if (e.params.data.id === "__all__") {
      const allValues = $(this).find("option:not([value='__all__'])").map(function () {
        return $(this).val();
      }).get();
      const current = $(this).val() || [];
      const isAllSelected = current.length === allValues.length;
      $(this).val(isAllSelected ? [] : allValues).trigger("change");
    }
  });
}


// === Obtener valores seleccionados ===
function obtenerSeleccion(id) {
  return Array.from(document.getElementById(id).selectedOptions).map(opt => opt.value);
}


// === Actualizar tabla ===
function actualizarTabla() {
  const dir = obtenerSeleccion("filtroDireccion");
  const area = obtenerSeleccion("filtroArea");
  const tipo = obtenerSeleccion("filtroTipo");

  const filtradas = dataGlobal.filter(d =>
    (dir.includes("__all__") || dir.length === 0 || dir.includes(d.DIRECCION)) &&
    (area.includes("__all__") || area.length === 0 || area.includes(d.AREA)) &&
    (tipo.includes("__all__") || tipo.length === 0 || tipo.includes(d["TIPO REQUERIMIENTO"]))
  );

  generarTablaResumen(filtradas);
}


// === Generar tabla resumen ===
function generarTablaResumen(dataFiltrada) {
  const agrupado = {};

  // Agrupar por especialista
  dataFiltrada.forEach(r => {
    const esp = r["ESPECIALISTA FUNCIONAL TI"] || "SIN ASIGNAR";
    const estado = (r["ESTADO"] || "").toUpperCase();

    if (!agrupado[esp]) {
      agrupado[esp] = { asignado: 0, proceso: 0, pendiente: 0, total: 0 };
    }

    if (estado.includes("ASIGNADO")) agrupado[esp].asignado++;
    else if (estado.includes("PROCESO")) agrupado[esp].proceso++;
    else if (estado.includes("PENDIENTE")) agrupado[esp].pendiente++;

    agrupado[esp].total =
      agrupado[esp].asignado + agrupado[esp].proceso + agrupado[esp].pendiente;
  });

  // Calcular totales generales
  let totAsig = 0, totProc = 0, totPend = 0, totTot = 0;
  const filas = [];

  Object.entries(agrupado).forEach(([esp, v]) => {
    // Mostrar solo filas con algún total > 0
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

  // Si no hay datos
  if (filas.length === 0) {
    document.querySelector("#tablaEspecialistas tbody").innerHTML = `
      <tr><td colspan="5" class="text-center text-muted py-3">
      Sin registros para los filtros seleccionados.</td></tr>
    `;
    return;
  }

  // Fila total
  filas.push(`
    <tr class="fw-bold" style="background-color: #f1f3f5;">
      <th>TOTAL DE REQUERIMIENTOS</th>
      <th>${totAsig}</th>
      <th>${totProc}</th>
      <th>${totPend}</th>
      <th>${totTot}</th>
    </tr>
  `);

  // Insertar tabla
  document.querySelector("#tablaEspecialistas tbody").innerHTML = filas.join("");

  // Actualizar KPIs
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
          borderRadius: 6
        },
        {
          type: "line",
          label: "Tendencia",
          data: valores,
          borderColor: "#0d6efd",
          borderWidth: 2,
          tension: 0.3,
          fill: false,
          pointBackgroundColor: "#0d6efd"
        }
      ]
    },
    options: {
      responsive: true,
      plugins: {
        legend: { position: "top" },
        tooltip: { mode: "index", intersect: false },
        datalabels: {
          display: true,
          color: "#000",
          anchor: "end",
          align: "top",
          font: { weight: "bold" }
        }
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

