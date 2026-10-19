# Orden para ChatGPT PC — construir Nexora como producto, FASE 0 (19-oct-2026)

Lee primero `docs/producto/ARQUITECTURA_NEXORA_PRODUCTO.md` (Claude, arquitecto). Tú construyes; Claude revisa y despliega.

## Fase 0 — alcance exacto
1. Crea la rama `producto-nexora` desde `origin/nexora-cloud`.
2. Modelo `Tenant` y `tenantId` en todas las tablas de negocio (migración aditiva; los datos existentes de una base nueva quedan en un tenant «demo»). Guardia central: `actor.tenantId` en el token y filtro obligatorio, igual que hoy con `branchId`.
3. Row-Level Security de PostgreSQL en las tablas con `tenantId` y `SET LOCAL app.tenant_id` por transacción (Prisma `$transaction` / extensión). Documenta cómo se activa.
4. Matriz automática de aislamiento: dos empresas con datos; para CADA ruta GET/POST/PATCH/DELETE comprueba que la empresa B no puede ver ni cambiar nada de A (incluye reportes, los 40 reportes nuevos, exportaciones Excel/PDF, respaldos y búsquedas).
5. `render.producto.yaml` (blueprint aparte) con servicios y base NUEVOS. **No lo apliques**: Claude lo crea en Render.
6. Sin cambios de comportamiento para la tienda: el código de la tienda en `nexora-cloud` no se toca.

## Entrega
- Rama `producto-nexora` publicada, `pnpm check` en verde y los 3 CI en verde.
- Informe en `docs/coordinacion/RESULTADOS_CHATGPT.md`: qué tablas, cómo funciona RLS, resultado de la matriz (número de rutas probadas, 0 fugas), lo que quede pendiente.
- No despliegues, no uses la base ni credenciales de la tienda, no mezcles con `nexora-cloud`.
