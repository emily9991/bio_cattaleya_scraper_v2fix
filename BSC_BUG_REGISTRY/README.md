# Bio Cattaleya Scraper Pro

> Chrome Extension MV3 para extracción de productos de Taobao, Tmall y 1688.

![Version](https://img.shields.io/badge/version-4.5-blue)
![Platform](https://img.shields.io/badge/platform-Chrome%20MV3-green)
![Node](https://img.shields.io/badge/node-v22-brightgreen)
![Status](https://img.shields.io/badge/status-active-success)

---

## ¿Qué hace?

Extrae datos de productos (título, precio, imágenes, variantes SKU, parámetros) desde tiendas Taobao, Tmall y 1688, y los exporta a **CSV (UTF-16 LE)** y **Excel (.xlsx)** compatibles con caracteres chinos en Windows.

Funcionalidades principales:

- Scraping de producto individual con OCR de imágenes de descripción (Tesseract.js)
- Listing paginado con MutationObserver (hasta 30 productos por sesión)
- Traducción automática ZH→EN de parámetros (Google Translate API)
- Exportación CSV / Excel con encoding correcto para Excel Windows
- Guardado jerárquico: `Downloads/Productos_BSC/{tienda}/{fecha}/`
- Arquitectura IPC segura para bypasear CSP de Tmall (executeScript MAIN world)

---

## Stack

| Componente | Tecnología |
|-----------|-----------|
| Extensión | Chrome MV3 (Manifest V3) |
| Build | Webpack 5 + Node v22 |
| OCR | Tesseract.js |
| Servidor local | Express (puerto 5001) |
| Exportación Excel | SheetJS (xlsx) |
| Crypto | Web Crypto API (AES-GCM 256bit) |

---

## Quickstart

### Requisitos
- Node.js v22+
- Chrome / Chromium

### Instalación

```bash
git clone https://github.com/tu-usuario/bio_cattaleya_scraper_v2fix.git
cd bio_cattaleya_scraper_v2fix/bio_cattaleya_scraper_v2fix

# Instalar dependencias de la extensión
npm install

# Instalar dependencias del servidor
cd server && npm install && cd ..

# Copiar configuración
cp .env.example .env
cp src/config.example.js src/config.js
# Editar src/config.js con tus valores
```

### Build

```bash
# Desarrollo (con sourcemap)
npm run build:dev

# Producción (minificado)
npm run build:prod
```

> ⚠️ PowerShell requiere: `Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass`

### Cargar en Chrome

1. `chrome://extensions` → activar **Modo desarrollador**
2. **Cargar descomprimida** → seleccionar carpeta `bio_cattaleya_scraper_v2fix/` (la interior)
3. Para actualizar: eliminar extensión → volver a cargar (el simple "recargar" no invalida caché)

### Servidor local

```bash
cd server
node server.js
# → http://localhost:5001
```

---

## Estructura del proyecto

```
bio_cattaleya_scraper_v2fix/        ← raíz del repo
  bio_cattaleya_scraper_v2fix/      ← extensión (CWD real)
    manifest.json
    content.js                      ← cargado por Chrome desde RAÍZ (no dist/)
    background.js                   ← fuente del service worker
    popup.js                        ← fuente del sidepanel
    config.js                       ← generado desde src/config.js (en .gitignore)
    sidepanel.html
    src/
      config.js                     ← secrets locales (en .gitignore)
      utils/secureStorage.js
    dist/                           ← generado por Webpack (en .gitignore parcial)
      background.js
      popup.js
      content.js                    ← IGNORADO por Chrome
    server/
      server.js                     ← Express puerto 5001
      .env.example
    docs/
      context/                      ← contextos comprimidos de sesión
      bug-registry/                 ← registro de bugs por fecha
      architecture/                 ← diagramas y decisiones técnicas
```

---

## Reglas críticas del proyecto

> Leer antes de modificar cualquier archivo.

| Regla | Detalle |
|-------|---------|
| `content.js` raíz | Chrome carga este, NO `dist/content.js`. Editar solo este con PowerShell `WriteAllText()`. |
| `dist/content.js` | NUNCA compilar con Webpack. NUNCA editar directamente. |
| `background.js` fuente | Editar aquí y hacer rebuild. Nunca editar `dist/background.js`. |
| `var` en content scripts | Nunca usar `const/let` — los content scripts no soportan ES modules. |
| Logging | Nunca loggear tokens, licenseKeys ni respuestas completas de API. |
| Deploy | Eliminar extensión + "Cargar descomprimida" para invalidar caché de Chrome. |

---

## Documentación

- [`docs/context/`](docs/context/) — contextos comprimidos por sesión de desarrollo
- [`docs/bug-registry/`](docs/bug-registry/) — registro completo de bugs resueltos
- [`docs/architecture/`](docs/architecture/) — arquitectura IPC, diagramas del sistema
- [`docs/decisions/`](docs/decisions/) — ADRs (Architecture Decision Records)
- [`CHANGELOG.md`](CHANGELOG.md) — historial de versiones

---

## Licencia

Uso privado. Ver [LICENSE](LICENSE).
