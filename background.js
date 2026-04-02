// background.js – Bio Cattaleya Scraper
// Script de servicio en segundo plano. Gestiona el estado de scraping,
// retransmite mensajes entre el popup/sidepanel y el content script, y
// reenvía los datos extraídos al receptor Python.

const RECEPTOR_URL = "http://localhost:5000/productos";
const STORAGE_KEY = "cattaleya_productos";

// Estado de scraping por pestaña
const scrapingState = {};

// ─── Utilidades de almacenamiento ───────────────────────────────────────────

async function getStoredProducts() {
  return new Promise((resolve) => {
    chrome.storage.local.get([STORAGE_KEY], (result) => {
      resolve(result[STORAGE_KEY] || []);
    });
  });
}

async function saveProducts(products) {
  return new Promise((resolve) => {
    chrome.storage.local.set({ [STORAGE_KEY]: products }, resolve);
  });
}

// ─── Envío al receptor Python ────────────────────────────────────────────────

async function sendToReceptor(product) {
  try {
    const response = await fetch(RECEPTOR_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(product),
    });
    if (!response.ok) {
      console.warn("[BioCattaleya] Receptor respondió con error:", response.status);
    }
  } catch (err) {
    // El servidor puede no estar activo; se ignora el error silenciosamente.
    console.warn("[BioCattaleya] No se pudo conectar al receptor:", err.message);
  }
}

// ─── Listener de mensajes ────────────────────────────────────────────────────

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  const tabId = sender.tab ? sender.tab.id : null;

  switch (message.action) {
    case "PRODUCTO_EXTRAIDO": {
      // Recibido desde content.js
      const product = message.data;
      (async () => {
        const products = await getStoredProducts();
        // Evitar duplicados por URL
        const exists = products.some((p) => p.url === product.url);
        if (!exists) {
          products.push(product);
          await saveProducts(products);
          await sendToReceptor(product);
          // Notificar al popup/sidepanel si están abiertos
          chrome.runtime.sendMessage({ action: "PRODUCTOS_ACTUALIZADOS", products });
        }
        sendResponse({ ok: true, total: products.length });
      })();
      return true; // mantener canal abierto para sendResponse asíncrono
    }

    case "INICIAR_SCRAPING": {
      // Orden del popup para comenzar el scraping en la pestaña activa
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (!tabs.length) { sendResponse({ ok: false, error: "Sin pestaña activa" }); return; }
        const tid = tabs[0].id;
        scrapingState[tid] = true;
        chrome.tabs.sendMessage(tid, { action: "INICIAR_SCRAPING" }, (resp) => {
          sendResponse(resp || { ok: true });
        });
      });
      return true;
    }

    case "DETENER_SCRAPING": {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (!tabs.length) { sendResponse({ ok: false }); return; }
        const tid = tabs[0].id;
        scrapingState[tid] = false;
        chrome.tabs.sendMessage(tid, { action: "DETENER_SCRAPING" }, (resp) => {
          sendResponse(resp || { ok: true });
        });
      });
      return true;
    }

    case "OBTENER_PRODUCTOS": {
      (async () => {
        const products = await getStoredProducts();
        sendResponse({ products });
      })();
      return true;
    }

    case "LIMPIAR_PRODUCTOS": {
      (async () => {
        await saveProducts([]);
        chrome.runtime.sendMessage({ action: "PRODUCTOS_ACTUALIZADOS", products: [] });
        sendResponse({ ok: true });
      })();
      return true;
    }

    default:
      break;
  }
});

// Abrir el panel lateral cuando se hace clic en el ícono de la extensión
chrome.action.onClicked.addListener((tab) => {
  chrome.sidePanel.open({ tabId: tab.id });
});
