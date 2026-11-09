# Recorrido de pantallas y modo sin conexión — 9 de noviembre

Base validada: `b249c6e481326bb3abf4e6af93f1836fd16ec065`.

Todas las pruebas de este documento usaron API, navegador y PostgreSQL
temporales iniciados exclusivamente para esta corrida. Al cerrar la validación
se detuvieron esos procesos. No se consultó ni modificó la tienda.

## Capturas

Las capturas se generaron en esta corrida:

| Vista | Archivo |
| --- | --- |
| Caja, 1366 × 768 | [caja-1366.png](9nov-capturas/caja-1366.png) |
| Caja, 390 × 844 | [caja-390.png](9nov-capturas/caja-390.png) |
| Resumen, 1366 × 768 | [resumen-1366.png](9nov-capturas/resumen-1366.png) |
| Punto de venta, 1366 × 768 | [pos-1366.png](9nov-capturas/pos-1366.png) |
| Caja, 1366 × 768 | [caja-1366.png](9nov-capturas/caja-1366.png) |
| Productos, 1366 × 768 | [productos-1366.png](9nov-capturas/productos-1366.png) |
| Inventario, 1366 × 768 | [inventario-1366.png](9nov-capturas/inventario-1366.png) |
| Resumen, 390 × 844 | [resumen-390.png](9nov-capturas/resumen-390.png) |
| Punto de venta, 390 × 844 | [pos-390.png](9nov-capturas/pos-390.png) |

## Resultados funcionales

| Área | Resultado | Evidencia |
| --- | --- | --- |
| Dueña: pantallas de gestión, tema y móvil | Pasa | `tests/e2e/store.spec.ts` — «pantallas de gestión, tema oscuro y versión móvil». |
| Cajera: caja personal compartiendo computadora | Pasa | `tests/e2e/caja-por-usuario.spec.ts` — «W6: Lisbeth no ve la caja de Marcos…». |
| Gerente: restricción de respaldo Drive | Pasa | `tests/e2e/respaldo-drive.spec.ts` — «gerencia no ve la tarjeta». |
| Caja a 1366 px | Pasa | `tests/e2e/caja-web.spec.ts` — «A5 (1366×768)…». |
| Caja a 390 px | Pasa | `tests/e2e/caja-web.spec.ts` — «A5 (390 px)…». |
| Venta sin conexión y sincronización única | Pasa | `tests/e2e/store.spec.ts` — «venta offline queda guardada y se sincroniza una sola vez». |

## Tiempos orientativos de navegación

Medición local desde el clic hasta que desaparece el estado de carga, con datos
de demostración y servidor local ya iniciado. No son una medición de Internet
ni sustituyen una prueba de rendimiento de producción.

| Pantalla | 1366 px |
| --- | ---: |
| Resumen | 303 ms |
| Punto de venta | 156 ms |
| Caja | 106 ms |
| Productos | 69 ms |
| Inventario | 203 ms |

En 390 px: Resumen 426 ms y Punto de venta 379 ms.

## Fallos priorizados

1. **P0 — instalador no construido.** Ver
   [instalador-9nov.md](instalador-9nov.md). Bloquea la prueba de Windows limpio,
   actualización, reversión y la verificación sin red del producto instalado.
2. **Sin hallazgos funcionales adicionales en este recorrido.** Las comprobaciones
   de desbordamiento horizontal incluidas en las pruebas A5 y de gestión pasaron.

## Pendiente por el P0

Cuando exista un `.exe` construido, ejecutar en Windows Sandbox sin red: crear
un negocio local, iniciar sesión, registrar una venta, cerrar caja,
respaldo/restauración, actualizar desde una versión anterior y revertir. Esa
será la evidencia definitiva de los puntos 1 y 3 de la cola.
