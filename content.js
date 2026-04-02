// content.js – Bio Cattaleya Scraper
// Se inyecta en cada página. Cuando recibe la orden INICIAR_SCRAPING extrae
// la información de producto visible y la envía al background script.

(function () {
  "use strict";

  let isRunning = false;

  // ─── Extracción de datos del producto ───────────────────────────────────

  function extractProduct() {
    const product = {
      url: window.location.href,
      titulo: "",
      precio: "",
      descripcion: "",
      imagen: "",
      fecha_extraccion: new Date().toISOString(),
    };

    // Título
    const titleSelectors = [
      'h1[itemprop="name"]',
      ".product-title",
      ".product_title",
      "#productTitle",
      "h1.titulo",
      "h1",
    ];
    for (const sel of titleSelectors) {
      const el = document.querySelector(sel);
      if (el && el.innerText.trim()) {
        product.titulo = el.innerText.trim();
        break;
      }
    }

    // Precio
    const priceSelectors = [
      '[itemprop="price"]',
      ".price",
      ".precio",
      "#priceblock_ourprice",
      ".product-price",
      ".woocommerce-Price-amount",
      "span.price",
    ];
    for (const sel of priceSelectors) {
      const el = document.querySelector(sel);
      if (el && el.innerText.trim()) {
        product.precio = el.innerText.trim();
        break;
      }
    }

    // Descripción
    const descSelectors = [
      '[itemprop="description"]',
      ".product-description",
      ".woocommerce-product-details__short-description",
      "#feature-bullets",
      ".descripcion",
      "meta[name='description']",
    ];
    for (const sel of descSelectors) {
      const el = document.querySelector(sel);
      if (el) {
        product.descripcion = (el.content || el.innerText || "").trim().slice(0, 500);
        if (product.descripcion) break;
      }
    }

    // Imagen principal
    const imgSelectors = [
      '[itemprop="image"]',
      ".product-image img",
      "#landingImage",
      ".wp-post-image",
      "img.product__image",
    ];
    for (const sel of imgSelectors) {
      const el = document.querySelector(sel);
      if (el) {
        product.imagen = el.src || el.content || "";
        if (product.imagen) break;
      }
    }

    return product;
  }

  // ─── Listener de mensajes desde background ──────────────────────────────

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message.action === "INICIAR_SCRAPING") {
      if (isRunning) { sendResponse({ ok: false, error: "Ya en ejecución" }); return; }
      isRunning = true;

      try {
        const product = extractProduct();
        chrome.runtime.sendMessage({ action: "PRODUCTO_EXTRAIDO", data: product }, (resp) => {
          sendResponse(resp || { ok: true });
        });
      } catch (err) {
        console.error("[BioCattaleya] Error al extraer producto:", err);
        isRunning = false;
        sendResponse({ ok: false, error: err.message });
      }

      // Detener tras una extracción (se puede ampliar a intervalo)
      isRunning = false;
      return true;
    }

    if (message.action === "DETENER_SCRAPING") {
      isRunning = false;
      sendResponse({ ok: true });
    }
  });
})();
