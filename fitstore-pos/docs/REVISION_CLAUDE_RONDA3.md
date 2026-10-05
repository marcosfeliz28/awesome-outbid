# Revisión de Claude · ronda 3

## Implementación

- SSE autenticado mediante cabecera, sucursal y sesión. PostgreSQL guarda stock.changed y alert.created con triggers; la segunda migración difiere su publicación al final de la transacción y serializa los identificadores de eventos en orden de commit. Los rollbacks no comunican existencias. El cliente reconecta y recarga catálogo, actualiza carrito, inventario, dashboard y campana.
- Equipos persistentes, nombre editable, actividad, conexión estimada, caja abierta y revocación de sesiones. El equipo se asocia a AuthSession; la caja usa su identificador. El primer registro vincula una caja antigua sin equipo. Cada caja simultánea requiere usuario propio.
- Mercancía adaptable al celular con entrada/salida, cámara continua, vibración si hay soporte, cantidades/costos, proveedor/orden opcionales, lotes y creación rápida atómica. Motivos de salida y auditoría con equipo. Cola Dexie por usuario/sucursal y UUID idempotente, conflictos revisables y etiquetas después de sincronizar.
- Importación Excel/CSV con mapeo por proveedor; foto/PDF con Anthropic opcional y herramienta JSON estructurada. Revisión obligatoria, coincidencia por código/SKU/equivalencia/nombre, confianza, edición y resolución de líneas. Confirmación con comparación del total, prorrateo de costos y comprobante privado en PostgreSQL. No hay endpoint que salte la revisión de un borrador ya confirmado.
- RBAC: vendedor bloqueado; almacén puede introducir costos de recepción y retirar mercancía sin acceder a ganancias.

## Verificación

- `pnpm check`: TypeScript, ESLint, 16 pruebas unitarias y compilación web/API aprobados.
- `pnpm test:integration`: 57 pruebas aprobadas sobre PostgreSQL, incluidas 12 de esta ronda.
- `pnpm test:e2e`: seis escenarios Chromium aprobados sobre la PWA compilada: los cuatro de facturación, Mercancía móvil con recarga offline/sincronización/etiquetas e importación CSV con revisión.
- Tres cajas sobre stock inicial 5: dos ventas de 2 y una rechazada, saldo 1 comunicado a los tres clientes en menos de dos segundos. Se verifican también rollback, filtro de sucursal, orden de commit y eventos tras recepción, devolución, anulación y conteo.
- Migraciones aplicadas en la base local. Registros en `docs/validacion/ronda3-check.txt`, `ronda3-integracion.txt`, `ronda3-navegador.txt` y `ronda3-migracion.txt`.

 Las pruebas de IA simulan la respuesta HTTP; no se ha llamado Anthropic real. La prueba de SSE mide tres clientes sobre la red local del entorno: no certifica la latencia de la red de tienda. Cámara física, vibración, impresora y proxy de producción requieren comprobación en tienda.

## Decisiones

Se usa outbox de PostgreSQL con polling cada 100 ms y entrega SSE, sin dependencias externas de mensajería. La publicación diferida evita perder eventos cuando dos transacciones empiezan y confirman en órdenes distintos. Se guardan comprobantes dentro de la base para disponer de autorización y respaldo comunes. La importación offline consiste en guardar una recepción revisada; extraer un archivo o consultar órdenes requiere internet.

Las alertas se ordenan por última actualización. Se excluyen productos desactivados de la evaluación y se conservan las fechas de alertas cuyo contenido no cambió, evitando que datos históricos oculten conflictos recientes. Esta ronda no cambia el carácter interno/no fiscal de los documentos.

La validación de navegador usa el servidor preview en 4173, iniciado por Playwright, después de compilar. La primera instalación de la PWA requiere recargar en línea antes de comprobar una recarga offline. El catálogo descarga variantes nuevas al recibir su primer evento, incluso si no se había abierto el POS.
