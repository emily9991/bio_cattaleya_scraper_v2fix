//============================================================
// BIO CATTALEYA SCRAPER PRO v4.1 — POPUP CONTROLLER
// Cambios v4.1:
//   - cambiarTab: maneja config/producto/supabase + loadSbStats
//   - refrescarPreview: helper setField() para inputs vs spans
//   - calcularMargen: tiempo real desde sbCostUSD / sbPriceCOP
//   - loadSbStats: cuenta filas de 4 tablas al abrir Supabase
//   - syncSbPreview: habilita/deshabilita btnInsertSupabase
//   - setupAcordeon: registra card-hdr / card-body del nuevo HTML
//   - ejecutarAccion: actualiza stepNum además de badge legacy
//   - mostrarGaleriaMedia: abre bodyGaleria automáticamente
//   - FIX XSS: renderizarCampos usa solo DOM API (sin innerHTML con datos)
//   - FIX XSS: safeUrl() valida protocolo en hrefs
//   - FIX XSS: checkPython usa setField, no innerHTML
// ============================================================

let camposDefinidos = {};
let esperandoSelector = false;
let campoEnEspera = null;
let ultimoListado = [];

async function getActiveTab() {
  const [t] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  return t;
}

function refreshSiteUrlLine() {
  getActiveTab().then((tab) => {
    const el = document.getElementById('siteUrl');
    if (el) el.textContent = tab?.url?.replace(/^https?:\/\//, '') || 'sin página';
  });
}

// ── FIX XSS: validar URL antes de usarla en href/src ────────
function safeUrl(url) {
  try {
    const u = new URL(String(url || ''));
    return (u.protocol === 'http:' || u.protocol === 'https:') ? u.href : '#';
  } catch { return '#'; }
}

// ── Helper: escapa HTML para innerHTML seguro ────────────────
function escapeHtml(s) {
  const d = document.createElement('div');
  d.textContent = s == null ? '' : String(s);
  return d.innerHTML;
}

// ── Helper: rellena input o span según tipo de elemento ─────
function setField(id, value) {
  const el = document.getElementById(id);
  if (!el) return;
  const v = value == null ? '' : String(value);
  if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
    el.value = v;
  } else {
    el.textContent = v;
  }
}

// ─── INIT ────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  refreshSiteUrlLine();
  try { chrome.tabs.onActivated.addListener(refreshSiteUrlLine); } catch (_) {}

  const stored = await chrome.storage.local.get('campos');
  if (stored.campos) {
    camposDefinidos = stored.campos;
    renderizarCampos();
  }

  // Tabs
  document.querySelectorAll('.tab').forEach(t => {
    t.addEventListener('click', () => cambiarTab(t.dataset.tab));
  });

  // Acordeones del nuevo HTML (card-hdr / card-body)
  setupAcordeon('hdrSbConfig',    'bodySbConfig');
  setupAcordeon('hdrOcrToggle',   'bodyOcrToggle');
  setupAcordeon('hdrSecCheck',    'bodySecCheck');
  setupAcordeon('hdrFlow',        'bodyFlow');
  setupAcordeon('hdrSteps',       'bodySteps');
  setupAcordeon('hdrDatosBase',   'bodyDatosBase');
  setupAcordeon('hdrVariaciones', 'bodyVariaciones');
  setupAcordeon('hdrGaleria',     'bodyGaleria');
  setupAcordeon('hdrSbInsert',    'bodySbInsert');
  setupAcordeon('hdrJsonPreview', 'bodyJsonPreview');

  // Acordeones legacy (mantener para compatibilidad)
  setupAcordeon('hdrOCR', 'bodyOCR');
  setupAcordeon('hdr1',   'body1');
  setupAcordeon('hdr2',   'body2');
  setupAcordeon('hdr3',   'body3');
  setupAcordeon('hdr4',   'body4');

  // Calcular margen en tiempo real
  document.getElementById('sbCostUSD')?.addEventListener('input', calcularMargen);
  document.getElementById('sbPriceCOP')?.addEventListener('input', calcularMargen);

  // ── PASO 0: OCR ──────────────────────────────────────────
  document.getElementById('btnOCR').addEventListener('click', async () => {
    const badge  = document.getElementById('badgeOCR');
    const result = document.getElementById('resultOCR');
    const logEl  = document.getElementById('ocrLog');
    const btn    = document.getElementById('btnOCR');
    const num    = document.getElementById('stepNum0');

    badge.textContent = 'PROCESANDO';
    badge.className   = 'section-badge badge-running';
    if (num) { num.textContent = '⏳'; num.className = 'step-num'; }
    btn.textContent = '⏳ Procesando…';
    btn.disabled    = true;
    btn.classList.add('running');
    if (logEl) { logEl.style.display = 'block'; logEl.innerHTML = ''; }
    result.textContent = '';

    const progressListener = (message) => {
      if (message.action === 'ocr_progress') {
        const line = document.createElement('span');
        line.className   = 'log-line';
        line.textContent = message.msg;
        if (logEl) { logEl.appendChild(line); logEl.scrollTop = logEl.scrollHeight; }
        setStatus(message.msg.slice(0, 30));
      }
    };
    chrome.runtime.onMessage.addListener(progressListener);

    const tab = await getActiveTab();
    if (!tab?.id) return;
    const res = await enviarMensaje(tab.id, { action: 'do_ocr' });
    chrome.runtime.onMessage.removeListener(progressListener);

    if (!res) {
      badge.textContent = 'ERROR'; badge.className = 'section-badge badge-error';
      if (num) { num.textContent = '✗'; num.className = 'step-num error'; }
      result.textContent  = 'Sin respuesta — abre una ficha Tmall, recarga (F5) y reintenta';
      result.className    = 'step-res err';
    } else if (res.status === 'ok') {
      badge.textContent = 'DONE'; badge.className = 'section-badge badge-done';
      if (num) { num.textContent = '✓'; num.className = 'step-num ok'; }
      result.textContent = res.details || 'OCR completado';
      result.className   = 'step-res ok';
    } else {
      badge.textContent = 'ERROR'; badge.className = 'section-badge badge-error';
      if (num) { num.textContent = '✗'; num.className = 'step-num error'; }
      result.textContent = res.details || 'Error en OCR';
      result.className   = 'step-res err';
    }
    btn.textContent = 'Iniciar';
    btn.disabled    = false;
    btn.classList.remove('running');
    setStatus('OCR completado');
  });

  // ── PASO 1-4 ─────────────────────────────────────────────
  document.getElementById('btnScroll').addEventListener('click', async () => {
    const tab = await getActiveTab(); if (!tab?.id) return;
    await ejecutarAccion('do_scroll', 'badge1', 'result1', tab.id, 'stepNum1');
  });
  document.getElementById('btnBasicData').addEventListener('click', async () => {
    const tab = await getActiveTab(); if (!tab?.id) return;
    const res = await ejecutarAccion('get_basic_data', 'badge2', 'result2', tab.id, 'stepNum2');
    if (res?.data) rellenarDatosBase(res.data);
  });
  document.getElementById('btnMedia').addEventListener('click', async () => {
    const tab = await getActiveTab(); if (!tab?.id) return;
    const res = await ejecutarAccion('get_media', 'badge3', 'result3', tab.id, 'stepNum3');
    if (res?.data?.imagenes?.length || res?.data?.video) {
      mostrarGaleriaMedia(res.data.imagenes || [], res.data.video || null);
    }
  });
  document.getElementById('btnPagination').addEventListener('click', async () => {
    const tab = await getActiveTab(); if (!tab?.id) return;
    await ejecutarAccion('detect_pagination', 'badge4', 'result4', tab.id, 'stepNum4');
  });

  // ── RESET ────────────────────────────────────────────────
  document.getElementById('btnResetData').addEventListener('click', async () => {
    const tab = await getActiveTab(); if (!tab?.id) return;
    await enviarMensaje(tab.id, { action: 'reset_data' });
    ['badgeOCR','badge1','badge2','badge3','badge4'].forEach(b => {
      const el = document.getElementById(b);
      if (el) { el.textContent = 'LISTO'; el.className = 'section-badge badge-idle'; }
    });
    ['resultOCR','result1','result2','result3','result4'].forEach(r => {
      const el = document.getElementById(r);
      if (el) { el.textContent = '—'; el.className = 'step-res'; }
    });
    [0,1,2,3,4].forEach(n => {
      const el = document.getElementById('stepNum' + n);
      if (el) { el.textContent = String(n); el.className = 'step-num'; }
    });
    ['pvNombre','pvSku','pvDesc'].forEach(id => setField(id, ''));
    setField('pvPrecio', '—');
    setField('pvMargen', '— %');
    ['chipsWrapTallas','chipsWrapColores','chipsWrapKits'].forEach(id => {
      const el = document.getElementById(id);
      if (el) {
        el.innerHTML = '';
        const chip = document.createElement('span');
        chip.className   = 'chip chip-empty';
        chip.textContent = 'Sin datos';
        el.appendChild(chip);
      }
    });
    setStatus('Datos reiniciados');
    renderListingTable([]);
  });

  // ── SELECTOR VISUAL ──────────────────────────────────────
  document.getElementById('btnActivarSelector')?.addEventListener('click', async () => {
    const nombre = document.getElementById('campoNombre')?.value.trim();
    const tipo   = document.getElementById('campoTipo')?.value;
    if (!nombre) {
      const inp = document.getElementById('campoNombre');
      if (inp) { inp.focus(); inp.style.borderColor = 'var(--red)'; setTimeout(() => inp.style.borderColor = '', 1500); }
      return;
    }
    const tab = await getActiveTab(); if (!tab?.id) return;
    campoEnEspera    = { nombre, tipo };
    esperandoSelector = true;
    const sw  = document.getElementById('selectorWaiting');
    const btn = document.getElementById('btnActivarSelector');
    if (sw)  sw.classList.add('visible');
    if (btn) { btn.textContent = '⏳ Esperando clic…'; btn.disabled = true; }
    await enviarMensaje(tab.id, { action: 'activar_selector', etiqueta: nombre });
  });

  document.getElementById('btnManualAdd')?.addEventListener('click', () => {
    const nombre   = document.getElementById('manualNombre')?.value.trim();
    const selector = document.getElementById('manualSelector')?.value.trim();
    const tipo     = document.getElementById('campoTipo')?.value;
    if (!nombre || !selector) return;
    camposDefinidos[nombre] = { selector, tipo };
    guardarCampos(); renderizarCampos();
    const mn = document.getElementById('manualNombre');
    const ms = document.getElementById('manualSelector');
    if (mn) mn.value = ''; if (ms) ms.value = '';
  });

  document.getElementById('btnExtractSchema')?.addEventListener('click', async () => {
    if (!Object.keys(camposDefinidos).length) return;
    const tab = await getActiveTab(); if (!tab?.id) return;
    setStatus('Extrayendo campos...');
    const res = await enviarMensaje(tab.id, { action: 'extract_with_schema', esquema: camposDefinidos });
    setStatus(res?.details || 'Extraído');
  });

  document.getElementById('btnRefreshPreview')?.addEventListener('click', async () => {
    const tab = await getActiveTab(); if (!tab?.id) return;
    refrescarPreview(tab.id);
  });

  // ── EXPORTAR ─────────────────────────────────────────────
  document.getElementById('btnExportJSON')?.addEventListener('click', async () => {
    const tab = await getActiveTab(); if (!tab?.id) return; exportarJSON(tab.id);
  });
  document.getElementById('btnExportCSV')?.addEventListener('click', async () => {
    const tab = await getActiveTab(); if (!tab?.id) return; exportarCSV(tab.id);
  });
  document.getElementById('btnSendPython')?.addEventListener('click', async () => {
    const tab = await getActiveTab(); if (!tab?.id) return; enviarPython(tab.id);
  });
  document.getElementById('btnExportAll')?.addEventListener('click', async () => {
    const tab = await getActiveTab(); if (!tab?.id) return;
    await exportarJSON(tab.id); await exportarCSV(tab.id);
    mostrarExportStatus('✅ JSON y CSV descargados', 'success');
  });
  document.getElementById('btnCheckPython')?.addEventListener('click', () => checkPython());
  document.getElementById('btnExportMain')?.addEventListener('click', async () => {
    const tab = await getActiveTab(); if (!tab?.id) return; accionCompleta(tab.id);
  });
  document.getElementById('btnGuardarListado')?.addEventListener('click', async () => {
    const tab = await getActiveTab(); if (!tab?.id) return; enviarPython(tab.id);
  });

  checkPython();

  // ── LISTADO ──────────────────────────────────────────────
  document.getElementById('btnDetectListing')?.addEventListener('click', async () => {
    const tab = await getActiveTab(); if (!tab?.id) return;
    const res = await enviarMensaje(tab.id, { action: 'detect_listing_page' });
    const el  = document.getElementById('listingDetectResult');
    if (!el) return;
    if (!res) { el.textContent = 'No se pudo leer la página.'; el.className = 'section-result error'; return; }
    el.className   = 'section-result ' + (res.esListado ? 'success' : '');
    el.textContent = `${res.detalle} · ${res.enlacesItem} enlaces a ítems`;
  });

  document.getElementById('btnScrollListing')?.addEventListener('click', async () => {
    const tab = await getActiveTab(); if (!tab?.id) return;
    const el  = document.getElementById('listingDetectResult');
    if (el) { el.className = 'section-result'; el.textContent = '⏳ Scroll 20s…'; }
    const res = await enviarMensaje(tab.id, { action: 'do_scroll' });
    if (el) { el.textContent = (res && res.details) || 'Scroll finalizado.'; el.className = 'section-result success'; }
  });

  document.getElementById('btnScanListing')?.addEventListener('click', async () => {
    const tab = await getActiveTab(); if (!tab?.id) return;
    setStatus('Escaneando listado…');
    const res = await enviarMensaje(tab.id, { action: 'scan_listing' });
    const lr  = document.getElementById('listingDetectResult');
    if (!res || res.status !== 'ok') {
      setStatus('Error al escanear');
      if (lr) { lr.textContent = 'No se pudo escanear.'; lr.className = 'section-result error'; }
      return;
    }
    setStatus(res.details || 'Listo');
    if (lr) { lr.className = 'section-result success'; lr.textContent = res.details; }
    renderListingTable(res.items || []);
  });

  document.getElementById('btnExportListingCSV')?.addEventListener('click', () => exportarListadoCSV());
  document.getElementById('btnDataSetupRefresh')?.addEventListener('click', () => syncDataSetupPanel());

  // ── MENSAJE DESDE CONTENT (selector) ────────────────────
  chrome.runtime.onMessage.addListener((message) => {
    if (message.action === 'elemento_seleccionado' && esperandoSelector && campoEnEspera) {
      esperandoSelector = false;
      const sw  = document.getElementById('selectorWaiting');
      const btn = document.getElementById('btnActivarSelector');
      if (sw)  sw.classList.remove('visible');
      if (btn) { btn.textContent = '🎯 Seleccionar elemento en la página'; btn.disabled = false; }
      camposDefinidos[campoEnEspera.nombre] = {
        selector: message.selector,
        tipo:     campoEnEspera.tipo || message.tipo || 'texto',
      };
      guardarCampos(); renderizarCampos();
      const cn = document.getElementById('campoNombre');
      if (cn) cn.value = '';
      campoEnEspera = null;
      setStatus(`✅ Campo agregado`);
    }
    if (message.action === 'selector_cancelado') {
      esperandoSelector = false;
      const sw  = document.getElementById('selectorWaiting');
      const btn = document.getElementById('btnActivarSelector');
      if (sw)  sw.classList.remove('visible');
      if (btn) { btn.textContent = '🎯 Seleccionar elemento en la página'; btn.disabled = false; }
    }
  });
});

// ─── CAMBIAR TAB ─────────────────────────────────────────────
function cambiarTab(nombre) {
  document.querySelectorAll('.tab').forEach(t =>
    t.classList.toggle('active', t.dataset.tab === nombre)
  );
  document.querySelectorAll('.tab-content').forEach(c =>
    c.classList.toggle('active', c.id === `tab-${nombre}`)
  );

  if (nombre === 'producto') {
    getActiveTab().then(async (tab) => {
      if (!tab?.id) return;
      refrescarPreview(tab.id);
    });
  }
  if (nombre === 'supabase') {
    syncSbPreview();
    loadSbStats();
  }
  if (nombre === 'listing' && document.getElementById('listingTableBody')) {
    getActiveTab().then(async (tab) => {
      if (!tab?.id) return;
      const datos = await enviarMensaje(tab.id, { action: 'get_all_data' });
      if (datos?.listado?.length) renderListingTable(datos.listado);
    });
  }
  if (nombre === 'datasetup') syncDataSetupPanel();
}

// ─── ACORDEÓN ────────────────────────────────────────────────
function setupAcordeon(headerId, bodyId) {
  const hdr  = document.getElementById(headerId);
  const body = document.getElementById(bodyId);
  if (!hdr || !body) return;
  hdr.addEventListener('click', () => body.classList.toggle('open'));
}

// ─── STATUS ──────────────────────────────────────────────────
function setStatus(msg) {
  const el = document.getElementById('statusText');
  if (el) el.textContent = msg;
}

// ─── EJECUTAR ACCIÓN ─────────────────────────────────────────
async function ejecutarAccion(action, badgeId, resultId, tabId, stepNumId) {
  const badge  = document.getElementById(badgeId);
  const result = document.getElementById(resultId);
  const num    = stepNumId ? document.getElementById(stepNumId) : null;

  if (badge)  { badge.textContent = 'PROCESANDO'; badge.className = 'section-badge badge-running'; }
  if (result) { result.textContent = '⏳ Ejecutando…'; result.className = 'step-res'; }
  if (num)    { num.textContent = '⏳'; num.className = 'step-num'; }

  // Asegurar que el btn muestre estado running
  const btnMap = { result1:'btnScroll', result2:'btnBasicData', result3:'btnMedia', result4:'btnPagination' };
  const btn = document.getElementById(btnMap[resultId]);
  if (btn) btn.classList.add('running');

  const res = await enviarMensaje(tabId, { action });

  if (btn) btn.classList.remove('running');

  if (res && res.status === 'ok') {
    if (badge)  { badge.textContent = 'DONE'; badge.className = 'section-badge badge-done'; }
    if (result) { result.textContent = res.details || '✅ Completado'; result.className = 'step-res ok'; }
    if (num)    { num.textContent = '✓'; num.className = 'step-num ok'; }
  } else {
    if (badge)  { badge.textContent = 'ERROR'; badge.className = 'section-badge badge-error'; }
    if (result) { result.textContent = '⚠️ Error — recarga la página e inténtalo'; result.className = 'step-res err'; }
    if (num)    { num.textContent = '✗'; num.className = 'step-num error'; }
  }
  return res;
}

// ─── RELLENAR DATOS BASE (tab Producto) ──────────────────────
function rellenarDatosBase(data) {
  setField('pvNombre', data.titulo  || data.nombre || '');
  setField('pvSku',    data.sku     || '');
  setField('pvPrecio', data.precio  ? `¥ ${data.precio}` : '—');
  setField('pvDesc',   data.descripcion || '');
  setField('pvUrl',    data.url     || '');
  // Abrir acordeón datos base si estaba cerrado
  const body = document.getElementById('bodyDatosBase');
  if (body && !body.classList.contains('open')) body.classList.add('open');
}

// ─── REFRESCAR PREVIEW ───────────────────────────────────────
async function refrescarPreview(tabId) {
  const datos = await enviarMensaje(tabId, { action: 'get_all_data' });
  if (!datos) return;

  setField('pvNombre', datos.nombre || '');
  setField('pvSku',    datos.sku    || '');
  setField('pvDesc',   datos.descripcion || '');
  setField('pvPrecio', datos.precio ? `¥ ${datos.precio}` : '—');
  setField('pvUrl',    datos.url    || '');

  // Spans legacy (ocultos pero popup.js los actualiza)
  setField('pvTienda', datos.tienda || '—');
  setField('pvRating', datos.calificaciones || '—');
  setField('pvSpecs',  (datos.specs || []).slice(0, 5).join(' · ') || '—');
  const custom = datos.datos_custom || {};
  setField('pvCustom', Object.keys(custom).length
    ? Object.entries(custom).map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : v}`).join(' | ')
    : '—'
  );

  // Contador imágenes
  const imgs = datos.imagenes || [];
  setField('imgCount', imgs.length);

  // Chips tallas / colores
  renderChips('chipsWrapTallas',  datos.tallas  || [], 'chip-sky');
  renderChips('chipsWrapColores', datos.colores || [], 'chip-stone');
  renderChips('chipsWrapKits',    datos.kits    || [], 'chip-stone');

  // Galería si ya hay imágenes
  if (imgs.length) mostrarGaleriaMedia(imgs, datos.video || null);
}

// ─── CHIPS ───────────────────────────────────────────────────
function renderChips(wrapId, items, chipClass) {
  const wrap = document.getElementById(wrapId);
  if (!wrap) return;
  wrap.innerHTML = '';
  if (!items || !items.length) {
    const chip = document.createElement('span');
    chip.className   = 'chip chip-empty';
    chip.textContent = 'Sin datos';
    wrap.appendChild(chip);
    return;
  }
  items.forEach(item => {
    const chip = document.createElement('span');
    chip.className   = `chip ${chipClass}`;
    chip.textContent = String(item);
    wrap.appendChild(chip);
  });
}

// ─── CALCULAR MARGEN ─────────────────────────────────────────
function calcularMargen() {
  const costUSD = parseFloat(document.getElementById('sbCostUSD')?.value) || 0;
  const ventaCOP = parseFloat(document.getElementById('sbPriceCOP')?.value) || 0;
  const tasa     = 4200;
  const el       = document.getElementById('pvMargen');
  if (!el) return;
  if (!costUSD || !ventaCOP) { el.textContent = '— %'; return; }
  const ventaUSD = ventaCOP / tasa;
  const margen   = ((ventaUSD - costUSD) / ventaUSD * 100).toFixed(1);
  el.textContent = `${margen} %`;
  el.style.color = parseFloat(margen) >= 0 ? 'var(--green)' : 'var(--red)';
}

// ─── LOAD SB STATS ───────────────────────────────────────────
async function loadSbStats() {
  const creds = await chrome.storage.local.get(['supabaseUrl', 'supabaseAnonKey']);
  const { supabaseUrl: url, supabaseAnonKey: key } = creds;

  // Ocultar banner si hay credenciales
  const banner = document.getElementById('sbConfigBanner');
  if (banner) banner.style.display = (url && key) ? 'none' : 'block';

  if (!url || !key) return;

  const tablas = [
    { tabla: 'products',          statId: 'statProducts'  },
    { tabla: 'pricing',           statId: 'statPricing'   },
    { tabla: 'product_suppliers', statId: 'statSuppliers' },
    { tabla: 'inventory',         statId: 'statInventory' },
  ];

  for (const { tabla, statId } of tablas) {
    try {
      const res = await fetch(`${url}/rest/v1/${tabla}?select=count`, {
        headers: {
          'apikey':        key,
          'Authorization': `Bearer ${key}`,
          'Prefer':        'count=exact',
          'Range':         '0-0',
        }
      });
      const count = res.headers.get('content-range')?.split('/')[1] ?? '—';
      setField(statId, count);
    } catch {
      setField(statId, '—');
    }
  }
}

// ─── GALERÍA MEDIA ───────────────────────────────────────────
async function mostrarGaleriaMedia(imagenes, video) {
  const grid    = document.getElementById('galeriaGrid');
  const counter = document.getElementById('galeriaSelCount');
  if (!grid) return;

  // Abrir acordeón galería automáticamente
  const bodyGal = document.getElementById('bodyGaleria');
  if (bodyGal && !bodyGal.classList.contains('open')) bodyGal.classList.add('open');

  // Actualizar badge contador
  const total = imagenes.length + (video ? 1 : 0);
  setField('imgCount', total);

  grid.innerHTML = '';

  for (let i = 0; i < imagenes.length; i++) {
    const url = imagenes[i];
    const div = document.createElement('div');
    div.className    = 'galeria-item';
    div.dataset.url  = url;
    div.dataset.tipo = 'imagen';

    const chk = document.createElement('div');
    chk.className = 'chk';
    const img = document.createElement('img');
    img.alt     = '';
    img.loading = 'lazy';

    div.appendChild(chk);
    div.appendChild(img);

    chrome.runtime.sendMessage({ action: 'fetch_image_b64', url }, res => {
      if (res?.b64) img.src = res.b64;
      else img.style.background = 'var(--surface-2)';
    });

    div.addEventListener('click', () => {
      div.classList.toggle('selected');
      if (counter) counter.textContent = grid.querySelectorAll('.galeria-item.selected').length;
    });
    grid.appendChild(div);
  }

  if (video) {
    const div = document.createElement('div');
    div.className    = 'galeria-item';
    div.dataset.url  = video;
    div.dataset.tipo = 'video';

    const chk = document.createElement('div');
    chk.className = 'chk';

    const placeholder = document.createElement('div');
    placeholder.style.cssText = 'width:100%;height:100%;display:flex;align-items:center;justify-content:center;background:var(--surface-2);font-size:22px';
    placeholder.textContent = '▶';

    const badge = document.createElement('span');
    badge.className   = 'galeria-video-badge';
    badge.textContent = 'VIDEO';

    div.appendChild(chk);
    div.appendChild(placeholder);
    div.appendChild(badge);
    div.addEventListener('click', () => {
      div.classList.toggle('selected');
      if (counter) counter.textContent = grid.querySelectorAll('.galeria-item.selected').length;
    });
    grid.appendChild(div);
  }

  // Botones seleccionar — replaceWith para evitar listeners duplicados
  const btnAll  = document.getElementById('btnSelAll');
  const btnNone = document.getElementById('btnSelNone');
  if (btnAll) {
    const newAll = btnAll.cloneNode(true);
    btnAll.replaceWith(newAll);
    newAll.addEventListener('click', () => {
      grid.querySelectorAll('.galeria-item').forEach(el => el.classList.add('selected'));
      if (counter) counter.textContent = grid.querySelectorAll('.galeria-item.selected').length;
    });
  }
  if (btnNone) {
    const newNone = btnNone.cloneNode(true);
    btnNone.replaceWith(newNone);
    newNone.addEventListener('click', () => {
      grid.querySelectorAll('.galeria-item').forEach(el => el.classList.remove('selected'));
      if (counter) counter.textContent = '0';
    });
  }

  const btnDes = document.getElementById('btnDescargarSel');
  if (btnDes) {
    const newDes = btnDes.cloneNode(true);
    btnDes.replaceWith(newDes);
    newDes.addEventListener('click', descargarSeleccionadas);
  }
}

// ─── DESCARGAR SELECCIONADAS ──────────────────────────────────
async function descargarSeleccionadas() {
  const grid  = document.getElementById('galeriaGrid');
  const items = [...grid.querySelectorAll('.galeria-item.selected')];
  if (!items.length) { mostrarExportStatus('⚠️ Selecciona al menos una imagen', ''); return; }

  const inputEl  = document.getElementById('inputNombreCarpeta');
  const nombreRaw = (inputEl?.value || '').trim();
  if (!nombreRaw) {
    if (inputEl) {
      inputEl.focus();
      inputEl.style.borderColor = 'var(--red)';
      setTimeout(() => inputEl.style.borderColor = '', 1500);
    }
    mostrarExportStatus('⚠️ Escribe un nombre para la carpeta', '');
    return;
  }

  const slug = nombreRaw.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_\-]/g, '').slice(0, 60);

  const tabs = await chrome.tabs.query({});
  const tab  = tabs.find(t => {
    try {
      const h = new URL(t.url).hostname;
      return /(?:^|\.)(?:taobao|tmall|1688)\.com$/.test(h);
    } catch { return false; }
  });
  const sku = tab?.url?.match(/[?&]id=(\d+)/)?.[1]
    || tab?.url?.match(/\/(\d{8,})/)?.[1]
    || String(Date.now());

  const carpeta = `BioCattaleya/seleccion/${slug}_${sku}`;
  mostrarExportStatus(`⏳ Descargando ${items.length} archivo(s)…`, '');
  let ok = 0, fail = 0;

  for (let i = 0; i < items.length; i++) {
    const el  = items[i];
    const url = el.dataset.url;
    if (!url) continue;
    const ext    = url.split('.').pop().split('?')[0].replace(/[^a-zA-Z0-9]/g, '') || 'jpg';
    const nombre = el.dataset.tipo === 'video'
      ? `video_1.${ext}`
      : `imagen_${String(i + 1).padStart(2, '0')}.${ext}`;
    try {
      const res = await new Promise(resolve =>
        chrome.runtime.sendMessage({ action: 'download_image', url, filename: `${carpeta}/${nombre}` }, resolve)
      );
      if (res?.ok) ok++; else fail++;
    } catch { fail++; }
    await new Promise(r => setTimeout(r, 120));
  }

  mostrarExportStatus(
    fail === 0 ? `✅ ${ok} archivo(s) → ${carpeta}/` : `⚠️ ${ok} ok · ${fail} fallaron`,
    fail === 0 ? 'success' : ''
  );
}

// ─── FIX XSS: renderizarCampos sin innerHTML con datos ───────
function renderizarCampos() {
  const lista = document.getElementById('camposList');
  const count = Object.keys(camposDefinidos).length;
  const countEl = document.getElementById('camposCount');
  if (countEl) countEl.textContent = count;
  if (!lista) return;

  lista.innerHTML = '';

  if (count === 0) {
    const msg = document.createElement('div');
    msg.style.cssText   = 'color:var(--text-dim);font-size:11px;text-align:center;padding:10px';
    msg.textContent     = 'Sin campos definidos todavía';
    lista.appendChild(msg);
    return;
  }

  Object.entries(camposDefinidos).forEach(([nombre, config]) => {
    const item = document.createElement('div');
    item.className = 'campo-item';

    const nameEl = document.createElement('span');
    nameEl.className   = 'campo-name';
    nameEl.textContent = nombre;

    const tipoEl = document.createElement('span');
    tipoEl.className   = 'tag';
    tipoEl.style.flexShrink = '0';
    tipoEl.textContent = config.tipo;

    const selEl = document.createElement('span');
    selEl.className   = 'campo-sel';
    selEl.title       = config.selector;
    selEl.textContent = config.selector;

    const delEl = document.createElement('span');
    delEl.className      = 'campo-del';
    delEl.textContent    = '✕';
    delEl.dataset.nombre = nombre;
    delEl.addEventListener('click', () => {
      delete camposDefinidos[nombre];
      guardarCampos();
      renderizarCampos();
    });

    item.appendChild(nameEl);
    item.appendChild(tipoEl);
    item.appendChild(selEl);
    item.appendChild(delEl);
    lista.appendChild(item);
  });
}

function guardarCampos() {
  chrome.storage.local.set({ campos: camposDefinidos });
}

// ─── FIX XSS: safeUrl en tablas ──────────────────────────────
function renderListingTable(items) {
  ultimoListado = items || [];
  const wrap   = document.getElementById('listingTableWrap');
  const body   = document.getElementById('listingTableBody');
  const btnCsv = document.getElementById('btnExportListingCSV');
  if (!wrap || !body) return;

  if (!items || !items.length) {
    wrap.style.display = 'none';
    if (btnCsv) btnCsv.style.display = 'none';
    body.innerHTML = '';
    syncDataSetupPanel();
    return;
  }

  wrap.style.display = 'block';
  if (btnCsv) btnCsv.style.display = '';

  body.innerHTML = items.map((row, idx) => {
    const href = safeUrl(row.url);
    const imgSrc = row.imagen ? safeUrl(row.imagen) : '';
    const imgTag = imgSrc !== '#'
      ? `<img class="listing-thumb" src="${escapeHtml(imgSrc)}" alt="">`
      : '—';
    return `<tr>
      <td>${idx + 1}</td>
      <td>${imgTag}</td>
      <td>${escapeHtml((row.nombre || '').slice(0, 120))}</td>
      <td class="mono">${escapeHtml(row.precio || '—')}</td>
      <td>${escapeHtml(row.compradores || '—')}</td>
      <td><a href="${escapeHtml(href)}" target="_blank" rel="noopener noreferrer">abrir</a></td>
    </tr>`;
  }).join('');

  syncDataSetupPanel();
}

function renderDataSetupPanel(datos) {
  if (!datos || !document.getElementById('dataSetupTableBody')) return;

  const sumEl     = document.getElementById('dataSetupSummary');
  const emptyEl   = document.getElementById('dataSetupEmpty');
  const scrollWrap = document.getElementById('dataSetupScrollWrap');
  const tbody     = document.getElementById('dataSetupTableBody');
  const card      = document.getElementById('dataSetupSingleCard');
  const listado   = datos.listado || [];
  const n         = listado.length;

  if (sumEl) {
    const ts = datos.timestamp ? new Date(datos.timestamp).toLocaleString() : '';
    sumEl.textContent = n
      ? `${n} productos · ${datos.sitio || ''}${ts ? ' · ' + ts : ''}`
      : `Sin filas de listado · ${datos.sitio || ''}`;
    sumEl.className = 'section-result success';
  }

  if (n > 0) {
    if (emptyEl)    emptyEl.style.display = 'none';
    if (scrollWrap) scrollWrap.classList.add('visible');
    tbody.innerHTML = listado.map((row, idx) => {
      const href    = safeUrl(row.url);
      const urlText = escapeHtml(String(row.url || ''));
      const imgSrc  = row.imagen ? safeUrl(row.imagen) : '';
      const imgTag  = imgSrc !== '#'
        ? `<img class="listing-thumb" src="${escapeHtml(imgSrc)}" alt="">`
        : '—';
      return `<tr>
        <td>${idx + 1}</td>
        <td>${imgTag}</td>
        <td class="col-nombre">${escapeHtml((row.nombre || '').slice(0, 240))}</td>
        <td class="mono">${escapeHtml(row.precio || '—')}</td>
        <td>${escapeHtml(row.compradores || '—')}</td>
        <td class="col-url"><a href="${escapeHtml(href)}" target="_blank" rel="noopener noreferrer" title="${urlText}">${urlText.slice(0, 96)}${String(row.url || '').length > 96 ? '…' : ''}</a></td>
      </tr>`;
    }).join('');
  } else {
    tbody.innerHTML = '';
    if (emptyEl)    emptyEl.style.display = 'block';
    if (scrollWrap) scrollWrap.classList.remove('visible');
  }

  const hasSingle = !!(datos.nombre || datos.precio || datos.tienda || (datos.imagenes?.length) || datos.video);
  if (card) {
    if (hasSingle) {
      card.classList.add('visible');
      setField('dataSetupSingleNombre', datos.nombre || '—');
      setField('dataSetupSinglePrecio', datos.precio ? `¥ ${datos.precio}` : '—');
      setField('dataSetupSingleTienda', datos.tienda || '—');
      setField('dataSetupSingleUrl',    datos.url    || '—');
      setField('dataSetupSingleMedia',  `${(datos.imagenes?.length) || 0} imágenes · Video: ${datos.video ? 'Sí' : 'No'}`);
    } else {
      card.classList.remove('visible');
    }
  }
}

async function syncDataSetupPanel() {
  if (!document.getElementById('dataSetupTableBody')) return;
  const tab = await getActiveTab(); if (!tab?.id) return;
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
  if (!ultimoListado.length) {
    const lr = document.getElementById('listingDetectResult');
    if (lr) { lr.textContent = 'Primero pulsa «Escanear productos del listado».'; lr.className = 'section-result error'; }
    return;
  }
  const esc = v => '"' + String(v ?? '').replace(/"/g, '""') + '"';
  const SEP    = ';';
  const header = ['Nombre','Precio (CNY)','Compradores','URL','Imagen'].map(h => `"${h}"`).join(SEP);
  const lines  = ultimoListado.map(r => [r.nombre, r.precio, r.compradores, r.url, r.imagen].map(esc).join(SEP));
  const csv    = '\uFEFF' + 'sep=' + SEP + '\n' + header + '\n' + lines.join('\n');
  const ts     = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  descargarArchivo(csv, `BioCattaleya_listado_${ts}.csv`, 'text/csv;charset=utf-8;');
  const lr = document.getElementById('listingDetectResult');
  if (lr) { lr.textContent = `✅ CSV descargado (${ultimoListado.length} filas)`; lr.className = 'section-result success'; }
  setStatus('Listado exportado');
}

const esperar = ms => new Promise(r => setTimeout(r, ms));

function construirFila(datos) {
  const precioCNY  = parseFloat(datos.precio) || 0;
  const precioUSD  = precioCNY > 0 ? (precioCNY / 7.25).toFixed(2) : '';
  const precioVenta = precioCNY > 0 ? (precioCNY / 7.25 * 2.5).toFixed(2) : '';
  const nombreZH   = datos.nombre || '';
  const tieneChino = /[\u4e00-\u9fff]/.test(nombreZH);
  const nombreEN   = tieneChino ? '(traducir)' : nombreZH;
  const imgs       = datos.imagenes || [];
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
    'Imagen1': imgs[0] || '', 'Imagen2': imgs[1] || '', 'Imagen3': imgs[2] || '',
    'Imagen4': imgs[3] || '', 'Imagen5': imgs[4] || '', 'Imagen6': imgs[5] || '',
    'Imagen7': imgs[6] || '', 'Imagen8': imgs[7] || '',
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
  const nombre = `BioCattaleya_${datos.sitio || 'producto'}_${ts}.json`;
  descargarArchivo(JSON.stringify(datos, null, 2), nombre, 'application/json');
  mostrarExportStatus('✅ JSON descargado: ' + nombre, 'success');
}

async function exportarCSV(tabId) {
  const datos = await enviarMensaje(tabId, { action: 'get_all_data' });
  if (!datos) return;
  const fila   = construirFila(datos);
  const escapar = v => '"' + String(v || '').replace(/"/g, '""').replace(/\n/g, ' ') + '"';
  const SEP     = ';';
  const headers = Object.keys(fila).map(h => `"${h}"`).join(SEP);
  const values  = Object.values(fila).map(escapar).join(SEP);
  const csv     = '\uFEFF' + 'sep=' + SEP + '\n' + headers + '\n' + values;
  const ts      = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  descargarArchivo(csv, `BioCattaleya_${ts}.csv`, 'text/csv;charset=utf-8;');
  mostrarExportStatus('✅ CSV descargado', 'success');
}

async function enviarPython(tabId) {
  mostrarExportStatus('⏳ Enviando al receptor Python...', '');
  const datos = await enviarMensaje(tabId, { action: 'get_all_data' });
  if (!datos) return;
  try {
    const res  = await fetch('http://localhost:5001/guardar-listado', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(datos)
    });
    const json = await res.json();
    mostrarExportStatus('✅ ' + (json.message || 'Guardado'), 'success');
  } catch {
    mostrarExportStatus('❌ Servidor no responde. ¿Está corriendo node server.js?', 'error');
  }
}

async function accionCompleta(tabId) {
  const btn = document.getElementById('btnExportMain');
  if (btn) btn.disabled = true;
  setStatus('Iniciando...');
  const pasos = [
    { msg: '⏳ 1/4 · Scroll (20s)…',   action: 'do_scroll' },
    { msg: '⏳ 2/4 · Extrayendo…',      action: 'get_basic_data' },
    { msg: '⏳ 3/4 · Capturando media…', action: 'get_media' },
    { msg: '⏳ 4/4 · Detectando…',      action: 'detect_pagination' },
  ];
  for (const p of pasos) {
    if (btn) btn.textContent = p.msg;
    setStatus(p.msg);
    await enviarMensaje(tabId, { action: p.action });
    await esperar(700);
  }
  if (Object.keys(camposDefinidos).length > 0) {
    if (btn) btn.textContent = '⏳ Campos custom…';
    await enviarMensaje(tabId, { action: 'extract_with_schema', esquema: camposDefinidos });
    await esperar(500);
  }
  if (btn) btn.textContent = '⏳ Exportando…';
  await exportarJSON(tabId);
  await esperar(800);
  await exportarCSV(tabId);
  await esperar(800);
  try {
    const datos = await enviarMensaje(tabId, { action: 'get_all_data' });
    await fetch('http://localhost:5001/guardar-listado', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(datos)
    });
  } catch {}
  if (btn) {
    btn.textContent     = '✅ ¡TODO EXPORTADO!';
    btn.style.background = 'var(--green)';
    setTimeout(() => {
      btn.textContent     = '⚡ Extraer todo y exportar';
      btn.style.background = '';
      btn.disabled        = false;
      setStatus('Listo');
    }, 5000);
  }
  setStatus('¡Listo!');
}

function descargarArchivo(contenido, nombre, tipo) {
  const blob = new Blob([contenido], { type: tipo });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = nombre;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 3000);
}

function mostrarExportStatus(msg, tipo) {
  const el = document.getElementById('exportStatus');
  if (!el) return;
  el.style.display = 'block';
  el.textContent   = msg;
  el.className     = 'export-status' + (tipo ? ' ' + tipo : '');
}

// ══════════════════════════════════════════════════════════
// SUPABASE INTEGRATION
// ══════════════════════════════════════════════════════════

chrome.storage.local.get(['supabaseUrl', 'supabaseAnonKey'], result => {
  if (result.supabaseUrl)     { const el = document.getElementById('sbUrl');     if (el) el.value = result.supabaseUrl; }
  if (result.supabaseAnonKey) { const el = document.getElementById('sbAnonKey'); if (el) el.value = result.supabaseAnonKey; }
  if (result.supabaseUrl && result.supabaseAnonKey) setSbStatus('ok', 'Credenciales cargadas ✓');
});

document.getElementById('btnToggleKey')?.addEventListener('click', () => {
  const input = document.getElementById('sbAnonKey');
  if (input) input.type = input.type === 'password' ? 'text' : 'password';
});

document.getElementById('btnSbSave')?.addEventListener('click', () => {
  const url = document.getElementById('sbUrl')?.value.trim();
  const key = document.getElementById('sbAnonKey')?.value.trim();
  if (!url || !key) { setSbStatus('error', 'Completa URL y Key antes de guardar'); return; }
  if (!url.includes('.supabase.co')) { setSbStatus('error', 'URL inválida — debe ser *.supabase.co'); return; }
  chrome.storage.local.set({ supabaseUrl: url, supabaseAnonKey: key }, () => {
    setSbStatus('ok', 'Guardado en chrome.storage.local ✓');
    addSbLog('✅ Credenciales guardadas');
  });
});

document.getElementById('btnSbTest')?.addEventListener('click', async () => {
  const url = document.getElementById('sbUrl')?.value.trim();
  const key = document.getElementById('sbAnonKey')?.value.trim();
  if (!url || !key) { setSbStatus('error', 'Completa URL y Key primero'); return; }
  setSbStatus('testing', 'Probando conexión…');
  try {
    const res = await fetch(`${url}/rest/v1/products?limit=1`, {
      headers: { 'apikey': key, 'Authorization': `Bearer ${key}` }
    });
    if (res.ok || res.status === 406) {
      setSbStatus('ok', 'Conectado a Supabase ✓');
      addSbLog('✅ Conexión exitosa — RLS activo');
    } else {
      setSbStatus('error', `Error HTTP ${res.status}`);
      addSbLog(`❌ Error ${res.status} — verifica la anon key`);
    }
  } catch (e) {
    setSbStatus('error', 'Sin respuesta del servidor');
    addSbLog('❌ ' + e.message);
  }
});

document.getElementById('btnInsertSupabase')?.addEventListener('click', async () => {
  const badge = document.getElementById('badgeSbInsert');
  if (badge) { badge.textContent = 'ENVIANDO'; badge.className = 'badge badge-run'; }

  const tab = await getActiveTab();
  if (!tab?.id) {
    if (badge) { badge.textContent = 'ERROR'; badge.className = 'badge badge-error'; }
    addSbLog('❌ No se pudo obtener la pestaña activa');
    return;
  }

  const datos = await enviarMensaje(tab.id, { action: 'get_all_data' });
  if (!datos || !datos.nombre) {
    if (badge) { badge.textContent = 'ERROR'; badge.className = 'badge badge-error'; }
    addSbLog('❌ Sin datos — usa el Extractor primero (pasos 1-3)');
    return;
  }

  const skuDesdeUrl = tab.url?.match(/[?&]id=(\d+)/)?.[1]
    ? `BCS-CN-${tab.url.match(/[?&]id=(\d+)/)[1].slice(-4)}`
    : `BCS-CN-${Date.now().toString().slice(-4)}`;

  const producto = {
    sku:          datos.sku         || skuDesdeUrl,
    name:         datos.nombre      || '',
    description:  datos.descripcion || '',
    images:       datos.imagenes    || [],
    priceUSD:     parseFloat(document.getElementById('sbCostUSD')?.value)  || 0,
    priceCOP:     parseFloat(document.getElementById('sbPriceCOP')?.value) || 0,
    exchangeRate: 4200,
    supplierCode: document.getElementById('sbSupplierCode')?.value.trim() || 'SUP-0001',
    sourceUrl:    datos.url         || '',
    variants:     datos.variantes   || [],
  };

  // Actualizar JSON preview
  const jsonBox = document.getElementById('jsonPreviewContent');
  if (jsonBox) jsonBox.textContent = JSON.stringify(producto, null, 2);

  addSbLog(`Insertando ${producto.sku}…`);

  chrome.runtime.sendMessage({ action: 'supabase_insert', producto }, res => {
    if (res?.ok) {
      if (badge) { badge.textContent = 'DONE'; badge.className = 'badge badge-ok'; }
      addSbLog(`✅ products → OK (id: ${res.productId})`);
      addSbLog(`✅ pricing → OK`);
      addSbLog(`✅ product_suppliers → OK`);
      if (producto.variants.length) addSbLog(`✅ inventory → OK (${producto.variants.length} variantes)`);
      addSbLog(`─── ${producto.sku} guardado ───`);
      loadSbStats(); // refrescar contadores
    } else {
      if (badge) { badge.textContent = 'ERROR'; badge.className = 'badge badge-error'; }
      addSbLog(`❌ Falló en: ${res?.step || 'desconocido'}`);
      addSbLog(`❌ ${res?.error || 'error sin mensaje'}`);
    }
  });
});

// sync al abrir tab supabase (listener adicional para el badge de config)
document.querySelectorAll('.tab').forEach(t => {
  t.addEventListener('click', () => {
    if (t.dataset.tab === 'supabase') syncSbPreview();
  });
});

async function syncSbPreview() {
  const tab = await getActiveTab(); if (!tab?.id) return;
  const datos = await enviarMensaje(tab.id, { action: 'get_all_data' });
  if (!datos) return;

  setField('sbPrevSku',      datos.sku     || '(se genera automático desde URL)');
  setField('sbPrevName',     (datos.nombre || '').slice(0, 80));
  setField('sbPrevPrice',    datos.precio  ? `¥ ${datos.precio}` : '—');
  setField('sbPrevImages',   `${(datos.imagenes || []).length} imágenes capturadas`);
  setField('sbPrevVariants', (datos.variantes || []).length
    ? `${datos.variantes.length} variantes`
    : '(pendiente — Bug #5)');

  // JSON preview
  const jsonBox = document.getElementById('jsonPreviewContent');
  if (jsonBox && datos.nombre) {
    jsonBox.textContent = JSON.stringify({
      sku: datos.sku || '(auto)', name: datos.nombre,
      images: (datos.imagenes || []).length + ' urls',
      variants: datos.variantes || []
    }, null, 2);
  }

  // Habilitar botón insertar solo si hay datos
  const btn = document.getElementById('btnInsertSupabase');
  if (btn) btn.disabled = !(datos.nombre && datos.nombre.length > 0);
}

function setSbStatus(type, text) {
  const dot  = document.getElementById('supabaseStatusDot');
  const span = document.getElementById('supabaseStatusText');
  if (dot)  dot.className   = `dot-sb ${type}`;
  if (span) span.textContent = text;
}

function addSbLog(msg) {
  const log  = document.getElementById('sbLog');
  const wrap = document.getElementById('sbLogWrap');
  if (!log) return;
  if (wrap) wrap.style.display = 'block';
  const line       = document.createElement('span');
  line.style.display = 'block';
  line.textContent = `[${new Date().toLocaleTimeString()}] ${msg}`;
  log.appendChild(line);
  log.scrollTop = log.scrollHeight;
}

// ─── FIX: checkPython sin innerHTML ──────────────────────────
async function checkPython() {
  const statusEl = document.getElementById('pythonStatus');
  if (!statusEl) return;
  try {
    await fetch('http://localhost:5001/', { method: 'OPTIONS', signal: AbortSignal.timeout(2500) });
    statusEl.className = 'python-status';
  } catch {
    statusEl.className = 'python-status offline';
  }
}