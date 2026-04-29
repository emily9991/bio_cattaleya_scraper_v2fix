# 🐛 Bitácora Técnica — Bio Cattaleya Scraper Pro
## Fecha: 29 de Abril de 2026 | Cierre: 12:36 AM
## Versión: v4.5 | Sesión: Cierre enterprise + debug content.js
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

---

## /compress — RESUMEN EJECUTIVO (token-efficient)

```
PROYECTO: Bio Cattaleya Scraper Pro — Chrome Extension MV3
REPO: emily9991/bio_cattaleya_scraper_v2fix
RAMA: main
CWD: C:\Users\emily\OneDrive\Escritorio\bio_cattaleya_scraper_v2fix\bio_cattaleya_scraper_v2fix
NODE: v22.17.0 | WEBPACK: 5 | SERVIDOR: Express puerto 5001

OBJETIVO SESIÓN:
  1. Cerrar deuda de seguridad enterprise (6 bugs)
  2. Levantar servidor Express
  3. Verificar extensión end-to-end (Mejora #5)
  4. Resolver content.js:309 SyntaxError

ESTADO FINAL SESIÓN:
  - 6/6 bugs enterprise RESUELTOS
  - 0 vulnerabilidades npm activas
  - Servidor Express levantado en 5001 (xlsx comentado)
  - content.js raíz: 138 líneas, LIMPIO (sin wrappers ni sourcemap)
  - Chrome ejecutando versión CACHEADA antigua → error persiste
  - Flujo end-to-end Mejora #5: SIN VERIFICAR
```

---

## VARIABLES Y CONSTANTES CLAVE

```javascript
// content.js raíz (138 líneas)
var listingItems = [];
var listingUrls = new Set();
var listingObserver = null;
var listingDebounceTimer = null;
var _bscExtracting = false;
var BSC_DEBUG = true;

// server/server.js
const PORT = process.env.PORT || 5001;
const baseDir = process.env.BSC_OUTPUT_DIR || path.join(os.homedir(), 'Downloads');
// xlsx: COMENTADO (vulnerabilidad HIGH, endpoint /exportar-excel desactivado)
// /guardar-listado: ACTIVO → genera Downloads/Productos_BSC/{slug}/{fecha}/productos.json

// manifest.json — content_scripts carga desde RAÍZ:
// ["config.js", "content.js"] — SIN prefijo dist/

// webpack.config.js entry points:
// background: './background.js'
// popup: './popup.js'
// content: EXCLUIDO — edición manual únicamente
```

---

## ARQUITECTURA IPC (CONFIRMADA FUNCIONAL)

```
content.js (ISOLATED world)
  → chrome.runtime.sendMessage({action:"execute_mainworld", eventName})
  → background.js
    → chrome.scripting.executeScript({world:"MAIN", func, args:[eventName]})
      → busca __reactFiber$ en card.parentElement
      → itera memoizedProps.children[0] → itemCardData
      → window.dispatchEvent(CustomEvent(eventName, {detail: items[]}))
  → content.js addEventListener(eventName, {once:true})
    → callback(items[]) → listingItems[] → badge actualizado
```

---

## BUGS RESUELTOS — SESIONES ANTERIORES (contexto)

| ID | Título | Estado |
|----|--------|--------|
| BUG-001 | server/.env.production con credenciales en Git | ✅ |
| BUG-002 | Carpetas data/ sin .gitkeep | ✅ |
| BUG-003 | xlsx npm — 2 vulnerabilidades HIGH | ✅ |
| BUG-004 | ExcelJS introduce uuid moderate | ✅ |
| BUG-005 | git filter-branch deprecado | ✅ |
| BUG-006 | pyproject.toml sin packages.find → src/ | ✅ |

---

## 🐛 BUG REGISTRY — Sesión 29 de Abril

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

### BUG-029-001 — npm uninstall exceljs corrido en carpeta equivocada
**Severidad:** MEDIO | **Categoría:** Entorno
**Síntoma:** `npm uninstall exceljs` corrió en `C:\Users\emily` — carpeta de usuario, no del proyecto. `npm audit` reportaba 0 vulnerabilities pero desde el lugar incorrecto.
**Causa raíz:** PowerShell iniciado desde directorio raíz del usuario, sin navegar al CWD correcto del proyecto.
**Fix:**
```powershell
cd "C:\Users\emily\OneDrive\Escritorio\bio_cattaleya_scraper_v2fix\bio_cattaleya_scraper_v2fix"
npm uninstall exceljs
npm audit
```
**Resultado:** `found 0 vulnerabilities` desde la carpeta correcta (356 paquetes auditados).
**Estado:** ✅ RESUELTO

---

### BUG-029-002 — Comandos PowerShell corridos en CMD
**Severidad:** BAJO | **Categoría:** Entorno
**Síntoma:** `"#" no se reconoce como un comando interno o externo`. Comentarios con `#` fallan.
**Causa raíz:** Terminal activa era CMD, no PowerShell. Los comentarios `#` son exclusivos de PowerShell.
**Fix:** Abrir PowerShell desde menú inicio → Ejecutar como administrador. En CMD usar comandos sin `#`.
**Estado:** ✅ RESUELTO (conocimiento adquirido)

---

### BUG-029-003 — git push rechazado por remote con cambios locales no integrados
**Severidad:** MEDIO | **Categoría:** Git
**Síntoma:** `! [rejected] main -> main (fetch first)` al intentar push después del commit de exceljs.
**Causa raíz:** El remote tenía 2 archivos nuevos (`bitacora_dia24_*`) commiteados desde otra sesión. El local no los tenía.
**Fix:**
```powershell
& "C:\Program Files\Git\bin\git.exe" pull origin main --rebase
& "C:\Program Files\Git\bin\git.exe" push origin main
```
**Resultado:** Fast-forward limpio. 2 archivos de bitácora descargados. Push exitoso (`Everything up-to-date`).
**Estado:** ✅ RESUELTO

---

### BUG-029-004 — server.js no arranca: MODULE_NOT_FOUND xlsx
**Severidad:** CRÍTICO | **Categoría:** Dependencias / Servidor
**Síntoma:** `Error: Cannot find module 'xlsx'` al correr `node server.js`. Línea 7 de server.js hace `require('xlsx')` pero xlsx fue eliminado por vulnerabilidades HIGH en sesión anterior.
**Causa raíz:** xlsx eliminado de dependencias pero server.js aún lo importaba en línea 7 y lo usaba en endpoint `/exportar-excel`.
**Análisis:** `/guardar-listado` no usa xlsx — solo `/exportar-excel` lo necesita. La funcionalidad crítica (guardar JSON) puede funcionar sin xlsx.
**Fix — comentar require y desactivar endpoint Excel:**
```powershell
$f = "...\server\server.js"
$c = [System.IO.File]::ReadAllText($f)
$c = $c.Replace(
  "const XLSX = require('xlsx');",
  "// const XLSX = require('xlsx'); // DESACTIVADO - vulnerabilidad HIGH"
)
$c = $c.Replace(
  "        // Crear workbook y worksheet`r`n        const wb = XLSX.utils.book_new();",
  "        return res.status(503).json({ ok: false, error: 'Excel desactivado temporalmente' });`r`n        // const wb = XLSX.utils.book_new();"
)
[System.IO.File]::WriteAllText($f, $c)
```
**Resultado:** Servidor arranca correctamente en `localhost:5001`.
**Pendiente:** Reemplazar xlsx con alternativa sin vulnerabilidades (papaparse + CSV, o exceljs con uuid >= 14).
**Estado:** ✅ RESUELTO parcialmente (Excel desactivado, JSON funcional)

---

### BUG-029-005 — content.js:309 SyntaxError — Chrome ejecuta versión cacheada
**Severidad:** CRÍTICO | **Categoría:** Chrome / Caché
**Síntoma:** `Uncaught SyntaxError: Unexpected token ')' (at content.js:309:2)` — bloquea TODA la extensión. Ninguna función responde.
**Funciones afectadas:** extractor, listados, selector, previo, datos — todo.
**Diagnóstico:**
- content.js raíz en disco: **138 líneas, LIMPIO** (verificado con PowerShell)
- Chrome reporta error en línea **309** → está ejecutando archivo distinto al del disco
- Conclusión: Chrome tiene versión cacheada antigua con wrappers Webpack + sourcemap corrupto
**Fix aplicado:**
1. `chrome://extensions` → Quitar extensión completamente
2. `chrome://settings/clearBrowserData` → limpiar caché
3. Recargar descomprimida desde carpeta interna
**Resultado:** Error persiste — Chrome posiblemente lee desde caché de perfil de usuario.
**Fix pendiente:**
```
chrome.exe --user-data-dir="C:\temp\chrome_test_profile"
```
O verificar en DevTools → Sources → Content Scripts → content.js → cuántas líneas muestra.
**Estado:** ⏳ EN CURSO — no resuelto al cierre de sesión

---

## ESTADO AL CIERRE — 29 Abril 12:36 AM

| Componente | Estado | Notas |
|------------|--------|-------|
| npm audit raíz | ✅ 0 vulnerabilidades | 356 paquetes |
| npm audit /server | ✅ 0 vulnerabilidades | 86 paquetes |
| Repo Git | ✅ Sincronizado | main up-to-date |
| Servidor Express | ✅ Puerto 5001 | xlsx desactivado |
| content.js raíz | ✅ 138 líneas limpio | Sin wrappers |
| Chrome caché | ❌ Versión antigua | Error línea 309 |
| Extensión funcional | ❌ Bloqueada | Por error línea 309 |
| Mejora #5 e2e | ❌ Sin verificar | Bloqueada por arriba |

---

## PRÓXIMOS PASOS INMEDIATOS

```
1. Lanzar Chrome con perfil limpio:
   chrome.exe --user-data-dir="C:\temp\chrome_test_profile"

2. Cargar extensión descomprimida en ese perfil limpio

3. Verificar en DevTools → Sources → Content Scripts → content.js:
   → Debe tener 138 líneas
   → NO debe tener línea 309

4. Si resuelve: verificar badge 30 en keiko.world.tmall.com

5. Si persiste: pegar líneas 305-312 del content.js que Chrome muestra

6. Una vez extensión funcional → verificar Mejora #5:
   □ Badge muestra 30
   □ "💾 Guardar listado" → Downloads/Productos_BSC/{slug}/{fecha}/productos.json
   □ Excel pendiente hasta reemplazar xlsx
```

---

## MEJORAS PENDIENTES

| # | Mejora | Estado |
|---|--------|--------|
| 5 | Carpetas jerárquicas + JSON | ✅ Implementada / ❌ Sin verificar e2e |
| 5b | Excel desde JSON | ⏳ Bloqueada — xlsx necesita reemplazo |
| 6 | UI grid checkboxes imágenes | ⏳ |
| 7 | DB maestra consolidada | ⏳ |
| 8 | Validar chromeRuntimeId en /token | ⏳ |
| 9 | Conectar /license a DB real | ⏳ |

---

## COMANDOS CLAVE DE REFERENCIA

```powershell
# Navegar al CWD correcto SIEMPRE primero
cd "C:\Users\emily\OneDrive\Escritorio\bio_cattaleya_scraper_v2fix\bio_cattaleya_scraper_v2fix"

# Arrancar servidor (terminal separada, dejar abierta)
cd server
node server.js

# Rebuild (desde raíz extensión, NO desde /server)
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
npm run build:dev

# Verificar content.js limpio
(Get-Content "content.js").Count
Get-Content "content.js" | Select-String "webpackBootstrap|sourceMappingURL|appendChild"

# Git en PowerShell
& "C:\Program Files\Git\bin\git.exe" add .
& "C:\Program Files\Git\bin\git.exe" commit -m "mensaje"
& "C:\Program Files\Git\bin\git.exe" push origin main

# Chrome con perfil limpio
chrome.exe --user-data-dir="C:\temp\chrome_test_profile"

# Edición segura de archivo JS
$f = "ruta\archivo.js"
$c = [System.IO.File]::ReadAllText($f)
$c = $c.Replace('string_original', 'string_nuevo')
[System.IO.File]::WriteAllText($f, $c)
```

---

## REGLAS CRÍTICAS DEL PROYECTO

```
- content.js raíz: Chrome carga ESTE. NO dist/content.js.
- dist/content.js: NUNCA compilar con Webpack, NUNCA editar.
- background.js: Editar fuente → rebuild. NUNCA editar dist/background.js.
- var en content scripts: NUNCA const/let — no soportan ES modules.
- return true en onMessage handlers: OBLIGATORIO para respuestas async.
- Webpack entry: content EXCLUIDO — no agregar nunca.
- Deploy: Eliminar extensión + cargar descomprimida. Solo recargar NO invalida caché.
- PowerShell edición JS: WriteAllText() NUNCA WriteAllLines().
- Logging: NUNCA loggear tokens, licenseKeys ni respuestas completas de API.
```

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
_Fin de bitácora — 29 de Abril 2026 12:36 AM — Bio Cattaleya Scraper Pro v4.5_
