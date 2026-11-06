Borrador sin verificar, hecho por script (grep sobre origin/nexora-cloud, solo lectura). Fecha: 2026-10-29. Fuente: .github/workflows/ci.yml, .github/workflows/post-deploy-check.yml.

# Resumen de cada job de CI

Cobertura: los 3 jobs de ci.yml (verify, render-images, windows-installer) y post-deploy-check.yml. Los nombres de pasos son los del archivo, sin valores ni secretos.

## .github/workflows/ci.yml

### job `verify` (línea 14)

  - ejecuta en: ubuntu-latest
- paso (línea 47): Respaldo y restauración real (PostgreSQL 17)
### job `render-images` (línea 84)

  - ejecuta en: ubuntu-latest
- paso (línea 94): Construir la imagen de la API (Render, sin publicar)
- paso (línea 96): Construir la imagen web (Render, sin publicar)
- paso (línea 98): Arranque como en Render y comprobación posterior al despliegue
### job `windows-installer` (línea 100)

  - ejecuta en: windows-latest
- paso (línea 113): Exigir PostgreSQL real para recuperación del instalador

## .github/workflows/post-deploy-check.yml

### job `health` (línea 16)

  - ejecuta en: ubuntu-latest
- paso (línea 26): /api/health a través de la web
