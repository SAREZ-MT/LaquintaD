// Distribuidora La Quinta · interfaz de despachos (Parte B del Parcial 1).
// La interfaz captura y muestra. La decisión (aprobar, alertar, rechazar o respaldo) la toma el escenario de Make.
(function () {
  "use strict";
  const CFG = window.CONFIG || {};
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const configurado = (v) => v && !String(v).startsWith("PEGAR_");
  const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  // Catálogo del enunciado (datos de partida). Las existencias reales se leen de la hoja «inventario».
  const CATALOGO = [
    ["INS-0101", "Harina de trigo x 25 kg", "bulto", 48, 15],
    ["INS-0102", "Azúcar refinada x 50 kg", "bulto", 12, 10],
    ["INS-0203", "Aceite vegetal x 20 L", "caja", 30, 12],
    ["INS-0204", "Arroz blanco x 25 kg", "bulto", 7, 20],
    ["INS-0305", "Servilletas x 1000 u", "paca", 120, 40],
    ["INS-0306", "Vasos desechables 7 oz x 2500", "caja", 25, 15],
    ["INS-0407", "Pollo congelado x 10 kg", "caja", 3, 8],
    ["INS-0408", "Queso mozzarella x 5 kg", "bloque", 60, 20],
  ].map(([codigo, producto, unidad, existencias, minimo]) => ({ codigo, producto, unidad, existencias, minimo }));

  const ETIQUETAS = {
    APROBADO: "APROBADO", APROBADO_ALERTA: "APROBADO CON ALERTA", RECHAZADO: "RECHAZADO",
    NO_VALIDO: "NO VÁLIDO", SIN_RESPUESTA: "SIN RESPUESTA",
  };
  const ICONOS = {
    APROBADO: '<path d="M5 12l5 5L20 7"/>',
    APROBADO_ALERTA: '<path d="M12 3l9 16H3z"/><path d="M12 10v4M12 17h.01"/>',
    RECHAZADO: '<path d="M6 6l12 12M18 6L6 18"/>',
    NO_VALIDO: '<circle cx="12" cy="12" r="9"/><path d="M12 8v5M12 16h.01"/>',
    SIN_RESPUESTA: '<circle cx="12" cy="12" r="9"/><path d="M12 8v5M12 16h.01"/>',
  };

  // Hora de Cali en formato «AAAA-MM-DD HH:mm:ss», el mismo que escribe Make en fecha_hora_respuesta.
  function ahoraBogota() {
    return new Intl.DateTimeFormat("sv-SE", {
      timeZone: "America/Bogota", year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false,
    }).format(new Date()).replace("T", " ");
  }
  function toast(msg) {
    const t = $("#toast"); t.textContent = msg; t.hidden = false;
    clearTimeout(toast._t); toast._t = setTimeout(() => (t.hidden = true), 3200);
  }

  // ---------- Encabezado: reloj y estado de configuración ----------
  const tickReloj = () => ($("#reloj").textContent = ahoraBogota().slice(0, 16) + " · Cali");
  tickReloj(); setInterval(tickReloj, 15000);
  (function estadoConexion() {
    const el = $("#estado-conexion"), ok = configurado(CFG.WEBHOOK_URL), hoja = configurado(CFG.SHEET_ID);
    el.classList.add(ok && hoja ? "ok" : "falta");
    el.lastElementChild.textContent = ok && hoja ? "Conectado a Make y Google Sheets" : !ok ? "Falta la URL del webhook" : "Falta el ID de la hoja";
  })();

  // ---------- Navegación ----------
  const TITULOS = { registro: ["Pedidos", "Registro de pedido"], historial: ["Administración", "Historial de movimientos"] };
  $$(".nav-item").forEach((b) => b.addEventListener("click", () => {
    const v = b.dataset.vista;
    $$(".nav-item").forEach((t) => t.classList.toggle("activo", t === b));
    $$(".vista").forEach((s) => s.classList.toggle("activa", s.id === "vista-" + v));
    [$("#migas").textContent, $("#titulo-vista").textContent] = TITULOS[v];
    if (v === "historial") cargarTabla();
  }));

  // ---------- Vista 1: registro ----------
  const form = $("#form-despacho");
  const selCodigo = $("#codigo_select");
  const otro = selCodigo.querySelector('[value="__otro"]');
  CATALOGO.forEach((p) => otro.insertAdjacentHTML("beforebegin", `<option value="${p.codigo}">${p.codigo} · ${esc(p.producto)}</option>`));

  let inventarioVivo = null; // filas de la hoja «inventario», si se pudo leer
  async function refrescarInventario() {
    if (!configurado(CFG.SHEET_ID)) return;
    try { inventarioVivo = await leerHoja("inventario"); } catch { inventarioVivo = null; }
    pintarProducto();
  }

  function productoActual() {
    const cod = selCodigo.value;
    if (!cod || cod === "__otro") return null;
    const base = CATALOGO.find((p) => p.codigo === cod);
    const vivo = inventarioVivo && inventarioVivo.find((r) => r.codigo === cod);
    return vivo ? { ...base, existencias: Number(vivo.existencias), minimo: Number(vivo.minimo), vivo: true } : { ...base, vivo: false };
  }

  function pintarBarra(barra, marca, existencias, minimo, saldo) {
    const tope = Math.max(existencias, minimo * 2, 1);
    const valor = saldo ?? existencias;
    barra.style.width = Math.max(0, Math.min(100, (valor / tope) * 100)) + "%";
    barra.style.background = valor < 0 ? "var(--bad)" : valor < minimo ? "var(--warn)" : "var(--ok)";
    marca.style.left = Math.min(100, (minimo / tope) * 100) + "%";
    marca.title = "Mínimo: " + minimo;
  }

  function pintarProducto() {
    const p = productoActual(), caja = $("#producto-info");
    caja.hidden = !p;
    if (!p) return;
    $("#pi-nombre").textContent = p.producto;
    $("#pi-unidad").textContent = "Se pide por " + p.unidad;
  }

  selCodigo.addEventListener("change", () => {
    $("#campo-otro").hidden = selCodigo.value !== "__otro";
    if (selCodigo.value === "__otro") form.codigo_otro.focus();
    pintarProducto();
  });
  form.cantidad.addEventListener("input", pintarProducto);

  function leerFormulario() {
    const f = new FormData(form);
    const codigo = (f.get("codigo_select") === "__otro" ? f.get("codigo_otro") : f.get("codigo_select")) || "";
    return {
      solicitante: String(f.get("solicitante") || "").trim(),
      correo: String(f.get("correo") || "").trim(),
      codigo_producto: String(codigo).trim().toUpperCase(),
      cantidad: String(f.get("cantidad") || "").trim(),
      destino: String(f.get("destino") || "").trim(),
      motivo: String(f.get("motivo") || ""),
    };
  }

  function validar(d) {
    $$(".invalido", form).forEach((i) => i.classList.remove("invalido"));
    const marcar = (n) => form[n] && form[n].classList && form[n].classList.add("invalido");
    const faltan = ["solicitante", "correo", "cantidad", "destino"].filter((k) => !d[k]);
    faltan.forEach(marcar);
    if (!d.codigo_producto) return marcar(selCodigo.value === "__otro" ? "codigo_otro" : "codigo_select"), "Seleccione o escriba el código del producto.";
    if (faltan.length) return "Complete los campos marcados.";
    if (!d.motivo) return "Seleccione el motivo del despacho.";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(d.correo)) return marcar("correo"), "El correo no tiene un formato válido.";
    if (!/^\d+$/.test(d.cantidad) || Number(d.cantidad) < 1) return marcar("cantidad"), "La cantidad debe ser un número entero mayor que cero.";
    return "";
  }

  // Animación de los pasos del proceso mientras Make responde.
  let timersPasos = [];
  function animarPasos() {
    const el = $("#resultado");
    el.className = "card resultado vacio";
    el.innerHTML = `<div class="vacio-ilustracion"><svg viewBox="0 0 24 24"><path d="M21 12a9 9 0 1 1-6.2-8.6"/></svg></div>
      <h3>Procesando tu pedido…</h3><p>Estamos verificando la disponibilidad.</p>
      <ol class="pasos" id="pasos"><li>Pedido recibido</li><li>Verificando disponibilidad</li><li>Respuesta</li></ol>`;
    $(".vacio-ilustracion svg", el).style.animation = "girar 1s linear infinite";
    const lis = $$("#pasos li", el);
    lis.forEach((li, i) => timersPasos.push(setTimeout(() => {
      lis.forEach((x, j) => { x.classList.toggle("hecho", j < i); x.classList.toggle("activo", j === i); });
    }, i * 450)));
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const datos = leerFormulario();
    const err = validar(datos);
    const caja = $("#error-form");
    caja.hidden = !err; caja.textContent = err;
    if (err) return;
    if (!configurado(CFG.WEBHOOK_URL)) { caja.hidden = false; caja.textContent = "Falta configurar WEBHOOK_URL en config.js."; return; }

    datos.fecha_hora_solicitud = ahoraBogota();
    const btn = $("#btn-registrar");
    btn.disabled = true; btn.innerHTML = '<span class="spin"></span><span>Enviando pedido…</span>';
    animarPasos();
    let resp;
    try {
      // form-urlencoded es una petición «simple»: el navegador no hace la consulta previa de CORS.
      const r = await fetch(CFG.WEBHOOK_URL, { method: "POST", body: new URLSearchParams(datos) });
      const texto = await r.text();
      try { resp = JSON.parse(texto); } catch { resp = null; }
      if (!resp || !resp.resultado) {
        resp = { resultado: "SIN_RESPUESTA", mensaje: "Make recibió la solicitud pero no devolvió una decisión (respuesta: «" + texto.slice(0, 80) + "»). Revise el historial del escenario." };
      }
    } catch (ex) {
      resp = { resultado: "SIN_RESPUESTA", mensaje: "No se pudo contactar el webhook de Make: " + ex.message };
    } finally {
      timersPasos.forEach(clearTimeout); timersPasos = [];
      btn.disabled = false; btn.innerHTML = '<svg viewBox="0 0 24 24"><path d="M5 12h14M13 6l6 6-6 6"/></svg><span>Enviar pedido</span>';
    }
    mostrarResultado(datos, resp);
    agregarBitacora(datos, resp);
    if (resp.resultado !== "SIN_RESPUESTA") {
      const quien = { solicitante: form.solicitante.value, correo: form.correo.value };
      form.reset(); $("#campo-otro").hidden = true;
      form.solicitante.value = quien.solicitante; form.correo.value = quien.correo; // conserva quién pide
      cache = {}; refrescarInventario(); pintarProducto();
      toast(textoParaSolicitante(datos, resp).titulo);
    }
  });

  // Mensaje para quien pide: qué pasó con su pedido y qué sigue, en palabras sencillas.
  function textoParaSolicitante(d, r) {
    const cod = r.codigo || d.codigo_producto;
    const nombre = String(d.solicitante || "").trim().split(/\s+/)[0];
    const hola = nombre ? `${nombre}, ` : "";
    const guarda = r.id_movimiento ? `Guarda tu número de pedido: ${r.id_movimiento}.` : "Tu pedido quedó registrado.";
    switch (r.resultado) {
      case "APROBADO":
        return {
          titulo: "Tu pedido fue aprobado",
          texto: `${hola}tu pedido se va a despachar completo.`,
          sigue: ["La bodega lo alista y lo envía al destino que indicaste.", guarda],
        };
      case "APROBADO_ALERTA":
        return {
          titulo: "Tu pedido fue aprobado",
          texto: `${hola}tu pedido se va a despachar completo.`,
          aviso: "Se aprobó con una alerta interna para el equipo de Compras. No tienes que hacer nada.",
          sigue: ["La bodega lo alista y lo envía al destino que indicaste.", guarda],
        };
      case "RECHAZADO": {
        const p = CATALOGO.find((x) => x.codigo === cod);
        const u = (n) => `${n} ${p ? (Number(n) === 1 ? p.unidad : p.unidad + "s") : "unidades"}`;
        const hay = Number(r.existencias_antes);
        const conDatos = Number.isFinite(hay);
        return {
          titulo: "Tu pedido fue rechazado",
          texto: conDatos
            ? `${hola}la cantidad que pediste (${u(r.cantidad ?? d.cantidad)}) es mayor a la que hay en existencia.`
            : `${hola}en este momento no tenemos la cantidad que pediste de este producto.`,
          aviso: conDatos
            ? (hay > 0 ? `Disponibles en bodega: ${u(hay)}. No se despachó nada.` : "No hay unidades disponibles en bodega. No se despachó nada.")
            : "No se despachó nada.",
          sigue: conDatos && hay > 0
            ? [`Puedes hacer un nuevo pedido por ${u(hay)} o menos.`, "O vuelve a pedirlo cuando el producto se reponga."]
            : ["Vuelve a pedirlo cuando el producto se reponga."],
        };
      }
      case "NO_VALIDO":
        return {
          titulo: "No pudimos procesar tu pedido",
          texto: `${hola}el producto ${cod} no existe en nuestro catálogo, o la cantidad no es válida.`,
          sigue: ["Revisa el código en la lista de productos y vuelve a intentarlo.", "Dejamos registro del caso para que el equipo lo revise."],
        };
      default:
        return {
          titulo: "No recibimos respuesta del sistema",
          texto: "Tu pedido no quedó confirmado.",
          sigue: ["Intenta de nuevo en unos minutos.", "Si vuelve a pasar, avisa al administrador del sistema."],
          tecnico: r.mensaje,
        };
    }
  }

  function mostrarResultado(d, r) {
    const el = $("#resultado");
    el.className = "card resultado r-" + r.resultado;
    const m = textoParaSolicitante(d, r);
    const p = CATALOGO.find((x) => x.codigo === (r.codigo || d.codigo_producto));
    el.innerHTML = `
      <div class="res-icono"><svg viewBox="0 0 24 24">${ICONOS[r.resultado] || ICONOS.NO_VALIDO}</svg></div>
      <span class="res-estado">${esc(ETIQUETAS[r.resultado] || r.resultado)}</span>
      <h3 class="res-titulo">${esc(m.titulo)}</h3>
      <p class="res-mensaje">${esc(m.texto)}</p>
      ${m.aviso ? `<p class="res-aviso">${esc(m.aviso)}</p>` : ""}
      <div class="res-sigue"><b>¿Qué sigue?</b><ul>${m.sigue.map((x) => `<li>${esc(x)}</li>`).join("")}</ul></div>
      <dl class="res-datos">
        ${r.id_movimiento ? `<dt>N.º de pedido</dt><dd>${esc(r.id_movimiento)}</dd>` : ""}
        <dt>Producto</dt><dd>${(r.producto || p) ? esc(r.producto || p.producto) + " · " : ""}${esc(r.codigo || d.codigo_producto)}</dd>
        <dt>Cantidad pedida</dt><dd>${esc(d.cantidad)}${p ? " " + esc(p.unidad) + (Number(d.cantidad) === 1 ? "" : "s") : ""}</dd>
        <dt>Destino</dt><dd>${esc(d.destino)} · ${esc(d.motivo)}</dd>
        <dt>Solicitante</dt><dd>${esc(d.solicitante)}</dd>
        <dt>Enviado</dt><dd>${esc(d.fecha_hora_solicitud)}</dd>
        ${r.fecha_hora_respuesta ? `<dt>Respondido</dt><dd>${esc(r.fecha_hora_respuesta)}</dd>` : ""}
        ${m.tecnico ? `<dt>Detalle técnico</dt><dd>${esc(m.tecnico)}</dd>` : ""}
      </dl>`;
  }

  let enSesion = 0;
  function agregarBitacora(d, r) {
    const ul = $("#bitacora");
    if (ul.querySelector(".vacio-txt")) ul.innerHTML = "";
    const li = document.createElement("li");
    li.innerHTML = `<div class="b-txt"><b>${esc(d.codigo_producto)} × ${esc(d.cantidad)}</b><span>${esc(d.fecha_hora_solicitud.slice(11))} · ${esc(d.destino)}</span></div>
      <span class="chip c-${esc(r.resultado)}">${esc(ETIQUETAS[r.resultado] || r.resultado)}</span>`;
    ul.prepend(li);
    $("#contador").textContent = String(++enSesion);
  }

  // ---------- Vista 2: historial ----------
  let tablaActual = "movimientos";
  let cache = {};
  $$(".tab").forEach((b) => b.addEventListener("click", () => {
    tablaActual = b.dataset.tabla;
    $$(".tab").forEach((t) => t.classList.toggle("activo", t === b));
    $("#filtro-resultado").hidden = tablaActual !== "movimientos";
    cargarTabla(true);
  }));
  $("#btn-actualizar").addEventListener("click", () => { cache = {}; cargarTabla(); });
  $("#filtro-resultado").addEventListener("change", () => cargarTabla(true));
  $("#buscar").addEventListener("input", () => cargarTabla(true));

  // Lee una hoja del libro como CSV. El libro debe estar compartido como «cualquier persona con el enlace puede ver».
  async function leerHoja(nombre) {
    const url = `https://docs.google.com/spreadsheets/d/${encodeURIComponent(CFG.SHEET_ID)}/gviz/tq?tqx=out:csv&headers=1&sheet=${encodeURIComponent(nombre)}&t=${Date.now()}`;
    const r = await fetch(url);
    if (!r.ok) throw new Error("Google Sheets respondió " + r.status);
    const texto = await r.text();
    if (/^\s*</.test(texto)) throw new Error("la hoja no es pública");
    const filas = parseCSV(texto).filter((f) => f.some((c) => c !== ""));
    const [enc = [], ...datos] = filas;
    return datos.map((f) => Object.fromEntries(enc.map((h, i) => [h.trim(), f[i] ?? ""])));
  }

  function parseCSV(txt) {
    const filas = []; let fila = [], campo = "", comillas = false;
    for (let i = 0; i < txt.length; i++) {
      const c = txt[i];
      if (comillas) {
        if (c === '"' && txt[i + 1] === '"') { campo += '"'; i++; }
        else if (c === '"') comillas = false;
        else campo += c;
      } else if (c === '"') comillas = true;
      else if (c === ",") { fila.push(campo); campo = ""; }
      else if (c === "\n" || c === "\r") {
        if (c === "\r" && txt[i + 1] === "\n") i++;
        fila.push(campo); filas.push(fila); fila = []; campo = "";
      } else campo += c;
    }
    if (campo !== "" || fila.length) { fila.push(campo); filas.push(fila); }
    return filas;
  }

  const COLUMNAS = {
    movimientos: ["id_movimiento", "fecha_hora_solicitud", "fecha_hora_respuesta", "solicitante", "correo", "codigo_producto", "producto", "cantidad", "existencias_antes", "saldo_despues", "minimo", "destino", "motivo", "resultado"],
    alertas_compras: ["fecha_hora", "id_movimiento", "codigo_producto", "producto", "saldo_despues", "minimo", "destino", "mensaje"],
    incidentes: ["id_incidente", "fecha_hora_solicitud", "fecha_hora_respuesta", "solicitante", "correo", "codigo_producto", "cantidad", "destino", "motivo", "tipo", "detalle"],
  };
  const NUMERICAS = new Set(["cantidad", "existencias_antes", "saldo_despues", "minimo", "existencias"]);

  async function obtener(nombre) { return (cache[nombre] = cache[nombre] || await leerHoja(nombre)); }

  async function cargarTabla(usarCache) {
    const estado = $("#estado-tabla");
    if (!configurado(CFG.SHEET_ID)) { estado.textContent = "Falta configurar SHEET_ID en config.js."; return; }
    if (!usarCache) cache = {};
    try {
      estado.textContent = "Cargando…";
      const [movs, incs] = await Promise.all([obtener("movimientos"), obtener("incidentes")]);
      pintarIndicadores(movs, incs);
      const q = $("#buscar").value.trim().toLowerCase();
      const coincide = (r) => !q || Object.values(r).some((v) => String(v).toLowerCase().includes(q));

      if (tablaActual === "inventario") {
        const inv = (await obtener("inventario")).filter(coincide);
        $("#contenedor-tabla").hidden = true; $("#contenedor-inventario").hidden = false;
        pintarInventario(inv);
        estado.textContent = `${inv.length} producto(s) · actualizado ${ahoraBogota().slice(11)}`;
        return;
      }
      $("#contenedor-tabla").hidden = false; $("#contenedor-inventario").hidden = true;
      let filas = (tablaActual === "movimientos" ? movs : tablaActual === "incidentes" ? incs : await obtener(tablaActual)).filter(coincide);
      const f = $("#filtro-resultado").value;
      if (tablaActual === "movimientos" && f) filas = filas.filter((r) => r.resultado === f);
      filas = [...filas].reverse(); // lo más reciente primero
      pintarTabla(COLUMNAS[tablaActual], filas);
      estado.textContent = `${filas.length} fila(s) · más reciente primero · actualizado ${ahoraBogota().slice(11)}`;
    } catch (ex) {
      estado.textContent = "No se pudo leer la hoja de Google Sheets (" + ex.message + "). Compártela en Google Sheets: Compartir → Acceso general → «Cualquier persona con el enlace» → Lector.";
    }
  }

  function pintarTabla(cols, filas) {
    $("#tabla thead").innerHTML = "<tr>" + cols.map((c) => `<th class="${NUMERICAS.has(c) ? "num" : ""}">${esc(c.replace(/_/g, " "))}</th>`).join("") + "</tr>";
    $("#tabla tbody").innerHTML = filas.length
      ? filas.map((r) => "<tr>" + cols.map((c) => {
          const v = r[c];
          if (c === "resultado" || c === "tipo") return `<td><span class="chip c-${esc(v)}">${esc(ETIQUETAS[v] || v)}</span></td>`;
          const cls = [];
          if (NUMERICAS.has(c)) cls.push("num");
          if (c.startsWith("id_")) cls.push("mono");
          if (c === "saldo_despues" && Number(r.saldo_despues) < Number(r.minimo)) cls.push("bajo");
          return `<td class="${cls.join(" ")}">${esc(v)}</td>`;
        }).join("") + "</tr>").join("")
      : `<tr><td colspan="${cols.length}" class="vacia">Sin registros todavía.</td></tr>`;
  }

  function pintarInventario(inv) {
    const cont = $("#contenedor-inventario");
    cont.innerHTML = inv.length ? inv.map((p) => {
      const e = Number(p.existencias), m = Number(p.minimo);
      const est = e <= 0 ? ["cero", "Agotado"] : e < m ? ["bajo", "Bajo mínimo"] : ["ok", "Disponible"];
      return `<div class="inv">
        <div class="inv-top"><span class="inv-cod">${esc(p.codigo)}</span><span class="estado-inv ${est[0]}">${est[1]}</span></div>
        <h4>${esc(p.producto)}</h4>
        <div class="inv-num"><b>${esc(p.existencias)}</b><span>${esc(p.unidad)}</span></div>
        <div class="barra-stock"><div></div><i></i></div>
        <div class="inv-pie"><span>Mínimo ${esc(p.minimo)}</span><span>${esc(p.costo_unitario ? "$" + Number(p.costo_unitario).toLocaleString("es-CO") : "")}</span></div>
      </div>`;
    }).join("") : '<p class="estado-tabla">Sin productos.</p>';
    $$(".inv", cont).forEach((el, i) => pintarBarra($(".barra-stock div", el), $(".barra-stock i", el), Number(inv[i].existencias), Number(inv[i].minimo)));
  }

  // Indicadores de la Parte A, calculados con los mismos campos de la tabla movimientos.
  function pintarIndicadores(movs, incs) {
    const t = (s) => Date.parse(String(s).replace(" ", "T") + "Z");
    const difs = movs.map((m) => (t(m.fecha_hora_respuesta) - t(m.fecha_hora_solicitud)) / 1000).filter((x) => Number.isFinite(x) && x >= 0);
    const prom = difs.length ? difs.reduce((a, b) => a + b, 0) / difs.length : null;
    $("#kpi-i1").textContent = prom === null ? "—" : prom < 60 ? `${prom.toFixed(1)} s` : `${(prom / 60).toFixed(1)} min`;
    const aprobados = movs.filter((m) => m.resultado === "APROBADO" || m.resultado === "APROBADO_ALERTA").length;
    const alerta = movs.filter((m) => m.resultado === "APROBADO_ALERTA").length;
    $("#kpi-i2").textContent = aprobados ? `${((alerta / aprobados) * 100).toFixed(1)} %` : "—";
    $("#kpi-total").textContent = String(movs.length);
    $("#kpi-desglose").textContent = `${aprobados - alerta} aprobados · ${alerta} con alerta`;
    $("#kpi-inc").textContent = String(incs.length);
  }

  refrescarInventario();
})();
