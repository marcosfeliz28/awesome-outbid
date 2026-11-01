# Prueba de acceso de solo lectura (orden 108, 1-nov)

Resultado: **NO EJECUTADA** en esta sesión. Motivo: las variables `NEXORA_CLAUDE_USER` y `NEXORA_CLAUDE_PASSWORD` no están definidas.

## Comprobación de variables (sin valores)

| Variable | Entorno del proceso | Usuario (registro) | Máquina (registro) |
|---|---|---|---|
| NEXORA_CLAUDE_USER | NO definida | NO definida | NO definida |
| NEXORA_CLAUDE_PASSWORD | NO definida | NO definida | NO definida |

## Lo que no se hizo

- No se ejecutó `docs/coordinacion/claude-nube/entrar.py`: no hay credenciales que pasarle.
- No se hizo ningún GET (`/sales`, `/cash-sessions`, `/dashboard/summary`, `/products`, `/auth/me`).
- No se hizo ninguna escritura, ni se probó si la cuenta puede escribir.

## Qué hace falta

1. La dueña define las dos variables en el entorno de usuario de Windows (no en un archivo del repo) y reinicia la app de escritorio para que la sesión nueva las herede.
2. Con esa sesión, se repite esta prueba. Esta prueba no se vuelve a hacer hasta que las variables estén definidas.

## Riesgo abierto

Sin una prueba real no se sabe qué rol tiene la cuenta `claude-acceso`. Si resulta ser administrador, la orden 107 (rol «lectura») debe ir antes de cualquier uso de esa cuenta.
