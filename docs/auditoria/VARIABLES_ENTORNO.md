# Variables de entorno (tarea 82)

Borrador sin verificar. Columna 3: solo indica si la línea de lectura tiene `||` o `??`; algunos casos no son valores por defecto (p. ej. comparaciones con `===`). Fuente: `origin/producto-nexora` (`415f602a`), rama `claude-pc/cola-b13`. Nombres leídos con `grep -rnoE "process\.env\.[A-Z0-9_]+" apps/api/src`. **Sin valores**: no se leyeron archivos `.env*` ni `docs/operacion/` (orden 70).

| Nombre | Archivo:línea donde se lee | ¿La línea usa `||` o `??`? (indicio, no prueba de valor por defecto) |
|---|---|---|
| `ANTHROPIC_API_KEY` | `apps/api/src/assistant.ts:1283` | no |
| `ANTHROPIC_MODEL` | `apps/api/src/merchandise.ts:278` | sí |
| `APP_PUBLIC_URL` | `apps/api/src/mcp.ts:25` | no |
| `AUTH_ACCOUNT_RATE_LIMIT` | `apps/api/src/rate-limit.ts:26` | no |
| `AUTH_IP_RATE_LIMIT` | `apps/api/src/rate-limit.ts:31` | no |
| `AUTH_UNKNOWN_GLOBAL_RATE_LIMIT` | `apps/api/src/rate-limit.ts:33` | no |
| `BILLING_TEST_MODE` | `apps/api/src/product-billing.ts:21` | no |
| `DATABASE_URL` | `apps/api/src/common.ts:44` | no |
| `ENABLE_SWAGGER` | `apps/api/src/main.ts:73` | sí |
| `IMPORT_SESSION_RATE_LIMIT` | `apps/api/src/rate-limit.ts:42` | no |
| `INVENTORY_IMPORT_SESSION_RATE_LIMIT` | `apps/api/src/rate-limit.ts:46` | no |
| `JWT_SECRET` | `apps/api/src/drive-backup.ts:1163` | sí |
| `LOGOUT_SESSION_RATE_LIMIT` | `apps/api/src/rate-limit.ts:38` | no |
| `MCP_OAUTH_CLIENTS` | `apps/api/src/mcp.ts:27` | sí |
| `MCP_TOKEN_SECRET` | `apps/api/src/mcp.ts:24` | no |
| `NEXORA_BILLING_BANK_ACCOUNT` | `apps/api/src/product-billing.ts:27` | no |
| `NEXORA_BILLING_BANK_HOLDER` | `apps/api/src/product-billing.ts:27` | no |
| `NEXORA_BILLING_BANK_NAME` | `apps/api/src/product-billing.ts:27` | no |
| `NEXORA_IA_MODEL` | `apps/api/src/assistant.ts:1299` | sí |
| `NEXORA_RETENTION` | `apps/api/src/retention.ts:218` | no |
| `NEXORA_VENTAS_CAJA_CIEGA` | `apps/api/src/sales.ts:149` | no |
| `NODE_ENV` | `apps/api/src/auth.ts:406` | no |
| `NOTIFY_EMAIL_FROM` | `apps/api/src/registration.ts:64` | no |
| `PATH` | `apps/api/src/drive-backup.ts:533` | sí |
| `PIN_SESSION_RATE_LIMIT` | `apps/api/src/rate-limit.ts:36` | no |
| `PLATFORM_ADMIN_TOKEN_SHA256` | `apps/api/src/platform.ts:55` | no |
| `PLATFORM_ADMIN_TOKEN_SHA256_NEXT` | `apps/api/src/platform.ts:58` | no |
| `PLATFORM_OPERATOR_LABEL` | `apps/api/src/platform-billing.ts:166` | sí |
| `PORT` | `apps/api/src/assistant.ts:1311` | sí |
| `PRODUCT_LEGAL_APPROVED` | `apps/api/src/registration.ts:194` | no |
| `PRODUCT_LOCAL_INSTALLATION_ID` | `apps/api/src/local-license.ts:255` | no |
| `PRODUCT_LOCAL_LICENSE` | `apps/api/src/local-license.ts:249` | no |
| `PRODUCT_LOCAL_LICENSE_DIR` | `apps/api/src/local-license.ts:250` | no |
| `PRODUCT_LOCAL_LICENSE_PUBLIC_KEY` | `apps/api/src/local-license.ts:251` | no |
| `PRODUCT_LOCAL_LICENSE_RENEW_TOKEN` | `apps/api/src/local-license.ts:224` | no |
| `PRODUCT_LOCAL_LICENSE_RENEW_URL` | `apps/api/src/main.ts:56` | no |
| `PRODUCT_LOCAL_TENANT_ID` | `apps/api/src/local-license.ts:262` | sí |
| `PRODUCT_MCP_ENABLED` | `apps/api/src/mcp.ts:26` | sí |
| `PRODUCT_OBJECT_BUCKET` | `apps/api/src/tenant-object-store.ts:101` | no |
| `PRODUCT_OBJECT_ENDPOINT` | `apps/api/src/tenant-object-store.ts:113` | no |
| `PRODUCT_OBJECT_REGION` | `apps/api/src/tenant-object-store.ts:101` | no |
| `PRODUCT_OBJECT_STORE_DIR` | `apps/api/src/tenant-object-store.ts:109` | sí |
| `PRODUCT_PRIVACY_VERSION` | `apps/api/src/registration.ts:50` | no |
| `PRODUCT_PUBLIC_REGISTRATION` | `apps/api/src/registration.ts:135` | no |
| `PRODUCT_TENANCY` | `apps/api/src/admin.ts:165` | sí |
| `PRODUCT_TERMS_VERSION` | `apps/api/src/registration.ts:49` | no |
| `REFRESH_SESSION_RATE_LIMIT` | `apps/api/src/rate-limit.ts:37` | no |
| `RESEND_API_BASE` | `apps/api/src/registration.ts:70` | sí |
| `RESEND_API_KEY` | `apps/api/src/registration.ts:63` | no |
| `SALES_SESSION_RATE_LIMIT` | `apps/api/src/rate-limit.ts:39` | no |
| `TRUSTED_PROXIES` | `apps/api/src/rate-limit.ts:144` | no |
| `USD_RATE_AUTO` | `apps/api/src/usd-rate.ts:162` | no |
| `WEB_ORIGIN` | `apps/api/src/main.ts:23` | no |
