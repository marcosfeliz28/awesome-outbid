Borrador sin verificar, hecho por script (solo lectura, origin/nexora-cloud). Fecha: 2026-10-29. Fuente: .github/workflows/ci.yml, .github/workflows/post-deploy-check.yml.

Sin nombres de secretos ni valores: los pasos cuyo nombre sugiere secreto se omiten.

## .github/workflows/ci.yml

- Nombre: FitStore checks
- Disparadores: on: [push, pull_request]
- Jobs:
  - verify
    - paso: Respaldo y restauración real (PostgreSQL 17)
  - render-images
    - paso: Construir la imagen de la API (Render, sin publicar)
    - paso: Construir la imagen web (Render, sin publicar)
    - paso: Arranque como en Render y comprobación posterior al despliegue
  - windows-installer
    - paso: Exigir PostgreSQL real para recuperación del instalador

## .github/workflows/post-deploy-check.yml

- Nombre: Comprobación posterior al despliegue
- Disparadores: on: workflow_dispatch:
- Jobs:
  - health
    - paso: /api/health a través de la web
