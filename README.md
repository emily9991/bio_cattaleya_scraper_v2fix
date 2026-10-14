# 🌺 Bio Cattaleya Scraper Pro

Extensión de Chrome (Manifest V3) para extraer productos de **Taobao, Tmall, Tmall HK y 1688** y enviarlos a una base de datos propia. Lee el texto chino de las imágenes con OCR, captura precios y variaciones, y guarda todo en **Supabase**. También puede enviar datos a **Notion**.

Nació para resolver un problema real de operación: publicar en [Bio Cattaleya Skin](#) productos de proveedores chinos sin copiar datos a mano.

> 📸 ![Sidepanel de Bio Cattaleya Scraper Pro mostrando la extracción de un producto](docs/images/sidepanel.png)
---

## 🎯 ¿Por qué existe?

Antes de vender un producto nuevo hay que entenderlo a fondo: qué hace, qué no hace, cómo se usa y en qué orden de la rutina va. Hacer eso a mano (leer la ficha del fabricante, copiar la información y las imágenes, organizarlo todo) me tomaba **cerca de 5 horas por producto**.

Esta extensión lo reduce a **5 minutos o menos**: con un clic captura la información completa de la página del producto (textos, instrucciones de uso, imágenes, precio y variaciones) y la envía a una base de datos en Supabase, lista para trabajarse.

### Cómo se usa la información

1. **Referencia fiel, no copia final.** El texto original se guarda tal cual para conocer las instrucciones de uso reales y completas del producto. Es material de investigación interno.
2. **Voz propia.** A partir de esa referencia reescribo las descripciones con la voz de Bio Cattaleya. 
3. **Imágenes del catálogo oficial.** Trabajo con el permiso de los fabricantes para usar sus fotos. La extensión las guarda organizadas por producto, y luego las transformo con IA generativa para crear los visuales de la tienda.a

**Resultado:** pasar de encontrar un producto a tenerlo investigado y listo para publicar en minutos, no en horas.

---

## ✨ Características

- **Extracción completa**: título, precio, imágenes, video, parámetros y descripción.
- **OCR de chino**: lee texto dentro de imágenes con Tesseract.js (`chi_sim` + `eng`).
- **Precios y variaciones**: precio original, precio con descuento y variaciones del producto.
- **Multi-plataforma**: Taobao, Tmall, Tmall HK, 1688.
- **Supabase**: inserta cada producto en 4 tablas (`products`, `pricing`, `product_suppliers`, `inventory`).
- **Descargas**: imágenes y video en ZIP (JSZip).
- **Exportación a Excel** (SheetJS).
- **Sidepanel**: la interfaz principal vive en el panel lateral de Chrome.

---

## 🗂️ Estructura del repositorio

```
bio_cattaleya_scraper_v2fix/
├── bio_cattaleya_scraper_pro/     # Extensión de Chrome (código principal)
│   ├── manifest.json              # Configuración MV3
│   ├── content.js                 # Extracción y OCR en la página
│   ├── background.js              # Service worker
│   ├── popup.html / popup.js      # Interfaz y lógica
│   ├── sidepanel.html             # Panel lateral
│   ├── src/utils/supabase.js      # Cliente e inserts a Supabase
│   ├── lib/                       # Tesseract (worker, core WASM, chi_sim, eng)
│   ├── icons/
│   ├── server/                    # Servidor Node/Express local (monitor, listados, Excel, logs)
│   ├── webpack.config.cjs
│   ├── eslint.config.js
│   └── .env.example
├── debug_server/                  # Servidor mínimo de logs para desarrollo
├── scripts/setup_dev.sh           # Script de configuración del entorno
├── data/                          # raw/, processed/, exports/
├── docs/context/context_v4_3.md   # Documento de contexto del proyecto
├── .github/                       # CI (ci.yml), CodeQL y Dependabot
├── CHANGELOG.md
└── SECURITY.md
```

---

## 🛠️ Instalación

**Requisitos:** Node.js y Chrome 114 o superior.

```bash
git clone https://github.com/emily9991/bio_cattaleya_scraper_v2fix.git
cd bio_cattaleya_scraper_v2fix/bio_cattaleya_scraper_pro

cp .env.example .env        # completa tus valores
npm install

npm run build:dev           # desarrollo
npm run build:prod          # producción
```

**Cargar en Chrome**

1. Abre `chrome://extensions/` y activa el **Modo desarrollador**.
2. Pulsa **Cargar descomprimida** y selecciona la carpeta `bio_cattaleya_scraper_pro/dist/`.

---

## ⚙️ Configuración

### Extensión

En el sidepanel, pestaña **Config**, ingresa:

| Campo | Descripción |
|-------|-------------|
| Supabase URL | URL de tu proyecto |
| Anon Key | Clave pública (`anon`); nunca uses `service_role` en el cliente |

Las claves se guardan en `chrome.storage.local`, no en el código fuente.

### Variables de entorno (`.env`)

Copia `.env.example` a `.env`. Incluye las credenciales de Notion (`NOTION_TOKEN`, `NOTION_DATABASE_ID`), los nombres de las propiedades de tu base y las URLs del backend local. **Nunca subas tu `.env` al repositorio.**

---

## 🖥️ Servidores locales (opcional)

**Servidor principal** (monitor, guardado de listados y exportación a Excel):

```bash
cd bio_cattaleya_scraper_pro/server
cp .env.example .env
npm install
npm start                   # http://localhost:5001
```

**Servidor de debug** (solo recibe y muestra logs):

```bash
cd debug_server
npm install
node server.js              # http://localhost:5001
```

> ⚠️ Ambos usan el puerto 5001 por defecto. Para correrlos a la vez, cambia `PORT` en el `.env` del servidor principal.

---

## 🔄 Flujo de uso

1. Abre un producto en Taobao, Tmall, Tmall HK o 1688.
2. Abre el sidepanel de la extensión.
3. Ejecuta la extracción por pasos: OCR de la descripción, carga de imágenes, datos del producto, imágenes y video, precio y variaciones.
4. Revisa la vista previa.
5. Guarda en Supabase.

---

## 🗄️ Modelo de datos (Supabase)

El producto se inserta en secuencia en 4 tablas:

| Tabla | Campos clave |
|-------|--------------|
| `products` | sku, name, name_en, description, status, images, price_original_cny, price_discount_cny, variations |
| `pricing` | cost_usd, price_cop, exchange_rate |
| `product_suppliers` | supplier_id, source_url |
| `inventory` | color, size, stock (una fila por variación) |

Los inserts usan `on_conflict=sku` para no duplicar productos, y los textos se sanitizan antes de enviarse.

---

## 🔐 Seguridad

- Claves fuera del código y en `chrome.storage.local`.
- Sanitización de todo texto extraído antes de insertarlo.
- Análisis automático con CodeQL y actualizaciones con Dependabot.
- Para reportar una vulnerabilidad, mira [SECURITY.md](./SECURITY.md).

---

## 🧰 Stack

JavaScript (ES6+) · Chrome Extension MV3 · Webpack + Babel · Tesseract.js · Supabase · Node.js / Express · Notion API · GitHub Actions

---

## 👩‍💻 Autoría

Diseñado y desarrollado por **Emily Tatiana Rojas Leiva** ([@emily9991](https://github.com/emily9991)) para la operación de Bio Cattaleya Skin: arquitectura de la extensión, OCR, integración con Supabase y Notion, servidores locales y pipeline de CI.

---

## 📄 Licencia

© 2026 Emily Tatiana Rojas Leiva. Todos los derechos reservados.

El código se publica para consulta y como muestra de mi trabajo. No se permite copiarlo, modificarlo ni redistribuirlo sin autorización por escrito.