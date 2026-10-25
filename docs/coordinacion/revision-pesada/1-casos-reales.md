# Auditoría de 4 anomalías del cuadre del 24-oct-2026 (rama nexora-cloud @ cfc21c3a, solo lectura)

## 1. Lizbeth: venta de RD$2,500 cobrada con US$40 → −2,500 RD$ y +40 US$ en líneas separadas — DISEÑO INCOMPLETO (bug de producto)
- El sistema no tiene pagos en dólares: el enum de métodos es `cash|card|transfer|credit_note|credit|cod`, sin moneda ni tasa (packages/shared/src/index.ts:582-589). En sales.ts no aparece ni `usd` ni `currency`; el único `tendered` (sales.ts:170, 1236, 2077) es en RD$.
- Por eso la venta entró como `cash` RD$2,500: `cashExpected` la suma al efectivo esperado en RD$ (cash.ts:51-90), igual que `cashSalesDetail` (cash.ts:308-323).
- Los dólares solo existen en el cierre: `countedUsd` va a closeDetails (cash.ts:1106) y en el cuadre se fijan `expected: 0` y `difference = counted` (cash.ts:342-348, 385, 392, 555). El valor `dop` (US$40 × tasa) es solo informativo: no entra en `differenceDop` (cash.ts:331-339) ni en `closeDifferences` (cash.ts:158-169).
- Cómo sale el faltante: la gaveta en RD$ tiene 2,500 menos de lo esperado → −2,500. Aparte se muestra +40 US$ que no compensa nada. El neto real es 40×tasa − 2,500 (con tasa 63 ≈ +RD$20). **No falta dinero.**
- Arreglo mínimo: agregar a `payments[]` un campo opcional `currency: "USD"` + `foreignAmount`, y guardar la tasa en el pago. `cashExpected` y `buildCuadre` restan ese equivalente del esperado en RD$ y lo suman a `foreign.usd.expected`. Así `differenceUsd = contado − esperado`. Mientras tanto: justificar este cierre con la tasa del día.

## 2. Wendy: declaró US$58.30 sin ninguna venta en USD — COMPORTAMIENTO DE LA USUARIA (más un hueco de validación)
- El formulario empieza vacío: `countedUsd: ""` (apps/web/src/Tienda.tsx:188-199). No se usa localStorage ni borrador en CloseCashModal (el único `localDB` es la cola de ventas, l.174-181) y no se rellena con la caja anterior. **El número lo escribió una persona.**
- El campo aparece siempre que haya `usdRate` (Tienda.tsx:389-390) y debajo muestra «Tasa N». Hipótesis: confundió el campo con la tasa o contó dólares que no eran de ventas. Se puede comprobar comparando con `closeDetails.usdRate` de esa caja.
- Validación: el esquema solo exige ≥0 (shared index.ts:680). El servidor no compara con ninguna actividad en USD, no pide PIN ni justificación: `cashCloseRequiresNote` y `cardOff/cashOff` solo miran cash/card/transfer (cash.ts:175-188, 1129-1157). La «Diferencia US$» se calcula como el contado (cash.ts:392) pero no genera alerta.
- Dinero: ninguno en RD$. Solo queda un dato falso en el cuadre.
- Arreglo mínimo: después de aplicar el arreglo 1, si `countedUsd ≠ esperado` exigir `differenceReason` igual que con el efectivo. Opcional: mostrar la tasa como texto y no pegada al campo.

## 3. Manuela: tarjeta RD$7,870 con `cardBatch: null` — muy probablemente HORARIO o PAGO LLEGADO DESPUÉS DEL CIERRE, no la caché
- Aclaración: eb589076 (21:15 UTC) es la prueba de Drive. La regla del lote está en f7da9f05 (24-oct 14:10 UTC) y la reforzó 0cf392b2 (19:23 UTC); las dos son ancestros de eb589076, así que el despliegue de las ~22:06 UTC la incluye. Si `closedAt` < hora real del despliegue, el servidor viejo no la exigía. Es la explicación más probable; compárense los dos datos.
- Hay **un solo** camino de cierre, `POST /cash-sessions/:id/close` (cash.ts:1018; la web llama en Tienda.tsx:263). No hay cola de cierres offline (monitoring.ts:91 solo registra) ni otro código que ponga `closedAt`. El chequeo está en el servidor, dentro de la transacción (cash.ts:1081-1094), y `batchNumber` llega como `""` por defecto (shared index.ts:690). **Una PWA vieja en caché no lo puede saltar.**
- Pagos que el conteo deja fuera (`sale.status = completed`, `status ≠ rejected`, sin filtro de entryType):
  - Sí cuenta los abonos/cobros CxC o COD con tarjeta, siempre que la venta esté completada.
  - Deja fuera los pagos con tarjeta de ventas anuladas: correcto.
  - **Hueco real:** pagos con tarjeta que entran en la caja DESPUÉS del cierre: venta offline sincronizada tarde desde otro equipo (offline-sales.ts:244, sales.ts:1275), revisión offline (offline-sale-review.ts:237), abonos (sales.ts:2129, 2561). `refreshClosedCash` (cash.ts:191-209) recalcula `expectedCard` pero nunca pide el lote. Resultado: tarjeta > 0 con `cardBatch: null`.
- También pudo cerrar sin pagos con tarjeta en el sistema declarando 7,870. En ese caso `cardOff` exige PIN de gerente y justificación (cash.ts:1129-1157): ver `cardApprovedBy` en closeDetails.
- Dinero: ninguno directo, pero el lote queda sin conciliar.
- Arreglo mínimo: en `refreshClosedCash`, si aparece tarjeta y `closeDetails.batchNumber` está vacío, crear una alerta «falta lote del verifón» y un camino para anotarlo después.

## 4. Todas las ventas del 24-oct dicen courierName «Addison» — BUG DE DATOS (default de la base), sin impacto en dinero
- Causa raíz: `courierName String? @default("Addison")` (apps/api/prisma/schema.prisma:337) y la migración `ADD COLUMN ... "courierName" TEXT DEFAULT 'Addison'` (migrations/202610250001_courier_fee/migration.sql:3). Postgres rellena con 'Addison' **todas las filas existentes** y cada venta nueva sin nombre.
- El código de venta está bien:
  - POS solo envía courierName con envío (`withCourier`, POS.tsx:1986, 2031-2036).
  - La API solo lo escribe con `courierFee` (sales.ts:1025-1030).
  - El state inicial `name: "Addison"` (POS.tsx:1752-1756) no se filtra a otras ventas.
- Dinero: ninguno. Todo lo que cuenta dinero filtra `courierFee > 0`: courier.ts:127, reportes/dinero.ts:86-87, `courierCharge` en shared index.ts:800-802. Solo engaña a quien lee la columna cruda (exportes, consultas, el detalle de venta para `sale:manage`, sales.ts:222-224).
- Arreglo mínimo:
  - Migración nueva: `ALTER COLUMN "courierName" DROP DEFAULT` y `UPDATE "Sale" SET "courierName"=NULL WHERE "courierFee"=0`. El UPDATE toca datos de producción: necesita la confirmación de la dueña.
  - Quitar `@default("Addison")` del schema.
  - El fallback «Addison» del código se queda.

No revisado: los datos de producción (hora real del despliegue, `closedAt`, `closeDetails` y pagos de esas cajas). Las conclusiones de 2 y 3 dependen de esos datos.
