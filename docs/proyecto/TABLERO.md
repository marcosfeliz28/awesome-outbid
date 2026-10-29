# Tablero Norexos (lo mantiene Norexos 5; estados: pendiente · en curso · bloqueado · hecho)
Última actualización: 29-oct-2026, 13:20 UTC (Norexos 5, revisión de arranque). Detalle de cada revisión en `docs/coordinacion/ESTADO_DIRECTOR.md`.

| ID | Tarea | Etapa | Responsable | Estado | Bloqueo / siguiente paso |
|---|---|---|---|---|---|
| T01 | Decisiones D1–D6 | E0 | Dueña | pendiente | Preguntas enviadas el 29-oct; plazo 31-oct; sin respuesta a las 13:20 UTC |
| T02 | Registrar norexos.ai y norexos.com | E0 | Dueña | pendiente | Con verificación en dos pasos. Ruta crítica: sin esto no se publica la marca |
| T03 | Contratar abogado de marca | E0 | Dueña | pendiente | Clases 9/35/42; vigilar NEXOROS y Norexa. Ruta crítica (igual que T02) |
| T04 | GV «Cambiar fecha/curso» | E0 | Taller → Norexos 1 | en curso | Rama `claude/taller-gv` 280f2e0f; falta D1, 3 CI y «cajas cerradas» |
| T05 | Diagnóstico completo + qué falta para vender | E0 | Taller | en curso | Documento listo en `claude/taller-estado` 796d573c (solo documento). Sesión Taller pide aprobación de permiso para escribir a otras sesiones (la dueña o Norexos 1 lo aprueba en la app) |
| T06 | Cambio de nombre en código | E1 | Norexos PC | en curso | Laptop activa desde 13:02 UTC (Forja 1 `nx-brand` y Forja 2 `nx-plural` en `claude-pc/forja-noche`). La rama `marca/cambio-nombre` aún NO existe: se crea desde `producto-nexora` al empezar el cambio. No desplegar hasta T02/T03 |
| T07 | Cola de Forja (14 piezas) y de Brazo (bloques 3–5) | E1–E4 | Norexos PC | en curso | Laptop volvió; avance de hoy: piezas 1 y 2 de Forja. Revisar cuántas quedan al siguiente ciclo |
| T08 | Conectar animaciones y F2-03/F3-01 | E2 | ChatGPT (2-nov) o Norexos PC | pendiente | Piezas listas en `producto-nexora` ef063f6a (parcial: 6 de 12 primitivos Nx*). Faltan capturas 390/1440 |
| T09 | Instalador vendible (firma, PC limpia, actualización, respaldo, licencia) | E3 | Norexos PC + Revisor | pendiente | Depende de T05. Certificado de firma: decisión de la dueña pendiente |
| T10 | Español/Inglés | E4 | Taller + Forja + Brazo | pendiente | Plan en `docs/coordinacion/PLAN_INTERNACIONAL_28OCT.md` |
| T11 | Planes, precios y cobro (Azul) | E5 | Dueña + Norexos 1 | pendiente | D2 y D3 |
| T12 | Términos y privacidad | E5 | Abogado | pendiente | T03 |
| T13 | Tickets «Pedir un cambio» | E6 | Taller | pendiente | Spec listo (`docs/diseno/SPEC_TICKETS_SOLICITUDES.md`); esperar D5 |
| T14 | Traspasos, cuadres y verificación de transferencias del 25-oct | — | Norexos 2 | bloqueado | Norexos 2 pide a la dueña: confirmar anulación de FS-8 (Pérez Sosa) y decir si FS-77 (Robert Junior Bertre) se pagó en efectivo o transferencia, o si es prueba para anular. Además, movimientos bancarios del 25-oct |
| T15 | Piloto cerrado | E7 | Dueña | pendiente | Elegir 1–2 clientes (D6) |
| T16 | Relevo del despliegue (sesión Norexos 1) | E0 | Norexos 1 + dueña | en curso | Riesgo: el Taller dice que la sesión que despliega «vence el jueves» (hoy). Ningún documento del repo lo confirma. Verificar la fecha exacta y dejar relevo escrito en `docs/operacion/MEMORIA_NEXORA1.md` |
| T17 | Revisor: permiso pendiente para escribir a otras sesiones | E0 | Dueña / Norexos 1 | bloqueado | La sesión del Revisor (Norexos 4) espera aprobar o rechazar un permiso. Sin esto, sus auditorías llegan solo por archivo |
