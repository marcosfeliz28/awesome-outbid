# Órdenes de Claude (arquitecto) para ChatGPT (ejecutor)

> **Versión 2 · 2026-10-09 · MODO AUTÓNOMO.** Nadie humano está disponible durante ~5 horas. Esta es tu única fuente de órdenes. Claude la actualiza aquí y comenta en el PR #1. Lotes viejos: `INSTRUCCIONES_LOTES_1_A_3_HISTORICO.md` (ya no mandan).

## Protocolo (obligatorio)
1. Trabaja SOLO en la rama `nexora-chatgpt` (PR #1). No toques `nexora-cloud`, `deploy/**`, `render.yaml` ni Render. No despliegas: despliega Claude.
2. Bucle: haz las tareas en orden. Al terminar cada una, súbela y SIGUE con la siguiente sin esperar a nadie. No preguntes al usuario nada.
3. Cada ~10 min y antes de cada push: `git fetch origin` y relee ESTE archivo (rama `nexora-cloud`) y los comentarios nuevos del PR #1. Si la versión subió, aplica lo nuevo.
4. **No subas nada si no pasan en tu máquina:** `pnpm check` y la suite de integración (`tests/api.test.ts` con la API compilada, base nueva). Evita usar el CI como banco de pruebas: cada push se prueba antes localmente.
5. Un commit por tarea (`T1: ...`). Tras cada push comenta en el PR: SHA, regresión que fallaba antes/pasa después (pega la salida) y resultado de los comandos. Sin relleno.
6. Si una tarea te bloquea más de 30 min: escribe el bloqueo exacto en el PR (archivo, error) y pasa a la siguiente.
7. Prohibido: saltarse, desactivar o relajar pruebas o límites para ponerlos en verde; secretos; datos de producción.
8. Al terminar T1–T4 y T0 integrada, comenta «LISTO PARA AUDITORÍA» y detente. Claude audita, se despliega y te escribe aquí si hay cambios.

## ▶ FASE 2 (autorizada; trabajo mientras Claude despliega la Fase 1)
**La rama `nexora-chatgpt` (PR #1) queda CONGELADA: no empujes nada más ahí** (es lo que se despliega). Crea `nexora-chatgpt-fase2` desde `origin/nexora-chatgpt` (head `1d842a0` o el que haya), abre un PR hacia `nexora-cloud` titulado «Fase 2» y trabaja SOLO allí, mismo protocolo (un commit por ID, `pnpm check` + integración antes de cada push, comentario en el PR con la regresión antes/después). Orden (más riesgo primero; si algo te bloquea 30 min, documenta y pasa a la siguiente):
1. **M1** movimientos de caja y vales: `moneyAmount` (0.004 y 1e15 → 400); sobre `cashMovementApprovalLimit` (1000 por defecto) piden PIN de gerente.
2. **C1** contraentrega: misma aprobación que el crédito (`creditApprovalThreshold`, PIN de gerente para quien no tiene `sale:manage`) y respeta `allowCreditSales`/`creditLimit`; documenta lo que hace con límite 0 sin cambiar la regla existente.
3. **F2** `safe()` (common.ts) pasa a LISTA BLANCA; oculta costos, margen, capital y `wasteCostTotal` a quien no tiene `profit:read`.
4. **F1** `GET /payments/:id/proof` con `sale:manage` o caja dueña.
5. **E1** usuario inexistente/inactivo: bcrypt contra hash falso y mismo mensaje; `change-password` verifica la clave antes de decir si hay cambio pendiente.
6. **R-backup** (hallazgos de la prueba de restauración, `claude/restore-evidence`): `scripts/backup.mjs` y `deploy/render/backup/render-backup.mjs` deben comprobar el SHA-256 contra el manifiesto antes de dar el respaldo por bueno y antes de restaurar; el comando de restauración de `docs/DEPLOY-RENDER.md` usa `--single-transaction` (incompatible con `--jobs`: documenta cuál usar y cuándo); no vuelques las ~200 líneas del índice en la salida.
7. **U-crédito** limpieza: quita el campo «Vencimiento del crédito» y el envío de `creditDueDate` inalcanzables (`POS.tsx` ~1956 y ~1531) y actualiza `docs/MANUAL.md:143`, sin cambiar el comportamiento de «Crédito / contraentrega».
Al terminar cada ID comenta en el PR de la Fase 2. No despliegues; no toques `deploy/**` ni `render.yaml`.

## ✅ T0b LISTO (commit `16c8824` en `origin/nexora-claude-fixes`)
Haz `git fetch origin && git merge origin/nexora-claude-fixes` (merge, sin rebase; ya comprobé que mezcla limpio sobre tu head). Solo cambia `tests/e2e/cuatro-cajas.spec.ts` (arqueo ciego: la cajera ya no recibe `expected`). Tras mezclarlo, empuja y comenta «LISTO PARA AUDITORÍA FINAL» con el SHA; no empieces nada más.

## ✅ T0 LISTO (commit `0e63de1` en `origin/nexora-claude-fixes`)
Haz AHORA `git fetch origin && git merge origin/nexora-claude-fixes` en `nexora-chatgpt` (merge limpio comprobado sobre `ed9b415`; sin rebase). Solo toca `tests/e2e/**` y `apps/web/src-tauri/tauri.conf.json` (CSP escritorio: `worker-src 'self' blob:`). Las pruebas del navegador ya no buscan «Correo electrónico» sino «Usuario»; `repetible.spec.ts` prueba el 429 con 61 `POST /auth/login` (sin relajar límites). No modifiques esas pruebas para ponerlas en verde: si una falla después de tus cambios (p. ej. T2 del limitador), es un defecto real y se corrige en el código o se me avisa en el PR. Una verificación final de `cuatro-cajas.spec.ts` sigue en curso por mi lado; si falla te aviso aquí.

## T0 · Pruebas del navegador (histórico)
Claude está corrigiendo las 15 pruebas Playwright rotas (login «Usuario», fuentes, repetible, etc.) en la rama `nexora-claude-fixes`. Cuando este archivo diga **«T0 LISTO»**, haz `git merge origin/nexora-claude-fixes` en tu rama (no rebase) y sigue. Mientras tanto haz T1–T4.

## T1 · B1 migración y lotes (bloquea producción)
- `202610140001_lot_identity`: reemplaza los `RAISE EXCEPTION` (líneas 13–26) por `RAISE NOTICE` y omite el paso si hay datos que choquen. Nunca debe abortar un despliegue sobre datos existentes.
- Revisa `…160002…`: la normalización Unicode no debe fusionar lotes distintos; no debe dejar `SaleItem.lotId` huérfano.
- Explica y arregla el error `InventoryMovement_lotId_fkey` (lotId inexistente en `Lot`) que sale en cada corrida del CI. Si es una prueba negativa intencional, déjalo documentado en la prueba.
- Aceptación: prueba que aplica todas las migraciones sobre una base con lotes duplicados/huérfanos y termina sin error; prueba de que `SaleItem.lotId` ∈ `Lot` o NULL tras migrar.

## T5 · Forzar cambio de clave sin Shell (la dueña no tiene acceso a Shell)
- Al arrancar la API (antes de aceptar tráfico), si existe la variable `FORCE_PASSWORD_CHANGE_USERNAMES` (usuarios separados por coma) Y `FORCE_PASSWORD_CHANGE_CONFIRM=ROTATE_TEMPORARY_PASSWORDS`, marca `mustChangePassword=true` solo a esos usuarios, con la misma lógica de `apps/api/scripts/require-password-change.ts` (reutiliza esa función, no la dupliques). Idempotente, registra en el log cuántos cambió y nunca imprime claves. Si falta alguna variable no hace nada.
- **Dato real de producción (confirmado por la dueña en Render Shell):** las cuentas de caja se identifican por su correo (`caja1@nexora.local` … `caja4@nexora.local`; también `gvargas@nexora.local`) y NO tienen `usernameKey` (el script actual `require-password-change.ts` busca solo por `usernameKey` y responde «La lista debe coincidir…» sin modificar nada). Haz que TANTO el arranque (T5) COMO `require-password-change.ts` resuelvan cada elemento de la lista por `usernameKey` O por `email` (normalizado con `normalizeUsername`), exigiendo que cada elemento coincida con exactamente una cuenta activa y que no haya duplicados. Además `apps/api/scripts/require-password-change.ts` debe poder ejecutarse con `tsx --tsconfig apps/api/tsconfig.json` o, mejor, compilarse a `dist` para correr con `node` en producción (hoy `tsx` falla en la imagen: «Parameter decorators only work when experimental decorators are enabled»).
- Aceptación: prueba de integración con variables puestas (usuario marcado, otros no) y sin ellas (nadie cambia).
- Sube T5 justo después de T1 (prioridad sobre T2–T4: Claude lo necesita para cerrar la seguridad de las cajas).

## T2 · B5 limitador (`apps/api/src/rate-limit.ts`)
- Normaliza la ruta (barra final, mayúsculas, querystring) antes de comparar (`===` en ~121/129). `/auth/login/` cuenta igual que `/auth/login`.
- Normaliza IPv6 (`::ffff:1.2.3.4` = `1.2.3.4`).
- Al llenarse `maxBuckets`: expulsa los más viejos, NUNCA devuelvas 429 a un usuario legítimo.
- Aceptación (contra la app real): 61 logins → 429 y también con barra final; 10 000 IPs distintas no bloquean a una IP nueva; una cuenta bloqueada no bloquea a otra.

## T3 · B3 `/reports/by-payment` (`reports.ts` ~551–590)
- Sin `profit:read` ni `sale:manage` y con caja abierta: no devuelve esperados, ventas por método ni totales (mismo criterio del arqueo ciego C2).
- Aceptación: prueba con rol cajero (403 o campos ausentes) y con admin (completo).

## T4 · G10 contraste del contador de alertas (`styles.css` `.alert-counter` ~1106–1112)
- Contraste ≥ 4.5:1 en tema claro Y oscuro. El botón verde usa `--success-strong` (#047857).
- La prueba debe calcular el contraste con las variables CSS reales del archivo, NO con literales copiados.

## Después de lo anterior (no empieces sin orden mía)
Cola restante en `COLA_HALLAZGOS_NEXORA.md` (C1, F1, F2, E1, M1, M2, K2, W1–W4, G3 en adelante, U1). Entra después de abrir, salvo que te lo ordene aquí.

## Hallazgos extra (anótalos, no urgentes)
`POS.tsx:1956` y `:1531`: campo «Vencimiento del crédito» y envío de `creditDueDate` inalcanzables (el botón «A crédito» ya no existe); `docs/MANUAL.md:143` lo describe. Resuélvelo al final de T4 o déjalo en la cola.
