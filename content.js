// ============================================================
// BIO CATTALEYA SCRAPER PRO v4.1 — MOTOR ÉLITE
// Scroll lento 20s · Selectores tmall.hk precisos · OCR-ready
// ============================================================

let modoSelector = false;
let overlay = null;
let tooltipEl = null;
let resaltadoActual = null;

let datosExtraidos = {
  url: window.location.href,
  sitio: window.location.hostname,
  titulo_pagina: document.title,
  timestamp: new Date().toISOString(),
  nombre: "",
  precio: "",
  tienda: "",
  calificaciones: "",
  descripcion: "",
  specs: [],
  variaciones: [],
  imagenes: [],
  imagenes_descripcion: [],
  imagenes_variantes: [],
  tienda_recomendados: [],
  video: "",
  datos_custom: {},
  paginacion: { detectada: false, selector: "", pagina_actual: 1 },
  listado: []
};

// ─── SELECTOR VISUAL ─────────────────────────────────────────
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
  tooltipEl.innerHTML = "🎯 SELECCIONA: <b style='color:#da8fff'>" + etiqueta + "</b> &nbsp;·&nbsp; <span style='color:#aaa'>ESC para cancelar</span>";
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
  if (/\$|¥|€|USD|CNY|precio|price/i.test(txt)) return "precio";
  return "texto";
}

// ─── SCROLL LENTO 20 SEGUNDOS ────────────────────────────────
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

    // Indicador visual
    var ind = document.createElement("div");
    ind.id = "__bc_scroll_ind__";
    ind.style.cssText = "position:fixed;bottom:20px;right:20px;z-index:2147483647;background:linear-gradient(135deg,#1a0033,#3b0066);color:#e0aaff;font-family:monospace;font-size:12px;padding:10px 16px;border-radius:12px;border:1px solid #8a2be2;box-shadow:0 0 20px rgba(138,43,226,0.5);min-width:180px;text-align:center;line-height:1.8;";
    ind.innerHTML = "🌺 Escaneando con lupa...<br><b id='__bc_t__'>20s</b> restantes";
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

      // Pausa natural al 45% para simular lectura
      if (paso === Math.floor(pasos * 0.45) && !pausado) {
        pausado = true;
        var indEl = document.getElementById("__bc_scroll_ind__");
        if (indEl) indEl.innerHTML = "🔍 Leyendo descripción...<br><b>pausa breve</b>";
        setTimeout(function() { pausado = false; }, 2000);
      }

      if (paso >= pasos) {
        clearInterval(timer);
        window.scrollTo(0, 0);
        var el2 = document.getElementById("__bc_scroll_ind__");
        if (el2) el2.remove();
        resolve({ status: "ok", details: "📜 Escaneo completo (20s) – todo el contenido cargado y visible" });
      }
    }, intervalo);
  });
}

// ─── EXTRACCIÓN AUTOMÁTICA ────────────────────────────────────
// Solo fichas de producto tienen precio fiable (no home tienda / búsqueda / view_shop).
function esPaginaFichaProducto() {
  var u = window.location.href;
  if (/\/item\.htm/i.test(u)) return true;
  if (/detail\.tmall\.(com|hk)\/item/i.test(u)) return true;
  if (/item\.(taobao|tmall)\.com\/item/i.test(u)) return true;
  if (document.querySelector("#SkuPanel_tbpcDetail_ssr2025, #tbpcDetail_SkuPanelBody")) return true;
  return false;
}

function extraerAutomatico() {
  var doc = document;

  // NOMBRE — tmall usa #ariaTipText aria-label con el nombre real
  var ariaEl = doc.querySelector("#ariaTipText");
  if (ariaEl) {
    var label = ariaEl.getAttribute("aria-label") || "";
    label = label
      .replace(/^欢迎进入\s*/g, "")
      .replace(/[-–]\s*(tmall|taobao)\..*/i, "")
      .replace(/,\s*盲人用户[\s\S]*/g, "")
      .replace(/请按快捷键[\s\S]*/g, "")
      .trim();
    if (label.length > 3) datosExtraidos.nombre = label.slice(0, 200);
  }
  if (!datosExtraidos.nombre) {
    var metaOg = doc.querySelector("meta[property='og:title']");
    if (metaOg && metaOg.content && metaOg.content.trim().length > 3) datosExtraidos.nombre = metaOg.content.trim().slice(0, 200);
  }
  if (!datosExtraidos.nombre) {
    var h1s = Array.from(doc.querySelectorAll("h1"));
    for (var h of h1s) {
      var ht = h.innerText && h.innerText.trim();
      if (ht && ht.length > 5 && ht.length < 300 && !/Ctrl\+Alt/.test(ht)) { datosExtraidos.nombre = ht; break; }
    }
  }
  if (!datosExtraidos.nombre) {
    var t = doc.title || "";
    t = t.replace(/\s*[-–|·]\s*(Taobao|Tmall|淘宝|天猫|tmall\.hk).*/i, "").trim();
    if (t.length > 3) datosExtraidos.nombre = t.slice(0, 200);
  }

  var omitirPrecio = !esPaginaFichaProducto();
  if (omitirPrecio) {
    datosExtraidos.precio = "";
  }

  // ── PRECIO (solo en ficha de producto; no en view_shop / listados) ───
  // tmall.hk muestra: precio con cupón (After coupon ¥82.55) y precio original (¥115)
  // Queremos el precio ORIGINAL antes del descuento.
  // Importante: el panel SKU incluye variaciones; selectores genéricos ([class*='price'], del/s)
  // capturan números dentro de filas de SKU — excluimos esa zona.

  function estaEnZonaVariacionSku(el) {
    if (!el || !el.closest) return false;
    return el.closest(
      "[class*='SkuContent'],[class*='skuContent']," +
      "[class*='ValueItem'],[class*='valueItem']," +
      "[class*='SkuStruct'],[class*='skuStruct']," +
      "[class*='SkuItem'],[class*='skuItem']," +
      "[class*='SkuLine'],[class*='skuLine']," +
      "[class*='PropValue'],[class*='propValue']," +
      "[class*='Quantity'],[class*='quantityEditor']," +
      "[class*='ColorCard'],[class*='colorCard']"
    ) != null;
  }

  function aplicarNumeroPrecio(ep, rawTxt) {
    if (omitirPrecio) return false;
    var nums = rawTxt.match(/\d+\.?\d*/g);
    if (!nums) return false;
    var maxNum = Math.max.apply(null, nums.map(parseFloat));
    if (maxNum <= 0 || maxNum > 9999999) return false;
    datosExtraidos.precio = String(maxNum);
    return true;
  }

  var panelSku = doc.querySelector(
    "#SkuPanel_tbpcDetail_ssr2025, #tbpcDetail_SkuPanelBody, [class*='PurchasePanel']"
  );
  // Bloque superior del panel (precio), no toda la lista de SKU
  var bloquePrecioSolo =
    doc.querySelector(
      "[class*='block1--'],[class*='Block1--']," +
      "[class*='PriceModule'],[class*='priceModule']," +
      "[class*='PurchasePrice'],[class*='priceWrap']," +
      "[class*='Price--wrap--'],[class*='priceInfo--']"
    ) || panelSku;
  var ctxPrecio = bloquePrecioSolo || doc;

  // Orden: precio original tachado → precio real → resto (solo fuera de zona variación)
  var selsPrecioOrdenados = omitirPrecio ? [] : [
    "[class*='originPrice']", "[class*='OriginPrice']",
    "[class*='deleteLine']", "[class*='DeleteLine']",
    "[class*='originalPrice']",
    ".Price--realPrice--", ".Price--priceText--",
    "[class*='realPrice']", "[class*='RealPrice']",
    "[class*='priceText']", "[class*='PriceText']",
    ".tm-price", ".tb-rmb-num",
    "[itemprop='price']",
    "[class*='price']"
  ];

  for (var sp of selsPrecioOrdenados) {
    var elsPrecio = ctxPrecio.querySelectorAll(sp);
    for (var ep of elsPrecio) {
      if (estaEnZonaVariacionSku(ep)) continue;
      var tag = (ep.tagName || "").toLowerCase();
      if ((tag === "del" || tag === "s") && !ep.closest("[class*='origin'],[class*='Origin'],[class*='deleteLine'],[class*='DeleteLine'],[class*='originalPrice']"))
        continue;
      var vis = ep.offsetParent !== null || ep.getClientRects().length > 0;
      if (!vis && ep.tagName !== "META") continue;
      var inner = ep.innerText || "";
      var rawTxt = (inner || ep.getAttribute("content") || "").replace(/,/g, "").replace(/[^0-9.]/g, " ").trim();
      if (sp === "[class*='price']" && inner.length > 0 && inner.length < 120 && !/[¥￥]/.test(inner) && !/price|precio|券|折|discount|coupon/i.test(inner))
        continue;
      if (aplicarNumeroPrecio(ep, rawTxt)) break;
    }
    if (datosExtraidos.precio) break;
  }

  // Segundo intento: panel completo pero siempre excluyendo zona variación (elemento a elemento)
  if (!omitirPrecio && !datosExtraidos.precio && panelSku && panelSku !== ctxPrecio) {
    for (var sp2 of selsPrecioOrdenados) {
      var els2 = panelSku.querySelectorAll(sp2);
      for (var ep2 of els2) {
        if (estaEnZonaVariacionSku(ep2)) continue;
        var tag2 = (ep2.tagName || "").toLowerCase();
        if ((tag2 === "del" || tag2 === "s") && !ep2.closest("[class*='origin'],[class*='Origin'],[class*='deleteLine'],[class*='DeleteLine'],[class*='originalPrice']"))
          continue;
        var raw2 = (ep2.innerText || ep2.getAttribute("content") || "").replace(/,/g, "").replace(/[^0-9.]/g, " ").trim();
        if (sp2 === "[class*='price']") {
          var inn2 = ep2.innerText || "";
          if (inn2.length > 0 && inn2.length < 120 && !/[¥￥]/.test(inn2) && !/price|precio|券|折|discount|coupon/i.test(inn2)) continue;
        }
        if (aplicarNumeroPrecio(ep2, raw2)) break;
      }
      if (datosExtraidos.precio) break;
    }
  }

  // Fallback: solo texto del bloque precio (no todo el panel SKU → evita ¥ en variaciones)
  if (!omitirPrecio && !datosExtraidos.precio && ctxPrecio) {
    var textoPanel = ctxPrecio.innerText || "";
    var matchBefore = textoPanel.match(/(?:Before discount|原价|划线价)[^\d]*(\d+\.?\d*)/i);
    if (matchBefore) {
      datosExtraidos.precio = matchBefore[1];
    } else {
      var allPrices = textoPanel.match(/[¥￥]\s*(\d+\.?\d*)/g);
      if (allPrices && allPrices.length > 0) {
        var nums2 = allPrices.map(function(p) { return parseFloat(p.replace(/[¥￥\s]/g, "")); });
        datosExtraidos.precio = String(Math.max.apply(null, nums2));
      }
    }
  }

  // TIENDA
  var selsTienda = [".shop-name", ".EntityName--name--", ".shopLink", "[class*='shopName']", "[class*='storeName']", ".store-name", "#seller-name"];
  for (var st of selsTienda) {
    var tt = doc.querySelector(st);
    var ttx = tt && tt.innerText && tt.innerText.trim();
    if (ttx && ttx.length > 1 && ttx.length < 100) { datosExtraidos.tienda = ttx; break; }
  }

  // CALIFICACIONES
  var selsRating = [".rate-num", ".shop-rate", "[class*='rating']", "[class*='Rating']", "[itemprop='ratingValue']", ".Description--content--", "[class*='score']"];
  for (var sr of selsRating) {
    var rr = doc.querySelector(sr);
    var rt = rr && rr.innerText && rr.innerText.trim();
    if (rt && rt.length < 100) { datosExtraidos.calificaciones = rt; break; }
  }

  // SPECS
  var liSpecs = Array.from(doc.querySelectorAll("#J_AttrUL li, .attributes-list li, .parameter li, [class*='attrItem'] li, [class*='spec'] li"));
  var specsSet = new Set(liSpecs.map(function(li) { return li.innerText.trim(); }).filter(function(s) { return s.length > 1 && s.length < 200; }));
  datosExtraidos.specs = Array.from(specsSet).slice(0, 30);

  // VARIACIONES SKU — panel derecho (colores / tallas / variantes del mismo artículo)
  var variSet = new Set();
  var panelSkuEl = doc.querySelector(
    "#SkuPanel_tbpcDetail_ssr2025, #tbpcDetail_SkuPanelBody, [class*='GeneralSkuPanel'], [class*='SkuPanel'], [class*='PurchasePanel']"
  );
  if (panelSkuEl) {
    var skuSel =
      "[class*='ValueItem'],[class*='valueItem'],[class*='SkuValue'],[class*='skuValue']," +
      "[class*='skuText'],[class*='ColorCard'],[class*='colorCard'],[class*='PropValue']";
    Array.from(panelSkuEl.querySelectorAll(skuSel)).forEach(function(el) {
      var vt = (el.innerText || "").trim();
      if (!vt || vt.length > 80) return;
      vt = vt.split("\n")[0].trim();
      if (vt.length > 0 && !/^\d+$/.test(vt) && !/^¥|￥/.test(vt)) variSet.add(vt);
    });
  }
  if (variSet.size === 0) {
    var selsSku = [".PropValue--content--", "[class*='skuText']", "[class*='colorName']", ".sku-item span"];
    for (var ss of selsSku) {
      Array.from(doc.querySelectorAll(ss)).forEach(function(el) {
        var vv = (el.innerText || "").trim();
        if (vv && vv.length > 0 && vv.length < 40) variSet.add(vv.split("\n")[0]);
      });
      if (variSet.size > 0) break;
    }
  }
  datosExtraidos.variaciones = Array.from(variSet).slice(0, 40);

  // DESCRIPCIÓN
  var metaDesc = doc.querySelector("meta[name='description']");
  if (metaDesc && metaDesc.content) datosExtraidos.descripcion = metaDesc.content.slice(0, 500);

  return {
    status: "ok",
    details: "✅ \"" + (datosExtraidos.nombre || "Sin nombre") + "\" | ¥" + (datosExtraidos.precio || "N/A") + " | " + datosExtraidos.variaciones.length + " variantes | " + datosExtraidos.specs.length + " specs"
  };
}

// ─── EXTRACCIÓN DE MEDIA (Solo fotos del producto actual) ────

// IDs y clases del panel IZQUIERDO donde están las fotos del producto
// Según el HTML de tmall: #left-content-area, .leftWrap--mRcLbO7l, #keyInfo
var PANEL_PRODUCTO_SELECTORS = [
  "#left-content-area",
  ".leftWrap--mRcLbO7l",
  "[class*='leftWrap']",
  "[class*='leftContent']",
  "#J_ImgBooth",
  "#J_UnitImgP",
  ".tb-img",
  "[class*='ImageModule']",
  "[class*='imageModule']",
  "[class*='MainPic']",
  "[class*='mainPic']",
  "[class*='itemImgs']",
  "[class*='ItemImgs']"
];

// IDs del panel de descripción (参数信息 / 图文详情)
var PANEL_DESC_SELECTORS = [
  "#tabFullColumnEle",
  "[class*='extraInfo']",
  "[class*='ExtraInfo']",
  "[class*='descV8']",
  "[id*='desc']",
  "[class*='desc-content']"
];

// Patrones a excluir siempre
var EXCLUIR_IMG = [
  /logo/i, /banner/i, /\/icon/i, /sprite/i,
  /\/rate\//i, /rating/i, /review/i, /star/i,
  /\.gif(\?|$)/i,
  /tps-\d{3,4}-\d{2,3}/i,  // banners decorativos tmall
  /shopbg/i, /TB1[a-zA-Z]/  // imágenes antiguas de tienda
];

function esUrlValida(src) {
  if (!src || !src.startsWith("http")) return false;
  if (!/(alicdn\.com|taobao\.com|tmall\.com)/i.test(src)) return false;
  for (var p of EXCLUIR_IMG) if (p.test(src)) return false;
  return true;
}

/** Normaliza solo el envoltorio .webp falso; NO quita ? ni tamaños (evita 404 en CDN). */
function limpiarUrlImagen(src) {
  if (!src) return "";
  src = String(src).trim();
  if (src.startsWith("//")) src = "https:" + src;
  src = src.replace(/(\.(?:jpg|jpeg|png|webp))(\.(?:jpg|jpeg|png))?_\s*\.webp$/i, "$1");
  return src.trim();
}

function claveDedupUrl(url) {
  try {
    var u = new URL(url);
    return u.pathname + (u.search || "");
  } catch (e) {
    return url;
  }
}

function encontrarPanelProducto() {
  for (var sel of PANEL_PRODUCTO_SELECTORS) {
    var el = document.querySelector(sel);
    if (el) return el;
  }
  return null;
}

function encontrarPanelDescripcion() {
  for (var sel of PANEL_DESC_SELECTORS) {
    var el = document.querySelector(sel);
    if (el) return el;
  }
  return null;
}

/** Tope vertical: antes de 本店推荐 / 看了又看 / recomendaciones (no imgs de otros ítems) */
var MARCAS_FIN_DESC_PRODUCTO = [
  "本店推荐", "看了又看", "猜你喜欢", "相关推荐", "店铺推荐", "为你推荐", "同类商品",
  "Recommended by the store", "You may also like", "Similar items"
];

function detectarLimiteYDescripcionProducto() {
  var minY = Infinity;
  var candidates = document.querySelectorAll(
    "h2, h3, h4, div[class*='title'], span[class*='title'], div[class*='Title'], " +
    "[class*='moduleTitle'], [class*='ModuleTitle']"
  );
  for (var i = 0; i < candidates.length; i++) {
    var el = candidates[i];
    var txt = (el.innerText || "").trim();
    if (txt.length > 120) continue;
    for (var mi = 0; mi < MARCAS_FIN_DESC_PRODUCTO.length; mi++) {
      if (txt.indexOf(MARCAS_FIN_DESC_PRODUCTO[mi]) >= 0) {
        var y = window.scrollY + el.getBoundingClientRect().top;
        if (y < minY) minY = y;
        break;
      }
    }
  }
  return minY === Infinity ? null : minY;
}

function imgUrlReal(img) {
  var s =
    img.src ||
    img.dataset.src ||
    img.dataset.lazySrc ||
    img.getAttribute("data-ks-lazyload") ||
    img.getAttribute("data-original") ||
    "";
  if (s && s.indexOf("data:image") === 0) {
    s = img.dataset.src || img.dataset.lazySrc || img.getAttribute("data-ks-lazyload") || "";
  }
  return s || "";
}

function extraerImagenesVariantesSku() {
  var urls = [];
  var seen = new Set();
  var panel = document.querySelector(
    "#SkuPanel_tbpcDetail_ssr2025, #tbpcDetail_SkuPanelBody, [class*='GeneralSkuPanel'], [class*='SkuPanel']"
  );
  if (!panel) return urls;
  panel.querySelectorAll("img").forEach(function(img) {
    var src = imgUrlReal(img);
    if (!esUrlValida(src)) return;
    if (/avatar|icon|sprite|1x1|blank|spacer/i.test(src)) return;
    var limpia = limpiarUrlImagen(src);
    var k = claveDedupUrl(limpia);
    if (seen.has(k)) return;
    seen.add(k);
    urls.push(limpia);
  });
  return urls.slice(0, 24);
}

function extraerTiendaRecomendados() {
  var out = [];
  var heads = document.querySelectorAll(
    "h2, h3, h4, div[class*='title'], span[class*='Title'], [class*='moduleTitle']"
  );
  var startEl = null;
  var endY = Infinity;
  for (var hi = 0; hi < heads.length; hi++) {
    var t = (heads[hi].innerText || "").trim();
    if (t.indexOf("本店推荐") >= 0 && t.length < 60) startEl = heads[hi];
    if (t.indexOf("看了又看") >= 0 && t.length < 60) {
      var ey = window.scrollY + heads[hi].getBoundingClientRect().top;
      if (ey < endY) endY = ey;
    }
  }
  if (!startEl) return out;
  var yStart = window.scrollY + startEl.getBoundingClientRect().top;
  var root = startEl.closest("#page, [class*='Page'], [class*='detail'], main") || document.body;
  var seenU = new Set();
  root.querySelectorAll("a[href*='item.htm'], a[href*='detail.tmall']").forEach(function(a) {
    if (out.length >= 30) return;
    var y = window.scrollY + a.getBoundingClientRect().top;
    if (y <= yStart || y >= endY) return;
    var href = a.href || "";
    if (!href || seenU.has(href)) return;
    seenU.add(href);
    var card = a.closest("[class*='Card'], [class*='item'], li, [class*='wrap']") || a.parentElement;
    var img = card.querySelector("img");
    var imagen = "";
    if (img) {
      var s = imgUrlReal(img);
      if (esUrlValida(s)) imagen = limpiarUrlImagen(s);
    }
    var nombre = (a.getAttribute("title") || "").trim() || (a.innerText || "").trim().split("\n")[0].slice(0, 220);
    var precio = "";
    var pe = card.querySelector("[class*='price'], [class*='Price'], [class*='salePrice']");
    if (pe) {
      var mm = (pe.innerText || "").match(/[\d.]+/);
      if (mm) precio = mm[0];
    }
    out.push({
      nombre: nombre || "(sin nombre)",
      precio: precio,
      imagen: imagen,
      url: href
    });
  });
  return out;
}

function extraerMedia() {
  var vistasBase = new Set();
  var urlsProducto = [];
  var urlsDescripcion = [];

  var limiteY = detectarLimiteYDescripcionProducto();

  // ── IMÁGENES DEL PRODUCTO ──────────────────────────────────
  var panelIzq = encontrarPanelProducto();

  if (panelIzq) {
    Array.from(panelIzq.querySelectorAll("img")).forEach(function(img) {
      var src = imgUrlReal(img);
      if (!esUrlValida(src)) return;
      var limpia = limpiarUrlImagen(src);
      var k = claveDedupUrl(limpia);
      if (vistasBase.has(k)) return;
      vistasBase.add(k);

      if (img.naturalWidth > 0 && img.naturalHeight > 0) {
        var ratio = img.naturalWidth / img.naturalHeight;
        if (ratio < 0.5 || ratio > 2.0) return;
        if (img.naturalWidth < 100) return;
      }
      urlsProducto.push(limpia);
    });
  }

  if (urlsProducto.length === 0) {
    var seccionRelacionados = document.querySelector(
      "[class*='recommend'], [class*='Recommend'], [class*='similar'], " +
      "[class*='youMayLike'], [id*='recommend'], .tb-seller-info"
    );
    var todasImgs = Array.from(document.querySelectorAll("img"));

    for (var img of todasImgs) {
      if (seccionRelacionados && seccionRelacionados.contains(img)) break;

      var src = imgUrlReal(img);
      if (!esUrlValida(src)) continue;
      var limpia = limpiarUrlImagen(src);
      var k = claveDedupUrl(limpia);
      if (vistasBase.has(k)) continue;
      vistasBase.add(k);

      if (img.naturalWidth > 0 && img.naturalHeight > 0) {
        var ratio2 = img.naturalWidth / img.naturalHeight;
        if (ratio2 < 0.5 || ratio2 > 2.0) continue;
        if (img.naturalWidth < 100) continue;
      }

      urlsProducto.push(limpia);
      if (urlsProducto.length >= 12) break;
    }
  }

  // ── IMÁGENES DE DESCRIPCIÓN (参数信息/图文详情) — cortar antes de 本店推荐/看了又看
  var panelDesc = encontrarPanelDescripcion();
  if (panelDesc) {
    Array.from(panelDesc.querySelectorAll("img")).forEach(function(img) {
      var src = imgUrlReal(img);
      if (!esUrlValida(src)) return;
      var rect = img.getBoundingClientRect();
      var posImgY = window.scrollY + rect.top;
      if (limiteY !== null && posImgY >= limiteY) return;

      var limpia = limpiarUrlImagen(src);
      var k = claveDedupUrl(limpia);
      if (vistasBase.has(k)) return;
      vistasBase.add(k);
      urlsDescripcion.push(limpia);
    });
  }

  datosExtraidos.imagenes = urlsProducto.slice(0, 12);
  datosExtraidos.imagenes_descripcion = urlsDescripcion.slice(0, 25);
  datosExtraidos.imagenes_variantes = extraerImagenesVariantesSku();
  datosExtraidos.tienda_recomendados = extraerTiendaRecomendados();

  // VIDEO
  var videoTag = document.querySelector("video");
  if (videoTag) datosExtraidos.video = videoTag.src || (videoTag.querySelector("source") && videoTag.querySelector("source").src) || "";
  if (!datosExtraidos.video) {
    var scripts = document.querySelectorAll("script:not([src])");
    for (var s of scripts) {
      var match = s.textContent.match(/https?:\/\/[^"'\s\\]+\.mp4[^"'\s\\]*/);
      if (match) { datosExtraidos.video = match[0]; break; }
    }
  }

  return {
    status: "ok",
    details: "📸 " + datosExtraidos.imagenes.length + " fotos · 🖼 " + datosExtraidos.imagenes_descripcion.length + " imgs descripción" + (datosExtraidos.video ? " · 🎬 Video ✓" : "")
  };
}

// ─── PAGINACIÓN / BOTÓN COMPRA ────────────────────────────────
function detectarPaginacion() {
  var selsBuy = ["#J_LinkBuy", "#J_LinkBasket", "[class*='buyBtn']", "[class*='BuyBtn']", "[class*='addCart']", "[class*='AddCart']", "button[class*='buy']", ".tbpc-btn-buy", "[id*='buy']"];
  for (var s of selsBuy) {
    var el = document.querySelector(s);
    if (el) {
      datosExtraidos.paginacion = { detectada: true, selector: s, tipo: "boton_compra", texto: el.innerText && el.innerText.trim() };
      return { status: "ok", details: "🛒 Botón compra detectado: \"" + (el.innerText && el.innerText.trim()) + "\"" };
    }
  }
  return { status: "ok", details: "⚠️ No se detectó botón de compra ni paginación" };
}

// ─── ESQUEMA PERSONALIZADO ────────────────────────────────────
function extraerConEsquema(esquema) {
  var resultado = {};
  for (var nombre in esquema) {
    var config = esquema[nombre];
    try {
      var els = Array.from(document.querySelectorAll(config.selector));
      if (config.tipo === "lista") resultado[nombre] = els.map(function(e) { return e.innerText && e.innerText.trim() || e.src || e.href || ""; }).filter(Boolean);
      else if (config.tipo === "imagen") resultado[nombre] = els.map(function(e) { return e.src || e.href; }).filter(Boolean);
      else resultado[nombre] = (els[0] && (els[0].innerText && els[0].innerText.trim() || els[0].src || els[0].href)) || "";
    } catch(err) { resultado[nombre] = "Error en selector"; }
  }
  datosExtraidos.datos_custom = Object.assign({}, datosExtraidos.datos_custom, resultado);
  return resultado;
}

function obtenerTodosLosDatos() {
  datosExtraidos.url = window.location.href;
  datosExtraidos.titulo_pagina = document.title;
  datosExtraidos.timestamp = new Date().toISOString();
  return datosExtraidos;
}

// ─── MODO LISTADO (búsqueda / categoría / tienda view_shop / muchos productos) ───
function esUrlProductoTmall(href) {
  if (!href || typeof href !== "string") return false;
  if (/^\s*javascript:/i.test(href)) return false;
  return (
    /\/item\.htm/i.test(href) ||
    /detail\.tmall\.(com|hk)\/item/i.test(href) ||
    /world\.taobao\.com\/item/i.test(href)
  );
}

function normalizarHrefProducto(raw) {
  if (!raw || typeof raw !== "string") return "";
  try {
    return new URL(raw.trim(), window.location.href).href.split("#")[0];
  } catch (e) {
    return "";
  }
}

function enlacesProductoTmallEnDocumento() {
  var vistos = new Set();
  var pares = [];

  function add(el, rawHref) {
    var href = normalizarHrefProducto(rawHref);
    if (!href || !esUrlProductoTmall(href)) return;
    if (vistos.has(href)) return;
    vistos.add(href);
    pares.push({ el: el, href: href });
  }

  document.querySelectorAll("a[href]").forEach(function(a) {
    add(a, a.getAttribute("href"));
  });

  document
    .querySelectorAll("[data-href*='item.htm'],[data-url*='item.htm'],[data-itemurl],[data-item-id]")
    .forEach(function(node) {
      var dh =
        node.getAttribute("data-href") ||
        node.getAttribute("data-url") ||
        node.getAttribute("data-itemurl");
      if (dh) add(node, dh);
    });

  return pares;
}

function contarEnlacesItemTmall() {
  return enlacesProductoTmallEnDocumento().length;
}

function detectarPaginaListado() {
  var href = window.location.href;
  var pathHints =
    /search|list|category|s\.htm|\/channel\/|shop\/search|view_shop|shop\/index|\/shop\/|tmall\.hk\/list|list\.tmall|ju\.taobao/i.test(
      href
    );
  var n = contarEnlacesItemTmall();
  var esListado = pathHints || n >= 3;
  var detalle = esListado
    ? "Listado / tienda · " + n + " enlaces a item.htm detectados"
    : "Pocos enlaces a ítems (" + n + "). Usa Scroll y «Todos los productos» en la tienda si hace falta.";
  if (/view_shop|shop\/index/i.test(href) && n === 0) {
    detalle =
      "Página de tienda sin enlaces item.htm visibles todavía. Pulsa Scroll 20s o entra en la sección de productos de la tienda.";
  }
  return {
    esListado: esListado,
    enlacesItem: n,
    detalle: detalle,
  };
}

function extraerPrecioDeTexto(txt) {
  if (!txt) return "";
  var m = txt.match(/[¥￥]\s*([\d.,]+)|([\d.,]+)\s*(?:元|CNY)/);
  if (m) return (m[1] || m[2] || "").replace(/,/g, "");
  var nums = txt.match(/(?:^|[^\d])(\d{1,6}(?:\.\d{1,2})?)(?:[^\d]|$)/);
  return nums ? nums[1] : "";
}

function extraerCompradoresDeTexto(txt) {
  if (!txt) return "";
  var m = txt.match(/([\d.,]+[万wW]?\+?)\s*人(?:付款|收货|购买|看过|浏览)/);
  if (m) return m[0].trim();
  m = txt.match(/(?:已售|卖出|售出)\s*([\d.]+[万+]?\+?)/);
  if (m) return m[0].trim();
  m = txt.match(/(\d+[万kK]?\+)\s*(?:sold|paid)/i);
  if (m) return m[0].trim();
  return "";
}

function escanearListado() {
  var productos = [];
  var pares = enlacesProductoTmallEnDocumento();

  for (var i = 0; i < pares.length; i++) {
    var a = pares[i].el;
    var href = pares[i].href;

    var card =
      a.closest &&
      (a.closest(
        "[class*='Card--'],[class*='card--'],[class*='Product'],[class*='product'],[class*='Item--'],[class*='itemCard'],[data-spm],li,article"
      ) || a.parentElement);
    var depth = 0;
    while (card && depth < 8) {
      if (card.querySelector && card.querySelector("img")) break;
      card = card.parentElement;
      depth++;
    }
    if (!card) card = a.parentElement || a;

    var nombre =
      (a.getAttribute && a.getAttribute("title") ? a.getAttribute("title").trim() : "") ||
      (a.innerText || "")
        .trim()
        .split(/\n/)[0]
        .trim()
        .slice(0, 220);
    var imgs = card.querySelectorAll("img");
    var imagen = "";
    for (var j = 0; j < imgs.length; j++) {
      var im = imgs[j];
      var s =
        im.getAttribute("src") ||
        im.getAttribute("data-ks-lazyload") ||
        im.getAttribute("data-src") ||
        "";
      if (!s || !/^https?:/i.test(s)) continue;
      if (!/(alicdn|taobaocdn|img\.alicdn|gw\.alicdn|tbcdn)/i.test(s)) continue;
      if (/sprite|icon|1x1|blank|spacer/i.test(s)) continue;
      imagen = s;
      if (!nombre && (im.alt || "").trim()) nombre = im.alt.trim().slice(0, 220);
      break;
    }

    var textoCard = card.innerText || "";
    var precio = "";
    var pe = card.querySelector(
      "[class*='price'],[class*='Price'],[class*='salePrice'],[class*='realPrice']"
    );
    if (pe) precio = extraerPrecioDeTexto(pe.innerText || "");
    if (!precio) precio = extraerPrecioDeTexto(textoCard);

    var compradores = extraerCompradoresDeTexto(textoCard);

    productos.push({
      nombre: nombre || "(sin título)",
      precio: precio,
      compradores: compradores,
      url: href,
      imagen: imagen,
    });

    if (productos.length >= 150) break;
  }

  datosExtraidos.listado = productos;
  var detMsg = "📋 " + productos.length + " productos capturados del listado";
  if (productos.length === 0) {
    detMsg =
      "⚠️ 0 enlaces item.htm en el DOM. Pulsa Scroll 20s o entra en «Todos los productos» de la tienda; a veces la home carga tarjetas sin href todavía.";
  }
  return {
    status: "ok",
    count: productos.length,
    items: productos,
    details: detMsg,
  };
}


// ============================================================
// OCR ENGINE — Tesseract.js + Google Translate (gratuito)
// Mismo límite vertical que imágenes 图文详情 (detectarLimiteDescripcion / MARCAS_FIN_DESC_PRODUCTO)
// Tiempo máximo: 6 minutos
// ============================================================

// Tesseract.js: lib/tesseract.min.js + lib/worker.min.js + lib/tesseract-core-simd-lstm.wasm.js (manifest)

// Traducir texto usando endpoint público de Google Translate (sin API key)
async function traducirTexto(texto) {
  if (!texto || texto.trim().length < 3) return "";
  try {
    var url = "https://translate.googleapis.com/translate_a/single?client=gtx&sl=zh-CN&tl=en&dt=t&q=" 
              + encodeURIComponent(texto.slice(0, 5000));
    var res = await fetch(url);
    var json = await res.json();
    // El resultado viene como array anidado [[["traduccion","original",...],...],...]
    var traduccion = "";
    if (json && json[0]) {
      json[0].forEach(function(parte) {
        if (parte && parte[0]) traduccion += parte[0];
      });
    }
    return traduccion.trim();
  } catch(e) {
    console.log("Error traducción:", e);
    return texto; // devolver original si falla
  }
}

// Mismo límite que imágenes de 图文详情: antes de 本店推荐 / 看了又看
function detectarLimiteDescripcion() {
  var y = detectarLimiteYDescripcionProducto();
  if (y !== null) {
    console.log("🛑 Límite descripción (OCR) Y=" + y);
    return y;
  }
  return Infinity;
}

// Obtener imágenes SOLO del panel de descripción y ANTES del límite
function obtenerImagenesDescripcionFiltradas(limiteY) {
  var panelDesc = null;
  var PANEL_DESC_SELECTORS = [
    "#tabFullColumnEle", "[class*='extraInfo']",
    "[class*='descV8']", "[id*='desc']", "[class*='desc-content']"
  ];
  for (var sel of PANEL_DESC_SELECTORS) {
    var el = document.querySelector(sel);
    if (el) { panelDesc = el; break; }
  }

  var contexto = panelDesc || document.body;
  var imgs = Array.from(contexto.querySelectorAll("img"));
  var resultado = [];

  for (var img of imgs) {
    var src = img.src || img.dataset.src || img.dataset.lazySrc || "";
    if (!src || !src.startsWith("http")) continue;
    if (!/(alicdn\.com|taobao\.com|tmall\.com)/i.test(src)) continue;

    var rect = img.getBoundingClientRect();
    var posImgY = window.scrollY + rect.top;
    if (limiteY !== Infinity && posImgY >= limiteY) continue;

    if (img.naturalWidth > 0 && img.naturalWidth < 80) continue;

    resultado.push(limpiarUrlImagen(src));
  }

  return [...new Set(resultado)]; // sin duplicados
}

// Scroll suave hasta el panel de descripción
async function scrollHastaDescripcion() {
  return new Promise(function(resolve) {
    // Buscar el panel de descripción en el DOM
    var panelDesc = null;
    var selectores = ["#tabFullColumnEle", "[class*='extraInfo']", "[class*='descV8']", "[id*='desc']"];
    for (var sel of selectores) {
      var el = document.querySelector(sel);
      if (el) { panelDesc = el; break; }
    }

    if (panelDesc) {
      var rect = panelDesc.getBoundingClientRect();
      var posY = window.scrollY + rect.top - 100;
      var inicio = window.scrollY;
      var distancia = posY - inicio;
      var pasos = 80;
      var paso = 0;

      var timer = setInterval(function() {
        paso++;
        window.scrollTo(0, inicio + (distancia * paso / pasos));
        if (paso >= pasos) {
          clearInterval(timer);
          resolve();
        }
      }, 50); // 4 segundos en llegar
    } else {
      // Si no encontramos el panel, ir al 60% de la página
      window.scrollTo(0, document.body.scrollHeight * 0.6);
      resolve();
    }
  });
}

/** Carga píxeles en el contexto de la página (evita CORS al hacer fetch dentro del Web Worker). */
async function cargarImagenBytesParaOcr(url) {
  try {
    var res = await fetch(url, { mode: "cors", credentials: "omit", cache: "no-cache" });
    if (!res.ok) return null;
    var buf = await res.arrayBuffer();
    if (!buf || buf.byteLength < 200) return null;
    return new Uint8Array(buf);
  } catch (e) {
    console.warn("[BCR OCR] fetch imagen:", e.message);
    return null;
  }
}

function buildWorkerOpts() {
  var o = {
    workerBlobURL: false,
    langPath: "https://tessdata.projectnaptha.com/4.0.0",
    logger: function() {},
  };
  if (typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.getURL) {
    o.workerPath = chrome.runtime.getURL("lib/worker.min.js");
    o.corePath = chrome.runtime.getURL("lib");
  }
  return o;
}

// FUNCIÓN PRINCIPAL OCR
async function ejecutarOCR(progressCallback) {
  var log = function(msg) {
    console.log("[BCR OCR]", msg);
    if (progressCallback) progressCallback(msg);
  };

  try {
    log("🔍 Iniciando OCR... cargando motor");

    var Tesseract = window.Tesseract;
    if (!Tesseract) {
      return { status: "error", details: "❌ Tesseract no disponible. Comprueba tesseract.min.js en manifest.json" };
    }

    log("📜 Navegando al panel de descripción...");
    await scrollHastaDescripcion();
    await new Promise(function(r) { setTimeout(r, 3000); });

    var limiteY = detectarLimiteDescripcion();
    log("📏 Límite descripción: " + (limiteY === Infinity ? "toda la página" : Math.round(limiteY) + "px"));

    var imgs = obtenerImagenesDescripcionFiltradas(limiteY);
    datosExtraidos.imagenes_descripcion = imgs.slice(0, 25);

    if (imgs.length === 0) {
      return { status: "ok", details: "⚠️ No se encontraron imágenes de descripción para procesar" };
    }

    log("🖼 " + imgs.length + " imágenes encontradas para OCR");

    var workerOpts = buildWorkerOpts();
    var worker;
    try {
      worker = await Tesseract.createWorker("chi_sim+eng", 1, workerOpts);
    } catch (e1) {
      log("⚠️ chi_sim+eng falló, probando eng… " + e1.message);
      try {
        worker = await Tesseract.createWorker("eng", 1, workerOpts);
      } catch (e2) {
        return {
          status: "error",
          details: "❌ No se pudo iniciar Tesseract. " + e1.message + " · " + e2.message,
        };
      }
    }

    var textosExtraidos = [];
    var TIMEOUT_TOTAL = 6 * 60 * 1000;
    var inicio = Date.now();
    var maxImgs = Math.min(imgs.length, 20);
    var cargadas = 0;

    for (var i = 0; i < maxImgs; i++) {
      if (Date.now() - inicio > TIMEOUT_TOTAL) {
        log("⏱ Tiempo máximo alcanzado…");
        break;
      }

      log("🔍 OCR imagen " + (i + 1) + "/" + maxImgs + "…");

      var bytes = await cargarImagenBytesParaOcr(imgs[i]);
      if (!bytes) {
        log("⚠️ Imagen " + (i + 1) + ": no se pudo descargar (red/CORS). Prueba Scroll 20s antes.");
        continue;
      }
      cargadas++;

      try {
        var resultado = await worker.recognize(bytes);
        var texto = (resultado && resultado.data && resultado.data.text) ? resultado.data.text.trim() : "";
        if (texto.length > 10) {
          textosExtraidos.push(texto);
          log("✅ Imagen " + (i + 1) + ": " + texto.slice(0, 50) + "…");
        }
      } catch (e) {
        log("⚠️ Imagen " + (i + 1) + " OCR: " + e.message);
      }

      await new Promise(function(r) { setTimeout(r, 500); });
    }

    try {
      await worker.terminate();
    } catch (te) {}

    if (cargadas === 0) {
      return {
        status: "error",
        details:
          "❌ No se pudieron descargar las imágenes para OCR (CORS o red). Recarga la página, pulsa Scroll 20s y reintenta.",
      };
    }

    if (textosExtraidos.length === 0) {
      return { status: "ok", details: "⚠️ OCR completado pero no se detectó texto legible en las imágenes" };
    }

    var textoCompleto = textosExtraidos.join("\n\n---\n\n");
    log("📝 Texto: " + textoCompleto.length + " caracteres. Traduciendo…");

    var chunkSize = 3000;
    var traduccionFinal = "";
    for (var j = 0; j < textoCompleto.length; j += chunkSize) {
      var bloque = textoCompleto.slice(j, j + chunkSize);
      log("🌐 Traduciendo bloque " + (Math.floor(j / chunkSize) + 1) + "…");
      traduccionFinal += (await traducirTexto(bloque)) + " ";
      await new Promise(function(r) { setTimeout(r, 800); });
    }

    traduccionFinal = traduccionFinal.trim();
    datosExtraidos.descripcion = traduccionFinal.slice(0, 3000);

    var tiempoTotal = Math.round((Date.now() - inicio) / 1000);
    log("🎉 OCR completado en " + tiempoTotal + "s");

    return {
      status: "ok",
      details: "🔍 OCR: " + imgs.length + " imgs · " + textoCompleto.length + " chars · EN (" + tiempoTotal + "s)",
    };
  } catch (err) {
    console.error("[BCR OCR]", err);
    return {
      status: "error",
      details: "❌ " + ((err && err.message) || String(err)),
    };
  }
}

// ─── ESCUCHADOR ───────────────────────────────────────────────
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  if (request.action === "activar_selector") {
    activarModoSelector(request.etiqueta || "elemento");
    sendResponse({ status: "ok" });
  } else if (request.action === "do_ocr") {
    ejecutarOCR(function(msg) {
      chrome.runtime.sendMessage({ action: "ocr_progress", msg: msg }).catch(function() {});
    })
      .then(sendResponse)
      .catch(function(err) {
        sendResponse({
          status: "error",
          details: "❌ " + ((err && err.message) || String(err)),
        });
      });
    return true;
  } else if (request.action === "do_scroll") {
    autoScroll().then(sendResponse);
    return true;
  } else if (request.action === "get_basic_data") {
    sendResponse(extraerAutomatico());
  } else if (request.action === "get_media") {
    sendResponse(extraerMedia());
  } else if (request.action === "detect_pagination") {
    sendResponse(detectarPaginacion());
  } else if (request.action === "extract_with_schema") {
    var res = extraerConEsquema(request.esquema || {});
    sendResponse({ status: "ok", datos: res, details: "🔧 " + Object.keys(res).length + " campos custom extraídos" });
  } else if (request.action === "get_all_data") {
    sendResponse(obtenerTodosLosDatos());
  } else if (request.action === "detect_listing_page") {
    sendResponse(detectarPaginaListado());
  } else if (request.action === "scan_listing") {
    sendResponse(escanearListado());
  } else if (request.action === "reset_data") {
    datosExtraidos = {
      url: window.location.href, sitio: window.location.hostname,
      titulo_pagina: document.title, timestamp: new Date().toISOString(),
      nombre: "", precio: "", tienda: "", calificaciones: "",
      descripcion: "", specs: [], variaciones: [],
      imagenes: [], imagenes_descripcion: [], imagenes_variantes: [], tienda_recomendados: [], video: "",
      datos_custom: {}, paginacion: { detectada: false, selector: "", pagina_actual: 1 },
      listado: []
    };
    sendResponse({ status: "ok", details: "🔄 Datos reiniciados" });
  }
});
