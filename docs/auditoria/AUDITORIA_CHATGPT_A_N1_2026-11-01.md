# Auditoría de los últimos siete días a Norexos 1 — 1-nov-2026

**Alcance.** Revisión de solo lectura de `origin/nexora-cloud` desde el
25-oct-2026 hasta `eb36c677`. Se revisaron los cambios de dinero/GV,
devoluciones, seguridad, migraciones y pruebas que entraron en ese intervalo.
No se modificó código de negocio, no se llamó a Render ni a la base de la
tienda y no se usaron credenciales.

**Método.** Se consultó `docs/sistema/mapa/INSTRUCTIVO_SESIONES.md` y el grafo
local antes de abrir fuentes. Luego se contrastaron el historial, el código y
las migraciones. Se aplicó la lista de `.claude/skills/seguridad-20/SKILL.md`.
Todo hallazgo cita la fuente directa; lo no ejecutado se marca explícitamente.

## Hallazgos

| ID | Severidad | Evidencia | Hallazgo y arreglo propuesto |
| --- | --- | --- | --- |
| A-01 | **alta** | `apps/api/src/reports.ts:565-576`, `:609-620`; `tests/dinero-auditoria.test.ts:885-905` | El círculo anual resta devoluciones por la fecha de la devolución (`SaleReturn.createdAt`), mientras el desglose contabiliza la venta por la fecha de la venta y su `returnedQty`. Por eso el CI de la rama de coordinación falló con `expected 89439.5 to be greater than or equal to 90056.5` en `tests/dinero-auditoria.test.ts:898`. Adoptar un único criterio documentado para ambos endpoints, añadir casos en el día 1 y a mitad de mes, y ejecutar la suite de auditoría de dinero. Esta corrección está asignada a `claude-pc/fix-ci-mes`; no se toca aquí. |
| A-02 | **media** | `apps/api/src/gv-money.ts:132-142`, `:487-494`, `:553-569`, `:648-723`; `apps/api/prisma/migrations/202610310004_gv_pago_moneda/migration.sql:1-18` | La importación GV reutiliza los campos de pago pero solo aplica `transferDetails`; no aplica `cardDetails` ni `usdRate`, a diferencia de `gvPaymentInput`. También compara el tope con el `amount` sin convertir por moneda y al escribir no calcula `amountDop`. Un Excel administrativo puede por tanto presentar un pago USD con equivalencia nula, o tarjeta sin referencia, y dejar totales/importes inconsistentes. Corregir el importador para validar con los tres refinamientos, calcular `amountDop` en el servidor y comparar en la moneda del curso; añadir regresiones de importación USD sin tasa, USD con tasa y tarjeta sin referencia. |
| A-03 | **alta** | `apps/api/package.json:35`, `packages/shared/package.json:12`, `pnpm-lock.yaml:4843`; salida de `pnpm audit --prod` | `zod@3.25.76` queda por debajo del parche `4.6.6` que reporta el auditor para GHSA-mrhx-c7xc-m3w5. `pnpm audit --prod --audit-level=high` devolvió 3 vulnerabilidades: 1 alta y 2 moderadas. Preparar una actualización compatible en una rama de seguridad, con límites de colecciones y las pruebas de API; no se cambió la dependencia en esta auditoría. |

## Controles revisados sin hallazgo demostrable

- **Permisos en GV.** Las mutaciones revisadas declaran `@Permit`: escritura
  en cursos/inscripciones/pagos (`apps/api/src/gv.ts:203-205`, `:295-297`,
  `:383-391`), revisión de transferencias (`:459-461`) e importación solo para
  administración (`:807-809`). Esto no elimina A-02: el problema está tras el
  permiso, en la validación de la carga administrativa.
- **Dinero de moneda directa.** El alta interactiva exige tasa en USD mediante
  `gvPaymentInput` (`apps/api/src/gv-money.ts:205-220`), calcula `amountDop`
  en servidor (`:391-419`) y la migración añade el `CHECK` de moneda/tasa. La
  divergencia se limita a la ruta de importación señalada en A-02.
- **Migraciones del período.** Se leyeron las ocho migraciones desde
  `202610250401` hasta `202610310004`. Son aditivas o ampliaciones de
  restricciones; no se encontró un `DROP TABLE`, borrado de ventas ni cambio
  de datos de la tienda. La validación desde una base vacía queda **NO
  COMPROBADA** en esta auditoría.
- **Secretos y XSS.** La búsqueda estática no devolvió secretos con patrones
  de clave ni usos de `dangerouslySetInnerHTML`/`innerHTML` en `apps/api/src`
  y `apps/web/src`. No se inspeccionaron ni se solicitaron valores reales.

## Límites de comprobación

- No ejecuté `pnpm check`, Playwright, integración PostgreSQL ni CI: esta
  pieza es una auditoría de solo lectura y el CI de dinero ya está rojo por
  A-01.
- Intenté una comprobación aislada de los esquemas de importación, pero
  `pnpm exec tsx` falló antes de ejecutarla con `Command "tsx" not found`.
  No instalé paquetes para evitar modificar el entorno.
- La prueba unitaria existente tampoco pudo arrancar en este worktree:
  `pnpm exec vitest run tests/gv-incentivos-unit.test.ts --reporter=verbose`
  devolvió `Command "vitest" not found`. Es una ausencia local de
  `node_modules`, no un resultado de la suite; el CI instala con lockfile y
  debe ser la comprobación reproducible posterior a una corrección.
- No se verificaron cabeceras, CORS ni archivos expuestos contra un servicio
  desplegado: hacerlo requeriría acceder a producción, fuera del alcance.
- No se afirma que las migraciones hayan corrido en producción ni que el
  importe de A-02 ya haya afectado datos reales.

## Recomendación de orden

1. Mantener bloqueada la mezcla de ramas que dependan de `verify` hasta que
   Claude PC cierre A-01 con una regresión de fechas.
2. Tratar A-02 como corrección de integridad de dinero en una rama de Claude
   PC: no mezclar cambios de importación GV sin las tres regresiones propuestas.
3. Resolver A-03 en una rama separada, sin actualizar dependencias a ciegas;
   exigir `pnpm audit --prod`, `pnpm check` y los tres trabajos CI del SHA.
