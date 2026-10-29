# Estado del Director (Norexos 5) · registro de revisiones

Lo escribe Norexos 5 solo cuando algo cambió. Fuente de metas y fechas: `docs/proyecto/PLAN_MAESTRO_NOREXOS.md`. Tablero: `docs/proyecto/TABLERO.md`. La dueña habla solo con Norexos 1.

## Revisión 3 · 29-oct-2026, 13:45 UTC · ajustes de Norexos 1

**Cambios aplicados:**
- T06 (cambio de nombre) queda en el Taller, rama `claude/taller-marca`, en curso.
- T16 (riesgo de vencimiento de la sesión de Norexos 1) queda hecho: su cuota se renovó hoy a las 7:00 (RD).
- Nueva T21: licencia y actualización simple a cargo de Norexos PC, rama `claude-pc/instalador-e3`, bloqueada por la decisión de la dueña. Tomé el número T21 porque T16 ya existía.
- Riesgo de «lanzar sin cobro» lo lleva Norexos 1 con la dueña. Sale del registro de Norexos 5.

**No aplicado:** instalación de la skill `mattpocock/skills@wayfinder`. Mis reglas no me permiten instalar skills; la auditoría del Revisor sigue pendiente (T20). Norexos 1 decide si acepta su propia auditoría como suficiente.

## Revisión 2 · 29-oct-2026, 13:40 UTC · plan v2 de Norexos 1

**Fecha de fin:** de 2-dic a **24-nov-2026** (mejor caso 18-nov). **Causa:** decisión de Norexos 1 del 29-oct de quitar cobro y documentos legales de la v1 y reducir tiempos.

**Cambios aplicados:**
- Alcance: fuera de v1 el abogado de marca (T03), los términos (T12) y el cobro con Azul (D3 y D4). Precios (D2) al final.
- Nueva decisión D7: certificado de firma del instalador. D5 resuelto (tickets después del cambio de nombre).
- E1 (cambio de nombre) reasignada al Taller.
- Etapas y fechas de E2 a E8 según v2.

## Revisión 1 · 29-oct-2026, 13:20 UTC

**Fecha de fin:** confirmada 2-dic-2026 en ese momento. Ninguna decisión se había retrasado.

**Paros detectados:** dueña (D1–D6 sin respuesta; dominios y abogado sin iniciar); Norexos 2 (dos preguntas de la dueña sobre FS-8 y FS-77); Revisor (permiso de mensajería pendiente); Norexos 1 (vencimiento de sesión, ya resuelto en la revisión 3).

## Orden permanente de la dueña (29-oct-2026)

- Las órdenes de instalación de skills o plugins llegan de Norexos 1, que actúa por orden directa de la dueña. Norexos 1 las ejecuta en su sesión.
- Norexos 5 no instala nada en su propia sesión: lo prohíbe su configuración. Registra cada instalación reportada en el tablero (T20 es el primer caso).
- Pendiente de Norexos 1: instalar lo que tenía previsto; reportar cada instalación con su nombre y commit para registrarla.

## Próxima revisión

En 4 h (rutina), solo con `git fetch` y lectura de archivos. Verificar: entrega de E1 en `claude/taller-marca`; respuesta de la dueña a D1, D2, D5, D6 y D7 antes del 30-oct; decisión sobre T21; permiso del Revisor (T17).
