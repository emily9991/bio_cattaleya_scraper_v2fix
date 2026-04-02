// popup.js – Bio Cattaleya Scraper
// Controla la interfaz del popup de la extensión.

(function () {
  "use strict";

  const btnStart  = document.getElementById("btn-start");
  const btnStop   = document.getElementById("btn-stop");
  const btnPanel  = document.getElementById("btn-panel");
  const btnClear  = document.getElementById("btn-clear");
  const statusBox = document.getElementById("status-box");
  const totalEl   = document.getElementById("total");

  // ─── Utilidades ─────────────────────────────────────────────────────────

  function setStatus(msg, type = "info") {
    statusBox.textContent = msg;
    statusBox.style.borderLeftColor =
      type === "ok"    ? "#43a047" :
      type === "error" ? "#e53935" : "#1976d2";
  }

  function setRunning(running) {
    btnStart.disabled = running;
    btnStop.disabled  = !running;
  }

  // ─── Cargar contador inicial ─────────────────────────────────────────────

  chrome.runtime.sendMessage({ action: "OBTENER_PRODUCTOS" }, (resp) => {
    if (resp && resp.products) {
      totalEl.textContent = resp.products.length;
    }
  });

  // ─── Listener de actualizaciones en tiempo real ──────────────────────────

  chrome.runtime.onMessage.addListener((message) => {
    if (message.action === "PRODUCTOS_ACTUALIZADOS") {
      totalEl.textContent = message.products.length;
    }
  });

  // ─── Acciones ────────────────────────────────────────────────────────────

  btnStart.addEventListener("click", () => {
    setRunning(true);
    setStatus("Extrayendo producto...", "info");
    chrome.runtime.sendMessage({ action: "INICIAR_SCRAPING" }, (resp) => {
      if (chrome.runtime.lastError || !resp) {
        setStatus("Error al iniciar scraping.", "error");
        setRunning(false);
        return;
      }
      if (resp.ok === false) {
        setStatus("Error: " + (resp.error || "desconocido"), "error");
      } else {
        setStatus("✅ Producto extraído. Total: " + (resp.total || ""), "ok");
      }
      setRunning(false);
    });
  });

  btnStop.addEventListener("click", () => {
    chrome.runtime.sendMessage({ action: "DETENER_SCRAPING" }, () => {
      setStatus("Scraping detenido.", "info");
      setRunning(false);
    });
  });

  btnPanel.addEventListener("click", () => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs.length) {
        chrome.sidePanel.open({ tabId: tabs[0].id });
      }
    });
    window.close();
  });

  btnClear.addEventListener("click", () => {
    if (!confirm("¿Eliminar todos los productos almacenados?")) return;
    chrome.runtime.sendMessage({ action: "LIMPIAR_PRODUCTOS" }, (resp) => {
      if (resp && resp.ok) {
        totalEl.textContent = "0";
        setStatus("Lista limpiada.", "info");
      }
    });
  });
})();
