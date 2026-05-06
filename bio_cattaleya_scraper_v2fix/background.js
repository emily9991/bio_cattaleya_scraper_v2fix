// ============================================================
// BACKGROUND SERVICE WORKER - BIO CATTALEYA SCRAPER PRO
// ============================================================

importScripts('config.js');
importScripts('secureStorage.js');

let licenseValidationInterval = null;
let isValidationInProgress = false;

chrome.runtime.onInstalled.addListener(async (details) => {
  console.log('Extension installed/updated:', details.reason);
  if (chrome.sidePanel?.setPanelBehavior) {
    chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
  }
  chrome.alarms.create('CHECK_LICENSE', { delayInMinutes: 1, periodInMinutes: 60 });
  await validateLicense();
});

chrome.runtime.onStartup.addListener(async () => {
  console.log('Extension started');
  if (chrome.sidePanel?.setPanelBehavior) {
    chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
  }
  await validateLicense();
});

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === 'CHECK_LICENSE') {
    console.log('License validation alarm triggered');
    await validateLicense();
  }
});

async function validateLicense() {
  if (isValidationInProgress) return;
  isValidationInProgress = true;
  try {
    const licenseKey = await secureStorage.getSecure('licenseKey');
    if (!licenseKey) { await setPremiumStatus(false); return; }
    const token = await getOrRenewToken();
    if (!token) { await setPremiumStatus(false); return; }
    const response = await fetch(CONFIG.BACKEND_URL + '/api/license/validate-license', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ licenseKey, chromeRuntimeId: chrome.runtime.id, timestamp: Date.now() })
    });
    if (response.ok) {
      const data = await response.json();
      if (data.valid) {
        await setPremiumStatus(true);
        await secureStorage.saveSecure('licenseData', { validatedAt: data.validatedAt, expiresAt: data.expiresAt, features: data.features });
      } else {
        await setPremiumStatus(false);
        await invalidateLicense();
      }
    } else if (response.status === 401 || response.status === 403) {
      await setPremiumStatus(false);
      await invalidateLicense();
    }
  } catch (error) {
    console.log('Validation error:', error.message);
  } finally {
    isValidationInProgress = false;
  }
}

async function getOrRenewToken() {
  try {
    const existingToken = await secureStorage.getSecure('jwtToken');
    if (existingToken) {
      const res = await fetch(CONFIG.BACKEND_URL + '/api/auth/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: existingToken })
      });
      if (res.ok) {
        const data = await res.json();
        if (data.valid) return existingToken;
      }
    }
    const tokenResponse = await fetch(CONFIG.BACKEND_URL + '/api/auth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chromeRuntimeId: chrome.runtime.id, timestamp: Date.now() })
    });
    if (tokenResponse.ok) {
      const data = await tokenResponse.json();
      if (data.success) { await secureStorage.saveSecure('jwtToken', data.token); return data.token; }
    }
    return null;
  } catch (error) { console.log('Token error:', error.message); return null; }
}

async function setPremiumStatus(isPremium) {
  try {
    await chrome.storage.local.set({ isPremium });
    chrome.runtime.sendMessage({ type: 'LICENSE_STATUS_CHANGED', isPremium }).catch(() => {});
  } catch (error) { console.log('Error setting premium:', error.message); }
}

async function invalidateLicense() {
  try {
    await secureStorage.removeSecure('licenseKey');
    await secureStorage.removeSecure('jwtToken');
    await secureStorage.removeSecure('licenseData');
    chrome.runtime.sendMessage({ type: 'LICENSE_INVALID', message: 'License has been invalidated' }).catch(() => {});
  } catch (error) { console.log('Error invalidating license:', error.message); }
}

async function saveLicenseKey(licenseKey) {
  try {
    if (!licenseKey || licenseKey.trim().length === 0) throw new Error('License key cannot be empty');
    await secureStorage.saveSecure('licenseKey', licenseKey.trim());
    await validateLicense();
    return { success: true };
  } catch (error) { return { success: false, error: error.message }; }
}

async function getLicenseStatus() {
  try {
    const result = await chrome.storage.local.get('isPremium');
    const licenseData = await secureStorage.getSecure('licenseData');
    return { isPremium: result.isPremium || false, licenseData: licenseData || null };
  } catch (error) { return { isPremium: false, licenseData: null }; }
}

// ─── MENSAJES PRINCIPALES ─────────────────────────────────────────
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {

  if (message.action === 'save_license') {
    saveLicenseKey(message.licenseKey).then(sendResponse);
    return true;
  }

  if (message.action === 'get_license_status') {
    getLicenseStatus().then(sendResponse);
    return true;
  }

  if (message.action === 'validate_license_now') {
    validateLicense()
      .then(() => sendResponse({ success: true }))
      .catch(error => sendResponse({ success: false, error: error.message }));
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
    fetch('http://localhost:5001/log', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(message.entry)
    }).catch(() => {});
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
    fetch('http://localhost:5001/guardar-listado', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        slug: message.payload.slug,
        fecha: message.payload.fecha,
        items: message.payload.items
      })
    })
    .then(response => response.json())
    .then(data => sendResponse({ ok: data.ok, path: data.path }))
    .catch(error => sendResponse({ ok: false, error: error.message }));
    return true;
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

if (process.env.NODE_ENV === 'development') {
  globalThis.validateLicense = validateLicense;
  globalThis.saveLicenseKey = saveLicenseKey;
  globalThis.getLicenseStatus = getLicenseStatus;
}

