//============================================================
// BIO CATTALEYA SCRAPER PRO v4.0 — POPUP CONTROLLER
// ============================================================

let camposDefinidos = {}; // { nombre: { selector, tipo } }
let esperandoSelector = false;
let campoEnEspera = null;
let ultimoListado = [];

async function getActiveTab() {
  const [t] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  return t;
}

function refreshSiteUrlLine() {
  getActiveTab().then((tab) => {
    document.getElementById('siteUrl').textContent = tab?.url?.replace(/^https?:\/\//, '') || 'sin página';
  });
}

// ─── INIT ────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  refreshSiteUrlLine();
  try {
    chrome.tabs.onActivated.addListener(refreshSiteUrlLine);
  } catch (_) {}

  const stored = await chrome.storage.local.get('campos');
  if (stored.campos) {
    camposDefinidos = stored.campos;
    renderizarCampos();
  }

  document.querySelectorAll('.tab').forEach(t => {
    t.addEventListener('click', () => cambiarTab(t.dataset.tab));
  });

  setupAcordeon('hdrOCR', 'bodyOCR');
  setupAcordeon('hdr1', 'body1');
  setupAcordeon('hdr2', 'body2');
  setupAcordeon('hdr3', 'body3');
  setupAcordeon('hdr4', 'body4');

  document.getElementById('btnOCR').addEventListener('click', async () => {
    const badge = document.getElementById('badgeOCR');
    const result = document.getElementById('resultOCR');
    const logEl = document.getElementById('ocrLog');
    const btn = document.getElementById('btnOCR');

    document.getElementById('bodyOCR').classList.add('open');

    badge.textContent = 'PROCESANDO';
    badge.className = 'section-badge badge-running';
    btn.textContent = '⏳ Procesando OCR…';
    btn.disabled = true;
    logEl.style.display = 'block';
    logEl.innerHTML = '';
    result.style.display = 'none';

    const progressListener = (message) => {
      if (message.action === 'ocr_progress') {
        const line = document.createElement('span');
        line.className = 'log-line';
        line.textContent = message.msg;
        logEl.appendChild(line);
        logEl.scrollTop = logEl.scrollHeight;
        setStatus(message.msg.slice(0, 30));
      }
    };
    chrome.runtime.onMessage.addListener(progressListener);

    const tab = await getActiveTab();
    if (!tab?.id) return;

    const res = await enviarMensaje(tab.id, { action: 'do_ocr' });
    chrome.runtime.onMessage.removeListener(progressListener);

    if (!res) {
      badge.textContent = 'ERROR';
      badge.className = 'section-badge badge-error';
      result.style.display = 'block';
      result.textContent =
        '❌ No hay respuesta del contenido de la página. Abre una ficha de producto Taobao/Tmall, recarga (F5) y reintenta.';
      result.className = 'section-result error';
      btn.textContent = '🔍 Iniciar Lectura OCR';
      btn.disabled = false;
      setStatus('Error OCR');
      return;
    }

    if (res && res.status === 'ok') {
      badge.textContent = 'DONE';
      badge.className = 'section-badge badge-done';
      result.style.display = 'block';
      result.textContent = res.details || '✅ OCR completado';
      result.className = 'section-result success';
    } else {
      badge.textContent = 'ERROR';
      badge.className = 'section-badge badge-error';
      result.style.display = 'block';
      result.textContent = (res && res.details) || '❌ Error en OCR';
      result.className = 'section-result error';
    }

    btn.textContent = '🔍 Iniciar Lectura OCR';
    btn.disabled = false;
    setStatus('OCR completado');
  });

  document.getElementById('btnScroll').addEventListener('click', async () => {
    const tab = await getActiveTab();
    if (!tab?.id) return;
    await ejecutarAccion('do_scroll', 'badge1', 'result1', tab.id);
  });

  document.getElementById('btnBasicData').addEventListener('click', async () => {
    const tab = await getActiveTab();
    if (!tab?.id) return;
    await ejecutarAccion('get_basic_data', 'badge2', 'result2', tab.id);
  });

  document.getElementById('btnMedia').addEventListener('click', async () => {
    const tab = await getActiveTab();
    if (!tab?.id) return;
    await ejecutarAccion('get_media', 'badge3', 'result3', tab.id);
  });

  document.getElementById('btnPagination').addEventListener('click', async () => {
    const tab = await getActiveTab();
    if (!tab?.id) return;
    await ejecutarAccion('detect_pagination', 'badge4', 'result4', tab.id);
  });

  document.getElementById('btnResetData').addEventListener('click', async () => {
    const tab = await getActiveTab();
    if (!tab?.id) return;
    await enviarMensaje(tab.id, { action: 'reset_data' });
    ['badgeOCR','badge1','badge2','badge3','badge4'].forEach(b => {
      const el = document.getElementById(b);
      el.textContent = 'LISTO';
      el.className = 'section-badge badge-idle';
    });
    ['result1','result2','result3','result4'].forEach(r => {
      document.getElementById(r).textContent = 'Datos reiniciados.';
      document.getElementById(r).className = 'section-result';
    });
    setStatus('Datos reiniciados');
    renderListingTable([]);
  });

  document.getElementById('btnActivarSelector').addEventListener('click', async () => {
    const nombre = document.getElementById('campoNombre').value.trim();
    const tipo = document.getElementById('campoTipo').value;
    if (!nombre) {
      document.getElementById('campoNombre').focus();
      document.getElementById('campoNombre').style.borderColor = 'var(--red)';
      setTimeout(() => document.getElementById('campoNombre').style.borderColor = '', 1500);
      return;
    }
    const tab = await getActiveTab();
    if (!tab?.id) return;
    campoEnEspera = { nombre, tipo };
    esperandoSelector = true;
    document.getElementById('selectorWaiting').classList.add('visible');
    document.getElementById('btnActivarSelector').textContent = '⏳ Esperando clic en página...';
    document.getElementById('btnActivarSelector').disabled = true;
    await enviarMensaje(tab.id, { action: 'activar_selector', etiqueta: nombre });
  });

  document.getElementById('btnManualAdd').addEventListener('click', () => {
    const nombre = document.getElementById('manualNombre').value.trim();
    const selector = document.getElementById('manualSelector').value.trim();
    const tipo = document.getElementById('campoTipo').value;
    if (!nombre || !selector) return;
    camposDefinidos[nombre] = { selector, tipo };
    guardarCampos();
    renderizarCampos();
    document.getElementById('manualNombre').value = '';
    document.getElementById('manualSelector').value = '';
  });

  document.getElementById('btnExtractSchema').addEventListener('click', async () => {
    if (Object.keys(camposDefinidos).length === 0) return;
    const tab = await getActiveTab();
    if (!tab?.id) return;
    setStatus('Extrayendo campos...');
    const res = await enviarMensaje(tab.id, { action: 'extract_with_schema', esquema: camposDefinidos });
    setStatus(res?.details || 'Extraído');
  });

  document.getElementById('btnRefreshPreview').addEventListener('click', async () => {
    const tab = await getActiveTab();
    if (!tab?.id) return;
    refrescarPreview(tab.id);
  });

  document.getElementById('btnExportJSON').addEventListener('click', async () => {
    const tab = await getActiveTab();
    if (!tab?.id) return;
    exportarJSON(tab.id);
  });
  document.getElementById('btnExportCSV').addEventListener('click', async () => {
    const tab = await getActiveTab();
    if (!tab?.id) return;
    exportarCSV(tab.id);
  });
  document.getElementById('btnSendPython').addEventListener('click', async () => {
    const tab = await getActiveTab();
    if (!tab?.id) return;
    enviarPython(tab.id);
  });
  document.getElementById('btnExportAll').addEventListener('click', async () => {
    const tab = await getActiveTab();
    if (!tab?.id) return;
    await exportarJSON(tab.id);
    await exportarCSV(tab.id);
    mostrarExportStatus('✅ JSON y CSV descargados', 'success');
  });
  document.getElementById('btnCheckPython').addEventListener('click', () => checkPython());
  document.getElementById('btnExportMain').addEventListener('click', async () => {
    const tab = await getActiveTab();
    if (!tab?.id) return;
    accionCompleta(tab.id);
  });

  checkPython();

  const btnDetectListing = document.getElementById('btnDetectListing');
  if (btnDetectListing) {
    btnDetectListing.addEventListener('click', async () => {
      const tab = await getActiveTab();
      if (!tab?.id) return;
      const res = await enviarMensaje(tab.id, { action: 'detect_listing_page' });
      const el = document.getElementById('listingDetectResult');
      if (!res) {
        el.textContent = 'No se pudo leer la página.';
        el.className = 'section-result error';
        return;
      }
      el.className = 'section-result ' + (res.esListado ? 'success' : '');
      el.textContent = res.detalle + ' · ' + res.enlacesItem + ' enlaces a ítems';
    });
  }

  const btnScrollListing = document.getElementById('btnScrollListing');
  if (btnScrollListing) {
    btnScrollListing.addEventListener('click', async () => {
      const tab = await getActiveTab();
      if (!tab?.id) return;
      const el = document.getElementById('listingDetectResult');
      el.className = 'section-result';
      el.textContent = '⏳ Scroll 20s para cargar imágenes…';
      const res = await enviarMensaje(tab.id, { action: 'do_scroll' });
      el.textContent = (res && res.details) || 'Scroll finalizado.';
      el.className = 'section-result success';
    });
  }

  const btnScanListing = document.getElementById('btnScanListing');
  if (btnScanListing) {
    btnScanListing.addEventListener('click', async () => {
      const tab = await getActiveTab();
      if (!tab?.id) return;
      setStatus('Escaneando listado…');
      const res = await enviarMensaje(tab.id, { action: 'scan_listing' });
      const lr = document.getElementById('listingDetectResult');
      if (!res || res.status !== 'ok') {
        setStatus('Error al escanear');
        if (lr) {
          lr.textContent = 'No se pudo escanear. ¿Estás en una página con enlaces a productos (item.htm)?';
          lr.className = 'section-result error';
        }
        return;
      }
      setStatus(res.details || 'Listo');
      if (lr) {
        lr.className = 'section-result success';
        lr.textContent = res.details;
      }
      renderListingTable(res.items || []);
    });
  }

  const btnExportListingCSV = document.getElementById('btnExportListingCSV');
  if (btnExportListingCSV) {
    btnExportListingCSV.addEventListener('click', () => exportarListadoCSV());
  }

  const btnDataSetupRefresh = document.getElementById('btnDataSetupRefresh');
  if (btnDataSetupRefresh) {
    btnDataSetupRefresh.addEventListener('click', () => syncDataSetupPanel());
  }

  chrome.runtime.onMessage.addListener((message) => {
    if (message.action === 'elemento_seleccionado' && esperandoSelector && campoEnEspera) {
      esperandoSelector = false;
      document.getElementById('selectorWaiting').classList.remove('visible');
      document.getElementById('btnActivarSelector').textContent = '🎯 Seleccionar elemento en la página';
      document.getElementById('btnActivarSelector').disabled = false;
      camposDefinidos[campoEnEspera.nombre] = {
        selector: message.selector,
        tipo: campoEnEspera.tipo || message.tipo || 'texto',
      };
      guardarCampos();
      renderizarCampos();
      document.getElementById('campoNombre').value = '';
      campoEnEspera = null;
      setStatus(`✅ Campo "${Object.keys(camposDefinidos).slice(-1)[0]}" agregado`);
    }
    if (message.action === 'selector_cancelado') {
      esperandoSelector = false;
      document.getElementById('selectorWaiting').classList.remove('visible');
      document.getElementById('btnActivarSelector').textContent = '🎯 Seleccionar elemento en la página';
      document.getElementById('btnActivarSelector').disabled = false;
    }
  });
});

// ─── HELPERS ─────────────────────────────────────────────────
function cambiarTab(nombre) {
  document.querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t.dataset.tab === nombre));
  document.querySelectorAll('.tab-content').forEach(c => c.classList.toggle('active', c.id === `tab-${nombre}`));
  if (nombre === 'preview') {
    getActiveTab().then((tab) => { if (tab?.id) refrescarPreview(tab.id); });
  }
  if (nombre === 'listing' && document.getElementById('listingTableBody')) {
    getActiveTab().then(async (tab) => {
      if (!tab?.id) return;
      const datos = await enviarMensaje(tab.id, { action: 'get_all_data' });
      if (datos?.listado?.length) renderListingTable(datos.listado);
    });
  }
  if (nombre === 'datasetup') {
    syncDataSetupPanel();
  }
}

function setupAcordeon(headerId, bodyId) {
  document.getElementById(headerId).addEventListener('click', () => {
    const body = document.getElementById(bodyId);
    body.classList.toggle('open');
  });
}

function setStatus(msg) {
  document.getElementById('statusText').textContent = msg;
}

function escapeHtml(s) {
  const d = document.createElement('div');
  d.textContent = s == null ? '' : String(s);
  return d.innerHTML;
}

function renderListingTable(items) {
  ultimoListado = items || [];
  const wrap = document.getElementById('listingTableWrap');
  const body = document.getElementById('listingTableBody');
  const btnCsv = document.getElementById('btnExportListingCSV');
  if (!wrap || !body) return;

  if (!items || items.length === 0) {
    wrap.style.display = 'none';
    if (btnCsv) btnCsv.style.display = 'none';
    body.innerHTML = '';
    syncDataSetupPanel();
    return;
  }

  wrap.style.display = 'block';
  if (btnCsv) btnCsv.style.display = '';

  body.innerHTML = items
    .map((row, idx) => {
      const href = String(row.url || '').replace(/"/g, '&quot;');
      const img = row.imagen
        ? `<img class="listing-thumb" src="${String(row.imagen).replace(/"/g, '&quot;')}" alt="">`
        : '—';
      return `<tr>
        <td>${idx + 1}</td>
        <td>${img}</td>
        <td>${escapeHtml((row.nombre || '').slice(0, 120))}</td>
        <td class="mono">${escapeHtml(row.precio || '—')}</td>
        <td>${escapeHtml(row.compradores || '—')}</td>
        <td><a href="${href}" target="_blank" rel="noopener">abrir</a></td>
      </tr>`;
    })
    .join('');
  syncDataSetupPanel();
}

function renderDataSetupPanel(datos) {
  if (!datos || !document.getElementById('dataSetupTableBody')) return;

  const sumEl = document.getElementById('dataSetupSummary');
  const emptyEl = document.getElementById('dataSetupEmpty');
  const scrollWrap = document.getElementById('dataSetupScrollWrap');
  const tbody = document.getElementById('dataSetupTableBody');
  const card = document.getElementById('dataSetupSingleCard');

  const listado = datos.listado || [];
  const n = listado.length;

  if (sumEl) {
    const ts = datos.timestamp ? new Date(datos.timestamp).toLocaleString() : '';
    sumEl.textContent = n
      ? `${n} productos en listado · ${datos.sitio || ''}${ts ? ' · ' + ts : ''}`
      : `Sin filas de listado · ${datos.sitio || ''}` + (datos.nombre ? ' · Hay datos de ficha abajo' : '');
    sumEl.className = 'section-result success';
  }

  if (n > 0) {
    if (emptyEl) emptyEl.style.display = 'none';
    if (scrollWrap) scrollWrap.classList.add('visible');
    tbody.innerHTML = listado
      .map((row, idx) => {
        const href = String(row.url || '').replace(/"/g, '&quot;');
        const urlText = escapeHtml(String(row.url || ''));
        const img = row.imagen
          ? `<img class="listing-thumb" src="${String(row.imagen).replace(/"/g, '&quot;')}" alt="">`
          : '—';
        return `<tr>
        <td>${idx + 1}</td>
        <td>${img}</td>
        <td class="col-nombre">${escapeHtml((row.nombre || '').slice(0, 240))}</td>
        <td class="mono">${escapeHtml(row.precio || '—')}</td>
        <td>${escapeHtml(row.compradores || '—')}</td>
        <td class="col-url"><a href="${href}" target="_blank" rel="noopener" title="${urlText}">${urlText.slice(0, 96)}${String(row.url || '').length > 96 ? '…' : ''}</a></td>
      </tr>`;
      })
      .join('');
  } else {
    tbody.innerHTML = '';
    if (emptyEl) emptyEl.style.display = 'block';
    if (scrollWrap) scrollWrap.classList.remove('visible');
  }

  const hasSingle = !!(datos.nombre || datos.precio || datos.tienda || (datos.imagenes && datos.imagenes.length) || datos.video);
  if (card) {
    if (hasSingle) {
      card.classList.add('visible');
      const set = (id, v) => {
        const el = document.getElementById(id);
        if (el) el.textContent = v;
      };
      set('dataSetupSingleNombre', datos.nombre || '—');
      set('dataSetupSinglePrecio', datos.precio ? `¥ ${datos.precio}` : '—');
      set('dataSetupSingleTienda', datos.tienda || '—');
      set('dataSetupSingleUrl', datos.url || '—');
      const m = (datos.imagenes && datos.imagenes.length) || 0;
      const v = datos.video ? 'Sí' : 'No';
      set('dataSetupSingleMedia', `${m} imágenes · Video: ${v}`);
    } else {
      card.classList.remove('visible');
    }
  }
}

async function syncDataSetupPanel() {
  if (!document.getElementById('dataSetupTableBody')) return;
  const tab = await getActiveTab();
  if (!tab?.id) return;
  const datos = await enviarMensaje(tab.id, { action: 'get_all_data' });
  renderDataSetupPanel(datos);
}

async function enviarMensaje(tabId, mensaje) {
  return new Promise((resolve) => {
    chrome.tabs.sendMessage(tabId, mensaje, (res) => {
      if (chrome.runtime.lastError) resolve(null);
      else resolve(res);
    });
  });
}

function exportarListadoCSV() {
  const rows = ultimoListado.length ? ultimoListado : [];
  if (rows.length === 0) {
    const lr = document.getElementById('listingDetectResult');
    if (lr) {
      lr.textContent = 'Primero pulsa «Escanear productos del listado».';
      lr.className = 'section-result error';
    }
    return;
  }
  const esc = (v) => '"' + String(v ?? '').replace(/"/g, '""') + '"';
  const SEP = ';';
  const header = ['Nombre', 'Precio (CNY)', 'Compradores', 'URL', 'Imagen'].map(h => '"' + h + '"').join(SEP);
  const lines = rows.map((r) => [r.nombre, r.precio, r.compradores, r.url, r.imagen].map(esc).join(SEP));
  const csv = '\uFEFF' + 'sep=' + SEP + '\n' + header + '\n' + lines.join('\n');
  const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  descargarArchivo(csv, 'BioCattaleya_listado_' + ts + '.csv', 'text/csv;charset=utf-8;');
  const lr = document.getElementById('listingDetectResult');
  if (lr) {
    lr.textContent = '✅ CSV descargado (' + rows.length + ' filas)';
    lr.className = 'section-result success';
  }
  setStatus('Listado exportado');
}

async function ejecutarAccion(action, badgeId, resultId, tabId) {
  const badge = document.getElementById(badgeId);
  const result = document.getElementById(resultId);
  badge.textContent = 'PROCESANDO';
  badge.className = 'section-badge badge-running';
  result.textContent = '⏳ Ejecutando...';
  result.className = 'section-result';
  const bodyEl = document.getElementById(resultId.replace('result', 'body'));
  if (bodyEl && !bodyEl.classList.contains('open')) bodyEl.classList.add('open');
  const res = await enviarMensaje(tabId, { action });
  if (res && res.status === 'ok') {
    badge.textContent = 'DONE';
    badge.className = 'section-badge badge-done';
    result.textContent = res.details || '✅ Completado';
    result.className = 'section-result success';
  } else {
    badge.textContent = 'ERROR';
    badge.className = 'section-badge badge-error';
    result.textContent = '⚠️ Error. Recarga la página e inténtalo de nuevo.';
    result.className = 'section-result error';
  }
}

function renderizarCampos() {
  const lista = document.getElementById('camposList');
  const count = Object.keys(camposDefinidos).length;
  document.getElementById('camposCount').textContent = count;
  if (count === 0) {
    lista.innerHTML = '<div style="color:var(--text-dim);font-size:11px;text-align:center;padding:10px">Sin campos definidos todavía</div>';
    return;
  }
  lista.innerHTML = Object.entries(camposDefinidos).map(([nombre, config]) => `
    <div class="campo-item">
      <span class="campo-name">${nombre}</span>
      <span class="tag" style="flex-shrink:0">${config.tipo}</span>
      <span class="campo-sel" title="${config.selector}">${config.selector}</span>
      <span class="campo-del" data-nombre="${nombre}">✕</span>
    </div>
  `).join('');
  lista.querySelectorAll('.campo-del').forEach(btn => {
    btn.addEventListener('click', () => {
      delete camposDefinidos[btn.dataset.nombre];
      guardarCampos();
      renderizarCampos();
    });
  });
}

function guardarCampos() {
  chrome.storage.local.set({ campos: camposDefinidos });
}

async function refrescarPreview(tabId) {
  const datos = await enviarMensaje(tabId, { action: 'get_all_data' });
  if (!datos) return;
  document.getElementById('pvNombre').textContent = datos.nombre || '—';
  document.getElementById('pvPrecio').textContent = datos.precio ? `¥ ${datos.precio}` : '—';
  document.getElementById('pvTienda').textContent = datos.tienda || '—';
  document.getElementById('pvRating').textContent = datos.calificaciones || '—';
  document.getElementById('pvSpecs').textContent = datos.specs?.slice(0, 5).join(' · ') || '—';
  const custom = datos.datos_custom || {};
  document.getElementById('pvCustom').textContent = Object.keys(custom).length ? Object.entries(custom).map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : v}`).join(' | ') : '—';
  const imgs = datos.imagenes || [];
  document.getElementById('imgCount').textContent = imgs.length;
  document.getElementById('imgPreview').innerHTML = imgs.slice(0, 8).map(url => `<img class="img-thumb" src="${url}" onerror="this.style.display='none'">`).join('');
}

const esperar = ms => new Promise(r => setTimeout(r, ms));

function construirFila(datos) {
  const precioCNY = parseFloat(datos.precio) || 0;
  const precioUSD = precioCNY > 0 ? (precioCNY / 7.25).toFixed(2) : '';
  const precioVenta = precioCNY > 0 ? (precioCNY / 7.25 * 2.5).toFixed(2) : '';
  const nombreZH = datos.nombre || '';
  const tieneChino = /[\u4e00-\u9fff]/.test(nombreZH);
  const nombreEN = tieneChino ? '(traducir)' : nombreZH;
  
  // Extraemos la lista de imágenes para usarlas individualmente
  const imgs = datos.imagenes || [];

  const fila = {
    'Tienda': datos.tienda || '',
    'Nombre (ZH)': nombreZH,
    'Nombre (EN)': nombreEN,
    'Descripcion': (datos.descripcion || '').replace(/[\n\r]+/g, ' ').slice(0, 400),
    'Specs': (datos.specs || []).join(' | '),
    'Variaciones': (datos.variaciones || []).join(' | '),
    'Costo CNY': datos.precio || '',
    'Costo USD': precioUSD,
    'Precio Venta USD': precioVenta,
    'Calificacion': datos.calificaciones || '',
    'Sitio': datos.sitio || '',
    'URL': datos.url || '',
    // --- AQUÍ SEPARAMOS LAS IMÁGENES EN COLUMNAS (CAMBIO 3) ---
    'Imagen1': imgs[0] || '',
    'Imagen2': imgs[1] || '',
    'Imagen3': imgs[2] || '',
    'Imagen4': imgs[3] || '',
    'Imagen5': imgs[4] || '',
    'Imagen6': imgs[5] || '',
    'Imagen7': imgs[6] || '',
    'Imagen8': imgs[7] || '',
    // ---------------------------------------------------------
    'Variantes URLs': (datos.imagenes_variantes || []).join(' | '),
    '本店推荐 JSON': JSON.stringify(datos.tienda_recomendados || []).slice(0, 2000),
    'Imagenes Descripcion': (datos.imagenes_descripcion || []).join(' | '),
    'Video': datos.video || '',
    'Fecha': new Date().toLocaleString('es-CO'),
  };

  for (const [k, v] of Object.entries(datos.datos_custom || {})) {
    fila['CUSTOM_' + k] = Array.isArray(v) ? v.join(' | ') : String(v || '');
  }
  return fila;
}
async function exportarJSON(tabId) {
  const datos = await enviarMensaje(tabId, { action: 'get_all_data' });
  if (!datos) return;
  const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const nombre = 'BioCattaleya_' + (datos.sitio || 'producto') + '_' + ts + '.json';
  descargarArchivo(JSON.stringify(datos, null, 2), nombre, 'application/json');
  mostrarExportStatus('✅ JSON descargado: ' + nombre, 'success');
}

async function exportarCSV(tabId) {
  const datos = await enviarMensaje(tabId, { action: 'get_all_data' });
  if (!datos) return;
  const fila = construirFila(datos);
  const escapar = v => '"' + String(v || '').replace(/"/g, '""').replace(/\n/g, ' ') + '"';
  const SEP = ';';
  const headers = Object.keys(fila).map(h => '"' + h + '"').join(SEP);
  const values = Object.values(fila).map(escapar).join(SEP);
  const csv = '\uFEFF' + 'sep=' + SEP + '\n' + headers + '\n' + values;
  const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  descargarArchivo(csv, 'BioCattaleya_' + ts + '.csv', 'text/csv;charset=utf-8;');
  mostrarExportStatus('✅ CSV descargado con columnas organizadas', 'success');
}

async function enviarPython(tabId) {
  mostrarExportStatus('⏳ Enviando al receptor Python...', '');
  const datos = await enviarMensaje(tabId, { action: 'get_all_data' });
  if (!datos) return;
  try {
    const res = await fetch('http://127.0.0.1:5000/guardar_completo', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(datos)
    });
    const json = await res.json();
    mostrarExportStatus('✅ ' + (json.message || 'Guardado en Excel + media local'), 'success');
  } catch {
    mostrarExportStatus('❌ Python no responde. ¿Está corriendo receptor_biocattaleya.py?', 'error');
  }
}

async function accionCompleta(tabId) {
  const btn = document.getElementById('btnExportMain');
  btn.disabled = true;
  setStatus('Iniciando...');
  const pasos = [
    { msg: '⏳ 1/4 · Scroll lento (20s)…', action: 'do_scroll' },
    { msg: '⏳ 2/4 · Extrayendo datos…', action: 'get_basic_data' },
    { msg: '⏳ 3/4 · Capturando media…', action: 'get_media' },
    { msg: '⏳ 4/4 · Detectando botón compra…', action: 'detect_pagination' },
  ];
  for (const p of pasos) {
    btn.textContent = p.msg;
    setStatus(p.msg);
    await enviarMensaje(tabId, { action: p.action });
    await esperar(700);
  }
  if (Object.keys(camposDefinidos).length > 0) {
    btn.textContent = '⏳ Extrayendo campos custom…';
    await enviarMensaje(tabId, { action: 'extract_with_schema', esquema: camposDefinidos });
    await esperar(500);
  }
  btn.textContent = '⏳ Consolidando imágenes…';
  await esperar(2000);
  btn.textContent = '⏳ Exportando archivos…';
  await exportarJSON(tabId);
  await esperar(1000);
  await exportarCSV(tabId);
  await esperar(1000);
  try {
    const datos = await enviarMensaje(tabId, { action: 'get_all_data' });
    await fetch('http://127.0.0.1:5000/guardar_completo', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(datos)
    });
  } catch {}
  btn.textContent = '✅ ¡TODO EXPORTADO!';
  btn.style.background = 'linear-gradient(135deg,#00b37d,#006b4a)';
  setStatus('¡Listo!');
  setTimeout(() => {
    btn.textContent = '⚡ EXTRAER TODO Y EXPORTAR';
    btn.style.background = '';
    btn.disabled = false;
    setStatus('Listo');
  }, 5000);
}

function descargarArchivo(contenido, nombre, tipo) {
  const blob = new Blob([contenido], { type: tipo });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = nombre;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 3000);
}

function mostrarExportStatus(msg, tipo) {
  const el = document.getElementById('exportStatus');
  el.style.display = 'block';
  el.textContent = msg;
  el.className = 'section-result' + (tipo ? ' ' + tipo : '');
}

async function checkPython() {
  const statusEl = document.getElementById('pythonStatus');
  try {
    await fetch('http://127.0.0.1:5000/guardar_completo', { method: 'OPTIONS', signal: AbortSignal.timeout(2500) });
    statusEl.className = 'python-status';
    statusEl.querySelector('div').innerHTML = '<div style="font-weight:600;font-size:11px;color:var(--green)">Receptor Python</div>' + '<div style="font-size:10px;color:var(--text-dim)">Conectado · localhost:5000</div>';
  } catch {
    statusEl.className = 'python-status offline';
    statusEl.querySelector('div').innerHTML = '<div style="font-weight:600;font-size:11px;color:var(--red)">Receptor Python</div>' + '<div style="font-size:10px;color:var(--text-dim)">Desconectado – inicia receptor_biocattaleya.py</div>';
  }
}