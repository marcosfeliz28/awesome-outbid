# T4 · Efectivo y caja ciega

Fecha: 2026-10-26  
Rama auditada: `origin/claude/producto-mezcla-4`  
Commit auditado: `1e7b1b25d91d0cadab1167e243eaac7d32b2d4a0`  
Método: auditoría estática; no se modificó código existente.

## Resumen

La separación por cajera y empresa está presente, y «¿cuánto vendí hoy?» usa la ruta rápida sin consumir cuota de IA. Sin embargo, la respuesta actual permite reconstruir el efectivo de una caja abierta. No es posible mostrar a la vez el total monetario exacto de la sesión abierta y garantizar una caja ciega.

## Hallazgos

### Alta · La cajera puede deducir el efectivo esperado de una caja abierta

**Evidencia:**

- `apps/api/src/reports.ts:1454-1458`: limita las ventas a la cajera, pero conserva sus importes.
- `apps/api/src/reports.ts:1462-1469`: detecta cuáles cajas propias siguen abiertas.
- `apps/api/src/reports.ts:1514-1535`: devuelve por separado el monto de transferencias pendientes.
- `apps/api/src/reports.ts:1523-1538`: devuelve el total neto y la última venta con importe.
- `apps/web/src/QuickQuestions.tsx:179-195`: muestra total y crédito aun con caja abierta.
- `apps/web/src/QuickQuestions.tsx:278-295`: muestra el monto de transferencias pendientes.
- `apps/web/src/QuickQuestions.tsx:358-367`: muestra el fondo inicial.

**Cómo reproducirlo:**

1. Abrir caja con RD$500.
2. Vender RD$100 en efectivo, RD$50 por transferencia pendiente y RD$30 a crédito.
3. Abrir «Preguntas»: se muestran total RD$180, crédito RD$30, transferencia pendiente RD$50 y fondo RD$500.
4. Calcular `180 - 30 - 50 = 100` de efectivo y, por tanto, RD$600 esperados en gaveta.

**Arreglo propuesto:** cuando la persona no pueda ver el efectivo esperado y tenga una caja propia abierta, no devolver ningún importe monetario derivado de esa sesión. Devolver solo cantidad de facturas, unidades y producto más vendido. Los importes se habilitan después del cierre.

### Media · «Transferencias pendientes» puede incluir cobros hechos por la dueña

**Evidencia:**

- `apps/api/src/reports.ts:1472-1475`: el desglose normal excluye pagos `installment`.
- `apps/api/src/reports.ts:1514-1522`: la consulta de transferencias pendientes no excluye `entryType = "installment"` ni filtra por la fecha del pago.

**Cómo reproducirlo:**

1. La cajera crea una venta a crédito.
2. La dueña registra después un abono por transferencia sobre esa venta.
3. Consultar «¿Tengo transferencias sin verificar?» desde la cajera.
4. El abono puede aparecer como propio de la cajera y quedar clasificado por la fecha de la venta, aunque lo registró la dueña en otra fecha.

**Arreglo propuesto:** excluir `entryType = "installment"` de «mis ventas», o crear un resumen separado de cobros propios filtrado por la persona que registró el pago y por `Payment.createdAt`.

### Media · La IA presenta un desglose parcial como si fuera completo

**Evidencia:**

- `apps/api/src/assistant.ts:1452-1466`: si `hiddenUntilClose` es verdadero, avisa que el desglose está oculto y a continuación imprime efectivo, tarjeta y transferencia.
- `apps/api/src/reports.ts:1497-1505`: esos campos contienen solo pagos de sesiones visibles; los de la caja abierta se omiten.

**Cómo reproducirlo:**

1. Abrir una caja y vender RD$100 en efectivo.
2. Preguntar a la IA «¿Cuánto vendí hoy?».
3. La respuesta puede decir total RD$100 y «Efectivo: RD$0», porque ocultó el pago abierto del desglose sin ocultar el total.

**Arreglo propuesto:** con `hiddenUntilClose = true`, omitir por completo importes y métodos y responder únicamente las métricas no monetarias permitidas por la caja ciega.

## Controles comprobados

- No se exponen costo ni margen en `/sales/mine`: `apps/api/src/reports.ts:1470-1541`.
- El catálogo usado por preguntas elimina costos: `apps/api/src/common.ts:437-446` y `apps/api/src/catalog.ts:349-360`.
- La IA niega costos a `seller` incluso si recibe por error `profit:read`: `apps/api/src/assistant.ts:1238-1240`.
- Las ventas se filtran por `sellerId = actor.id`: `apps/api/src/reports.ts:1454-1458`.
- Cotizaciones, solicitudes de anulación e incentivos también se limitan a la persona: `apps/api/src/admin.ts:805-809`, `apps/api/src/sales.ts:1865-1870` y `apps/api/src/incentives.ts:754-774`.
- La encuesta propia se limita al usuario y el resumen exige administración: `apps/api/src/cashier-survey.ts:13-41`.
- «¿Cuánto vendí hoy?» no reserva ni consume cuota: `apps/api/src/assistant.ts:1497-1508`. Limitación: la validación previa de `apps/api/src/assistant.ts:1486-1490` exige que exista `ANTHROPIC_API_KEY`.

## Regla exacta propuesta

Definir `cajaCiegaActiva` cuando el usuario no tenga permiso para ver el efectivo esperado y mantenga una caja propia abierta.

Mientras esté activa:

1. No devolver `total`, métodos, montos pendientes, devoluciones, última venta con importe ni totales semanales que incorporen la sesión abierta.
2. Sí devolver número de facturas, unidades y producto más vendido.
3. Mantener separados los datos de sesiones ya cerradas; nunca mezclarlos con los de la sesión abierta.
4. Excluir abonos `installment` y operaciones hechas por la dueña de «mis ventas».
5. Hacer que «Preguntas» y la IA consuman exactamente la misma respuesta ya redactada por el servidor.
6. Tras cerrar la caja, permitir los importes exactos de las ventas propias.
7. Mantener siempre prohibidos para la cajera costos, margen y ventas de otras personas.

## Pruebas pendientes

- PostgreSQL real: combinación de efectivo, crédito, transferencia pendiente, abono de la dueña y devolución con caja abierta y cerrada.
- API: afirmar que la respuesta abierta no contiene ningún importe con el que se reconstruya la gaveta.
- Web a 320 px y 390 px: verificar que el estado oculto no deje importes en texto, etiquetas accesibles ni mensajes de IA.

# T4 · Adenda de revisión independiente: superficies restantes y límites de la regla

Fecha: 26-oct-2026. Fuente auditada: `origin/claude/producto-mezcla-4`, SHA **`1e7b1b25d91d0cadab1167e243eaac7d32b2d4a0`**. Worktree: `/workspace/cola-t4`.

Esta adenda complementa el T4 ya publicado en `docs/coordinacion/chatgpt-nube-26oct/T4-efectivo-y-caja-ciega.md` (commit documental `7164256893e8d616098ced0acc386455951bc3e3`). **No lo reemplaza ni repite sus tres hallazgos**. Ese informe ya cubre inferencia desde total/crédito/transferencias, inclusión de abonos ajenos y desglose parcial presentado como completo; también registra la dependencia de la clave del proveedor antes del atajo gratuito.

**Sin hallazgos críticos nuevos confirmados.** El delta principal es que corregir únicamente `/sales/mine`, «Preguntas» y su respuesta gratuita deja intactos el historial propio y la herramienta IA de detalle. Hay además una diferencia de política para `seller` con `profit:read` y un conteo engañoso de encuestas vacías.

Solo se agrega este documento. Sin cambios de aplicación, pruebas existentes, migraciones ni workflows; sin API o base de producción, instalaciones, commit o push. Las propuestas siguientes **no son reglas de negocio aprobadas**.

## T4-D01 · Alta · El historial y el detalle de factura conservan la información que la propuesta quitaría de «Mis ventas»

### Evidencia en el SHA auditado

- `apps/api/src/sales.ts:1708-1763`: `GET /sales` exige `sale:write`, limita a `sellerId = actor.id` salvo quien tiene `sale:manage`, carga `payments` y `returns` y devuelve `saleHistoryDto`. Con fecha o búsqueda devuelve hasta 500 ventas.
- `apps/api/src/sales.ts:173-206`: el DTO publica `method`, `amount`, moneda, vuelto, tipo de entrada y datos de devolución, sin condición por caja abierta ni por `canViewCashExpected`.
- `apps/api/src/sales.ts:258-269`: devuelve los pagos y devoluciones de la venta; tampoco aplica una política de caja ciega aquí.
- `apps/api/src/assistant.ts:1007-1048`: `detalle_factura` consulta esa misma ruta y conserva cada forma de pago e importe en el resultado enviado al modelo. Su lista blanca elimina referencias y datos de tarjeta, pero no importes de una sesión abierta.

### Reproducción mínima propuesta

En una base descartable, una vendedora sin `profit:read` ni `sale:manage` abre su propia caja con RD$500 y completa una venta propia de RD$100 en efectivo, sin otros movimientos, devoluciones o dólares. Consulta su historial del día o el número de esa factura por `GET /api/sales?date=<día>` / `GET /api/sales?q=<número>`. El JSON incluye `payments: [{method: "cash", amount: 100, ...}]`.

Aunque se censure después `/sales/mine`, el historial permite reconstruir RD$600 en este caso. La IA puede recibir esos mismos datos con una pregunta de detalle de factura, sin necesitar que el atajo gratuito publique el total.

### Esperado y real

- **Esperado bajo la propuesta de cierre estricto del T4 anterior:** que la censura se aplique a todas las respuestas consolidadas de una sesión abierta y que una vía de detalle no evite esa política.
- **Real confirmado por código y ejecución local del DTO:** una vendedora ordinaria recibe método e importe; no recibe costos. La respuesta no considera si la caja sigue abierta.

No es una fuga entre vendedoras, ni prueba que cualquier total de ventas sea el saldo de gaveta. La igualdad del ejemplo depende expresamente de que no existan abonos, retiros, reembolsos, otros turnos ni pagos USD. Sí demuestra que la corrección propuesta en tres superficies no basta para sostener una garantía general.

### Arreglo propuesto

Antes de implementar, definir si «ciega» significa **no mostrar el esperado ni conciliaciones automáticas**, o significa además **no ofrecer un historial consolidado que permita reconstruirlo**. Si se elige el segundo alcance, extender una política común al historial JSON y al detalle de IA, además de `mySales`, «Preguntas», resúmenes y exportaciones equivalentes. Distinguir ese historial de la presentación operativa del ticket que la persona acaba de cobrar.

Una cajera conoce importes al vender y puede anotarlos. Por eso no prometer imposibilidad absoluta de deducción ni siquiera después de censurar el historial: la garantía verificable es qué información consolida y vuelve a entregar el sistema antes del cierre. Mantener total exacto en vivo y garantizar que no se pueda deducir efectivo en un turno exclusivamente en efectivo son objetivos incompatibles.

## T4-D02 · Media · `seller` con `profit:read` recibe costos en el historial, aunque catálogo e IA los niegan

### Evidencia en el SHA auditado

- `apps/api/src/common.ts:437-441`: `safe()` aplica la política explícita de no mostrar costos a `seller` aunque tenga `profit:read`.
- `apps/api/src/assistant.ts:1238-1240`: `actorSeesCost()` conserva esa misma exclusión de rol.
- `apps/api/src/sales.ts:146-159`: `saleHistoryDto` decide `showProfit` únicamente mediante `can(actor.permissions, "profit:read")`; incluye `unitCost` con ese resultado.
- `apps/api/src/sales.ts:196-215` y `:269`: también habilita comisiones, costos de devoluciones y `costTotal` con el mismo indicador.
- `apps/api/src/sales.ts:1708-1763`: el historial es accesible con `sale:write`; no vuelve a aplicar `safe()` al DTO.

### Reproducción mínima propuesta

En una base descartable, usar una persona cuyo rol se llame exactamente `seller` con permisos `sale:write` y `profit:read`, y una venta propia con `total=100`, `costTotal=37`, una línea con `unitCost=37`. Consultar su historial.

### Esperado y real

- **Esperado según las exclusiones explícitas ya implementadas en `safe()` e IA:** no recibir costos para ese rol.
- **Real en ejecución local de la función fuente:** el DTO contiene `costTotal:37` e `items[0].unitCost:37`; con el rol ordinario sin `profit:read`, esos campos no aparecen.

La exposición requiere una concesión previa de `profit:read`; **no es una escalada de privilegios de una cajera estándar**. Se clasifica como incoherencia entre políticas y vías de salida, no como acceso sin permiso explícito. Tampoco se observa un campo de margen en este DTO, pero disponer de venta y costo permite calcularlo.

### Arreglo propuesto

Confirmar una sola regla: si se mantiene la exclusión dura de `seller`, reutilizar la misma función de decisión en catálogo, reportes, historial y herramientas IA. Si la dueña prefiere que mande siempre el permiso explícito, documentarlo y alinear las otras vías. No cambiar silenciosamente roles ni la política de caja: `canViewCashExpected` hoy también usa `profit:read` (`apps/api/src/common.ts:115-117`), por lo que una concesión de costos tiene efectos sobre el arqueo.

## T4-D03 · Baja · Guardar una encuesta sin respuestas cuenta como una persona que respondió

### Evidencia en el SHA auditado

- `packages/shared/src/index.ts:1170-1186`: todas las claves son opcionales y el objeto `{}` es válido.
- `apps/api/src/cashier-survey.ts:24-37`: `save()` hace `upsert` incluso si `answers` está vacío.
- `apps/api/src/cashier-survey.ts:55-63`: `responses` cuenta filas; cada pregunta cuenta solo valores presentes y distintos de la cadena vacía.
- `apps/web/src/QuickQuestions.tsx:579-585` y `:634-635`: «Guardar respuestas» envía el borrador sin exigir ninguna respuesta.
- `apps/web/src/QuickQuestions.tsx:594-595` y `:734`: la interfaz presenta «Ya respondiste» y «N personas respondieron».

### Reproducción mínima propuesta

Con una persona nueva con `sale:write`, abrir Encuesta y pulsar Guardar sin responder nada, o enviar `POST /api/survey/mine` con `{"answers":{}}`. Abrir el resumen como administración. La fila cuenta como participante aunque las 30 preguntas tengan cero respuestas.

### Esperado y real

- **Esperado para la etiqueta actual:** contar personas con al menos una respuesta efectiva, o denominar el contador «encuestas guardadas» y diferenciar borradores.
- **Real en ejecución local de validación y resumen:** `{}` aceptado, `responses=1`, 30 preguntas, todas con `answered=0`.

### Arreglo propuesto

Permitir borradores si se desea comodidad, pero contar como respondida solo una fila con al menos un valor efectivo. `false` y los valores de escala válidos deben contar; los textos vacíos no. Alternativamente, impedir guardar una encuesta vacía con una indicación clara. Esta decisión no altera costos, caja ni cuota de IA.

## Precisiones para la regla exacta propuesta, sin aprobarla todavía

1. **La implementación actual detecta cajas abiertas de toda la sucursal**, no solo las propias: `reports.ts:1462-1469` filtra `branchId` y `closedAt:null`, sin `userId`. `hiddenUntilClose` se activa después al encontrar un pago o reembolso de una de esas cajas (`:1497-1512`). No equivale a «la cajera tiene su propia caja abierta».
2. La decisión de censura debe seguir la **procedencia de cada dato**, no solo la existencia de una caja propia. Una devolución de una venta de la persona puede pagarse desde otra caja abierta: el total de sus ventas netas cambia, aunque no haya una sesión propia abierta. Un pago con sesión nula tampoco prueba por sí mismo que pertenezca a una caja cerrada; primero hay que identificar su origen, por ejemplo un cobro legítimo recibido directamente por administración.
3. **Ventas propias y efectivo de caja son métricas distintas.** `mySales` selecciona por vendedor y fecha de venta (`reports.ts:1454-1458`); `cashExpected` selecciona pagos por sesión, incluye abonos y movimientos, resta reembolsos y trata USD/vuelto por separado (`cash.ts:58-108`). Un turno puede cruzar medianoche o contener cobros de ventas antiguas. No usar `total − medios no efectivos` como fórmula universal de saldo esperado.
4. **Propuesta equilibrada, pendiente de decisión:** conservar durante el turno el número de facturas y las unidades/productos propios; mostrar importes exactos de sesiones ya cerradas sin mezclarlos con las abiertas; aplicar una misma política de procedencia a los importes abiertos en todas las vías. El botón «cuánto vendí» puede explicar que el importe del turno queda disponible al cerrar. Si se prioriza el total comercial exacto en vivo, reconocer explícitamente la inferencia residual y mantener la garantía más limitada de «el sistema no muestra el esperado ni hace la conciliación antes del conteo».
5. Ninguna propuesta autoriza a ocultar al administrador con permiso su arqueo, ni a retirar la operación normal de emitir un ticket. El equilibrio definitivo entre consulta comercial, historial y conteo independiente corresponde a la dueña.

## Validación efectuada y límites

Se inspeccionó el código fijado al SHA indicado y el T4 previo. Se ejecutó con Node una comprobación local en memoria, extrayendo mediante el AST de TypeScript las funciones reales `saleHistoryDto`, `paymentSummary`, `can`, `surveyAnswers`, las constantes del cuestionario y el cuerpo de `CashierSurveyController.summary` de ese worktree. Se transpilaron para evaluarlas con datos sintéticos. No se levantó Nest, no se abrió puerto, no se creó base ni se llamó al proveedor de IA. El compilador y zod ya instalados en `/workspace/nexora` se usaron únicamente como herramientas locales; **el código inspeccionado se leyó de `/workspace/cola-t4`**.

Se sustituyeron solo colaboradores ajenos a estas conclusiones: análisis de adjuntos sin adjunto, enmascarado de un identificador fiscal ausente y consultas de encuesta con filas sintéticas. Esas sustituciones no deciden los campos de costos o importes, ni qué constituye una respuesta. Resultado real del comando, salida 0:

```json
{
  "ordinarySeller": { "paymentMethod": "cash", "paymentAmount": 100, "costExposed": false },
  "sellerWithProfit": { "costTotal": 37, "unitCost": 37 },
  "emptySurvey": { "accepted": "{}", "responses": 1, "questions": 30, "maxAnswered": 0 }
}
```

Esto confirma la proyección de datos y las funciones puras/cuerpo de resumen, **no** una reproducción HTTP con autenticación, RLS o navegador. La revisión estática respalda las condiciones de acceso citadas; no se certifica aislamiento mediante esta ejecución ni se declaran pruebas PostgreSQL/E2E superadas.

## Regresiones concretas sugeridas para quien implemente la decisión

- Misma venta abierta consultada por `mine`, historial y detalle IA: comparar la política de exposición, no solo buscar ausencia del nombre `expectedCash`.
- `seller` ordinario y `seller` con `profit:read`, con y sin sesión abierta: misma decisión sobre costo en todas las vías y pruebas independientes de permiso de arqueo.
- Venta antigua de la cajera devuelta hoy desde otra caja; turno que cruza medianoche; pago de crédito realizado por administración; venta USD con vuelto DOP. Verificar origen y etiqueta sin asumir que vendedor y dueño de gaveta coinciden.
- Encuesta `{}`, textos vacíos, `false` y escala `1`: contador de participantes coherente con la regla elegida, conservando unicidad por persona y separación por empresa.
- Mantener los controles existentes de `tests/mis-ventas-preguntas-postgres.test.ts`; ampliar sus escenarios, pues actualmente prueban cuotas y separación, pero no las tres combinaciones adicionales de esta adenda.
