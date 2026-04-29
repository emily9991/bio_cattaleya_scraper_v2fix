
// ============================================================
// LISTING OBSERVER - MEJORA #4 (fusionado)
// ============================================================
var BSC_DEBUG = true; // cambiar a false en producciÃ³n

function bscLog(source, msg, data, level) {
  if (!BSC_DEBUG) return;
  var entry = { source: source, msg: msg, level: level || 'info' };
  if (data !== undefined) entry.data = data;
  console.log('[BSC]', source, msg, data || '');
  try {
    chrome.runtime.sendMessage({ action: 'debug_log', entry: entry });
  } catch(e) {}
}

function activarModoSelector(etiqueta) {
  modoSelector = true;
  etiqueta = etiqueta || "campo";
  overlay = document.createElement("div");
  overlay.id = "__bc_overlay__";
  overlay.style.cssText = "position:fixed;top:0;left:0;right:0;bottom:0;z-index:2147483640;pointer-events:none;background:rgba(138,43,226,0.04);";
  document.body.appendChild(overlay);
  tooltipEl = document.createElement("div");
  tooltipEl.id = "__bc_tooltip__";
  tooltipEl.style.cssText = "position:fixed;top:12px;left:50%;transform:translateX(-50%);z-index:2147483647;pointer-events:none;background:linear-gradient(135deg,#1a0033,#3b0066);color:#e0aaff;font-family:monospace;font-size:13px;padding:8px 18px;border-radius:20px;border:1px solid #8a2be2;box-shadow:0 0 20px rgba(138,43,226,0.5);";
  tooltipEl.innerHTML = "ðŸŽ¯ SELECCIONA: <b style='color:#da8fff'>" + etiqueta + "</b> &nbsp;Â·&nbsp; <span style='color:#aaa'>ESC para cancelar</span>";
  document.body.appendChild(tooltipEl);
  document.addEventListener("mouseover", resaltarElemento, true);
  document.addEventListener("click", seleccionarElemento, true);
  document.addEventListener("keydown", cancelarSelector, true);
}

function desactivarModoSelector() {
  modoSelector = false;
  if (overlay) { overlay.remove(); overlay = null; }
  if (tooltipEl) { tooltipEl.remove(); tooltipEl = null; }
  if (resaltadoActual) { resaltadoActual.style.outline = ""; resaltadoActual.style.outlineOffset = ""; resaltadoActual = null; }
  document.removeEventListener("mouseover", resaltarElemento, true);
  document.removeEventListener("click", seleccionarElemento, true);
  document.removeEventListener("keydown", cancelarSelector, true);
}

function resaltarElemento(e) {
  if (!modoSelector || (e.target.id && e.target.id.startsWith("__bc_"))) return;
  if (resaltadoActual && resaltadoActual !== e.target) { resaltadoActual.style.outline = ""; resaltadoActual.style.outlineOffset = ""; }
  resaltadoActual = e.target;
  resaltadoActual.style.outline = "2px solid #8a2be2";
  resaltadoActual.style.outlineOffset = "1px";
}

function seleccionarElemento(e) {
  if (!modoSelector) return;
  e.preventDefault(); e.stopPropagation();
  var el = e.target;
  var selector = generarSelectorOptimo(el);
  var texto = (el.innerText && el.innerText.trim()) || el.src || el.href || "(sin texto)";
  var tipo = detectarTipoElemento(el);
  chrome.runtime.sendMessage({ action: "elemento_seleccionado", selector: selector, texto: texto.slice(0, 120), tipo: tipo, tag: el.tagName.toLowerCase() });
  el.style.outline = "3px solid #00ff88";
  setTimeout(function() { el.style.outline = ""; desactivarModoSelector(); }, 600);
}

function cancelarSelector(e) {
  if (e.key === "Escape") { desactivarModoSelector(); chrome.runtime.sendMessage({ action: "selector_cancelado" }); }
}

function generarSelectorOptimo(el) {
  if (el.id && !el.id.startsWith("__bc")) return "#" + CSS.escape(el.id);
  var clases = Array.from(el.classList).filter(function(c) { return !c.startsWith("__bc") && c.length > 2; }).slice(0, 3);
  if (clases.length > 0) {
    var sel = el.tagName.toLowerCase() + "." + clases.join(".");
    if (document.querySelectorAll(sel).length <= 10) return sel;
  }
  var path = [], current = el;
  for (var i = 0; i < 4; i++) {
    if (!current || current === document.body) break;
    var seg = current.tagName.toLowerCase();
    if (current.id) { path.unshift("#" + CSS.escape(current.id)); break; }
    var sib = Array.from(current.parentElement ? current.parentElement.children : []).filter(function(c) { return c.tagName === current.tagName; });
    if (sib.length > 1) seg += ":nth-of-type(" + (sib.indexOf(current) + 1) + ")";
    path.unshift(seg);
    current = current.parentElement;
  }
  return path.join(" > ");
}

function detectarTipoElemento(el) {
  var tag = el.tagName.toLowerCase();
  if (tag === "img") return "imagen";
  if (tag === "video") return "video";
  if (tag === "a") return "enlace";
  var txt = el.innerText || "";
  if (/\$|Â¥|â‚¬|USD|CNY|precio|price/i.test(txt)) return "precio";
  return "texto";
}

function autoScroll() {
  return new Promise(function(resolve) {
    var duracion = 20000;
    var intervalo = 120;
    var pasos = duracion / intervalo;
    var alturaTotal = Math.max(document.body.scrollHeight, 4000);
    var distPorPaso = alturaTotal / pasos;
    var scrollActual = 0;
    var paso = 0;
    var pausado = false;

    var ind = document.createElement("div");
    ind.id = "__bc_scroll_ind__";
    ind.style.cssText = "position:fixed;bottom:20px;right:20px;z-index:2147483647;background:linear-gradient(135deg,#1a0033,#3b0066);color:#e0aaff;font-family:monospace;font-size:12px;padding:10px 16px;border-radius:12px;border:1px solid #8a2be2;box-shadow:0 0 20px rgba(138,43,226,0.5);min-width:180px;text-align:center;line-height:1.8;";
    ind.innerHTML = "ðŸŒº Escaneando con lupa...<br><b id='__bc_t__'>20s</b> restantes";
    document.body.appendChild(ind);

    var timer = setInterval(function() {
      if (pausado) return;
      paso++;
      var variacion = (Math.random() - 0.5) * distPorPaso * 0.2;
      scrollActual += distPorPaso;
      window.scrollTo(0, Math.max(0, scrollActual + variacion));

      var restantes = Math.max(0, Math.ceil((pasos - paso) * intervalo / 1000));
      var tel = document.getElementById("__bc_t__");
      if (tel) tel.textContent = restantes + "s";

      if (paso === Math.floor(pasos * 0.45) && !pausado) {
        pausado = true;
        var indEl = document.getElementById("__bc_scroll_ind__");
        if (indEl) indEl.innerHTML = "ðŸ” Leyendo descripciÃ³n...<br><b>pausa breve</b>";
        setTimeout(function() { pausado = false; }, 2000);
      }

      if (paso >= pasos) {
        clearInterval(timer);
        window.scrollTo(0, 0);
        var el2 = document.getElementById("__bc_scroll_ind__");
        if (el2) el2.remove();
        resolve({ status: "ok", details: "ðŸ“œ Escaneo completo (20s) â€“ todo el contenido cargado y visible" });
      }
    }, intervalo);
  });
}

function esPaginaFichaProducto() {
  var u = window.location.href;
  if (/\/item\.htm/i.test(u)) return true;
  if (/detail\.tmall\.(com|hk)\/item/i.test(u)) return true;
  if (/item\.(taobao|tmall)\.com\/item/i.test(u)) return true;
  if (document.querySelector("#SkuPanel_tbpcDetail_ssr2025, #tbpcDetail_SkuPanelBody")) return true;
  return false;
}

/** Columna derecha (compra): tÃ­tulo, precio, SKU â€” reduce ruido del resto de la pÃ¡gina */
function nodoZonaDerecha() {
  return document.querySelector(
    "[class*='rightWrap--'],[class*='RightWrap--'],[class*='rightContent--']," +
    "#J_DetailMeta,[class*='DetailMeta'],[class*='PurchasePanel']," +
    "[class*='SkuPanel_tbpcDetail'],#tbpcDetail_SkuPanelBody"
  );
}

/** GalerÃ­a izquierda (fotos / vÃ­deo principal) */
function nodoZonaIzquierda() {
  return encontrarPanelProducto();
}

/**
 * Parameter information / å‚æ•° â€” tablas y listas bajo la ficha (clave para Excel).
 */
function extraerParametrosProducto() {
  try {
  var lineas = [];
  var seen = new Set();
  function addLinea(raw) {
    var t = (raw || "").replace(/\s+/g, " ").trim();
    if (t.length < 2 || t.length > 500) return;
    var k = t.slice(0, 120);
    if (seen.has(k)) return;
    seen.add(k);
    lineas.push(t);
  }

  var bloques = document.querySelectorAll(
    "#J_AttrUL li, #J_AttrUL tr, .attributes-list li, .parameter li," +
    "[class*='AttrList'] li, [class*='attrList'] li, [class*='paramsTable'] tr," +
    "[class*='PropsTable'] tr, [class*='parmeter'] tr, [class*='Parameter'] tr," +
    "table[class*='param'] tr, [class*='goodsParams'] li, [class*='goods-params'] li"
  );
  for (var i = 0; i < bloques.length; i++) {
    var el = bloques[i];
    var t = (el.innerText || el.textContent || "").trim();
    if (!t || /^[:ï¼š\s]+$/.test(t)) continue;
    addLinea(t.split("\n")[0]);
  }

  var dls = document.querySelectorAll("[class*='param'] dl, [class*='Param'] dl, .tb-attr-list dl");
  for (var j = 0; j < dls.length; j++) {
    var dtdd = dls[j].querySelectorAll("dt,dd");
    for (var k = 0; k + 1 < dtdd.length; k += 2) {
      var dk = (dtdd[k].innerText || "").trim();
      var dv = (dtdd[k + 1].innerText || "").trim();
      if (dk && dv) addLinea(dk + ": " + dv);
    }
  }

  // Apply translation to parameters
  var parametrosTraducidos = traducirClaves(lineas);
  datosExtraidos.parametros = parametrosTraducidos.slice(0, 80);
  datosExtraidos.parametros_texto = parametrosTraducidos.join(" | ").slice(0, 8000);
  console.log("[BSC] ParÃ¡metros encontrados:", parametrosTraducidos.length, "params");
  } catch (pe) {
    console.warn("[BCR] extraerParametrosProducto", pe);
  }
}

/**
 * Translate Chinese parameter keys to English using Google Translate API
 * Batch translation in single request for performance
 */
function traducirClaves(claves, callback) {
  try {
    var texto = claves.join('\n');
    var url = CONFIG.GOOGLE_TRANSLATE_URL
      + '&sl=zh-CN&tl=en&q=' + encodeURIComponent(texto);

    fetch(url)
      .then(function(r) { return r.json(); })
      .then(function(data) {
        // Google Translate devuelve array de arrays en data[0]
        var traducidas = data[0].map(function(item) { 
          return (item[0] || '').trim(); 
        });
        var mapa = {};
        claves.forEach(function(clave, i) {
          mapa[clave] = traducidas[i] || clave; // fallback: clave original
        });
        callback(mapa);
      })
      .catch(function(e) {
        console.error('[BSC] traducirClaves fetch error:', e);
        // fallback: devolver claves originales sin traducir
        var mapa = {};
        claves.forEach(function(c) { mapa[c] = c; });
        callback(mapa);
      });
  } catch (e) {
    console.error('[BSC] traducirClaves error:', e);
    var mapa = {};    claves.forEach(function(c) { mapa[c] = c; });
    callback(mapa);
  }
}
