# Antes vs. propuesta de estética (PC-VIS-01 a 14)

Rama: `claude-pc/visual-antes-14nov` desde `origin/nexora-cloud` (1d118b16). Solo documentos y capturas, sin cambios de código.
Propuestas: `origin/investigacion/potente-14nov`, `docs/coordinacion/potente-14nov/04b_ESTETICA_PRIVACIDAD.md`.
Capturas en `antes/`: páginas completas de la app de demostración, 1366 px y 390 px, claro y oscuro (nombre: `NN-pantalla-ancho-modo.png`).

Leyenda: **Coincide** / **No coincide** / **Parcial** / **Pendiente** (no revisado en esta ronda; no se supone resultado).

| ID | Qué propone | Qué dice que pasa hoy | Qué se ve en la captura | Estado |
|---|---|---|---|---|
| PC-VIS-01 | Paleta con roles (violeta marca, verde cobrar) | Dos sistemas de color; primario `#7c3aed` | `antes/01-caja-pos-1366-light.png`: botón «Cobrar» verde; pestaña activa en violeta. El hex exacto no se midió | Parcial |
| PC-VIS-02 | Un tema oscuro con tres alturas | Dos negros distintos, tarjetas sin sombra en oscuro | Pendiente: revisar `antes/*-dark.png` | Pendiente |
| PC-VIS-03 | Cifras con estilo propio (RD$ pequeño, número grande) | Total de 26 px peso 750 | `antes/01-caja-pos-1366-light.png`: «Total a cobrar» grande; el «RD$» no aparece más pequeño. Sin medir | Parcial |
| PC-VIS-04 | Caja: columnas por ancho, pestañas «Favoritos / Ofertas / Todo», carrito a 390 px como barra | Carrito fijo de 340 px; 3 columnas fijas | `antes/01-caja-pos-1366-light.png`: carrito a la derecha, cuadrícula de 4 columnas, pestañas por categoría («Todos los productos», «Ropa deportiva», «Fajas»…), **sin** «Favoritos» ni «Ofertas». A 390 px: pendiente | No coincide (pestañas); Parcial (columnas) |
| PC-VIS-05 | Carrito tipo ticket con foto, código gris e ITBIS con «%» | ITBIS en línea propia; Cobrar con F12 | Pendiente de revisar el detalle del carrito con líneas | Pendiente |
| PC-VIS-06 | Barra de estado de la caja (conexión, ventas por subir, impresora) | Botón de conexión «En línea / Sin conexión» en la barra superior | «En línea» visible arriba a la derecha en `antes/03-inicio-1366-light.png`. Sin impresora ni ventas por subir en esa vista | Parcial |
| PC-VIS-07 | Panel «Hoy en una mirada» con cifra héroe y tres tarjetas | Tablero con franja KPI y cuadrícula de tarjetas | Pendiente: `antes/03-inicio-*.png` no revisado a fondo | Pendiente |
| PC-VIS-08 | Tablas legibles: números a la derecha, cabecera fija, filas de 48 px | `th` 13 px, `td` con padding 17 px | Pendiente: `antes/06-ventas-*.png`, `08-inventario-*.png` | Pendiente |
| PC-VIS-09 | Un componente único de vacío, carga y error | Tres estilos de vacío distintos | Pendiente. El aviso de error no se pudo provocar (ver bloqueos) | Pendiente |
| PC-VIS-10 | Un juego de iconos, dos tamaños, siempre con texto | `lucide-react` con tamaños variados | Pendiente | Pendiente |
| PC-VIS-11 | Cuatro animaciones permitidas | Duraciones 120/180/240 ms; tablero con entrada escalonada | No se mide en capturas estáticas | Pendiente |
| PC-VIS-12 | Primer arranque: lista de 5 pasos | «Primeros pasos» no está en este árbol | No aplica a este árbol; no hay captura | No aplica aquí |
| PC-VIS-13 | Recibo térmico con jerarquía en mm | Componente `tp-*` en `Prints.tsx` | No capturado (impresión no revisada) | Pendiente |
| PC-VIS-14 | Página de venta con pantallas reales y tarjetas en RD$ | `apps/landing` con violeta `#5b3fc4` | Fuera de la app; no capturado en esta ronda | Pendiente |

## Bloqueos (no completados en esta ronda)

- **Cobro** (`02-cobro-*.png`): no se pudo abrir la pantalla de cobro en ninguna de las cuatro combinaciones. El clic en un producto con existencias y en «Cobrar» dio tiempo agotado. No hay captura.
- **Aviso «Esta pantalla tuvo un problema»**: no se pudo provocar. Se intentó alterando la respuesta de reportes y no apareció el aviso. No hay captura.
- **Capturas a 390 px de página completa**: miden hasta ~23.000 px de alto (cuadrícula de productos). Son válidas como evidencia, pero difíciles de comparar a simple vista; se recomienda también una captura de primera pantalla.
- **Revisión visual**: en esta ronda se miró a fondo solo la caja a 1366 px en claro. El resto de capturas existe, pero no se ha revisado cada una.
- **Fuera de alcance de Orden 125**: PC-PRIV-01 a 06 (privacidad) no se evaluaron aquí.

## Capturas entregadas (40 archivos)

Pantallas: caja (01), inicio (03), productos (04), ventas (06), clientes (07), inventario (08), reportes (09), configuración (11), créditos pendientes (05) y cierre de caja (10), cada una en 1366 y 390 px, claro y oscuro. Faltan 02 (cobro) y 12 (aviso de error).
