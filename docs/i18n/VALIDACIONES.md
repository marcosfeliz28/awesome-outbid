# Mensajes de validación de formularios (tarea 79)

Borrador sin verificar. Fuente: `origin/producto-nexora` (`415f602a`), rama `claude-pc/cola-b13`. Lista por script: `grep -rn -E "message:|\.(min|max|email|regex|refine)\("` sobre `packages/shared/src` y `apps/api/src`, solo las líneas con una frase en español entre comillas. **PARCIAL**: no se cubrieron los mensajes en el web (`apps/web/src`) ni los que llegan por cadenas construidas. Clave propuesta: `validacion.<archivo>.<n>`, mecánica; no revisada por nombre.

| Mensaje | Archivo:línea | Clave propuesta |
|---|---|---|
| debe ser al menos 0.001 | `packages/shared/src/index.ts:35` | `validacion.index.1` |
| debe tener como máximo 2 decimales | `packages/shared/src/index.ts:48` | `validacion.index.2` |
| debe ser distinta de 0 | `packages/shared/src/index.ts:296` | `validacion.index.3` |
| El RNC lleva 9 dígitos y la cédula 11. | `packages/shared/src/index.ts:648` | `validacion.index.4` |
| indica el efectivo contado o el conteo por denominaciones | `packages/shared/src/index.ts:807` | `validacion.index.5` |
| El PIN debe tener 6 dígitos (sólo números). | `apps/api/src/admin.ts:233` | `validacion.admin.6` |
| Cuenta por cobrar cerrada de cliente anonimizado. | `apps/api/src/admin.ts:579` | `validacion.admin.7` |
| Escribe el código de empresa. | `apps/api/src/app.ts:184` | `validacion.app.8` |
| Código de empresa no disponible. | `apps/api/src/app.ts:193` | `validacion.app.9` |
| Falta el contexto de empresa. | `apps/api/src/app.ts:201` | `validacion.app.10` |
| Escribe tu usuario. | `apps/api/src/auth.ts:457` | `validacion.auth.11` |
| Las contraseñas nuevas no coinciden. | `apps/api/src/auth.ts:551` | `validacion.auth.12` |
| La contraseña nueva debe ser distinta de la temporal. | `apps/api/src/auth.ts:558` | `validacion.auth.13` |
| Las contraseñas nuevas no coinciden. | `apps/api/src/auth.ts:683` | `validacion.auth.14` |
| La contraseña nueva debe ser distinta de la actual. | `apps/api/src/auth.ts:690` | `validacion.auth.15` |
| otra persona | `apps/api/src/cash.ts:312` | `validacion.cash.16` |
| Escribe el motivo de la apertura (mínimo 5 caracteres). | `apps/api/src/cash.ts:866` | `validacion.cash.17` |
| Indica una venta o un movimiento de caja. | `apps/api/src/cash.ts:869` | `validacion.cash.18` |
| es obligatorio | `apps/api/src/common.ts:250` | `validacion.common.19` |
| tiene un formato inválido | `apps/api/src/common.ts:280` | `validacion.common.20` |
| no es una opción válida | `apps/api/src/common.ts:282` | `validacion.common.21` |
| no es una fecha válida | `apps/api/src/common.ts:284` | `validacion.common.22` |
| debe ser un mes AAAA-MM | `apps/api/src/incentives.ts:622` | `validacion.incentives.23` |
| Esta caja no tiene movimientos en el período. | `apps/api/src/income-report.ts:261` | `validacion.income-report.24` |
| ,  | `apps/api/src/inventory-import-core.ts:216` | `validacion.inventory-import-core.25` |
| ,  | `apps/api/src/inventory-import-core.ts:224` | `validacion.inventory-import-core.26` |
| ,  | `apps/api/src/inventory-import-core.ts:291` | `validacion.inventory-import-core.27` |
| el ID  | `apps/api/src/inventory-import-core.ts:390` | `validacion.inventory-import-core.28` |
| ), text.lastIndexOf( | `apps/api/src/invoice.ts:422` | `validacion.invoice.29` |
| Lote de ventas inválido. | `apps/api/src/local-license.ts:292` | `validacion.local-license.30` |
| ) return { jsonrpc:  | `apps/api/src/mcp.ts:182` | `validacion.mcp.31` |
| Escribe de 1 a 12 dígitos. | `apps/api/src/ncf-sequences.ts:9` | `validacion.ncf-sequences.32` |
| Escribe de 1 a 13 dígitos. | `apps/api/src/ncf-sequences.ts:10` | `validacion.ncf-sequences.33` |
| Fecha inválida. | `apps/api/src/ncf-sequences.ts:11` | `validacion.ncf-sequences.34` |
| Escribe un tipo Bxx o Exx. | `apps/api/src/ncf-sequences.ts:18` | `validacion.ncf-sequences.35` |
| Mensaje de prueba en cola: llegará al grupo en unos segundos. | `apps/api/src/notifications.ts:1071` | `validacion.notifications.36` |
| ,  | `apps/api/src/onboarding.ts:10` | `validacion.onboarding.37` |
| La referencia parece un número de tarjeta; anota solo el número de operación o recibo. | `apps/api/src/platform-billing.ts:34` | `validacion.platform-billing.38` |
| Indica los meses (1 a 12) o el año, no ambos. | `apps/api/src/platform-billing.ts:37` | `validacion.platform-billing.39` |
| Demasiadas conexiones abiertas. | `apps/api/src/realtime.ts:478` | `validacion.realtime.40` |
| Tiempo real no disponible. Reintenta. | `apps/api/src/realtime.ts:528` | `validacion.realtime.41` |
| El PIN debe tener 6 números y no ser una secuencia fácil. | `apps/api/src/registration.ts:18` | `validacion.registration.42` |
| Cuenta creada. Confirma tu correo para entrar. | `apps/api/src/registration.ts:163` | `validacion.registration.43` |
| Cuenta creada, pero no llegó la confirmación. Usa Reenviar confirmación. | `apps/api/src/registration.ts:167` | `validacion.registration.44` |
| Correo confirmado. Ya puedes entrar. | `apps/api/src/registration.ts:178` | `validacion.registration.45` |
| Listo. Ya puedes entrar con tu código de empresa, correo y contraseña. | `apps/api/src/registration.ts:223` | `validacion.registration.46` |
| Si la cuenta está pendiente, recibirás un enlace nuevo. | `apps/api/src/registration.ts:237` | `validacion.registration.47` |
| Si la cuenta está pendiente, recibirás un enlace nuevo. | `apps/api/src/registration.ts:244` | `validacion.registration.48` |
| Días restantes | `apps/api/src/reportes/inventario.ts:86` | `validacion.inventario.49` |
| Venta offline pendiente:  | `apps/api/src/sales.ts:1655` | `validacion.sales.50` |
| Venta offline pendiente:  | `apps/api/src/sales.ts:1659` | `validacion.sales.51` |
| Máximo tres decimales. | `apps/api/src/warehouses.ts:45` | `validacion.warehouses.52` |
