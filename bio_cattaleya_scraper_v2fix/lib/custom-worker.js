// Intercepta fetch de data: URLs antes de que Tesseract lo intente
const _fetch = self.fetch.bind(self);
self.fetch = async function(url, init) {
  if (typeof url === 'string' && url.startsWith('data:')) {
    const comma = url.indexOf(',');
    const base64 = url.slice(comma + 1);
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    const type = url.slice(5, comma).replace(';base64','');
    return new Response(bytes.buffer, { headers: { 'Content-Type': type } });
  }
  return _fetch(url, init);
};
importScripts(self.location.href.replace('custom-worker.js', 'worker.min.js'))