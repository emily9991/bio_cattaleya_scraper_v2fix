# 🌺 Bio Cattaleya Scraper v2fix

Extensión de Chrome para extracción automatizada de información de productos mediante web scraping. Combina scripts de extensión, interfaz de usuario y receptor Python para procesamiento de datos.

## 📋 Descripción

Bio Cattaleya Scraper es una herramienta profesional que extrae información detallada de productos de sitios web de e-commerce. Utiliza técnicas avanzadas de web scraping con soporte para múltiples plataformas y procesamiento de datos en tiempo real.

## 🚀 Características

- **Extracción multiplataforma**: Compatible con principales sitios de e-commerce
- **Procesamiento en tiempo real**: Datos extraídos instantáneamente
- **Interfaz intuitiva**: Popup y sidepanel para control fácil
- **Servidor backend**: Receptor Python para procesamiento avanzado
- **Sistema de logging**: Debug y monitoreo completo
- **Observador de mutaciones**: Detección automática de cambios en la página

## 📁 Estructura del Proyecto

```
bio_cattaleya_scraper_v2fix/
├── 📄 manifest.json          # Configuración de extensión
├── 🧠 content.js             # Script principal de extracción
├── 🔧 background.js           # Script de fondo
├── 🖼️ popup.html/js          # Interfaz popup
├── 📋 sidepanel.html         # Panel lateral
├── 🐍 receptor_*.py          # Receptores Python
├── 📦 package.json           # Dependencias Node.js
├── ⚙️ webpack.config.js      # Configuración de build
├── 📚 docs/                  # Documentación
│   ├── bug-registry/         # Registro de bugs
│   └── context/              # Contexto del proyecto
├── 🖥️ server/                # Servidor backend
└── 🔍 debug_server/          # Servidor de debug
```

## 🛠️ Instalación

1. **Clonar el repositorio**
   ```bash
   git clone https://github.com/emily9991/bio_cattaleya_scraper_v2fix.git
   cd bio_cattaleya_scraper_v2fix
   ```

2. **Instalar dependencias**
   ```bash
   npm install
   cd server && npm install
   cd ../debug_server && npm install
   ```

3. **Configurar entorno**
   ```bash
   cp server/.env.example server/.env
   # Editar .env con tus credenciales
   ```

## 🚀 Uso

### Modo Extensión Chrome
1. Abrir Chrome y navegar a `chrome://extensions/`
2. Activar "Modo de desarrollador"
3. Cargar la carpeta del proyecto como extensión descomprimida

### Modo Servidor
```bash
# Servidor principal
cd server && npm start

# Servidor de debug
cd debug_server && npm start
```

## 🔄 Flujo de Trabajo Git

```bash
# Actualizar cambios
git add .
git commit -m "feat: descripción del cambio"
git push

# Ejemplos de mensajes
# fix: mutation observer loop corregido
# feat: extracción de variantes SKU
# refactor: limpieza de content.js
```

## 📚 Documentación

- **Contexto del proyecto**: `docs/context/context_v4_3.md`
- **Registro de bugs**: `docs/bug-registry/`
- **Guía de seguridad**: `docs/SECURITY_*.md`

## 🐛 Reportar Issues

Los bugs deben documentarse en `docs/bug-registry/` con:
- Fecha y hora
- Descripción detallada
- Pasos para reproducir
- Solución aplicada (si aplica)

## 🔧 Configuración

### Variables de Entorno
- `NOTION_API_KEY`: API key de Notion
- `NOTION_DATABASE_ID`: ID de base de datos
- `LICENSE_KEY`: Clave de licencia

### Debug
Activar `BSC_DEBUG = true` en `content.js` para modo desarrollo.

## 📄 Licencia

Proyecto privado. Uso exclusivo con licencia válida.

---

**Git no es solo backup. Es el historial completo de tu proyecto.**
