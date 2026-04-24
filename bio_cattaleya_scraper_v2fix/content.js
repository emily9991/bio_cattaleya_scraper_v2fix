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
var listingItems = [];
var listingUrls = new Set();
var listingObserver = null;
var listingDebounceTimer = null;
var _bscExtracting = false;
function extraerPrecioCard(card) {
  var priceEl = card.querySelector('[class*="price--"], [class*="priceContainer--"]');
  if (!priceEl) return '';
  return priceEl.innerText.replace(/\s+/g, ' ').trim();
}
function extraerItemListadoMainWorld(callback) {
  var eventName = 'bsc_mainworld_response_' + Date.now();
  window.addEventListener(eventName, function(e) { callback(e.detail); }, { once: true });
  chrome.runtime.sendMessage({ action: "execute_mainworld", eventName: eventName });
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
(function() {
  var res = detectarPaginaListado();
  bscLog('listing', 'detectarPaginaListado result', res);
  if (res && res.es_listado) { iniciarListingObserver(); }
})();
chrome.runtime.onMessage.addListener(function(message, sender, reply) {
  try {
    var act = message.action;
    if (act === 'get_listing_data') { reply(obtenerDatosListado()); return true; }
    if (act === 'clear_listing') { reply(limpiarListado()); return true; }
    if (act === 'start_listing_observer') { iniciarListingObserver(); reply({ status: 'ok', activo: true }); return true; }
    reply({ status: "error", details: "Accion no reconocida: " + act });
  } catch (handlerErr) {
    reply({ status: "error", details: String(handlerErr && handlerErr.message) });
  }
  return false;
});
bscLog('content_script', 'injected', { url: window.location.href });