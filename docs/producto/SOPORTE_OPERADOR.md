# Acceso de soporte (N-05) · cómo lo usa el operador

Soporte solo entra cuando la empresa lo permite, solo lee, y el permiso vence solo.

## Flujo

1. **La empresa concede.** Una persona con permiso `*` (administración) abre
   la tarjeta *Soporte de Nexora* en Gestión y elige 24 h o 7 días
   (`POST /api/support-access/enable`). Esto crea o reactiva el usuario
   `soporte-nexora` de **esa** empresa con rol `support`, guarda
   `support.enable` en su bitácora y cierra cualquier sesión anterior de soporte.
   La pantalla muestra una clave una sola vez; el operador **no** la necesita.
2. **El operador ve los permisos activos** con su token de plataforma:
   ```
   GET /api/platform/support-grants
   Authorization: Platform <token del operador>
   → [{ "slug": "mi-tienda", "name": "Mi Tienda", "expiresAt": "…" }]
   ```
3. **El operador abre la sesión de solo lectura:**
   ```
   POST /api/platform/tenants/mi-tienda/support-session
   Authorization: Platform <token del operador>
   → { "accessToken": "…", "tokenType": "Bearer", "expiresIn": 900, "readOnly": true, "supportExpiresAt": "…" }
   ```
   Sin permiso vigente responde 403. El token dura 15 minutos y no tiene
   renovación: se vuelve a pedir. Queda `support.platform_session` en la
   bitácora de la empresa.
4. **Consultas.** Con `Authorization: Bearer <accessToken>` el operador usa los
   GET normales de la API (`/api/products`, `/api/reports/...`). Cada GET
   queda como `support.read`; cualquier escritura responde 403 y queda como
   `support.write_denied`. La transacción de base corre en `READ ONLY`.
5. **Fin.** Al vencer el plazo, o si la empresa pulsa *Desactivar*
   (`POST /api/support-access/disable`), el token deja de servir (401) en la
   siguiente petición y el canal en vivo se cierra.

## Garantías y pruebas

- El token solo lleva la empresa que concedió; no sirve para otra (RLS + `tenantId` firmado).
- Un token de empresa no abre rutas de plataforma (401) y sin
  `PLATFORM_ADMIN_TOKEN_SHA256` las rutas de plataforma no existen (404).
- Rotación sin corte (PLA-01): poner el SHA-256 del token nuevo en
  `PLATFORM_ADMIN_TOKEN_SHA256_NEXT` (ambos valen), cambiar el token en el
  cliente, luego mover el nuevo a `PLATFORM_ADMIN_TOKEN_SHA256` y borrar `_NEXT`.
- Prueba: `tests/product-support-platform-postgres.test.ts` (PostgreSQL real).

Pendiente: una pantalla del operador. Hoy se usa con `curl` o con una herramienta HTTP.
