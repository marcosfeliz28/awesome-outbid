# Resultados de ChatGPT NUBE

## 2026-11-09 · Auditoría de `claude-pc/asistente-analista`

**Rama auditada:** `origin/claude-pc/asistente-analista`

**Commit auditado:** `2558b4632042b72da8e6c441174c61655c3d8ddb`

**Alcance:** solo lectura; no se modificó el código auditado.

### Veredicto

La entrega conserva las barreras principales de seguridad: las herramientas no aceptan empresa, sucursal ni usuario; el actor autenticado fija el alcance; una cajera solo recibe sus cajas y nunca esperado/diferencia; los campos de costo, utilidad y margen se eliminan sin `profit:read`; y las herramientas nuevas no escriben. Sin embargo, **no cumple todavía el criterio de aceptación de 100/100 ni aplica la lectura independiente en todas las cifras combinadas**.

### Hallazgos

1. **ALTA · El arnés pasa aunque 8 de 100 casos fallan.** `tests/ia-analista-eval.test.ts:13-25,52-54` declara como aceptables ocho fallos conocidos y comprueba precisamente que sigan fallando. La ejecución dio **92/100**: datos 53/61, derivados 5/5, rechazos 28/28 y prompt 6/6. Fallaron `AA-005`, `AA-019`, `AA-020`, `AA-029`, `AA-035`, `AA-040`, `AA-043` y `AA-044`; son diferencias entre cifras brutas y netas tras una devolución. Esto contradice `docs/ia/ASISTENTE_ANALISTA_SPEC.md:79-85` y `docs/ia/ASISTENTE_ANALISTA_EVAL_100.md:160-163`, que exigen 100/100. **Arreglo propuesto:** decidir y documentar una sola semántica para bruto, devolución y neto; hacer que el servidor entregue ambos cuando la pregunta los distinga; quitar `HUECOS` y exigir `filas.every(f => f.pasa)`.

2. **ALTA · La reconciliación por caminos independientes es parcial.** `apps/api/src/assistant.ts:737-774` calcula total y agrupación de transferencias a partir de la misma lista; `:838-864` usa únicamente `no-movement`; `:866-890` usa una sola ejecución del reporte; y `:960-991` compara dos períodos, pero cada período sale de una sola lectura de `dashboardBreakdown` (`:446-481`). Solo resumen, cuadre, cierres e inventario tienen una segunda fuente efectiva. Esto no satisface la regla de lecturas independientes de `ASISTENTE_ANALISTA_SPEC.md:39-47`, especialmente para cifras combinadas. **Arreglo propuesto:** añadir controles verdaderamente independientes (agregado SQL/reporte distinto y lectura de excepciones), devolver siempre `verificacion`, y bloquear la afirmación categórica si falta o discrepa una fuente.

3. **MEDIA · `transferencias_pendientes` omite el cliente exigido.** El endpoint sí devuelve `customer` (`apps/api/src/sales.ts:3048-3077,3098-3129`), pero la herramienta lo descarta al mapear la respuesta (`apps/api/src/assistant.ts:765-771`). La especificación lo pide expresamente en `ASISTENTE_ANALISTA_SPEC.md:31`. **Arreglo propuesto:** incluir `cliente: t.customer` y agregar una regresión que lo compruebe sin exponer otros datos personales.

4. **MEDIA · La cajera queda más restringida que la matriz aprobada.** `apps/api/src/assistant.ts:328-336` encierra `inventario_bajo`, `productos_sin_ventas` y `explicar_reporte` dentro de `!isSeller(actor)`, aunque `ASISTENTE_ANALISTA_SPEC.md:57-58` permite a la cajera inventario/sin ventas si posee el permiso y explicar sus reportes autorizados. **Arreglo propuesto:** autorizar por permiso de la fuente, no por nombre del rol, manteniendo siempre la eliminación de costos y el cierre ciego; añadir pruebas de cajera con y sin cada permiso.

5. **MEDIA · Los topes implementados no corresponden a las cuotas comerciales y el margen total ≥15 % no está demostrado.** `apps/api/src/assistant.ts:36-46,1082-1104` fija 30 preguntas por usuario/día y US$0.40 por usuario/día, con el propio comentario “PENDIENTE de aprobar”. No aplica las cuotas mensuales 100/250/600/1,500 de `ASISTENTE_ANALISTA_COSTOS.md:34-45`, ni alertas 70/90/100 o P95. El cálculo unitario sí usa la tabla central de precios al cerrar el uso (`assistant.ts:1261-1274`), pero el documento reconoce que faltan hosting, soporte, impuestos, ventas y cobros (`ASISTENTE_ANALISTA_COSTOS.md:47-55`). **Arreglo propuesto:** no vender el tope actual como garantía; medir P95, incorporar costo no IA y tasa aprobada, y aplicar cuota mensual por plan/paquete antes del lanzamiento.

### Evidencia de pruebas

- `pnpm exec vitest run tests/ia-analista-eval.test.ts --reporter=verbose`: código 0, pero la salida funcional fue **92/100** con los ocho fallos enumerados arriba.
- `pnpm exec vitest run tests/assistant-unit.test.ts --reporter=verbose`: **22/22** pasaron.
- El intento directo de `tests/assistant-api.test.ts` con `vitest.integration.config.ts` no llegó a ejecutar pruebas porque esa configuración espera una API ya levantada: `No hay una API que responda en http://127.0.0.1:3001/api (ECONNREFUSED)`. No se atribuye al código; la prueba PostgreSQL/API queda a cargo de `verify`.
- En la rama de este informe, `pnpm check` terminó con código 0: typecheck y ESLint pasaron; **112 archivos de prueba pasaron y 1 se omitió, 989 pruebas pasaron y 10 se omitieron**; los builds web y API pasaron. Vite emitió la advertencia preexistente de un chunk mayor de 500 kB.
- CI del commit auditado al cerrar este informe: `windows-installer` y `render-images` en verde; `verify` todavía en ejecución. No se presenta esa rama como aceptada.

### Autoauditoría y límites

- Revisé herramientas, esquemas Zod, selección por rol/permiso, `liveDeps`, filtrado por sucursal, cierre ciego, eliminación recursiva de costo/utilidad/margen, medición de uso, topes y las 100 expectativas sin llamar a Anthropic.
- Confirmé que no hay herramientas de escritura y que parámetros extra como `branchId`, empresa o usuario se rechazan. Las pruebas unitarias cubren inyección y preservación del actor; la integración cubre que las filas reales pertenecen a la sucursal activa.
- No se desplegó, no se tocó Render, producción, la base de la tienda ni credenciales. La prueba API local no se considera ejecutada y el comportamiento con PostgreSQL real debe confirmarse en `verify`.

### Decisiones de la dueña

1. Confirmar si las preguntas AA-005/019/020/029/035/040/043/044 deben responder **bruto y neto por separado** (recomendado) o cambiarse a neto; no deben quedar fallos “aceptados”.
2. Aprobar o reemplazar el tope provisional de US$0.40 por usuario/día solo después de medir P95 y conocer costos no IA. Hasta entonces no se puede certificar margen total ≥15 %.

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
