# Validación visual local — Mercancía y Compras

Fecha: 2026-11-18
Candidato exacto: `e9a738bb5eea4bb98a5cc765bf302f57b7b2649c`
Aplicación integrada en el árbol: `3700d06a`
Base fuente declarada: `2d87290b`

## Condiciones

- UI real ejecutada solo en `127.0.0.1:14295`.
- API totalmente simulada con proveedor, producto, orden y recepción ficticios.
- Cuatro combinaciones: 1440 claro ES, 1440 oscuro EN, 390 claro ES y 390 oscuro EN.
- Usuario sintético de rol permitido. No se probaron permisos ni seguridad.
- Se abrieron y cerraron: documentación de Mercancía, Entrada/Salida, editor de orden, editor de recepción, historial y comprobante de recepción.
- No se enviaron formularios, no se confirmó entrada/salida, no se importó archivo, no se descargó Excel/PDF, no se imprimió y no se llamó a cámara.
- Todas las escrituras de negocio estaban bloqueadas; escrituras observadas: cero.

## Resultado

Última corrida: `4 passed (12.9s)`. Se generaron 24 PNG y `metricas-saneadas.json`.

## Regresiones corregidas y comprobadas

- Mercancía EN ya muestra `Find a product`, placeholder `Name, SKU, flavor, size or color`, `No products` y `No receipts yet.`
- Los campos de `DocumentFields` están traducidos en el bloque de Mercancía y en el editor de orden: número de factura, NCF, fecha, condición, opciones de pago, días e ITBIS.
- Confirmaciones de Mercancía: `Confirm receipt` y `Confirm stock removal` en EN; equivalentes correctos en ES.
- El editor de orden presenta título, proveedor, producto/variante, cantidad, costo, documento y acción en el idioma activo.
- El editor de recepción presenta flete, otros costos, unidades aceptadas/dañadas, lote, vencimiento y documento en EN/ES.
- Historial y comprobante traducen fechas, documento, unidades, quién recibió y acciones (`View`, `Print`, `Complete document`).
- A 390 px, los tres diálogos quedan dentro de 12–378 px, con 366 px de ancho; el cierre mide 44 px. Los editores largos desplazan su contenido internamente.
- No hubo desbordamiento horizontal global: ancho del documento igual al viewport.

## Hallazgos

### CM-E9-01 — Media — las razones de salida permanecen en español en Mercancía EN

- Evidencia: `1440-dark-en-mercancia-salida.png` y `390-dark-en-mercancia-salida.png`.
- Código: `apps/web/src/Merchandise.tsx:77-83` y render en `:788-792`.
- Resultado: el título del campo dice `Stock removal reason`, pero sus opciones siguen siendo `Merma`, `Dañado`, `Vencido`, `Muestra o probador`, `Uso interno` y `Devolución a proveedor`.
- Esperado: traducir únicamente la etiqueta visible según idioma, conservando los valores internos españoles que consume la API.

### CM-E9-02 — Baja — el cierre del editor de orden conserva nombre accesible español en EN

- Evidencia: `1440-dark-en-editor-orden.png`, `390-dark-en-editor-orden.png` y métricas.
- Código: `apps/web/src/Purchases.tsx:204` crea `Modal` sin `closeLabel`; el valor predeterminado es `Cerrar` en `packages/ui/src/index.tsx:126`.
- Resultado: el título y contenido están en inglés, pero el botón X se anuncia como `Cerrar`. El editor de recepción y el comprobante sí anuncian `Close`.
- Esperado: pasar `closeLabel={english ? "Close" : "Cerrar"}` al editor de orden.

## Disposición comprobada

- Editor de orden móvil: 366 px de ancho, 920 px visibles y contenido interno desplazable (1076 px en EN).
- Editor de recepción móvil: 366 px, 920 px visibles y contenido desplazable (1526 px en EN).
- Comprobante móvil: 366 px, cierre visible de 44 px y acciones dentro del diálogo.
- Tablas y tarjetas de Compras se renderizan en ambos temas; el importe largo ficticio de la orden no cambia.

## Límites

- Validación visual y de texto; no certifica persistencia, inventario, contabilidad, API, exportaciones, cámara, archivos ni permisos.
- El motivo ficticio `Caja rota` del comprobante es un dato simulado, no una cadena de interfaz; no se cuenta como hallazgo de localización.
- No se verificaron CI ni despliegue en este lote.

## Archivos

- `metricas-saneadas.json`.
- Capturas por combinación: `mercancia-entrada`, `mercancia-salida`, `compras`, `editor-orden`, `editor-recepcion` y `detalle-recepcion`.
