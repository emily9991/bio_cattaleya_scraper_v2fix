// ============================================================
// BACKGROUND SERVICE WORKER - BIO CATTALEYA SCRAPER PRO
// ============================================================

importScripts('config.js');
importScripts('src/utils/supabase.js');

chrome.runtime.onInstalled.addListener((details) => {
  console.log('Extension installed/updated:', details.reason);
  if (chrome.sidePanel?.setPanelBehavior) {
    chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
  }
});

chrome.runtime.onStartup.addListener(() => {
  console.log('Extension started');
  if (chrome.sidePanel?.setPanelBehavior) {
    chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
  }
});

// ─── MENSAJES PRINCIPALES ─────────────────────────────────────────
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {

  if (message.action === 'fetch_image_b64') {
    fetch(message.url)
      .then(r => r.blob())
      .then(blob => new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result);
        reader.readAsDataURL(blob);
      }))
      .then(b64 => sendResponse({ b64 }))
      .catch(e => sendResponse({ error: e.message }));
    return true;
  }

  if (message.action === 'download_image') {
    console.log('📥 filename:', message.filename);
    chrome.downloads.download({
      url:      message.url,
      filename: message.filename,
      saveAs:   false
    }, (downloadId) => {
      if (chrome.runtime.lastError) {
        console.log('❌ ERROR:', chrome.runtime.lastError.message);
        sendResponse({ ok: false, error: chrome.runtime.lastError.message });
      } else {
        console.log('✅ downloadId:', downloadId);
        sendResponse({ ok: true, downloadId });
      }
    });
    return true;
  }

  if (message.action === 'elemento_seleccionado' || message.action === 'selector_cancelado') {
    chrome.runtime.sendMessage(message).catch(() => {});
    return false;
  }

  if (message.action === 'update_badge') {
    var count = message.count || 0;
    chrome.action.setBadgeText({ text: count > 0 ? String(count) : '' });
    chrome.action.setBadgeBackgroundColor({ color: '#ff5000' });
    return false;
  }

  if (message.action === 'debug_log') {
    // Debug logging deshabilitado en producción (viola CSP)
    console.log('[Extension Debug]', message.entry);
    return false;
  }

  // ── FIX ENCODING: execute_mainworld ───────────────────────────
  // PROBLEMA ORIGINAL: CustomEvent.detail con strings chinos cruzaba
  // la boundary MAIN world → isolated world via structured clone,
  // corrompiendo los chars multibyte → mojibake (å­¦é™¢é£Ž)
  //
  // FIX: JSON.stringify DENTRO del MAIN world antes de dispatchEvent.
  // Los chars chinos viajan como \uXXXX (ASCII puro). El content.js
  // recibe un string y hace JSON.parse — sin tocar el encoding.
  if (message.action === 'execute_mainworld') {
    var eventName = message.eventName;
    chrome.scripting.executeScript({
      target: { tabId: (message.tabId || (sender.tab && sender.tab.id)) },
      world: 'MAIN',
      func: function(evName) {
        var cards = document.querySelectorAll('[class*="cardContainer--"]');
        if (!cards || cards.length === 0) {
          window.dispatchEvent(new CustomEvent(evName, { detail: '[]' }));
          return;
        }
        var firstCard = cards[0];
        var fkParent = firstCard.parentElement;
        var fk = Object.keys(fkParent).find(function(k) {
          return k.startsWith('__reactFiber$');
        });
        if (!fk) {
          window.dispatchEvent(new CustomEvent(evName, { detail: '[]' }));
          return;
        }
        var items = [];
        try {
          var children = fkParent[fk].memoizedProps.children[0];
          for (var i = 0; i < children.length; i++) {
            var d = children[i].props && children[i].props.itemCardData;
            if (d) items.push({
              itemId: d.itemId,
              title:  d.title,
              url:    d.itemUrl,
              image:  d.image,
              index:  i
            });
          }
        } catch(e) {}
        // JSON.stringify aqui: chino → \uXXXX antes de cruzar la boundary
        window.dispatchEvent(new CustomEvent(evName, { detail: JSON.stringify(items) }));
      },
      args: [eventName]
    });
    return true;
  }

  if (message.action === 'guardar_listado') {
    // DESHABILITADO: No se pueden hacer llamadas a localhost en Chrome Web Store
    // Para enviar datos: usar Supabase, Firebase o un backend en la nube
    console.warn('[Extension] guardar_listado deshabilitado en producción. Usa Supabase u otro servicio en la nube.');
    sendResponse({ ok: false, error: 'Funcionalidad no disponible en versión publicada' });
    return true;
  }
  // ── SUPABASE INSERT ──────────────────────────────────────
  if (message.action === 'supabase_insert') {
    enviarProductoASupabase(message.producto)
      .then(result => sendResponse(result))
      .catch(e => sendResponse({ ok: false, error: e.message }));
    return true; // ← obligatorio para respuesta async
  }

});


// ─── DESCARGA DE ARCHIVOS ─────────────────────────────────────────
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'descargar_archivo') {
    const bytes = message.contenido instanceof Array 
      ? new Uint8Array(message.contenido) 
      : message.contenido;
    const blob = new Blob([bytes], { type: message.tipo || 'application/json' });
    const url = URL.createObjectURL(blob);
    chrome.downloads.download({ url, filename: message.nombre, saveAs: false }, (id) => {
      sendResponse({ status: 'ok', downloadId: id });
      setTimeout(() => URL.revokeObjectURL(url), 5000);
    });
    return true;
  }
});