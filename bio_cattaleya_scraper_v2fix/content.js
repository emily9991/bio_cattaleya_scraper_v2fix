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
  } catch (e) { return false; }
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
// LISTING
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
    var items = (typeof e.detail === 'string') ? JSON.parse(e.detail) : e.detail;
    callback(items);
  }, { once: true });
  chrome.runtime.sendMessage({ action: 'execute_mainworld', eventName: eventName });
}

function extraerItemListado() {
  bscLog("extraerItemListado", "function called", { url: location.href });
  var firstCard = document.querySelector('[class*="cardContainer--"]');
  if (firstCard) {
    _bscExtracting = true;
    extraerItemListadoMainWorld(function(items) {
      _bscExtracting = false;
      if (items && items.length > 0) {
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
        if (listingItems.length > 0) chrome.runtime.sendMessage({ action: "update_badge", count: listingItems.length });
        if (listingItems.length >= 30) { detenerListingObserver(); }
        return;
      }
      extraerItemListadoClassic();
    });
    return;
  }
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
      var imgEl   = el.querySelector("img");
      listingItems.push({
        title: titleEl ? titleEl.innerText.trim() : "",
        url: url,
        image: imgEl ? (imgEl.src || imgEl.getAttribute("placeholder") || "") : "",
        price: priceEl ? priceEl.innerText.trim() : "",
        source: "classic"
      });
    });
  });
}

function procesarMutaciones() {
  if (_bscExtracting) return;
  if (listingItems.length >= 30) return;
  var cards = document.querySelectorAll('[class*="cardContainer--"]');
  if (cards.length > 0) extraerItemListado();
}

function iniciarListingObserver() {
  if (listingObserver) return;
  var target = document.querySelector('[class*="itemsContainer--"]') ||
    document.querySelector('[class*="itemList--"],[class*="ItemList--"],[class*="productList--"],[class*="waterfall--"],[class*="Waterfall--"],#J_itemList,.J_ItemList,[class*="shopItemList"],[class*="searchResultList"]') ||
    document.body;
  listingObserver = new MutationObserver(function() {
    clearTimeout(listingDebounceTimer);
    listingDebounceTimer = setTimeout(procesarMutaciones, 300);
  });
  listingObserver.observe(target, { childList: true, subtree: true });
  procesarMutaciones();
}

function detenerListingObserver() {
  if (listingObserver) { listingObserver.disconnect(); listingObserver = null; }
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
    enlacesItem = document.querySelectorAll('a[href*="item.taobao.com"],a[href*="detail.tmall.com"],a[href*="1688.com/offer"]').length;
    detalle = enlacesItem > 0 ? ("Pagina de listado con " + enlacesItem + " enlaces") : "Pagina de productos de la tienda";
  }
  return { es_listado: esListado, enlaces_item: enlacesItem, detalle: detalle };
}

// ============================================================
// SCROLL AUTOMATICO
// ============================================================
function autoScroll() {
  return new Promise(function(resolve) {
    var duracion   = 20000;
    var intervalo  = 120;
    var pasos      = duracion / intervalo;
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
// EXTRACCION PARAMETROS 参数信息
// ============================================================
function extraerParametrosEstructurados() {
  /**
   * Lee todos los pares label/valor de 参数信息.
   * Usa el atributo title (siempre en chino original)
   * para que funcione igual con la página traducida o no.
   * Retorna: { sku, parametros: [{label, valor}], texto }
   */
  var resultado = { sku: '', parametros: [], texto: '' };

  // Selectores robustos para el contenedor de parámetros
  var labels = document.querySelectorAll('[class*="generalParamsInfoItemTitle--"]');
  var values = document.querySelectorAll('[class*="generalParamsInfoItemSubTitle--"]');

  // Fallback: tablas de parámetros legacy
  if (labels.length === 0) {
    labels = document.querySelectorAll('#J_AttrUL li .attrKey, [class*="AttrList"] .key, [class*="paramsTable"] th');
    values = document.querySelectorAll('#J_AttrUL li .attrVal, [class*="AttrList"] .val, [class*="paramsTable"] td');
  }

  var pares = [];
  var len = Math.min(labels.length, values.length);

  for (var i = 0; i < len; i++) {
    // Usar atributo title (chino original) — ignorar texto visible que puede estar traducido
    var labelRaw = (labels[i].getAttribute('title') || labels[i].innerText || '').trim();
    var valorRaw = (values[i].getAttribute('title') || values[i].innerText || '').trim();

    if (!labelRaw || !valorRaw) continue;

    pares.push({ label: labelRaw, valor: valorRaw });

    // Detectar SKU — 货号 es el campo estándar en Tmall
    if (labelRaw === '货号' || labelRaw === '商品编号' || /SKU|Item\s*No|货号/i.test(labelRaw)) {
      resultado.sku = valorRaw;
    }
  }

  resultado.parametros = pares;

  // Construir texto formateado para el campo Descripción
  resultado.texto = pares.map(function(p) {
    return p.label + ': ' + p.valor;
  }).join('\n');

  bscLog('extraerParametrosEstructurados', 'resultado', {
    sku: resultado.sku,
    pares: pares.length
  });

  return resultado;
}

// ============================================================
// EXTRACCION IMAGENES DESCRIPCION 图文详情
// ============================================================
function extraerImagenesDescripcion() {
  /**
   * Captura las imágenes de la sección 图文详情 (descripción gráfica).
   * Selector principal: .descV8-singleImage-image con data-name="singleImage"
   * Estas son las imágenes con texto chino sobre ingredientes, especificaciones, etc.
   */
  var imgs = new Set();

  // Selector principal — confirmado por inspección
  document.querySelectorAll('img.descV8-singleImage-image[data-name="singleImage"]').forEach(function(img) {
    var src = img.getAttribute('data-src') || img.getAttribute('src') || '';
    src = limpiarUrlImagen(src);
    if (src && esUrlImagenPermitida(src)) imgs.add(src);
  });

  // Fallback: cualquier imagen dentro del contenedor de descripción
  if (imgs.size === 0) {
    var descContainers = document.querySelectorAll(
      '[class*="descV8--"],[class*="descContainer--"],[class*="description--"],' +
      '#J_DivItemDesc,#description,.tb-detail-hd'
    );
    descContainers.forEach(function(container) {
      container.querySelectorAll('img').forEach(function(img) {
        var src = img.getAttribute('data-src') || img.getAttribute('src') || '';
        src = limpiarUrlImagen(src);
        if (src && esUrlImagenPermitida(src)) imgs.add(src);
      });
    });
  }

  var resultado = Array.from(imgs);
  bscLog('extraerImagenesDescripcion', 'resultado', { total: resultado.length });
  return resultado;
}

// ============================================================
// EXTRACCION DATOS BASICOS
// ============================================================
function esPaginaFichaProducto() {
  var u = window.location.href;
  if (/\/item\.htm/i.test(u)) return true;
  try {
    var parsed = new URL(u);
    var hostname = parsed.hostname;
    var pathname = parsed.pathname;
    if (/(^|\.)tmall\.(com|hk)$/i.test(hostname) && pathname.includes('/item')) return true;
    if (/(^|\.)((taobao|tmall)\.com)$/i.test(hostname) && pathname.includes('/item')) return true;
  } catch (_) {}
  if (document.querySelector("#SkuPanel_tbpcDetail_ssr2025,#tbpcDetail_SkuPanelBody")) return true;
  return false;
}

function nodoZonaDerecha() {
  return document.querySelector(
    "[class*='rightWrap--'],[class*='RightWrap--'],[class*='rightContent--']," +
    "#J_DetailMeta,[class*='DetailMeta'],[class*='PurchasePanel']," +
    "[class*='SkuPanel_tbpcDetail'],#tbpcDetail_SkuPanelBody"
  );
}

function extraerDatosBasicos() {
  try {
    var zona = nodoZonaDerecha() || document.body;

    // Título
    var tituloEl = zona.querySelector(
      "[class*='mainTitle--'],[class*='MainTitle--'],[class*='title--'],[class*='Title--']," +
      "#J_Title h1,.tb-main-title,h1"
    );
    var titulo = tituloEl ? tituloEl.innerText.trim() : document.title;

    // Precio
    var precioEl = zona.querySelector(
      ".trade-price-integer,[class*='trade-price-integer']," +
      "[class*='priceText--'],[class*='PriceText--']," +
      "[class*='itemPrice--'],[class*='ItemPrice--']," +
      "#J_PromoPriceNum,.tb-rmb-num,.J_price"
    );
    if (!precioEl) {
      var symbolEl = zona.querySelector(".trade-price-symbol,[class*='trade-price-symbol']");
      if (symbolEl && symbolEl.nextElementSibling) precioEl = symbolEl.nextElementSibling;
    }
    if (!precioEl) {
      precioEl = document.querySelector(
        ".trade-price-integer,[class*='trade-price-integer']," +
        ".trade-price-container [class*='price']"
      );
    }
    var precio = precioEl ? precioEl.innerText.replace(/\s+/g, ' ').trim() : "";

    // Tienda
    var tiendaEl = document.querySelector(
      "[class*='shopName--'],[class*='ShopName--'],.spm-anchor-id[data-spm='shopname']," +
      "#J_ShopInfo .tb-shop-name,.shop-name"
    );
    var tienda = tiendaEl ? tiendaEl.innerText.trim() : "";

    // Ventas y rating
    var ventasEl = zona.querySelector(
      "[class*='sold--'],[class*='Sold--'],[class*='saleCount--'],[class*='tradeCount--']," +
      "#J_SaleCount,.tb-trade-count"
    );
    var ventas = ventasEl ? ventasEl.innerText.trim() : "";
    var ratingEl = document.querySelector(
      "[class*='rateScore--'],[class*='RateScore--'],[class*='rating--'],.tb-rate-info"
    );
    var rating = ratingEl ? ratingEl.innerText.trim() : "";

    // ── NUEVO: 参数信息 ──────────────────────────────────────
    var params = extraerParametrosEstructurados();
    var sku    = params.sku;

    // Construir descripción: parámetros + separador
    // (OCR de 图文详情 se agrega después en do_ocr)
    var descripcionBase = params.texto;

    var resultado = {
      titulo:       titulo,
      precio:       precio,
      tienda:       tienda,
      ventas:       ventas,
      rating:       rating,
      specs:        params.texto, // compatibilidad legacy
      parametros:   params.parametros,
      sku:          sku,
      descripcion:  descripcionBase,
      url:          window.location.href
    };

    datosExtraidos = Object.assign({}, datosExtraidos, resultado);
    bscLog("get_basic_data", "extraido", { titulo: titulo, precio: precio, sku: sku });
    return {
      status:  "ok",
      details: titulo ? titulo.slice(0, 60) + "..." : "Datos extraidos",
      data:    resultado
    };
  } catch(e) {
    return { status: "error", details: "Error extrayendo datos: " + e.message };
  }
}

// ============================================================
// EXTRACCION MEDIA (IMAGENES PRODUCTO + DESCRIPCION)
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

  // 1. Thumbnails → upgrade HD
  panelIzq.querySelectorAll(
    "[class*='thumb--'] img,[class*='Thumb--'] img," +
    "[class*='picItem--'] img,[class*='imgItem--'] img," +
    "#J_Slides li img,.tb-thumb img," +
    "[class*='imageList--'] img,[class*='ImageList--'] img," +
    "[class*='slide--'] img,[class*='Slide--'] img"
  ).forEach(function(img) {
    var src = img.getAttribute("data-src") || img.getAttribute("data-lazy-src") || img.src || "";
    src = limpiarUrlImagen(src);
    if (src) imgs.add(src);
  });

  // 2. Imagen principal
  panelIzq.querySelectorAll(
    "[class*='mainImg--'] img,[class*='MainImg--'] img," +
    "[class*='mainPic--'] img,[class*='MainPic--'] img," +
    "#J_MainImg img,.tb-booth-img img"
  ).forEach(function(img) {
    var src = img.getAttribute("data-src") || img.src || "";
    src = limpiarUrlImagen(src);
    if (src) imgs.add(src);
  });

  // 3. Fallback: todas alicdn > 300px
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

// FIX #31: URL parsing real, no substring
function limpiarUrlImagen(src) {
  if (!src) return "";
  try {
    var parsed = new URL(src);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return "";
  } catch (e) { return ""; }
  src = src.split("?")[0];
  src = src.replace(/(\.jpg|\.png|\.webp).*$/i, "$1");
  src = src.replace(/\.webp$/i, ".jpg");
  return src;
}

function extraerVideo() {
  var videoEl = document.querySelector(
    "[class*='mainVideo--'] video,[class*='MainVideo--'] video," +
    "[class*='video--'] video,#J_VideoBox video,.tb-video video," +
    "video[src*='alicdn'],video[src*='taobao']"
  );
  if (videoEl && videoEl.src) return videoEl.src;
  if (videoEl) {
    var src = videoEl.querySelector("source");
    if (src && src.src) return src.src;
  }
  var sourceEl = document.querySelector("video source[src]");
  if (sourceEl && sourceEl.src) return sourceEl.src;

  // FIX #50: filtrar por extensión real
  var dataVideo = document.querySelector("[data-video-url]") ||
    Array.from(document.querySelectorAll("[data-src]")).find(function(el) {
      try { return new URL(el.getAttribute("data-src")).pathname.endsWith('.mp4'); }
      catch(e) { return false; }
    });
  if (dataVideo) return dataVideo.getAttribute("data-video-url") || dataVideo.getAttribute("data-src") || "";

  var scripts = document.querySelectorAll("script:not([src])");
  for (var i = 0; i < scripts.length; i++) {
    var txt   = scripts[i].textContent || "";
    var match = txt.match(/https?:\/\/[^"'\s]+\.mp4[^"'\s]*/);
    if (match) return match[0];
  }
  return "";
}

function extraerMedia() {
  try {
    var imagenes           = extraerImagenes();
    var video              = extraerVideo();
    // ── NUEVO: imágenes de 图文详情 ──────────────────────────
    var imagenesDescripcion = extraerImagenesDescripcion();

    datosExtraidos.imagenes            = imagenes;
    datosExtraidos.video               = video;
    datosExtraidos.imagenes_descripcion = imagenesDescripcion;

    bscLog("get_media", "extraido", {
      imagenes:            imagenes.length,
      video:               !!video,
      imagenes_descripcion: imagenesDescripcion.length
    });

    return {
      status:  "ok",
      details: imagenes.length + " imagenes" +
               (imagenesDescripcion.length ? " + " + imagenesDescripcion.length + " desc" : "") +
               (video ? " + video" : ""),
      data: {
        imagenes:            imagenes,
        video:               video,
        imagenes_descripcion: imagenesDescripcion
      }
    };
  } catch(e) {
    return { status: "error", details: "Error extrayendo media: " + e.message };
  }
}

// ============================================================
// DETECCION PAGINACION
// ============================================================
function detectarPaginacion() {
  try {
    var btnNext = document.querySelector(
      "[class*='next--'],[class*='Next--'],[class*='nextPage--']," +
      ".J_nextPage,#J_nextPage,[aria-label='Next'],[title='下一页']," +
      "a[class*='next']:not([disabled]),button[class*='next']:not([disabled])"
    );
    var hayPaginacion = !!(btnNext && !btnNext.disabled && !btnNext.classList.contains('disabled'));
    return {
      status:  "ok",
      details: hayPaginacion ? "Paginacion detectada - hay pagina siguiente" : "No hay pagina siguiente",
      data:    { hayPaginacion: hayPaginacion }
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
  overlay.style.cssText = "position:fixed;top:0;left:0;right:0;bottom:0;z-index:2147483640;pointer-events:none;background:rgba(124,58,237,0.04);";
  document.body.appendChild(overlay);

  tooltipEl = document.createElement("div");
  tooltipEl.id = "__bc_tooltip__";
  tooltipEl.style.cssText = "position:fixed;top:12px;left:50%;transform:translateX(-50%);z-index:2147483647;pointer-events:none;background:linear-gradient(135deg,#1a0033,#3b0066);color:#e0aaff;font-family:monospace;font-size:13px;padding:8px 18px;border-radius:20px;border:1px solid #8a2be2;box-shadow:0 0 20px rgba(138,43,226,0.5);";

  // FIX XSS: usar DOM API en vez de innerHTML con datos del usuario
  var prefix = document.createTextNode("SELECCIONA: ");
  var bold   = document.createElement("b");
  bold.style.color  = "#da8fff";
  bold.textContent  = etiqueta;
  var suffix = document.createTextNode(" · ESC para cancelar");
  tooltipEl.appendChild(prefix);
  tooltipEl.appendChild(bold);
  tooltipEl.appendChild(suffix);

  document.body.appendChild(tooltipEl);
  document.addEventListener("mouseover",  resaltarElemento,  true);
  document.addEventListener("click",      seleccionarElemento, true);
  document.addEventListener("keydown",    cancelarSelector,   true);
}

function desactivarModoSelector() {
  modoSelector = false;
  if (overlay)   { overlay.remove();   overlay = null; }
  if (tooltipEl) { tooltipEl.remove(); tooltipEl = null; }
  if (resaltadoActual) { resaltadoActual.style.outline = ""; resaltadoActual = null; }
  document.removeEventListener("mouseover",  resaltarElemento,   true);
  document.removeEventListener("click",      seleccionarElemento, true);
  document.removeEventListener("keydown",    cancelarSelector,    true);
}

function resaltarElemento(e) {
  if (!modoSelector || (e.target.id && e.target.id.startsWith("__bc_"))) return;
  if (resaltadoActual && resaltadoActual !== e.target) resaltadoActual.style.outline = "";
  resaltadoActual = e.target;
  resaltadoActual.style.outline = "2px solid #7c3aed";
}

function seleccionarElemento(e) {
  if (!modoSelector) return;
  e.preventDefault(); e.stopPropagation();
  var el       = e.target;
  var selector = generarSelectorOptimo(el);
  var texto    = (el.innerText && el.innerText.trim()) || el.src || el.href || "(sin texto)";
  var tipo     = detectarTipoElemento(el);
  chrome.runtime.sendMessage({
    action:   "elemento_seleccionado",
    selector: selector,
    texto:    texto.slice(0, 120),
    tipo:     tipo,
    tag:      el.tagName.toLowerCase()
  });
  el.style.outline = "3px solid #16a34a";
  setTimeout(function() { el.style.outline = ""; desactivarModoSelector(); }, 600);
}

function cancelarSelector(e) {
  if (e.key === "Escape") {
    desactivarModoSelector();
    chrome.runtime.sendMessage({ action: "selector_cancelado" });
  }
}

function generarSelectorOptimo(el) {
  if (el.id && !el.id.startsWith("__bc")) return "#" + CSS.escape(el.id);
  var clases = Array.from(el.classList).filter(function(c) {
    return !c.startsWith("__bc") && c.length > 2;
  }).slice(0, 3);
  if (clases.length > 0) {
    var sel = el.tagName.toLowerCase() + "." + clases.join(".");
    if (document.querySelectorAll(sel).length <= 10) return sel;
  }
  var path = [], current = el;
  for (var i = 0; i < 4; i++) {
    if (!current || current === document.body) break;
    var seg = current.tagName.toLowerCase();
    if (current.id) { path.unshift("#" + CSS.escape(current.id)); break; }
    var sib = Array.from(current.parentElement ? current.parentElement.children : [])
      .filter(function(c) { return c.tagName === current.tagName; });
    if (sib.length > 1) seg += ":nth-of-type(" + (sib.indexOf(current) + 1) + ")";
    path.unshift(seg);
    current = current.parentElement;
  }
  return path.join(" > ");
}

function detectarTipoElemento(el) {
  var tag = el.tagName.toLowerCase();
  if (tag === "img")   return "imagen";
  if (tag === "video") return "video";
  if (tag === "a")     return "enlace";
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
      var campo    = campos[nombre];
      var sel      = campo.selector || campo;
      var tipo     = campo.tipo || "texto";
      var els      = document.querySelectorAll(sel);
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
    // FIX: Object.assign con lista blanca implícita — no hay prototype pollution
    datosExtraidos.custom = Object.assign({}, resultado);
    return { status: "ok", details: Object.keys(resultado).length + " campos extraidos", data: resultado };
  } catch(e) {
    return { status: "error", details: "Error en schema: " + e.message };
  }
}

// ============================================================
// OCR — Tesseract chi_sim+eng en content script
// ============================================================
var tesseractWorker = null;
var tesseractListo  = false;

async function inicializarTesseract() {
  if (tesseractListo && tesseractWorker) return tesseractWorker;
  var langPath = chrome.runtime.getURL('lib/');
  tesseractWorker = await Tesseract.createWorker('chi_sim+eng', 1, {
    workerPath: chrome.runtime.getURL('lib/worker.min.js'),
    langPath:   langPath,
    corePath:   chrome.runtime.getURL('lib/tesseract-core-simd-lstm.wasm.js'),
    logger: function(m) {
      if (m.status === 'recognizing text') {
        chrome.runtime.sendMessage({
          action: 'ocr_progress',
          msg: 'Leyendo… ' + Math.round((m.progress || 0) * 100) + '%'
        }).catch(function() {});
      }
    }
  });
  tesseractListo = true;
  bscLog('tesseract', 'worker chi_sim+eng listo', {});
  return tesseractWorker;
}

async function reconocerTexto(imageData) {
  var worker = await inicializarTesseract();
  var result = await worker.recognize(imageData);
  return (result && result.data && result.data.text) ? result.data.text.trim() : '';
}

function iniciarOCR() {
  var imagenesDesc = datosExtraidos.imagenes_descripcion || [];
  if (imagenesDesc.length === 0) {
    imagenesDesc = extraerImagenesDescripcion();
    datosExtraidos.imagenes_descripcion = imagenesDesc;
  }
  bscLog('iniciarOCR', 'lanzando OCR async', { total: imagenesDesc.length });

  // Procesar en background async — notificar progreso via messages
  procesarOCRAsync(imagenesDesc);

  return {
    status:  'ok',
    details: 'OCR iniciado - puede tardar hasta 6 minutos',
    data:    { imagenes_descripcion: imagenesDesc, total: imagenesDesc.length }
  };
}

async function procesarOCRAsync(imagenes) {
  if (!imagenes || imagenes.length === 0) return;
  var limite      = Math.min(imagenes.length, 15);
  var textoTotal  = [];
  var procesadas  = 0;

  chrome.runtime.sendMessage({
    action: 'ocr_progress',
    msg: 'Iniciando OCR — ' + limite + ' imágenes de descripción'
  }).catch(function() {});

  try {
    await inicializarTesseract();
  } catch(e) {
    chrome.runtime.sendMessage({
      action: 'ocr_progress',
      msg: '❌ Error iniciando Tesseract: ' + e.message
    }).catch(function() {});
    return;
  }

  for (var i = 0; i < limite; i++) {
    var url = imagenes[i];
    chrome.runtime.sendMessage({
      action: 'ocr_progress',
      msg: 'Imagen ' + (i + 1) + '/' + limite + '…'
    }).catch(function() {});

    try {
      // Obtener base64 via background
      var b64 = await new Promise(function(resolve) {
        chrome.runtime.sendMessage({ action: 'fetch_image_b64', url: url }, function(res) {
          resolve(res && res.b64 ? res.b64 : null);
        });
      });

      if (!b64) {
        chrome.runtime.sendMessage({
          action: 'ocr_progress',
          msg: '⚠️ Img ' + (i + 1) + ' no disponible'
        }).catch(function() {});
        continue;
      }

      var texto = await reconocerTexto(b64);

      if (texto && texto.length > 3) {
        textoTotal.push(texto);
        procesadas++;
        chrome.runtime.sendMessage({
          action: 'ocr_progress',
          msg: '✓ Img ' + (i + 1) + ' — ' + texto.slice(0, 40) + '…'
        }).catch(function() {});
      } else {
        chrome.runtime.sendMessage({
          action: 'ocr_progress',
          msg: '— Img ' + (i + 1) + ' sin texto'
        }).catch(function() {});
      }
    } catch(e) {
      chrome.runtime.sendMessage({
        action: 'ocr_progress',
        msg: '❌ Img ' + (i + 1) + ': ' + e.message
      }).catch(function() {});
    }
  }

  var textoFinal = textoTotal.join('\n\n');

  // Guardar en datosExtraidos
  datosExtraidos.descripcion_ocr = textoFinal;
  var descParams = (datosExtraidos.descripcion || '').split('\n────────────────────')[0];
  if (textoFinal) {
    datosExtraidos.descripcion = descParams + '\n────────────────────\n' + textoFinal;
  }

  chrome.runtime.sendMessage({
    action: 'ocr_progress',
    msg: '✅ OCR listo — ' + procesadas + '/' + limite + ' imágenes con texto'
  }).catch(function() {});

  bscLog('procesarOCRAsync', 'completado', { procesadas: procesadas, chars: textoFinal.length });
}

// ============================================================
// INICIO AUTOMATICO
// ============================================================
(function() {
  var res = detectarPaginaListado();
  if (res && res.es_listado) iniciarListingObserver();
})();

// ============================================================
// MESSAGE HANDLER
// ============================================================
chrome.runtime.onMessage.addListener(function(message, sender, reply) {
  try {
    var act = message.action;

    // Listado
    if (act === 'get_listing_data')       { reply(obtenerDatosListado()); return true; }
    if (act === 'clear_listing')          { reply(limpiarListado()); return true; }
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
    if (act === 'get_basic_data')    { reply(extraerDatosBasicos()); return true; }
    if (act === 'get_media')         { reply(extraerMedia()); return true; }
    if (act === 'detect_pagination') { reply(detectarPaginacion()); return true; }
    if (act === 'do_ocr') { reply(iniciarOCR()); return true; }

    if (act === 'run_tesseract') {
      reconocerTexto(message.imageData)
        .then(function(texto) { reply({ status: 'ok', texto: texto }); })
        .catch(function(e)    { reply({ status: 'error', texto: '', details: e.message }); });
      return true;
    }

    if (act === 'save_ocr_result') {
      datosExtraidos.descripcion_ocr = message.texto || '';
      var descBase = (datosExtraidos.descripcion || '').split('\n────────────────────')[0];
      if (message.texto) {
        datosExtraidos.descripcion = descBase + '\n────────────────────\n' + message.texto;
      }
      reply({ status: 'ok' });
      return true;
    }

    // Selector visual
    if (act === 'activar_selector') {
      activarModoSelector(message.etiqueta || "campo");
      reply({ status: 'ok' });
      return true;
    }
    if (act === 'desactivar_selector') { desactivarModoSelector(); reply({ status: 'ok' }); return true; }

    // Schema personalizado
    if (act === 'extraer_schema' || act === 'extract_with_schema') {
      reply(extraerConSchema(message.campos || message.esquema || {}));
      return true;
    }

    // Datos acumulados
    if (act === 'get_datos_extraidos') { reply({ status: 'ok', data: datosExtraidos }); return true; }
    if (act === 'reset_datos')         { datosExtraidos = {}; reply({ status: 'ok' }); return true; }

    // ── get_all_data ─────────────────────────────────────────
    if (act === 'get_all_data') {
      // Construir descripción combinada:
      // Bloque 1: parámetros (参数信息)
      // Separador: ────────────────────
      // Bloque 2: texto OCR de 图文详情 (en chino, sin traducir)
      var descParams = datosExtraidos.descripcion || '';
      var descOcr    = datosExtraidos.descripcion_ocr || '';
      var descripcionFinal = descParams;
      if (descOcr) {
        descripcionFinal += '\n────────────────────\n' + descOcr;
      }

      var all = {
        nombre:               datosExtraidos.titulo        || '',
        titulo:               datosExtraidos.titulo        || '',
        precio:               datosExtraidos.precio        || '',
        tienda:               datosExtraidos.tienda        || '',
        calificaciones:       datosExtraidos.rating        || '',
        rating:               datosExtraidos.rating        || '',
        ventas:               datosExtraidos.ventas        || '',
        specs:                datosExtraidos.parametros
                                ? datosExtraidos.parametros.map(function(p) { return p.label + ': ' + p.valor; })
                                : (datosExtraidos.specs ? datosExtraidos.specs.split(' | ') : []),
        parametros:           datosExtraidos.parametros    || [],
        sku:                  datosExtraidos.sku           || '',
        descripcion:          descripcionFinal,
        url:                  datosExtraidos.url           || window.location.href,
        sitio:                window.location.hostname,
        imagenes:             datosExtraidos.imagenes      || [],
        video:                datosExtraidos.video         || '',
        imagenes_descripcion: datosExtraidos.imagenes_descripcion || [],
        descripcion_ocr:      descOcr,
        datos_custom:         datosExtraidos.custom        || {},
        variantes:            datosExtraidos.variantes     || [],
        imagenesPorColor:     datosExtraidos.imagenesPorColor || {},
        imagenes_variantes:   datosExtraidos.imagenes_variantes || [],
        imagenes_galeria_notion: datosExtraidos.imagenes_galeria_notion || '',
        categoria_notion:     datosExtraidos.categoria_notion || '',
        tienda_recomendados:  datosExtraidos.tienda_recomendados || [],
        tallas:               datosExtraidos.tallas        || [],
        colores:              datosExtraidos.colores        || [],
        kits:                 datosExtraidos.kits           || [],
        listado: listingItems.map(function(item) {
          return {
            nombre:  item.title  || item.nombre  || '',
            titulo:  item.title  || '',
            precio:  item.price  || item.precio  || '',
            url:     item.url    || '',
            imagen:  item.image  || item.imagen  || '',
            tienda:  item.source || ''
          };
        }),
        timestamp: Date.now()
      };
      reply(all);
      return true;
    }

    // reset_data
    if (act === 'reset_data') { datosExtraidos = {}; reply({ status: 'ok' }); return true; }

    // detect_listing_page
    if (act === 'detect_listing_page') {
      var resDetect = detectarPaginaListado();
      reply({ esListado: resDetect.es_listado, enlacesItem: resDetect.enlaces_item, detalle: resDetect.detalle });
      return true;
    }

    reply({ status: "error", details: "Accion no reconocida: " + act });
  } catch (handlerErr) {
    reply({ status: "error", details: String(handlerErr && handlerErr.message) });
  }
  return false;
});

bscLog('content_script', 'injected', { url: window.location.href });