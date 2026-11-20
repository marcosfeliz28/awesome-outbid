# Matriz de diseño y evidencia de reportes — 20-nov-2026

## Cómo leerla

Esta es la entrega C3. No se ejecutó la aplicación ni se generaron archivos: por eso **todas** las filas están `PENDIENTE`. `Captura/evidencia` solo puede reemplazarse por una ruta o enlace reproducible después de probar datos de demostración. `Origen` identifica dónde se corrige una falla: `pantalla` o `servidor`.

El inventario dinámico actual contiene **43** reportes en `REPORTES` aunque comentarios antiguos del código digan “40”. La matriz conserva los 43; no borra `descuadres`, `anulaciones` ni `traspasos`. Cada reporte registrado tiene cuatro filas para hacer visible la brecha CSV actual, ya que el endpoint común solo admite PDF/Excel (`apps/api/src/reports.ts:866-923`).

Convenciones:

- Pantalla exige 8 combinaciones: `390 × 844` y `1280 × 900` × claro/oscuro × ES/EN, además de cargando, vacío, error/Reintentar y datos.
- Excel/PDF/CSV no tienen viewport ni tema; sí requieren ES/EN y artefacto.
- “No expuesto hoy” no significa `FALLA`: queda `PENDIENTE` hasta que el responsable implemente o descarte formalmente la salida.

| ID        | Reporte                     | Programa | Salida   | Origen   | Viewport          | Tema          | Idioma | Captura/evidencia | Estado    | Nota                                    |
| --------- | --------------------------- | -------- | -------- | -------- | ----------------- | ------------- | ------ | ----------------- | --------- | --------------------------------------- |
| R40-001-P | ventas-por-hora             | Tienda   | Pantalla | pantalla | 390×844; 1280×900 | claro; oscuro | ES; EN | PENDIENTE         | PENDIENTE | 8 combinaciones + estados               |
| R40-001-X | ventas-por-hora             | Tienda   | Excel    | servidor | N/A               | N/A           | ES; EN | PENDIENTE         | PENDIENTE | Expuesto; diseño no verificado          |
| R40-001-F | ventas-por-hora             | Tienda   | PDF      | servidor | N/A               | N/A           | ES; EN | PENDIENTE         | PENDIENTE | Expuesto; diseño no verificado          |
| R40-001-C | ventas-por-hora             | Tienda   | CSV      | servidor | N/A               | N/A           | ES; EN | PENDIENTE         | PENDIENTE | No expuesto hoy                         |
| R40-002-P | ventas-por-dia-semana       | Tienda   | Pantalla | pantalla | 390×844; 1280×900 | claro; oscuro | ES; EN | PENDIENTE         | PENDIENTE | 8 combinaciones + estados               |
| R40-002-X | ventas-por-dia-semana       | Tienda   | Excel    | servidor | N/A               | N/A           | ES; EN | PENDIENTE         | PENDIENTE | Expuesto; diseño no verificado          |
| R40-002-F | ventas-por-dia-semana       | Tienda   | PDF      | servidor | N/A               | N/A           | ES; EN | PENDIENTE         | PENDIENTE | Expuesto; diseño no verificado          |
| R40-002-C | ventas-por-dia-semana       | Tienda   | CSV      | servidor | N/A               | N/A           | ES; EN | PENDIENTE         | PENDIENTE | No expuesto hoy                         |
| R40-003-P | ventas-mes-anterior         | Tienda   | Pantalla | pantalla | 390×844; 1280×900 | claro; oscuro | ES; EN | PENDIENTE         | PENDIENTE | 8 combinaciones + estados               |
| R40-003-X | ventas-mes-anterior         | Tienda   | Excel    | servidor | N/A               | N/A           | ES; EN | PENDIENTE         | PENDIENTE | Expuesto; diseño no verificado          |
| R40-003-F | ventas-mes-anterior         | Tienda   | PDF      | servidor | N/A               | N/A           | ES; EN | PENDIENTE         | PENDIENTE | Expuesto; diseño no verificado          |
| R40-003-C | ventas-mes-anterior         | Tienda   | CSV      | servidor | N/A               | N/A           | ES; EN | PENDIENTE         | PENDIENTE | No expuesto hoy                         |
| R40-004-P | ventas-mes-ano-anterior     | Tienda   | Pantalla | pantalla | 390×844; 1280×900 | claro; oscuro | ES; EN | PENDIENTE         | PENDIENTE | 8 combinaciones + estados               |
| R40-004-X | ventas-mes-ano-anterior     | Tienda   | Excel    | servidor | N/A               | N/A           | ES; EN | PENDIENTE         | PENDIENTE | Expuesto; diseño no verificado          |
| R40-004-F | ventas-mes-ano-anterior     | Tienda   | PDF      | servidor | N/A               | N/A           | ES; EN | PENDIENTE         | PENDIENTE | Expuesto; diseño no verificado          |
| R40-004-C | ventas-mes-ano-anterior     | Tienda   | CSV      | servidor | N/A               | N/A           | ES; EN | PENDIENTE         | PENDIENTE | No expuesto hoy                         |
| R40-005-P | ticket-promedio             | Tienda   | Pantalla | pantalla | 390×844; 1280×900 | claro; oscuro | ES; EN | PENDIENTE         | PENDIENTE | 8 combinaciones + estados               |
| R40-005-X | ticket-promedio             | Tienda   | Excel    | servidor | N/A               | N/A           | ES; EN | PENDIENTE         | PENDIENTE | Expuesto; diseño no verificado          |
| R40-005-F | ticket-promedio             | Tienda   | PDF      | servidor | N/A               | N/A           | ES; EN | PENDIENTE         | PENDIENTE | Expuesto; diseño no verificado          |
| R40-005-C | ticket-promedio             | Tienda   | CSV      | servidor | N/A               | N/A           | ES; EN | PENDIENTE         | PENDIENTE | No expuesto hoy                         |
| R40-006-P | unidades-por-factura        | Tienda   | Pantalla | pantalla | 390×844; 1280×900 | claro; oscuro | ES; EN | PENDIENTE         | PENDIENTE | 8 combinaciones + estados               |
| R40-006-X | unidades-por-factura        | Tienda   | Excel    | servidor | N/A               | N/A           | ES; EN | PENDIENTE         | PENDIENTE | Expuesto; diseño no verificado          |
| R40-006-F | unidades-por-factura        | Tienda   | PDF      | servidor | N/A               | N/A           | ES; EN | PENDIENTE         | PENDIENTE | Expuesto; diseño no verificado          |
| R40-006-C | unidades-por-factura        | Tienda   | CSV      | servidor | N/A               | N/A           | ES; EN | PENDIENTE         | PENDIENTE | No expuesto hoy                         |
| R40-007-P | ranking-cajeras             | Tienda   | Pantalla | pantalla | 390×844; 1280×900 | claro; oscuro | ES; EN | PENDIENTE         | PENDIENTE | 8 combinaciones + estados               |
| R40-007-X | ranking-cajeras             | Tienda   | Excel    | servidor | N/A               | N/A           | ES; EN | PENDIENTE         | PENDIENTE | Expuesto; diseño no verificado          |
| R40-007-F | ranking-cajeras             | Tienda   | PDF      | servidor | N/A               | N/A           | ES; EN | PENDIENTE         | PENDIENTE | Expuesto; diseño no verificado          |
| R40-007-C | ranking-cajeras             | Tienda   | CSV      | servidor | N/A               | N/A           | ES; EN | PENDIENTE         | PENDIENTE | No expuesto hoy                         |
| R40-008-P | top-clientes                | Tienda   | Pantalla | pantalla | 390×844; 1280×900 | claro; oscuro | ES; EN | PENDIENTE         | PENDIENTE | 8 combinaciones + estados               |
| R40-008-X | top-clientes                | Tienda   | Excel    | servidor | N/A               | N/A           | ES; EN | PENDIENTE         | PENDIENTE | Expuesto; diseño no verificado          |
| R40-008-F | top-clientes                | Tienda   | PDF      | servidor | N/A               | N/A           | ES; EN | PENDIENTE         | PENDIENTE | Expuesto; diseño no verificado          |
| R40-008-C | top-clientes                | Tienda   | CSV      | servidor | N/A               | N/A           | ES; EN | PENDIENTE         | PENDIENTE | No expuesto hoy                         |
| R40-009-P | ventas-categoria-mes        | Tienda   | Pantalla | pantalla | 390×844; 1280×900 | claro; oscuro | ES; EN | PENDIENTE         | PENDIENTE | 8 combinaciones + estados               |
| R40-009-X | ventas-categoria-mes        | Tienda   | Excel    | servidor | N/A               | N/A           | ES; EN | PENDIENTE         | PENDIENTE | Expuesto; diseño no verificado          |
| R40-009-F | ventas-categoria-mes        | Tienda   | PDF      | servidor | N/A               | N/A           | ES; EN | PENDIENTE         | PENDIENTE | Expuesto; diseño no verificado          |
| R40-009-C | ventas-categoria-mes        | Tienda   | CSV      | servidor | N/A               | N/A           | ES; EN | PENDIENTE         | PENDIENTE | No expuesto hoy                         |
| R40-010-P | ventas-por-marca            | Tienda   | Pantalla | pantalla | 390×844; 1280×900 | claro; oscuro | ES; EN | PENDIENTE         | PENDIENTE | 8 combinaciones + estados               |
| R40-010-X | ventas-por-marca            | Tienda   | Excel    | servidor | N/A               | N/A           | ES; EN | PENDIENTE         | PENDIENTE | Expuesto; diseño no verificado          |
| R40-010-F | ventas-por-marca            | Tienda   | PDF      | servidor | N/A               | N/A           | ES; EN | PENDIENTE         | PENDIENTE | Expuesto; diseño no verificado          |
| R40-010-C | ventas-por-marca            | Tienda   | CSV      | servidor | N/A               | N/A           | ES; EN | PENDIENTE         | PENDIENTE | No expuesto hoy                         |
| R40-011-P | descuadres                  | Tienda   | Pantalla | pantalla | 390×844; 1280×900 | claro; oscuro | ES; EN | PENDIENTE         | PENDIENTE | 8 combinaciones + estados; permiso caja |
| R40-011-X | descuadres                  | Tienda   | Excel    | servidor | N/A               | N/A           | ES; EN | PENDIENTE         | PENDIENTE | Expuesto; diseño no verificado          |
| R40-011-F | descuadres                  | Tienda   | PDF      | servidor | N/A               | N/A           | ES; EN | PENDIENTE         | PENDIENTE | Expuesto; diseño no verificado          |
| R40-011-C | descuadres                  | Tienda   | CSV      | servidor | N/A               | N/A           | ES; EN | PENDIENTE         | PENDIENTE | No expuesto hoy                         |
| R40-012-P | entradas-cuenta             | Tienda   | Pantalla | pantalla | 390×844; 1280×900 | claro; oscuro | ES; EN | PENDIENTE         | PENDIENTE | 8 combinaciones + estados               |
| R40-012-X | entradas-cuenta             | Tienda   | Excel    | servidor | N/A               | N/A           | ES; EN | PENDIENTE         | PENDIENTE | Expuesto; diseño no verificado          |
| R40-012-F | entradas-cuenta             | Tienda   | PDF      | servidor | N/A               | N/A           | ES; EN | PENDIENTE         | PENDIENTE | Expuesto; diseño no verificado          |
| R40-012-C | entradas-cuenta             | Tienda   | CSV      | servidor | N/A               | N/A           | ES; EN | PENDIENTE         | PENDIENTE | No expuesto hoy                         |
| R40-013-P | formas-pago-mes             | Tienda   | Pantalla | pantalla | 390×844; 1280×900 | claro; oscuro | ES; EN | PENDIENTE         | PENDIENTE | 8 combinaciones + estados               |
| R40-013-X | formas-pago-mes             | Tienda   | Excel    | servidor | N/A               | N/A           | ES; EN | PENDIENTE         | PENDIENTE | Expuesto; diseño no verificado          |
| R40-013-F | formas-pago-mes             | Tienda   | PDF      | servidor | N/A               | N/A           | ES; EN | PENDIENTE         | PENDIENTE | Expuesto; diseño no verificado          |
| R40-013-C | formas-pago-mes             | Tienda   | CSV      | servidor | N/A               | N/A           | ES; EN | PENDIENTE         | PENDIENTE | No expuesto hoy                         |
| R40-014-P | formas-pago-categoria       | Tienda   | Pantalla | pantalla | 390×844; 1280×900 | claro; oscuro | ES; EN | PENDIENTE         | PENDIENTE | 8 combinaciones + estados               |
| R40-014-X | formas-pago-categoria       | Tienda   | Excel    | servidor | N/A               | N/A           | ES; EN | PENDIENTE         | PENDIENTE | Expuesto; diseño no verificado          |
| R40-014-F | formas-pago-categoria       | Tienda   | PDF      | servidor | N/A               | N/A           | ES; EN | PENDIENTE         | PENDIENTE | Expuesto; diseño no verificado          |
| R40-014-C | formas-pago-categoria       | Tienda   | CSV      | servidor | N/A               | N/A           | ES; EN | PENDIENTE         | PENDIENTE | No expuesto hoy                         |
| R40-015-P | descuentos-cajera           | Tienda   | Pantalla | pantalla | 390×844; 1280×900 | claro; oscuro | ES; EN | PENDIENTE         | PENDIENTE | 8 combinaciones + estados               |
| R40-015-X | descuentos-cajera           | Tienda   | Excel    | servidor | N/A               | N/A           | ES; EN | PENDIENTE         | PENDIENTE | Expuesto; diseño no verificado          |
| R40-015-F | descuentos-cajera           | Tienda   | PDF      | servidor | N/A               | N/A           | ES; EN | PENDIENTE         | PENDIENTE | Expuesto; diseño no verificado          |
| R40-015-C | descuentos-cajera           | Tienda   | CSV      | servidor | N/A               | N/A           | ES; EN | PENDIENTE         | PENDIENTE | No expuesto hoy                         |
| R40-016-P | por-mayor-detalle           | Tienda   | Pantalla | pantalla | 390×844; 1280×900 | claro; oscuro | ES; EN | PENDIENTE         | PENDIENTE | 8 combinaciones + estados               |
| R40-016-X | por-mayor-detalle           | Tienda   | Excel    | servidor | N/A               | N/A           | ES; EN | PENDIENTE         | PENDIENTE | Expuesto; diseño no verificado          |
| R40-016-F | por-mayor-detalle           | Tienda   | PDF      | servidor | N/A               | N/A           | ES; EN | PENDIENTE         | PENDIENTE | Expuesto; diseño no verificado          |
| R40-016-C | por-mayor-detalle           | Tienda   | CSV      | servidor | N/A               | N/A           | ES; EN | PENDIENTE         | PENDIENTE | No expuesto hoy                         |
| R40-017-P | envios-mensajero            | Tienda   | Pantalla | pantalla | 390×844; 1280×900 | claro; oscuro | ES; EN | PENDIENTE         | PENDIENTE | 8 combinaciones + estados               |
| R40-017-X | envios-mensajero            | Tienda   | Excel    | servidor | N/A               | N/A           | ES; EN | PENDIENTE         | PENDIENTE | Expuesto; diseño no verificado          |
| R40-017-F | envios-mensajero            | Tienda   | PDF      | servidor | N/A               | N/A           | ES; EN | PENDIENTE         | PENDIENTE | Expuesto; diseño no verificado          |
| R40-017-C | envios-mensajero            | Tienda   | CSV      | servidor | N/A               | N/A           | ES; EN | PENDIENTE         | PENDIENTE | No expuesto hoy                         |
| R40-018-P | diferencias-cuadre          | Tienda   | Pantalla | pantalla | 390×844; 1280×900 | claro; oscuro | ES; EN | PENDIENTE         | PENDIENTE | 8 combinaciones + estados; permiso caja |
| R40-018-X | diferencias-cuadre          | Tienda   | Excel    | servidor | N/A               | N/A           | ES; EN | PENDIENTE         | PENDIENTE | Expuesto; diseño no verificado          |
| R40-018-F | diferencias-cuadre          | Tienda   | PDF      | servidor | N/A               | N/A           | ES; EN | PENDIENTE         | PENDIENTE | Expuesto; diseño no verificado          |
| R40-018-C | diferencias-cuadre          | Tienda   | CSV      | servidor | N/A               | N/A           | ES; EN | PENDIENTE         | PENDIENTE | No expuesto hoy                         |
| R40-019-P | anulaciones                 | Tienda   | Pantalla | pantalla | 390×844; 1280×900 | claro; oscuro | ES; EN | PENDIENTE         | PENDIENTE | 8 combinaciones + estados               |
| R40-019-X | anulaciones                 | Tienda   | Excel    | servidor | N/A               | N/A           | ES; EN | PENDIENTE         | PENDIENTE | Expuesto; diseño no verificado          |
| R40-019-F | anulaciones                 | Tienda   | PDF      | servidor | N/A               | N/A           | ES; EN | PENDIENTE         | PENDIENTE | Expuesto; diseño no verificado          |
| R40-019-C | anulaciones                 | Tienda   | CSV      | servidor | N/A               | N/A           | ES; EN | PENDIENTE         | PENDIENTE | No expuesto hoy                         |
| R40-020-P | devoluciones-producto       | Tienda   | Pantalla | pantalla | 390×844; 1280×900 | claro; oscuro | ES; EN | PENDIENTE         | PENDIENTE | 8 combinaciones + estados               |
| R40-020-X | devoluciones-producto       | Tienda   | Excel    | servidor | N/A               | N/A           | ES; EN | PENDIENTE         | PENDIENTE | Expuesto; diseño no verificado          |
| R40-020-F | devoluciones-producto       | Tienda   | PDF      | servidor | N/A               | N/A           | ES; EN | PENDIENTE         | PENDIENTE | Expuesto; diseño no verificado          |
| R40-020-C | devoluciones-producto       | Tienda   | CSV      | servidor | N/A               | N/A           | ES; EN | PENDIENTE         | PENDIENTE | No expuesto hoy                         |
| R40-021-P | margen-por-producto         | Tienda   | Pantalla | pantalla | 390×844; 1280×900 | claro; oscuro | ES; EN | PENDIENTE         | PENDIENTE | Requiere permiso de margen              |
| R40-021-X | margen-por-producto         | Tienda   | Excel    | servidor | N/A               | N/A           | ES; EN | PENDIENTE         | PENDIENTE | Expuesto; permiso de margen             |
| R40-021-F | margen-por-producto         | Tienda   | PDF      | servidor | N/A               | N/A           | ES; EN | PENDIENTE         | PENDIENTE | Expuesto; permiso de margen             |
| R40-021-C | margen-por-producto         | Tienda   | CSV      | servidor | N/A               | N/A           | ES; EN | PENDIENTE         | PENDIENTE | No expuesto hoy                         |
| R40-022-P | margen-por-categoria        | Tienda   | Pantalla | pantalla | 390×844; 1280×900 | claro; oscuro | ES; EN | PENDIENTE         | PENDIENTE | Requiere permiso de margen              |
| R40-022-X | margen-por-categoria        | Tienda   | Excel    | servidor | N/A               | N/A           | ES; EN | PENDIENTE         | PENDIENTE | Expuesto; permiso de margen             |
| R40-022-F | margen-por-categoria        | Tienda   | PDF      | servidor | N/A               | N/A           | ES; EN | PENDIENTE         | PENDIENTE | Expuesto; permiso de margen             |
| R40-022-C | margen-por-categoria        | Tienda   | CSV      | servidor | N/A               | N/A           | ES; EN | PENDIENTE         | PENDIENTE | No expuesto hoy                         |
| R40-023-P | margen-por-empresa          | Tienda   | Pantalla | pantalla | 390×844; 1280×900 | claro; oscuro | ES; EN | PENDIENTE         | PENDIENTE | Requiere permiso de margen              |
| R40-023-X | margen-por-empresa          | Tienda   | Excel    | servidor | N/A               | N/A           | ES; EN | PENDIENTE         | PENDIENTE | Expuesto; permiso de margen             |
| R40-023-F | margen-por-empresa          | Tienda   | PDF      | servidor | N/A               | N/A           | ES; EN | PENDIENTE         | PENDIENTE | Expuesto; permiso de margen             |
| R40-023-C | margen-por-empresa          | Tienda   | CSV      | servidor | N/A               | N/A           | ES; EN | PENDIENTE         | PENDIENTE | No expuesto hoy                         |
| R40-024-P | margen-por-marca            | Tienda   | Pantalla | pantalla | 390×844; 1280×900 | claro; oscuro | ES; EN | PENDIENTE         | PENDIENTE | Requiere permiso de margen              |
| R40-024-X | margen-por-marca            | Tienda   | Excel    | servidor | N/A               | N/A           | ES; EN | PENDIENTE         | PENDIENTE | Expuesto; permiso de margen             |
| R40-024-F | margen-por-marca            | Tienda   | PDF      | servidor | N/A               | N/A           | ES; EN | PENDIENTE         | PENDIENTE | Expuesto; permiso de margen             |
| R40-024-C | margen-por-marca            | Tienda   | CSV      | servidor | N/A               | N/A           | ES; EN | PENDIENTE         | PENDIENTE | No expuesto hoy                         |
| R40-025-P | margen-por-cajera           | Tienda   | Pantalla | pantalla | 390×844; 1280×900 | claro; oscuro | ES; EN | PENDIENTE         | PENDIENTE | Requiere permiso de margen              |
| R40-025-X | margen-por-cajera           | Tienda   | Excel    | servidor | N/A               | N/A           | ES; EN | PENDIENTE         | PENDIENTE | Expuesto; permiso de margen             |
| R40-025-F | margen-por-cajera           | Tienda   | PDF      | servidor | N/A               | N/A           | ES; EN | PENDIENTE         | PENDIENTE | Expuesto; permiso de margen             |
| R40-025-C | margen-por-cajera           | Tienda   | CSV      | servidor | N/A               | N/A           | ES; EN | PENDIENTE         | PENDIENTE | No expuesto hoy                         |
| R40-026-P | ventas-margen-bajo          | Tienda   | Pantalla | pantalla | 390×844; 1280×900 | claro; oscuro | ES; EN | PENDIENTE         | PENDIENTE | Requiere permiso de margen              |
| R40-026-X | ventas-margen-bajo          | Tienda   | Excel    | servidor | N/A               | N/A           | ES; EN | PENDIENTE         | PENDIENTE | Expuesto; permiso de margen             |
| R40-026-F | ventas-margen-bajo          | Tienda   | PDF      | servidor | N/A               | N/A           | ES; EN | PENDIENTE         | PENDIENTE | Expuesto; permiso de margen             |
| R40-026-C | ventas-margen-bajo          | Tienda   | CSV      | servidor | N/A               | N/A           | ES; EN | PENDIENTE         | PENDIENTE | No expuesto hoy                         |
| R40-027-P | utilidad-bruta-por-mes      | Tienda   | Pantalla | pantalla | 390×844; 1280×900 | claro; oscuro | ES; EN | PENDIENTE         | PENDIENTE | Requiere permiso de margen              |
| R40-027-X | utilidad-bruta-por-mes      | Tienda   | Excel    | servidor | N/A               | N/A           | ES; EN | PENDIENTE         | PENDIENTE | Expuesto; permiso de margen             |
| R40-027-F | utilidad-bruta-por-mes      | Tienda   | PDF      | servidor | N/A               | N/A           | ES; EN | PENDIENTE         | PENDIENTE | Expuesto; permiso de margen             |
| R40-027-C | utilidad-bruta-por-mes      | Tienda   | CSV      | servidor | N/A               | N/A           | ES; EN | PENDIENTE         | PENDIENTE | No expuesto hoy                         |
| R40-028-P | costo-vendido-vs-inventario | Tienda   | Pantalla | pantalla | 390×844; 1280×900 | claro; oscuro | ES; EN | PENDIENTE         | PENDIENTE | Requiere permiso de margen              |
| R40-028-X | costo-vendido-vs-inventario | Tienda   | Excel    | servidor | N/A               | N/A           | ES; EN | PENDIENTE         | PENDIENTE | Expuesto; permiso de margen             |
| R40-028-F | costo-vendido-vs-inventario | Tienda   | PDF      | servidor | N/A               | N/A           | ES; EN | PENDIENTE         | PENDIENTE | Expuesto; permiso de margen             |
| R40-028-C | costo-vendido-vs-inventario | Tienda   | CSV      | servidor | N/A               | N/A           | ES; EN | PENDIENTE         | PENDIENTE | No expuesto hoy                         |
| R40-029-P | precio-vendido-vs-lista     | Tienda   | Pantalla | pantalla | 390×844; 1280×900 | claro; oscuro | ES; EN | PENDIENTE         | PENDIENTE | Requiere permiso de margen              |
| R40-029-X | precio-vendido-vs-lista     | Tienda   | Excel    | servidor | N/A               | N/A           | ES; EN | PENDIENTE         | PENDIENTE | Expuesto; permiso de margen             |
| R40-029-F | precio-vendido-vs-lista     | Tienda   | PDF      | servidor | N/A               | N/A           | ES; EN | PENDIENTE         | PENDIENTE | Expuesto; permiso de margen             |
| R40-029-C | precio-vendido-vs-lista     | Tienda   | CSV      | servidor | N/A               | N/A           | ES; EN | PENDIENTE         | PENDIENTE | No expuesto hoy                         |
| R40-030-P | rotacion-producto           | Tienda   | Pantalla | pantalla | 390×844; 1280×900 | claro; oscuro | ES; EN | PENDIENTE         | PENDIENTE | 8 combinaciones + estados               |
| R40-030-X | rotacion-producto           | Tienda   | Excel    | servidor | N/A               | N/A           | ES; EN | PENDIENTE         | PENDIENTE | Expuesto; diseño no verificado          |
| R40-030-F | rotacion-producto           | Tienda   | PDF      | servidor | N/A               | N/A           | ES; EN | PENDIENTE         | PENDIENTE | Expuesto; diseño no verificado          |
| R40-030-C | rotacion-producto           | Tienda   | CSV      | servidor | N/A               | N/A           | ES; EN | PENDIENTE         | PENDIENTE | No expuesto hoy                         |
| R40-031-P | dias-inventario             | Tienda   | Pantalla | pantalla | 390×844; 1280×900 | claro; oscuro | ES; EN | PENDIENTE         | PENDIENTE | 8 combinaciones + estados               |
| R40-031-X | dias-inventario             | Tienda   | Excel    | servidor | N/A               | N/A           | ES; EN | PENDIENTE         | PENDIENTE | Expuesto; diseño no verificado          |
| R40-031-F | dias-inventario             | Tienda   | PDF      | servidor | N/A               | N/A           | ES; EN | PENDIENTE         | PENDIENTE | Expuesto; diseño no verificado          |
| R40-031-C | dias-inventario             | Tienda   | CSV      | servidor | N/A               | N/A           | ES; EN | PENDIENTE         | PENDIENTE | No expuesto hoy                         |
| R40-032-P | sin-movimiento              | Tienda   | Pantalla | pantalla | 390×844; 1280×900 | claro; oscuro | ES; EN | PENDIENTE         | PENDIENTE | 8 combinaciones + estados               |
| R40-032-X | sin-movimiento              | Tienda   | Excel    | servidor | N/A               | N/A           | ES; EN | PENDIENTE         | PENDIENTE | Expuesto; diseño no verificado          |
| R40-032-F | sin-movimiento              | Tienda   | PDF      | servidor | N/A               | N/A           | ES; EN | PENDIENTE         | PENDIENTE | Expuesto; diseño no verificado          |
| R40-032-C | sin-movimiento              | Tienda   | CSV      | servidor | N/A               | N/A           | ES; EN | PENDIENTE         | PENDIENTE | No expuesto hoy                         |
| R40-033-P | bajo-minimo                 | Tienda   | Pantalla | pantalla | 390×844; 1280×900 | claro; oscuro | ES; EN | PENDIENTE         | PENDIENTE | 8 combinaciones + estados               |
| R40-033-X | bajo-minimo                 | Tienda   | Excel    | servidor | N/A               | N/A           | ES; EN | PENDIENTE         | PENDIENTE | Expuesto; diseño no verificado          |
| R40-033-F | bajo-minimo                 | Tienda   | PDF      | servidor | N/A               | N/A           | ES; EN | PENDIENTE         | PENDIENTE | Expuesto; diseño no verificado          |
| R40-033-C | bajo-minimo                 | Tienda   | CSV      | servidor | N/A               | N/A           | ES; EN | PENDIENTE         | PENDIENTE | No expuesto hoy                         |
| R40-034-P | valor-inventario-almacen    | Tienda   | Pantalla | pantalla | 390×844; 1280×900 | claro; oscuro | ES; EN | PENDIENTE         | PENDIENTE | Requiere permiso de margen              |
| R40-034-X | valor-inventario-almacen    | Tienda   | Excel    | servidor | N/A               | N/A           | ES; EN | PENDIENTE         | PENDIENTE | Expuesto; permiso de margen             |
| R40-034-F | valor-inventario-almacen    | Tienda   | PDF      | servidor | N/A               | N/A           | ES; EN | PENDIENTE         | PENDIENTE | Expuesto; permiso de margen             |
| R40-034-C | valor-inventario-almacen    | Tienda   | CSV      | servidor | N/A               | N/A           | ES; EN | PENDIENTE         | PENDIENTE | No expuesto hoy                         |
| R40-035-P | perdidas-conteo             | Tienda   | Pantalla | pantalla | 390×844; 1280×900 | claro; oscuro | ES; EN | PENDIENTE         | PENDIENTE | Requiere permiso de margen              |
| R40-035-X | perdidas-conteo             | Tienda   | Excel    | servidor | N/A               | N/A           | ES; EN | PENDIENTE         | PENDIENTE | Expuesto; permiso de margen             |
| R40-035-F | perdidas-conteo             | Tienda   | PDF      | servidor | N/A               | N/A           | ES; EN | PENDIENTE         | PENDIENTE | Expuesto; permiso de margen             |
| R40-035-C | perdidas-conteo             | Tienda   | CSV      | servidor | N/A               | N/A           | ES; EN | PENDIENTE         | PENDIENTE | No expuesto hoy                         |
| R40-036-P | traspasos                   | Tienda   | Pantalla | pantalla | 390×844; 1280×900 | claro; oscuro | ES; EN | PENDIENTE         | PENDIENTE | 8 combinaciones + estados               |
| R40-036-X | traspasos                   | Tienda   | Excel    | servidor | N/A               | N/A           | ES; EN | PENDIENTE         | PENDIENTE | Expuesto; diseño no verificado          |
| R40-036-F | traspasos                   | Tienda   | PDF      | servidor | N/A               | N/A           | ES; EN | PENDIENTE         | PENDIENTE | Expuesto; diseño no verificado          |
| R40-036-C | traspasos                   | Tienda   | CSV      | servidor | N/A               | N/A           | ES; EN | PENDIENTE         | PENDIENTE | No expuesto hoy                         |
| R40-037-P | agotados-con-ventas         | Tienda   | Pantalla | pantalla | 390×844; 1280×900 | claro; oscuro | ES; EN | PENDIENTE         | PENDIENTE | 8 combinaciones + estados               |
| R40-037-X | agotados-con-ventas         | Tienda   | Excel    | servidor | N/A               | N/A           | ES; EN | PENDIENTE         | PENDIENTE | Expuesto; diseño no verificado          |
| R40-037-F | agotados-con-ventas         | Tienda   | PDF      | servidor | N/A               | N/A           | ES; EN | PENDIENTE         | PENDIENTE | Expuesto; diseño no verificado          |
| R40-037-C | agotados-con-ventas         | Tienda   | CSV      | servidor | N/A               | N/A           | ES; EN | PENDIENTE         | PENDIENTE | No expuesto hoy                         |
| R40-038-P | creditos-por-antiguedad     | Tienda   | Pantalla | pantalla | 390×844; 1280×900 | claro; oscuro | ES; EN | PENDIENTE         | PENDIENTE | 8 combinaciones + estados               |
| R40-038-X | creditos-por-antiguedad     | Tienda   | Excel    | servidor | N/A               | N/A           | ES; EN | PENDIENTE         | PENDIENTE | Expuesto; diseño no verificado          |
| R40-038-F | creditos-por-antiguedad     | Tienda   | PDF      | servidor | N/A               | N/A           | ES; EN | PENDIENTE         | PENDIENTE | Expuesto; diseño no verificado          |
| R40-038-C | creditos-por-antiguedad     | Tienda   | CSV      | servidor | N/A               | N/A           | ES; EN | PENDIENTE         | PENDIENTE | No expuesto hoy                         |
| R40-039-P | clientes-con-mas-deuda      | Tienda   | Pantalla | pantalla | 390×844; 1280×900 | claro; oscuro | ES; EN | PENDIENTE         | PENDIENTE | 8 combinaciones + estados               |
| R40-039-X | clientes-con-mas-deuda      | Tienda   | Excel    | servidor | N/A               | N/A           | ES; EN | PENDIENTE         | PENDIENTE | Expuesto; diseño no verificado          |
| R40-039-F | clientes-con-mas-deuda      | Tienda   | PDF      | servidor | N/A               | N/A           | ES; EN | PENDIENTE         | PENDIENTE | Expuesto; diseño no verificado          |
| R40-039-C | clientes-con-mas-deuda      | Tienda   | CSV      | servidor | N/A               | N/A           | ES; EN | PENDIENTE         | PENDIENTE | No expuesto hoy                         |
| R40-040-P | clientes-nuevos-por-mes     | Tienda   | Pantalla | pantalla | 390×844; 1280×900 | claro; oscuro | ES; EN | PENDIENTE         | PENDIENTE | 8 combinaciones + estados               |
| R40-040-X | clientes-nuevos-por-mes     | Tienda   | Excel    | servidor | N/A               | N/A           | ES; EN | PENDIENTE         | PENDIENTE | Expuesto; diseño no verificado          |
| R40-040-F | clientes-nuevos-por-mes     | Tienda   | PDF      | servidor | N/A               | N/A           | ES; EN | PENDIENTE         | PENDIENTE | Expuesto; diseño no verificado          |
| R40-040-C | clientes-nuevos-por-mes     | Tienda   | CSV      | servidor | N/A               | N/A           | ES; EN | PENDIENTE         | PENDIENTE | No expuesto hoy                         |
| R40-041-P | frecuencia-de-compra        | Tienda   | Pantalla | pantalla | 390×844; 1280×900 | claro; oscuro | ES; EN | PENDIENTE         | PENDIENTE | 8 combinaciones + estados               |
| R40-041-X | frecuencia-de-compra        | Tienda   | Excel    | servidor | N/A               | N/A           | ES; EN | PENDIENTE         | PENDIENTE | Expuesto; diseño no verificado          |
| R40-041-F | frecuencia-de-compra        | Tienda   | PDF      | servidor | N/A               | N/A           | ES; EN | PENDIENTE         | PENDIENTE | Expuesto; diseño no verificado          |
| R40-041-C | frecuencia-de-compra        | Tienda   | CSV      | servidor | N/A               | N/A           | ES; EN | PENDIENTE         | PENDIENTE | No expuesto hoy                         |
| R40-042-P | clientes-inactivos          | Tienda   | Pantalla | pantalla | 390×844; 1280×900 | claro; oscuro | ES; EN | PENDIENTE         | PENDIENTE | 8 combinaciones + estados               |
| R40-042-X | clientes-inactivos          | Tienda   | Excel    | servidor | N/A               | N/A           | ES; EN | PENDIENTE         | PENDIENTE | Expuesto; diseño no verificado          |
| R40-042-F | clientes-inactivos          | Tienda   | PDF      | servidor | N/A               | N/A           | ES; EN | PENDIENTE         | PENDIENTE | Expuesto; diseño no verificado          |
| R40-042-C | clientes-inactivos          | Tienda   | CSV      | servidor | N/A               | N/A           | ES; EN | PENDIENTE         | PENDIENTE | No expuesto hoy                         |
| R40-043-P | cobros-por-mes              | Tienda   | Pantalla | pantalla | 390×844; 1280×900 | claro; oscuro | ES; EN | PENDIENTE         | PENDIENTE | 8 combinaciones + estados               |
| R40-043-X | cobros-por-mes              | Tienda   | Excel    | servidor | N/A               | N/A           | ES; EN | PENDIENTE         | PENDIENTE | Expuesto; diseño no verificado          |
| R40-043-F | cobros-por-mes              | Tienda   | PDF      | servidor | N/A               | N/A           | ES; EN | PENDIENTE         | PENDIENTE | Expuesto; diseño no verificado          |
| R40-043-C | cobros-por-mes              | Tienda   | CSV      | servidor | N/A               | N/A           | ES; EN | PENDIENTE         | PENDIENTE | No expuesto hoy                         |

## Pantallas e informes especiales exigidos por la orden

Estas filas no duplican la validación del registro: cubren composiciones especiales, pantallas agregadas o generadores distintos. “Producto en línea” permanece pendiente de inventario técnico porque su fuente no forma parte de este worktree; no se presume paridad.

| ID        | Reporte                               | Programa          | Salida   | Origen   | Viewport          | Tema          | Idioma | Captura/evidencia | Estado    | Nota                                                  |
| --------- | ------------------------------------- | ----------------- | -------- | -------- | ----------------- | ------------- | ------ | ----------------- | --------- | ----------------------------------------------------- |
| ESP-001-P | resumen                               | Tienda            | Pantalla | pantalla | 390×844; 1280×900 | claro; oscuro | ES; EN | PENDIENTE         | PENDIENTE | Dashboard; 8 combinaciones + estados                  |
| ESP-001-X | resumen                               | Tienda            | Excel    | servidor | N/A               | N/A           | ES; EN | PENDIENTE         | PENDIENTE | Disponibilidad por confirmar                          |
| ESP-001-F | resumen                               | Tienda            | PDF      | servidor | N/A               | N/A           | ES; EN | PENDIENTE         | PENDIENTE | Disponibilidad por confirmar                          |
| ESP-001-C | resumen                               | Tienda            | CSV      | servidor | N/A               | N/A           | ES; EN | PENDIENTE         | PENDIENTE | Disponibilidad por confirmar                          |
| ESP-002-P | ingresos-por-dia                      | Tienda            | Pantalla | pantalla | 390×844; 1280×900 | claro; oscuro | ES; EN | PENDIENTE         | PENDIENTE | Incluye alcance y conciliación                        |
| ESP-002-X | ingresos-por-dia                      | Tienda            | Excel    | servidor | N/A               | N/A           | ES; EN | PENDIENTE         | PENDIENTE | Expuesto; no verificado                               |
| ESP-002-F | ingresos-por-dia                      | Tienda            | PDF      | servidor | N/A               | N/A           | ES; EN | PENDIENTE         | PENDIENTE | Expuesto; no verificado                               |
| ESP-002-C | ingresos-por-dia                      | Tienda            | CSV      | servidor | N/A               | N/A           | ES; EN | PENDIENTE         | PENDIENTE | Expuesto; no verificado                               |
| ESP-003-P | informe-mensual                       | Tienda            | Pantalla | pantalla | 390×844; 1280×900 | claro; oscuro | ES; EN | PENDIENTE         | PENDIENTE | Desglose mensual especial                             |
| ESP-003-X | informe-mensual                       | Tienda            | Excel    | servidor | N/A               | N/A           | ES; EN | PENDIENTE         | PENDIENTE | No expuesto hoy                                       |
| ESP-003-F | informe-mensual                       | Tienda            | PDF      | servidor | N/A               | N/A           | ES; EN | PENDIENTE         | PENDIENTE | No expuesto hoy                                       |
| ESP-003-C | informe-mensual                       | Tienda            | CSV      | pantalla | N/A               | N/A           | ES; EN | PENDIENTE         | PENDIENTE | Generado en navegador; no verificado                  |
| ESP-004-P | informe-formal                        | Tienda            | Pantalla | pantalla | 390×844; 1280×900 | claro; oscuro | ES; EN | PENDIENTE         | PENDIENTE | Vista previa formal                                   |
| ESP-004-X | informe-formal                        | Tienda            | Excel    | servidor | N/A               | N/A           | ES; EN | PENDIENTE         | PENDIENTE | No expuesto hoy                                       |
| ESP-004-F | informe-formal                        | Tienda            | PDF      | servidor | N/A               | N/A           | ES; EN | PENDIENTE         | PENDIENTE | Expuesto; no verificado                               |
| ESP-004-C | informe-formal                        | Tienda            | CSV      | servidor | N/A               | N/A           | ES; EN | PENDIENTE         | PENDIENTE | No expuesto hoy                                       |
| ESP-005-P | estado-de-resultados                  | Tienda            | Pantalla | pantalla | 390×844; 1280×900 | claro; oscuro | ES; EN | PENDIENTE         | PENDIENTE | Requiere permiso de margen                            |
| ESP-005-X | estado-de-resultados                  | Tienda            | Excel    | servidor | N/A               | N/A           | ES; EN | PENDIENTE         | PENDIENTE | Heredado; no verificado                               |
| ESP-005-F | estado-de-resultados                  | Tienda            | PDF      | servidor | N/A               | N/A           | ES; EN | PENDIENTE         | PENDIENTE | Heredado; no verificado                               |
| ESP-005-C | estado-de-resultados                  | Tienda            | CSV      | servidor | N/A               | N/A           | ES; EN | PENDIENTE         | PENDIENTE | No expuesto hoy                                       |
| ESP-006-P | cierre-caja                           | Tienda            | Pantalla | pantalla | 390×844; 1280×900 | claro; oscuro | ES; EN | PENDIENTE         | PENDIENTE | Mismo permiso; esperado/banco protegido               |
| ESP-006-X | cierre-caja                           | Tienda            | Excel    | servidor | N/A               | N/A           | ES; EN | PENDIENTE         | PENDIENTE | Disponibilidad por confirmar                          |
| ESP-006-F | cierre-caja                           | Tienda            | PDF      | servidor | N/A               | N/A           | ES; EN | PENDIENTE         | PENDIENTE | Impresión/PDF por confirmar                           |
| ESP-006-C | cierre-caja                           | Tienda            | CSV      | servidor | N/A               | N/A           | ES; EN | PENDIENTE         | PENDIENTE | Disponibilidad por confirmar                          |
| ESP-007-P | cobros                                | Tienda            | Pantalla | pantalla | 390×844; 1280×900 | claro; oscuro | ES; EN | PENDIENTE         | PENDIENTE | Pantalla agregada; no sustituye cobros-por-mes        |
| ESP-007-X | cobros                                | Tienda            | Excel    | servidor | N/A               | N/A           | ES; EN | PENDIENTE         | PENDIENTE | Disponibilidad por confirmar                          |
| ESP-007-F | cobros                                | Tienda            | PDF      | servidor | N/A               | N/A           | ES; EN | PENDIENTE         | PENDIENTE | Disponibilidad por confirmar                          |
| ESP-007-C | cobros                                | Tienda            | CSV      | servidor | N/A               | N/A           | ES; EN | PENDIENTE         | PENDIENTE | Disponibilidad por confirmar                          |
| ESP-008-P | creditos                              | Tienda            | Pantalla | pantalla | 390×844; 1280×900 | claro; oscuro | ES; EN | PENDIENTE         | PENDIENTE | Pantalla agregada; no sustituye antigüedad            |
| ESP-008-X | creditos                              | Tienda            | Excel    | servidor | N/A               | N/A           | ES; EN | PENDIENTE         | PENDIENTE | Disponibilidad por confirmar                          |
| ESP-008-F | creditos                              | Tienda            | PDF      | servidor | N/A               | N/A           | ES; EN | PENDIENTE         | PENDIENTE | Disponibilidad por confirmar                          |
| ESP-008-C | creditos                              | Tienda            | CSV      | servidor | N/A               | N/A           | ES; EN | PENDIENTE         | PENDIENTE | Disponibilidad por confirmar                          |
| ESP-009-P | kardex                                | Tienda            | Pantalla | pantalla | 390×844; 1280×900 | claro; oscuro | ES; EN | PENDIENTE         | PENDIENTE | Listado heredado paginado                             |
| ESP-009-X | kardex                                | Tienda            | Excel    | servidor | N/A               | N/A           | ES; EN | PENDIENTE         | PENDIENTE | Heredado; no verificado                               |
| ESP-009-F | kardex                                | Tienda            | PDF      | servidor | N/A               | N/A           | ES; EN | PENDIENTE         | PENDIENTE | Heredado; no verificado                               |
| ESP-009-C | kardex                                | Tienda            | CSV      | servidor | N/A               | N/A           | ES; EN | PENDIENTE         | PENDIENTE | No expuesto hoy                                       |
| ESP-010-P | inventario-valorizado                 | Tienda            | Pantalla | pantalla | 390×844; 1280×900 | claro; oscuro | ES; EN | PENDIENTE         | PENDIENTE | Requiere permiso de margen                            |
| ESP-010-X | inventario-valorizado                 | Tienda            | Excel    | servidor | N/A               | N/A           | ES; EN | PENDIENTE         | PENDIENTE | Heredado; no verificado                               |
| ESP-010-F | inventario-valorizado                 | Tienda            | PDF      | servidor | N/A               | N/A           | ES; EN | PENDIENTE         | PENDIENTE | Heredado; no verificado                               |
| ESP-010-C | inventario-valorizado                 | Tienda            | CSV      | servidor | N/A               | N/A           | ES; EN | PENDIENTE         | PENDIENTE | No expuesto hoy                                       |
| ESP-011-P | gv                                    | Tienda            | Pantalla | pantalla | 390×844; 1280×900 | claro; oscuro | ES; EN | PENDIENTE         | PENDIENTE | Empresa separada; validar que no suma Macgen          |
| ESP-011-X | gv                                    | Tienda            | Excel    | servidor | N/A               | N/A           | ES; EN | PENDIENTE         | PENDIENTE | Generador propio; no verificado                       |
| ESP-011-F | gv                                    | Tienda            | PDF      | servidor | N/A               | N/A           | ES; EN | PENDIENTE         | PENDIENTE | Generador propio; no verificado                       |
| ESP-011-C | gv                                    | Tienda            | CSV      | servidor | N/A               | N/A           | ES; EN | PENDIENTE         | PENDIENTE | Disponibilidad por confirmar                          |
| ESP-012-P | inventario-reportes-producto-en-linea | Producto en línea | Pantalla | pantalla | 390×844; 1280×900 | claro; oscuro | ES; EN | PENDIENTE         | PENDIENTE | Falta inventario técnico de reportes en este worktree |
| ESP-012-X | inventario-reportes-producto-en-linea | Producto en línea | Excel    | servidor | N/A               | N/A           | ES; EN | PENDIENTE         | PENDIENTE | Fuente no disponible aquí                             |
| ESP-012-F | inventario-reportes-producto-en-linea | Producto en línea | PDF      | servidor | N/A               | N/A           | ES; EN | PENDIENTE         | PENDIENTE | Fuente no disponible aquí                             |
| ESP-012-C | inventario-reportes-producto-en-linea | Producto en línea | CSV      | servidor | N/A               | N/A           | ES; EN | PENDIENTE         | PENDIENTE | Fuente no disponible aquí                             |

## Evidencia mínima para cambiar un estado

| Salida   | Evidencia obligatoria                                                                                           |
| -------- | --------------------------------------------------------------------------------------------------------------- |
| Pantalla | ocho capturas nombradas `{reporte}-{390x844                                                                     | 1280x900}-{light | dark}-{es | en}.png`, captura de error con Reintentar, URL/hash y datos de demostración |
| Excel    | `.xlsx`, SHA-256, captura al 100 %, versión del visor, filas/columnas esperadas y prueba de filtros/congelación |
| PDF      | `.pdf`, SHA-256, capturas de primera y última página, conteo de páginas, orientación y glifos verificados       |
| CSV      | `.csv`, SHA-256, codificación/separador/saltos de línea, cabecera ES/EN y comparación de filas con pantalla     |

## Resumen actual

- Filas del registro dinámico: `43 × 4 = 172`, todas `PENDIENTE`.
- Filas especiales: `12 × 4 = 48`, todas `PENDIENTE`.
- `OK`: 0.
- `FALLA`: 0.
- No se inventaron capturas ni resultados de servidor.
