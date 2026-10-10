# Instrucciones para la revisión con IA de Nexora POS

> **Nota (G13):** revisión automatizada hecha con un modelo de IA. No es una auditoría independiente ni una certificación; no la cites como respaldo ante terceros.

Adjunta a este documento el archivo `Nexora-POS-Codigo-Auditoria-e8f462a.zip` y su manifiesto `.sha256.txt`. La versión fuente corresponde al commit `e8f462a` del repositorio `marcosfeliz28/awesome-outbid`, rama `nexora-cloud`. Ese commit contiene el ejemplo de usuario `mfeliz`, el arreglo concurrente de apertura de caja, la instrumentación de errores de la API y el pipeline opcional de respaldo cloud. Al preparar este paquete, esos últimos cambios estaban pendientes de desplegar en Render.

## Prompt para Gemini o Cloud

Actúa como auditor independiente de software POS, con énfasis en integridad contable, seguridad y operación real. Inspecciona únicamente el código y las pruebas dentro del ZIP adjunto. No supongas que una función existe por estar descrita aquí: encuentra su implementación y pruebas, e indica rutas, símbolos y líneas que sostengan cada conclusión. Si el artefacto no contiene evidencia suficiente, decláralo como no verificado; no reemplaces la revisión por teoría general.

### Contexto técnico

Nexora POS es una aplicación web/PWA para una tienda pequeña, utilizada por varias cajas. El cliente usa React, TypeScript, Vite y Zustand; la API usa Node.js, NestJS y Prisma; los datos viven en PostgreSQL 17 en Render. La PWA usa IndexedDB/Dexie para trabajo sin conexión. La misma plataforma incluye roles de cajero y administración, sesiones de caja, inventario, ventas, pagos, crédito/contraentrega, anulaciones, devoluciones e impresión.

La versión entregada ya implementa inicio de sesión por nombre de usuario, requisito de cliente identificado para cada venta nueva, selección/creación rápida del cliente, asociación de cliente a ventas offline antiguas antes de sincronizar, acceso administrativo a anulaciones sin abrir caja, y medición de operaciones POS en Sentry con datos de texto y medios enmascarados. El documento del cajero y las instrucciones operativas están incluidos en `docs/` cuando aparecen en el manifiesto.

### Artefacto a auditar

El ZIP contiene código fuente, migraciones, pruebas y documentación seleccionados. Prioriza, sin limitarte a:

- `apps/api/src/sales.ts`, `apps/api/src/admin.ts` y `apps/api/src/*`;
- `apps/api/prisma/schema.prisma` y todas las migraciones;
- `apps/web/src/POS.tsx`, `apps/web/src/Management.tsx`, `apps/web/src/Prints.tsx`, `apps/web/src/monitoring.ts` y `apps/web/src/api.ts`;
- `apps/web/vite.config.ts`, `render.yaml`, Dockerfiles, `scripts/backup.mjs`;
- pruebas API, integración, interfaz, portabilidad y restauración en `tests/` e `instalador/tests/`.

Comprueba primero el SHA-256 del ZIP contra el manifiesto adjunto. No infieras que el archivo es completo si el manifiesto o el inventario no coinciden.

### Comportamiento esperado vs. realidad

Se espera que toda venta nueva requiera cliente; que pagos, stock, devoluciones y cierre de caja sean atómicos e idempotentes; que cajeros no puedan anular ventas y administradores puedan anularlas con motivo/auditoría sin abrir caja; que las ventas offline no se dupliquen ni queden sin salida operativa; que los informes impresos reflejen los datos reales del usuario/caja; y que una restauración fallida no destruya la base de producción.

La versión compila en local (`pnpm build`) y la suite de portabilidad/restauración pasó 24/24. La API de producción respondió `status: ok` y `database: ok` tras el despliegue. Estas comprobaciones no equivalen a aprobar la lógica contable, a ejecutar todas las pruebas con PostgreSQL real ni a certificar hardware, impresión fiscal o una restauración de producción. Identifica las diferencias entre evidencia automatizada y lo que aún requiere ensayo real.

### Logs, advertencias y límites conocidos

- El build web advierte que un bundle minificado supera 500 KB; la compilación sí termina.
- No se proporcionan contraseñas, tokens, `.env`, credenciales de Render/Sentry, datos reales de clientes ni dumps de producción. Ninguno es necesario para una auditoría estática de código; no solicites ni publiques esos secretos.
- Sentry está instrumentado en el cliente con muestreo de trazas, Replay limitado y campos sensibles enmascarados; la API backend no tiene SDK de Sentry en esta entrega.
- Render bloquea actualmente las conexiones externas entrantes a PostgreSQL. No intentes cambiar listas de IP, usuarios, permisos, planes, producción ni secretos; limita recomendaciones de despliegue a cambios claramente descritos y separados.
- El script de backup verifica un dump con `pg_restore --list`, genera SHA-256/manifiesto y retiene copias locales por 30 días. El respaldo diario del instalador cubre la base local; el script no crea por sí solo una tarea programada para copiar la base cloud a la laptop. Render muestra PITR de tres días; la exportación lógica manual aparece deshabilitada para el plan actual.
- La PWA es instalable desde el navegador en teléfonos compatibles; el ZIP no certifica un paquete nativo firmado de iOS/Android ni instaladores Windows firmados.

### Restricciones

No modificar datos ni desplegar cambios. No asumir acceso a producción. No proponer desactivar autenticación, permisos, cifrado, límites de red o auditoría. No inventar logs ausentes. Distingue claramente los hechos verificados, inferencias y preguntas abiertas.

### Vector de auditoría y entregable

Prioriza: (1) integridad financiera y concurrencia; (2) autorización, sesiones y protección de datos; (3) idempotencia de ventas/devoluciones/pagos/sincronización offline; (4) caja, crédito/contraentrega, anulaciones y devoluciones; (5) inventario y variantes; (6) backup/restore y migraciones; (7) PWA y accesibilidad móvil; (8) observabilidad y privacidad de Sentry; (9) dependencias, secretos y despliegue.

Devuelve:

1. Resultado de verificación del SHA-256 e inventario de archivos.
2. Dictamen general: apto, apto con condiciones o no apto para producción multi-caja.
3. Hallazgos ordenados por severidad (P0–P3), cada uno con archivo/líneas, escenario reproducible, impacto, evidencia en pruebas y corrección mínima.
4. Lista de áreas que no pudieron verificarse por falta de evidencia.
5. Pruebas concretas que deben añadirse o ejecutarse antes de operar con varios cajeros.

No generes una reescritura amplia del sistema ni parches especulativos. Si sugieres un parche, limita la propuesta a hallazgos confirmados y preséntala en `unified diff` separado del dictamen.
