# Plantilla de entrada de mercancía

`ENTRADA-MERCANCIA-LOTES.xlsx` está vacía y contiene hasta 200 líneas para llenar. La primera hoja es la que lee Nexora. No cambies los encabezados ni agregues subtotales.

En **Mercancía → Entrada**, adjunta el Excel para revisar la factura. El mapeo actual es `codigo`, `descripcion`, `cantidad`, `costo`. Código y lote son texto para conservar ceros iniciales. Cantidad y costo son números. Vencimiento es una fecha real con formato `AAAA-MM-DD`.

**Importante:** el lector de Excel actual no importa automáticamente `lote` ni `vencimiento`. Esas columnas sirven de referencia. Escríbelas en las líneas de revisión antes de confirmar la entrada. No confirmes una categoría que requiere lote/vencimiento sin completar los datos reales. La plantilla no crea productos ni registra existencias por sí sola.

## Verificación reproducible

`pnpm exec vitest run tests/merchandise-template.test.ts`

La prueba carga el archivo con el mismo ExcelJS de la API, rellena una copia en memoria y la pasa a `readInvoiceTable`. Verifica `001033`, cantidad `2.5`, costo `800.25`, lote `0007` y fecha `2028-06-30` en el roundtrip. También verifica que la plantilla entregada no tenga ejemplos y que explique el lote manual.

Antes: `2 failed`, archivo ausente. En la primera exportación se detectó además `TypeError: Cannot read properties of undefined (reading 'sheets')`: ExcelJS no leía el prefijo `x:` de SpreadsheetML emitido por Artifact Tool. El generador normaliza exclusivamente ese namespace XML a su equivalente por defecto, sin cambiar valores ni estilos.

Después: `Test Files 1 passed (1)`, `Tests 2 passed (2)`.

Autoría: runtime Node y Artifact Tool bundled, con `NEXORA_ARTIFACT_DEPENDENCIES` apuntando a su `node_modules`. Ejecuta `node scripts/create-merchandise-template.mjs`. Las dos vistas PNG de la plantilla se renderizaron y revisaron sin recortes. No se usó producción ni secretos.

Fuente del contrato: `apps/api/src/invoice.ts`, `apps/api/src/merchandise.ts` y el formulario de `apps/web/src/Merchandise.tsx` en `origin/nexora-cloud`, órdenes versión 3.6. Ninguno de esos archivos se modifica en esta entrega.
