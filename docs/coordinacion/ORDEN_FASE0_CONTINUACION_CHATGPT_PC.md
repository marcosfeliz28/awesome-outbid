# Orden para ChatGPT PC — continuar la fase 0 desde 81935d2 (Claude, arquitecto · 19-oct-2026)

Revisé `producto-nexora` hasta `81935d2` (Tenant + `tenantId` en 58 tablas, RLS con `SET LOCAL ROLE` y `app.tenant_id`, triggers de referencias cruzadas, alertas y SSE por empresa, `render.producto.yaml`). CI en verde. **Está bien hecho: no rehagas nada.** Esos commits son tu entrega; continúa sobre ellos en la misma rama.

## Regla fija
`producto-nexora` **nunca** se mezcla hacia `nexora-cloud` (añadiría 58 columnas a la base de la tienda). Solo al revés: `git merge origin/nexora-cloud` para traer arreglos.

## Siguiente incremento (cierra la puerta de fase 0)
1. **Cerrar por defecto.** Con `PRODUCT_TENANCY=required`, quitar el respaldo a `DEMO_TENANT_ID` en `tenantFromRequest` y en `tenantDatabaseProxy`: sin empresa → 400, salvo `/health` y el login. Consultas fuera de una petición (arranque, trabajos) sin `tenantScope` → error, nunca la empresa demo. Prueba que lo demuestre.
2. **Login por código de empresa.** `Tenant.slug` único (p. ej. `macgen`); el login recibe `slug` en vez del UUID en `x-tenant-id`. El UUID sigue en el JWT.
3. **Unicidad por empresa.** Convierte a `@@unique([tenantId, ...])` las claves globales: correo/usuario, SKU, código de barras, nombre de rol, nombres de categoría/almacén/caja, `operationId`/idempotencia, y **la numeración de facturas, recibos y comprobantes** (cada empresa empieza su propia secuencia FS-0000001). Prueba: dos empresas crean el mismo correo, SKU y factura n.º 1 sin choque.
4. **Matriz completa.** Enumera las rutas desde el router de Nest en la prueba y **falla si una ruta no tiene caso** (lista explícita de excepciones justificadas). Para cada GET/POST/PATCH/DELETE: cuerpo válido, la empresa B no ve ni cambia lo de A (un 400 por cuerpo inválido no cuenta). Incluye exportaciones Excel/PDF, búsquedas, SSE y los 40 reportes. Resultado esperado: N rutas, 0 fugas.
5. **Trabajos de fondo por empresa.** Notificaciones, recordatorios de crédito y retención: recorren las empresas activas y corren cada una dentro de `tenantScope`. El respaldo con `pg_dump` sigue apagado en modo producto (el respaldo por empresa es fase 1).
6. **Rol RLS en Render.** En `render.producto.yaml` y en FASE0_IMPLEMENTACION.md, deja el paso exacto para crear `nexora_tenant_runtime` en la base nueva (script `scripts/producto-bootstrap.sql` que Claude correrá una vez). No lo apliques.

## Entrega
- Commits en `producto-nexora`, `pnpm check` y los 3 CI en verde.
- `RESULTADOS_CHATGPT.md`: número de rutas en la matriz, excepciones y por qué, 0 fugas, lo pendiente.
- Avisa a la dueña con una línea; Claude revisa, crea los servicios nuevos en Render y despliega la demo. Después viene la fase 1 (registro, prueba de 14 días, cobro).
