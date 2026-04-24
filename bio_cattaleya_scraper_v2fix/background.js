// ============================================================
// BACKGROUND SERVICE WORKER - BIO CATTALEYA SCRAPER PRO
// ============================================================
// Gestión de licencias, alarmas y comunicación entre componentes
// ============================================================

// Importar dependencias en orden crítico
importScripts('config.js');
importScripts('secureStorage.js');

// ─── VARIABLES GLOBALES ────────────────────────────────────────
let licenseValidationInterval = null;
let isValidationInProgress = false;

// ─── INICIALIZACIÓN ────────────────────────────────────────────────
chrome.runtime.onInstalled.addListener(async (details) => {
  console.log('Extension installed/updated:', details.reason);
  
  // Configurar panel lateral
  if (chrome.sidePanel?.setPanelBehavior) {
    chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
  }
  
  // Crear alarma de validación de licencia
  chrome.alarms.create('CHECK_LICENSE', {
    delayInMinutes: 1, // Primera validación en 1 minuto
    periodInMinutes: 60 // Cada hora
  });
  
  // Validación inicial inmediata
  await validateLicense();
});

chrome.runtime.onStartup.addListener(async () => {
  console.log('Extension started');
  
  // Configurar panel lateral
  if (chrome.sidePanel?.setPanelBehavior) {
    chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
  }
  
  // Validar licencia al iniciar
  await validateLicense();
});

// ─── MANEJO DE ALARMAS ────────────────────────────────────────────
chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === 'CHECK_LICENSE') {
    console.log('License validation alarm triggered');
    await validateLicense();
  }
});

// ─── VALIDACIÓN DE LICENCIA ───────────────────────────────────────
async function validateLicense() {
  if (isValidationInProgress) {
    console.log('License validation already in progress, skipping');
    return;
  }
  
  isValidationInProgress = true;
  
  try {
    // Obtener license key desde secure storage
    const licenseKey = await secureStorage.getSecure('licenseKey');
    
    if (!licenseKey) {
      console.log('No license key found, setting premium to false');
      await setPremiumStatus(false);
      return;
    }
    
    
    // Obtener o renovar JWT
    const token = await getOrRenewToken();
    if (!token) {
      console.log('Failed to get JWT token, setting premium to false');
      await setPremiumStatus(false);
      return;
    }
    
    // Validar licencia con el backend
    const response = await fetch(CONFIG.BACKEND_URL + '/api/license/validate-license', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        licenseKey: licenseKey,
        chromeRuntimeId: chrome.runtime.id,
        timestamp: Date.now()
      })
    });
    
    if (response.ok) {
      const data = await response.json();
      console.log('License validation successful');
      
      if (data.valid) {
        await setPremiumStatus(true);
        await secureStorage.saveSecure('licenseData', {
          validatedAt: data.validatedAt,
          expiresAt: data.expiresAt,
          features: data.features
        });
      } else {
        console.log('License invalid:', data.error);
        await setPremiumStatus(false);
        await invalidateLicense();
      }
    } else if (response.status === 401 || response.status === 403) {
      console.log('License explicitly rejected by server');
      await setPremiumStatus(false);
      await invalidateLicense();
    } else {
      console.log('Server error during validation, keeping current status');
      // No modificar estado por errores de servidor (fail-safe)
    }
    
  } catch (error) {
    console.log('Network or unknown error during validation:', error.message);
    // No modificar estado por errores de red (fail-safe)
  } finally {
    isValidationInProgress = false;
  }
}

// ─── GESTIÓN DE TOKENS JWT ─────────────────────────────────────────
async function getOrRenewToken() {
  try {
    // Intentar obtener token existente
    const existingToken = await secureStorage.getSecure('jwtToken');
    if (existingToken) {
      // Validar que el token aún sea válido
      const validationResponse = await fetch(CONFIG.BACKEND_URL + '/api/auth/validate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ token: existingToken })
      });
      
      if (validationResponse.ok) {
        const data = await validationResponse.json();
        if (data.valid) {
          console.log('Existing JWT token is still valid');
          return existingToken;
        }
      }
    }
    
    // Generar nuevo token
    console.log('Generating new JWT token');
    const tokenResponse = await fetch(CONFIG.BACKEND_URL + '/api/auth/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        chromeRuntimeId: chrome.runtime.id,
        timestamp: Date.now()
      })
    });
    
    if (tokenResponse.ok) {
      const data = await tokenResponse.json();
      if (data.success) {
        await secureStorage.saveSecure('jwtToken', data.token);
        console.log('New JWT token generated successfully');
        return data.token;
      }
    }
    
    return null;
  } catch (error) {
    console.log('Error getting JWT token:', error.message);
    return null;
  }
}

// ─── GESTIÓN DE ESTADO DE LICENCIA ─────────────────────────────────
async function setPremiumStatus(isPremium) {
  try {
    await chrome.storage.local.set({ isPremium });
    console.log('Premium status set to:', isPremium);
    
    // Notificar a la UI sobre el cambio de estado
    chrome.runtime.sendMessage({
      type: 'LICENSE_STATUS_CHANGED',
      isPremium: isPremium
    }).catch(() => {
      // Ignorar errores si no hay listeners activos
    });
  } catch (error) {
    console.log('Error setting premium status:', error.message);
  }
}

async function invalidateLicense() {
  try {
    // Limpiar datos de licencia específicos (no todo el storage)
    await secureStorage.removeSecure('licenseKey');
    await secureStorage.removeSecure('jwtToken');
    await secureStorage.removeSecure('licenseData');
    
    console.log('License data invalidated');
    
    // Notificar a la UI sobre la invalidación
    chrome.runtime.sendMessage({
      type: 'LICENSE_INVALID',
      message: 'License has been invalidated'
    }).catch(() => {
      // Ignorar errores si no hay listeners activos
    });
  } catch (error) {
    console.log('Error invalidating license:', error.message);
  }
}

// ─── FUNCIONES PÚBLICAS PARA LA EXTENSIÓN ───────────────────────
// Guardar nueva licencia (llamado desde popup.js)
async function saveLicenseKey(licenseKey) {
  try {
    if (!licenseKey || licenseKey.trim().length === 0) {
      throw new Error('License key cannot be empty');
    }
    
    await secureStorage.saveSecure('licenseKey', licenseKey.trim());
    console.log('License key saved successfully');
    
    // Validar inmediatamente después de guardar
    await validateLicense();
    
    return { success: true };
  } catch (error) {
    console.log('Error saving license key:', error.message);
    return { success: false, error: error.message };
  }
}

// Obtener estado actual de la licencia
async function getLicenseStatus() {
  try {
    const result = await chrome.storage.local.get('isPremium');
    const isPremium = result.isPremium || false;
    const licenseData = await secureStorage.getSecure('licenseData');
    
    return {
      isPremium,
      licenseData: licenseData || null
    };
  } catch (error) {
    console.log('Error getting license status:', error.message);
    return { isPremium: false, licenseData: null };
  }
}

// ─── RELAY DE MENSAJES ───────────────────────────────────────────
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // Manejar mensajes relacionados con licencia
  if (message.action === 'save_license') {
    saveLicenseKey(message.licenseKey).then(sendResponse);
    return true; // Respuesta asíncrona
  }
  
  if (message.action === 'get_license_status') {
    getLicenseStatus().then(sendResponse);
    return true; // Respuesta asíncrona
  }
  
  if (message.action === 'validate_license_now') {
    validateLicense().then(() => {
      sendResponse({ success: true });
    }).catch(error => {
      sendResponse({ success: false, error: error.message });
    });
    return true; // Respuesta asíncrona
  }
  
  // Mensajes existentes (compatibilidad)
  if (message.action === "elemento_seleccionado" || message.action === "selector_cancelado") {
    // Retransmitir al popup
    chrome.runtime.sendMessage(message).catch(() => {});
  }

  // Mejora #4: badge update
  if (message.action === 'update_badge') {
    var count = message.count || 0;
    chrome.action.setBadgeText({
      text: count > 0 ? String(count) : ''
    });
    chrome.action.setBadgeBackgroundColor({ color: '#ff5000' });
    return false;
  }
  
  // Debug log routing
  if (message.action === 'debug_log') {
    fetch('http://localhost:5001/log', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(message.entry)
    }).catch(function() {});
    return false;
  }

  if (message.action === "execute_mainworld") {
    var eventName = message.eventName;
    chrome.scripting.executeScript({
      target: { tabId: sender.tab.id },
      world: "MAIN",
      func: function(evName) {
        var cards = document.querySelectorAll('[class*="cardContainer--"]');
        if (!cards || cards.length === 0) {
          window.dispatchEvent(new CustomEvent(evName, { detail: [] }));
          return;
        }
        var firstCard = cards[0];
        var fkParent = firstCard.parentElement;
        var fk = Object.keys(fkParent).find(function(k) {
          return k.startsWith('__reactFiber$');
        });
        if (!fk) {
          window.dispatchEvent(new CustomEvent(evName, { detail: [] }));
          return;
        }
        var items = [];
        try {
          var children = fkParent[fk].memoizedProps.children[0];
          for (var i = 0; i < children.length; i++) {
            var d = children[i].props && children[i].props.itemCardData;
            if (d) items.push({
              itemId: d.itemId,
              title: d.title,
              url: d.itemUrl,
              image: d.image
            });
          }
        } catch(e) {}
        window.dispatchEvent(new CustomEvent(evName, { detail: items }));
      },
      args: [eventName]
    });
    return true;
  }

  // Mejora #5: guardar listado de productos
  if (message.action === 'guardar_listado') {
    fetch('http://localhost:5001/guardar-listado', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        slug: message.payload.slug,
        fecha: message.payload.fecha,
        items: message.payload.items
      })
    }).then(response => response.json())
    .then(data => {
      sendResponse({ ok: data.ok, path: data.path });
    }).catch(error => {
      sendResponse({ ok: false, error: error.message });
    });
    return true; // Respuesta asíncrona
  }
});

// ─── DESCARGA DE ARCHIVOS ───────────────────────────────────────────
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

// ─── EXPORTAR FUNCIONES PARA DEBUGGING ─────────────────────────────
if (process.env.NODE_ENV === 'development') {
  globalThis.validateLicense = validateLicense;
  globalThis.saveLicenseKey = saveLicenseKey;
  globalThis.getLicenseStatus = getLicenseStatus;
}
