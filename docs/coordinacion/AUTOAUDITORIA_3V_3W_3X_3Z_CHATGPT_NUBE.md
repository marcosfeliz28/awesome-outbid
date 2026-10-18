# Autoauditoría de 3v → 3w → 3x → 3z · ChatGPT NUBE · 12 oct 2026

Rama `nexora-chatgpt-nube`. Sin despliegue, acceso a Render ni uso de contraseñas. La 3y de Claude (`42c0e36`) se incorporó sin modificarla. Esta entrega requiere integración y los tres trabajos de CI **en el último commit** antes de considerarse validada.

## Alcance y adversarios revisados

1. **3v — créditos por persona.** Lista agrupada en PostgreSQL y paginada por cliente; búsqueda por nombre, total y antigüedad. Ficha con pagos y PDF A4. Cobro a varias ventas ordenado por antigüedad y centavos, en una sola transacción, con fila de idempotencia y hash del pedido. Reutiliza `collectLine`, que conserva el cálculo actual de caja, incentivos y saldo. No modifica inventario. `@Permit("*")`, sucursal en cada lectura/cobro y teléfono/identificación siempre enmascarados, incluso para administración. Reenvío con otro pedido o usuario se rechaza; carreras bloquean caja y luego ventas en orden fijo, y releen saldos tras el bloqueo. Transferencias pendientes reservan saldo.
2. **3w — ingresos por día y método.** Venta por fecha de venta, cobro verificado por fecha registrada, devolución por fecha de devolución; anuladas fuera. Crédito generado y dinero recibido se separan. Resumen en SQL; detalle paginado; exportaciones CSV con BOM, XLSX de dos hojas y PDF A4. CSV usa contrapresión y exportación por cursor. Límite 366 días, 50.000 movimientos y 10.000 en PDF. Filtros de caja, usuario y equipo. Si la caja seleccionada está cerrada en un solo día, se muestra diferencia frente al cierre; si no, se indica que la comparación es parcial. Quien no puede ver efectivo esperado no recibe el informe mientras haya cajas abiertas. No altera caja, inventario, incentivos ni crédito.
3. **3x — ajustes y PIN.** La función compartida devuelve el motivo y la regla booleana llama esa misma función. Prueba de paridad contra la regla previa con importes, roles, deuda y turno. La caja muestra el motivo junto al PIN al inicio del modal. Las ayudas explican el cero y el interruptor de crédito. El margen estimado `(precio − costo promedio)/precio`, sin quitar ITBIS, se muestra solo con `profit:read` y descuento; no bloquea venta. El costo final por lote se contabiliza al vender en la API y puede diferir del promedio mostrado antes de cobrar.
4. **3z — informes formales.** PDF diario y mensual con Grupo Macgen, folios, caja con columnas en renglones separados, bancos/efectivo, usuarios, categorías vendidas y sin vender, créditos abiertos/cerrados, anuladas, descuentos, cambios de costo y señales con evidencia para revisar. Margen sin restar ITBIS, ITBIS por separado. Excluye cajas cuyo identificador comienza `QA-`, `QA_`, `TEST-`, `TEST_`, `PRUEBA-` o `PRUEBA_`; esa convención queda declarada en el informe. Desde el 27 de octubre añade propuesta de stock de 1–2 meses a partir de ventas brutas de 60 días y existencia vendible de Tienda; no modifica precios ni stock.

## Evidencia local

- `pnpm typecheck`, `pnpm lint`, `pnpm build`: pasaron en esta rama.
- Cinco archivos de pruebas unitarias focales: **12 pruebas pasaron** (`credit-allocation`, `income-day`, `credit-reasons`, `formal-period`, `formal-pdf`). El PDF de prueba ocupa varias páginas.
- Regresión 3w comprobada con mutación temporal: al desactivar la resta de `return_total` en `income-day.ts`, la prueba «separa venta, crédito cobrado otro día y devolución» falló (`sold` recibido `0`, esperado `-0.01`); tras restaurar el código, 3/3 pruebas de ese archivo pasaron. No se guardó la mutación.
- `pnpm check` completo: **no pasó en este entorno**; pruebas existentes que abren servicios locales fallan con `listen EPERM: operation not permitted 127.0.0.1`. PostgreSQL y los navegadores E2E no están disponibles aquí. No se rebajaron pruebas. Las regresiones PostgreSQL se añadieron a `tests/credito-api.test.ts` y deben correrse en CI.
- GitHub: intento de `git push origin HEAD:refs/heads/nexora-chatgpt-nube` rechazado por falta de credenciales (`could not read Username`). Se entrega bundle para integrar y ejecutar CI.

## Límites visibles y comprobaciones que faltan

- La ficha del cliente muestra hasta 1.000 ventas; si las supera, muestra aviso, conserva el saldo global correcto y bloquea el PDF incompleto. Ampliar a paginación total si una persona alcanza ese historial.
- El informe formal lista hasta 500 filas por sección y avisa si las supera; el total global del crédito abierto se agrega sin ese límite. El informe mensual no reconstruye deuda histórica: enseña el saldo actual al emitirlo.
- `Payment` no tiene `verifiedAt`: una transferencia aparece al verificarse, pero agrupada por su fecha de registro. Para fecha bancaria real hace falta decisión de negocio y columna nueva. No se infiere una fecha falsa.
- El indicador de cajas de prueba depende del prefijo del identificador; una caja de prueba sin esa marca no puede detectarse de forma fiable. Si existen, el equipo debe identificarlas antes de confiar en el informe formal.
- En PostgreSQL/CI: aplicar migración nueva en base descartable y con datos de prueba; probar sucursal ajena, permisos, reenvío, carrera, transferencia pendiente, devolución, turno cruzado, CSV/XLSX/PDF reales, página a 390 px y Playwright de búsqueda/cobro/descarga. No afirmar estas pruebas como realizadas hasta ver sus resultados.
- Consecuencia sobre dinero: los cobros de 3v llaman a la misma rutina usada por el cobro individual. 3w y 3z son lecturas. 3x mantiene el resultado booleano de aprobación. El modo sin conexión no envía cobros por cliente nuevos; el botón necesita conexión con la API.

## Estado de CI

`verify`, `windows-installer` y `render-images`: **pendientes para el commit final**. Ninguna frase de esta entrega implica que esos tres trabajos ya estén verdes. Claude integra y valida; no se desplegó.
