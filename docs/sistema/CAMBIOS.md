# Cambios de la base del sistema

Cada vez que cambie una pantalla, botón, flujo, permiso, regla de dinero, modelo, texto de menú o rama/despliegue, se edita el archivo que corresponda de `docs/sistema/` **y** se agrega una fila aquí, en el mismo commit (regla de `.claude/skills/base-sistema/SKILL.md`). Un cambio de sistema sin su línea aquí no se mezcla ni se despliega.

Formato: `| fecha | quién | qué cambió | archivos |`

| fecha | quién | qué cambió | archivos |
|---|---|---|---|
| 2026-10-30 | Claude (sesión de levantamiento, rama `cola-n26`) | Creación de la base `docs/sistema/` (levantamiento completo de la tienda: README, PANTALLAS, FLUJO_CAJA_POS, FLUJO_COBROS_Y_TRANSFERENCIAS, FLUJO_MERCANCIA, GV, ROLES_Y_PERMISOS, DATOS_Y_MODELOS, GLOSARIO, RESPUESTAS_A_TALLER, CAMBIOS, INDICE.json). Sin cambios de código. | `docs/sistema/*` |
