# Cobertura y estado de entrega

Fuente: `INSTRUCCIONES_ARQUITECTURA.md`. Esta tabla distingue lo implementado de lo que todavía requiere trabajo. La aplicación no equivale a una entrega completa de todos los criterios del documento.

| Etapa                     | Implementación disponible                                                                                                                                                                                                                           | Pendientes materiales                                                                                                                                                                                 |
| ------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0 · Fundaciones           | Monorepo pnpm, migración PostgreSQL, Prisma, login/JWT/refresh/PIN, sesiones configurables y revocables, permisos en backend, layout adaptable, tema, guía de estilos y mockups previos                                                             | OpenAPI expone rutas; faltan DTO y ejemplos exhaustivos. El timeout configurado se aplica en cliente/API; cambios de credenciales revocan sesiones y refresh.                                         |
| 1 · Catálogo              | Cinco categorías, marcas, productos, variantes/matriz, códigos únicos, imagen por URL, importación XLSX y plantilla, etiquetas Code 39, kits por API                                                                                                | CSV, carga de fotos privada, galería múltiple y editor visual de kits.                                                                                                                                |
| 2 · Inventario y compras  | Lotes/vencimiento, FEFO, kardex, ajustes/mermas, órdenes y recepción parcial, costo promedio, Mercancía móvil/offline, importación CSV/XLSX/IA con revisión y comprobante, proveedores y pagos, conteos aprobados sin lote                                                                                       | Conteo por lote, validación de IA/cámara con hardware real, reposición predictiva y gestión completa de saldos por factura de proveedor.                                                                             |
| 3 · POS y pagos           | Búsqueda/lector, variantes, descuentos por línea/global, PIN de gerente, clientes, pagos múltiples, notas de crédito, crédito/abonos, cambio en efectivo, referencia y aprobación, venta atómica, ticket/PDF/borrador de envío, espera/cotizaciones | Adjuntar comprobantes. Descuento por monto y crédito/abonos ya están implementados. La oferta por lote y combos promocionales todavía no están habilitados.                                           |
| 4 · Caja y devoluciones   | Apertura única por usuario/terminal, entradas/salidas, arqueo por método, cierre, devolución parcial, stock/merma, nota interna de crédito, anulación auditada                                                                                      | Interfaz de cambio de talla en un único flujo; hoy se devuelve y se crea una venta nueva. El saldo de nota de crédito ya se usa como pago.                                                            |
| 5 · Gastos                | Categorías, registro/anulación, presupuestos, alertas y marca de recurrente                                                                                                                                                                         | Generación mensual automática y carga privada de comprobantes.                                                                                                                                        |
| 6 · Estadísticas          | Resumen, ventas por día/categoría/vendedor/método, productos destacados, costos históricos, gastos/ganancia neta, 17 vistas PDF/XLSX, filtros de fechas, horas pico y comparación anual                                                             | Comparativos mensuales detallados, filtros visuales avanzados, paginación de exportaciones grandes y vistas materializadas nocturnas. Mapa de horas pico y comparación anual implementados.           |
| 7 · Alertas y liquidación | Stock bajo/agotado/exceso, sin movimiento, vencimiento, margen, presupuesto/caja, evaluación diaria en proceso y al consultar, baja venta, descuentos inusuales, centro de estados, puntaje y descuento seguro                                      | Evaluación incremental general al vender, canales externos y reglas por categoría/producto. Baja venta y descuentos inusuales implementados; los thresholds JSON todavía no alteran todas las reglas. |
| 8 · Offline y paquetes    | Catálogo sin costos en IndexedDB, UUID único, número provisional, sync ordenado, conflictos conservados, sincronización en caja cerrada auditada, service worker, equipos/revocación, stock por SSE, cola de mercancía y configuraciones Capacitor/Tauri                                                   | Instaladores compilados/firmados, hardware de impresión directa, conflictos de ventas asistidos y sincronización de apertura/cierre de caja offline.                                                     |
| 9 · Entrega               | Datos ficticios, pruebas de fórmulas, pruebas API y Playwright, CI, manual, decisiones, Docker/Compose/Nginx y script de backup                                                                                                                     | Despliegue externo, recuperación de backup probada y certificación de rendimiento, seguridad y hardware con entorno real.                                                                             |

## Validación registrada

La revisión de Claude, sus correcciones y sus criterios están en [REVISION_CLAUDE.md](REVISION_CLAUDE.md). Los registros de las ejecuciones se incluyen en `docs/validacion/`.

- Antes de las correcciones: 9 fallos y 13 aprobadas en la suite inicial ampliada.
- `pnpm check`: TypeScript, ESLint, 16 pruebas unitarias y compilación web/API aprobados.
- `pnpm test:integration`: 57 pruebas aprobadas con PostgreSQL en la ronda 3.
- `pnpm test:e2e`: 6 escenarios Chromium aprobados sobre la PWA compilada: pago combinado/recibo, gestión/tema/móvil, offline/sync, descuento por monto/crédito/abono, Mercancía móvil offline/etiquetas e importación CSV con revisión.
- No se han validado hardware de impresión, instaladores nativos, restauración de backups ni operación en producción.

## Supuestos por etapa

0: una sucursal `main`; roles predefinidos y permisos editables; números monetarios Decimal.
1: imágenes de demostración son ilustraciones propias locales; stock inicial se recibe/ajusta, nunca se edita sin kardex.
2: promedio ponderado, FEFO y stock no negativo por defecto; opción explícita para productos sin lote obligatorio; flete por valor, con opción por unidades en API.
3: ITBIS incluido, tarjeta manual y banco/referencia obligatorios; server es autoridad de precios y deja en conflicto un total offline distinto.
4: plazo ficticio de devolución de 30 días, configurable; un producto abierto/dañado no retorna a stock vendible.
5: recurrente sólo como identificación, sin crear cargos reales automáticamente.
6: los costos se descuentan de ventas sin ITBIS; las comisiones reducen ganancia neta; informes de detalle limitados a 10,000 facturas.
7: ofertas de liquidación por variante completa; el operador revisa el margen antes de un descuento superior al sugerido.
8: se conserva la venta local en conflictos; stock negativo sólo con configuración explícita; la sincronización exige la misma identidad del vendedor.
9: no se asume dominio, hosting, credenciales fiscales, almacenamiento privado ni dispositivos físicos que no fueron suministrados.

La segunda revisión se documenta en [REVISION_CLAUDE_RONDA2.md](REVISION_CLAUDE_RONDA2.md), con nuevos registros de validación, límites de crédito y protección de notas.

La tercera ronda añade eventos, equipos, Mercancía móvil e importación revisada. Véase [REVISION_CLAUDE_RONDA3.md](REVISION_CLAUDE_RONDA3.md).
