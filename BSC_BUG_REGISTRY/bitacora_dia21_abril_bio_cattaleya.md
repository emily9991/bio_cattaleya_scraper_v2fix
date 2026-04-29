# 🐛 Bitácora Técnica — Bio Cattaleya Scraper Pro
## Fecha: 21 de Abril de 2025
## Versiones del día: v4.1 → v4.2 → v4.3 → v4.4 → v4.5
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

## STACK / ENTORNO

```
Chrome Extension MV3 + Express backend + Web Crypto API + Webpack 5.106.2
Node.js: v22.17.0
CWD: C:\Users\emily\OneDrive\Escritorio\bio_cattaleya_scraper_v2fix\bio_cattaleya_scraper_v2fix\
Build: npm run build:dev / build:prod
PowerShell: Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass (requerido antes de npm)
Estructura doble nivel → build en dist/
Debug server: debug_server/server.js puerto 5001
```

---

## REGLAS DEL PROYECTO

```
- var CONFIG global (no ES module) — src/config.js copiado a dist/
- content_scripts NO soportan ES modules — usar var, NUNCA const/let
- Nunca loggear tokens, licenseKeys ni respuestas completas
- Cambios mínimos y quirúrgicos, diff antes de aplicar
- Selectores siempre con [class*="prefix--"] para sobrevivir CSS Modules hasheados
- La laptop no tiene F12/F5 estándar — usar clic derecho → Inspeccionar y botón ⟳
- Ediciones al source: bio_cattaleya_scraper_v2fix\content.js (NO src\content.js)
- Escribir archivos: SIEMPRE [System.IO.File]::WriteAllLines("$PWD\content.js", $result)
  NUNCA Set-Content -NoNewline con arrays
- Comandos JS van en consola del navegador, comandos PowerShell van en PowerShell
- NUNCA usar Windsurf/agentes externos para editar content.js — destruyen el archivo
```

---

## ⚠️ ADVERTENCIA CRÍTICA — Historial de daños (Windsurf)

```
Windsurf dañó content.js múltiples veces durante esta sesión:
  - Reemplazó el source (~6MB) con versión mínima de 9KB / 286 líneas
  - Copió dist minificado sobre el source
  - Corrompió encoding con cleanups agresivos

Solución aplicada: Recuperar dist desde Chrome DevTools → Sources → Save as → dist\content.js
REGLA PERMANENTE: NUNCA usar Windsurf/agentes externos para editar content.js
```

---

## EVOLUCIÓN DE VERSIONES DEL DÍA

| Versión | Cambio principal |
|---------|-----------------|
| v4.1 | Mejoras #2 y #3. Mejora #4 (MutationObserver) en progreso |
| v4.2 | Mejora #4 implementada. Null-check fix. Debug server detectado con CORS |
| v4.3 | Obfuscación removida. Selectores Tmall investigados. React Fiber confirmado |
| v4.4 | Isolated World identificado como causa raíz. Main World injection diseñada |
| v4.5 | Main World injection aplicada. Dist recuperado de DevTools. Bugs de CSP resueltos |

---

## MEJORAS IMPLEMENTADAS ✅

### Mejora #1 — Encoding Excel UTF-16 LE
BOM UTF-8 `\uFEFF` string literal aplicado. Luego escalado a UTF-16 LE con `DataView` + `ArrayBuffer`, BOM `0xFEFF` little-endian. Función centralizada `descargarArchivo()`.
Aplicado en: `exportarCSVListado`, `exportarCSV`, `exportarListadoCSV`, `descargarArchivo`, `aU`.

```javascript
function descargarArchivo(filename, csvString) {
  var buf = new ArrayBuffer(2 + csvString.length * 2);
  var view = new DataView(buf);
  view.setUint16(0, 0xFEFF, true); // BOM UTF-16 LE
  for (var i = 0; i < csvString.length; i++) {
    view.setUint16(2 + i * 2, csvString.charCodeAt(i), true);
  }
  var blob = new Blob([buf], {type: 'text/csv;charset=utf-16le'});
  var url = URL.createObjectURL(blob);
  var a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
```

### Mejora #2 — Parámetros 参数信息
- `traducirClaves(claves, callback)` — batch fetch a `CONFIG.GOOGLE_TRANSLATE_URL`, un solo request, fallback a clave china original
- `extraerParametros(callback)` — selector `[class*="generalParamsInfoWrap--"]` → items `[class*="generalParamsInfoItem--"]` → lee `title` attr. Traduce ZH→EN
- En `get_all_data` handler: `return true` (async), envuelto en callback de `extraerParametros`
- `popup.js` `construirFila()`: `producto.parametros` serializado en `Product Specifications`

### Mejora #3 — Variantes SKU + imágenes por color
- `extraerVariantes()` → `{ dimensiones: [{nombre, valores:[{vid, nombre, imagen}]}], imagenesPorColor: {nombre: url} }`
- Selector colores: `[class*="valueItemBig--"]` + `data-vid` + `[class*="valueItemImg--"]`
- Selector tallas: `[class*="valueItem--"]` solo si `itemsBig.length === 0` (guardia anti-substring-match)
- URL normalizada: `.replace('_.webp','').replace(/^\/\//,'https://')`
- `construirVariaciones(dimensiones)` → `"颜色分类: 湛蓝|粉色 || 尺码: S|M"`
- `construirImagenesColor(map)` → `"湛蓝::https://... | 粉色::https://..."`
- Columnas CSV nuevas: `Variations`, `Color Images`

### Mejora #4 — Paginación MutationObserver ✅ implementado / 🔴 Tmall pendiente

**Variables globales:**
```javascript
var listingItems = [];        // bW[]
var listingUrls  = new Set(); // bX Set
var listingObserver = null;   // bY
var listingDebounceTimer = null; // bZ
```

**Funciones:**
```
c0() / extraerFiberData(el)        — ❌ inútil en isolated world
c1() / extraerPrecioCard(card)
c2() / extraerItemListado()        — 🔴 → reescrita como async + main world injection
c3()  fallback clásico individual
c4() / procesarMutaciones()        — debounced, async-safe
c5() / iniciarListingObserver()    — observer en itemsContainer--N46DVUSb
c6() / detenerListingObserver()
c7() / getDatosListado()
c8() / limpiarListado()
```

- Límite hard 30 items, debounce 300ms, deduplicación por `String(itemId)` (NO por `url.split('?')[0]`)
- Badge naranja `#ff5000` vía `background.js`
- Botones popup: `btnExportListado`, `btnClearListado`

### Mejora #4b — Debug logs vía background.js ✅
- CORS fix: `bscLog()` en `content.js` → `chrome.runtime.sendMessage({action:'debug_log', entry})` → `background.js` → `fetch localhost:5001`

---

## BUILD SIZES

| Archivo | Con obfuscación | Sin obfuscación |
|---------|----------------|-----------------|
| content.js | 73.6 KB → 70.9 KB | 319 KB → 909 KB (dev+sourcemap) |
| popup.js | 47.7 KB | 193 KB |
| background.js | 15.3 KB | 64 KB |

---

## 🐛 BUG REGISTRY — Día 21

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

### BUG-001 — CONFIG is not defined
**Severidad:** CRÍTICO | **Archivo:** `popup.html`, `sidepanel.html`
**Síntoma:** `Uncaught ReferenceError: CONFIG is not defined` al abrir popup o sidepanel.
**Causa raíz:** `src/config.js` no llegaba al bundle como variable global. HTML referenciaba ruta incorrecta.
**Fix:**
1. Copiar `src/config.js` → `dist/config.js` como archivo estático
2. `reservedNames: ['CONFIG']` en `webpack.config.js`
3. `<script src="config.js">` ANTES del bundle en `popup.html` y `sidepanel.html`
**Estado:** ✅ RESUELTO

---

### BUG-002 — process.env en content script
**Severidad:** ALTO | **Archivo:** `content.js ~L460`
**Síntoma:** `Uncaught ReferenceError: process is not defined`
**Causa raíz:** Content scripts no tienen acceso a `process.env` de Node.
**Fix:** `process.env.GOOGLE_TRANSLATE_URL` → `CONFIG.GOOGLE_TRANSLATE_URL`
**Estado:** ✅ RESUELTO

---

### BUG-003 — BOM doble en CSV / Encoding Excel roto
**Severidad:** ALTO | **Archivo:** `popup.js — exportarCSV()`
**Síntoma fase 1:** BOM duplicado (`ï»¿ï»¿`). Fix `\uFEFF` aplicado.
**Síntoma fase 2:** Excel 365 Windows mostraba `å‡¯èŽ‰æ¬§` — `\uFEFF` no suficiente.
**Causa raíz:** Excel Windows interpreta CSV como Windows-1252 salvo UTF-16 LE con BOM correcto.
**Fix final:** UTF-16 LE con `DataView + ArrayBuffer`, BOM `0xFEFF` little-endian (ver Mejora #1).
**Estado:** ✅ RESUELTO

---

### BUG-004 — Headers CSV en chino
**Severidad:** MEDIO | **Archivo:** `popup.js — construirFila()`
**Fix:** Mapa de traducción de keys internos al inglés.
**Estado:** ✅ RESUELTO

---

### BUG-005 — Columnas Parametros y CUSTOM_* fragmentadas
**Severidad:** MEDIO | **Archivo:** `popup.js — construirFila()`
**Fix:** Consolidar en una sola columna `Product Specifications` con formato `Key: Value | Key: Value`.
**Estado:** ✅ RESUELTO

---

### BUG-006 — OCR secuencial / timeout
**Severidad:** ALTO | **Archivo:** `content.js — ejecutarOCR()`
**Fix:** `Promise.allSettled` en chunks de 3 imágenes en paralelo. Fallback `"Image type description"`.
```javascript
var chunk = imagenes.slice(i, i + 3);
var results = await Promise.allSettled(chunk.map(img => procesarOCR(img)));
```
**Estado:** ✅ RESUELTO

---

### BUG-007 — Cannot read properties of null — addEventListener en sidepanel
**Severidad:** CRÍTICO | **Archivo:** `popup.js`
**Síntoma:** `Cannot read properties of null (reading 'addEventListener')` al cargar `sidepanel.html`.
**Causa raíz:** `btnExportListado` y `btnClearListado` existen en `popup.html` pero NO en `sidepanel.html`. `popup.js` se carga en ambos.
**Fix:** Null-guards antes de cada `addEventListener`:
```javascript
if (btnExportListado) btnExportListado.addEventListener('click', ...);
if (btnClearListado) btnClearListado.addEventListener('click', ...);
```
**Estado:** ✅ RESUELTO

---

### BUG-008 — CORS bloqueando debug logs desde content script
**Severidad:** MEDIO | **Archivos:** `content.js`, `background.js`, `manifest.json`
**Síntoma:** `Access to fetch at 'http://localhost:5001/log' blocked by CORS policy` en Tmall.
**Causa raíz:** Content scripts heredan CSP de la página host. Tmall bloquea conexiones a localhost.
**Fix:**
```javascript
// content.js — bscLog() usa:
chrome.runtime.sendMessage({action: 'debug_log', entry: entry});

// background.js — handler:
if (request.action === 'debug_log') {
  fetch('http://localhost:5001/log', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify(request.entry)
  }).catch(function() {});
  return true;
}
```
`manifest.json`: agregar `http://localhost:5001/*` y `http://127.0.0.1:5001/*` a `host_permissions` y CSP.
**Estado:** ✅ RESUELTO

---

### BUG-009 — JavascriptObfuscator crashea content script silenciosamente
**Severidad:** CRÍTICO | **Archivo:** `webpack.config.js`
**Síntoma:** Log `[BSC] Content script iniciado en:` aparece pero `window.__bscLoaded` queda `undefined`. Script se inyecta pero crashea antes de ejecutar código real.
**Causa raíz:** `WebpackObfuscator` con `rotateStringArray: true` generaba funciones decoder (`a2b()`, `a2_0x53dd()`, `a2_0x5c1a()`) con patrón `while(!![])` que fallaban silenciosamente en el sandbox de content scripts MV3.

**Evidencia en bundle:**
```javascript
function a2b(e,f){e=e-0x1e9;var g=a2a()...}
function a2a(){var a=['detectarPaginaListado\x20result',...]}
(function(f,g){...while(!![]){try{...}catch(k){...}}}}(a2a,0xb399d));
```

**Fix:** Eliminar completamente `JavascriptObfuscator` de `webpack.config.js`.
```javascript
// ELIMINADO:
const WebpackObfuscator = require('webpack-obfuscator');
// ...y las 3 instancias en plugins[]
```
**Lección:** `webpack-obfuscator` con `rotateStringArray: true` es incompatible con el sandbox de content scripts de Chrome Extension MV3. Nunca usar obfuscación en content scripts.
**Estado:** ✅ RESUELTO

---

### BUG-010 — Content script no se inyecta en subdominios Tmall
**Severidad:** ALTO | **Archivo:** `manifest.json`
**Síntoma:** `window.__bscLoaded` → `undefined` en `keiko.world.tmall.com`.
**Fix:**
```json
"matches": [
  "*://*.taobao.com/*",
  "*://*.tmall.com/*",
  "*://*.1688.com/*",
  "*://*.world.tmall.com/*"
],
"host_permissions": [
  "*://*.taobao.com/*",
  "*://*.tmall.com/*",
  "*://*.1688.com/*",
  "http://localhost:5001/*",
  "http://127.0.0.1:5001/*"
]
```
**Estado:** ✅ RESUELTO (script se inyecta) → ver BUG-011 para crash posterior

---

### BUG-011 — Selectores listing Tmall incorrectos
**Severidad:** ALTO | **Archivo:** `content.js`
**Síntoma:** Observer devuelve solo 2 elementos (falsos positivos). 0 productos capturados en `keiko.world.tmall.com`.
**Diagnóstico en consola:**
```javascript
document.querySelectorAll('[class*="item--"]').length    // → 2 (falsos positivos)
document.querySelectorAll('[class*="cardContainer--"]').length // → 30 (productos reales)
```
**Causa raíz:** Selectores diseñados para Taobao clásico. Tiendas Tmall usan React con CSS Modules hasheados completamente diferentes. Productos NO tienen `<a href>` — React click handlers.
**Fix:** Estrategia dual — React Fiber para Tmall + fallback clásico.
**Estado:** ✅ Selectores corregidos → ver BUG-012 para Isolated World

---

### BUG-012 — extraerItemListado typos y errores de lógica
**Severidad:** ALTO | **Archivo:** `content.js`

| Sub-bug | Causa | Fix |
|---------|-------|-----|
| `extraerItemListado(el)` → params | `procesarMutaciones` pasaba `el` pero función no acepta params | Renombrar a `extraerItemListadoLegacy()` sin argumento |
| `res.es_listado` | Typo snake_case | → `res.esListado` (camelCase) |
| Dedup por `url.split('?')[0]` | Todas las URLs Tmall comparten `https://detail.tmall.com/item.htm` → descartaba 29/30 | Dedup por `String(itemId)` |
| Loop candidatos en `procesarMutaciones` | Loop incorrecto | Reemplazado por llamada directa a `extraerItemListado()` |
| Guard bloqueaba extracción | `if (cards.length === 0) return` → cards llegaban a 114ms, tryInit antes | Invertir: `if (cards.length > 0) { extraerItemListado() }` |

**Estado:** ✅ RESUELTO

---

### BUG-013 — tryInit no reintentaba / cards no encontradas
**Severidad:** ALTO | **Archivo:** `content.js`
**Síntoma:** Observer iniciaba pero `extraerItemListado()` encontraba 0 items. Cards aparecen a ~114ms.
**Fix:** `tryInit(6)` — retry hasta 6×800ms + `setTimeout(extraerItemListado, 500)` dentro del retry.
**Estado:** ✅ RESUELTO

---

### BUG-014 — CRÍTICO: Isolated World de Chrome — React Fiber inaccesible
**Severidad:** CRÍTICO | **Archivo:** `content.js`
**Síntoma:** `extraerItemListado` siempre retornaba `classic_result {total: 0}` en Tmall con 30 cards presentes.

**Log confirmatorio:**
```
[BSC] extraerItemListado classic_result {total: 0}  ← nunca llega a tmall_fiber
```

**Causa raíz:** Chrome MV3 content scripts corren en **Isolated World** — acceso al DOM pero NO a propiedades JavaScript de los elementos. Las propiedades `__reactFiber$xxx` son propiedades JS en el mundo principal.

**Evidencia:**
```
En consola del navegador (Main World): __reactFiber$wmsotnrdwri existe ✅ | reactItems: 30 ✅
En content script (Isolated World):   fk = undefined | reactItems = null ❌
```

**Solución — Main World injection via `<script>` + `CustomEvent`:**
```javascript
function extraerItemListadoMainWorld(callback) {
  var eventName = '__bsc_fiber_' + Date.now();
  window.addEventListener(eventName, function handler(e) {
    window.removeEventListener(eventName, handler);
    callback(e.detail || []);
  }, { once: true });
  var script = document.createElement('script');
  script.textContent = '(function() {' +
    'var result = [];' +
    'var _fc = document.querySelector(\'[class*="cardContainer--"]\');' +
    'var _fp = _fc ? _fc.parentElement : null;' +
    'var fk = _fp ? (Object.keys(_fp).find(function(k){ return k.indexOf(\'__reactFiber\')===0; })||"") : "";' +
    'if (!fk) { window.dispatchEvent(new CustomEvent("' + eventName + '",{detail:[]})); return; }' +
    'var containers = document.querySelectorAll(\'[class*="container--"]\');' +
    'containers.forEach(function(container) {' +
      'var fiber = container[fk];' +
      'if (!fiber) return;' +
      'var mp = fiber.memoizedProps;' +
      'if (!mp || !mp.children) return;' +
      'var arr = mp.children[0];' +
      'if (!Array.isArray(arr)) return;' +
      'arr.forEach(function(r) {' +
        'var d = r && r.props && r.props.itemCardData;' +
        'if (d && d.itemId) result.push({itemId:String(d.itemId),title:d.title||"",itemUrl:d.itemUrl||"",image:d.image||"",index:result.length});' +
      '});' +
    '});' +
    'window.dispatchEvent(new CustomEvent("' + eventName + '",{detail:result}));' +
  '})()';
  (document.head || document.documentElement).appendChild(script);
  script.remove();
}
```

**Por qué funciona:** El `<script>` se ejecuta en Main World donde existen las props React. Los datos cruzan via `CustomEvent` — los eventos sí cruzan el boundary entre mundos.

**Estado:** ✅ Diseñado y aplicado → ver BUG-015 para CSP bloqueando inline scripts

---

### BUG-015 — CSP de Tmall bloquea inline scripts
**Severidad:** CRÍTICO | **Archivo:** `content.js — extraerItemListadoMainWorld()`
**Síntoma:**
```
Executing inline script violates the following Content Security Policy directive:
"script-src 'self' 'wasm-unsafe-eval'..."
sha256-Du+IvsenIFGpDekR/nmFlNvVHimfhZxY7Y5+tINb+YM= required
```
**Intento fallido — blob URL:**
```
Loading blob:https://keiko.world.tmall.com/... violates CSP
```
**Solución definitiva:** `chrome.scripting.executeScript` con `world: "MAIN"` desde `background.js`. Bypasea completamente el CSP de la página.
- Requiere: `permission "scripting"` en manifest ✅
- Requiere: `host_permissions` para `*.tmall.com` ✅
- Disponible: Chrome 95+, MV3 ✅
**Estado:** ✅ Solución identificada y aplicada

---

### BUG-016 — FiberKey buscado en documentElement (incorrecto)
**Severidad:** ALTO | **Archivo:** `dist/content.js`
**Síntoma:** `[BSC-MW] fk: "" cardParent: false` → `[BSC-MW] no fiberKey` → items devueltos: `[]`
**Causa raíz:** Código buscaba fiberKey en `document.documentElement`. React en Tmall attachea los fiber keys en el `parentElement` de cada card.

**Diagnóstico en consola Main World de Tmall:**
```javascript
var fc = document.querySelector('[class*="cardContainer--"]');
var fp = fc.parentElement;
Object.keys(fp).filter(k => k.startsWith('__reactFiber'))
// → ['__reactFiber$94osfq029ii']
```

**Fix:**
```javascript
var _fc = document.querySelector('[class*="cardContainer--"]');
var _fp = _fc ? _fc.parentElement : null;
var fk = _fp ? (Object.keys(_fp).find(function(k){
  return k.indexOf('__reactFiber') === 0;
}) || '') : '';
```

**Verificación:** `[BSC-MW] fk: __reactFiber$94osfq029ii cardParent: true` ✅
**Estado:** ✅ RESUELTO

---

### BUG-017 — Path incorrecto en script inyectado — child[0] vs children[0][i]
**Severidad:** ALTO | **Archivo:** `dist/content.js`
**Síntoma:** Script inyectado corría pero `result.length = 0`. fiberKey encontrado correctamente.
**Causa raíz:**
```javascript
// ❌ INCORRECTO
let child = props && props.children && props.children[0];
let item = child && child[0] && child[0].props && child[0].props.itemCardData;

// ✅ CORRECTO — children[0] es un Array de 30 elementos, iterar:
var arr = mp.children[0];
if (!Array.isArray(arr)) return;
arr.forEach(function(child_item) {
  var d = child_item && child_item.props && child_item.props.itemCardData;
  if (d && d.itemId) result.push({ ... });
});
```
**Estado:** ✅ RESUELTO

---

### BUG-018 — Loop infinito en procesarMutaciones — _bscExtracting faltante
**Severidad:** ALTO | **Archivo:** `dist/content.js`
**Síntoma:** Observer disparaba `extraerItemListado()` repetidamente. `listingItems.length` nunca aumentaba.
**Causa raíz:** La inyección del `<script>` causaba mutaciones DOM que re-disparaban el observer. Sin guard de concurrencia.
**Fix:**
```javascript
var _bscExtracting = false;

function procesarMutaciones() {
  if (_bscExtracting) return;  // ← GUARD
  if (listingItems.length >= 30) return;
  var cards = document.querySelectorAll('[class*="cardContainer--"]');
  if (cards.length > 0) {
    _bscExtracting = true;
    extraerItemListado();
  }
}

// En callback de extraerItemListadoMainWorld:
extraerItemListadoMainWorld(function(items) {
  _bscExtracting = false;  // ← RESET
  // ... procesar items
});
```
**Estado:** ✅ RESUELTO

---

### BUG-019 — get_listing_data devuelve undefined desde Service Worker
**Severidad:** ALTO | **Archivo:** `content.js`
**Síntoma:** `chrome.tabs.sendMessage(tabId, {action:'get_listing_data'}, r => console.log(r))` → `undefined`
**Causa raíz:** `return false` en el message handler cierra el canal inmediatamente antes de que `reply()` complete.
**Fix:**
```javascript
// ANTES:
if (act === 'get_listing_data') { reply(obtenerDatosListado()); return false; }
// DESPUÉS:
if (act === 'get_listing_data') { reply(obtenerDatosListado()); return true; }
// Igual para: clear_listing, start_listing_observer
```
**Regla:** `return true` en `onMessage.addListener` mantiene el canal abierto (async). `return false` lo cierra inmediatamente.
**Estado:** ✅ RESUELTO

---

### BUG-020 — PowerShell: errores al editar JS
**Severidad:** ENTORNO | **Archivos:** `dist/content.js`

| Sub-bug | Causa | Fix |
|---------|-------|-----|
| `$newFunc = '...'` → Token inesperado | PowerShell interpreta contenido como código PS | Usar heredoc `@'...'@` para strings multilinea |
| `-replace` no hace match | `-replace` usa regex, caracteres `( ) \ "` necesitan escaping doble | Usar `.Replace()` (método .NET) con strings literales |
| `WriteAllLines` corrompe JS minificado | Agrega newlines adicionales entre elementos | Usar `[System.IO.File]::WriteAllText($f, $c)` |
| `Substring` fuera de rango | No verificar `$line.Length` antes de leer | `$line.Substring(N, $line.Length - N)` |

**Estado:** ✅ RESUELTO (reglas documentadas)

---

### BUG-021 — content.js inflado de 909KB a 14MB
**Severidad:** INFRAESTRUCTURA | **Archivo:** `content.js` (source)
**Síntoma:** Build exitoso pero `content.js` en dist pesa 14.4 MiB. Babel warning: "deoptimised styling (exceeds 500KB)".
**Causa raíz:** `\r\n` dobles introducidos al ensamblar el archivo con `WriteAllText` sobre líneas con mixed line endings.
**Fix:**
```powershell
$raw = [System.IO.File]::ReadAllText("content.js", [System.Text.Encoding]::UTF8)
$raw = $raw -replace "`r`n", "`n"; $raw = $raw -replace "`r", "`n"
$lines = $raw -split "`n"
$clean = [System.Collections.Generic.List[string]]::new()
foreach ($line in $lines) {
    if ($line -match '^\s*//' -and $line -match 'Ã|â|Â' -and $line.Length -gt 100) {}
    else { $clean.Add($line) }
}
$resultado = $clean -join "`r`n"
[System.IO.File]::WriteAllText("content.js", $resultado, [System.Text.Encoding]::UTF8)
```
**Estado:** ✅ RESUELTO

---

### BUG-022 — SyntaxError encadenados en dist por parches parciales
**Severidad:** CRÍTICO | **Archivo:** `dist/content.js`

| Bug | Síntoma | Causa | Fix |
|-----|---------|-------|-----|
| #1 | `SyntaxError: missing ) after argument list (content.js:103:1337)` | Webpack compiló template literal `${eventName}` como `.concat()` con comillas mal escapadas: `new CustomEvent(\"".concat(eventName, "\",` | `$c.Replace('new CustomEvent(\"".concat(eventName, "\",', 'new CustomEvent(eventName,')` |
| #2 | `SyntaxError: Unexpected token ')' (content.js:103:1305)` | Comilla suelta residuo del `.concat` eliminado: `}));\n    })()\n  ");` | `$c.Replace('}));\n    })()\n  ");', '}));\n    })()\n  );')` |
| #3 | `SyntaxError: Invalid or unexpected token (content.js:103:24)` | Múltiples parches acumulados + CSP bloqueando inline scripts (causa real) | Reescribir `content.js` completo. Ver BUG-015. |

**Estado:** ✅ RESUELTO (reescritura completa)

---

### BUG-023 — chrome.tabs undefined en consola de página web
**Severidad:** ENTORNO | 
**Síntoma:** `Cannot read properties of undefined (reading 'query')` al ejecutar `chrome.tabs.query(...)` en DevTools.
**Causa raíz:** `chrome.tabs` solo disponible en background service worker y extension popup. NO en consola de páginas web ni en content scripts.
**Fix:** Abrir consola desde `chrome://extensions/` → Service Worker. En esa consola sí está disponible `chrome.tabs`.
**Estado:** ✅ (conocimiento adquirido)

---

### BUG-024 — PowerShell bloquea npm
**Severidad:** ENTORNO
**Síntoma:** `npm : No se puede cargar el archivo npm.ps1 porque la ejecución de scripts está deshabilitada`
**Fix:**
```powershell
# Por sesión:
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
# Permanente para usuario:
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```
**Estado:** ✅ RESUELTO con workaround

---

### BUG-025 — Puerto 5001 EADDRINUSE
**Severidad:** ENTORNO | **Archivo:** `debug_server/server.js`
**Síntoma:** `Error: listen EADDRINUSE: address already in use :::5001`
**Fix:**
```
1. netstat -ano | findstr :5001  → obtener PID
2. taskkill /PID [numero] /F
3. Reiniciar con npm start
```
**Estado:** ✅ RESUELTO

---

## ESTADO DIST RECUPERADO — Final del día

```
dist\content.js: recuperado de Chrome DevTools
Source content.js: 500 líneas, ~20KB — versión mínima funcional (sin lógica producto individual)
```

| Función | Línea dist | Estado |
|---------|-----------|--------|
| `extraerItemListadoMainWorld()` | 95 | ✅ Main World injection vía CustomEvent |
| `extraerItemListado()` | ~110 | ✅ async + fallback classic |
| `extraerItemListadoClassic()` | — | ✅ selectores DOM clásicos |
| `procesarMutaciones()` | 188 | ✅ async-safe + guard `_bscExtracting` |
| `detectarPaginaListado()` | 240 | ✅ |
| `iniciarListingObserver()` | ~200 | ✅ observer activo |
| `tryInit(6)` | — | ✅ retry 800ms + setTimeout 500ms |

---

## 🧠 CONOCIMIENTO DOM TMALL CONFIRMADO

**Página de prueba:** `keiko.world.tmall.com/shop/view_shop.htm`

```
Total <a> con href: 94 (ninguno es producto)
Total <img>: 1129
Imágenes alicdn: 281
Tarjetas de producto: 30 con [class*="cardContainer--"]
iframes: 0
Links a detail.tmall.com: 0 (React click handlers, no <a href>)
Cards aparecen: ~114ms después de load
```

**Árbol DOM confirmado:**
```
div.container--JVhREvQT  ← parentElement de cardContainer, TIENE __reactFiber
  → memoizedProps.children[0] = Array(30) React elements
  → children[0][N].props.itemCardData = { itemId, title, itemUrl, image,
                                          discountPrice(ENCRIPTADO), vagueSold365 }
  └── div.cardContainer--CwazTl0O
        ├── img (lazy load — usar .src)
        ├── div.scrollerWrapper--Kq_ANpjB → skuSelector → skuItems → skuItemImage
        └── div.descContainer--Emd1UYe_
              ├── div.title--GExDBPUi   ← TÍTULO (innerText)
              ├── div.tags--ejYQ37YS    ← descuentos
              └── div.priceContainer--bYyqyco_
                    ├── span.priceIcon--tK8JRhg3  ← "¥"
                    ├── span.text-price            ← PRECIO OFUSCADO
                    └── div.count--nrEC6YGF        ← "1000+人付款"
```

**Selectores CSS seguros:**
```javascript
'[class*="cardContainer--"]'    // tarjeta de producto (30 por página)
'[class*="container--"]'        // wrapper con fiberKey de React
'[class*="itemsContainer--"]'   // grid principal
'[class*="title--"]'            // título del producto
'[class*="priceContainer--"]'   // contenedor de precio
'[class*="text-price"]'         // precio (puede estar vacío — encriptado)
'[class*="descContainer--"]'    // descripción
```

**Variables globales Tmall disponibles:**
```
window.g_config  → shopId, shopName, sellerId, evaluates, shopLocation
window.Light     → estado chat/wangwang (no útil para scraping)
discountPrice    → ENCRIPTADO: [1_7ij1w4tp#51#Tk5OT...] — usar innerText visible
```

**Dedup correcto:** por `String(itemId)` NUNCA por `url.split('?')[0]`
**Links:** `https://detail.tmall.com/item.htm?id=XXXXXXX`
**Observer target:** `itemsContainer--N46DVUSb` (fallback: `body`)

**Ejemplo de datos extraídos confirmados:**
```json
{
  "itemId": 807479430962,
  "title": "KEIKO 高级感刺绣牛仔外套女2026早春新款文艺风宽松显瘦夹克上衣",
  "itemUrl": "https://detail.tmall.com/item.htm?id=807479430962&xxc=shop&...",
  "image": "https://gw.alicdn.com/imgextra/O1CN017UfKb12FpXbezAzOE-250118929.jpg"
}
```

---

## CHECKLIST DE VERIFICACIÓN POST-FIX

```
□ 1. No hay SyntaxError en consola al cargar la página
□ 2. Aparece: [BSC] Content script iniciado en: https://...tmall.com/...
□ 3. Aparece: [BSC] listing detectarPaginaListado result {es_listado: true}
□ 4. Aparece: [BSC-MW] fk: __reactFiber$[algo] cardParent: true
□ 5. Aparece: [BSC-MW] result: 30
□ 6. Aparece: [BSC] extraerItemListado tmall_result {total: 30}
□ 7. Aparece: [BSC] listing: limite de 30 items alcanzado, observer detenido
□ 8. En Service Worker console:
     chrome.tabs.query({url:"*://*.tmall.com/*"}, function(tabs) {
       chrome.tabs.sendMessage(tabs[0].id, {action:'get_listing_data'}, function(r) {
         console.log('Total:', r.total, 'Item0:', r.items[0].title);
       });
     });
     → Total: 30, Item0: [título en chino]
```

---

## PROCESO DE RECUPERACIÓN si content.js se daña

```
1. Abrir Chrome con la extensión cargada (aunque sea dañada)
2. Abrir cualquier página Tmall donde la extensión haya corrido
3. DevTools → Sources → Content scripts → [nombre extensión] → content.js
4. Clic derecho → Save as → guardar en dist\content.js
5. ⚠️ Chrome guarda SIN BOM — usar WriteAllText con UTF8
6. Verificar tamaño: debe ser >100KB
7. Recargar extensión en chrome://extensions/
```

---

## MEJORAS PENDIENTES — Estado final día 21

| # | Mejora | Estado |
|---|--------|--------|
| 4 | Listing Tmall — Main World injection | 🔴 EN CURSO (dist guardado, pendiente verificar logs) |
| 4b | Debug logs vía background.js | ✅ Aplicado |
| 5 | Carpetas jerárquicas `Productos_BSC/` | ⏳ |
| 6 | UI selector imágenes grid checkboxes | ⏳ |
| 7 | DB maestra `Nombre\|Tienda\|Link` | ⏳ |
| 8 | `/token` validar `chromeRuntimeId` | ⏳ |
| 9 | `/license` conectar DB real | ⏳ |

---

## ERRORES DE PÁGINA (no son bugs del proyecto)

```
GET https://cm.mediav.com/?mvdid=888&type=2 net::ERR_BLOCKED_BY_CLIENT
  → AdBlocker bloqueando tracker de Tmall. Ignorar.

GET https://losvc.alibaba-inc.com:64556/api/basic net::ERR_CONNECTION_REFUSED
  → Servicio interno de Alibaba inaccesible fuera de su red. Ignorar.

[Violation] 'message' handler took 165ms
[Violation] Forced reflow while executing JavaScript took 32ms
  → Performance warnings de Tmall. No son nuestros. Ignorar.
```

---

## COMANDOS ÚTILES DE REFERENCIA

```powershell
# Rebuild dev
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
npm run build:dev

# Rebuild limpio
Remove-Item "dist\content.js" -Force
npm run build:dev

# Ver líneas con numeración
$lines = Get-Content "content.js"
$lines[$start..($start+30)] | ForEach-Object -Begin {$i=$start+1} -Process {"$i`t$_"; $i++}

# Buscar función
Select-String -Path "content.js" -Pattern "function nombreFuncion" | Select-Object LineNumber, Line

# Verificar patrón en dist
Select-String -Path "dist\content.js" -Pattern "setTimeout.*extraerItemListado.*500" | Select-Object LineNumber, Line

# Editar línea específica (índice = línea-1)
$lines = Get-Content "content.js"
$lines[1997] = '    nuevo contenido'
[System.IO.File]::WriteAllLines("$PWD\content.js", $lines)

# Reemplazo seguro de string
$c = [System.IO.File]::ReadAllText("dist\content.js")
$c = $c.Replace('string_original', 'string_nuevo')
[System.IO.File]::WriteAllText("dist\content.js", $c)

# Debug server
node debug_server/server.js
# Puerto 5001 ocupado:
netstat -ano | findstr :5001
taskkill /PID [numero] /F
```

---

## LECCIONES APRENDIDAS

```
1. NUNCA usar webpack-obfuscator en content scripts — crashea silenciosamente en Chrome Extension MV3
2. NUNCA usar const/let en content scripts — usar var siempre
3. NUNCA hacer fetch directo a localhost desde content script — rutear vía background.js
4. NUNCA usar Windsurf/agentes externos para editar content.js
5. Los precios en Tmall tienda están ofuscados — usar innerText del contenedor visible
6. Los links de producto en Tmall tienda NO son <a href> — están en React Fiber
7. Los hashes CSS en Tmall cambian con cada deploy — siempre usar [class*="prefix--"]
8. El encoding correcto para Excel Windows es UTF-16 LE, no UTF-8 con BOM
9. React fiberKey es dinámico por sesión — nunca hardcodear el sufijo
10. return true en chrome.runtime.onMessage.addListener es OBLIGATORIO para respuestas async
11. Verificar SIEMPRE en Service Worker console, no en consola de página web
12. PowerShell para JS: siempre .Replace() literal, nunca -replace regex
13. Para multilinea en PowerShell: siempre @'...'@ heredoc
14. Nunca parchear síntomas — cuando hay 3+ SyntaxErrors encadenados, reescribir completo
15. CSP de sitios modernos bloquea TODO lo inline — solución limpia: executeScript world:MAIN
```

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
_Fin de bitácora — Día 21 de Abril — Bio Cattaleya Scraper Pro v4.1→v4.5_
