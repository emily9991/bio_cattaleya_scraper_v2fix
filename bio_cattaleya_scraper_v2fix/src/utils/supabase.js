// ============================================================
// SUPABASE CLIENT — Bio Cattaleya Scraper Pro
// src/utils/supabase.js
//
// SEGURIDAD:
// - Nunca hardcodear keys aquí
// - Keys viven en chrome.storage.local (cifrado por Chrome)
// - Usar siempre anon key, nunca service_role en el cliente
// - Input sanitizado antes de cada insert
// ============================================================

async function getSupabaseConfig() {
  return new Promise(resolve => {
    chrome.storage.local.get(['supabaseUrl', 'supabaseAnonKey'], result => {
      resolve({
        url: result.supabaseUrl     || '',
        key: result.supabaseAnonKey || ''
      });
    });
  });
}

function buildSupabaseHeaders(key) {
  return {
    'Content-Type':  'application/json',
    'apikey':         key,
    'Authorization': `Bearer ${key}`,
    'Prefer':        'resolution=merge-duplicates,return=representation'
  };
}

// Elimina HTML, scripts y caracteres peligrosos antes de enviar a la DB
function sanitizeInput(str) {
  return String(str || '')
    .replace(/<[^>]*>/g, '')       // strip HTML tags
    .replace(/[<>"'`]/g, '')       // strip dangerous chars
    .trim()
    .slice(0, 500);
}

// ─── TEST DE CONEXIÓN ────────────────────────────────────────
async function testSupabaseConnection(url, key) {
  try {
    const res = await fetch(`${url}/rest/v1/products?limit=1`, {
      headers: buildSupabaseHeaders(key)
    });
    // 406 = connected but no Accept header — still means auth works
    return res.ok || res.status === 406;
  } catch {
    return false;
  }
}

// ─── INSERT PRINCIPAL ────────────────────────────────────────
// Inserta un producto completo en 4 tablas en secuencia:
// products → pricing → product_suppliers → inventory
async function enviarProductoASupabase(producto) {
  const { url, key } = await getSupabaseConfig();

  if (!url || !key) {
    return {
      ok:    false,
      step:  'config',
      error: 'Configura Supabase URL y Anon Key en el panel ⚙️'
    };
  }

  const headers = buildSupabaseHeaders(key);

  try {

    // ── 1. products ──────────────────────────────────────────
    const r1 = await fetch(`${url}/rest/v1/products`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        sku:         sanitizeInput(producto.sku),
        name:        sanitizeInput(producto.name),
        description: sanitizeInput(producto.description || ''),
        status:      'active',
        images:      (producto.images || []).slice(0, 10)
      })
    });

    if (!r1.ok) {
      return { ok: false, step: 'products', error: await r1.text() };
    }

    const [productoCreado] = await r1.json();
    const productId = productoCreado.id;

    // ── 2. pricing ───────────────────────────────────────────
    const r2 = await fetch(`${url}/rest/v1/pricing`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        product_id:    productId,
        cost_usd:      Number(producto.priceUSD)      || 0,
        price_cop:     Number(producto.priceCOP)      || 0,
        exchange_rate: Number(producto.exchangeRate)  || 4200
      })
    });

    if (!r2.ok) {
      return { ok: false, step: 'pricing', error: await r2.text() };
    }

    // ── 3. product_suppliers ─────────────────────────────────
    const r3 = await fetch(`${url}/rest/v1/product_suppliers`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        product_id:    productId,
        supplier_code: sanitizeInput(producto.supplierCode || 'SUP-0001'),
        source_url:    sanitizeInput(producto.sourceUrl   || '')
      })
    });

    if (!r3.ok) {
      return { ok: false, step: 'product_suppliers', error: await r3.text() };
    }

    // ── 4. inventory (una fila por variante) ─────────────────
    if (producto.variants && producto.variants.length > 0) {
      const rows = producto.variants.map(v => ({
        product_id: productId,
        size:       sanitizeInput(v.size),
        color:      sanitizeInput(v.color),
        stock:      Number(v.stock) || 0
      }));

      const r4 = await fetch(`${url}/rest/v1/inventory`, {
        method: 'POST',
        headers: {
          ...headers,
          'Prefer': 'resolution=merge-duplicates'  // sin return=representation para bulk
        },
        body: JSON.stringify(rows)
      });

      if (!r4.ok) {
        return { ok: false, step: 'inventory', error: await r4.text() };
      }
    }

    return {
      ok:        true,
      productId: productId,
      sku:       producto.sku
    };

  } catch (e) {
    return {
      ok:    false,
      step:  'fetch',
      error: e.message
    };
  }
}