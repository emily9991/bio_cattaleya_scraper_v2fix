# 📦 Bitácora Técnica — Bio Cattaleya Scraper Pro
## Fecha: 20 de Abril
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

## PROYECTO

```
Extensión Chrome MV3: "Bio Cattaleya Scraper Pro" v4.0
Objetivo: Implementar seguridad completa en 5 pasos progresivos
          → COMPLETADO ✅
Stack: Chrome Extension + Express backend + Web Crypto API + Webpack
Estructura: bio_cattaleya_scraper_v2fix/ → build en dist/
```

---

## ESTRUCTURA DEL PROYECTO

```
bio_cattaleya_scraper_v2fix/
├── manifest.json            ✅ MODIFICADO (Paso 1)
├── popup.js                 ✅ MODIFICADO (Paso 2)
├── content.js               ✅ MODIFICADO parcial (TODO línea 1022 → Paso 5)
├── background.js            ✅ Paso 4
├── popup.html               ✅ MODIFICADO — carga config.js antes de popup.js
├── sidepanel.html           ✅ MODIFICADO — carga config.js antes de popup.js
├── tesseract.min.js         sin tocar
├── webpack.config.js        ✅ Paso 5
├── package.json             ✅ scripts build:dev y build:prod
├── .env.example             ✅ ACTUALIZADO — BACKEND_URL, PYTHON_SERVER (sin secretos)
├── .gitignore               ✅ ACTUALIZADO — incluye src/config.js
├── src/
│   ├── config.js            ✅ CREADO — var CONFIG global (no ES module)
│   └── utils/
│       └── secureStorage.js ✅ CREADO — AES-GCM 256bit, PBKDF2 SHA-256 100k iter
├── server/
│   ├── server.js            ✅ helmet, cors, rate-limit, verifyToken
│   ├── .env.example         ✅ JWT_SECRET, NOTION_TOKEN, RATE_LIMIT_*
│   ├── middleware/
│   │   └── auth.js          ✅ verifyToken + validateChromeRuntime
│   └── routes/
│       ├── auth.js          ✅ /token, /validate, /refresh
│       ├── license.js       ✅ /validate-license, /license-status
│       └── notion.js        ✅ /create-page, /database-query, /pages/:pageId
└── dist/                    ✅ BUILD EXITOSO
    ├── background.js        12.8 KiB (ofuscación alta)
    ├── popup.js             43.4 KiB (ofuscación media)
    ├── content.js           51.9 KiB (ofuscación baja)
    ├── secureStorage.js     1.61 KiB
    ├── config.js            342 bytes
    ├── manifest.json        1.06 KiB
    ├── popup.html / sidepanel.html
    └── lib/ + tesseract.min.js
```

---

## VARIABLES Y CONSTANTES DEFINIDAS

```env
# .env.example raíz
NOTION_TOKEN=secret_xxx
NOTION_DATABASE_ID=xxx
NOTION_PROP_TITLE=Nombre
NOTION_PROP_URL=URL Taobao
NOTION_PROP_CNY=Precio CNY
NOTION_PROP_USD=Precio USD
NOTION_PROP_CAT=Categoría
BACKEND_URL=https://localhost:3000
PYTHON_SERVER=http://127.0.0.1:5000
```

```js
// src/config.js (var global, sin export)
CONFIG.PYTHON_SERVER        = 'http://127.0.0.1:5000'
CONFIG.BACKEND_URL          = 'https://localhost:3000'
CONFIG.GOOGLE_TRANSLATE_URL = 'https://translate.googleapis.com/...'
CONFIG.ENDPOINTS.*          = rutas del backend
```

```env
# server/.env.example
PORT=3000
NODE_ENV=development

# --- SEGURIDAD ---
# Genera un string largo y aleatorio para firmar tus tokens
JWT_SECRET=tu_secreto_super_aleatorio_aqui

# --- NOTION API ---
# El token de integración interno (Internal Integration Token)
NOTION_TOKEN=secret_xxxxxxxxxxxxxxxxxxxxxxxxxx

# ID de la base de datos principal de Bio Cattaleya
NOTION_DATABASE_ID=xxxxxxxxxxxxxxxxxxxxxxxxxx

# --- LÍMITES (RATE LIMIT) ---
# Máximo de peticiones por ventana de tiempo (ej. 15 minutos)
RATE_LIMIT_WINDOW=15
RATE_LIMIT_MAX_REQUESTS=100
```

---

## PASOS COMPLETADOS

### ✅ Paso 1 — manifest.json
- `host_permissions`: 3 dominios:
  `[https://api.notion.com/*, https://localhost:3000/*, http://127.0.0.1:5000/*]`
- CSP: `script-src 'self'; object-src 'none'; connect-src 'self'` + 3 dominios
- `externally_connectable`: ELIMINADO (Chrome Web Store rechaza localhost)
- `<all_urls>` conservado en `content_scripts` y `web_accessible_resources` (scraper lo requiere)
- `127.0.0.1:5000` comentado como solo desarrollo

---

### ✅ Paso 2 — Secretos y storage
- `src/config.js`: URLs centralizadas como `var` global (no ES module, sin secretos reales)
- `src/utils/secureStorage.js`:
  - AES-GCM 256bit
  - PBKDF2 SHA-256 100k iteraciones
  - IV único por operación con `crypto.getRandomValues()`
  - IV guardado junto al dato cifrado
  - `clearAll()` solo borra prefijo `bc_secure_`
  - Errores genéricos, no expone objeto error
- `popup.js` línea 6: `RECEPTOR_LOCAL = CONFIG.PYTHON_SERVER`
- `popup.html` + `sidepanel.html`: `<script src="src/config.js">` antes de `popup.js`
- `content.js` línea 1022: TODO para Paso 5 (`content_scripts` no soporta import/ES module)
- `chrome.storage "campos"`: NO cifrado (decisión intencional, datos no sensibles)
- `src/config.js` agregado a `.gitignore`

---

### ✅ Paso 3 — Servidor Express

**Análisis:** Migración de extensión que "habla sola" a una con Centro de Mando (Servidor).  
Propósito: no exponer tokens de Notion.

**Estructura aprobada:**
```
server/
├── package.json
├── .env + .env.example
├── server.js
├── routes/auth.js      → login/token JWT (expiresIn: '24h')
├── routes/license.js   → { valid: true } modo dev + // TODO: PRODUCCIÓN
├── routes/notion.js    → proxy Notion (solo endpoints usados)
└── middleware/auth.js  → valida JWT en cada ruta protegida
```

**Dependencias aprobadas:**
```
express jsonwebtoken cors dotenv helmet express-rate-limit
```

**Reglas proxy Notion:**
- Servidor agrega `NOTION_TOKEN` desde `.env`, extensión nunca lo ve
- NO proxy genérico, solo endpoints que la extensión realmente usa

**Orden de creación ejecutado:**
1. `server/.env.example`
2. `middleware/auth.js`
3. `routes/auth.js`
4. `routes/license.js`
5. `routes/notion.js`
6. `server.js`

---

### ✅ Paso 4 — Validación licencia en background.js
- `validateLicense()` en `chrome.runtime.onStartup` + `setInterval` cada 1h
- Envía: `licenseKey`, `chrome.runtime.id`, `timestamp`
- Usa `secureStorage.js` para guardar `licenseKey`
- Si inválido: `chrome.storage.clear()` + desactivar features premium

---

### ✅ Paso 5 — Webpack + ofuscación
- TerserPlugin + javascript-obfuscator
- DefinePlugin reemplaza CONFIG y resuelve TODOs de `content.js`
- `drop_console: true` en producción
- Output a `/dist`
- Scripts: `build:prod` y `build:dev`

---

## FIXES COMPLETADOS ✅

| Fix | Archivo | Detalle |
|-----|---------|---------|
| `CONFIG is not defined` | `popup.html`, `sidepanel.html` | `src/config.js` → `config.js` |
| Obfuscador renombraba CONFIG | `webpack.config.js` | `reservedNames: ['CONFIG']` en popup + content |
| `process.env` en content script | `content.js ~L460` | → `CONFIG.GOOGLE_TRANSLATE_URL` |
| BOM doble en CSV | `popup.js exportarCSV()` | Removido `'\uFEFF'` del string, queda solo bytes `[0xEF,0xBB,0xBF]` |
| Headers CSV en inglés | `popup.js construirFila()` | Todos los keys traducidos al inglés |
| Columnas consolidadas | `popup.js construirFila()` | `Parametros + CUSTOM_*` → `Product Specifications` |
| OCR paralelo + fallback | `content.js ejecutarOCR()` | `Promise.allSettled` chunks de 3 + `"Image type description"` |

---

## SEGURIDAD APLICADA POR ARCHIVO

```
middleware/auth.js:   verifyToken, 401 sin token, 403 inválido/expirado, sin code fields
server.js:           verifyToken consistente en todas las rutas protegidas
routes/auth.js:      catch genérico en /validate sin diferenciar tipo de error
routes/license.js:   sin console.log de licenseKey
routes/notion.js:    console.error solo loggea status code, sin details en response
background.js:       sin log de licenseKey parcial, sin log de data completa
```

---

## BUILD

```
build:dev  → webpack --mode development  (5.8s, sin minificar)
build:prod → webpack --mode production   (8.6s, minificado + ofuscado)

Warnings esperados (no son errores):
  · tesseract-core-simd-lstm.wasm.js 3.76 MiB (modelo OCR, inevitable)
  · Recomendación code splitting (no aplica a extensiones Chrome)
```

---

## REGLAS ESTABLECIDAS

```
- process.env NO funciona en Chrome runtime → var CONFIG global hasta webpack
- content_scripts NO soporta ES modules → scripts cargados desde HTML usan CONFIG
- chrome.storage "campos" NO se cifra (no sensible, decisión intencional)
- Proxy Notion: servidor inyecta NOTION_TOKEN, extensión nunca lo ve
- Proxy Notion: NO genérico, solo endpoints realmente usados
- Cambios mínimos y quirúrgicos, diff antes de aplicar siempre
- externally_connectable: no usar con localhost (rechazado por Chrome Web Store)
- Nunca loggear tokens, licenseKeys ni respuestas completas de APIs
- Errores de token: mensaje genérico unificado, sin diferenciar expirado vs inválido
- globalThis de debugging protegido por NODE_ENV (resuelto en build por webpack)
```

---

## MEJORAS PENDIENTES (en orden)

| # | Mejora | Estado |
|---|--------|--------|
| 1 | Encoding Excel Mojibake | ✅ Resuelto |
| 2 | Parámetros 参数信息 — columnas dinámicas | ⏳ Siguiente |
| 3 | Variantes SKU + imágenes por color | ⏳ |
| 4 | Paginación con MutationObserver | ⏳ |
| 5 | Carpetas jerárquicas `Productos_BSC/Categoria/Producto/` | ⏳ |
| 6 | UI selector de imágenes — grid con checkboxes en sidepanel | ⏳ |
| 7 | DB maestra — registrar `Nombre\|Tienda\|Link` en servidor | ⏳ |
| 8 | `/token` — validar `chromeRuntimeId` contra DB | ⏳ |
| 9 | `/license` — conectar DB real | ⏳ |

---

## PENDIENTES FUTUROS

```
- content.js línea 1022: TODO marcado para resolver con DefinePlugin de webpack
- routes/auth.js /token: TODO validar chromeRuntimeId contra DB en producción
- routes/license.js: TODO conectar con DB de licencias real en producción
- Webpack: considerar code splitting si content.js crece significativamente
```

---

## PRÓXIMO PASO

```
Confirmar que el build con Diff 1 (headers) + Diff 2 (OCR paralelo) funciona,
luego atacar Mejora #2: parámetros 参数信息.
```

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
_Fin de bitácora — Día 20 de Abril — Bio Cattaleya Scraper Pro v4.0_
