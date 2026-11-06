# Resultados · control de la vendedora de GV (orden 4-nov)

Rama `claude-pc/gv-control-vendedora`. SHA del código: `5821224`. CI en ese SHA: `verify`, `windows-installer` y `render-images` en verde (run 41873692482). El commit siguiente solo cambia esta nota.

## Qué se hizo

1. **Caja propia de GV** (tabla nueva `GvCashSession`, migración aditiva `202611040001_gv_caja`): abrir, cobrar, cerrar con arqueo ciego y diferencias. Pestaña «Caja GV».
2. **Recibo por cada pago** `GV-0000001` con el contador existente; sin NCF.
3. **Bloqueo** de pagos y de nueva apertura con la caja del día anterior abierta.
4. **Pendientes de visto bueno** (commits separados): cupo bloqueado; anular/devolver con PIN de la dueña; alerta de abonos >15 días y caja vencida. El incentivo solo con pago verificado **ya existía** (se dejó la prueba).

## Pruebas

Prueba nueva `tests/gv-caja-api.test.ts` (PostgreSQL real, API real): falla antes (rutas inexistentes / cupo sin bloquear: 201 en vez de 400) y pasa después. Se ajustaron las pruebas GV existentes que anulan o devuelven para enviar el PIN.

## Seguridad-20 (revisados)

1 llaves y 18 historial: sin secretos nuevos · 3 rutas: todas con `@Permit` (`rutas-permisos.mjs`: 197 rutas, 0 sin permiso) · 5 acceso: arqueo ciego en el servidor · 6 zod en todas las entradas, montos `gvMoney` · 9 idempotencia de abrir; auditoría `gv_cash_*` · 16 sin SQL concatenado; migración aditiva · 17 PIN con hash y contador de intentos de `managerPinApproval` · 7 sin `innerHTML`. NO COMPROBADO: 11, 12, 13, 14, 15 (no cambia la configuración).

## Decide la dueña

- ¿Exigir caja abierta para cobrar? Hoy se puede cobrar sin caja (queda sin caja).
- ¿Los reembolsos en efectivo salen de la caja GV (restar del esperado)? Hoy no.
- Cupo bloqueado, PIN de la dueña para anular/devolver y alerta de 15 días: aprobar o quitar (cada uno es un commit).
- «Factura» = recibo interno numerado, no fiscal, hasta que GV tenga RNC.
- Alerta de 15 días: se interpretó como «último abono hace más de 15 días y aún con saldo».

---

# Resultados · Clary cierra caja todos los días (orden 5-nov)

Rama `claude-pc/gv-exigir-cierre` (base `nexora-cloud` 5-nov, `cc3bc69`). SHA del código: `119e136`. CI en ese SHA: `verify`, `windows-installer` y `render-images` en verde (run 42061052236). El commit siguiente solo cambia esta nota. Un primer intento (`5b8c262`) falló solo por la prueba adversaria de GV, que cobraba sin caja ni foto; corregida.

## Qué se hizo (un commit por punto)

1. **Cobrar exige caja GV abierta** (400 «Abre tu caja de GV antes de cobrar.»). La dueña solo con motivo escrito (`cashlessReason`, en auditoría).
2. **Foto del voucher/comprobante** en tarjeta y transferencia (jpeg/png/webp/pdf, ≤2 MB, tipo real validado, tabla aditiva `GvProof`, migración `202611050001_gv_comprobantes`). Sin foto no se guarda. No se envía a terceros.
3. **Cerrar caja** exige los tres montos y, si hubo tarjeta, la foto del cierre de lote.
4. **Alertas a la dueña** (sistema `Alert` existente): caja abierta pasadas las 10 PM RD y día con pagos sin cierre (`gv-vigilante.ts`).
5. **Pantalla** `GvCaja.tsx`/`Gv.tsx`/`GvCitas.tsx`: «Qué te falta hoy», foto obligatoria, avisos simples. Arreglo extra: sin caja abierta, la pestaña «Caja GV» mostraba error (cuerpo vacío); ahora `current` devuelve `open:false`.

## Pruebas

`tests/gv-caja-api.test.ts` (caja obligatoria, fotos válidas/inválidas, cierre con lote), `tests/gv-vigilante-api.test.ts` (alertas), PostgreSQL real y API real; fallan antes y pasan después. Se ajustaron las pruebas GV existentes (modulo, citas, T5, e2e) para abrir caja y adjuntar foto.

## Seguridad-20 (revisados)

3 rutas nuevas con `@Permit` (`rutas-permisos.mjs`: 0 sin permiso) · 5 la foto la baja solo quien cobró o `gv:verify`/`gv:reports`; arqueo ciego intacto · 6 zod con largo máximo; foto con tipo real y 2 MB · 7 sin `innerHTML` · 9 operationId idempotente, auditoría con la foto como «(tipo, bytes)» sin el contenido · 16 migración solo aditiva, sin SQL concatenado · 1, 2, 18 sin secretos ni variables nuevas. NO COMPROBADO: 8, 10–15 (no cambia la configuración; la foto en base64 sube el límite JSON de esas rutas a 4 MB, por debajo de Nginx 5 MB).

## Decide la dueña

- Las fotos viven en la base de datos (no en disco). ¿Cuánto tiempo se conservan? Hoy, para siempre.
- La alerta de «caja abierta a las 10 PM» queda en Avisos hasta que alguien la resuelva (no se cierra sola al cerrar la caja).
- Pagos hechos por la dueña sin caja no cuentan para la alerta de «día sin cierre».
- Pagos y cierres ya existentes no se tocan: los pagos viejos con tarjeta/transferencia no tienen foto.

---

# Rol `gerente_gv` y alertas que se cierran solas (6-nov, Norexos 1, rama `claude-pc/gv-gerente-rol`)

SHA: ver el último commit de la rama (anotado abajo al cerrar CI). CI (`verify`, `windows-installer`, `render-images`): pendiente de anotar con el SHA exacto.

- **A. Rol:** migración aditiva `202611060001_gv_gerente_rol` (INSERT … ON CONFLICT DO NOTHING; no asigna usuarios) y `permissions.gerente_gv` en shared = exactamente `gv:read`, `gv:reports`, `gv:verify`. Verificar sigue prohibido a quien registró la transferencia (`gv.ts:582`, solo `*` lo salta; el rol no tiene `*`).
- **B. Alertas:** `resolveGvCashAlerts` se llama dentro de la transacción de cierre; resuelve la de 10 PM de esa caja y las de día sin cierre de los días con pagos de esa caja.
- **C. Fotos:** documentado en `docs/sistema/GV.md` §14 (tabla `GvProof`, tope 2 MB, cálculo y consulta de espacio). Retención sin cambio.
- **Pruebas:** `tests/gv-vigilante-api.test.ts` (nueva: cierre resuelve avisos; falla antes —función inexistente— y pasa después, en PostgreSQL 16 real). `tests/gv-gerente-rol-migration-postgres.test.ts` (rol exacto, idempotente, no pisa ediciones; registrada en `vitest.config.ts`): **escrita pero NO corrida aquí** — el initdb de `embedded-postgres` falla en este contenedor (falta `libicuuc.so.60`); lo corre el CI. La misma SQL se aplicó con `prisma migrate deploy` en un PostgreSQL 16 y dio `{gv:read,gv:reports,gv:verify}`.
- **eslint y tsc** sin errores en lo tocado.
- **Seguridad-20:** 3/9 sin ruta nueva (la existente lleva `@Permit("gv:write")`; el rol nuevo no lo tiene) · 5 el rol no ve costos ni MacGen (sin esos permisos) · 6 sin entradas nuevas · 16 migración solo aditiva, sin SQL concatenado; la actualización de alertas usa Prisma parametrizado · 1, 2, 18 sin secretos ni variables. NO COMPROBADO: 8, 10–15 (no cambia configuración ni dependencias).
- **Pendiente de la dueña:** crear el usuario de la gerente con este rol. No se desplegó ni se tocó Render.
