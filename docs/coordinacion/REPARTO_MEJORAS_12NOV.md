# Reparto de las mejoras de Norexos entre agentes (12-nov-2026, Norexos 1)

**Origen:** orden de la dueña del 11-nov: repartir el trabajo entre ChatGPT PC, ChatGPT nube, Claude PC, Claude nube y la IA local de su PC (vía bot), todo organizado y detallado.
**Lista de mejoras:** `LEVANTAMIENTO_MEJORAS_IA_12NOV.md`. **Estado y criterios de cada mejora:** `ESTADO_MEJORAS_12NOV.md`. Cada mejora empieza con un Paso 0 (confirmar en el código que el problema sigue como dice el levantamiento) y una especificación corta en `docs/coordinacion/mejoras-12nov/<código>.md`.
**Esto sustituye** a `REPARTO_GENERAL_1NOV.md` solo para estas mejoras. Los permisos de cada agente siguen igual (ver sus archivos `ORDENES_*`); lo que cambia aquí está dicho expresamente.

## 1. Regla central: el dueño es el archivo, no la mejora

Varias mejoras tocan el mismo archivo (`POS.tsx` lo tocan 10; `Management.tsx`, 8). Dos agentes editando el mismo archivo a la vez producen conflictos que cuestan un ciclo completo. Por eso:

| Archivo o zona | Dueño | Los demás |
|---|---|---|
| `apps/web/src/POS.tsx`, `Tienda.tsx`, `VoidRequests.tsx`, `api.ts`, `QuickQuestions.tsx` | **Claude nube** | Solo lectura; si ven un problema, lo anotan en su informe |
| `apps/web/src/Management.tsx`, `Dashboard.tsx`, `AssistantPanel.tsx`, `AiUsage.tsx`, `CreditAccounts.tsx` | **Claude nube**, en la fase que toque | Igual |
| `apps/api/src/**` (cualquier cambio de servidor) | **Claude nube**, un cambio de API a la vez y con prueba | Igual |
| `tests/e2e/**` | **Claude nube** (regla vigente: eso es de Claude) | Pueden proponer pruebas en su informe |
| `docs/venta/**`, `docs/validacion/**`, `docs/educacion/**`, `docs/diseno/borradores-local/**` | ChatGPT nube / Claude PC / IA local | — |
| `docs/MANUAL-CAJERO.md`, `docs/MANUAL-CAJERA-PREGUNTAS.md` | ChatGPT nube (textos), con la lista exacta de cambios que sale de la especificación C5-1 | — |
| `docs/sistema/CAMBIOS.md` y citas | Quien cambie código en esa mezcla | — |

## 2. Carriles

### Claude nube (esta sesión y sus obreros): construir
- **Fase 1** completa (solo pantalla, sin dinero): C1, C5-1 (textos de `QuickQuestions.tsx`), C6, C11, C12, C13, C14, C15, D5, D11.
- Una mejora por rama (`mejora/<código>-<nombre>`), `pnpm check` completo antes de empujar, un solo push por rama, un obrero independiente revisa cada diff antes de empujar.
- **Fase 2 sin dinero** (C9, C4-1, D1, D7, D9, D3, D4-1, D10-1 y D10-2) cuando termine la Fase 1 y la dueña confirme el orden.
- Mezcla, despliegue y verificación en vivo: solo Norexos 1, con las condiciones de la skill `noche-autonoma` (3 CI verdes en el SHA exacto, 0 cajas abiertas, sin cambios de dinero).

### ChatGPT PC (Windows real): comprobar en pantalla y en el instalador
- Después de cada despliegue de fase: recorrido de pantallas a 1366 px y 390 px de cajera, gerente y dueña, con captura antes/después de cada mejora publicada; lista de lo cortado, lento o confuso. Salida: `docs/validacion/RECORRIDO_MEJORAS_<fase>.md`.
- Prueba del instalador con la fase nueva (compilar, instalar, vender, cerrar caja, respaldar y restaurar).
- No cambia código de la aplicación ni toca `tests/e2e/**`.

### ChatGPT nube: textos, ayuda y contra-auditoría
- C5-1 en `docs/MANUAL-CAJERO.md` y `docs/MANUAL-CAJERA-PREGUNTAS.md` (cambios exactos de la especificación).
- D12: contenido de la ayuda dentro del sistema, en español sencillo, por rol (borrador en `docs/ayuda/`; lo conecta Claude nube).
- Contra-auditoría de cada fase ya empujada: leer el diff, buscar lo que rompa cajera/gerente/dueña, pruebas que falten; informe con archivo:línea. No empuja a las ramas de Claude nube.

### Claude PC (laptop de la dueña): manos reales
- Con la dueña presente: pegar en los chats «ChatGPT nube» y «ChatGPT PC» el texto exacto de sus órdenes (ver `ORDEN_CHATGPT_*_12NOV`).
- Operar el bot de la IA local (sección 3).
- Cuando la clave de IA esté puesta (`PASOS_CLAVE_IA_12NOV.md`): correr la evaluación de 129 preguntas (`IA_EVAL_26OCT.md`) contra una base de prueba y reportar cifras antes/después; la clave de prueba la pone la dueña en su entorno y Claude PC nunca la imprime.
- Revisión visual en celular (390 px) de cada fase.

### IA local de la PC (a través del bot de Claude PC o ChatGPT PC)
Ver sección 3.

## 3. IA local: qué sí y qué no

Qué es (de `EDUCACION_MODELO_LOCAL.md` y `REPARTO_LOCAL_PC.md`): modelos Ollama en la laptop (`qwen-optimizado`, `qwen2.5-coder`), sin costo por uso. Redactan borradores cortos; **no leen archivos, no ven pantallas, no ejecutan nada**, y una vez inventaron una función. Todo lo suyo sale como «Borrador sin verificar» hasta que Claude PC lo revisa.

**Trabajo que se le encarga** (cabe en una cola de `scripts/cola-local/cola.mjs`, un script mide y encuentra, el modelo redacta una cosa a la vez):
1. D12: reescritura en español sencillo de los manuales, una sección por tarea, entrada máxima de 4,000 caracteres.
2. C16: resumen de las respuestas libres de la encuesta de cajeras (sin nombres).
3. C8-1: propuestas de apodos de productos.

**Reglas que no se rompen** (las del archivo de educación, más una nueva):
- Entra solo texto sin dinero: nunca costos, precios, existencias, ventas, claves ni datos de clientes. Para C8-1 la entrada es únicamente la lista de **nombres** de producto.
- Antes de guardar cualquier salida, un script comprueba que no contenga números de teléfono, correos, claves ni cifras de dinero.
- La salida de C8-1 y C16 **no se sube al repositorio** (es público): queda en la laptop, la revisa una persona y entra por la pantalla de administración. Lo único que se sube es el script y la plantilla.
- Nada de lo que produzca el modelo se aplica sin revisión de una persona y de Claude PC.
- La cola nueva se llama `COLA_LOCAL_MEJORAS_12NOV.json` y se pasa al runner con `--cola=`: el runner usa por defecto otro archivo y por eso las colas anteriores no corrían.

## 4. Orden de trabajo

1. **Ahora:** ChatGPT nube busca la causa de las 4 pruebas e2e que bloquean todo despliegue; ChatGPT PC toma la línea base de pantallas; Claude PC reparte los textos a los chats y corre la cola de la IA local; Claude nube empieza la Fase 1 (sin desplegar hasta que el CI esté en verde).
2. **Fase 1:** Claude nube construye; ChatGPT nube hace C5-1 y contra-audita; ChatGPT PC y Claude PC validan después del despliegue.
3. **Consulta a la dueña** con todo detallado (ya está pedido): decisiones de la sección 7 del levantamiento. Nada que toque dinero arranca antes de su sí.
4. **Fases 2 y 3** según lo que ella apruebe.

## 5. Cómo se informa

- Cada agente: entrada corta en su archivo de resultados (rama, SHA, comando, resultado, lo que NO pudo comprobar).
- Claude nube: `docs/coordinacion/ESTADO_MEJORAS_12NOV.md`, una tabla código → estado → rama → SHA → 3 CI.
- Una pieza bloqueada por una decisión de la dueña se anota como BLOQUEADA y se sigue con otra.
