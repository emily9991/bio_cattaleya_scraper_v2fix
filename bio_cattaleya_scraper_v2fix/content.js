console.log('[BSC] Content script iniciado en:', window.location.href);
window.__bscLoaded = true;
var BSC_DEBUG = true;
function bscLog(source, msg, data, level) {
  if (!BSC_DEBUG) return;
  var entry = { source: source, msg: msg, level: level || 'info' };
  if (data !== undefined) entry.data = data;
  console.log('[BSC]', source, msg, data || '');
  try { chrome.runtime.sendMessage({ action: 'debug_log', entry: entry }); } catch (e) {}
}

var ALLOWED_IMG_HOSTS = ["img.alicdn.com", "img.taobao.com", "img.tmall.com"];

function esUrlImagenPermitida(src) {
  try {
    var parsed = new URL(src);
    return (parsed.protocol === "http:" || parsed.protocol === "https:") &&
           ALLOWED_IMG_HOSTS.includes(parsed.hostname);
  } catch (e) {
    return false;
  }
}

// ============================================================
// VARIABLES GLOBALES
// ============================================================
var listingItems = [];
var listingUrls = new Set();
var listingObserver = null;
var listingDebounceTimer = null;
var _bscExtracting = false;
var modoSelector = false;
var overlay = null;
var tooltipEl = null;
var resaltadoActual = null;
var camposDefinidos = {};
var datosExtraidos = {};

// ============================================================
// LISTING - EXTRACCION DE PRODUCTOS EN PAGINAS DE LISTADO
// ============================================================
function extraerPrecioCard(card) {
  var selectors = [
    '[class*="priceInt--"]',
    '[class*="price-text--"]',
    '[class*="priceText--"]',
    '[class*="realPrice--"]',
    '[class*="priceContainer--"] [class*="int--"]',
    '[class*="price--"]:not([class*="origin"]):not([class*="Origin"])'
  ];
  for (var i = 0; i < selectors.length; i++) {
    var el = card.querySelector(selectors[i]);
    if (el) {
      var txt = el.innerText.replace(/\s+/g, ' ').trim();
      if (txt && !/买家|sold|件|评价/i.test(txt)) return txt;
    }
  }
  return '';
}

function extraerItemListadoMainWorld(callback) {
  var eventName = 'bsc_mainworld_response_' + Date.now();
  window.addEventListener(eventName, function(e) {
    // FIX: background.js manda JSON.stringify para evitar mojibake
    // en la boundary MAIN world → isolated world.
    // e.detail llega como string JSON, no como array directo.
    var items = (typeof e.detail === 'string') ? JSON.parse(e.detail) : e.detail;
    callback(items);
  }, { once: true });
  chrome.runtime.sendMessage({ action: 'execute_mainworld', eventName: eventName });
}

function extraerItemListado() {
  bscLog("extraerItemListado", "function called", { url: location.href });
  var firstCard = document.querySelector('[class*="cardContainer--"]');
  if (firstCard) {
    bscLog("extraerItemListado", "firstCard found, calling MainWorld", { cards: document.querySelectorAll('[class*="cardContainer--"]').length });
    _bscExtracting = true;
    extraerItemListadoMainWorld(function(items) {
      _bscExtracting = false;
      if (items && items.length > 0) {
        bscLog("extraerItemListado", "tmall_fiber", { cards: items.length });
        var cardNodes = document.querySelectorAll('[class*="cardContainer--"]');
        items.forEach(function(data) {
          if (listingItems.length >= 30) return;
          var idKey = String(data.itemId);
          if (listingUrls.has(idKey)) return;
          listingUrls.add(idKey);
          var url = data.itemUrl || ("https://detail.tmall.com/item.htm?id=" + data.itemId);
          var cardEl = cardNodes[data.index] || firstCard;
          listingItems.push({ title: data.title || "", url: url, image: data.image || "", price: extraerPrecioCard(cardEl), source: "tmall_fiber" });
        });
        bscLog("extraerItemListado", "tmall_result", { total: listingItems.length });
        if (listingItems.length > 0) chrome.runtime.sendMessage({ action: "update_badge", count: listingItems.length });
        if (listingItems.length >= 30) { detenerListingObserver(); console.log("[BSC] listing: limite de 30 items alcanzado, observer detenido"); }
        return;
      }
      bscLog("extraerItemListado", "MainWorld failed or empty, falling back to classic");
      extraerItemListadoClassic();
    });
    return;
  }
  bscLog("extraerItemListado", "no firstCard found, using classic");
  extraerItemListadoClassic();
}

function extraerItemListadoClassic() {
  var selectors = ['[class*="item--"]', '[class*="Card--"]', '[class*="product--"]', ".item", ".product"];
  selectors.forEach(function(sel) {
    if (listingItems.length >= 30) return;
    document.querySelectorAll(sel).forEach(function(el) {
      if (listingItems.length >= 30) return;
      var link = el.querySelector("a[href]") || el.closest("a[href]");
      if (!link) return;
      var url = link.href;
      var baseUrl = url.split("?")[0];
      if (listingUrls.has(baseUrl)) return;
      listingUrls.add(baseUrl);
      var titleEl = el.querySelector('[class*="title--"], [class*="name--"], h3, h4');
      var priceEl = el.querySelector('[class*="price--"]');
      var imgEl = el.querySelector("img");
      listingItems.push({ title: titleEl ? titleEl.innerText.trim() : "", url: url, image: imgEl ? (imgEl.src || imgEl.getAttribute("placeholder") || "") : "", price: priceEl ? priceEl.innerText.trim() : "", source: "classic" });
    });
  });
  bscLog("extraerItemListado", "classic_result", { total: listingItems.length });
}

function procesarMutaciones() {
  if (_bscExtracting) return;
  if (listingItems.length >= 30) return;
  var cards = document.querySelectorAll('[class*="cardContainer--"]');
  if (cards.length > 0) {
    bscLog("listing", "procesarMutaciones llamado", { total: listingItems.length, cards: cards.length, url: location.href });
    extraerItemListado();
  }
}

function iniciarListingObserver() {
  if (listingObserver) return;
  var target = document.querySelector('[class*="itemsContainer--"]') ||
    document.querySelector('[class*="itemList--"], [class*="ItemList--"], [class*="productList--"], [class*="waterfall--"], [class*="Waterfall--"], #J_itemList, .J_ItemList, [class*="shopItemList"], [class*="searchResultList"]') ||
    document.body;
  bscLog('listing', 'observer iniciado en: ' + (target.className || 'body').slice(0, 80));
  listingObserver = new MutationObserver(function() {
    clearTimeout(listingDebounceTimer);
    listingDebounceTimer = setTimeout(procesarMutaciones, 300);
  });
  listingObserver.observe(target, { childList: true, subtree: true });
  procesarMutaciones();
  console.log('[BSC] listing observer activo en:', target.className || 'body');
}

function detenerListingObserver() {
  if (listingObserver) { listingObserver.disconnect(); listingObserver = null; console.log('[BSC] listing observer detenido'); }
}

function obtenerDatosListado() { return { items: listingItems, total: listingItems.length }; }

function limpiarListado() {
  listingItems = []; listingUrls = new Set();
  chrome.runtime.sendMessage({ action: 'update_badge', count: 0 });
  return { status: 'ok', cleared: true };
}

function detectarPaginaListado() {
  var url = window.location.href;
  var esListado = false; var enlacesItem = 0; var detalle = "";
  if (/shop\/view_shop\.htm/i.test(url) || /search.*\.htm/i.test(url) || /list.*\.htm/i.test(url)) {
    esListado = true;
    enlacesItem = document.querySelectorAll('a[href*="item.taobao.com"], a[href*="detail.tmall.com"], a[href*="1688.com/offer"]').length;
    detalle = enlacesItem > 0 ? ("Pagina de listado con " + enlacesItem + " enlaces") : "Pagina de productos de la tienda";
  }
  return { es_listado: esListado, enlaces_item: enlacesItem, detalle: detalle };
}

// ============================================================
// SCROLL AUTOMATICO
// ============================================================
function autoScroll() {
  return new Promise(function(resolve) {
    var duracion = 20000;
    var intervalo = 120;
    var pasos = duracion / intervalo;
    var alturaTotal = Math.max(document.body.scrollHeight, 4000);
    var distPorPaso = alturaTotal / pasos;
    var scrollActual = 0;
    var paso = 0;

    var ind = document.createElement("div");
    ind.id = "__bc_scroll_ind__";
    ind.style.cssText = "position:fixed;bottom:20px;right:20px;z-index:2147483647;background:linear-gradient(135deg,#1a0033,#3b0066);color:#e0aaff;font-family:monospace;font-size:12px;padding:10px 16px;border-radius:12px;border:1px solid #8a2be2;box-shadow:0 0 20px rgba(138,43,226,0.5);min-width:180px;text-align:center;line-height:1.8;";
    ind.innerHTML = "Escaneando...<br><b id='__bc_t__'>20s</b> restantes";
    document.body.appendChild(ind);

    var timer = setInterval(function() {
      paso++;
      scrollActual += distPorPaso;
      window.scrollTo(0, Math.max(0, scrollActual));
      var restantes = Math.max(0, Math.ceil((pasos - paso) * intervalo / 1000));
      var tel = document.getElementById("__bc_t__");
      if (tel) tel.textContent = restantes + "s";
      if (paso >= pasos) {
        clearInterval(timer);
        window.scrollTo(0, 0);
        var el2 = document.getElementById("__bc_scroll_ind__");
        if (el2) el2.remove();
        resolve({ status: "ok", details: "Scroll completo (20s) - contenido cargado" });
      }
    }, intervalo);
  });
}

// ============================================================
// EXTRACCION DE DATOS BASICOS DEL PRODUCTO
// ============================================================
function esPaginaFichaProducto() {
  var u = window.location.href;
  if (/\/item\.htm/i.test(u)) return true;
  
  try {
    const { hostname, pathname } = new URL(u);
    if (/(^|\.)tmall\.(com|hk)$/i.test(hostname) && pathname.includes('/item')) return true;
    if (/(^|\.)((taobao|tmall)\.com)$/i.test(hostname) && pathname.includes('/item')) return true;
  } catch { /* URL inválida — ignorar */ }
  
  if (document.querySelector("#SkuPanel_tbpcDetail_ssr2025, #tbpcDetail_SkuPanelBody")) return true;
  return false;
}

function nodoZonaDerecha() {
  return document.querySelector(
    "[class*='rightWrap--'],[class*='RightWrap--'],[class*='rightContent--']," +
    "#J_DetailMeta,[class*='DetailMeta'],[class*='PurchasePanel']," +
    "[class*='SkuPanel_tbpcDetail'],#tbpcDetail_SkuPanelBody"
  );
}

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
      if (!t || /^[:\s]+$/.test(t)) continue;
      addLinea(t.split("\n")[0]);
    }
    return lineas.join(" | ");
  } catch(e) { return ""; }
}

function extraerDatosBasicos() {
  try {
    var zona = nodoZonaDerecha() || document.body;

    var tituloEl = zona.querySelector(
      "[class*='mainTitle--'],[class*='MainTitle--'],[class*='title--'],[class*='Title--']," +
      "#J_Title h1, .tb-main-title, h1"
    );
    var titulo = tituloEl ? tituloEl.innerText.trim() : document.title;

    // Intentar primero selectores específicos del DOM actual de Tmall 2025/2026
    var precioEl = zona.querySelector(
      ".trade-price-integer, [class*='trade-price-integer']," +
      "[class*='priceText--'],[class*='PriceText--']," +
      "[class*='itemPrice--'],[class*='ItemPrice--']," +
      "#J_PromoPriceNum,.tb-rmb-num,.J_price"
    );
    // Fallback: buscar el símbolo ¥ y tomar el número siguiente
    if (!precioEl) {
      var symbolEl = zona.querySelector(".trade-price-symbol, [class*='trade-price-symbol']");
      if (symbolEl && symbolEl.nextElementSibling) {
        precioEl = symbolEl.nextElementSibling;
      }
    }
    // Fallback global si no está en zona derecha
    if (!precioEl) {
      precioEl = document.querySelector(
        ".trade-price-integer, [class*='trade-price-integer']," +
        ".trade-price-container [class*='price']"
      );
    }
    var precio = precioEl ? precioEl.innerText.replace(/\s+/g, ' ').trim() : "";

    var tiendaEl = document.querySelector(
      "[class*='shopName--'],[class*='ShopName--'],.spm-anchor-id[data-spm='shopname']," +
      "#J_ShopInfo .tb-shop-name, .shop-name"
    );
    var tienda = tiendaEl ? tiendaEl.innerText.trim() : "";

    var ventasEl = zona.querySelector(
      "[class*='sold--'],[class*='Sold--'],[class*='saleCount--'],[class*='tradeCount--']," +
      "#J_SaleCount,.tb-trade-count"
    );
    var ventas = ventasEl ? ventasEl.innerText.trim() : "";

    var ratingEl = document.querySelector(
      "[class*='rateScore--'],[class*='RateScore--'],[class*='rating--'],.tb-rate-info"
    );
    var rating = ratingEl ? ratingEl.innerText.trim() : "";

    var specs = extraerParametrosProducto();

    var resultado = {
      titulo: titulo,
      precio: precio,
      tienda: tienda,
      ventas: ventas,
      rating: rating,
      specs: specs,
      url: window.location.href
    };

    datosExtraidos = Object.assign(datosExtraidos, resultado);
    bscLog("get_basic_data", "extraido", { titulo: titulo, precio: precio });
    return { status: "ok", details: titulo ? titulo.slice(0, 60) + "..." : "Datos extraidos", data: resultado };
  } catch(e) {
    return { status: "error", details: "Error extrayendo datos: " + e.message };
  }
}

// ============================================================
// EXTRACCION DE MEDIA (IMAGENES Y VIDEO)
// ============================================================
function encontrarPanelProducto() {
  return document.querySelector(
    "[class*='mainPicWrapper--'],[class*='MainPicWrapper--'],[class*='leftWrap--'],[class*='LeftWrap--']," +
    "#J_ImgBooth,#J_MainImg,.tb-booth,.J_Booth"
  );
}

function extraerImagenes() {
  var imgs = new Set();
  var panelIzq = encontrarPanelProducto() || document.body;

  // 1. Thumbnails — upgrade a HD
  var thumbSelectors = [
    "[class*='thumb--'] img", "[class*='Thumb--'] img",
    "[class*='picItem--'] img", "[class*='imgItem--'] img",
    "#J_Slides li img", ".tb-thumb img",
    "[class*='imageList--'] img", "[class*='ImageList--'] img",
    "[class*='slide--'] img", "[class*='Slide--'] img"
  ];
  panelIzq.querySelectorAll(thumbSelectors.join(",")).forEach(function(img) {
    var src = img.getAttribute("data-src") || img.getAttribute("data-lazy-src") || img.src || "";
    src = limpiarUrlImagen(src);
    if (src) imgs.add(src);
  });

  // 2. Imagen principal
  var mainSelectors = [
    "[class*='mainImg--'] img", "[class*='MainImg--'] img",
    "[class*='mainPic--'] img", "[class*='MainPic--'] img",
    "#J_MainImg img", ".tb-booth-img img"
  ];
  panelIzq.querySelectorAll(mainSelectors.join(",")).forEach(function(img) {
    var src = img.getAttribute("data-src") || img.src || "";
    src = limpiarUrlImagen(src);
    if (src) imgs.add(src);
  });

  // 3. Fallback: todas las alicdn > 300px
  if (imgs.size < 3) {
    document.querySelectorAll("img").forEach(function(img) {
      var src = img.getAttribute("data-src") || img.src || "";
      if (esUrlImagenPermitida(src) && img.naturalWidth > 300) {
        src = limpiarUrlImagen(src);
        if (src) imgs.add(src);
      }
    });
  }

  return Array.from(imgs);
}

//FIX #31: usar URL parsing real, no substring
function limpiarUrlImagen(src) {
  if (!src) return "";
  try {
    var parsed = new URL(src);
    // Solo permitir http y https — nunca data:, javascript:, etc.
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return "";
  } catch (e) {
    return ""; // URL malformada
  }
  src = src.split("?")[0];
  src = src.replace(/(\.jpg|\.png|\.webp).*$/i, "$1");
  src = src.replace(/\.webp$/i, ".jpg");
  return src;
}

function extraerVideo() {
  // 1. Video element directo
  var videoEl = document.querySelector(
    "[class*='mainVideo--'] video, [class*='MainVideo--'] video," +
    "[class*='video--'] video, #J_VideoBox video, .tb-video video," +
    "video[src*='alicdn'], video[src*='taobao']"
  );
  if (videoEl && videoEl.src) return videoEl.src;
  if (videoEl && videoEl.querySelector) {
    var src = videoEl.querySelector("source");
    if (src && src.src) return src.src;
  }

  // 2. Source suelto
  var sourceEl = document.querySelector("video source[src]");
  if (sourceEl && sourceEl.src) return sourceEl.src;

  // FIX #50: evitar selector substring — filtrar por extensión real del atributo
var dataVideo = document.querySelector("[data-video-url]") ||
    Array.from(document.querySelectorAll("[data-src]")).find(el => {
        try {
            return new URL(el.getAttribute("data-src")).pathname.endsWith('.mp4');
        } catch(e) { return false; }
    });
if (dataVideo) {
    return dataVideo.getAttribute("data-video-url") || dataVideo.getAttribute("data-src") || "";
}

  // 4. Buscar en scripts inline
  var scripts = document.querySelectorAll("script:not([src])");
  for (var i = 0; i < scripts.length; i++) {
    var txt = scripts[i].textContent || "";
    var match = txt.match(/https?:\/\/[^"'\s]+\.mp4[^"'\s]*/);
    if (match) return match[0];
  }

  return "";
}

function extraerMedia() {
  try {
    var imagenes = extraerImagenes();
    console.log("📸 [BSC] URLs:", JSON.stringify(imagenes));
    var video = extraerVideo();

    datosExtraidos.imagenes = imagenes;
    datosExtraidos.video = video;

    bscLog("get_media", "extraido", { imagenes: imagenes.length, video: !!video });
    return {
      status: "ok",
      details: imagenes.length + " imagenes" + (video ? " + video" : ""),
      data: { imagenes: imagenes, video: video }
    };
  } catch(e) {
    console.error("❌ [BSC] Error en extraerMedia:", e);
    return { status: "error", details: "Error extrayendo media: " + e.message };
  }
}
// ============================================================
// DETECCION DE PAGINACION
// ============================================================
function detectarPaginacion() {
  try {
    var btnNext = document.querySelector(
      "[class*='next--'],[class*='Next--'],[class*='nextPage--']," +
      ".J_nextPage, #J_nextPage, [aria-label='Next'], [title='下一页']," +
      "a[class*='next']:not([disabled]), button[class*='next']:not([disabled])"
    );
    var hayPaginacion = !!(btnNext && !btnNext.disabled && !btnNext.classList.contains('disabled'));
    bscLog("detect_pagination", "resultado", { hayPaginacion: hayPaginacion });
    return {
      status: "ok",
      details: hayPaginacion ? "Paginacion detectada - hay pagina siguiente" : "No hay pagina siguiente",
      data: { hayPaginacion: hayPaginacion }
    };
  } catch(e) {
    return { status: "error", details: "Error detectando paginacion: " + e.message };
  }
}

// ============================================================
// SELECTOR VISUAL
// ============================================================
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
  tooltipEl.innerHTML = "SELECCIONA: <b style='color:#da8fff'>" + etiqueta + "</b> &nbsp;·&nbsp; <span style='color:#aaa'>ESC para cancelar</span>";
  document.body.appendChild(tooltipEl);
  document.addEventListener("mouseover", resaltarElemento, true);
  document.addEventListener("click", seleccionarElemento, true);
  document.addEventListener("keydown", cancelarSelector, true);
}

function desactivarModoSelector() {
  modoSelector = false;
  if (overlay) { overlay.remove(); overlay = null; }
  if (tooltipEl) { tooltipEl.remove(); tooltipEl = null; }
  if (resaltadoActual) { resaltadoActual.style.outline = ""; resaltadoActual = null; }
  document.removeEventListener("mouseover", resaltarElemento, true);
  document.removeEventListener("click", seleccionarElemento, true);
  document.removeEventListener("keydown", cancelarSelector, true);
}

function resaltarElemento(e) {
  if (!modoSelector || (e.target.id && e.target.id.startsWith("__bc_"))) return;
  if (resaltadoActual && resaltadoActual !== e.target) { resaltadoActual.style.outline = ""; }
  resaltadoActual = e.target;
  resaltadoActual.style.outline = "2px solid #8a2be2";
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

// ============================================================
// EXTRACCION CON SCHEMA PERSONALIZADO
// ============================================================
function extraerConSchema(campos) {
  var resultado = {};
  try {
    Object.keys(campos).forEach(function(nombre) {
      var campo = campos[nombre];
      var sel = campo.selector || campo;
      var tipo = campo.tipo || "texto";
      var els = document.querySelectorAll(sel);
      if (els.length === 0) { resultado[nombre] = ""; return; }
      if (tipo === "lista") {
        resultado[nombre] = Array.from(els).map(function(e) { return e.innerText.trim(); }).filter(Boolean);
      } else if (tipo === "imagen") {
        resultado[nombre] = Array.from(els).map(function(e) { return e.src || e.getAttribute("data-src") || ""; }).filter(Boolean);
      } else if (tipo === "enlace") {
        resultado[nombre] = Array.from(els).map(function(e) { return e.href || ""; }).filter(Boolean);
      } else {
        resultado[nombre] = els[0].innerText.trim();
      }
    });
    datosExtraidos.custom = resultado;
    return { status: "ok", details: Object.keys(resultado).length + " campos extraidos", data: resultado };
  } catch(e) {
    return { status: "error", details: "Error en schema: " + e.message };
  }
}

// ============================================================
// OCR (placeholder - requiere Tesseract cargado)
// ============================================================
function iniciarOCR() {
  return { status: "ok", details: "OCR iniciado - puede tardar hasta 6 minutos", data: {} };
}

// ============================================================
// INICIO AUTOMATICO
// ============================================================
(function() {
  var res = detectarPaginaListado();
  bscLog('listing', 'detectarPaginaListado result', res);
  if (res && res.es_listado) { iniciarListingObserver(); }
})();

// ============================================================
// MESSAGE HANDLER
// ============================================================
chrome.runtime.onMessage.addListener(function(message, sender, reply) {
  try {
    var act = message.action;

    // Listado
    if (act === 'get_listing_data') { reply(obtenerDatosListado()); return true; }
    if (act === 'clear_listing') { reply(limpiarListado()); return true; }
    if (act === 'start_listing_observer') { iniciarListingObserver(); reply({ status: 'ok', activo: true }); return true; }
    if (act === 'detect_listing') {
      var resListado = detectarPaginaListado();
      reply({ status: 'ok', details: resListado.detalle || "Deteccion completa", data: resListado });
      return true;
    }
    if (act === 'scan_listing') { extraerItemListado(); reply({ status: 'ok', details: 'Escaneo iniciado' }); return true; }

    // Extractor principal
    if (act === 'do_scroll') {
      autoScroll().then(function(res) { reply(res); });
      return true;
    }
    if (act === 'get_basic_data') { reply(extraerDatosBasicos()); return true; }
    if (act === 'get_media') { reply(extraerMedia()); return true; }
    if (act === 'detect_pagination') { reply(detectarPaginacion()); return true; }
    if (act === 'do_ocr') { reply(iniciarOCR()); return true; }

    // Selector visual
    if (act === 'activar_selector') {
      activarModoSelector(message.etiqueta || "campo");
      reply({ status: 'ok' });
      return true;
    }
    if (act === 'desactivar_selector') { desactivarModoSelector(); reply({ status: 'ok' }); return true; }

    // Schema personalizado — nombre original Y alias del popup
    if (act === 'extraer_schema' || act === 'extract_with_schema') {
      reply(extraerConSchema(message.campos || message.esquema || {}));
      return true;
    }

    // Datos acumulados — nombre original
    if (act === 'get_datos_extraidos') { reply({ status: 'ok', data: datosExtraidos }); return true; }
    if (act === 'reset_datos') { datosExtraidos = {}; reply({ status: 'ok' }); return true; }

    // ── ALIASES FALTANTES — lo que popup.js realmente envía ──

    // get_all_data: consolida todo para preview, export JSON/CSV y datasetup
    if (act === 'get_all_data') {
      var all = {
        nombre:         datosExtraidos.titulo  || '',
        titulo:         datosExtraidos.titulo  || '',
        precio:         datosExtraidos.precio  || '',
        tienda:         datosExtraidos.tienda  || '',
        calificaciones: datosExtraidos.rating  || '',
        rating:         datosExtraidos.rating  || '',
        ventas:         datosExtraidos.ventas  || '',
        specs:          datosExtraidos.specs   ? datosExtraidos.specs.split(' | ') : [],
        url:            datosExtraidos.url     || window.location.href,
        sitio:          window.location.hostname,
        imagenes:       datosExtraidos.imagenes || [],
        video:          datosExtraidos.video   || '',
        datos_custom:   datosExtraidos.custom  || {},
        variantes:      datosExtraidos.variantes       || [],
        imagenesPorColor: datosExtraidos.imagenesPorColor || {},
        imagenes_variantes:    datosExtraidos.imagenes_variantes    || [],
        imagenes_descripcion:  datosExtraidos.imagenes_descripcion  || [],
        imagenes_galeria_notion: datosExtraidos.imagenes_galeria_notion || '',
        descripcion:    datosExtraidos.descripcion || '',
        categoria_notion: datosExtraidos.categoria_notion || '',
        tienda_recomendados: datosExtraidos.tienda_recomendados || [],
        listado: listingItems.map(function(item) {
          return {
            nombre:      item.title  || item.nombre  || '',
            titulo:      item.title  || '',
            precio:      item.price  || item.precio  || '',
            url:         item.url    || '',
            imagen:      item.image  || item.imagen  || '',
            tienda:      item.source || ''
          };
        }),
        timestamp: Date.now()
      };
      reply(all);
      return true;
    }

    // reset_data: alias de reset_datos
    if (act === 'reset_data') {
      datosExtraidos = {};
      reply({ status: 'ok' });
      return true;
    }

    // detect_listing_page: alias de detect_listing con campos que popup espera
    if (act === 'detect_listing_page') {
      var resDetectPage = detectarPaginaListado();
      reply({
        esListado:    resDetectPage.es_listado,
        enlacesItem:  resDetectPage.enlaces_item,
        detalle:      resDetectPage.detalle
      });
      return true;
    }

    reply({ status: "error", details: "Accion no reconocida: " + act });
  } catch (handlerErr) {
    reply({ status: "error", details: String(handlerErr && handlerErr.message) });
  }
  return false;
});

bscLog('content_script', 'injected', { url: window.location.href });