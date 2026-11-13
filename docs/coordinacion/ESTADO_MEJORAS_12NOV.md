# Estado de las mejoras (12-nov-2026) — lo actualiza Norexos 1

Lista y razones: `LEVANTAMIENTO_MEJORAS_IA_12NOV.md`. Reparto: `REPARTO_MEJORAS_12NOV.md`. **Nada de esta tabla está construido todavía.**

**Cómo se lee «Estado»:** `pendiente` = puede empezar cuando le toque su fase; `espera dueña` = necesita su respuesta antes de empezar; `espera dueña (dinero)` = toca dinero y necesita su sí una por una; `espera clave` = necesita la clave de IA puesta (`PASOS_CLAVE_IA_12NOV.md`).

**Cómo empieza cada mejora (Claude nube):** Paso 0, abrir los archivos que cita el levantamiento y confirmar que siguen igual; después una especificación corta en `docs/coordinacion/mejoras-12nov/<código>.md` (comportamiento actual con archivo:línea, cambio exacto con textos, pruebas que lo cubren, pruebas existentes que podrían romperse) y recién entonces el código. Rama `mejora/<código>-<nombre>`, `pnpm check` completo, un solo push, revisión independiente del diff antes de empujar.

## Bloqueo general
**Resuelto el 12-nov (pendiente del CI del merge):** las 4 pruebas de navegador rojas tenían una causa de diseño (el buscador del POS se comprimía a 0 px en monitores de caja ≤ 1400 px; ver `HALLAZGO_CI_4_PRUEBAS_11NOV.md`, corregido). ChatGPT nube lo arregló en `chatgpt-nube/fix-e2e-12nov` (`8022a736`, 3 CI verdes) y Norexos 1 lo integró en `58bcc133`. Antes de desplegar cualquier cosa hacen falta los 3 CI verdes sobre el SHA final de `nexora-cloud`, 0 cajas abiertas y la prueba real en Windows. **CI verde no certifica una venta**: la prueba real del instalador (Windows-Smoke) sigue pendiente a cargo de ChatGPT PC.

## Pendiente de coordinar
- El chat «ChatGPT PC» no aparece con ese nombre en la barra lateral de ChatGPT: Claude PC no escribe en ningún chat hasta que la dueña confirme cuál es; no se confunde con Claude PC.
- Pieza 1 de `ORDEN_CHATGPT_NUBE_MEJORAS_12NOV.md`: **cumplida**; su hipótesis de fecha de la orden no fue la causa. Queda su pieza 2 en adelante.

## Fase 1 — pantalla, sin IA en uso y sin dinero
| Cód. | Mejora | Criterio de aceptación (lo que ChatGPT PC comprueba en pantalla) | Estado |
|---|---|---|---|
| C1 | «Consumidor final» por defecto y seguir al cobro | Con el carrito lleno y sin elegir cliente, F12 llega a cobrar sin pasos extra; la venta queda con el cliente genérico; si se elige cliente, todo igual que hoy. Paso 0 (hecho 12-nov): **no existe** cliente genérico en el código; habría que crearlo, y la API solo exige un cliente para el crédito. | espera dueña |
| C5-1 | Ayuda igual a la pantalla | Ningún texto de `QuickQuestions.tsx` ni de los manuales contradice la pantalla (lista de la pieza 2 de ChatGPT nube). | hecha en `nexora-cloud` (falta CI del SHA final y validar en pantalla) |
| C6 | Sin claves internas a la cajera | En Solicitudes de anulación, Ventas, el asistente y el error de cámara no aparece `cash`, `cod`, «SKU», «Datos usados: mis_ventas» ni texto del navegador. | pendiente |
| C11 | Confirmar o deshacer igual en todos lados | Quitar una línea se puede deshacer; recuperar una venta en espera y cancelar una solicitud piden confirmación con el diálogo propio. | pendiente |
| C12 | Títulos directos | Los títulos de adorno pasan a nombre de tarea (Caja, Ventas, Clientes, Recibo). Paso 0: buscar si la dueña pidió ese tono. | espera dueña |
| C13 | Límite de descuento visible | Junto al campo de descuento se lee «hasta N % sin PIN» con el valor real, y se avisa antes de cobrar si hará falta PIN. | pendiente |
| C14 | Escáner de cámara continuo | La cámara sigue abierta entre un código y el siguiente y se cierra con un botón claro. | pendiente |
| C15 | «Stock insuficiente» con cantidad | El mensaje dice «Solo quedan N…» y qué hacer, sin mostrar a una cajera cantidades que hoy no ve. | pendiente |
| D5 | Sin claves internas para la dueña | Permisos, bitácora, tipo de movimiento del inventario y funciones del medidor se leen en español; la bitácora cuenta lo ocurrido en una frase, con respaldo si no hay plantilla. | pendiente |
| D11 | Medidor de IA entendible | Se ve «Este mes: X preguntas, aprox. RD$ Y» y cuántas quedan hoy; un modelo sin precio se dice claramente. | pendiente |

## Fase 2 — menos pasos y menos dependencia de terceros (sin IA en uso)
Sin dinero: C9, C4-1, C8-1 (apodos de producto, lista elaborada con la IA local y revisada por una persona), D1, D3 (ejemplos y micrófono), D4-1, D7, D9, D10-1 y D10-2. **Espera el sí de la dueña, una por una (dinero):** C2, C3, C10, D8. Estado de todas: `pendiente` o `espera dueña (dinero)`. Sus criterios se escriben en la especificación de cada una al empezar.

## Fase 3 — IA en uso (requiere la clave)
D2 (asistente analista), C7, C5-2, D3-2, D4-2, C8-2, C16, D12, y con sí de la dueña C4-2, D6, D10-3. Estado: `espera clave`; D12 ya tiene borradores de ayuda en preparación con la IA local, sin costo.

## IA local y ayuda (12-nov)
- Runner de la IA local con carpeta de salida externa y revisión de datos: integrado en `nexora-cloud` (`632baf70`). Cola de la ayuda de la cajera lista; falta que Claude PC la ejecute (Orden 122).
- D12 (ayuda dentro del sistema): contenido en revisión por Norexos 1; ver `ORDENES_CHATGPT_NUBE.md`. Aún no está conectado a la aplicación.

## Decisiones de la dueña pendientes
1. Plan `medio` o `completo` y tope de US$0.40 por usuaria al día del analista.
2. Cuáles de las mejoras que tocan dinero sí y cuáles no (C2, C3, C4-2, C10, D6, D8, D10-3).
3. C1 («Consumidor final» por defecto) y C12 (títulos directos).
4. Ella pone la clave en Render con «Save only» (pasos en `PASOS_CLAVE_IA_12NOV.md`).

## Autorizaciones directas de la dueña (12-nov, tarde)
Dadas por ella en este chat, no por mensaje de otra sesión:
- **Clave de IA en Render: esta noche, la pone ella** con «Save only» (`PASOS_CLAVE_IA_12NOV.md`). Norexos 1 despliega solo con 0 cajas, 3 CI verdes y la prueba de Windows.
- **Tope del asistente analista: US$0.40 por usuaria al día, aceptado.** Máximo US$12 al mes por usuaria (30 días). La función `claude-pc/asistente-analista` sigue sin mezclar: falta auditarla.
- **Cambios que tocan dinero: C2, C3, C4-2, C10, D6, D8, D10-3 autorizados, uno por uno.** Reglas: sin cambiar totales, impuestos, descuentos ni la forma en que se guardan los pagos; una rama y un push por código; Paso 0 contra el código; pruebas completas y 3 CI verdes; ChatGPT PC los comprueba en pantalla; **ninguno se despliega** sin la prueba de Windows y sin avisarle.
- Orden: C1 → C2 → C3 → C10 → D8 → D6 → C4-2 → D10-3.

## Reparto actualizado (12-nov, noche, Norexos 1; sin gastos ni despliegue, nada mezclado en esta revisión)
Verificado en las ramas, no en mensajes:
| Área | Estado real | Pieza vigente (exclusiva) | Entrega |
|---|---|---|---|
| **Claude PC nativo** | `claude-pc/ayuda-local-12nov` (`0963547f`): 5 guías aprobadas con 3 CI verdes; s3 y s7 bloqueadas por el revisor (cifras de dinero); s5 excluida por rol equivocado | Cierre de la Orden 123 y lint rojo de `claude-pc/cola2-26oct` (16 no-undef en scripts de cola/Ollama). **Nadie más toca esos scripts** | Reformular s3, s5 y s7 sin cifras y con el rol correcto; cola2 con lint verde y 3 CI |
| **ChatGPT PC** | `chatgpt-pc/instalacion-limpia-12nov` (`2d817d0a`): la VM limpia no arrancó (ISO de Windows dañado); sin capturas C6/C15 (falta `@zxing/library` en su PC) | Instalación limpia + C6/C15 | ISO reparado, instalación de punta a punta con versión, tamaño, SHA-256 y tiempos; capturas. **Sigue siendo lo que bloquea el despliegue** |
| **ChatGPT nube** | D12 cerrada y reconciliada (`e40f3925`, 3 CI verdes); D12 local sigue sin publicar | Nueva (abajo) | Informe en `RESULTADOS_CHATGPT_NUBE.md` |
| **Norexos 1** | Auditando `claude-pc/asistente-analista` (tope US$0.40 ya está en el código); C1 y siguientes en cola | Auditoría de arquitectura, luego C1 → C2 → C3 | Hallazgos aquí; nada se mezcla sin aviso |

**Tareas nuevas para ChatGPT nube (solo textos y documentos):**
1. Verificar las 5 guías de `docs/ayuda/local/` de la rama `claude-pc/ayuda-local-12nov` contra el código y las pantallas: tabla paso → archivo:línea, como en D12. No editar esa rama; entregar las correcciones como lista.
2. Escribir los criterios de aceptación en pantalla de C1, C2, C3 y C10 (qué ve la cajera antes y después), para que ChatGPT PC los compruebe cuando se construyan. Sin cambiar reglas de dinero.
3. Revisar que el contrato `docs/venta/contrato/04_TERMINOS_USO_IA_VENTAS.md` de la rama del asistente analista no contradiga el tope de US$0.40 por usuaria al día.

**Dependencias:** despliegue ← instalación limpia aprobada + 0 cajas + 3 CI verdes; asistente analista ← auditoría + fusión con `nexora-cloud` (108 commits de retraso); clave de IA ← la dueña, «Save only».

## Auditoría del asistente analista (`claude-pc/asistente-analista`, 9d419f30), 12-nov noche
Lectura de diff por revisor de dinero (no ejecutó pruebas ni probó con base real). **Veredicto: se puede mezclar; ningún hallazgo bloquea.** Solo lectura confirmada (6 herramientas sin escritura, salvo la fila del medidor `AiUsage`); `sessionsFor` sin cambio con rango vacío; permisos reutilizan los de los reportes.
Antes de activar el plan `analista` en producción:
1. (media) Si `ASSISTANT_MODEL` apunta a un modelo que no esté en `ai-prices.ts`, `costUsd` queda nulo y el tope de US$0.40 no salta. Con el modelo por defecto `claude-haiku-5-5` sí está en la tabla (verificado por N1). Acción: fallar cerrado (negar) si no hay precio.
2. (media) El tope es blando: se revisa antes de la pregunta y una pregunta puede hacer hasta 4 llamadas al modelo. Pasarse unos centavos es posible.
3. (media) Preguntas simultáneas de la misma usuaria pasan con el mismo gasto acumulado hasta que se liquida el costo; el exceso queda acotado por las 30 preguntas diarias. No probado con carga.
4. (baja) El monto 0.4 dice «PENDIENTE de aprobar por la dueña» en el código; **ya lo aprobó el 12-nov**: actualizar el comentario al mezclar.
5. Pendiente de revisar: que todo reporte con columnas de costo tenga la marca `margin` (la limpieza por nombre `strip` no cubre las columnas en español).
Falta para mezclar: fusionar `nexora-cloud` (108 commits de retraso), 3 CI verdes y revisión de seguridad. No se activa sin la clave y el plan puestos por la dueña.

## 13-nov, madrugada (N1)
- **Integrado:** C13 (`953cb7c6`, 3 CI verdes en su rama) y la revisión nocturna de ChatGPT nube (`bfa8948f`, 3 CI verdes): tabla de las 5 guías, criterios en pantalla de C1/C2/C3/C10 y 3 contradicciones del contrato del asistente con el tope aprobado de US$0.40.
- **Claude PC:** Orden 124 en `RESPUESTA_CLAUDE_PC_27OCT.md` (corregir las 5 guías con la lista de Nube y cerrar s3, s5 y s7).
- **Contrato del asistente (`04_TERMINOS_USO_IA_VENTAS.md`, rama `claude-pc/asistente-analista`):** se corrige al mezclar esa rama: el tope de US$0.40 ya está aprobado y no se promete como techo absoluto (se comprueba antes de cada pregunta).
- **Decisión de la dueña (12-nov, noche):** la instalación limpia de Windows y la clave de Render quedan para el fin de semana. Hasta entonces no hay despliegue.
- **En preparación:** consulta de mejoras para ChatGPT PC y nube (50+ propuestas con evidencia comprobada, por orden de la dueña).
