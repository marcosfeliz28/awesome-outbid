# GV: seguimiento de transferencias por la gerente, con foto y Claude (4-nov-2026)

Decisión de la dueña: la gerente manda la foto del banco a su Claude; Claude la compara con GV y le dice si cuadra. **Claude compara y avisa; la gerente (persona) verifica en el sistema.**

## Qué lee Claude (solo lectura)
- `GET /gv/transfers/pending` (permiso `gv:read`): transferencias de GV sin verificar.
- `GET /gv/reports`, `GET /gv/courses/:id` para alumnas y pagos.
- Nunca `POST /gv/payments/:id/review` (verificar/rechazar). Eso lo hace la persona en la pantalla.

## Roles (hecho verificado en el código)
- Los roles solo se EDITAN (`PUT /roles/:id`, `apps/api/src/admin.ts:1299`); no hay pantalla ni endpoint para CREAR uno.
- `gv:verify` ya lo traen `manager` y administración; el rol `gv` (Clary) no.
- Opción A (rápida, sin desplegar): usuario con rol `gv` + agregar `gv:verify` al rol `gv`. Efecto: Clary también podría verificar (el sistema ya impide verificar una transferencia que uno mismo registró).
- Opción B (recomendada): rol nuevo `gerente_gv` = `gv:read`, `gv:reports`, `gv:verify`, creado por migración aditiva revisada con los 3 CI y desplegada. Sin acceso a costos, inventario, configuración ni datos de MacGen.

## Sesión de Claude de la gerente (instrucción para pegar en su proyecto)
1. Variables de entorno `NEXORA_CLAUDE_USER` / `NEXORA_CLAUDE_PASSWORD` con el usuario de ELLA (nunca en chat, commits ni documentos). Entrar con `python3 docs/coordinacion/claude-nube/entrar.py`.
2. Para cada foto: leer los datos 3 veces por caminos distintos (monto, fecha, referencia, nombre), comparar con `transfers/pending`, y responder una tabla: Coincide / No coincide / Dudoso, con el monto de la foto y el del sistema.
3. Lo dudoso o ilegible va a revisión humana; decir siempre qué no se pudo comprobar. Ante montos dudosos, preguntar; no adivinar.
4. No marcar, verificar ni rechazar nada. Skill de referencia: `informe-triple`.
