# Relevo: trabajo de ChatGPT → DeepSeek (28-oct, decisión de la dueña)

Motivo: la cuota de ChatGPT quedó al 3 % y se reinicia el 2 de noviembre. Se detiene el trabajo de ChatGPT para darle descanso y para que no queden tareas a medias. La decisión la tomó la dueña; Claude PC la registra y no la amplía.

## Estado al momento del relevo (verificado en el repo)

| Tarea | Dónde estaba | Estado en el repo | Qué hace DeepSeek |
|---|---|---|---|
| Orden 24: mezcla de `producto-nexora` en `chatgpt-pc/visual-fase1-gemini` | Chat «Implementa Fase 1 visual» (ChatGPT PC) | Local, sin subir. Origen en `f088c881`; la rama aún no contiene `producto-nexora` (c78e7728). Cinco conflictos resueltos según el chat | Solo si la dueña lo confirma: rehacer la mezcla desde `f088c881`, no desde el estado local no subido |
| Cierre de F1-02 a F1-05 | `chatgpt-pc/visual-fase1-gemini` | Subido en `f088c881`, CI en verde | Nada |
| F1-01 bundle (ChatGPT nube) | Chat «ChatGPT nube» | Subido en `chatgpt-nube/f1-01-bundle` `980a5ca0`. `render-images` y `windows-installer` en verde; `verify` en curso | Nada hasta que `verify` termine; luego lo reporta Claude PC |
| F2-01, F2-03, F3-01 (con `App.tsx`) | Sin empezar | — | No se asigna a DeepSeek: tocan `App.tsx` y `styles.css`, y esas rutas siguen reservadas a ChatGPT PC hasta que la dueña decida otra cosa |

## Reglas que no cambian
- DeepSeek no toca `App.tsx`, `styles.css`, despliegue, llaves, dinero, mercancía, migraciones, instalador, CI ni `plugins-lock`.
- Una rama `deepseek/<id>` por tarea; Claude PC lee el diff antes de subirlo.
- Sin red nueva, descargas, variables de entorno ni dependencias nuevas sin pedirlo en `PEDIDOS_DEEPSEEK.md`.
- Nadie despliega ni mezcla en `producto-nexora` o `nexora-cloud`.

## Pendiente de decisión de la dueña
1. Si la mezcla de la orden 24 la rehace DeepSeek o espera a ChatGPT. Recomendación de Claude PC: DeepSeek no la rehace hasta que la dueña confirme el alcance por escrito, porque toca `Management.tsx`, `WarehousesPanel.tsx` y `Assistant.css`, que están fuera de su lista de tareas.
2. Quién cierra `verify` de `chatgpt-nube/f1-01-bundle`.
3. Texto de parada para los chats de ChatGPT: lo escribe Nexora 1 en el repo; Claude PC no lo escribe en el chat sin esa orden.
