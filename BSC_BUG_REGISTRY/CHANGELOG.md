# Changelog

Todos los cambios notables de este proyecto están documentados aquí.  
Formato basado en [Keep a Changelog](https://keepachangelog.com/es/1.0.0/).  
Versionado semántico: [SemVer](https://semver.org/lang/es/).

---

## [Unreleased]

### En progreso
- Mejora #6 — UI grid con checkboxes para selección de imágenes
- Mejora #7 — DB maestra consolidada (leer todos los `productos.json`)
- Mejora #8 — Validar `chromeRuntimeId` en `/token` backend
- Mejora #9 — Conectar `/license` a DB real

---

## [4.5.0] — 2026-04-23

### Added
- **Mejora #5** — Carpetas jerárquicas `Downloads/Productos_BSC/{slug}/{fecha}/`
  - `productos.json` automático como fuente de verdad
  - Exportación `.xlsx` bajo demanda (SheetJS)
  - Descarga de imágenes con toggle ON/OFF (default OFF)
  - Función `getSlug()` para nombre de carpeta desde hostname
- Servidor Express: endpoints `POST /guardar-listado` y `POST /exportar-excel`
- UI sidepanel: botones `btnGuardarListado`, `btnExportExcel`, `toggleDescargarImagenes`
- `SESION_BSC.md` creado en raíz del proyecto

### Fixed
- Puerto mismatch servidor/cliente (3000 vs 5001) — corregido a 5001
- Handler `execute_mainworld` borrado por rebuild → restaurado en fuente `background.js`
- `content.js` eliminado de Webpack entry points (Chrome carga desde raíz, no dist)
- Handler de mensajes usaba parámetro `request` en lugar de `message`
- Webpack wrappers + sourcemap base64 corrompían `content.js` raíz → reescrito limpio

### Changed
- `background.js` ahora contiene handler `guardar_listado` en fuente (sobrevive rebuilds)

---

## [4.4.0] — 2026-04-21

### Added
- Arquitectura IPC final: `content.js` → `sendMessage` → `background.js` → `executeScript(world:"MAIN")`
- Handler `execute_mainworld` en `background.js` que bypasea CSP de Tmall
- Guard `_bscExtracting` para evitar loop infinito en `procesarMutaciones()`
- `extraerItemListadoMainWorld(callback)` con IPC vía background
- `extraerItemListadoClassic()` como fallback para Taobao clásico
- **Mejora #4b** — Debug logs enrutados vía `background.js` (fix CORS)

### Fixed
- Isolated World de Chrome impedía leer React Fiber → resuelto con Main World injection
- CSP de Tmall bloqueaba scripts inline y blob URLs → resuelto con `executeScript world:"MAIN"`
- `return false` en message handlers → cambiado a `return true` (canales async)
- FiberKey buscado en `documentElement` → corregido a `card.parentElement`
- Loop infinito en `procesarMutaciones` → resuelto con guard `_bscExtracting`
- `get_listing_data` devolvía `undefined` desde Service Worker

---

## [4.3.0] — 2026-04-21

### Added
- **Mejora #4** — Paginación con MutationObserver (límite hard 30 items, debounce 300ms)
- Variables de listing: `listingItems[]`, `listingUrls Set`, `listingObserver`, `listingDebounceTimer`
- Badge naranja `#ff5000` vía `background.js`
- Botones popup: `btnExportListado`, `btnClearListado`
- `tryInit(6)` — retry hasta 6×800ms para esperar render de React
- Debug server en `debug_server/server.js` puerto 5001

### Fixed
- `JavascriptObfuscator` eliminado de `webpack.config.js` — crasheaba content script silenciosamente
- Selectores listing Tmall: `[class*="item--"]` → `[class*="cardContainer--"]`
- Dedup por `url.split('?')[0]` → por `String(itemId)` (URLs Tmall comparten base path)
- Typo `res.es_listado` → `res.esListado` (camelCase)
- `extraerItemListadoLegacy` recibía parámetro que no acepta

### Changed
- Build sizes sin obfuscación: `content.js: 319KB`, `popup.js: 193KB`, `background.js: 64KB`

---

## [4.2.0] — 2026-04-21

### Added
- **Mejora #3** — Variantes SKU + imágenes por color
  - `extraerVariantes()` con selectores `[class*="valueItemBig--"]`
  - Columnas CSV nuevas: `Variations`, `Color Images`
- Null-check `addEventListener` para `btnExportListado` y `btnClearListado` en sidepanel

### Fixed
- Encoding Excel: UTF-16 LE con `DataView + ArrayBuffer`, BOM `0xFEFF` little-endian

---

## [4.1.0] — 2026-04-21

### Added
- **Mejora #2** — Parámetros `参数信息` con traducción ZH→EN
  - `traducirClaves()` batch fetch a Google Translate
  - `extraerParametros()` con selector `[class*="generalParamsInfoWrap--"]`
- **Mejora #1** — Encoding Excel UTF-8 BOM robusto (base para UTF-16 LE posterior)

---

## [4.0.0] — 2026-04-20

### Added
- Seguridad completa en 5 pasos:
  - **Paso 1** — `manifest.json`: CSP, host_permissions, eliminado `externally_connectable`
  - **Paso 2** — `src/config.js` global + `secureStorage.js` (AES-GCM 256bit, PBKDF2 100k iter)
  - **Paso 3** — Servidor Express: JWT, helmet, cors, rate-limit, proxy Notion
  - **Paso 4** — `background.js`: validación de licencia cada 1h
  - **Paso 5** — Webpack + TerserPlugin, `build:dev` y `build:prod`
- OCR paralelo: `Promise.allSettled` chunks de 3 + fallback `"Image type description"`
- Headers CSV en inglés
- Columnas consolidadas: `Parametros + CUSTOM_*` → `Product Specifications`
- BOM UTF-8 sin duplicación

### Fixed
- `CONFIG is not defined` — `src/config.js` → `config.js` con `reservedNames: ['CONFIG']`
- `process.env` en content script → `CONFIG.GOOGLE_TRANSLATE_URL`
- BOM doble en CSV

---

[Unreleased]: https://github.com/tu-usuario/bio_cattaleya_scraper_v2fix/compare/v4.5.0...HEAD
[4.5.0]: https://github.com/tu-usuario/bio_cattaleya_scraper_v2fix/compare/v4.4.0...v4.5.0
[4.4.0]: https://github.com/tu-usuario/bio_cattaleya_scraper_v2fix/compare/v4.3.0...v4.4.0
[4.3.0]: https://github.com/tu-usuario/bio_cattaleya_scraper_v2fix/compare/v4.2.0...v4.3.0
[4.2.0]: https://github.com/tu-usuario/bio_cattaleya_scraper_v2fix/compare/v4.1.0...v4.2.0
[4.1.0]: https://github.com/tu-usuario/bio_cattaleya_scraper_v2fix/compare/v4.0.0...v4.1.0
[4.0.0]: https://github.com/tu-usuario/bio_cattaleya_scraper_v2fix/releases/tag/v4.0.0
