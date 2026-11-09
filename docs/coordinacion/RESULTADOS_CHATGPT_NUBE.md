# Resultados de ChatGPT NUBE

## 2026-11-09 · Auditoría del Asistente analista · `chatgpt-nube/auditoria-asistente-9nov`

**Rama auditada:** `origin/claude-pc/asistente-analista` en `9d419f3052ea2c758814cb0ade2d0d1156135a3d`
**Alcance:** contraste con `docs/ia/ASISTENTE_ANALISTA_SPEC.md`, `ASISTENTE_ANALISTA_EVAL_100.md` y `ASISTENTE_ANALISTA_COSTOS.md`; permisos por rol, sucursal, cierre ciego, doble lectura, medición y cuotas. Solo lectura sobre la rama objetivo.

### Veredicto

La ampliación conserva el aislamiento por sucursal y los permisos de las pantallas reutilizadas. La cajera recibe únicamente `mis_ventas` y sus propias cajas, sin esperado ni diferencia; administración conserva los controles `reports:read`, `sale:manage`, `catalog:read`, `cash:write` y `profit:read`. Las herramientas no aceptan empresa, sucursal ni usuario enviados por el modelo y no encontré una herramienta de escritura.

No debe presentarse todavía como cumplimiento completo de la especificación ni como cuota comercial cerrada. El arnés ahora imprime **100/100**, pero no se corrigió ninguna lectura: se cambiaron ocho expectativas de bruto a neto mientras el documento canónico `ASISTENTE_ANALISTA_EVAL_100.md` conserva las ocho respuestas brutas. Contra el conjunto que la orden obliga a auditar, la implementación sigue coincidiendo en **92/100**. Además, las cuotas vendidas por empresa y mes no son las que aplica este código.

### Hallazgos

| ID · gravedad | Evidencia | Impacto | Arreglo propuesto |
|---|---|---|---|
| ANA-01 · **Alta** | El commit nuevo no cambia `assistant.ts`; solo cambia `tests/ia-analista-eval.test.ts:13-15,42-43` y las expectativas de `tests/ia-analista/casos.ts:657-662,786-798,910-926,975-983,1039-1052,1090-1105`. En cambio, `docs/ia/ASISTENTE_ANALISTA_EVAL_100.md:26,45-46,60,66,71,79-80` todavía exige RD$274.58, +300/+3, ranking 10/5/3, bruto y neto, efectivo 800 y 44.44 %. La ejecución imprime 100/100 porque espera 244.07, +100/+1, 8/5/3, 600 y 37.5 %. | Se cambió el oráculo para ajustarlo al resultado existente sin actualizar el conjunto canónico ni la lógica. Por tanto, «100/100» no significa 100 respuestas conformes a la evaluación solicitada y relaja la regresión de ocho cifras sensibles. `docs/sistema/IA_ANALISTA.md` atribuye el cambio a un «procede» de la dueña, pero no cita una decisión verificable en coordinación. | Si la dueña realmente aprobó neto, registrar la decisión y actualizar en el mismo cambio el documento canónico, la terminología de las preguntas y todos sus cálculos; entonces el 100/100 será trazable. Si no, restaurar el oráculo bruto e implementar lecturas brutas y netas separadas. Hasta resolverlo, reportar «100/100 del arnés modificado; 92/100 contra EVAL_100», no precisión 100/100. |
| ANA-02 · **Alta** | `apps/api/src/assistant.ts:38-46,99-105,1216-1246`: el plan `analista` permite 30 preguntas **por usuario y día** y US$0.40 **por usuario y día**. `docs/ia/ASISTENTE_ANALISTA_COSTOS.md:36-55` y `docs/coordinacion/ORDENES_24OCT_NOCHE_PRODUCTO.md` definen 100/250/600/1,500 preguntas **por plan y mes**, con paquetes mensuales. No hay consulta ni reserva mensual por empresa/plan en esta rama. | Un negocio Autoservicio con una sola persona puede reservar hasta unas 900 preguntas en un mes de 30 días frente a las 100 vendidas; con varias personas el consumo se multiplica. Por eso el margen ≥15 % y los paquetes no quedan protegidos por estos topes. | Reutilizar la cuota mensual de la empresa y sus paquetes como autoridad; reservar de forma atómica por empresa/mes y luego aplicar, si se desea, un límite diario secundario. Probar 100/101, reinicio de mes, paquete extra, dos usuarios simultáneos y dos sucursales de la misma empresa. El monto US$0.40, marcado PENDIENTE, no debe activarse como decisión comercial sin aprobación. |
| ANA-03 · **Media** | `tests/ia-analista/casos.ts:456-505`: el arnés sin Anthropic inyecta de antemano las herramientas correctas de cada caso y la respuesta final es siempre `(respuesta simulada)`. `tests/ia-analista-eval.test.ts:45-59` declara 28/28 rechazos y 6/6 casos de prompt a partir de llamadas guionadas y presencia de texto en el prompt, no de la respuesta al usuario. | El indicador, sea 92/100 contra el documento o 100/100 contra el oráculo modificado, mide principalmente cálculos, esquemas y permisos del servidor. No demuestra que el asistente elija la herramienta correcta, rechace una inyección en su respuesta ni redacte la cifra esperada. El script real existe, pero requiere Anthropic y no corre en CI. | Separar el indicador en «backend determinista» y «respuesta del modelo». Mantener el arnés sin red para seguridad de herramientas, pero no llamarlo precisión de respuestas. Añadir fixtures deterministas de respuestas para validar el posprocesador y ejecutar el arnés real controlado antes del piloto, registrando acierto por selección, cifra y redacción sin guardar PII. |
| ANA-04 · **Media** | `apps/api/src/assistant.ts:567-617,693-733,801-835` sí añade `verificacion` por dos lecturas a cuadre, cierres e inventario. En cambio `transferencias_pendientes` (`737-774`) calcula total y bancos desde la misma lista; `productos_sin_ventas` (`838-864`) usa una sola lectura; `explicar_reporte` (`866-890`) también. El prompt de `1061-1077` solo obliga a advertir cuando recibe `verificacion.cuadra=false`. | Algunas cifras nuevas pueden presentarse como confirmadas sin el control por dos caminos solicitado en la orden. Sumar la misma lista de dos maneras no es una lectura independiente. | Añadir una lectura de control independiente para cada total que se vaya a afirmar o devolver `verificacion` con lectura faltante y el aviso «No puedo confirmarlo con seguridad». Cubrir discrepancia, timeout y ausencia de una fuente en pruebas. |
| ANA-05 · **Media** | `apps/api/src/assistant.ts:1228-1273`: la reserva serializa por usuario, pero crea la fila con costo nulo; el costo se escribe al terminar. Varias solicitudes consecutivas/concurrentes pueden reservar las 30 plazas mientras la suma visible sigue bajo US$0.40. Una solicitud también puede cruzar el tope porque se comprueba solo el gasto anterior. | El tope de costo no es un techo estricto y no basta para garantizar el presupuesto indicado. El exceso máximo crece con las solicitudes en vuelo. | Reservar un costo conservador por pregunta dentro de la transacción y reconciliarlo al finalizar, o limitar a una solicitud en vuelo por usuario hasta `settle`. Probar concurrencia en el borde del tope y una pregunta que lo cruza. |

### Comprobaciones que pasaron

- Aislamiento: `liveDeps` pasa siempre el `actor` autenticado a reportes, caja, transferencias e inventario; esos controladores filtran por `actor.branchId`. Los esquemas estrictos rechazan `branchId`, `sucursal`, `empresa`, `tenant`, `company`, `userId` y `usuario`.
- Caja ciega: `CashController.sessionsFor` limita a `userId` cuando falta `sale:manage` y no calcula ni devuelve esperado/diferencia cuando `canViewCashExpected` es falso (`cash.ts:765-827`).
- Ganancia/costo: las rutas de reportes conservan `profit:read`; la salida adicional se limpia para quien no puede verla. No encontré una reproducción de costo o ganancia expuestos a cajera.
- Solo lectura: las diez herramientas ofrecidas son consultas; una herramienta desconocida o no autorizada se rechaza antes de acceder a datos.
- Rama objetivo: los tres trabajos del commit auditado están verdes en la ejecución `42623388599`: `verify`, `windows-installer` y `render-images`. Ese verde confirma consistencia técnica del oráculo modificado, no conformidad con las ocho respuestas que siguen publicadas en `ASISTENTE_ANALISTA_EVAL_100.md`.

### Pruebas y límites

- `pnpm install --frozen-lockfile`: pasó; 925 paquetes reutilizados desde el almacén local.
- `pnpm db:generate`: pasó.
- Arnés focal sin Anthropic: 31/31 pruebas técnicas verdes y salida declarada **100/100**. La comparación independiente contra el documento canónico detecta las mismas ocho divergencias de ANA-01; el código funcional no cambió.
- `pnpm check` sobre `9d419f30`: código 0; typecheck y ESLint verdes; **113 archivos pasaron y 1 se omitió, 998 pruebas pasaron y 10 se omitieron**; builds web/API verdes. Vite emitió la advertencia conocida de un chunk mayor de 500 kB.
- No se llamó a Anthropic ni se usó clave. No se comprobó calidad lingüística del modelo real, latencia P95 ni costo P95. No se usó producción, Render, credenciales ni la base de la tienda; no se desplegó ni se modificó la rama auditada.

### Decisiones pendientes

1. Norexos 1 debe enlazar la decisión verificable de la dueña sobre bruto/neto. Si fue neto, debe autorizar también la actualización de `ASISTENTE_ANALISTA_EVAL_100.md`; si no, el arnés debe volver a la expectativa original. Una prueba no debe cambiar por sí sola la regla publicada.
2. La dueña debe aprobar o rechazar el tope de US$0.40 por usuario/día. Antes de vender, el producto necesita una cuota mensual real por empresa que corresponda a 100/250/600/1,500 y paquetes.

## 2026-11-08 · Asistente analista · `chatgpt-nube/asistente-analista`

- **Qué hice:** documenté el producto de IA analítica en `docs/ia/ASISTENTE_ANALISTA_SPEC.md`: ocho grupos de preguntas, las cinco herramientas actuales, seis lecturas faltantes, matriz de permisos para dueña/gerente/cajera y reconciliación obligatoria por tres caminos. Preparé `ASISTENTE_ANALISTA_EVAL_100.md` con exactamente 100 preguntas, respuestas y cálculos deterministas, incluidas trampas de PIN, otra empresa/sucursal, anulaciones, escrituras e inyección. En `ASISTENTE_ANALISTA_COSTOS.md` calculé cuatro escenarios con las tarifas implementadas en `ai-prices.ts` y conservé las cuotas vigentes de 100/250/600/1,500 preguntas.
- **Regresión documental:** antes, las tres comprobaciones `test -f` terminaron con código 1 porque los entregables no existían. Después, los tres archivos existen y no están vacíos; `rg -o 'AA-[0-9]{3}' ... | sort -u | wc -l` devuelve `100`; las búsquedas de PIN, otra sucursal, anulación, inyección, solo lectura, triple lectura y margen del 15 % pasaron. `git diff --check` pasó. Tras preparar el worktree con `pnpm install --frozen-lockfile` y `pnpm db:generate` (sin conectar ni migrar una base), `pnpm check` terminó con código 0: typecheck y lint pasaron, **112 archivos de prueba pasaron y 1 se omitió; 984 pruebas pasaron y 10 se omitieron**; los builds web/API pasaron. Vite emitió la advertencia no bloqueante ya conocida de un chunk mayor de 500 kB.
- **Autoauditoría:** las herramientas propuestas no aceptan empresa/sucursal desde el modelo y no escriben; cada una reutiliza una fuente existente y conserva el permiso del flujo original. La cajera no recibe totales gerenciales, costo, utilidad, esperado ni diferencia de cierre. Las anulaciones, devoluciones, pendientes y datos offline se tratan como excepciones, no como ingresos confirmados. Los cálculos monetarios tienen dos decimales y los porcentajes evitan dividir entre cero. Revisé que los casos AA-001 a AA-100 sean únicos y que los bloqueantes de seguridad estén identificados.
- **Costos y límites:** los tokens son supuestos, no mediciones. La tasa RD$65/US$ es una reserva de planificación, no una tasa vigente confirmada. Con una reserva de tres veces el techo estimado, el margen después de IA queda entre 78.3 % y 91.9 % en planes y entre 69.5 % y 74.6 % en paquetes. Esto no demuestra margen total ≥15 % porque faltan costos de hosting, soporte, impuestos y ventas; el documento incluye la fórmula para comprobarlo antes de vender.
- **Incidencias de preparación:** la primera ejecución de `pnpm check` falló con `tsc: not found` porque el worktree no tenía `node_modules`. Después de instalar desde el lockfile, la segunda falló en typecheck con errores como `Property 'customer' does not exist on type 'Database'` porque Prisma aún no estaba generado. No fueron fallos del cambio documental; tras generar el cliente, la corrida completa quedó verde.
- **Qué falta:** implementar y probar las seis herramientas en otra orden; medir promedio/P95 reales durante el piloto; aportar costos no IA y tasa cambiaria administrativa para certificar margen total. No se tocó código funcional, Render, producción, base ni credenciales; no se desplegó.

## 2026-11-07 · Auditoría del arreglo `flaky-password-telegram`

**Rama:** `chatgpt-nube/auditoria-flaky-password`  
**Base auditada:** `origin/nexora-cloud` en `1a42e1f3`; arreglo de origen `5815b56e` y adaptación de dobles `a8d8fb86`.

### Veredicto

**No encontré un hueco explotable de fuerza bruta.** El cambio de `update` a `updateMany` en `apps/api/src/security.ts:213-231` únicamente evita P2025 si una operación autorizada de cambio de contraseña ya borró la fila. En un fallo, el cupo de cuenta se reconstruye con el estado leído más ese fallo mediante `upsert` (`security.ts:244-265`); al llegar a 30 queda bloqueado durante el resto de la ventana y el intento siguiente se rechaza antes de ejecutar la comparación (`security.ts:200-208`).

La carrera requiere que, al mismo tiempo, termine con éxito un cambio o restablecimiento autorizado de contraseña. Esas operaciones incrementan `authVersion`; las claves de bloqueo incluyen esa versión (`apps/api/src/auth.ts:76-79`). Por eso el borrado/reinicio no permite seguir adivinando la contraseña anterior y el siguiente inicio usa otra identidad de bloqueo. El intento que pierde la carrera puede no incrementar su contador propio de 5 porque la fila desapareció antes del `UPDATE` crudo (`security.ts:237-243`), pero sí incrementa el cupo de cuenta y su credencial ya quedó invalidada. Un atacante no autenticado no dispone de una ruta para provocar ese borrado.

### Regresión y evidencia

- Añadí al test existente un caso de frontera: parte de 29 fallos, borra las filas dentro de la verificación, exige que el fallo 30 recree el cupo con `lockedUntil` y comprueba que el intento 31 no llama al verificador.
- Antes del arreglo (`75c20b3f`, padre de `5815b56e`): `tests/intentos-borrados.test.ts` falla **3/3**; el caso nuevo devuelve `Error: P2025` en vez de `{ status: 400, message: "Incorrecta." }`.
- Después (`1a42e1f3` + la regresión): `tests/intentos-borrados.test.ts` pasa **3/3**.
- Cobertura relacionada ya existente: `tests/auth-lockout.test.ts` comprueba el tope de 30 por cuenta y `tests/password-account.test.ts` la carrera de dos cambios simultáneos contra API/PostgreSQL.

### Autoauditoría y límites

- Revisé los tres caminos: acierto con fila borrada, fallo ordinario con fila borrada y frontera 29→30→rechazo 31.
- Revisé cambio obligatorio, cambio propio, restablecimiento administrativo y marcado de cambio obligatorio. Todos invalidan credenciales mediante `authVersion`; el reinicio de intentos es posterior a una operación autorizada, no una ruta pública independiente.
- No cambié autenticación, permisos, mensajes, límites, base, migraciones ni código de producción; solo amplié la regresión y este informe.
- El doble unitario reproduce la desaparición de filas, no el planificador real de PostgreSQL. La carrera y los límites reales quedan a cargo de `verify` en CI. No se accedió a producción, Render, credenciales ni a la base de la tienda.

### Estado

`pnpm check` terminó con código 0: typecheck, ESLint, **112 archivos de prueba pasaron y 1 se omitió; 985 pruebas pasaron y 10 se omitieron**, y los builds web/API terminaron correctamente. Vite emitió la advertencia ya conocida por un chunk mayor de 500 kB; no es un fallo y esta auditoría no modifica el bundle. La rama solo se declarará lista después del push y de comprobar `verify`, `windows-installer` y `render-images` sobre el último commit.
