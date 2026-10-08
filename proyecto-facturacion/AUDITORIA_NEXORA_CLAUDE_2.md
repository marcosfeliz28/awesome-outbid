# Auditoría Claude · Nexora POS · ZIP Codigo-Auditoria (SHA-256 f25cac88…4d54, verificado)

Sin contraseñas, tokens ni URLs de base de datos. Sin pruebas contra producción.

## 1. Correcciones pedidas: verificadas

| Punto | Resultado |
|---|---|
| A3 (IP del cliente) | **Aceptada.** nginx usa sólo `$remote_addr`; ya no confía en CF-Ray ni CF-Connecting-IP. Ver N1 por su efecto. |
| Empaquetado | **Aceptado.** Ahora incluyen render.yaml, docs/DEPLOY-RENDER.md, deploy/render/backup y lanzar-instalacion-silenciosa.ps1. |
| Exclusiones | **Aceptadas.** Todas son capturas, xlsx y reportes históricos en docs/; ningún código. |
| CSP de Sentry | **Aceptada.** Host exacto del DSN en vez de comodín. |
| Contraseña temporal | **Aceptada.** El esquema rechaza clave nueva igual a la actual. |
| Pruebas | Con el código nuevo: 3 archivos de prueba, 45 pasan, 1 omitida. `pnpm check`: 168 pasan, 1 omitida. |

## 2. Hallazgo nuevo por la corrección A3

**N1 · P2 · Límite de intentos global (nginx.conf.template línea 1; apps/api/src/main.ts, middleware de intentos).**
Al usar sólo `$remote_addr`, todas las personas llegan a la API con la IP del proxy de Render. El límite por IP (60/min en `/api/auth/`, 120/min en `POST /api/sales`) pasa a ser UN contador compartido por todos.
- Reproducción: desde un cliente, 61 peticiones a `/api/auth/login` en un minuto; después un usuario legítimo desde otro equipo recibe 429.
- Efecto: cualquiera puede dejar sin acceso a las 4 cajas (denegación de servicio con bajo costo). Además la IP guardada en auditoría deja de identificar al cliente.
- Propuesta: (a) mantener el límite por IP pero subirlo a un valor que no ahogue al negocio y añadir límite por cuenta+IP; (b) si Render documenta una cabecera que su borde sobrescribe siempre, usarla, citada; (c) regresión: 61 logins desde una "IP" no deben bloquear a otra cuenta.

## 3. Pendientes de la ronda 9

**A07 · P2 · Arqueo a ciegas (confirmado, sin corregir).**
- apps/web/src/Management.tsx:1425-1443 muestra a la cajera el efectivo, tarjeta y transferencia ESPERADOS antes de contar.
- apps/api/src/cash.ts:645-646: tarjeta y transferencia no declaradas se rellenan con lo esperado (diferencia 0 automática).
- cash.ts:684 sólo crea una alerta si la diferencia supera `cashDifferenceLimit`; no exige nota ni confirmación.
- Reproducción: cerrar una caja sin enviar countedCard/countedTransfer; la diferencia sale 0 aunque no se contó nada.
- Regresión propuesta: cierre sin tarjeta/transferencia se trata como 0 y exige confirmación explícita; diferencia mayor al límite sin nota devuelve 400; cajera sin `profit:read`/`sale:manage` no recibe `expected` en el detalle de la sesión abierta.

**A08 · P2 · Fotos de evidencia en base64 dentro de las listas (confirmado).**
- cash.ts:358 (cuadre.cod.rows) y sales.ts:1656 (collections) devuelven `proofUrl` completo (data:image/…;base64). sales.ts:1566 lo guarda así en la base.
- Reproducción: registrar 20 cobros con foto de ~1 MB y pedir el listado: respuesta de ~20 MB.
- Propuesta: `hasProof: boolean` en las listas y `GET /payments/:id/proof` autenticado con la misma regla de acceso que el POST; la miniatura carga con fetch+blob.
- Regresión: la lista no contiene la cadena "base64" y el GET de la foto respeta permisos (otra caja sin sale:manage recibe 403).

**A06 · P3 · operationId opcional en recepción (parcial).**
- inventory.ts:716 `operationId: uuid.optional()`; el bloqueo e idempotencia (líneas 771-782) sólo actúan si viene. La interfaz siempre lo envía (Purchases.tsx:405, Merchandise.tsx:502), así que el riesgo es de otros clientes.
- Reproducción: dos POST idénticos sin operationId crean dos recepciones y duplican el stock.
- Propuesta: hacerlo obligatorio y devolver la misma recepción (200) en el reintento; regresión de doble envío concurrente.

**A10 · P3 · Dependencias (`pnpm audit --prod`: 4 hallazgos, 2 altos).**
- effect <3.20 y deepmerge-ts <8: vienen de la cadena @prisma/client>prisma>@prisma/config; son herramientas de línea de comandos, no del servicio en ejecución.
- uuid <11.1.1 (exceljs) y js-yaml 5.0–5.4.0 (@nestjs/swagger): bajo riesgo; Swagger está apagado en producción.
- Propuesta: subir Prisma/exceljs/swagger a versiones con parche o fijar `pnpm.overrides`; sólo si `pnpm check` sigue en verde. Documentar el riesgo residual si no se puede.

**A11 · P3 · Efectivo recibido y cambio (parcial).**
- El ticket térmico sí imprime pagos recibidos y «Cambio» (Prints.tsx:304-346).
- No verifiqué el PDF ni el historial de la venta con esta revisión. Pendiente de confirmar que ambos muestran recibido y cambio; añadir regresión sobre el payload `tendered/change`.

**A12 · P3 · Autorizador del descuento no se imprime (confirmado).**
- sales.ts:760-775 guarda `discount_approved` con `approvedBy` sólo en la bitácora. Prints.tsx muestra el descuento (línea 335) pero no quién lo autorizó; no hay ese dato en el reporte de ventas.
- Propuesta: guardar `discountApprovedBy` en la venta y mostrar «Autorizó: nombre» en ticket y reporte; regresión: venta con descuento aprobado por gerente lo incluye.

## 4. Sin probar en esta revisión
nginx real, Docker sandbox, restauración real de la base, Windows 11 limpio, PDF de venta, flujo offline. Rotar las credenciales del expediente al terminar.
