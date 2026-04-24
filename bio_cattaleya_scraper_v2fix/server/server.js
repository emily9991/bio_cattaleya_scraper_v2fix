require('dotenv').config();
const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const os = require('os');
const XLSX = require('xlsx');
const app = express();

app.use(cors());
app.use(express.json());

// --- MONITOR EN TIEMPO REAL ---
// Esta es la ruta que tu extensión usará para enviarte los datos del labial
app.post('/api/monitor', (req, res) => {
    const { action, data } = req.body;
    
    console.log("\n" + "=".repeat(50));
    console.log(`🌸 LOG DE BIO CATTALEYA [${new Date().toLocaleTimeString()}]`);
    console.log(`🔹 Acción: ${action}`);
    console.log(`📦 Datos:`, JSON.stringify(data, null, 2));
    console.log("=".repeat(50) + "\n");
    
    res.json({ success: true });
});

// --- GUARDAR LISTADO DE PRODUCTOS ---
app.post('/guardar-listado', (req, res) => {
    const { slug, fecha, items } = req.body;
    
    try {
        // Determinar carpeta base
        const baseDir = process.env.BSC_OUTPUT_DIR || path.join(os.homedir(), 'Downloads');
        
        // Crear estructura de carpetas: Productos_BSC/{slug}/{fecha}/
        const targetDir = path.join(baseDir, 'Productos_BSC', slug, fecha);
        const imagenesDir = path.join(targetDir, 'imagenes');
        
        // Crear carpetas si no existen
        if (!fs.existsSync(targetDir)) {
            fs.mkdirSync(targetDir, { recursive: true });
        }
        if (!fs.existsSync(imagenesDir)) {
            fs.mkdirSync(imagenesDir, { recursive: true });
        }
        
        // Guardar productos.json
        const productosPath = path.join(targetDir, 'productos.json');
        fs.writeFileSync(productosPath, JSON.stringify(items, null, 2), 'utf8');
        
        console.log(`✅ Listado guardado en: ${productosPath}`);
        res.json({ ok: true, path: productosPath });
        
    } catch (error) {
        console.error('❌ Error al guardar listado:', error);
        res.status(500).json({ ok: false, error: error.message });
    }
});

// --- EXPORTAR EXCEL ---
app.post('/exportar-excel', (req, res) => {
    const { slug, fecha } = req.body;
    
    try {
        // Determinar carpeta base
        const baseDir = process.env.BSC_OUTPUT_DIR || path.join(os.homedir(), 'Downloads');
        
        // Ruta del productos.json
        const productosPath = path.join(baseDir, 'Productos_BSC', slug, fecha, 'productos.json');
        
        // Verificar que existe el archivo
        if (!fs.existsSync(productosPath)) {
            return res.status(404).json({ ok: false, error: 'Archivo productos.json no encontrado' });
        }
        
        // Leer productos.json
        const productosData = fs.readFileSync(productosPath, 'utf8');
        const items = JSON.parse(productosData);
        
        // Crear worksheet con las columnas especificadas
        const wsData = [
            ['itemId', 'Título', 'URL', 'Precio', 'Fuente', 'Imagen']
        ];
        
        items.forEach(item => {
            wsData.push([
                item.itemId || '',
                item.title || '',
                item.url || '',
                item.price || '',
                item.source || '',
                `${item.itemId}.jpg` // Columna Imagen = "{itemId}.jpg"
            ]);
        });
        
        // Crear workbook y worksheet
        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.aoa_to_sheet(wsData);
        XLSX.utils.book_append_sheet(wb, ws, 'Productos');
        
        // Guardar archivo Excel
        const excelFileName = `${slug}_${fecha}.xlsx`;
        const excelPath = path.join(baseDir, 'Productos_BSC', slug, fecha, excelFileName);
        XLSX.writeFile(wb, excelPath);
        
        console.log(`✅ Excel exportado a: ${excelPath}`);
        res.json({ ok: true, path: excelPath });
        
    } catch (error) {
        console.error('❌ Error al exportar Excel:', error);
        res.status(500).json({ ok: false, error: error.message });
    }
});

// Ruta de prueba simple
app.get('/', (req, res) => {
    res.send('Servidor de Monitoreo Activo');
});

// Manejo de errores básico sin usar caracteres especiales (*)
app.use((req, res, next) => {
    res.status(404).json({ error: "Ruta no encontrada" });
});

const PORT = process.env.PORT || 5001;
app.listen(PORT, () => {
    console.log(`\n✅ ¡MOTOR ENCENDIDO CON ÉXITO!`);
    console.log(`🔗 Monitor listo en: http://localhost:${PORT}`);
    console.log(`📺 Usa la extensión y los datos aparecerán aquí.\n`);
});