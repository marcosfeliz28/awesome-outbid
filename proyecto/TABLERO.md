# Tablero Norexos v2 (lo mantiene Norexos 5; estados: pendiente · en curso · bloqueado · hecho · fuera de v1)
Última actualización: 29-oct-2026, 13:45 UTC (ajustes de Norexos 1). Detalle en `docs/coordinacion/ESTADO_DIRECTOR.md`.

| ID | Tarea | Etapa | Responsable | Estado | Bloqueo / siguiente paso |
|---|---|---|---|---|---|
| T01 | Decisiones D1, D2, D5, D6, D7 (vía Norexos 1) | E0 | Dueña | pendiente | Plazo 30-oct. D5 resuelto (tickets después del cambio de nombre) |
| T02 | Registrar norexos.ai y norexos.com | E0 | Dueña | pendiente | Con verificación en dos pasos. Necesario para la landing (E5) |
| T03 | Abogado de marca | — | — | fuera de v1 | Retirado del alcance v1 (29-oct). Norexos 1 lo plantea a la dueña |
| T04 | GV «Cambiar fecha/curso» | E0 | Taller → Norexos 1 | en curso | Rama `claude/taller-gv` 280f2e0f; falta D1, 3 CI y «cajas cerradas» |
| T05 | Diagnóstico completo + qué falta para vender | E0 | Taller | en curso | Documento en `claude/taller-estado` 796d573c |
| T06 | Cambio de nombre en código | E1 | Taller | hecho | En vivo desde 15:23 UTC (29-oct) en el producto: `producto-nexora` 58f7fb65, 3 CI verdes del SHA exacto, API y web. Tienda no tocada. Carpeta de Drive corregida a «Nexora POS respaldos» (80c47980) |
| T07 | Cola de Forja (14 piezas) y de Brazo (bloques 3–5) | E1–E4 | Norexos PC (sesión «Claude PC») | en curso | Trabajo en ramas `claude-pc/b9-50-*` (último grupo-3 b4c5ac1a, 19:32 UTC) y `claude/forja2-final` d6adc554 (21:16 UTC, Forja 2: F2-01 a F2-10 en producto). Cola: tarea 50 (Forja, grupos 1–3, en CI) y 56 (pruebas límite). Bloque 10 hecho. El cuello de botella es Norexos 1 (CI de ~35 min); prueba e2e inestable arreglada en 8a94a996. Corrección: la alerta de bloqueo de las 20:12 UTC fue error mío (miré la rama equivocada) |
| T08 | Conectar animaciones y F2-03/F3-01 | E2 | Taller; ChatGPT desde 2-nov | pendiente | Entrega 7-nov. Forja 2 final (F2-01 a F2-10) en `producto-nexora` d6adc554 (21:16 UTC). Piezas previas en ef063f6a (parcial: 6 de 12 primitivos Nx*) |
| T09 | Instalador vendible (licencia/activación, actualización, respaldo local; firma si D7) | E3 | Norexos PC (licencia y actualización, `claude-pc/instalador-e3`) + Taller + Revisor | pendiente | Entrega 10-nov. Depende de D7, de T05 y de la decisión de T21 |
| T10 | Español/Inglés | E4 | Taller + Forja + Brazo | en curso | Selector ES/EN en vivo en la web del producto desde 17:45 UTC (`producto-nexora` 92f77795), con 3 CI verdes según Norexos 1. Entrega 12-nov. Plan en `docs/coordinacion/PLAN_INTERNACIONAL_28OCT.md` |
| T11 | Precios (D2) | E8 | Dueña vía Norexos 1 | pendiente | Al final del plan. Cobro (Azul) fuera de v1 |
| T12 | Términos y privacidad | — | — | fuera de v1 | Retirado del alcance v1 (29-oct) |
| T13 | Tickets «Pedir un cambio» | E6 | Taller | en curso | API en vivo (`producto-nexora` d3acef4f, migración 202611050001, rutas `/api/change-requests`). El commit 92f77795 dice «tickets publicados»; web en despliegue por confirmar. Entrega 14-nov |
| T14 | Traspasos, cuadres y verificación de transferencias del 25-oct | — | Norexos 2 | bloqueado | Norexos 2 pide a la dueña: confirmar anulación de FS-8 (Pérez Sosa) y decir si FS-77 (Robert Junior Bertre) se pagó en efectivo o transferencia, o si es prueba para anular. Además, movimientos bancarios del 25-oct |
| T15 | Piloto cerrado | E7 | Dueña | pendiente | 15–21 nov. Elegir 1–2 clientes (D6) |
| T16 | Sesión de Norexos 1 (despliegue) | E0 | Norexos 1 | hecho | Norexos 1 confirma que su cuota se renovó hoy a las 7:00 (RD); no vence. Riesgo retirado |
| T17 | Permiso pendiente en la sesión del Revisor (Norexos 4) | E0 | Dueña | bloqueado | Ya no bloquea instalaciones. Sí bloquea la verificación de `docs/coordinacion/REPARTO_B9.md` y `DICTAMEN_PC.md` (T24). Espera permiso de la dueña |
| T18 | Landing y dominio norexos.ai | E5 | Taller (textos) + dueña (dominio) | pendiente | 8–12 nov. Depende de T02 |
| T19 | Lanzamiento controlado | E8 | Dueña + Norexos 1 | pendiente | 24-nov (mejor caso 18-nov). Checklist firmada |
| T20 | Skill `mattpocock/skills@wayfinder` (propuesta) | E0 | Norexos 1 | hecho | Instalada por Norexos 1 en su propia sesión, auditada por Norexos 1 (commit a496f55, solo texto). Reportado por Norexos 1; no es auditoría del Revisor. Norexos 5 no instala skills |
| T21 | Licencia (suscripción o por PC) y actualización simple (reinstalar encima) | E3 | Norexos PC, rama `claude-pc/instalador-e3` | bloqueado | Diagnóstico listo (a8d9b8c4, 14:02 UTC). Norexos 1 confirma a las 16:58 UTC que las 4 decisiones siguen pendientes de la dueña. Faltan: modelo de licencia (suscripción o por PC), si reinstalar basta para actualizar, compra del certificado de firma (D7), y prueba en PC limpia. Norexos 1 las plantea a la dueña |
| T23 | Selector ES/EN del Taller (`claude/taller-i18n-selector`) | E4 | Taller | hecho | Entregado por el Taller. Los SHA 33c0f4cc y 7e80dfae eran commits intermedios del renombre, superados por 58f7fb65 (verde) |
| T24 | Reparto de la laptop: `docs/coordinacion/REPARTO_B9.md` y `DICTAMEN_PC.md` | E1–E4 | Norexos 4 (verifica) | bloqueado | Norexos 4 debe verificarlo. Bloqueado por el permiso de la dueña (T17) |
| T25 | Skills de Matt Pocock en `.claude/skills/` (tdd, diagnosing-bugs, domain-modeling, research, handoff, writing-for-agents, pr, codebase-design) | E0 | Norexos 1 | hecho | Archivos reales en `nexora-cloud` 5aedea50 (0 enlaces rotos). Se usan solo si la tarea las pide. Norexos 5 solo lee, no instala |
| T22 | Instalaciones de skills (órdenes 32 y 33) | E0 | Norexos 1 y Taller | en curso | Norexos 1, por orden directa de la dueña: `wayfinder` y `karpathy-guidelines` (commit 2c60614), solo texto, instaladas. Agent Skills (eb07f19, solo skills, sin hooks) y ECC (aislado, solo markdown, sin hooks, MCP ni scripts) delegadas al Taller con esas restricciones. Superpowers no se toca (ya existía). Pendiente: el Taller reporta cuando termine |

## Estado de sesiones (29-oct-2026, 20:34 UTC)
Ociosa = sin actividad de sesión en 60 min. Ninguna cumple ese criterio hoy.

| Sesión | Qué hace ahora | Rama / SHA | Último commit o mensaje (UTC) | Estado |
|---|---|---|---|---|
| Norexos 1 · Software (cerebro) | Decide, mezcla y despliega; CI | `nexora-cloud` 5aedea50; `producto-nexora` 8a94a996 | 20:33 (skills reales); 19:41 (prueba G9 corregida) | trabajando |
| Norexos 2 · Mercancía | Inventario y cajas; reporta a Norexos 1 | sin rama de código | mensajes 15:44 | trabajando |
| Norexos 3 · Taller | E1 entregado; tickets; selector ES/EN; partes de E2/E3 | `claude/taller-marca` 58f7fb65; `claude/taller-tickets` d3acef4f; `claude/taller-i18n-selector` 92f77795 | 14:34 (marca); 15:40 (tickets) | revisión lista desde 20:37 UTC, sin tarea nueva asignada; el bloqueo de mensajería ya no aparece en su estado |
| Norexos 4 · Revisor | Auditorías; veredicto de wayfinder | `claude/revisor-plugins` 866d3989 | 20:25 | revisión lista desde 23:07 UTC; última entrega `claude/revisor-plugins` fbfefb94 (22:09): autorización permanente de la dueña para la cola local (lectura). Norexos 5 no ejecuta plugins |
| Norexos 5 · Director | Tablero y revisiones | `control/norexos` d57ce25a; `claude/director` | 20:33 | trabajando |
| Claude PC (laptop) | Forja 50: grupos 1–3 y rama final | `claude-pc/b9-50-grupo-1` e49709ec; `-grupo-2` 33dc20dd; `-grupo-3` b4c5ac1a; `claude/forja-final` 1c19e225 | forja-final 20:21; grupo-3 19:32 | trabajando |
| Fork («Sesión local») | Diagnóstico de E3 (licencia y actualización) | `claude-pc/instalador-e3` a8d9b8c4 | diagnóstico 14:02 | bloqueado: espera 4 decisiones de la dueña (E3) |

**Riesgos para el 24-nov:**
1. Taller sin mensajería desde 15:23 UTC: aprobación de la dueña.
2. E3 sin decisiones (modelo de licencia, actualización, firma D7, prueba en PC limpia): bloquea el instalador.
3. Cuello en CI de Norexos 1 (~35 min por corrida) para Forja y B9.
4. T02 (registro de norexos.ai) sin hacer: bloquea la landing (E5, 8–12 nov).
5. Revisor pide acción manual de la dueña para un plugin; hay que decidir si aplica.
