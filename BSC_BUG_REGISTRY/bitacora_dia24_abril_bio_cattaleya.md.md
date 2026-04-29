# 🌺 Bio Cattaleya Scraper — Registro de Bugs & Soluciones

**Sesión:** 23–24 de Abril 2026  
**Repo:** `emily9991/bio_cattaleya_scraper_v2fix`  
**Propósito:** Backup operativo para replicar soluciones si el código se daña o corrompe

---

## Resumen Ejecutivo

En esta sesión se migró el proyecto de estructura personal básica a estructura enterprise, y se detectaron y resolvieron **6 bugs críticos** de seguridad, dependencias y configuración.

| Métrica | Estado |
|---|---|
| Bugs resueltos | ✅ 6 / 6 |
| Vulnerabilidades activas | 🟢 0 |
| Historial Git | ✅ Limpio |
| Secret Scanning | ✅ Activo |

---

## Tabla de Bugs

| ID | Fecha | Título | Severidad | Categoría | Estado |
|---|---|---|---|---|---|
| BUG-001 | 21/04/2026 | `server/.env.production` con credenciales reales en historial Git | 🔴 CRÍTICO | Seguridad | ✅ Resuelto |
| BUG-002 | 21/04/2026 | Carpetas `data/` sin `.gitkeep` — estructura no persiste en repo | 🟡 MEDIO | Estructura | ✅ Resuelto |
| BUG-003 | 21/04/2026 | `xlsx` (npm) con 2 vulnerabilidades HIGH — Prototype Pollution + ReDoS | 🟠 ALTO | Dependencias | ✅ Resuelto |
| BUG-004 | 21/04/2026 | ExcelJS instalado como reemplazo introduce vulnerabilidad `uuid` moderate | 🟡 MEDIO | Dependencias | ✅ Resuelto |
| BUG-005 | 21/04/2026 | `git filter-branch` deprecado — herramienta incorrecta para limpiar historial | 🔵 BAJO | Proceso | ✅ Resuelto |
| BUG-006 | 21/04/2026 | `pyproject.toml` sin `packages.find` apuntando a `src/` | 🟡 MEDIO | Configuración | ✅ Resuelto |

---

## Detalle de Bugs y Soluciones

### BUG-001 — `server/.env.production` con credenciales reales en historial Git

> 🔴 **Severidad:** CRÍTICO &nbsp;|&nbsp; 📁 **Categoría:** Seguridad &nbsp;|&nbsp; 📅 **Fecha:** 21/04/2026

**Descripción**  
El archivo `server/.env.production` contenía `JWT_SECRET`, `NOTION_TOKEN` y `NOTION_DATABASE_ID` reales y fue commiteado al repositorio. Estuvo presente en 2 commits: `1d487e6` y `96f477e`.

**Causa raíz**  
El `.gitignore` no tenía regla para `server/.env.production`. Solo cubría `.env` genérico en la raíz.

**Pasos de solución**

```bash
# 1. Rotar credenciales PRIMERO: JWT_SECRET, NOTION_TOKEN, NOTION_DATABASE_ID

# 2. Eliminar del índice Git
git rm --cached server/.env.production

# 3. Agregar al .gitignore
#    → server/.env.production

# 4. Crear plantilla segura con placeholders
#    → server/.env.production.example

# 5. Limpiar historial con git-filter-repo
pip install git-filter-repo
python -m git_filter_repo --path bio_cattaleya_scraper_v2fix/server/.env.production --invert-paths

# 6. Forzar push
git push origin --force --all

# 7. Verificar limpieza
git log --all --full-history -- 'bio_cattaleya_scraper_v2fix/server/.env.production'
```

> ⚠️ **Lección aprendida:** Rotar credenciales **antes** de limpiar el historial. `filter-repo` sin rotación previa no protege si el repo ya fue clonado o cacheado.

---

### BUG-002 — Carpetas `data/` sin `.gitkeep` — estructura no persiste en repo

> 🟡 **Severidad:** MEDIO &nbsp;|&nbsp; 📁 **Categoría:** Estructura &nbsp;|&nbsp; 📅 **Fecha:** 21/04/2026

**Descripción**  
Las carpetas `data/raw/`, `data/processed/` y `data/exports/` estaban en `.gitignore` con el patrón `data/raw/`, pero sin archivos `.gitkeep`. Git ignora carpetas vacías, por lo que la estructura no existía en el repositorio.

**Causa raíz**  
Regla `.gitignore` incorrecta: `data/raw/` ignora la carpeta entera. Se necesita `data/raw/*` para ignorar el contenido pero trackear el placeholder.

**Pasos de solución**

```bash
# Crear placeholders
touch data/raw/.gitkeep        # ya existía
touch data/processed/.gitkeep  # ya existía
touch data/exports/.gitkeep    # creado nuevo

# Corregir .gitignore
# Cambiar:  data/raw/
# Por:      data/raw/*
# Agregar excepciones:
#           !data/raw/.gitkeep
#           !data/processed/.gitkeep
#           !data/exports/.gitkeep
```

> 💡 **Lección aprendida:** El patrón `/*` ignora el contenido pero preserva el placeholder. El patrón `/` ignora todo, incluyendo el directorio.

---

### BUG-003 — `xlsx` (npm) con 2 vulnerabilidades HIGH — Prototype Pollution + ReDoS

> 🟠 **Severidad:** ALTO &nbsp;|&nbsp; 📁 **Categoría:** Dependencias &nbsp;|&nbsp; 📅 **Fecha:** 21/04/2026

**Descripción**  
Dependabot detectó CVEs en el paquete `xlsx` (npm):
- **Prototype Pollution** — versiones `< 0.19.3`
- **ReDoS** — versiones `< 0.20.2`

El paquete está abandonado y no tiene parche disponible en npm. Presente en `package-lock.json` de la carpeta anidada `bio_cattaleya_scraper_v2fix/server/`.

**Causa raíz**  
`xlsx` es un paquete npm abandonado sin versión parcheada disponible en el registro público.

**Pasos de solución**

```powershell
# 1. Verificar si xlsx se usa en el código
Get-ChildItem -Path 'bio_cattaleya_scraper_v2fix\server' -Recurse -Include '*.js','*.ts' | Select-String -Pattern 'xlsx'

# 2. No se encontró uso → desinstalar
cd bio_cattaleya_scraper_v2fix\server
npm uninstall xlsx

# 3. Verificar resultado
npm audit  # → found 0 vulnerabilities

# 4. Commitear
git add .
git commit -m 'chore: remove xlsx from nested server'
```

> 💡 **Lección aprendida:** Antes de buscar alternativas, verificar si el paquete realmente se usa. Si no se usa, la solución más limpia es eliminarlo.

---

### BUG-004 — ExcelJS instalado como reemplazo introduce vulnerabilidad `uuid` moderate

> 🟡 **Severidad:** MEDIO &nbsp;|&nbsp; 📁 **Categoría:** Dependencias &nbsp;|&nbsp; 📅 **Fecha:** 21/04/2026

**Descripción**  
Al instalar `exceljs` como reemplazo de `xlsx` en la raíz, se introdujo la dependencia transitiva `uuid 8.3.2` con vulnerabilidad CVE (missing buffer bounds check en v3/v5/v6). El parche requiere `uuid >= 14.0.0`, lo que implicaría un downgrade de `exceljs` a `3.4.0` (breaking change).

**Causa raíz**  
`exceljs 4.4.0` depende de `uuid 8.3.2`. Aplicar `npm audit fix --force` habría hecho downgrade de `exceljs` a una versión incompatible.

**Pasos de solución**

```powershell
# 1. Verificar si exceljs se usa en el código
Get-ChildItem | Select-String -Pattern 'exceljs'

# 2. No se encontró uso → desinstalar
npm uninstall exceljs

# 3. Verificar resultado
npm audit  # → found 0 vulnerabilities

# 4. Commitear
git add package.json package-lock.json
git commit -m 'chore: remove unused exceljs dependency'
```

> 💡 **Lección aprendida:** Instalar un paquete "de reemplazo" sin verificar si el original se usa genera deuda técnica nueva. Verificar uso antes de instalar alternativas.

---

### BUG-005 — `git filter-branch` deprecado — herramienta incorrecta para limpiar historial

> 🔵 **Severidad:** BAJO &nbsp;|&nbsp; 📁 **Categoría:** Proceso &nbsp;|&nbsp; 📅 **Fecha:** 21/04/2026

**Descripción**  
Se sugirió usar `git filter-branch` para limpiar el historial. Esta herramienta está deprecada, es lenta y tiene comportamientos no deterministas en repos con merges.

**Causa raíz**  
`git filter-branch` es el comando histórico documentado en muchos tutoriales, pero fue reemplazado oficialmente.

**Pasos de solución**

```bash
# 1. Instalar la herramienta correcta
pip install git-filter-repo

# 2. Asegurarse de que no haya cambios staged antes de ejecutar
#    (hacer commit de todo lo pendiente)

# 3. Verificar el path exacto del archivo a eliminar
git log --all --full-history -- '**/<archivo>'

# 4. Ejecutar limpieza
python -m git_filter_repo --path <archivo> --invert-paths

# 5. Forzar push
git push origin --force --all
git push origin --force --tags
```

> 💡 **Lección aprendida:** `git-filter-repo` es el reemplazo oficial de `filter-branch`. Es más rápido, seguro y recomendado por GitHub.

---

### BUG-006 — `pyproject.toml` sin `packages.find` apuntando a `src/`

> 🟡 **Severidad:** MEDIO &nbsp;|&nbsp; 📁 **Categoría:** Configuración &nbsp;|&nbsp; 📅 **Fecha:** 21/04/2026

**Descripción**  
El `pyproject.toml` inicial no tenía configurado `[tool.setuptools.packages.find]` con `where = ['src']`. Sin esto, `pip install -e .` no encuentra los módulos del proyecto y los imports fallan en CI.

**Causa raíz**  
El patrón `src/ layout` requiere configuración explícita para que setuptools sepa dónde buscar los packages.

**Pasos de solución**

```toml
# Agregar al pyproject.toml:
[tool.setuptools.packages.find]
where = ['src']
```

```yaml
# Verificar que ci.yml use:
- run: pip install -e '.[dev]'
```

> 💡 **Lección aprendida:** El patrón `src/ layout` es el estándar moderno en Python, pero requiere configuración explícita en setuptools. Sin esto el CI falla con `ModuleNotFoundError`.

---

## Estructura Enterprise Implementada

La siguiente estructura fue creada desde cero en esta sesión:

```
bio_cattaleya_scraper_v2fix/
├── src/bio_cattaleya/          # Código fuente principal
│   ├── scraper/
│   ├── parsers/
│   ├── storage/
│   └── config.py
├── tests/                      # Suite de pruebas
│   ├── unit/
│   ├── integration/
│   ├── fixtures/
│   └── conftest.py
├── .github/workflows/ci.yml    # CI/CD: lint → test → build
├── docs/
│   ├── context/context_v4_3.md
│   └── bug-registry/           # Este registro
├── data/
│   ├── raw/          (.gitkeep)
│   ├── processed/    (.gitkeep)
│   └── exports/      (.gitkeep)
├── scripts/setup_dev.sh        # Setup del entorno en 1 comando
├── pyproject.toml              # Deps, pytest, ruff, black, mypy
├── CHANGELOG.md                # Historial (Keep a Changelog)
└── .gitignore                  # Enterprise: 7 categorías, 40+ reglas
```

---

## Protecciones Activadas en GitHub

| Protección | Descripción |
|---|---|
| 🔐 Secret Protection | Escanea historial y alerta sobre tokens expuestos |
| 🚫 Push Protection | Bloquea push si detecta credenciales en tiempo real |
| 🤖 Dependabot Alerts | Monitorea CVEs en `pyproject.toml` y `package.json` |
| 🔍 CodeQL | Análisis estático de vulnerabilidades en código Python |

---

## Comandos Clave para Reproducir

### Limpiar credenciales del historial Git

```bash
pip install git-filter-repo
python -m git_filter_repo --path <ruta/archivo> --invert-paths
git push origin --force --all
git log --all --full-history -- '<ruta/archivo>'  # verificar limpieza
```

### Auditar dependencias Node

```bash
npm audit
npm uninstall <paquete-vulnerable>
npm audit  # verificar 0 vulnerabilities
```

### Git en PowerShell (cuando git no está en PATH)

```powershell
& "C:\Program Files\Git\bin\git.exe" add .
& "C:\Program Files\Git\bin\git.exe" commit -m "mensaje"
& "C:\Program Files\Git\bin\git.exe" push origin main
```

### Búsqueda de texto en PowerShell (equivalente a `grep`)

```powershell
Get-ChildItem -Path "<carpeta>" -Recurse -Include "*.js","*.ts" | Select-String -Pattern "<texto>"
```

---

*Bio Cattaleya Scraper · Registro generado: 23–24/04/2026 · `emily9991/bio_cattaleya_scraper_v2fix`*
