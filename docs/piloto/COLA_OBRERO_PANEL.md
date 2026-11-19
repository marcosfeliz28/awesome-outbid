# Cola del obrero en la nube: panel mínimo del operador (16-nov-2026)

Autorizado por la dueña (16-nov): programar **solo el mínimo** del panel de operador para invitar pilotos, en la rama `mejora/panel-operador-16nov` (sale de `origin/producto-nexora`), con una opción barata y auditoría de Claude nube. Especificación: `docs/piloto/ESPEC_PANEL_INVITACIONES_16NOV.md`. Guía: `docs/piloto/GUIA_INVITAR_PILOTO_16NOV.md`.

**Interruptor de parada:** si existe el archivo `docs/piloto/OBRERO_PARAR.md` en `origin/nexora-cloud`, el obrero termina sin hacer nada.

## Reglas
- Una pieza por ciclo (máximo 20 minutos de trabajo). Prueba que falla antes y pasa después; `pnpm lint` completo, tipado y pruebas relacionadas en verde antes de empujar.
- Solo se empuja a `mejora/panel-operador-16nov`. **Nunca** a `producto-nexora`, `nexora-cloud` ni `main`; sin merge, sin PR, sin despliegue, sin tocar Render.
- El token de operador vive solo en memoria de la pantalla: nada en `localStorage`, cookies, URL ni registros. Sin credenciales en código, pruebas ni mensajes.
- No se cambia el servidor, los esquemas, los precios ni los planes. Solo la pantalla nueva `/operador` y sus pruebas. Si una pieza exigiera tocar el servidor, escribir «BLOQUEADA: motivo» y pasar a la siguiente.
- Usar un `fetch` propio (no `api()`), componentes de `packages/ui`, violeta `--action` y los tokens existentes.
- Commits terminan con `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`. Anotar cada pieza en `docs/sistema/CAMBIOS.md` de esa rama.
- Antes de empezar una pieza nueva, revisar el CI de la pieza anterior; si está rojo, arreglarlo primero (sin saltar, borrar ni desactivar pruebas).

## Piezas (marcar HECHA con el SHA o BLOQUEADA con el motivo)
| # | Pieza | Estado |
|---|---|---|
| 1 | Ruta `/operador` vacía y protegida, con `fetch` propio y token solo en memoria; prueba de que no guarda el token | PENDIENTE |
| 2 | Pantalla de entrada: campo de token (64 a 512 caracteres), textos en español para 404, 401 y 429 | PENDIENTE |
| 3 | Lista de empresas piloto (GET tenants): nombre, código, plan, estado y vencimiento | PENDIENTE |
| 4 | Formulario de invitación (POST tenants) con la misma validación del esquema; `trialDays` ofrecido en 60; datos del acuerdo en papel; validar la fecha real del acuerdo en el cliente | PENDIENTE |
| 5 | Mostrar el enlace de invitación **una sola vez**, con copiar y aviso de vencimiento a 7 días | PENDIENTE |
| 6 | Detalle de empresa (GET tenants/:slug), reinvitar y revocar con confirmación | PENDIENTE |
| 7 | Accesibilidad (foco, etiquetas, contraste en modo claro y oscuro) y pruebas de las 6 pantallas; fila en `CAMBIOS.md` | PENDIENTE |
| 8 | Checklist de auditoría para Claude nube (archivos tocados, pruebas, riesgos) en `docs/piloto/AUDITORIA_PANEL_OPERADOR.md` | PENDIENTE |

## Auditoría (Claude nube)
Cada pieza se revisa con los agentes `security-reviewer` y la lista de seguridad-20 antes de pedir a la dueña que apruebe el siguiente tramo. Nada se integra a `producto-nexora` sin su aprobación y 3 CI en verde en el SHA exacto.
