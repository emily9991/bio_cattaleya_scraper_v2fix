Aquí está el README actualizado:

```markdown
# 🌺 Bio Cattaleya Scraper Pro v4.0

Extensión Chrome profesional para scraping automatizado de productos en Tmall, Taobao, 1688 y Tmall HK — con OCR de caracteres chinos, extracción de precios y variaciones, y sincronización directa con Supabase, Make.com y Notion.

---

## 📋 Descripción

Bio Cattaleya Scraper Pro extrae información completa de productos desde plataformas chinas de e-commerce. Combina scraping visual, OCR con Tesseract.js, lectura de panel derecho (precio + variaciones) y un pipeline automatizado hacia Supabase → Make.com → Notion (6 listas categorizadas).

---

## 🚀 Características

- **Scraping completo**: título, precio, imágenes, video, parámetros, descripción
- **OCR chino**: lee imágenes gráficas de descripción con Tesseract.js v4
- **Panel derecho independiente**: precio original + descuento + variaciones (hasta 218+)
- **Detección automática de categoría**: asigna Notion list según palabras clave chinas
- **Descarga ZIP organizada**: imágenes y video por producto
- **Insert Supabase**: 4 tablas — products, pricing, product_suppliers, inventory
- **Pipeline Make.com → Notion**: 6 listas — Cosmetics, Care, Fashion, Footwear, Handbag, Accessories
- **Soporte multi-plataforma**: Tmall, Taobao, 1688, Tmall HK

---

## 📁 Estructura del Proyecto

```
bio_cattaleya_scraper_v2fix/
├── manifest.json              # Configuración MV3
├── content.js                 # Scraping, OCR, detección categoría
├── background.js              # Descargas, Supabase insert
├── popup.js                   # Lógica del sidepanel
├── sidepanel.html             # Interfaz principal
├── src/
│   └── utils/
│       └── supabase.js        # Insert a 4 tablas
├── lib/                       # Tesseract workers + traineddata
├── webpack.config.cjs         # Build config
└── package.json
```

---

## 🛠️ Instalación

**1. Clonar el repositorio**
```bash
git clone https://github.com/emily9991/bio_cattaleya_scraper_v2fix.git
cd bio_cattaleya_scraper_v2fix
```

**2. Instalar dependencias**
```bash
npm install
```

**3. Build**
```bash
npm run build:dev    # desarrollo
npm run build        # producción
```

**4. Cargar en Chrome**
- Ir a `chrome://extensions/`
- Activar "Modo desarrollador"
- "Cargar sin empaquetar" → seleccionar carpeta `dist/`

---

## ⚙️ Configuración

En el sidepanel → pestaña **Config**:

| Campo | Descripción |
|-------|-------------|
| Supabase URL | URL del proyecto Supabase |
| Anon Key | Clave pública de Supabase |

Las keys se guardan en `chrome.storage.local` — nunca en código fuente.

---

## 🔄 Flujo de uso

1. Abrir producto en Tmall/Taobao/1688/Tmall HK
2. Abrir sidepanel de la extensión
3. Ejecutar pasos en orden:
   - **Paso 0** — OCR descripción (imágenes gráficas)
   - **Paso 1** — Scroll cargar imágenes
   - **Paso 2** — Datos del producto
   - **Paso 3** — Imágenes y video
   - **Paso 4** — Panel derecho (precio + variaciones)
4. Revisar preview y guardar en Supabase
5. Make.com detecta el insert → crea item en Notion según categoría

---

## 🗄️ Supabase — Tablas

| Tabla | Campos clave |
|-------|-------------|
| `products` | sku, name, name_en, description, images, price_original_cny, price_discount_cny, variations, notion_list |
| `pricing` | cost_usd, price_cop, exchange_rate |
| `product_suppliers` | supplier_id, source_url |
| `inventory` | color, size, stock (una fila por variación) |

---

## 🎯 Categorías Notion (detección automática)

| Lista | Palabras clave detectadas |
|-------|--------------------------|
| Cosmetics List | 霜, 面膜, 精华, 防晒, 口红, 眼影, 香水... |
| Care List | 洗发, 护发, 沐浴, 洁面, 卸妆... |
| Fashion List | 裙, 外套, 裤, 连衣裙, 睡衣... |
| Footwear List | 鞋, 靴, 凉鞋, 运动鞋... |
| Handbag List | 包, 钱包, 背包, 行李箱... |
| Accessories List | 项链, 耳环, 手链, 手表... |

---

## 🔄 Flujo de trabajo Git

```bash
git add .
git commit -m "feat: descripción del cambio"
git push
```

---

## 📄 Licencia

Proyecto privado — Bio Cattaleya Skin. Todos los derechos reservados.
```

