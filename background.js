// ─── BACKGROUND SERVICE WORKER ───────────────────────────────
// Panel lateral de Chrome: clic en el icono abre el side panel (no el popup).
chrome.runtime.onInstalled.addListener(() => {
  if (chrome.sidePanel?.setPanelBehavior) {
    chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
  }
});

chrome.runtime.onStartup.addListener(() => {
  if (chrome.sidePanel?.setPanelBehavior) {
    chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
  }
});

// Relay de mensajes entre content.js y panel / popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "elemento_seleccionado" || message.action === "selector_cancelado") {
    // Retransmitir al popup
    chrome.runtime.sendMessage(message).catch(() => {});
  }
});

// Descargar archivo desde el popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "descargar_archivo") {
    const blob = new Blob([message.contenido], { type: message.tipo || "application/json" });
    const url = URL.createObjectURL(blob);
    chrome.downloads.download({
      url,
      filename: message.nombre,
      saveAs: false
    }, (id) => {
      sendResponse({ status: "ok", downloadId: id });
      setTimeout(() => URL.revokeObjectURL(url), 5000);
    });
    return true;
  }
});
