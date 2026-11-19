# C5-1 · Ayuda igual a la pantalla

Base revisada inicialmente: `c892d09b`. Conciliada por contenido con
`origin/nexora-cloud` `6bfa1aadd2443a4e45487cae61b2f74c19877822`.
La revisión de `apps/**` y `tests/e2e/**` fue solo de lectura.

La base nueva ya contiene el arreglo E2E de la pieza 1. Sus commits fueron
reescritos durante la integración, por lo que se comprobó el contenido y no
solo la ascendencia del SHA original `8022a736`.

## Resultado

Se revisaron las 30 respuestas de `QuickQuestions.tsx`, las ocho secciones de `MANUAL-CAJERO.md` y las 30 filas de `MANUAL-CAJERA-PREGUNTAS.md`.

Encontré ocho contradicciones o instrucciones incompletas. Cinco corresponden a los manuales y quedaron corregidas en esta rama. Tres pertenecen a `QuickQuestions.tsx`; solo se proponen porque ese archivo es de Claude nube.

## Cambios necesarios

| Archivo:línea en la base | Texto actual | Qué hace de verdad la pantalla | Texto nuevo exacto | Prueba que busca el texto |
|---|---|---|---|---|
| `apps/web/src/QuickQuestions.tsx:527` | «Cuenta… igual la tarjeta y la transferencia» | El cierre pide `Tarjeta declarada`; las transferencias las suma el sistema (`Tienda.tsx:393-451`). | «Ve a Caja y pulsa “Cerrar y arquear”. Cuenta el efectivo y escribe “Tarjeta declarada”. Las transferencias las suma el sistema. Explica cualquier diferencia. Pulsa “Cerrar caja e imprimir cuadre”.» | `tests/e2e/store.spec.ts:2568-2586`, `tests/e2e/caja-cierre-movil.spec.ts:92-101` |
| `apps/web/src/QuickQuestions.tsx:543` | «no sirve “Cliente de mostrador”» | La pantalla llama al cliente genérico `Consumidor final` (`POS.tsx:1487`, `POS.tsx:2663`). | «Elige un cliente; no sirve “Consumidor final”. Al cobrar, toca “Crédito”. Si pide aprobación, gerencia escribe su PIN. El crédito no es dinero cobrado.» | `tests/e2e/caja-web.spec.ts:173`, `tests/sales-pdf.test.ts:218` |
| `apps/web/src/QuickQuestions.tsx:551` | «usa “Solicitud de anulación”… Gerencia la revisa» | La cajera pulsa `Solicitar anulación`; solo administración aprueba o rechaza (`Management.tsx:3372-3386`, `VoidRequests.tsx:119-154`). | «En Ventas busca tu factura y pulsa “Solicitar anulación”. Elige el motivo y explícalo. Administración la aprueba o rechaza. No repitas la venta mientras espera.» | `tests/e2e/solicitud-anulacion.spec.ts:180-227` |
| `docs/MANUAL-CAJERO.md:11` | Un fondo menor puede pedir PIN de gerente. | El formulario solo pide una nota; el código aclara que no pide PIN (`Management.tsx:2032-2060`). | «Escribe el monto y pulsa “Guardar”. Si es menor que el sugerido, explica la diferencia en la nota. El fondo menor no requiere PIN.» | Regresión `tests/accessibility-contract.test.ts`; `tests/e2e/caja-fondo-sugerido.spec.ts:22` cubre la apertura. |
| `docs/MANUAL-CAJERO.md:36` | Tarjeta: «solo últimos cuatro dígitos y aprobación». | También muestra marca, terminal si está configurada y tipo de tarjeta (`POS.tsx:2778-2846`). | «En tarjeta completa los campos visibles: últimos cuatro dígitos, aprobación, marca, terminal si aparece y tipo.» | Regresión `tests/accessibility-contract.test.ts`; `tests/e2e/store.spec.ts:1153-1157` cubre el cobro. |
| `docs/MANUAL-CAJERO.md:75-85` | La cajera debe avisar de palabra a Marcos o Génesis. | La cajera puede solicitar desde su propia venta, elegir tipo y explicar; administración decide (`Management.tsx:3372-3386`, `Management.tsx:3685-3715`). | Pasos «Solicitar una anulación» aplicados en el manual. | `tests/e2e/solicitud-anulacion.spec.ts:180-227` y regresión `tests/accessibility-contract.test.ts`. |
| `docs/MANUAL-CAJERO.md:107` | Siempre dice no volver a cobrar si no llegó respuesta. | Hay dos mensajes: confirmar automáticamente o reintentar con el mismo carrito y pagos (`POS.tsx:2209-2213`). | Distinguir `pendiente de confirmación` de «pulsa Finalizar venta otra vez con los mismos pagos». | `tests/e2e/store.spec.ts:2295-2320` y regresión `tests/accessibility-contract.test.ts`. |
| `docs/MANUAL-CAJERA-PREGUNTAS.md:55` | Pregunta 27: «Asistente con IA». | La pregunta real es si necesita pedir ayuda seguido (`packages/shared/src/index.ts:1077`). | «Necesidad de ayuda — Sí si necesitas pedir ayuda seguido para usar la caja.» | `tests/mis-ventas-preguntas-postgres.test.ts:315` cuenta las 30 preguntas; la regresión textual está en `tests/accessibility-contract.test.ts`. |

## Revisión completa sin cambio

- Las 22 preguntas de datos de `QuickQuestions.tsx:183-520` presentan ventas propias, caja, pendientes y productos mediante los datos cargados por el componente. No encontré texto operativo que contradiga las pantallas revisadas.
- Las ayudas de devolución, venta en espera, transferencia, pago mixto y cámara (`QuickQuestions.tsx:531-583`) coinciden con los botones y formularios actuales.
- Las secciones 2, 4, 5 y 7 de `MANUAL-CAJERO.md` coinciden con las pantallas revisadas. Las secciones 1, 3, 6 y 8 solo necesitan los cambios enumerados arriba.
- Las filas 1-26 y 28-30 de `MANUAL-CAJERA-PREGUNTAS.md` coinciden con `CASHIER_SURVEY` (`packages/shared/src/index.ts:1027-1088`).

## Diff propuesto para Claude nube

No se modificó `apps/web/src/QuickQuestions.tsx`. Claude nube debe sustituir únicamente las tres cadenas de las líneas 527, 543 y 551 por los textos exactos de la tabla.

## Lo que no pude comprobar

- No ejecuté las pruebas de navegador ni abrí la interfaz; `tests/e2e/**` es propiedad de Claude nube.
- No comprobé producción, Render, la base de la tienda ni configuraciones reales de terminales de tarjeta.
- Las capturas existentes no se regeneraron; ChatGPT PC valida la pantalla después del despliegue.

## Aplicado en `QuickQuestions.tsx` por Norexos 1 (12-nov)
- Líneas 527 y 551: aplicadas con los textos de la tabla, con las comillas «» que usa el archivo. Verificado contra la pantalla: «Cerrar y arquear» (`Management.tsx:1708`), «Tarjeta declarada» y «Cerrar caja e imprimir cuadre» (`Tienda.tsx:394`, `466`), «Solicitar anulación» y «Tipo de motivo» (`Management.tsx:3385`, `3691`).
- **Línea 543, corregida y no aplicada tal cual:** la tabla proponía «no sirve “Consumidor final”». El código no lo respalda: no existe un cliente «Consumidor final» predeterminado (`POS.tsx:1487` dice «si existe»; `B02 · Consumidor final` de `POS.tsx:2663` es un tipo de comprobante) y la API solo exige que haya un cliente para el crédito (`sales.ts:1081`). Texto aplicado: «Elige primero el cliente (F4): sin cliente no se puede vender a crédito. Al cobrar toca «Crédito». Si el sistema pide aprobación, llama a gerencia para su PIN. El crédito no es dinero cobrado.»
- Consecuencia para C1 («Consumidor final» por defecto): hoy **no hay** cliente genérico en el código; habría que crearlo, y eso se suma a la decisión pendiente de la dueña.

