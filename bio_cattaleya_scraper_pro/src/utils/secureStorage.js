// ============================================================
// ALMACENAMIENTO SEGURO CON WEB CRYPTO API
// ============================================================
// Módulo para cifrar/descifrar datos sensibles en chrome.storage
// Usa AES-GCM con claves derivadas del runtime ID de la extensión
// ============================================================

class SecureStorage {
  constructor() {
    this.key = null;
    this.initialized = false;
  }

  // Inicializar la clave de cifrado
  async init() {
    if (this.initialized) return;
    
    try {
      // Obtener un identificador único de la extensión
      const runtimeId = chrome.runtime.id;
      const hostname = 'extension'; // Fixed hostname for Service Worker compatibility
      
      // Derivar clave usando PBKDF2 con el runtime ID como salt
      const encoder = new TextEncoder();
      const keyMaterial = await crypto.subtle.importKey(
        'raw',
        encoder.encode(runtimeId),
        'PBKDF2',
        false,
        ['deriveBits', 'deriveKey']
      );
      
      this.key = await crypto.subtle.deriveKey(
        {
          name: 'PBKDF2',
          salt: encoder.encode(hostname + runtimeId),
          iterations: 100000,
          hash: 'SHA-256'
        },
        keyMaterial,
        { name: 'AES-GCM', length: 256 },
        false,
        ['encrypt', 'decrypt']
      );
      
      this.initialized = true;
    } catch (error) {
      console.error('Secure storage initialization failed');
      throw new Error('Failed to initialize secure storage');
    }
  }

  // Cifrar y guardar datos
  async saveSecure(key, value) {
    await this.init();
    
    try {
      const encoder = new TextEncoder();
      const data = encoder.encode(JSON.stringify(value));
      
      // Generar IV único para cada cifrado
      const iv = crypto.getRandomValues(new Uint8Array(12));
      
      // Cifrar datos
      const encrypted = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv },
        this.key,
        data
      );
      
      // Combinar IV + datos cifrados
      const combined = new Uint8Array(iv.length + encrypted.byteLength);
      combined.set(iv);
      combined.set(new Uint8Array(encrypted), iv.length);
      
      // Guardar en chrome.storage.local
      const storageKey = `bc_secure_${key}`;
      await chrome.storage.local.set({
        [storageKey]: Array.from(combined)
      });
      
      return true;
    } catch (error) {
      console.error('Failed to save secure data');
      throw new Error('Failed to save secure data');
    }
  }

  // Leer y descifrar datos
  async getSecure(key) {
    await this.init();
    
    try {
      const storageKey = `bc_secure_${key}`;
      const result = await chrome.storage.local.get(storageKey);
      
      if (!result[storageKey]) {
        return null;
      }
      
      const combined = new Uint8Array(result[storageKey]);
      
      // Extraer IV y datos cifrados
      const iv = combined.slice(0, 12);
      const encrypted = combined.slice(12);
      
      // Descifrar datos
      const decrypted = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv },
        this.key,
        encrypted
      );
      
      const decoder = new TextDecoder();
      return JSON.parse(decoder.decode(decrypted));
    } catch (error) {
      console.error('Failed to read secure data');
      return null;
    }
  }

  // Eliminar datos cifrados
  async removeSecure(key) {
    const storageKey = `bc_secure_${key}`;
    await chrome.storage.local.remove(storageKey);
  }

  // Limpiar todos los datos seguros
  async clearAll() {
    try {
      const items = await chrome.storage.local.get(null);
      const keysToRemove = Object.keys(items).filter(key => key.startsWith('bc_secure_'));
      
      if (keysToRemove.length > 0) {
        await chrome.storage.local.remove(keysToRemove);
      }
    } catch (error) {
      console.error('Failed to clear secure storage');
    }
  }

  // Verificar si existen datos seguros
  async hasSecure(key) {
    const storageKey = `bc_secure_${key}`;
    const result = await chrome.storage.local.get(storageKey);
    return result[storageKey] !== undefined;
  }
}

// Exportar instancia singleton
const secureStorage = new SecureStorage();
