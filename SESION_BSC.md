---

# Bio Cattaleya Scraper Pro — Estado de Sesión

## STACK
Chrome Extension MV3 + Express (puerto 5001) + Webpack 5 / Node v22
CWD: C:\Users\emily\OneDrive\Escritorio\bio_cattaleya_scraper_v2fix\bio_cattaleya_scraper_v2fix\

## REGLAS CRÍTICAS
- NUNCA editar dist\content.js con Webpack (excluido de entry points)
- dist\content.js se edita SOLO con PowerShell WriteAllText() quirúrgico
- NUNCA editar dist\background.js directamente — editar background.js fuente + rebuild
- Antes de cualquier cambio fuera del scope: describir qué, por qué, y esperar confirmación
- No instalar dependencias sin avisar primero

## ARQUITECTURA IPC (FUNCIONANDO)
content.js → chrome.runtime.sendMessage({action:"execute_mainworld", eventName})
→ background.js → chrome.scripting.executeScript({world:"MAIN", func, args:[eventName]})
→ func en MAIN world accede a React Fiber → dispatchEvent(CustomEvent(eventName))
→ content.js listener recibe items[]

## ARCHIVOS CLAVE
| Archivo | Ubicación | Nota |
|---|---|---|
| dist\content.js | raíz/dist/ | Editar SOLO con PowerShell, NO compilar |
| background.js | raíz/ | Fuente — editar aquí + rebuild |
| dist\background.js | raíz/dist/ | Generado por Webpack |
| popup.js | raíz/ | Fuente del sidepanel (entry point Webpack) |
| sidepanel.html | raíz/ | Chrome lo carga desde aquí (no desde dist/) |
| server/server.js | raíz/server/ | Express puerto 5001 |

## WEBPACK CONFIG — ENTRY POINTS ACTUALES
```javascript
entry: {
  background: { import: './background.js' },
  popup: './popup.js'
  // content.js EXCLUIDO — se edita manualmente
}
```

## MEJORA #5 — COMPLETADA ✅
### Qué se hizo:
1. **server/server.js** — 2 endpoints nuevos:
   - POST /guardar-listado → crea Downloads/Productos_BSC/{slug}/{fecha}/productos.json
   - POST /exportar-excel → genera {slug}_{fecha}.xlsx desde el JSON
   - Dependencia instalada: xlsx (SheetJS) en /server

2. **background.js (fuente)** — 2 handlers nuevos:
   - execute_mainworld → chrome.scripting.executeScript MAIN world (restaurado)
   - guardar_listado → fetch POST localhost:5001/guardar-listado

3. **dist\content.js** — función extraerItemListadoMainWorld corregida:
   - Antes: inyectaba <script> inline (bloqueado por CSP de Tmall)
   - Ahora: usa chrome.runtime.sendMessage({action:'execute_mainworld'})

4. **sidepanel.html + popup.js** — UI nueva:
   - Botón: btnGuardarListado (línea 891)
   - Botón: btnExportExcel (línea 895)
   - Toggle: toggleDescargarImagenes (línea 901)
   - Función getSlug() implementada en popup.js

### Estructura de carpetas generada:
```
Downloads/Productos_BSC/{slug}/{fecha}/
  productos.json       ← automático al guardar
  {slug}_{fecha}.xlsx  ← bajo demanda
  imagenes/
    {itemId}.jpg       ← toggle ON/OFF
```

### Función getSlug():
```javascript
function getSlug(hostname) {
  return hostname
    .replace(/\.(com|cn|net|org)(\.cn)?$/, '')
    .replace(/\./g, '-');
}
// "keiko.world.tmall.com" → "keiko-world-tmall"
```

## ESTADO ACTUAL
- ✅ Servidor corriendo en localhost:5001
- ✅ dist\content.js con IPC correcto (sin inline scripts)
- ✅ background.js con execute_mainworld + guardar_listado
- ✅ webpack.config.js sin content como entry point
- ⏳ PENDIENTE: recargar extensión en Chrome y probar flujo completo

## PRÓXIMO PASO INMEDIATO
1. Recargar extensión en chrome://extensions
2. Entrar a keiko.world.tmall.com
3. Verificar que badge muestre 30 productos
4. Probar botón "Guardar listado"
5. Verificar que exista Downloads/Productos_BSC/keiko-world-tmall/2026-04-23/productos.json

## MEJORAS PENDIENTES (en orden)
- #6 UI grid checkboxes para selección de imágenes
- #7 DB maestra consolidada (usar JSONs de Productos_BSC/)
- #8 Validar chromeRuntimeId en /token
- #9 Conectar /license a DB real

---
