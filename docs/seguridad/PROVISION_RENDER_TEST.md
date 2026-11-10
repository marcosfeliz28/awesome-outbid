# Provisión de la copia de prueba en Render — checklist (10-nov-2026)

Para la auditoría de intrusión. Mismo workspace que producción ("Marcos",
`tea-db3f7ofavr4c739hsgi0`) porque no se puede crear uno nuevo por API; recursos nuevos
marcados `nexora-test-*`, aislados de producción. Ejecutar SOLO cuando el generador de
fixtures esté listo (para no pagar base ociosa).

## Recursos a crear (planes mínimos, run-rate ≈ $20/mes, se destruye a los pocos días)
- `nexora-test-db` — Postgres nuevo, plan más chico. NO tocar `nexora-pos-db` (producción).
- `nexora-test-api` — **web service PÚBLICO** (prod lo tiene privado; aquí público para que el
  ejecutor lo ataque), Docker `./deploy/render/Dockerfile.api`, región virginia, plan chico.
- `nexora-test-web` — web service Docker `./deploy/render/Dockerfile.web` (nginx real), plan
  chico. Se usa nginx real (no un static site) para que la **capa 8** pruebe las cabeceras
  REALES del producto (CSP, HSTS, X-Frame-Options, nosniff, Referrer-Policy), no las del borde
  de Render. Rama `nexora-cloud` (o la de fixtures si hace falta sembrar).

## Variables de entorno (secretos ROTADOS — checklist de DeepSeek)
- `DATABASE_URL` / `RENDER_DATABASE_URL` → de `nexora-test-db` (NUNCA la de producción).
- `JWT_SECRET` → **nuevo**, aleatorio ≥ 32 chars (NO el de producción).
- `WEB_ORIGIN` → `https://nexora-test-web.onrender.com` desde el primer momento (el API lo
  exige, `main.ts:23-24`; si apunta a prod, CORS/CSRF quedan contaminados).
- `NODE_ENV=production` → con esto Swagger queda APAGADO salvo `ENABLE_SWAGGER=true`
  (`main.ts:64`). NO poner `ENABLE_SWAGGER`.
- **NO** poner: `ANTHROPIC_API_KEY`, `IA_VENTAS_PLAN` (IA apagada), variables de Telegram,
  variables de Drive backup. Al faltar, quedan desconectados.
- **Sin `.env` heredado de producción.** Solo las de arriba.

## Siembra de datos (tras provisionar)
`migrate deploy` (preDeploy del API) → `pnpm db:seed` → `node scripts/fixtures-deepseek.mjs`
contra `nexora-test-db`. Confirmar que existen el usuario inactivo, el bloqueado y el rol
custom (filas 7-9 de 3.1).

## Riesgos aceptados por la dueña (por escrito, 10-nov)
- **R1 — mismo workspace que prod:** el ejecutor tiene PROHIBIDO por instrucción explícita
  tocar cualquier recurso cuyo nombre no empiece por `nexora-test-`. Va en el prompt del
  ejecutor antes del primer curl.
- **R2 — API público vs prod privado:** cualquier hallazgo de "API expuesto" es **N/A para
  producción** (prod lo tiene privado) y se marca así en el reporte, sección de limitaciones.
  Los hallazgos de aplicación (auth, permisos, IDOR, dinero, inyección) sí aplican.

## No probado por diseño (va al resumen por capa, no es falla)
- Inyección de prompt en IA (capa 5) y subida a Anthropic (capa 6): sin clave, fuera.
- Instalador Windows (capa 9): sin host Windows.
- Rate limit del borde (Cloudflare/Render edge): la copia no tiene el mismo borde que prod.

## Límites que van por el PANEL (no por API)
- Tope de facturación / alerta: lo pone la dueña en el panel de Render.
- **Borrado al terminar** (no hay delete por API). Borrar desde el panel, en este orden y con
  estos nombres EXACTOS (no borrar otro):
  1. `nexora-test-api`
  2. `nexora-test-web`
  3. `nexora-test-db`

## Para arrancar capa 1, N1 le manda a DeepSeek
1. URL base del API: `https://nexora-test-api.onrender.com/api`.
2. `GET /api/health/live` = 200 desde el entorno del ejecutor (no la laptop).
3. Usuarios por rol (email, sin contraseña) + IDs de la sección 3.4.
4. Confirmación de que el ejecutor solo toca `nexora-test-*`.
