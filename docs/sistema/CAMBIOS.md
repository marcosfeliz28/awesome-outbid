# Cambios de la base del sistema

Cada vez que cambie una pantalla, botón, flujo, permiso, regla de dinero, modelo, texto de menú o rama/despliegue, se edita el archivo que corresponda de `docs/sistema/` **y** se agrega una fila aquí, en el mismo commit (regla de `.claude/skills/base-sistema/SKILL.md`). Un cambio de sistema sin su línea aquí no se mezcla ni se despliega.

Formato: `| fecha | quién | qué cambió | archivos |`

| fecha | quién | qué cambió | archivos |
|---|---|---|---|
| 2026-10-30 | Claude (sesión de levantamiento, rama `cola-n26`) | Creación de la base `docs/sistema/` (levantamiento completo de la tienda: README, PANTALLAS, FLUJO_CAJA_POS, FLUJO_COBROS_Y_TRANSFERENCIAS, FLUJO_MERCANCIA, GV, ROLES_Y_PERMISOS, DATOS_Y_MODELOS, GLOSARIO, RESPUESTAS_A_TALLER, CAMBIOS, INDICE.json). Sin cambios de código. | `docs/sistema/*` |
| 2026-10-30 | Claude (Taller, rama `claude/desglose-mes`) | Corrección: «Ver detalle del mes» del panel anual (YearPie) mandaba a Mercancía. La causa era la comprobación de pantalla de `App.tsx`: al comparar el hash completo con el menú, `month-report?from=…&to=…` no coincidía y se volvía a la primera pantalla (Mercancía). Ahora compara solo la pantalla y permite `month-report` a quien tiene `reports:read`. Pasa en cualquier ancho (probado a 390 px y a 1280 px), no solo en celular. | `apps/web/src/App.tsx`, `tests/e2e/desglose-mes-movil.spec.ts` |
| 2026-10-30 | Claude (Norexos 7, rama `claude/desglose-mes`) | Desglose del mes: renglones de lo no cobrado (Por cobrar, Transferencias por verificar, Sin cobro registrado, Crédito ya cobrado) para que las formas de pago sumen la venta bruta. Solo lectura. Prueba de integración rehecha (crea crédito/contraentrega, transferencia sin verificar, venta sin cobro y devolución). | `apps/api/src/reports.ts`, `apps/web/src/PaymentMixPie.tsx`, `apps/web/src/MonthReport.tsx`, `tests/desglose-suma-api.test.ts`, `docs/sistema/PANTALLAS.md` |
| 2026-10-30 | Claude (Norexos 8, rama `claude/desglose-mes`) | Desglose del mes por banco: `payments[].bank` en `/dashboard/breakdown`, lista «Cobros por banco» en `PaymentMixPie`, columna Banco en el CSV; la prueba usa la variante con más existencia y es repetible. Solo lectura. Archivos: `apps/api/src/reports.ts`, `apps/web/src/PaymentMixPie.tsx`, `MonthReport.tsx`, `tests/desglose-suma-api.test.ts`. |
