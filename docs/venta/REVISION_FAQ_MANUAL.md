# Revisión de los borradores de FAQ y manual (T23)

Revisión de solo lectura. Fuente: `origin/nexora-cloud` (SHA 9626b19f): los cuatro borradores en `docs/venta/`.
Ningún borrador se editó. Quien los verifica decide qué se publica.

## Búsqueda de riesgos (grep en los cuatro archivos)
- **e-CF / DGII:** ninguna mención.
- **«Nexora» (producto):** ninguna mención.
- **Cifrado, seguridad, garantías:** ninguna mención.
- **Cifras:** solo etiquetas de campos con «(RD$)»; ninguna cifra de negocio.
- Resultado: no hay promesas que corregir en el texto de los borradores. El problema es de **base**: ninguna respuesta está verificada contra el código.

## FAQ de administración (`FAQ_ADMIN_BORRADOR.md`)
- **Estado:** 0 de 12 preguntas con respuesta. El archivo fuente (`Management.tsx`) no tiene sección de preguntas frecuentes.
- **Corrección propuesta:** no publicar. Pedir otra fuente (un manual o textos de ayuda) o cerrar la tarea.

## FAQ de caja (`FAQ_CAJA_BORRADOR.md`)
- **Estado:** 12 preguntas con cita `POS.tsx:línea`. Las citas salen del inventario de textos, no de leer el código.
- **Riesgo:** cualquier número de línea puede estar desplazado. Hay que abrir cada cita antes de publicar.
- **Corrección propuesta:** verificar las 12 citas en `apps/web/src/POS.tsx` del commit que se publique. Quitar cualquier respuesta cuya línea no contenga el texto citado.
- **Nota:** el borrador dice que dio 15 y se quedaron 12; confirmar cuáles se descartaron y por qué.

## FAQ de GV (`FAQ_GV_BORRADOR.md`)
- **Estado:** 12 preguntas con cita a `Gv.tsx` y `GvCitas.tsx`. Sin leer el código, según el propio borrador.
- **Hallazgo de archivo:** la pregunta «qué información se muestra para cada cita» cita `Gv.tsx:279-408`. Las citas viven en `GvCitas.tsx` (en el repo). Esa cita casi seguro está mal de archivo.
- **Corrección propuesta:** verificar las citas en `Gv.tsx` y `GvCitas.tsx`. Corregir la de citas al archivo correcto o quitarla.

## Manual corto de caja (`MANUAL_CAJA_BORRADOR.md`)
- **Estado:** 15 pasos. Nueve están marcados «NO ENCONTRADO» o sin cita verificada: pasos 1, 2 (crear), 4, 9, 10, 14 y 15.
- **Hallazgo de fuente:** el apartado «Qué hiciste» dice que se citó `pos-filas.md`, y las citas de los pasos son de `POS.tsx`. Las dos fuentes no coinciden.
- **Paso 3 («lector de código de barras»):** el texto de la cita no lo dice; la cita solo dice «Escanea o busca». Quitar «lector de código de barras» si no se confirma.
- **Corrección propuesta:** publicar solo los pasos con cita verificada. Quitar o marcar los 7 «NO ENCONTRADO». Unificar la fuente del manual.

## Qué no comprobé
- No leí `POS.tsx`, `Gv.tsx`, `GvCitas.tsx` ni `Management.tsx` línea por línea: las citas quedan sin verificar.
- No revisé `docs/operacion`, que el borrador de caja dice que no se abrió.
