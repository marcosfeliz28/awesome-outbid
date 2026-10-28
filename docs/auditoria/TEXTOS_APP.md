# Auditoría de textos de la app (D17)

Alcance: `apps/web/src` y `apps/api/src`. Solo se listan hallazgos; no se edita
nada. Fecha: 2026-10-27.

## Resumen

El producto está bien localizado: no se encontraron caracteres rotos ni tildes
faltantes en palabras comunes, y el texto visible usa español dominicano neutro
(en lugar de «login», «email», «password»). Los hallazgos son menores y de
consistencia (dos de redacción, uno de estilo tipográfico).

## Hallazgos

### 1. Tú/usted inconsistente en los recibos del cliente
El sistema se dirige al usuario interno de «tú» en toda la interfaz, pero el
recibo impreso usa «usted» en un lugar y «tú» en otro:

- `apps/web/src/Prints.tsx:633` — `¡Gracias por su compra!` (usted)
- `apps/web/src/POS.tsx:2341` — `...Gracias por tu compra.` (tú, leyenda no fiscal)

Propuesta: unificar. Si el recibo habla al cliente (registro formal), usar «su»
en ambos; si se prefiere cercanía, usar «tu» en ambos. No mezclar.

### 2. «Sólo» / «Solo» inconsistentes
El acento diacrítico de «solo» (adverbio) es opcional desde la Ortografía de la
RAE (2010), pero el repo lo usa en una forma mayoritariamente acentuada
(«Sólo») y en unos pocos casos sin acento:

- `apps/api/src/common.ts:887` — `Solo se puede editar una venta vigente.`
- `apps/api/src/common.ts:889` — `Solo se puede editar una factura hasta 7 días...`
- `apps/api/src/cash.ts:849` — `// Solo si el fondo es menor...`
- `apps/api/src/sales.ts:4526` — `// Solo administración: la transferencia...`
- `apps/api/src/usd-rate.ts:75` — `// Solo en la tienda real (variable en Render)...`

Propuesta: elegir una forma («Sólo» o «Solo») y aplicarla en todos los textos
visibles y comentarios; la mayoría del código ya usa «Sólo».

## Resultados negativos (verificados, sin incidencia)

- **Caracteres rotos (Ã, â€, Ã©, Ã±…)**: 0 coincidencias en `apps/web/src` y
  `apps/api/src`.
- **Tildes faltantes** en palabras frecuentes (código, número, categoría,
  política, devolución, configuración, facturación, información, descripción,
  contraseña, artículo, página, conexión, sincronización, autorización,
  confirmación, anulación, crédito, búsqueda, edición, teléfono, dirección,
  atención, cancelación, validación, opción, sección): 0 coincidencias.
- **Anglicismos en texto visible**: el login dice «Inicia sesión», los campos
  «correo» y «contraseña» (`apps/api/src/common.ts:124-125`), y la copia de
  seguridad «Respaldo». Las palabras en inglés que aparecen (`login`,
  `password`, `email`, `download`, `onClick`, `response.ok`) son identificadores
  de código, no texto que ve el usuario.
