# Resultados · control de la vendedora de GV (orden 4-nov)

Rama `claude-pc/gv-control-vendedora`. SHA: ver el último commit de la rama. CI (`verify`, `windows-installer`, `render-images`): se anota abajo al terminar.

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
