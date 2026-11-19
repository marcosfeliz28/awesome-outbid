# T1 · Verificación de correcciones GV-01 a GV-16

Fecha: 2026-10-26  
Rama auditada: `origin/claude/modulo-gv`  
Commit auditado: `a97f8fa73f096be98c31bdd63dc1d9d697eaa157`  
Base de hallazgos: `docs/coordinacion/AUDITORIA_GV_CHATGPT.md`  
Método: auditoría estática de la corrección posterior a `6c292009`; no se modificó código existente.

## URGENTE · Veredicto

Resultado: **7 resueltos, 7 parciales y 2 siguen abiertos**. No recomiendo integrar todavía sin corregir los tres hallazgos altos nuevos de importación: permiten que datos importados contradigan cobros y reembolsos ya asentados.

## Verificación individual

| ID | Estado | Evidencia y cobertura |
|---|---|---|
| GV-01 | **Parcial · Alta** | El cambio por PIN bloquea con ventas o mercancías pendientes y limpia caché: `apps/web/src/App.tsx:1298-1322`. Pero `forgetSessionData()` conserva esas tablas: `apps/web/src/api.ts:282-301`; entrar directamente con contraseña en ese equipo todavía deja datos Macgen en IndexedDB. No hay regresión de navegador. |
| GV-02 | **Resuelto** | `settings` exige `sale:manage`: `apps/web/src/App.tsx:730-739`; el botón también se condiciona en `apps/web/src/App.tsx:1022-1030`. Falta una prueba explícita de navegación directa a `#settings`. |
| GV-03 | **Parcial · Media** | Se ocultan nombres de gerencia, pero se siguen mostrando nombres reales de usuarios con `*`: `apps/api/src/gv-money.ts:391-414`. `tests/gv-modulo-api.test.ts:593-594` solo comprueba una gerente; no cubre una administradora de Macgen. |
| GV-04 | **Resuelto** | La migración fija exactamente los tres permisos del rol reservado: `apps/api/prisma/migrations/202610260903_gv_auditoria/migration.sql:33-39`. Cobertura indirecta: `tests/gv-modulo-api.test.ts:78-84` y `tests/gv-unit.test.ts:31-40`. |
| GV-05 | **Parcial · Alta** | La revisión exige `gv:verify` y niega autoaprobación de gerencia: `apps/api/src/gv.ts:381-411` y `packages/shared/src/index.ts:776-785`; prueba en `tests/gv-modulo-api.test.ts:284-342`. Falta `@RequireTerminal()`, presente en Macgen en `apps/api/src/sales.ts:2685-2686,2821-2822`. |
| GV-06 | **Parcial · Media** | Hay bloqueo, validación de método, exclusión de estados y `CHECK`: `apps/api/src/gv.ts:403-425` y migración `202610260903_gv_auditoria/migration.sql:21-25`. La carrera se prueba en `tests/gv-modulo-api.test.ts:319-329`. Repetir rechazo devuelve error en `apps/api/src/gv.ts:412`, mientras repetir verificación es idempotente en `:413-415`; falta regresión de rechazo repetido. |
| GV-07 | **Resuelto** | Banco y referencia obligatorios en `apps/api/src/gv-money.ts:40-70`, `CHECK` en la migración `:26-30` y lista filtrada por transferencia en `apps/api/src/gv.ts:583-592`. Prueba: `tests/gv-modulo-api.test.ts:212-247`. |
| GV-08 | **Resuelto** | Pagado incluye solo lo verificado y «por verificar» queda separado: `apps/api/src/gv-money.ts:100-120`; reportes en `apps/api/src/gv.ts:461-501`. Pruebas: `tests/gv-unit.test.ts:5-27` y `tests/gv-modulo-api.test.ts:230-243`. |
| GV-09 | **Parcial · Alta** | Los endpoints normales bloquean, recalculan y limitan pagos: `apps/api/src/gv-money.ts:141-219,226-260`; pruebas secuencial/concurrente en `tests/gv-modulo-api.test.ts:250-281` y citas en `tests/gv-citas-api.test.ts:206-217`. La importación aún puede omitir pagos existentes y saltarse la regla; véase hallazgo nuevo 1. |
| GV-10 | **Resuelto** | Cada pago importado exige clave estable: `apps/api/src/gv-money.ts:263-270`; claves repetidas se detectan en `apps/api/src/gv.ts:646-671`. Reordenamiento cubierto por `tests/gv-modulo-api.test.ts:508-538`. |
| GV-11 | **Resuelto** | Se compara la propietaria original antes de actualizar: `apps/api/src/gv-money.ts:322-345`. Prueba: `tests/gv-modulo-api.test.ts:548-553`. |
| GV-12 | **Parcial · Alta** | La reimportación secuencial protege pagos revisados: `apps/api/src/gv-money.ts:334-388`, con prueba en `tests/gv-modulo-api.test.ts:543-547`. Persiste una carrera entre planificación y verificación bancaria; véase hallazgo nuevo 3. |
| GV-13 | **Parcial · Alta** | La API normal bloquea pagos en estados cerrados, exige reembolso y no reabre: `apps/api/src/gv-money.ts:189-195,226-260`; reportes descuentan en `apps/api/src/gv.ts:502-542`; prueba en `tests/gv-modulo-api.test.ts:365-405`. La importación puede deshacer el estado reembolsado; véase hallazgo nuevo 2. |
| GV-14 | **Resuelto** | Los pendientes unen inscripciones y citas: `apps/api/src/gv.ts:524-579`. Prueba: `tests/gv-citas-api.test.ts:394-406`. |
| GV-15 | **Sigue abierto · Media** | `useRealtime()` continúa para cualquier usuario y la sincronización registra terminal: `apps/web/src/App.tsx:655,767-791`; la API permite registrar a cualquier autenticado: `apps/api/src/realtime.ts:157-219`. Sin prueba correctiva. |
| GV-16 | **Sigue abierto · Media** | La web conserva revisión individual: `apps/web/src/Gv.tsx:798-864`. Faltan agrupación por banco/fecha, selección múltiple, total y diferencia, CSV y corrección auditada de referencia. Sin prueba correctiva. |

## Hallazgos nuevos

### Alta · Reimportar sin pagos anteriores permite bajar el total por debajo de lo cobrado

**Archivos:** `apps/api/src/gv-money.ts:295-321`, `apps/api/src/gv.ts:750-770` y `apps/api/src/gv-citas.ts:262-268`.

**Cómo reproducirlo:** importar una entidad de RD$1,000 con pago verificado de RD$900; reimportar la misma entidad con total RD$100 y `payments: []`. El pago anterior permanece, pero el total baja a RD$100.

**Arreglo propuesto:** después de bloquear la entidad y dentro de la transacción, cargar todos sus pagos existentes, combinar presentes y ausentes y validar la edición mediante `checkGvOwnerEdit()`.

### Alta · La importación puede reabrir una inscripción o cita reembolsada

**Archivos:** `apps/api/src/gv.ts:762-770` y `apps/api/src/gv-citas.ts:264-268`.

**Cómo reproducirlo:** importar una entidad `reembolsada` con monto y fecha; reimportar la misma clave como activa, con reembolso nulo. El `upsert` elimina el reembolso y vuelve a abrirla.

**Arreglo propuesto:** bloquear la entidad y aplicar `checkGvOwnerEdit()` también en importación; un reembolso existente debe ser definitivo e inmutable.

### Alta · Carrera entre reimportación y verificación bancaria

**Archivos:** `apps/api/src/gv.ts:673-687,732-735` y `apps/api/src/gv-money.ts:351-388`.

**Cómo reproducirlo:** pausar la importación después de leer una transferencia pendiente; verificarla desde otra solicitud; continuar la importación. La aplicación usa la copia anterior y puede cambiar monto, método, banco o referencia ya verificados.

**Arreglo propuesto:** mover planificación y validación dentro de la transacción después del bloqueo y bloquear/releer cada pago antes de cualquier modificación.

## Pruebas y CI

Al cerrar esta revisión, el workflow del commit `a97f8fa` seguía en ejecución: el paso `pnpm check` de `verify` ya estaba verde, pero `verify`, `windows-installer` y `render-images` aún no habían terminado. Esta entrega no afirma CI verde.

Pruebas que todavía hacen falta:

1. E2E de navegador para datos IndexedDB al entrar directamente como GV.
2. Navegación directa a `#settings`.
3. Identidad de una administradora `*` de Macgen en reportes GV.
4. Rechazo repetido idempotente y verificación GV condicionada a terminal.
5. Las tres regresiones adversarias de importación descritas arriba, incluida la carrera real con PostgreSQL.
