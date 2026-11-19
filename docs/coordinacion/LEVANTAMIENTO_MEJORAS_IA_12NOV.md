# Levantamiento de mejoras para hacer Norexos más amigable (12-nov-2026)

**Pedido por la dueña (11-nov):** levantamiento completo de las mejoras que harían el sistema más fácil de usar, con IA o construibles con IA, para su parte (administración) y para la parte que usan las cajeras; dejar el instructivo de cómo hacerlas y consultarle antes de delegar.

**Estado: propuesta. Nada de esta lista está construido ni desplegado.** Cada mejora necesita el visto bueno de la dueña antes de empezar.

**Cómo se hizo:** leyendo el código de la rama `nexora-cloud` (commit `eadffa20`) y los manuales. No se probó en navegador ni en celular; lo que es deducción y no lectura directa está marcado como «deducido».

---

## 1. Cómo leer cada mejora

Cada mejora tiene un código (C = cajeras, D = dueña) y tres etiquetas:

| Etiqueta | Valores | Qué significa |
|---|---|---|
| IA | **Sin IA en uso** / **Con IA en uso** | «Sin IA en uso»: un cambio normal de pantalla o lógica; un agente de IA lo puede programar, pero una vez hecho no gasta nada. «Con IA en uso»: cada vez que se usa consulta al proveedor de IA; necesita la clave y cuesta por uso. |
| Tamaño | Pequeña / Mediana / Grande | Pequeña: una pantalla o un archivo. Mediana: varias pantallas o pantalla + servidor. Grande: función nueva completa. |
| Dinero | **Solo pantalla** / **Solo lectura** / **Toca dinero** | «Toca dinero»: cambia cómo se registran cobros, caja, inventario o costos. Estas requieren confirmación directa de la dueña, una por una. |

---

## 2. Lo que ya existe de IA (punto de partida)

| Función | Qué hace hoy | Estado |
|---|---|---|
| Preguntar a Norexos (`assistant.ts`, `AssistantPanel.tsx`) | Una pregunta, una respuesta, solo lectura. La dueña puede preguntar por ventas, productos más vendidos, cobros y comparar períodos. La cajera solo por sus propias ventas. No sabe de caja, transferencias, inventario ni clientes. | Programado y desplegado, **apagado**: falta la clave del proveedor y elegir plan (`medio` = 10 preguntas por usuario al día, `completo` = 30). |
| Lectura de facturas de proveedor por foto/PDF (Mercancía) | Convierte la foto en líneas de producto para revisar antes de aplicar. Límite: 30 lecturas por usuario al día. | Programado; usa la misma clave. |
| Medidor de uso de IA (Configuración) | Llamadas y costo por función, usuario y día. | Desplegado. |
| Búsqueda por voz en Punto de venta | Dicta el nombre y llena el buscador. Usa el navegador, sin clave ni costo. | Programado, **sin desplegar**. |
| Asistente «analista» (rama `claude-pc/asistente-analista`) | Agrega 6 consultas de solo lectura: cuadre del día, cierres de caja, transferencias pendientes, inventario bajo, productos sin ventas, explicar un reporte. Tope de US$0.40 por usuario al día. | Programado, **sin mezclar**. Falta: aprobar el tope y correr la evaluación con la clave real. |
| Preguntas rápidas (botón en Punto de venta) | 30 preguntas de un toque. No es IA. | Desplegado. |

---

## 3. Parte A — lo que usan las cajeras

### Vender y cobrar

| Cód. | Qué pasa hoy | Mejora | IA | Tamaño | Dinero |
|---|---|---|---|---|---|
| C1 | Hay que elegir cliente en cada venta; al terminar se borra. Si cobra sin cliente se abre el selector y luego hay que pulsar Cobrar otra vez (`POS.tsx`, `api.ts`). | Dejar «Consumidor final» por defecto y seguir directo al cobro después de elegir. | Sin IA en uso | Pequeña | Solo pantalla |
| C2 | Una venta simple en efectivo son 4 pasos: Cobrar, escribir monto, «Agregar pago», «Finalizar venta». El cambio solo aparece después de agregar el pago. | Botón «Cobrar exacto en efectivo», cambio visible mientras escribe, Enter para terminar. | Sin IA en uso | Mediana | **Toca dinero** (ruta de cobro; los totales no cambian) |
| C3 | Hay tres entradas al crédito: el atajo «Vender a crédito» y los botones «Contraentrega» y «Crédito», los dos con el mismo ícono. | Dejar una sola entrada clara. | Sin IA en uso | Pequeña | **Toca dinero** (cercano) |
| C4 | Pago con tarjeta pide 5 datos (últimos 4, aprobación, marca, terminal, tipo). | (1) Recordar la última terminal y marca. (2) Foto del voucher y la IA llena los campos; la cajera confirma. | (1) Sin IA en uso · (2) Con IA en uso | Pequeña · Mediana | (2) **Toca dinero** (datos del pago) |
| C8 | El buscador compara palabras literales. Dictar «la proteína de vainilla grande» no encuentra un producto con nombre en inglés. | (1) Tabla de apodos por producto. (2) Si no hay resultados, la IA sugiere candidatos y la cajera toca el correcto; nunca agrega sola. | (1) Sin IA en uso · (2) Con IA en uso | Mediana | Solo pantalla |
| C13 | Hay que memorizar F2/F4/F8/F12 y el límite de 10 % de descuento, que solo se avisa al pasarlo. | Mostrar «hasta 10 % sin PIN» junto al descuento y avisar del PIN antes de cobrar. | Sin IA en uso | Pequeña | Solo pantalla |
| C14 | La cámara se cierra después de cada código. | Modo de escaneo continuo. | Sin IA en uso | Pequeña | Solo pantalla |
| C15 | «Stock insuficiente.» no dice cuánto queda ni qué hacer. | «Solo quedan N; avisa a gerencia». | Sin IA en uso | Pequeña | Solo pantalla |

### Ventas, caja y avisos

| Cód. | Qué pasa hoy | Mejora | IA | Tamaño | Dinero |
|---|---|---|---|---|---|
| C9 | En Ventas solo se busca por número o fecha; lo que le piden es «la venta de fulana de hace días». | Buscar por cliente, producto o monto, y lista «mis últimas 10». | Sin IA en uso | Pequeña–Mediana | Solo pantalla |
| C10 | El cierre de caja es un formulario largo sin paso de revisión; los errores que piden PIN o justificación salen después de enviar. | Asistente por pasos (contar, tarjeta, entregado, revisar, confirmar). Opcional: leer por foto el lote del Verifone. | Sin IA en uso · opcional con IA | Mediana | **Toca dinero** (cercano; mismo envío) |
| C11 | «Cancelar solicitud» actúa con un solo toque; la X de una línea no tiene deshacer; recuperar una venta en espera usa un aviso del navegador. | Mismo patrón de confirmar/deshacer en todos. | Sin IA en uso | Pequeña | Solo pantalla |
| C6 | Se ven claves internas: método de pago `cash`/`cod` en solicitudes de anulación, «Datos usados: mis_ventas», el error de cámara en inglés, «SKU». | Etiquetas en español. | Sin IA en uso | Pequeña | Solo pantalla |
| C12 | Títulos de adorno en vez del nombre de la tarea: «Una caja que siempre cuadra», «Cada venta tiene una historia», «Personas que vuelven a elegirte». | Títulos directos: Caja, Ventas, Clientes, Recibo. | Sin IA en uso | Pequeña | Solo pantalla |

### Ayuda y asistente

| Cód. | Qué pasa hoy | Mejora | IA | Tamaño | Dinero |
|---|---|---|---|---|---|
| C5 | La ayuda contradice la pantalla: dice «Cliente de mostrador» y la pantalla «Consumidor final»; dice contar transferencias al cierre y el sistema ya las suma; el manual manda avisar al administrador de palabra aunque existe «Solicitar anulación». | (1) Corregir los textos. (2) Que Norexos responda «cómo se hace» leyendo el manual, para tener una sola fuente. | (1) Sin IA en uso · (2) Con IA en uso | Pequeña · Mediana | Solo pantalla |
| C7 | A la cajera el asistente solo le responde sobre sus ventas, y con caja abierta solo cantidades. El ejemplo que muestra no lo puede preguntar. Deducido: hoy le sirve poco. | Darle consultas de solo lectura: precio y existencia, sus solicitudes pendientes, cómo se hace; ejemplos propios y micrófono. | Con IA en uso | Mediana | Solo lectura |
| C16 | Las respuestas libres de la encuesta de cajeras se leen a mano. | Resumen por IA para la dueña. | Con IA en uso | Pequeña | Solo lectura |

**Ya está bien y no se toca:** venta sin conexión y reintentos, manejo de errores del lector, protección al elegir cliente con Enter, avisos de qué falta al cobrar, texto de confirmación del crédito.

---

## 4. Parte B — lo que usa la dueña

| Cód. | Qué pasa hoy | Mejora | IA | Tamaño | Dinero |
|---|---|---|---|---|---|
| D1 | El cierre diario en PDF y la lista de señales (anulaciones repetidas, descuentos aprobados por el mismo vendedor, ventas bajo costo o bajo 15 %, crédito sin cliente, faltantes) los produce un agente externo con `reportes.py`. Dentro del sistema solo existe una parte. | Pasar esas reglas al sistema: tarjeta «Revisión del día» en Resumen y resumen automático por Telegram/correo al cierre. Opcional: párrafo de la IA encima. | Sin IA en uso · opcional con IA | Mediana | Solo lectura |
| D2 | El asistente no responde sobre caja, transferencias ni inventario. | Terminar y mezclar el asistente «analista». | Con IA en uso | Pequeña–Mediana | Solo lectura |
| D3 | El asistente es un cuadro de texto: sin ejemplos, sin micrófono, sin seguimiento, y muestra nombres internos. | Preguntas sugeridas, micrófono, fuentes en español; memoria corta de la conversación. | Sin IA en uso (ejemplos, micrófono) · Con IA en uso (memoria) | Pequeña · Mediana | Solo pantalla |
| D4 | Los reportes hay que interpretarlos; algunos encabezados salen en inglés o como clave (`sold60Days`). | Encabezados en español y una línea «qué dice este reporte» arriba. | Sin IA en uso · Con IA en uso (la línea) | Pequeña · Mediana | Solo pantalla |
| D5 | Claves internas a la vista: permisos (`sale:write`), bitácora con códigos, tipo de movimiento de inventario, funciones del medidor de IA. | Etiquetas en español y bitácora en frases («María cambió el costo de X»). | Sin IA en uso | Pequeña–Mediana | Solo pantalla |
| D6 | Las transferencias se verifican una por una contra la app del banco. | Subir el estado del banco (foto, PDF o archivo); el sistema empareja por monto, referencia y fecha y deja marcadas las coincidencias; la dueña confirma. | Con IA en uso (foto/PDF) · Sin IA en uso (archivo) | Mediana–Grande | **Toca dinero** (estado del pago; siempre con confirmación) |
| D7 | El recordatorio semanal de crédito le llega solo a la dueña; la pantalla de créditos no tiene forma de contactar al cliente. | Botón «Recordar por WhatsApp» por deudor, con saldo y antigüedad; colores por antigüedad. | Sin IA en uso | Pequeña | Solo lectura |
| D8 | Cargar costos y entradas de mercancía depende de un agente externo o de un Excel con formato exacto, difícil en celular. La lista «sin costo» solo muestra, no deja corregir. | Formulario de celular «Entró mercancía: producto, cantidad, costo» que muestra el costo promedio antes y después; costo editable desde la lista «sin costo»; opcional: dictarlo y que la IA lo convierta en esa misma vista previa. | Sin IA en uso · opcional con IA | Mediana | **Toca dinero** (inventario y costos; reutiliza el promedio ponderado existente) |
| D9 | La sugerencia de reposición es fija (20 menos existencia). | Lista «Qué pedir esta semana» según velocidad de venta, para exportar o enviar al proveedor. | Sin IA en uso | Mediana | Solo lectura |
| D10 | Avisos y aprobaciones piden abrir el sistema. Deducido: Telegram avisa cada venta y hace ruido. | Elegir qué avisos recibir y un resumen diario. Aprobar una anulación desde el mensaje. | Sin IA en uso | Pequeña–Mediana | Preferencias: solo pantalla · Aprobar anulación: **toca dinero** |
| D11 | El medidor de IA muestra «sin precio» y tokens. | «Este mes: X preguntas, aprox. RD$ Y» y cuántas quedan hoy. | Sin IA en uso | Pequeña | Solo pantalla |
| D12 | La guía de la dueña y el manual están escritos para técnicos y fuera del sistema. | Ayuda con buscador dentro del sistema; opcional: preguntarle al manual por el asistente. | Sin IA en uso · opcional con IA | Mediana | Ninguno |

---

## 5. Orden recomendado

**Fase 1 — Limpieza de pantalla (sin IA en uso, sin tocar dinero).** C1, C5(1), C6, C11, C12, C13, C14, C15, D5, D11. Son cambios pequeños que quitan confusión todos los días y no tienen riesgo de dinero.

**Fase 2 — Menos pasos y menos dependencia de terceros (sin IA en uso).** C9, C4(1), D1, D7, D9, D3 (ejemplos y micrófono), D4 (encabezados), D10 (preferencias y resumen). Con confirmación de la dueña, una por una: C2, C3, C10, D8.

**Fase 3 — IA en uso (requiere encender la clave).** Primero encender «Preguntar a Norexos» y mezclar D2. Luego C7, C5(2), D3 (memoria), D4 (línea de resumen), C8(2), C16, D12. Al final, con confirmación de la dueña: C4(2), D6, D10 (aprobar anulación desde el mensaje).

Por qué este orden: la Fase 1 mejora el uso diario sin gasto ni riesgo; la Fase 2 saca del sistema la dependencia de un agente externo para el cierre y los costos; la Fase 3 gasta por uso, así que conviene llegar con las pantallas ya claras.

---

## 6. Instructivo: cómo se debe hacer cada mejora

Aplica a cualquier persona o agente que reciba una de estas mejoras.

1. **Una mejora por rama.** Nombre `mejora/<código>-<nombre-corto>` salida de `origin/nexora-cloud`. No mezclar dos códigos en una rama.
2. **Antes de escribir código:** leer la fila de la mejora aquí, abrir los archivos nombrados y confirmar que el problema sigue igual. Si cambió, avisar a Norexos 1 y no seguir.
3. **Mejoras «Solo pantalla» y «Solo lectura»:** no cambian cifras, cálculos ni permisos. Si para hacerlas hace falta tocar un cálculo, la mejora deja de ser de esta clase: parar y avisar.
4. **Mejoras «Toca dinero»:** requieren el sí directo de la dueña para esa mejora antes de empezar. Deben reutilizar la lógica existente (promedio ponderado, anulación, cierre de caja), llevar pruebas que comparen las cifras antes y después, y pasar por revisión de Norexos 1 antes de mezclar.
5. **Mejoras «Con IA en uso»:**
   - La IA solo lee o propone. Nunca cobra, anula, cambia inventario ni costos por su cuenta: siempre hay una vista previa y una persona que confirma.
   - Respetar el límite diario por usuario y registrar el uso en el medidor.
   - Respetar lo que cada rol puede ver: una cajera no recibe costos, márgenes ni montos que el sistema le oculta con caja abierta.
   - No guardar el texto de las preguntas ni datos de clientes fuera del sistema.
   - Si la IA está apagada o falla, la pantalla debe seguir funcionando sin ella.
6. **Textos:** español sencillo, el mismo nombre para la misma cosa en pantalla, ayuda y manual. Si se cambia un texto de pantalla, corregir también `QuickQuestions.tsx` y `docs/MANUAL-CAJERO.md`.
7. **Verificación antes de empujar:** `pnpm db:generate`, luego `pnpm check` completo (no solo typecheck y lint). Si se toca `apps/web/src/api.ts`, correr `tests/seguridad-menor.test.ts`. Si se mueven líneas de archivos citados en `docs/sistema/`, correr `node scripts/citas-reanclar.mjs`.
8. **Un solo push por mejora** y esperar los 3 CI (`verify`, `windows-installer`, `render-images`). Las 4 pruebas e2e de `HALLAZGO_CI_4_PRUEBAS_11NOV.md` fallan desde antes; cualquier otra falla es de la mejora.
9. **Prueba en navegador y en celular** antes de darla por terminada, con captura de la pantalla antes y después.
10. **Mezcla y despliegue los hace solo Norexos 1:** con los CI revisados, sin cajas abiertas, API primero y web después. Nadie más despliega.
11. **Al terminar:** anotar en `docs/sistema/CAMBIOS.md` y marcar la mejora como hecha en este documento.

---

## 7. Decisiones que necesita la dueña

1. **¿Se enciende la IA?** Hace falta la clave del proveedor (se pide por formulario seguro, no por chat), elegir plan (`medio` o `completo`) y aprobar el tope de US$0.40 por usuario al día del asistente analista. Sin esto la Fase 3 no arranca.
2. **¿Aprueba el orden de las tres fases, o quiere adelantar alguna mejora?**
3. **Mejoras que tocan dinero:** C2, C3, C4(2), C10, D6, D8 y aprobar anulaciones desde el mensaje (D10). ¿Cuáles sí y cuáles no?
4. **C1:** ¿está de acuerdo en que la venta salga a «Consumidor final» si la cajera no elige cliente?
5. **C12:** ¿se cambian los títulos de adorno por nombres directos?
6. **¿A quién se delega cada fase?**

---

## 8. Lo que no se verificó

- Ninguna pantalla se probó en navegador ni en celular para este levantamiento; los pasos se contaron leyendo el código.
- El valor real de `IA_VENTAS_PLAN` y si Telegram y el correo están configurados en producción.
- El módulo GV (inscripciones) no se revisó a fondo.
- Marcado «deducido»: que el asistente hoy le sirve poco a la cajera (C7) y que Telegram hace ruido (D10).
- No hay cifras de cuánto tiempo ahorra cada mejora; habría que medirlo con las cajeras.
