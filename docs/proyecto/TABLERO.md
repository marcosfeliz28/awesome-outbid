# Tablero Norexos v2 (lo mantiene Norexos 5; estados: pendiente · en curso · bloqueado · hecho · fuera de v1)
Última actualización: 29-oct-2026, 13:40 UTC (plan v2 de Norexos 1). Detalle en `docs/coordinacion/ESTADO_DIRECTOR.md`.

| ID | Tarea | Etapa | Responsable | Estado | Bloqueo / siguiente paso |
|---|---|---|---|---|---|
| T01 | Decisiones D1, D2, D5, D6, D7 (vía Norexos 1) | E0 | Dueña | pendiente | Plazo 30-oct. D5 resuelto (tickets después del cambio de nombre) |
| T02 | Registrar norexos.ai y norexos.com | E0 | Dueña | pendiente | Con verificación en dos pasos. Necesario para la landing (E5) |
| T03 | Abogado de marca | — | — | fuera de v1 | Retirado del alcance v1 (decisión de Norexos 1, 29-oct). Confirmar con la dueña si el registro de marca se mantiene |
| T04 | GV «Cambiar fecha/curso» | E0 | Taller → Norexos 1 | en curso | Rama `claude/taller-gv` 280f2e0f; falta D1, 3 CI y «cajas cerradas» |
| T05 | Diagnóstico completo + qué falta para vender | E0 | Taller | en curso | Documento en `claude/taller-estado` 796d573c. Sesión Taller espera aprobar un permiso de mensajería |
| T06 | Cambio de nombre en código | E1 | **Taller** (reasignado de Norexos PC) | pendiente | Tarea: rama `marca/cambio-nombre` desde `producto-nexora`; 3 CI; entrega 2-nov. Si el mensaje no llega por el permiso pendiente, Norexos 1 lo asigna por otra vía |
| T07 | Cola de Forja (14 piezas) y de Brazo (bloques 3–5) | E1–E4 | Norexos PC | en curso | Laptop activa desde 13:02 UTC; piezas 1 y 2 de Forja hechas (`claude-pc/forja-noche`). E1 ya no es suya |
| T08 | Conectar animaciones y F2-03/F3-01 | E2 | Taller; ChatGPT desde 2-nov | pendiente | Entrega 7-nov. Piezas en `producto-nexora` ef063f6a (parcial: 6 de 12 primitivos Nx*) |
| T09 | Instalador vendible (licencia/activación, actualización, respaldo local; firma si D7) | E3 | Taller + Norexos PC (prueba Windows) + Revisor | pendiente | Entrega 10-nov. Depende de D7 y de T05 |
| T10 | Español/Inglés | E4 | Taller + Forja + Brazo | pendiente | Entrega 12-nov. Plan en `docs/coordinacion/PLAN_INTERNACIONAL_28OCT.md` |
| T11 | Precios (D2) | E8 | Dueña vía Norexos 1 | pendiente | Al final del plan. Cobro (Azul) fuera de v1 |
| T12 | Términos y privacidad | — | — | fuera de v1 | Retirado del alcance v1 (29-oct) |
| T13 | Tickets «Pedir un cambio» | E6 | Taller | pendiente | Entrega 14-nov. Empieza después de T06 |
| T14 | Traspasos, cuadres y verificación de transferencias del 25-oct | — | Norexos 2 | bloqueado | Norexos 2 pide a la dueña: confirmar anulación de FS-8 (Pérez Sosa) y decir si FS-77 (Robert Junior Bertre) se pagó en efectivo o transferencia, o si es prueba para anular. Además, movimientos bancarios del 25-oct |
| T15 | Piloto cerrado | E7 | Dueña | pendiente | 15–21 nov. Elegir 1–2 clientes (D6) |
| T16 | Relevo del despliegue (sesión Norexos 1) | E0 | Norexos 1 + dueña | en curso | El Taller dice que la sesión que despliega «vence el jueves» (hoy). Sin fecha escrita en el repo. Verificar y dejar relevo en `docs/operacion/MEMORIA_NEXORA1.md` |
| T17 | Permiso pendiente en la sesión del Revisor | E0 | Dueña / Norexos 1 | bloqueado | La sesión Norexos 4 espera aprobar o rechazar un permiso. Sin eso, sus auditorías llegan solo por archivo |
| T18 | Landing y dominio norexos.ai | E5 | Taller (textos) + dueña (dominio) | pendiente | 8–12 nov. Depende de T02 |
| T19 | Lanzamiento controlado | E8 | Dueña + Norexos 1 | pendiente | 24-nov (mejor caso 18-nov). Checklist firmada |
| T20 | Auditoría del Revisor de skills propuestas (wayfinder, senior-pm, kanban_manager) | E0 | Revisor | pendiente | Nada se instala sin informe. Norexos 5 no instala skills |
