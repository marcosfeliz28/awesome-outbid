# Estado de las mejoras (12-nov-2026) — lo actualiza Norexos 1

Lista y razones: `LEVANTAMIENTO_MEJORAS_IA_12NOV.md`. Reparto: `REPARTO_MEJORAS_12NOV.md`. **Nada de esta tabla está construido todavía.**

**Cómo se lee «Estado»:** `pendiente` = puede empezar cuando le toque su fase; `espera dueña` = necesita su respuesta antes de empezar; `espera dueña (dinero)` = toca dinero y necesita su sí una por una; `espera clave` = necesita la clave de IA puesta (`PASOS_CLAVE_IA_12NOV.md`).

**Cómo empieza cada mejora (Claude nube):** Paso 0, abrir los archivos que cita el levantamiento y confirmar que siguen igual; después una especificación corta en `docs/coordinacion/mejoras-12nov/<código>.md` (comportamiento actual con archivo:línea, cambio exacto con textos, pruebas que lo cubren, pruebas existentes que podrían romperse) y recién entonces el código. Rama `mejora/<código>-<nombre>`, `pnpm check` completo, un solo push, revisión independiente del diff antes de empujar.

## Bloqueo general
Las 4 pruebas de navegador que fallan desde el 11-nov (`ORDEN_CHATGPT_NUBE_MEJORAS_12NOV.md`, pieza 1) impiden tener los 3 CI verdes. **Hasta que se resuelvan se puede construir y revisar, pero no desplegar.**

## Fase 1 — pantalla, sin IA en uso y sin dinero
| Cód. | Mejora | Criterio de aceptación (lo que ChatGPT PC comprueba en pantalla) | Estado |
|---|---|---|---|
| C1 | «Consumidor final» por defecto y seguir al cobro | Con el carrito lleno y sin elegir cliente, F12 llega a cobrar sin pasos extra; la venta queda con el cliente genérico; si se elige cliente, todo igual que hoy. Paso 0: confirmar que existe el cliente genérico y por qué se exige cliente. | espera dueña |
| C5-1 | Ayuda igual a la pantalla | Ningún texto de `QuickQuestions.tsx` ni de los manuales contradice la pantalla (lista de la pieza 2 de ChatGPT nube). | pendiente |
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

## Decisiones de la dueña pendientes
1. Plan `medio` o `completo` y tope de US$0.40 por usuaria al día del analista.
2. Cuáles de las mejoras que tocan dinero sí y cuáles no (C2, C3, C4-2, C10, D6, D8, D10-3).
3. C1 («Consumidor final» por defecto) y C12 (títulos directos).
4. Ella pone la clave en Render con «Save only» (pasos en `PASOS_CLAVE_IA_12NOV.md`).
