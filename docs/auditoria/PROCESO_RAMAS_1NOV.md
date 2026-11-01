# Proceso de ramas de agentes (orden 109, 1-nov)

Estado: **ninguna rama lista**. Las cuatro ramas tienen `verify` en failure, igual que `fix-ci-mes`, que es la causa del CI rojo documentada en `docs/auditoria/CI_ROJO_1NOV.md`. No se mezcló nada en nexora-cloud ni se empujó a ninguna rama.

## Orden de proceso

gv-incentivos → fix-dinero → fix-seg-menor → anim-reportes.

## Estado de CI (una consulta por cabeza, 1-nov)

| Rama | SHA | verify | windows-installer | render-images |
|---|---|---|---|---|
| claude-pc/gv-incentivos | c227d6b0 | failure | success | success |
| claude-pc/fix-dinero | 6a54a955 | failure | success | success |
| claude-pc/fix-seg-menor | 7113b81a | failure | success | success |
| claude-pc/anim-reportes | 3ebcee55 | failure | success | success |
| claude-pc/fix-ci-mes (referencia) | 3ed12566 | failure | success | success |

## Revisión (solo lectura, sin cambios en las ramas)

### 1. claude-pc/gv-incentivos — NECESITA CAMBIOS
- **Alta (dinero):** los pagos anulados siguen usando el 100 % del curso. `gv-incentives.ts:60-66` y `:86` incluyen los rechazados y `restante` no mira `rejectedAt`. Si un cobrador registra 4.500 RD$, anula y otro registra el mismo curso, el reemplazo recibe 0 (debería 50). Sin prueba.
- **Alta (dinero, regla decidida en orden 106):** la validación del reembolso va en la moneda del curso (`gv-money.ts:512-515`) y el reverso también (`gv-incentives.ts:95-97`). La regla dice reembolsos siempre en RD$. Con curso de US$ 200 pagado a tasa 60, RD$ 150 se acepta como US$ 150 y el reverso sale 37,50 en vez de ~0,63.
- **Media:** redondeo por pago (`gv-incentives.ts:~70-75`): tres pagos de 18.333,33 sobre 55.000 dan 999,99 y el 100 % nunca se alcanza.
- **Baja:** `mes()` usa UTC (`gv-incentives.ts:38`); el orden de pagos del mismo día (`:52`) depende del orden de la base.
- Seguridad: sin regresión. Pruebas que faltan: anulación seguida de reemplazo, reembolso parcial proporcional (la prueba actual reembolsa el total), reembolso en curso US$, reparto en tres partes, empate de día y frontera de mes.

### 2. claude-pc/fix-dinero — NECESITA CAMBIOS (menor)
- **Media (GV):** `gv-money.ts:393-417` fija `currency: "USD"` sin validar el método. `GV_METHODS` incluye transferencia y tarjeta; un curso en RD$ con transferencia en USD a tasa 60 se guarda como US$ (amountDop 6000). `GV.md:102` lo documenta como permitido. **Decisión de la dueña:** ¿H-01 cubre GV?
- **Baja:** doble redondeo en incentivos (`incentives.ts:93-99` y `:326-329`): tasa 0,015 deja 0,01 + 0,01 = 0,02 contra 0,015 exacto.
- **Baja:** comentario de prueba en `tests/dinero-1nov.test.ts` («0,004 → 0,00») engaña.
- H-04 completo en el punto de cálculo (`packages/shared/src/index.ts:333-338`). H-08 completo (clamp en `incentives.ts:310` y `:495-500`). H-01 completo en servidor (`sales.ts:488-493`, refine en shared, CHECK de migración 202610250301).
- Seguridad: sin regresión.

### 3. claude-pc/fix-seg-menor — NECESITA CAMBIOS (menor, sin bloqueo de seguridad)
- **Media (regresión):** H-15 pone 120 s desde el inicio del fetch (`apps/web/src/api.ts:550`) y el cuerpo se lee después (`:565`). Descargas grandes lentas se cortan con mensaje en inglés. Hay que limpiar el temporizador al llegar las cabeceras.
- **Media (inconsistencia):** H-05 endurece `drive-backup-core.ts:116-121`, pero `scripts/decrypt-backup.mjs:50-55` sigue con 20/16/4. La herramienta de recuperación acepta lo que la app rechaza. Los respaldos existentes siguen restaurando (SCRYPT {15,8,1}).
- H-03 completo en correo y Telegram; quedan sin escapar solo las alertas internas (`cash.ts:1372`, `offline-sale-review.ts:187-188`), que no salen a esos canales.
- H-07 sin cambio de comportamiento. H-16 y H-17 sin problema.
- Pruebas: la mayoría son búsquedas de texto, no ejecución (H-03, H-15, H-16, H-17).

### 4. claude-pc/anim-reportes — NECESITA CAMBIOS (pequeño) + DECISIÓN
- **Decisión de la dueña:** la animación está en `MonthReport.tsx` (reporte de ventas con «Venta bruta», «Ganancia neta», margen; líneas 172-188, 211-213, 274-306). No es caja ni POS por nombre, pero la orden 98 excluye las «pantallas de dinero». ¿Entra o no?
- **Baja-media:** el escalonado usa ms fijos en `animation-delay` (`styles.css:6686-6716`); la orden pide solo `--nx-dur-*`. La prueba no lo detecta. El resumen dice «duraciones de tokens», lo que sobrestima.
- Usa solo opacidad y transform, respeta `prefers-reduced-motion` (`styles.css:6724-6737`). No toca `formatMoney`.
- Afirmaciones del resumen sin verificar desde git: conteos de pruebas, `pre-empuje`, CI en success.

## Mezcla de fix-ci-mes

No se hizo. `fix-ci-mes` solo trae la causa 1 (ya en `4f994d7b`). La causa 2 (fechas de devolución) espera la decisión de la dueña entre opción A (cambia cifras del desglose) y opción B (cambia la fixture de prueba). Sin esa decisión no hay arreglo que mezclar.

## Prueba de acceso (orden 108)

Variables `NEXORA_CLAUDE_USER` y `NEXORA_CLAUDE_PASSWORD` no definidas en la laptop. Según orden 109 están en el entorno de la nube: la prueba se corre desde una sesión de la nube. Informe local en `claude-pc/prueba-acceso` (18cb77ce).

## Pendientes para Norexos 1

1. Decidir la causa 2 del CI rojo (A o B).
2. Corregir gv-incentivos (anulación y reembolso en RD$) antes de mezclar.
3. Decidir si H-01 cubre GV (fix-dinero).
4. Decidir si MonthReport cuenta como pantalla de dinero (anim-reportes).
5. Corregir H-15 y el límite de scrypt en decrypt-backup (fix-seg-menor).
