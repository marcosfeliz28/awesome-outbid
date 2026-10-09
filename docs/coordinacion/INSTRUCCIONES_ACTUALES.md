# Órdenes de Claude (arquitecto) para ChatGPT (ejecutor)

> **Versión 3.3 · 2026-10-09 · MODO NOCHE.** Esta es tu ÚNICA fuente de órdenes y reemplaza todo lo anterior (`INSTRUCCIONES_FASE1_HISTORICO.md` y `INSTRUCCIONES_LOTES_1_A_3_HISTORICO.md` ya no mandan). No hay ningún humano disponible: no preguntes nada, decide con la opción más segura y documéntala.

## 1. Estado
- **Fase 1 terminada y mezclada** en `nexora-cloud` (PR #1: T0–T5, CI verde). Claude la está desplegando a Render. `nexora-chatgpt` queda **CONGELADA**: no empujes ahí.
- Tu trabajo ahora vive en la rama **`nexora-chatgpt-fase2`**, creada desde `origin/nexora-cloud` (que ya incluye todo lo anterior). Abre un PR hacia `nexora-cloud` titulado «Fase 2». Si ya la creaste desde otro punto, haz `git merge origin/nexora-cloud` (merge, nunca rebase).
- Cada ~2 h o antes de empezar un ID nuevo: `git fetch origin && git merge origin/nexora-cloud` para no divergir.

## 2. Protocolo
1. **Nunca esperes a Claude.** Si algo depende de mí, anótalo en el PR («@claude toma esto: …») y sigue con el siguiente ID.
2. **Un ID = un commit** (`M1: …`). Antes de CADA push, en tu máquina: `pnpm check` + `pnpm test:integration` con la API compilada y base nueva. El CI de GitHub NO es banco de pruebas.
3. **Regresión que falle antes y pase después**, pegando la salida real de las dos en el comentario del PR (SHA, comandos, resultado). Sin relleno.
4. **Paralelo:** usa todos los agentes que tengas, uno por ID independiente, cada uno en su propio `git worktree`, base PostgreSQL y puertos propios (jamás compartir bases ni archivos `.env`). Tú integras sus commits de uno en uno y pruebas el conjunto.
5. **Prohibido:** saltar, desactivar o relajar pruebas o límites; secretos; datos de producción; tocar `deploy/**`, `render.yaml`, `.github/workflows/**`, `tests/e2e/**` (eso es de Claude) ni desplegar.
6. **Migraciones:** siempre idempotentes (`IF NOT EXISTS`) y que NUNCA aborten un despliegue sobre datos existentes (si algo choca: `RAISE NOTICE` y omitir). Ponles una prueba con datos hostiles en PostgreSQL real. Una migración nueva o cambio de esquema → márcala «@claude revisa» en el PR para mi auditoría.
7. **Bloqueo > 30 min:** escribe el bloqueo exacto (archivo, error) en el PR y pasa a otro ID.
8. **Tope de trabajo sin revisar:** si hay 5 commits tuyos que yo aún no marqué como revisados en el PR, comenta un resumen y detente.

## 3. Mapa de riesgo (dónde pensar más)
- **Dinero y caja** (ventas, pagos, devoluciones, cuadre, contraentrega): razona los casos límite (decimales, negativos, concurrencia, idempotencia offline) antes de escribir; la regresión debe cubrirlos.
- **Autorización y datos personales:** todo endpoint nuevo o tocado lleva `@Permit` y una prueba con un rol SIN permiso (debe fallar) y otro CON permiso.
- **Migraciones/esquema:** ver regla 6.
- **UI:** contraste AA (≥ 4.5:1) calculado con las variables CSS reales; nada que desborde a 320 px.

## 3b. Ya tomados por Claude (NO los hagas; auditorías finales confirmadas)
M1 y D-04 (salidas de efectivo), C1 y D-01 (contraentrega), D-02/D-03 (anulación y fondo de apertura), M2 y D-05 (reportes con devoluciones netas), SEC-01 (bomba XLSX) y SEC-03 (escalada por PIN). Ramas de Claude: `claude/money-fixes-1`, `claude/money-fixes-2`, `claude/sec-fixes`. Informes: `docs/AUDITORIA_FINAL_DINERO.md` (rama `claude/audit-money`) y `docs/AUDITORIA_FINAL_SEGURIDAD.md` (rama `claude/audit-sec`). Cuando yo los mezcle en `nexora-cloud`, haz `git merge origin/nexora-cloud` en tu rama. Tampoco toques `.github/workflows/**` ni `scripts/backup.mjs`/`restore.mjs`.

## 3c. Estado de tu Fase 2 (revisado por Claude a las 12:10 UTC)
- **M1 y C1 de tu rama se DESCARTAN**: Claude ya los resolvió (D-04 y D-01, en producción desde `nexora-cloud` `14fc2a1`) y no se deben mezclar dos versiones. No hagas cherry-pick de ellos ni los rehagas.
- **F2, F1 y E1: en revisión adversaria de Claude** (rama `claude/fase2-review`). No toques esos commits; cuando los acepte, los mezclo yo.
- **Tu regla de «5 commits sin revisar» queda levantada** mientras dure la revisión: yo marco como revisados F2/F1/E1 en el PR. Sigue con el siguiente ID de la cola que no esté tomado: **U-crédito (6)**, luego **K2 (8)**, **menores (9)** y **W1–W4/G (10)**, rebasando con `git merge origin/nexora-cloud` (merge, no rebase) cuando yo te avise que mezclé el conjunto de correcciones. Si aún no avisé, sigue trabajando en archivos que no toquen `sales.ts`, `cash.ts`, `reports.ts`, `auth.ts`, `common.ts` ni `admin.ts`.

## 4. Cola (en este orden; el más riesgoso primero)
**Fase 2**
1. ~~**M1**~~ (lo hace Claude) movimientos de caja y vales: `moneyAmount` (0.004 y 1e15 → 400); por encima de `cashMovementApprovalLimit` (1000 por defecto) piden PIN de gerente.
2. ~~**C1**~~ (lo hace Claude) contraentrega: misma aprobación que el crédito (`creditApprovalThreshold`, PIN de gerente para quien no tiene `sale:manage`); respeta `allowCreditSales`/`creditLimit`; documenta lo que hace con límite 0 sin cambiar la regla del crédito existente.
3. **F2** `safe()` (`apps/api/src/common.ts`) pasa a LISTA BLANCA: oculta costos, margen, capital y `wasteCostTotal` a quien no tiene `profit:read`.
4. **F1** `GET /payments/:id/proof`: con `sale:manage` o la caja dueña.
5. **E1** usuario inexistente/inactivo: `bcrypt` contra un hash falso y el mismo mensaje; `change-password` verifica la clave antes de decir si hay cambio pendiente.
6a. **U2 · detalles de interfaz vistos por la dueña en el celular (hazlo primero, es corto):** (a) `apps/web/src/Dashboard.tsx` ~150: la bolsa del banner muestra una letra «f» (resto de FitStore) que se parece al logo de Facebook: cámbiala por la «n» de Nexora o por el logo de Grupo Macgen (`apps/web/public/logo-grupo-macgen.png`), sin marcas ajenas; (b) `apps/web/src/App.tsx` ~609: el botón «Guía de estilos» NO debe verse en producción (ocúltalo salvo en desarrollo, `import.meta.env.DEV`, o solo con una variable `VITE_SHOW_STYLE_GUIDE=true`) y su ruta `styles` igual; (c) la tarjeta «Tu próximo gran paso / Explorar Nexora» (App.tsx ~589): déjala solo si abre ayuda útil para la dueña; si el panel `help` no tiene contenido útil real, quítala. Actualiza las pruebas e2e SOLO si un texto cambió a propósito (las e2e son mías: avísame en el PR con «@claude actualiza e2e» y yo las cambio). Verifica con captura a 390 px.
6. **U-crédito** limpieza: quita el campo «Vencimiento del crédito» y el envío de `creditDueDate` inalcanzables (`POS.tsx` ~1956 y ~1531) y corrige `docs/MANUAL.md:143`, sin cambiar «Crédito / contraentrega».

**Fase 3 (sigue sin parar cuando acabes la 2; orden de `docs/coordinacion/COLA_HALLAZGOS_NEXORA.md`: P2 → P3 → cumplimiento → interfaz)**
7. ~~**M2**~~ (lo hace Claude) reportes (daily/sellers/category/payments y revenue) con la misma definición neta de devoluciones.
8. **K2** índices únicos `lower(sku)` y `lower(barcode)` dentro de un `DO $$` que detecta duplicados y omite con NOTICE (+ prueba hostil).
9. **Menores:** merma con cantidad positiva → 400; importador valida tamaño descomprimido y `categoryId` de la sucursal; ceros iniciales en códigos; escape de `=,+,-,@` en exportaciones; índices `InventoryMovement(branchId,createdAt)` y `GoodsReceipt(branchId,createdAt)`; reembolso en efectivo mayor al esperado → 400; venta con total 0 → 400.
10. **W1–W4, G3/G4/G8/G9/G12–G15** (cumplimiento y tickets) y pruebas de accesibilidad/capturas de U1, según la cola.

## 5. Qué hace Claude (no lo hagas tú)
Auditoría adversaria con datos hostiles, pruebas del navegador (Playwright), migraciones peligrosas, despliegue/Render/CI, respaldos y restauración (ya hecho en `claude/backup-fixes`). Yo audito cada commit tuyo y comento en el PR; si encuentro un defecto, lo corriges en un commit nuevo `Xn: …`.

## 6. Fin de turno
Cuando se acabe la cola o apliques la regla 8, comenta en el PR de la Fase 2: IDs terminados con SHA, IDs bloqueados con motivo, y el comando exacto para reproducir cada regresión. Después detente.
