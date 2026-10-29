# Tablero Norexos v2 (lo mantiene Norexos 5; estados: pendiente · en curso · bloqueado · hecho · fuera de v1)
Última actualización: 29-oct-2026, 13:45 UTC (ajustes de Norexos 1). Detalle en `docs/coordinacion/ESTADO_DIRECTOR.md`.

| ID | Tarea | Etapa | Responsable | Estado | Bloqueo / siguiente paso |
|---|---|---|---|---|---|
| T01 | Decisiones D1, D2, D5, D6, D7 (vía Norexos 1) | E0 | Dueña | pendiente | Plazo 30-oct. D5 resuelto (tickets después del cambio de nombre) |
| T02 | Registrar norexos.ai y norexos.com | E0 | Dueña | pendiente | Con verificación en dos pasos. Necesario para la landing (E5) |
| T03 | Abogado de marca | — | — | fuera de v1 | Retirado del alcance v1 (29-oct). Norexos 1 lo plantea a la dueña |
| T04 | GV «Cambiar fecha/curso» | E0 | Taller → Norexos 1 | en curso | Rama `claude/taller-gv` 280f2e0f; falta D1, 3 CI y «cajas cerradas» |
| T05 | Diagnóstico completo + qué falta para vender | E0 | Taller | en curso | Documento en `claude/taller-estado` 796d573c |
| T06 | Cambio de nombre en código | E1 | Taller | en curso | Asignado por Norexos 1. Rama `claude/taller-marca` (no `marca/cambio-nombre`, por los límites del Taller). Entrega 2-nov con 3 CI verdes del SHA exacto |
| T07 | Cola de Forja (14 piezas) y de Brazo (bloques 3–5) | E1–E4 | Norexos PC | en curso | Laptop activa desde 13:02 UTC; piezas 1 y 2 de Forja hechas (`claude-pc/forja-noche`). E1 ya no es suya |
| T08 | Conectar animaciones y F2-03/F3-01 | E2 | Taller; ChatGPT desde 2-nov | pendiente | Entrega 7-nov. Piezas en `producto-nexora` ef063f6a (parcial: 6 de 12 primitivos Nx*) |
| T09 | Instalador vendible (licencia/activación, actualización, respaldo local; firma si D7) | E3 | Norexos PC (licencia y actualización, `claude-pc/instalador-e3`) + Taller + Revisor | pendiente | Entrega 10-nov. Depende de D7, de T05 y de la decisión de T21 |
| T10 | Español/Inglés | E4 | Taller + Forja + Brazo | pendiente | Entrega 12-nov. Plan en `docs/coordinacion/PLAN_INTERNACIONAL_28OCT.md` |
| T11 | Precios (D2) | E8 | Dueña vía Norexos 1 | pendiente | Al final del plan. Cobro (Azul) fuera de v1 |
| T12 | Términos y privacidad | — | — | fuera de v1 | Retirado del alcance v1 (29-oct) |
| T13 | Tickets «Pedir un cambio» | E6 | Taller | pendiente | Entrega 14-nov. Empieza después de T06 |
| T14 | Traspasos, cuadres y verificación de transferencias del 25-oct | — | Norexos 2 | bloqueado | Norexos 2 pide a la dueña: confirmar anulación de FS-8 (Pérez Sosa) y decir si FS-77 (Robert Junior Bertre) se pagó en efectivo o transferencia, o si es prueba para anular. Además, movimientos bancarios del 25-oct |
| T15 | Piloto cerrado | E7 | Dueña | pendiente | 15–21 nov. Elegir 1–2 clientes (D6) |
| T16 | Sesión de Norexos 1 (despliegue) | E0 | Norexos 1 | hecho | Norexos 1 confirma que su cuota se renovó hoy a las 7:00 (RD); no vence. Riesgo retirado |
| T17 | Permiso pendiente en la sesión del Revisor | E0 | Dueña / Norexos 1 | bloqueado | La sesión Norexos 4 espera aprobar o rechazar un permiso. Sin eso, sus auditorías llegan solo por archivo |
| T18 | Landing y dominio norexos.ai | E5 | Taller (textos) + dueña (dominio) | pendiente | 8–12 nov. Depende de T02 |
| T19 | Lanzamiento controlado | E8 | Dueña + Norexos 1 | pendiente | 24-nov (mejor caso 18-nov). Checklist firmada |
| T20 | Skill `mattpocock/skills@wayfinder` (propuesta) | E0 | Norexos 1 | hecho | Instalada por Norexos 1 en su propia sesión, auditada por Norexos 1 (commit a496f55, solo texto). Reportado por Norexos 1; no es auditoría del Revisor. Norexos 5 no instala skills |
| T21 | Licencia (suscripción o por PC) y actualización simple (reinstalar encima) | E3 | Norexos PC, rama `claude-pc/instalador-e3` | bloqueado | Espera decisión de la dueña sobre el modelo de venta y de actualización. Norexos 1 lo plantea a la dueña |
| T22 | Instalar en la laptop: Karpathy, Agent Skills, Superpowers, ECC (órdenes 32 y 33) | E0 | Norexos PC | bloqueado | Norexos 1 no las instala sin auditoría del Revisor. El Revisor está bloqueado (T17). Decisión pendiente: la dueña aprueba instalar sin auditoría, o se desbloquea el Revisor. Norexos 1 lo plantea a la dueña |
