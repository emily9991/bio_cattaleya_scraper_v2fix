# 🐛 Bitácora Técnica — Bio Cattaleya Scraper Pro
## Fecha: 23 de Abril de 2026
## Versión: v4.5 | Sesión: Mejora #5 — Carpetas Jerárquicas
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

## STACK / ENTORNO

```
Chrome Extension MV3 + Express + Webpack 5 / Node v22
CWD: C:\Users\emily\OneDrive\Escritorio\bio_cattaleya_scraper_v2fix\bio_cattaleya_scraper_v2fix\
Build: npm run build:dev
PowerShell: Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
Deploy: Eliminar extensión + "Cargar descomprimida" carpeta interna (invalida caché)
Servidor: Express en localhost:5001
```

---

## REGLAS CRÍTICAS DEL PROYECTO

| Regla | Detalle |
|-------|---------|
| `dist\content.js` | NUNCA compilar con Webpack — excluido de entry points. Chrome NO lo carga. |
| `content.js` (raíz) | Este es el que Chrome carga según `manifest.json`. Editar SOLO este. |
| `background.js` (raíz) | Fuente + compilado. Editar aquí y hacer rebuild. |
| `dist\background.js` | Generado por Webpack desde fuente. NUNCA editar directamente. |
| Edición manual | Usar `PowerShell WriteAllText()` — NUNCA `WriteAllLines()` para evitar BOM. |
| Deploy | Eliminar extensión en `chrome://extensions` + "Cargar descomprimida" carpeta interna. Solo recargar NO invalida caché. |
| Cascade / Windsurf | Antes de cambio fuera del scope → describir qué/cómo/impacto + esperar confirmación. |
| Dependencias | No instalar sin avisar primero. |

---

## ESTRUCTURA DE ARCHIVOS CLAVE

```
bio_cattaleya_scraper_v2fix/           ← carpeta padre (NO la raíz de extensión)
  bio_cattaleya_scraper_v2fix/         ← CWD REAL — esta es la extensión
    manifest.json                      ← carga content.js y background.js desde RAÍZ
    content.js                         ← ✅ EL QUE CHROME CARGA (138 líneas, limpio)
    background.js                      ← fuente del service worker
    config.js                          ← cargado antes que content.js
    sidepanel.html                     ← UI, cargada desde raíz
    popup.js                           ← fuente del sidepanel (227 KiB compilado)
    dist/
      background.js                    ← compilado por Webpack (72.2 KiB)
      content.js                       ← IGNORADO POR CHROME — no editar
      popup.js                         ← compilado
    server/
      server.js                        ← Express puerto 5001
```

**CRÍTICO:** `manifest.json` carga `content_scripts: ["config.js", "content.js"]` desde RAÍZ — sin prefijo `dist/`. `dist\content.js` es IGNORADO por Chrome.

---

## WEBPACK CONFIG ACTUAL

```javascript
entry: {
  background: { import: './background.js' },
  popup: './popup.js'
  // content EXCLUIDO — edición manual únicamente
}
// Chrome carga: sidepanel.html desde RAÍZ (no desde dist/)
// sidepanel.html carga: config.js + popup.js
```

---

## ARQUITECTURA IPC FINAL (FUNCIONANDO)

```
content.js (ISOLATED world)
  → chrome.runtime.sendMessage({action:"execute_mainworld", eventName})
  → background.js
    → chrome.scripting.executeScript({target:{tabId}, world:"MAIN", func, args:[eventName]})
      → func() en MAIN world:
          busca __reactFiber$[random] en firstCard.parentElement
          itera children[0] → itemCardData → itemId, title, itemUrl, image
          window.dispatchEvent(new CustomEvent(eventName, {detail: items[]}))
  → content.js addEventListener(eventName, {once:true})
    → callback(items[]) → listingItems[] poblado → badge actualizado
```

**Por qué esta arquitectura:** Tmall CSP bloquea scripts inline, blob URLs y cualquier `unsafe-inline`. `chrome.scripting.executeScript` con `world:"MAIN"` es ejecutado como código privilegiado de extensión — la CSP de la página no aplica.

---

## FIBER PATH CONFIRMADO

```
Selector cards:     [class*="cardContainer--"]
FiberKey location:  card.parentElement (NO documentElement, NO la card misma)
FiberKey prefix:    __reactFiber$ (dinámico por sesión, ej: __reactFiber$2gz3ok7tjmx)
Data path:          parentElement[fk].memoizedProps.children[0][i].props.itemCardData
Campos OK:          itemId ✅ | title ✅ | itemUrl ✅ | image ✅
Precio:             card.querySelector('[class*="price--"]').innerText
Confirmado con:     executeScript MAIN world → cards:30, fk encontrado ✅
```

---

## MEJORA #5 — Carpetas Jerárquicas Productos_BSC/ ✅

### Estructura de carpetas implementada
```
Downloads/
  Productos_BSC/
    {slug-tienda}/           ← ej: keiko-world-tmall
      YYYY-MM-DD/            ← ej: 2026-04-23
        productos.json       ← automático (fuente de verdad)
        {slug}_{fecha}.xlsx  ← bajo demanda (SheetJS)
        imagenes/
          {itemId}.jpg       ← toggle ON/OFF (default OFF)
```

### Decisiones de diseño

| Decisión | Alternativa descartada | Motivo |
|----------|----------------------|--------|
| Slug del dominio como carpeta | ID numérico del shop | Más legible |
| YYYY-MM-DD (una carpeta por día) | YYYY-MM-DD_HH-mm | Menos carpetas, más limpio |
| JSON como fuente de verdad | Solo Excel | JSON permite regenerar; sirve para #7 DB maestra |
| Excel generado desde JSON | Excel directo | Si Excel se corrompe, regeneras desde JSON |
| Toggle imágenes OFF por defecto | Auto-descarga | Optimiza tiempo — no siempre se necesitan |

### Función getSlug() — implementación exacta
```javascript
function getSlug(hostname) {
  return hostname
    .replace(/\.(com|cn|net|org)(\.cn)?$/, '')
    .replace(/\./g, '-');
}
// "keiko.world.tmall.com" → "keiko-world-tmall"
// Fecha: new Date().toISOString().slice(0, 10) → "2026-04-23"
```

### Archivos modificados en Mejora #5

**1. `server/server.js`**
- `POST /guardar-listado` → crea carpeta + `productos.json`
- `POST /exportar-excel` → lee JSON → genera `.xlsx` (SheetJS)
- Dependencia instalada: `xlsx` en `/server`
- Puerto corregido: `3000` → `5001`

**2. `background.js` (fuente) → rebuild ejecutado ✅**
- Handler `execute_mainworld`: `chrome.scripting.executeScript` MAIN world (restaurado al fuente)
- Handler `guardar_listado`: `fetch POST localhost:5001/guardar-listado`
- Parámetro listener: `message` (no `request`) — corregido

**3. `content.js` raíz — edición quirúrgica PowerShell**
- Función `extraerItemListadoMainWorld` corregida:
  - ANTES: `document.createElement('script') + appendChild` (bloqueado por CSP Tmall)
  - AHORA: `chrome.runtime.sendMessage({action:'execute_mainworld', eventName})`

**4. `webpack.config.js`**
- Eliminado `content` de entry points

**5. `sidepanel.html` + `popup.js`**
- `btnGuardarListado` (línea 891)
- `btnExportExcel` (línea 895)
- `toggleDescargarImagenes` (línea 901, default OFF)
- `getSlug()` implementada
- Progreso: `"Descargando X/30 imágenes..."`
- Usa handler existente `descargar_archivo` (NO modificado)

### Handlers activos en background.js
```
execute_mainworld  → chrome.scripting.executeScript MAIN world ✅
guardar_listado    → fetch POST localhost:5001/guardar-listado ✅
save_license / get_license_status / validate_license_now
update_badge       → chrome.action.setBadgeText
debug_log          → fetch localhost:5001/log
descargar_archivo  → chrome.downloads
```

### manifest.json permissions
```
activeTab, scripting, storage, downloads, tabs, sidePanel, alarms
host_permissions: *.taobao.com, *.tmall.com, *.1688.com, *.world.tmall.com
```

---

## ESTADO DE content.js RAÍZ (versión limpia final)

```
138 líneas | Sin webpack wrappers | Sin sourcemap | Sin appendChild
```

**Variables globales:**
```javascript
var listingItems = [];          // array de productos extraídos
var listingUrls = new Set();    // deduplicación por itemId
var listingObserver = null;     // MutationObserver activo
var listingDebounceTimer = null;
var _bscExtracting = false;     // guard anti-loop
var BSC_DEBUG = true;
```

**Funciones:**
```
bscLog(source, msg, data, level)        → logging + relay a background
extraerPrecioCard(card)                  → precio desde DOM
extraerItemListadoMainWorld(callback)    → IPC → sendMessage execute_mainworld
extraerItemListado()                     → orquestador fiber vs classic
extraerItemListadoClassic()              → fallback DOM clásico
procesarMutaciones()                     → debounced por MutationObserver
iniciarListingObserver()                 → activa observer en body
detenerListingObserver()                 → desconecta observer
obtenerDatosListado()                    → {items[], total}
limpiarListado()                         → reset + badge 0
detectarPaginaListado()                  → {es_listado, enlaces_item, detalle}
```

**onMessage handlers:**
```
get_listing_data       → reply(obtenerDatosListado())   return true
clear_listing          → reply(limpiarListado())         return true
start_listing_observer → iniciarListingObserver()        return true
```

---

## 🐛 BUG REGISTRY — Día 23

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

### BUG-001 — Puerto mismatch servidor/cliente (3000 vs 5001)
**Severidad:** ALTO | **Archivo:** `server/server.js`
**Síntoma:** Servidor corría en puerto 3000 pero cliente llamaba al 5001. Botones no funcionaban. Llamadas `fetch` fallaban silenciosamente.
**Causa raíz:** `server.js` tenía `app.listen(3000)` mientras `background.js` hacía `fetch('http://localhost:5001/...')`.
**Fix:**
```javascript
// ANTES:
const PORT = process.env.PORT || 3000;
// DESPUÉS:
const PORT = process.env.PORT || 5001;
```
**Diagnóstico:** Verificar output de `node server.js` — debe decir exactamente `localhost:5001`.
**Estado:** ✅ RESUELTO

---

### BUG-002 — Handler execute_mainworld borrado por rebuild de Webpack
**Severidad:** CRÍTICO | **Archivo:** `background.js` fuente / `dist\background.js`
**Síntoma:** IPC `execute_mainworld` dejó de funcionar después de `npm run build:dev`. `listingItems` se quedaba en `total: 0` en loop infinito. Log mostraba `firstCard found, calling MainWorld` pero nunca retornaba items.
**Causa raíz:** El handler había sido agregado directamente en `dist\background.js` (edición manual). Webpack regeneró el dist borrando ese handler.
**Cómo se detectó:** `Select-String "execute_mainworld" dist\background.js` → no encontrado.

**Fix — agregar en `background.js` fuente (nunca en dist\):**
```javascript
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
            itemId: d.itemId, title: d.title,
            url: d.itemUrl, image: d.image
          });
        }
      } catch(e) {}
      window.dispatchEvent(new CustomEvent(evName, { detail: items }));
    },
    args: [eventName]
  });
  return true;
}
```
**Lección:** NUNCA editar `dist\background.js` manualmente. Siempre editar fuente → rebuild.
**Estado:** ✅ RESUELTO

---

### BUG-003 — content.js en Webpack entry point pisaba la versión manual
**Severidad:** CRÍTICO | **Archivo:** `webpack.config.js`
**Síntoma:** Cada `rebuild` regeneraba `dist\content.js` desde el source, perdiendo ediciones manuales. Post-rebuild, `extraerItemListadoMainWorld` volvía a usar `appendChild` (bloqueado por CSP).
**Causa raíz:** `webpack.config.js` tenía `content` como entry point.
**Cómo se detectó:** Revisando líneas 100-120 de `dist\content.js` después del rebuild → función usaba `document.createElement('script')`.
**Fix:**
```javascript
// webpack.config.js
entry: {
  background: { import: './background.js' },
  popup: './popup.js'
  // content: EXCLUIDO — no agregar nunca
}
```
**Estado:** ✅ RESUELTO

---

### BUG-004 — Handler de mensajes usaba parámetro "request" en lugar de "message"
**Severidad:** ALTO | **Archivo:** `background.js`
**Síntoma:** Handler `execute_mainworld` no procesaba los mensajes aunque estaba en el código.
**Causa raíz:** El listener usaba `message` como nombre de parámetro, pero el nuevo handler fue escrito con `request`.
```javascript
// ANTES (roto):
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  if (request.action === "execute_mainworld") { ... }
})
// DESPUÉS (correcto):
chrome.runtime.onMessage.addListener(function(message, sender, sendResponse) {
  if (message.action === "execute_mainworld") { ... }
})
```
**Lección:** Verificar el nombre del parámetro del listener existente antes de agregar handlers nuevos. En este proyecto es `message`, no `request`.
**Estado:** ✅ RESUELTO

---

### BUG-005 — CSP de Tmall bloqueaba scripts inline y blob URLs
**Severidad:** CRÍTICO | **Archivo:** `content.js`
**Síntoma fase 1:**
```
Executing inline script violates Content Security Policy directive 'script-src 'self' ...'
```
**Síntoma fase 2 (intento con blob URL):**
```
Loading blob: URL violates CSP
```
**Causa raíz:** `extraerItemListadoMainWorld()` inyectaba código via `document.createElement('script') + appendChild`. Tmall tiene CSP estricta que bloquea ambos métodos.
**Fix — reemplazar completamente por IPC:**
```javascript
// content.js — función reemplazada:
function extraerItemListadoMainWorld(callback) {
  var eventName = 'bsc_mainworld_response_' + Date.now();
  window.addEventListener(eventName, function(e) {
    callback(e.detail);
  }, { once: true });
  chrome.runtime.sendMessage({ action: "execute_mainworld", eventName: eventName });
}
```
**Por qué funciona:** `chrome.scripting.executeScript` con `world:"MAIN"` es ejecutado por el navegador como código privilegiado de extensión — la CSP de la página no aplica.
**Estado:** ✅ RESUELTO

---

### BUG-006 — Se editaba dist\content.js en lugar de content.js raíz
**Severidad:** CRÍTICO | **Archivos:** `dist\content.js`, `content.js` raíz
**Síntoma:** Todos los cambios a `dist\content.js` no tenían efecto en Chrome. Seguía ejecutando el código viejo.
**Causa raíz:** `manifest.json` carga:
```json
"content_scripts": [{ "js": ["config.js", "content.js"] }]
```
Sin prefijo `dist/` → Chrome carga `content.js` de la raíz. Toda la sesión inicial se estuvo editando el archivo equivocado.
**Diagnóstico:**
```powershell
Get-Content "manifest.json" | Select-String "content"
Test-Path "content.js"   # debe devolver True
```
**Lección:** Confirmar siempre con el manifest cuál archivo carga Chrome antes de editar.
**Estado:** ✅ RESUELTO

---

### BUG-007 — Función extraerItemListado() perdió su declaración
**Severidad:** ALTO | **Archivo:** `content.js` raíz
**Síntoma:** Error de sintaxis. Cuerpo de la función flotando sin contenedor.
**Causa raíz:** Cálculo incorrecto de índices en reemplazo por líneas con PowerShell. La línea `function extraerItemListado() {` quedó fuera del rango y fue eliminada.
**Fix:**
```powershell
$path = "content.js"
$lines = Get-Content $path
$fix = @'
function extraerItemListado() {
  bscLog("extraerItemListado", "function called", { url: location.href });
  var firstCard = document.querySelector('[class*="cardContainer--"]');
'@
$lines[103] = $fix  # línea 104 en 1-indexed
[System.IO.File]::WriteAllLines((Resolve-Path $path), $lines, [System.Text.Encoding]::UTF8)
```
**Estado:** ✅ RESUELTO

---

### BUG-008 — Webpack wrappers + sourcemap base64 corrompían content.js raíz
**Severidad:** CRÍTICO | **Archivo:** `content.js` raíz
**Síntoma:** `Uncaught SyntaxError: Unexpected token ')' at content.js:309` — pero el archivo real tenía solo 138 líneas.
**Causa raíz:**
1. `content.js` raíz contenía wrappers de Webpack (`/******/ (() => {`) con cierres malformados
2. Sourcemap base64 gigante embebido al final (`//# sourceMappingURL=data:application/json;base64,...`)
3. El sourcemap contenía el código viejo con `appendChild` — Chrome lo ejecutaba desde ahí
4. Cierres duplicados + punto y coma extra en líneas 300-301 producían el error de sintaxis

**Fix — reescribir el archivo completo desde cero:**
```powershell
$path = "content.js"
$content = @'
[contenido limpio sin webpack wrappers ni sourcemap]
'@
[System.IO.File]::WriteAllText((Resolve-Path $path), $content, [System.Text.Encoding]::UTF8)
```
**Verificación:**
```powershell
(Get-Content "content.js").Count           # debe ser ~138
Get-Content "content.js" | Select-String "appendChild|sourceMappingURL|webpackBootstrap"
# NO debe devolver nada
```
**Estado:** ✅ RESUELTO

---

### BUG-009 — Caché agresivo de Chrome no se invalida con solo recargar
**Severidad:** ALTO | **Entorno:** Chrome
**Síntoma:** Después de editar `content.js` y recargar la extensión, Chrome seguía ejecutando la versión vieja. Error `line 309` persistía con archivo de 138 líneas.
**Causa raíz:** Chrome cachea agresivamente los content scripts. El botón "recargar" en `chrome://extensions` no es suficiente.
**Fix:**
```
chrome://extensions → botón "Quitar" (eliminar completamente)
→ "Cargar descomprimida" → seleccionar carpeta interna
Cerrar todas las pestañas del sitio objetivo
Abrir nueva pestaña limpia
```
**Nota:** Este proceso debe repetirse cada vez que se edite `content.js`, `background.js` o cualquier archivo cargado por el manifest.
**Estado:** ⏳ Identificado — aplicar en próxima sesión si persiste

---

### BUG-010 — return false en message handler (histórico, confirmado día 23)
**Severidad:** ALTO | **Archivo:** `content.js`
**Fix:** Cambiar `return false` → `return true` en todos los handlers async:
```javascript
if (act === 'get_listing_data') { reply(obtenerDatosListado()); return true; }
if (act === 'clear_listing') { reply(limpiarListado()); return true; }
iniciarListingObserver(); reply({ status: 'ok', activo: true }); return true;
```
**Regla:** `return true` mantiene canal abierto. `return false` lo cierra inmediatamente.
**Estado:** ✅ RESUELTO

---

## RESULTADO VERIFICADO

```
30 items extraídos de keiko.world.tmall.com con:
  title:  string chino ✅
  url:    https://detail.tmall.com/item.htm?id=... ✅
  image:  https://gw.alicdn.com/... ✅
  price:  "¥ 1000+人付款" ✅
  source: "tmall_fiber" ✅

Test manual en DevTools service worker con tabId=2047105921:
  → result: cards:30, fk:"__reactFiber$2gz3ok7tjmx" ✅
```

---

## ESTADO AL CIERRE DE SESIÓN

| Componente | Estado | Notas |
|------------|--------|-------|
| `content.js` raíz | ✅ Reescrito limpio | Sin wrappers ni sourcemap |
| `background.js` handler `execute_mainworld` | ✅ Presente y correcto | En fuente + dist |
| `background.js` handler `guardar_listado` | ✅ Compilado | fetch POST 5001 |
| Fiber path en MAIN world | ✅ Confirmado | cards:30, fk encontrado |
| Servidor Express | ✅ Corriendo en 5001 | Dejar terminal abierta |
| `webpack.config.js` | ✅ Sin content entry | content.js no se compilará |
| UI Sidepanel | ✅ Botones presentes | btnGuardarListado, btnExportExcel, toggle |
| `SESION_BSC.md` | ✅ Creado en raíz | |
| Error `Unexpected token ')' line 309` | ⏳ Persiste | Chrome posiblemente lee desde caché de perfil |
| Flujo end-to-end | ❌ Pendiente | Extensión recargada pero no verificada |
| Datos en sidepanel | ❌ Pendiente | |

---

## MEJORAS PENDIENTES — Estado final día 23

| # | Mejora | Estado |
|---|--------|--------|
| 5 | Carpetas jerárquicas `Productos_BSC/{slug}/{fecha}/` + JSON + Excel + imágenes | ✅ Implementada, sin probar e2e |
| 6 | UI grid checkboxes selección de imágenes | ⏳ |
| 7 | DB maestra consolidada (leer todos los `productos.json`) | ⏳ |
| 8 | Validar `chromeRuntimeId` en `/token` backend | ⏳ |
| 9 | Conectar `/license` a DB real | ⏳ |

---

## DIAGNÓSTICOS ÚTILES

```powershell
# Verificar qué archivo carga Chrome
Get-Content "manifest.json" | Select-String "content|background|service_worker"
Test-Path "content.js"
Test-Path "dist\content.js"

# Verificar contenido sin contaminación
Get-Content "content.js" | Select-String "appendChild|sourceMappingURL|webpackBootstrap|execute_mainworld"
# execute_mainworld debe aparecer, appendChild NO

# Verificar líneas específicas con numeración
Get-Content "content.js" | ForEach-Object { $i = 1 } { if ($i -ge 95 -and $i -le 115) { "{0}: {1}" -f $i, $_; $i++ } else { $i++ } }

# Verificar encoding BOM
$bytes = [System.IO.File]::ReadAllBytes("content.js")
Write-Host "Primeros 3 bytes:" $bytes[0] $bytes[1] $bytes[2]
# Si devuelve 239 187 191 → hay BOM UTF-8 → puede romper el parser
# Debe empezar con ASCII del primer carácter del archivo

# Test manual fiber desde DevTools service worker
chrome.tabs.query({url: "*://*.tmall.com/*"}, function(tabs) {
  console.log('tabs:', tabs.map(t => t.id + ' ' + t.url));
});
chrome.scripting.executeScript({
  target: { tabId: TU_TAB_ID },
  world: "MAIN",
  func: function() {
    var cards = document.querySelectorAll('[class*="cardContainer--"]');
    var parent = cards[0] ? cards[0].parentElement : null;
    var fk = parent ? Object.keys(parent).find(k => k.startsWith('__reactFiber$')) : null;
    return { cards: cards.length, fk: fk };
  }
}, function(results) {
  console.log('[TEST-MW]', JSON.stringify(results));
});
// Resultado esperado: cards:30, fk:"__reactFiber$xxxxxxx"
```

---

## PRÓXIMOS PASOS INMEDIATOS

```
1. chrome://extensions → recargar extensión (o eliminar + recargar descomprimida)
2. keiko.world.tmall.com → abrir sidepanel
3. Verificar badge muestra 30 productos
4. Click "💾 Guardar listado"
5. Verificar Downloads/Productos_BSC/keiko-world-tmall/2026-04-23/productos.json
6. Click "📊 Exportar Excel" → verificar .xlsx en misma carpeta

Si persiste error line 309:
  1. chrome://settings/clearBrowserData → Imágenes y archivos en caché
  2. Verificar BOM: $bytes[0] $bytes[1] $bytes[2] → esperado: 99 111 110 (c-o-n)
  3. Click en link content.js:309 en DevTools → ver source real que Chrome tiene
  4. Lanzar Chrome con perfil limpio: chrome.exe --user-data-dir="C:\temp\chrome_test_profile"
```

---

## ERRORES IGNORABLES EN CONSOLA DE TMALL

```
GET https://cm.mediav.com/?mvdid=888&type=2 net::ERR_BLOCKED_BY_CLIENT
  → AdBlocker bloqueando tracker de Tmall. Ignorar.

GET https://losvc.alibaba-inc.com:64556/api/basic net::ERR_CONNECTION_REFUSED
  → Servicio interno de Alibaba inaccesible fuera de su red. Ignorar.

Executing inline script violates CSP...
  → Scripts de TMALL, no de nuestra extensión. Ignorar.
  ⚠️ SOLO importa si extraerItemListadoMainWorld genera este error → IPC roto.

[Violation] 'message' handler took Xms
  → Performance warnings de Tmall. Ignorar.
```

---

## COMANDOS DE REFERENCIA RÁPIDA

```powershell
# Arrancar servidor (dejar terminal abierta)
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
cd "C:\Users\emily\OneDrive\Escritorio\bio_cattaleya_scraper_v2fix\bio_cattaleya_scraper_v2fix\server"
node server.js
# Debe decir: localhost:5001

# Rebuild (desde raíz del proyecto, NO desde /server)
cd "C:\Users\emily\OneDrive\Escritorio\bio_cattaleya_scraper_v2fix\bio_cattaleya_scraper_v2fix"
npm run build:dev

# Editar content.js (PowerShell — siempre WriteAllText con path absoluto)
[System.IO.File]::WriteAllText(
  "C:\Users\emily\OneDrive\Escritorio\bio_cattaleya_scraper_v2fix\bio_cattaleya_scraper_v2fix\content.js",
  $content,
  [System.Text.Encoding]::UTF8
)

# Reemplazo seguro de string en archivo
$f = "C:\Users\emily\...\content.js"
$c = [System.IO.File]::ReadAllText($f)
$c = $c.Replace('string_original', 'string_nuevo')
[System.IO.File]::WriteAllText($f, $c)
```

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
_Fin de bitácora — Día 23 de Abril — Bio Cattaleya Scraper Pro v4.5_
