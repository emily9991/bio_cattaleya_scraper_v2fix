#!/usr/bin/env python3
"""
receptor_biocattaleya.py – Bio Cattaleya Scraper
================================================
Servidor HTTP local que recibe los productos extraídos por la extensión de
Chrome y los almacena en un archivo CSV y en un archivo JSON.

Uso
---
    python receptor_biocattaleya.py

No requiere dependencias externas; usa únicamente la biblioteca estándar de Python.

El servidor escucha en http://localhost:5000 de forma predeterminada.

Endpoints
---------
POST /productos
    Recibe un JSON con los datos de un producto y lo almacena.
    Ejemplo de payload:
    {
        "url": "https://tienda.ejemplo.com/producto/1",
        "titulo": "Orquídea Cattleya",
        "precio": "$45.000",
        "descripcion": "Orquídea en flor, maceta 12 cm.",
        "imagen": "https://tienda.ejemplo.com/img/cattleya.jpg",
        "fecha_extraccion": "2026-04-02T21:00:00.000Z"
    }

GET /productos
    Devuelve todos los productos almacenados en formato JSON.

DELETE /productos
    Elimina todos los productos almacenados.
"""

import csv
import json
import logging
import os
import signal
import sys
from datetime import datetime, timezone
from http.server import BaseHTTPRequestHandler, HTTPServer

# ─── Configuración ─────────────────────────────────────────────────────────

HOST = "localhost"
PORT = 5000

CSV_FILE  = "productos_extraidos.csv"
JSON_FILE = "productos_extraidos.json"

CSV_FIELDS = ["url", "titulo", "precio", "descripcion", "imagen", "fecha_extraccion", "fecha_guardado"]

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger("BioCattaleya")

# ─── Almacenamiento ────────────────────────────────────────────────────────

def load_products():
    """Carga la lista de productos desde el archivo JSON."""
    if os.path.exists(JSON_FILE):
        with open(JSON_FILE, "r", encoding="utf-8") as f:
            try:
                return json.load(f)
            except json.JSONDecodeError:
                logger.warning("Archivo JSON corrupto; iniciando lista vacía.")
    return []


def save_products(products):
    """Persiste la lista de productos en JSON y CSV."""
    # JSON
    with open(JSON_FILE, "w", encoding="utf-8") as f:
        json.dump(products, f, ensure_ascii=False, indent=2)

    # CSV
    file_exists = os.path.exists(CSV_FILE)
    with open(CSV_FILE, "a", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=CSV_FIELDS, extrasaction="ignore")
        if not file_exists:
            writer.writeheader()
        if products:
            writer.writerow(products[-1])  # solo el último (recién añadido)


def add_product(data):
    """Valida y agrega un producto; devuelve (producto, error)."""
    required = {"url", "titulo"}
    missing = required - set(data.keys())
    if missing:
        return None, f"Campos obligatorios faltantes: {', '.join(missing)}"

    products = load_products()

    # Deduplicación por URL
    if any(p.get("url") == data["url"] for p in products):
        return None, "Producto ya registrado (URL duplicada)."

    product = {
        "url":              str(data.get("url", "")).strip(),
        "titulo":           str(data.get("titulo", "")).strip(),
        "precio":           str(data.get("precio", "")).strip(),
        "descripcion":      str(data.get("descripcion", "")).strip()[:500],
        "imagen":           str(data.get("imagen", "")).strip(),
        "fecha_extraccion": str(data.get("fecha_extraccion", "")).strip(),
        "fecha_guardado":   datetime.now(timezone.utc).isoformat(),
    }
    products.append(product)
    save_products(products)
    logger.info("Producto guardado: %s", product["titulo"] or product["url"])
    return product, None

# ─── Servidor HTTP ─────────────────────────────────────────────────────────

class ReceptorHandler(BaseHTTPRequestHandler):
    """Manejador de solicitudes HTTP del receptor."""

    def log_message(self, fmt, *args):  # noqa: D102 – silenciar logs del servidor base
        pass

    def _set_cors_headers(self):
        self.send_header("Access-Control-Allow-Origin", "chrome-extension://*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")

    def _send_json(self, status, body):
        payload = json.dumps(body, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(payload)))
        self._set_cors_headers()
        self.end_headers()
        self.wfile.write(payload)

    def _read_json_body(self):
        length = int(self.headers.get("Content-Length", 0))
        if length == 0:
            return None, "Cuerpo vacío"
        raw = self.rfile.read(length)
        try:
            return json.loads(raw.decode("utf-8")), None
        except json.JSONDecodeError as exc:
            return None, str(exc)

    # OPTIONS – preflight CORS
    def do_OPTIONS(self):  # noqa: N802
        self.send_response(204)
        self._set_cors_headers()
        self.end_headers()

    # GET /productos
    def do_GET(self):  # noqa: N802
        if self.path.rstrip("/") == "/productos":
            products = load_products()
            self._send_json(200, {"ok": True, "total": len(products), "productos": products})
        else:
            self._send_json(404, {"ok": False, "error": "Ruta no encontrada"})

    # POST /productos
    def do_POST(self):  # noqa: N802
        if self.path.rstrip("/") == "/productos":
            data, err = self._read_json_body()
            if err:
                self._send_json(400, {"ok": False, "error": err})
                return
            product, err = add_product(data)
            if err:
                self._send_json(409, {"ok": False, "error": err})
                return
            total = len(load_products())
            self._send_json(201, {"ok": True, "producto": product, "total": total})
        else:
            self._send_json(404, {"ok": False, "error": "Ruta no encontrada"})

    # DELETE /productos
    def do_DELETE(self):  # noqa: N802
        if self.path.rstrip("/") == "/productos":
            with open(JSON_FILE, "w", encoding="utf-8") as f:
                json.dump([], f)
            if os.path.exists(CSV_FILE):
                os.remove(CSV_FILE)
            logger.info("Lista de productos eliminada.")
            self._send_json(200, {"ok": True, "mensaje": "Todos los productos eliminados."})
        else:
            self._send_json(404, {"ok": False, "error": "Ruta no encontrada"})


# ─── Punto de entrada ──────────────────────────────────────────────────────

def main():
    server = HTTPServer((HOST, PORT), ReceptorHandler)
    logger.info("Receptor Bio Cattaleya iniciado en http://%s:%d", HOST, PORT)
    logger.info("Presiona Ctrl+C para detener.")

    def _shutdown(sig, frame):
        logger.info("Deteniendo servidor...")
        server.shutdown()
        sys.exit(0)

    signal.signal(signal.SIGINT, _shutdown)
    signal.signal(signal.SIGTERM, _shutdown)

    server.serve_forever()


if __name__ == "__main__":
    main()
