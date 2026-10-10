# Plantilla de entrada de mercancía

`ENTRADA-MERCANCIA-LOTES.xlsx` está vacía y contiene hasta 200 líneas para llenar. La primera hoja es la que lee Nexora. No cambies los encabezados ni agregues subtotales.

En **Mercancía → Entrada**, adjunta el Excel para revisar la factura. El mapeo actual es `codigo`, `descripcion`, `cantidad`, `costo`. Código y lote son texto para conservar ceros iniciales. Cantidad y costo son números. Vencimiento es una fecha real con formato `AAAA-MM-DD`.

**Importante:** el lector de Excel actual no importa automáticamente `lote` ni `vencimiento`. Esas columnas sirven de referencia. Escríbelas en las líneas de revisión antes de confirmar la entrada. No confirmes una categoría que requiere lote/vencimiento sin completar los datos reales. La plantilla no crea productos ni registra existencias por sí sola.

## Verificación reproducible

`pnpm exec vitest run tests/merchandise-template.test.ts`

La prueba conserva la verificación del archivo publicado y ejecuta el generador desde una carpeta temporal, con `NEXORA_ARTIFACT_DEPENDENCIES` apuntando deliberadamente a un destino inexistente. Carga el resultado con el mismo ExcelJS de la API, rellena una copia en memoria y la pasa a `readInvoiceTable`. Verifica `001033`, cantidad `2.5`, costo `800.25`, lote `0007` y fecha `2028-06-30` en el roundtrip. También comprueba las 200 filas vacías, formatos de texto, fecha numérica en el XML, encabezados y paneles congelados, aviso de lote manual y rechazo a sobrescribir un archivo existente.

Antes de esta corrección, el nuevo caso falla con `Cannot find module '@oai/artifact-tool'` al ejecutar el generador real sin runtime externo. Los dos casos originales pasan.

Después: `Test Files 1 passed (1)`, `Tests 3 passed (3)`.

## Regenerar con las dependencias del repositorio

Con Node y pnpm de las versiones indicadas en `package.json`, ejecuta `pnpm install --frozen-lockfile`. El generador usa `exceljs`, ya instalado por `apps/api`; no necesita dependencias nuevas, Artifact Tool, variables externas ni ajustes del XML.

Desde la raíz del repositorio:

```powershell
$salidaPlantilla = Join-Path $env:TEMP ('nexora-plantilla-' + [guid]::NewGuid().ToString('N'))
node scripts/create-merchandise-template.mjs --output $salidaPlantilla
```

`--output` es obligatorio y recibe una carpeta. El generador crea `ENTRADA-MERCANCIA-LOTES.xlsx` y rechaza sobrescribir un archivo existente. La generación de las pruebas ocurre exclusivamente en carpetas temporales que se eliminan al terminar. La plantilla y las vistas PNG publicadas no se regeneran con esta corrección.

**@dueña: abrir la plantilla en Excel real.** Antes de sustituir el archivo publicado, revisa en Excel la plantilla regenerada: encabezados, instrucciones completas, congelación de fila/columna, códigos y lotes con ceros, fecha real y aviso de captura manual. La prueba del lector verifica contenido y tipos; la revisión visual de la nueva exportación queda pendiente. No se usó producción ni secretos.

Fuente del contrato: `apps/api/src/invoice.ts`, `apps/api/src/merchandise.ts` y el formulario de `apps/web/src/Merchandise.tsx` en `origin/nexora-cloud`, órdenes versión 3.6. Ninguno de esos archivos se modifica en esta entrega.
