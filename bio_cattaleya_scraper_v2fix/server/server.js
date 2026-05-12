require('dotenv').config();
const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const os = require('os');
const rateLimit = require('express-rate-limit');
const app = express();

app.use(cors());
app.use(express.json());

// Rate limiting — máximo 100 requests por 15 minutos por IP
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { ok: false, error: 'Demasiadas peticiones, intenta más tarde' }
});
app.use(limiter);

// ─── SECURITY HELPERS ──────────────────────────────────────────────
// FIX: Definidos ANTES de las rutas para que estén disponibles al usarse.

/**
 * Valida que un segmento de path no contenga traversal ni caracteres peligrosos.
 * Solo permite alfanuméricos, guiones, guiones bajos y puntos.
 * FIX CodeQL: Uncontrolled data used in path expression (#35–#41, #23–#30)
 */
function sanitizePathSegment(segment) {
    if (typeof segment !== 'string' || segment.length === 0) return null;
    // Solo permite: letras, números, -, _, .
    if (!/^[\w\-\.]+$/.test(segment)) return null;
    // Bloquea explícitamente traversal aunque pase el regex
    if (segment.includes('..') || segment.includes('/') || segment.includes('\\')) return null;
    return segment;
}

/**
 * Verifica que el path resuelto siga dentro del directorio base.
 * Segunda línea de defensa tras sanitizePathSegment.
 * FIX CodeQL: Uncontrolled data used in path expression (#35–#41, #23–#30)
 */
function assertInsideBase(basePath, resolvedPath) {
    const base = path.resolve(basePath);
    const resolved = path.resolve(resolvedPath);
    if (!resolved.startsWith(base + path.sep) && resolved !== base) {
        throw new Error(`Path traversal bloqueado: ${resolved}`);
    }
}
// ───────────────────────────────────────────────────────────────────


// --- MONITOR EN TIEMPO REAL ---
app.post('/api/monitor', (req, res) => {
    const { action, data } = req.body;

    // FIX: Usar argumentos separados en console.log para evitar format string injection.
    // Los valores nunca se usan como cadena de formato.
    console.log('\n' + '='.repeat(50));
    console.log('🌸 LOG DE BIO CATTALEYA [%s]', new Date().toLocaleTimeString());
    console.log('🔹 Acción: %s', String(action || '').slice(0, 100));
    console.log('📦 Datos:', JSON.stringify(data, null, 2).slice(0, 500));
    console.log('='.repeat(50) + '\n');

    res.json({ success: true });
});


// --- GUARDAR LISTADO DE PRODUCTOS ---
app.post('/guardar-listado', (req, res) => {
    const { slug, fecha, items } = req.body;

    // FIX CodeQL #35–#41: Sanitizar slug y fecha antes de usarlos en paths.
    const slugSafe = sanitizePathSegment(slug);
    const fechaSafe = sanitizePathSegment(fecha);

    if (!slugSafe || !fechaSafe) {
        return res.status(400).json({ ok: false, error: 'Parámetros slug o fecha inválidos' });
    }

    try {
        const baseDir = process.env.BSC_OUTPUT_DIR || path.join(os.homedir(), 'Downloads');
        const productosBase = path.join(baseDir, 'Productos_BSC');

        const targetDir = path.join(productosBase, slugSafe, fechaSafe);
        const imagenesDir = path.join(targetDir, 'imagenes');

        // Segunda línea de defensa: verificar que el path sigue dentro del base.
        assertInsideBase(productosBase, targetDir);

        if (!fs.existsSync(targetDir)) {
            fs.mkdirSync(targetDir, { recursive: true });
        }
        if (!fs.existsSync(imagenesDir)) {
            fs.mkdirSync(imagenesDir, { recursive: true });
        }

        const productosPath = path.join(targetDir, 'productos.json');
        // FIX #58: validar que items es un array antes de escribir
if (!Array.isArray(items)) {
    return res.status(400).json({ ok: false, error: 'Formato de datos inválido' });
}
fs.writeFileSync(productosPath, JSON.stringify(items, null, 2), 'utf8');

        console.log('✅ Listado guardado en: %s', productosPath);
        res.json({ ok: true, path: productosPath });

    } catch (error) {
        console.error('❌ Error al guardar listado:', error.message);
        res.status(500).json({ ok: false, error: error.message });
    }
});


// --- EXPORTAR EXCEL ---
app.post('/exportar-excel', (req, res) => {
    // FIX CodeQL #35–#41: Sanitizar slug y fecha antes de usarlos en paths.
    const slugSafe = sanitizePathSegment(req.body?.slug);
    const fechaSafe = sanitizePathSegment(req.body?.fecha);

    if (!slugSafe || !fechaSafe) {
        return res.status(400).json({ ok: false, error: 'Parámetros slug o fecha inválidos' });
    }

    try {
        const baseDir = process.env.BSC_OUTPUT_DIR || path.join(os.homedir(), 'Downloads');
        const productosBase = path.join(baseDir, 'Productos_BSC');
        const productosPath = path.join(productosBase, slugSafe, fechaSafe, 'productos.json');

        // Segunda línea de defensa.
        assertInsideBase(productosBase, productosPath);

        if (!fs.existsSync(productosPath)) {
            return res.status(404).json({ ok: false, error: 'Archivo productos.json no encontrado' });
        }

        const productosData = fs.readFileSync(productosPath, 'utf8');
        const items = JSON.parse(productosData);

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
                `${item.itemId}.jpg`
            ]);
        });

        // Temporarily disabled until XLSX is properly installed
        // const wb = XLSX.utils.book_new();
        // const ws = XLSX.utils.aoa_to_sheet(wsData);
        // XLSX.utils.book_append_sheet(wb, ws, 'Productos');
        // const excelFileName = `${slugSafe}_${fechaSafe}.xlsx`;
        // const excelPath = path.join(productosBase, slugSafe, fechaSafe, excelFileName);
        // XLSX.writeFile(wb, excelPath);
        // console.log('✅ Excel exportado a: %s', excelPath);
        // res.json({ ok: true, path: excelPath });

        return res.status(501).json({ ok: false, error: 'Exportación Excel temporalmente deshabilitada' });

    } catch (error) {
        console.error('❌ Error al exportar Excel:', error.message);
        res.status(500).json({ ok: false, error: error.message });
    }
});


// --- LOG DE DEBUG DE LA EXTENSIÓN ---
app.post('/log', (req, res) => {
    // FIX CodeQL #32–#33: Sanitizar todos los campos del body antes de loggear.
    // Nunca usar input externo como cadena de formato — usar %s con argumentos separados.
    const level  = String(req.body?.level  || '').slice(0, 20);
    const source = String(req.body?.source || 'unknown').slice(0, 50);
    const msg    = String(req.body?.msg    || '').slice(0, 200);
    const data   = req.body?.data ?? null;

    const tag = level === 'error' ? 'ERROR' : level === 'warn' ? 'WARN' : 'INFO';

    console.log('%s [%s] %s %s',
        tag,
        source,
        msg,
        data ? JSON.stringify(data).slice(0, 200) : ''
    );

    res.json({ ok: true });
});

app.get('/logs', (req, res) => {
    res.json([]);
});

app.get('/clear', (req, res) => {
    res.json({ cleared: true });
});

// Ruta de prueba simple
app.get('/', (req, res) => {
    res.send('Servidor de Monitoreo Activo');
});

// Manejo de errores 404
app.use((req, res, next) => {
    res.status(404).json({ error: 'Ruta no encontrada' });
});

const PORT = process.env.PORT || 5001;
app.listen(PORT, () => {
    console.log('\n✅ ¡MOTOR ENCENDIDO CON ÉXITO!');
    console.log('🔗 Monitor listo en: http://localhost:%d', PORT);
    console.log('📺 Usa la extensión y los datos aparecerán aquí.\n');
});