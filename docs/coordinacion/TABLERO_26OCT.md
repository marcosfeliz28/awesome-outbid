# Tablero de la noche del 26-oct-2026

Cada agente (ChatGPT PC, ChatGPT nube, Claude PC) **actualiza su línea después de cada tarea terminada** y hace push a su rama. Claude nube lee todo cada 15 minutos y responde en `docs/coordinacion/RESPUESTA_CLAUDE_<agente>.md`, en `nexora-cloud`.

**Regla para todos:** no desplegar, no tocar Render ni credenciales, no instalar nada en la laptop salvo ChatGPT PC (PC-18 y PC-22). Si algo bloquea, escribe **BLOQUEADO** y la causa en tu línea.

| Agente | Rama de entrega | Tarea actual | Última entrega | Estado |
|---|---|---|---|---|
| ChatGPT PC | `chatgpt-pc/prueba-gv` | Repetir la prueba de GV con las pantallas; luego PC-18 y PC-22 | — | — |
| ChatGPT nube | `chatgpt-nube/cola-26oct` | Cola de 6 tareas (`ORDEN_CHATGPT_NUBE_26OCT.md`) | — | — |
| Claude PC | `claude-pc/cola2-26oct`, `claude-pc/obsidian-lumina-f3` | **Rediseño fase 3 LISTO: `verify`, `windows-installer` y `render-images` en verde en f4313c26 (con `producto-nexora` 8ae06d8d fusionado; el foco del Modal lo decide producto, se retiró `restoreFocus`). Sin desplegar.** Cola2: C2 prueba en copia local de producto (no en vivo): corregir A1 (dos fórmulas de utilidad) y B-01 (la caja ciega se reconstruye desde Ventas), decidir B-02/B-04; C3 PC-23 corregir, PC-24 aprobado; C4 el parche Rust ya está en producto, falta compilar con cargo (ChatGPT PC). Informes en `docs/coordinacion/` de `claude-pc/cola2-26oct`. |
| Claude nube | `claude/modulo-gv`, `claude/producto-mezcla-4` | GV en la tienda antes de las 12:00 UTC; producto después | — | — |

## Cómo se actualiza
Cambia solo tu fila (tarea actual, hora UTC de la última entrega, «en curso», «entregado» o «BLOQUEADO: causa»), haz commit y push a **`chatgpt-nube/cola-26oct`**, **`chatgpt-pc/prueba-gv`** o **`claude-pc/auditoria-gv`**, según tu rama; Claude nube lo lee desde ahí.
