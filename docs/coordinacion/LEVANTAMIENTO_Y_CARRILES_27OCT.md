# Levantamiento, autoauditoría y carriles de trabajo (Nexora 1, 27-oct-2026, noche)

Pedido de Claude PC por orden de la dueña («llevar la producción al límite»). Base: `AUDITORIA_TOTAL_27OCT.md`, `PLAN_MAESTRO_POR_FASES_27OCT.md`, `PLAN-10-MEJORAS-PRODUCTO.md`, `PENDIENTES_27OCT.md`, informes de QA y de Claude PC. Lo que no pude confirmar va marcado «sin confirmar». **Todos: sin desplegar, sin Render, sin credenciales, sin mezclar en `producto-nexora`/`nexora-cloud`; Nexora 1 revisa y mezcla con 3 CI en verde (`verify`, `windows-installer`, `render-images`). Una rama por pieza, prueba que falle antes y pase después. `LISTA: <rama> <commit>` al terminar.**

## 1. Estado de hoy (hecho y en vivo)
Producto en vivo con 1a04cd33: portada «N grande», resumen diario con consentimiento, PC-23, A1, B-01 (bandera encendida) e ITBIS en una sola regla. Mezclado esperando CI: fase 3 y 4 de ChatGPT nube (78888542, producto) y B-01 de la tienda (3a6096fb, `nexora-cloud`, bandera apagada).

## 2. Carriles y propiedad de archivos (para que nadie se pise)
| Carril | Dueño | Archivos que SOLO este carril toca |
|---|---|---|
| **V · Visual** | ChatGPT PC (chat principal) | `apps/web/src/styles.css`, `App.tsx`, `Dashboard.tsx`, `ExecutiveDashboard.*`, `Assistant.*`, `POS.tsx`, `packages/ui/*`, `apps/web/public/*`, `docs/diseno/*` |
| **M · Mercancía-salida** | ChatGPT PC (chat `mercancia-salida-fix`) | `apps/web/src/Merchandise.tsx`, `tests/e2e/store.spec.ts`, `tests/accessibility-contract.test.ts` (solo las líneas de «SALIDA») |
| **T · Pruebas y CI** | ChatGPT nube | `tests/e2e/*` (menos `store.spec.ts`), `tests/*postgres*`, `vitest.config.ts`, `playwright.config.*` |
| **S · SaaS** (registro, planes, respaldo, marca) | ChatGPT nube | `apps/api/src/platform*.ts`, `registration*`, `apps/web/src/Registration.tsx`, `Onboarding.tsx`, `productTenancy.ts`, `product-branding.ts`, `apps/web/scripts/*` |
| **I · IA** | ChatGPT nube (segundo chat) | `apps/api/src/assistant*.ts`, `daily-summary.ts`, `apps/api/src/ai-*.ts`, `QuickQuestions.tsx` |
| **D · DGII/contador** | ChatGPT PC (chat nuevo, fase 5) | ARCHIVOS NUEVOS `apps/api/src/dgii-606.ts`, `dgii-607.ts`, `it1.ts`, `apps/web/src/Dgii*.tsx`; no toca `reports.ts` salvo registrar rutas |
| **Q · QA y seguridad** | Claude PC + agentes | `docs/qa/*`, `docs/seguridad/*`, ramas `claude-pc/*`; código solo en `apps/api/src/platform.ts` (AT-06, tras decisión) y los archivos de los hallazgos bajos |
| **W · Instalador Windows** | ChatGPT PC (chat del instalador) | `apps/desktop/*`, `installer/*`, `scripts/*windows*`, `.github/workflows/*` (solo el del instalador) |
| **Nexora 1** | yo | despliegue, mezclas, `docs/coordinacion/*` |
**Regla de choque:** `App.tsx` y `styles.css` son SOLO de V; si otro carril necesita un cambio ahí, lo pide por escrito en `docs/coordinacion/PEDIDOS_A_V.md` y V lo integra. `reports.ts`, `cash.ts`, `sales.ts` (dinero) no se tocan sin decisión escrita de la dueña.

## 3. Lista por carril, con prioridad y texto exacto
### V · Visual (ChatGPT PC) — ALTA
1. Terminar `visual-integracion-27oct`: commit final con `verify` en verde (hoy 2a0beec6 está rojo por la prueba de «SALIDA»; la corrige el carril M). Rebasar sobre `producto-nexora` (1a04cd33 o más nuevo).
2. Tras el informe de Gemini (`AUDITORIA_GEMINI_VISUAL_27OCT.md`): fase 2 de diseño premium (movimiento, profundidad, carga por partes; peso de JS < 2 MiB).
> **Texto:** «Carril V. Tu rama `chatgpt-pc/visual-integracion-27oct` debe quedar con `verify` en verde en el commit final y rebasada sobre `producto-nexora`. Solo tú tocas `styles.css`, `App.tsx`, `Dashboard.tsx`, `ExecutiveDashboard.*`, `Assistant.*`, `POS.tsx` y `packages/ui`. No cambies flujos, F2/F4/F8/F12, caja ciega, pagos ni ITBIS. Escribe `LISTA: <rama> <commit>` en `docs/diseno/OBSIDIAN_LUMINA_PROGRESO.md`. No despliegues ni toques Render.»
### M · Mercancía-salida (ChatGPT PC, chat nuevo) — ALTA
1. Alinear `tests/e2e/store.spec.ts:901-902` y `accessibility-contract:528-531` con `Merchandise.tsx:665-678` (`role=group` + `aria-pressed`), sin perder la comprobación de que «SALIDA» sea un control accesible y esté activo.
> **Texto:** «Carril M. En rama `chatgpt-pc/mercancia-salida-fix` desde `producto-nexora`: haz que la prueba de «SALIDA» compruebe lo mismo que antes contra el control real (grupo de botones con `aria-pressed`), sin debilitarla. Solo tocas `Merchandise.tsx`, `store.spec.ts` y las líneas de «SALIDA» de `accessibility-contract`. 3 CI y `LISTA:`.»
### T · Pruebas y CI (ChatGPT nube) — ALTA
1. AT-04: la ruta se recorta a 320 px (PR #16/#11/#13/#14, ya integradas en visual: verificar). 2. AT-11: prueba PostgreSQL que agota tiempo bajo carga. 3. Cerrar PR #15 como duplicado de B-01. 4. Mock de Google Drive de Configuración (`missing.join()`).
> **Texto:** «Carril T. Estabiliza AT-11 y el mock de Google Drive de Configuración; verifica AT-04 sobre `producto-nexora`; cierra el PR #15. Solo `tests/e2e/*` (menos `store.spec.ts`), `tests/*postgres*` y `vitest.config.ts`. 3 CI y `LISTA:`.»
### S · SaaS (ChatGPT nube) — ALTA para vender
1. Registro público cerrado por bandera + prueba de abrirlo y cerrarlo. 2. Planes y límites. 3. Respaldo/exportación por empresa (ya hay base). 4. Quitar Macgen del producto (fase 4: el verificador ya existe; falta ticket/RNC/bancos si quedan: sin confirmar). 5. Aislamiento entre empresas: prueba de regresión. 6. Cobro real: depende del procesador que la dueña abra.
> **Texto:** «Carril S. Fase 3 y 4 del plan maestro: planes y límites, respaldo por empresa, quitar rastros de Macgen del producto (ticket, RNC, bancos), con pruebas. Solo `platform*.ts`, `registration*`, `Registration.tsx`, `Onboarding.tsx`, `productTenancy.ts`, `product-branding.ts`. Nada de dinero real. 3 CI y `LISTA:`.»
### I · IA (ChatGPT nube, chat 2) — MEDIA
1. «Pregúntele a Nexora»: consultas por plan (30/50/300, decisión de la dueña pendiente). 2. Resumen diario: ya con consentimiento. 3. Conector MCP/OAuth del cliente (solo lectura primero). 4. AT-08 modelo de facturas: **bloqueado** (necesita llave y autorización de la dueña).
> **Texto:** «Carril I. Implementa los límites de consultas por plan para «Pregúntele a Nexora» (con prueba) y el conector MCP en solo lectura. Solo `assistant*.ts`, `daily-summary.ts`, `ai-*.ts`, `QuickQuestions.tsx`. No envíes datos reales a servicios externos. 3 CI y `LISTA:`.»
### D · DGII/contador (ChatGPT PC, chat nuevo) — MEDIA
606, 607, 608 e IT-1; aviso de secuencias NCF por agotarse. La e-CF sigue **pausada** y no se programa. Nada que permita dejar ventas fuera de la DGII.
> **Texto:** «Carril D. Crea el reporte 606 (ARCHIVOS NUEVOS `dgii-606.ts` y pantalla), luego 607/608 e IT-1, con prueba y un ejemplo para que el contador de la dueña lo valide. No toques `reports.ts` salvo registrar rutas. No e-CF. 3 CI y `LISTA:`.»
### Q · QA y seguridad (Claude PC + agentes) — ALTA/MEDIA
1. 4 hallazgos bajos del QA (`claude-pc/qa-bajos`, en curso). 2. AT-06 (diseño listo; código tras decisiones D1–D8 de la dueña). 3. AT-07 (texto FitStore del instalador). 4. AT-09 y AT-08 (ver I). 5. Verificación en vivo del producto: necesita Playwright (ya no disponible en esa sesión) y una empresa de prueba creada por la dueña.
> **Texto:** «Carril Q. Termina `qa-bajos`. AT-06: no escribas código hasta tener D1–D8 de la dueña. AT-07: quita el texto FitStore del instalador y del producto (con prueba). Solo `docs/qa/*`, `docs/seguridad/*`, `platform.ts` y los archivos de los hallazgos.»
### W · Instalador (ChatGPT PC, chat del instalador) — MEDIA
Prueba física pendiente (necesita el «sí» de la dueña y la laptop libre). Hasta entonces: tildes, contraseña local 4–20, pruebas del instalador en CI.

## 4. Lo que hace Nexora 1 (hasta el jueves)
Mezclar y desplegar lo que llegue con `LISTA` + 3 CI verdes y sin dinero; B-01 de la tienda (cajas cerradas + OK de la dueña); relevo del despliegue (quién queda con las llaves); recrear rutinas.

## 5. Decisiones de la dueña que aún destraban carriles
Reglas de consulta por plan (I), D1–D8 de AT-06 (Q), procesador de pago (S), «sí» del instalador (W), relevo del jueves (Nexora 1), tarjeta de Lizbeth (Mercancía), OpenSEO.

## 6. Para abrir más sesiones sin pisarse
Cada sesión nueva toma UN carril de la tabla de la sección 2 y su propia rama `claude-pc/<carril>-<tema>` o `chatgpt-*/<carril>-<tema>`. Si dos carriles necesitan el mismo archivo, se escribe en `PEDIDOS_A_V.md` o se espera a que el dueño del carril mezcle primero.
