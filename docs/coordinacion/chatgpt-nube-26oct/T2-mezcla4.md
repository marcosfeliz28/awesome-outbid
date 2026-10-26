# T2 · Auditoría de producto-mezcla-4

Fecha: 2026-10-26  
Rama auditada: `origin/claude/producto-mezcla-4`  
Commit auditado: `1e7b1b25d91d0cadab1167e243eaac7d32b2d4a0`  
Base de la mezcla revisada en paralelo: `d0c44ac5862866a64cb0bf3a8abe54f7834381a2`; el único cambio posterior fue `apps/web/src/api.ts`, sin efecto sobre los hallazgos.  
Método: auditoría estática; no se ejecutaron pruebas que requieren PostgreSQL y no se modificó código existente.

## Resumen

La mezcla conserva varias defensas importantes: dinero con `Decimal`, aislamiento RLS para tráfico empresarial, bloqueo de autoaprobación, numeración NCF transaccional y soporte de solo lectura. Encontré dos defectos funcionales en anulaciones y el riesgo arquitectónico de mínimo privilegio ya desarrollado en T6.

## Hallazgos

### Alta · Anular una venta puede dejar el efectivo esperado negativo

**Archivos:**

- `apps/api/src/sales.ts:2443-2477`: bloquea la caja original, pero solo prepara una caja de reembolso cuando la original está cerrada.
- `apps/api/src/sales.ts:2485-2490`: comprueba efectivo disponible únicamente cuando existe `refundCash`.
- `apps/api/src/cash.ts:58-68`: el esperado deja de contar los pagos cuando la venta pasa de `completed` a `voided`.

**Cómo reproducirlo:**

1. Abrir caja con RD$0.
2. Vender RD$100 en efectivo.
3. Registrar una salida de caja de RD$100.
4. Anular la venta mientras esa misma caja continúa abierta.
5. La venta deja de entrar en `cashExpected`, pero la salida permanece; el efectivo esperado pasa a `-RD$100`.

**Arreglo propuesto:** bloquear la caja original y comprobar `cashCollected(sale.payments) <= cashExpected(originalCash).cash` también cuando siga abierta. Añadir una prueba concurrente entre retiro y anulación para confirmar que el candado impide ambas operaciones incompatibles.

### Media · Una transferencia pendiente queda atascada al anular la venta

**Archivos:**

- `apps/api/src/sales.ts:2564-2574`: la anulación cambia la venta, pero no lleva sus transferencias pendientes a estado terminal ni resuelve su alerta.
- `apps/api/src/sales.ts:2687-2693`: el listado pendiente no excluye ventas anuladas.
- `apps/api/src/sales.ts:2793-2796`: verificar exige que la venta siga completada.
- `apps/api/src/sales.ts:2937-2942`: rechazar también exige que la venta siga completada.

**Cómo reproducirlo:**

1. Crear una venta pagada con transferencia en `pending_verification`.
2. Anular la venta.
3. Abrir «Conciliar transferencias»: el pago todavía aparece.
4. Intentar verificarlo y rechazarlo; ambas acciones responden «La venta ya no está completada.».

**Arreglo propuesto:** dentro de la misma transacción de anulación, pasar las transferencias pendientes a un estado terminal explícito, resolver sus alertas y excluir ventas anuladas del listado. Añadir regresiones para listar, verificar y rechazar después de anular. Este defecto ya figuraba en `docs/coordinacion/revision-pesada/2-revision-codigo.md:73-76` y sobrevivió la mezcla.

### Alta arquitectónica · El panel de la operadora evita el mínimo privilegio de PostgreSQL

**Archivos:**

- `apps/api/src/registration.ts:124-128`: `RegistrationService.db` crea un `PrismaClient` con la conexión propietaria.
- `apps/api/src/platform.ts:89-94,156-162` y `apps/api/src/platform-billing.ts:82`: los controladores de plataforma reutilizan ese cliente.

**Cómo reproducirlo:** ejecutar desde un controlador de plataforma una consulta con ese cliente contra `Sale`, `Customer` o `Product`; la cuenta propietaria puede leer todas las empresas y evita RLS. Las respuestas actuales no exponen esos datos, pero la base no limita el alcance de un defecto futuro o una inyección.

**Arreglo propuesto:** implementar el diseño de `T6-rol-plataforma.md`: conexión separada, sin membresía en el rol empresarial y con ejecución exclusiva de funciones cerradas. Agregar pruebas negativas directas contra ventas, clientes, productos, costos y configuración.

## Controles positivos comprobados

- Dinero y vuelto usan `Decimal`; pagos no efectivos no generan cambio: `packages/shared/src/index.ts:359-379`.
- La autoaprobación de solicitudes queda bloqueada para personal: `apps/api/src/security.ts:82-137`; la excepción de la dueña con `*` está documentada expresamente.
- El NCF usa candado por empresa y tipo, incrementa dentro de la transacción y tiene unicidad por empresa: `apps/api/src/ncf-sequences.ts:67-86` y `apps/api/prisma/schema.prisma:437`.
- La regresión existente cubre 12 ventas concurrentes, secuencia consecutiva y conservación del NCF al anular: `tests/product-ncf-por-venta-postgres.test.ts:376-414`.
- El tráfico normal de cada empresa activa el rol RLS y `app.tenant_id`: `apps/api/src/tenant-database.ts:21-31`.
- Soporte tiene permisos fijos de catálogo de solo lectura y se rechazan escrituras: `packages/shared/src/index.ts:837-860` y `apps/api/src/common.ts:803-821`.
- No hay marcadores de conflicto en el árbol auditado y `git diff --check` no señaló errores.

## Regresiones y pruebas pendientes

1. PostgreSQL real: venta en efectivo, salida simultánea y anulación sobre caja abierta.
2. PostgreSQL real: anular venta con transferencia pendiente y comprobar pago, alerta, listado, verificar y rechazar.
3. Prueba negativa del cliente de plataforma contra todas las tablas empresariales.
4. Ejecutar la suite de dinero y NCF de la mezcla completa en CI; esta auditoría no sustituye esas pruebas.

## Adenda independiente · dinero y aislamiento

# T2 · revisión independiente de dinero: delta sobre la entrega publicada

Fecha: 2026-10-26, 05:56 UTC. Árbol auditado: `origin/claude/producto-mezcla-4`, **`1e7b1b25d91d0cadab1167e243eaac7d32b2d4a0`**. Base desplegada comparada: **`2f147d2da6d5a60f3c85ef67367658139c83e2c7`**.

Se leyó `ORDEN_CHATGPT_NUBE_26OCT.md`, `TABLERO_26OCT.md` y las entregas T2/T4 ya publicadas. Este documento agrega una vía adicional al efectivo esperado negativo; no sustituye ni duplica los hallazgos de anulación, transferencia pendiente o mínimo privilegio de esas entregas. No se encontró un crítico nuevo confirmado.

Método: lectura de los cambios y sus funciones actuales; ejecución local de funciones reales extraídas del árbol por AST de TypeScript con datos sintéticos y lecturas de base simuladas. **No se ejecutaron HTTP, PostgreSQL, una venta completa ni pruebas contra servicios reales.** No se modificaron aplicación, pruebas existentes, migraciones o workflows. El revisor no hizo commit, push ni despliegue; la coordinación incorpora esta adenda.

## T2-DIN-DELTA-01 · Alta · Cobro en dólares permite vuelto en pesos sin pesos disponibles

**Impacto:** una venta puede requerir entregar un vuelto que no está en la gaveta de pesos y dejar su efectivo esperado negativo. Los dólares recibidos no resuelven la falta de pesos: el diseño separa ambas gavetas y el vuelto se entrega en DOP.

### Evidencia en el SHA auditado

- `apps/api/src/sales.ts:444–474`: `usdCashPayments` valida tasa y equivalente DOP; no valida la disponibilidad física de pesos.
- `apps/api/src/sales.ts:877–880`: la venta normaliza los pagos con esa función dentro de su transacción, después de bloquear la caja.
- `apps/api/src/sales.ts:985–991`: `paymentTotals` comprueba pago suficiente y vuelto; un pago USD con equivalente superior al total deja `pending = 0` y sigue adelante.
- `apps/api/src/sales.ts:1378–1409`: asigna el cambio a pagos en efectivo y guarda `amount`, `tendered`, `change` y los campos USD, sin comprobar previamente `cashExpected` disponible para el vuelto.
- `packages/shared/src/index.ts:359–379`: un USD se representa como `method: "cash"`; por tanto, su excedente puede generar cambio como el efectivo DOP.
- `apps/api/src/cash.ts:90–98`: suma `amountUsd` a la gaveta USD y resta `change` de la gaveta DOP.
- Como precedente de la invariante monetaria, `apps/api/src/sales.ts:3358–3372` sí impide devolver efectivo que no esté disponible en la caja para un reembolso.
- La interfaz declara explícitamente el vuelto en pesos: `apps/web/src/POS.tsx:1935`.

### Reproducción propuesta contra una API local desechable — pendiente

1. Empresa de prueba con tasa USD = 60 y producto con precio final RD$100, sin descuento. Usar cliente válido, caja/terminal autorizados y la configuración fiscal que corresponda al escenario.
2. Abrir una caja con fondo RD$0; no registrar ingresos DOP.
3. Enviar una venta de ese producto con un único pago `{ method: "cash", currency: "USD", amount: 120, amountUsd: 2, usdRate: 60 }`.
4. Consultar el pago y el esperado de esa caja con un perfil autorizado.

**Esperado:** rechazar el cobro en línea antes de crear venta, consumir stock o asignar NCF, porque necesita RD$20 de vuelto sin disponer de pesos. Ofrecer importe exacto o un pago complementario en DOP; no revelar el saldo esperado a una cajera con caja ciega.

**Real comprobado en funciones:** conversión RD$120, pago suficiente (`pending = 0`), cambio RD$20; con el pago que escribe el bucle de `complete`, `cashExpected` devuelve DOP **−20** y USD **2**. **La aceptación HTTP y las filas persistidas no fueron ejecutadas en esta revisión**; la falta de guardia en el camino de `complete` es evidencia estática.

### Ejecución local realizada

Se usó `typescript.transpileModule` para cargar el `packages/shared/src/index.ts` de este worktree y extraer por AST, sin alterar su cuerpo, `usdCashPayments` y `cashExpected`. Las dependencias TypeScript/Decimal/Zod se resolvieron desde la instalación local existente en `/workspace/nexora`; el código auditado procedió de `/workspace/cola-t2-money`. La base simulada solo devolvió un pago y listas vacías de movimientos y devoluciones.

Salida real, código de salida **0**:

```json
{
  "total": 100,
  "payments": [{"method":"cash","currency":"USD","amount":120,"amountUsd":2,"usdRate":60}],
  "totals": {"paid":120,"pending":0,"change":20},
  "booked": [{"method":"cash","currency":"USD","amount":100,"amountUsd":2,"usdRate":60,"tendered":120,"change":20}],
  "expected": {"cash":-20,"card":0,"transfer":0,"usd":2,"movements":[]}
}
```

`booked` representa los campos calculados por el bucle de guardado; no es una fila insertada. El cálculo local corrobora el resultado negativo sin certificar el recorrido completo de la API.

### Arreglo propuesto

Para cobros en línea con USD y vuelto positivo, bajo el candado de la misma caja y antes de consumir NCF/stock, comprobar que:

`vuelto DOP <= efectivo DOP esperado anterior + efectivo DOP recibido en esta operación`.

La parte recibida en USD no se suma a los pesos disponibles. La suma debe usar los DOP entregados, antes de restar su cambio; mantener `Decimal`. Un rechazo debe conservar venta, stock y secuencia sin cambios. Para ventas offline ya entregadas, conservar la evidencia y derivar a revisión explícita; no asumir que un rechazo tardío recupera el vuelto entregado.

Regresiones propuestas: fondo 0 con USD2 para RD$100 (rechazo), fondo 20 (acepta y deja DOP0/USD2), USD más DOP suficiente en ambos órdenes de pagos, importe exacto sin vuelto, y dos ventas concurrentes que individualmente dispongan de pesos pero juntas excedan el fondo. Confirmar que los rechazos no consuman NCF.

### Origen y contraste entre ramas

La base desplegada no contenía este camino de cobro USD separado. `git blame` atribuye la normalización USD a **`ce635f3dac943b62b8ceba3b6b019346163e6638`** y la resta de vuelto DOP en `cashExpected` a **`6799a3cd578bc7a9f29024ab151555707ebe2429`**. Ambos llegan al producto mediante la integración de tienda, entre otros en **`4bb5958b75959fb8813cd8b8a15df561771815ef`**. Es una invariante no cubierta al integrar el nuevo medio de pago; no hay evidencia de que un merge haya eliminado una guardia ya existente para USD. La anulación sobre caja abierta descrita en T2 sigue siendo un caso diferente que requiere su propia regresión.

## Comprobación pendiente · contador de cierre fuera del candado

No se presenta como hallazgo confirmado ni como un ataque reproducido. `apps/api/src/cash.ts:1330–1342` toma el candado de caja y lee `failedBefore` dentro de la transacción. Si falla, el rollback libera ese candado y recién después `cash.ts:1573–1579` incrementa el contador con `this.db.authAttempt.upsert` fuera de la transacción.

El comentario «dos intentos a la vez no leen el mismo conteo» no queda garantizado por ese orden: otra transacción puede tomar el candado antes del incremento posterior. Probar con PostgreSQL local retrasando controladamente el incremento del primer fallo y enviar el siguiente cierre; registrar los valores leídos y respuestas. Si se confirma, serializar también el registro del intento fallido mediante una transacción que confirme el contador antes de devolver el error, sin revertirlo con el fallo del cierre. No modificar la aplicación para demostrarlo dentro de esta tarea.

## Controles revisados y límites

- NCF: candado por empresa/tipo en `takeNcf` y en la modificación del rango; incremento dentro de la transacción de venta; unicidad por empresa. La integración de `bc1c29e8c0a2fb72d71c926c054610c209172522` en `158b9b29c0db59ef39c7f036991963e36fe81954` conserva esos cambios. No se comprobó un NCF repetido emitido ni huecos automáticos nuevos.
- Autoaprobación: `managerPinApproval` excluye al solicitante y las personas excluidas por el llamante; la excepción de la dueña con `*` es explícita, no se clasificó como defecto. Las anulaciones pendientes también verifican quién las solicitó.
- Las pruebas `tests/pago-dolares-api.test.ts`, `tests/pin-otra-persona-api.test.ts` y `tests/caja-cerrada-api.test.ts` fueron leídas, no ejecutadas: por defecto apuntan a una API y leen configuración de entorno. No se usaron esos valores ni servicios. Esta entrega no acredita una suite aprobada ni el CI del último SHA.
- La revisión es independiente y parcial. Los hallazgos ya publicados en T2/T4 conservan sus propias evidencias; este delta no declara cerrado el resto de la auditoría.

# T2 · complemento independiente de aislamiento y soporte

Fecha: 26-oct-2026. Snapshot auditado: `1e7b1b25d91d0cadab1167e243eaac7d32b2d4a0`, rama `claude/producto-mezcla-4`; comparación con `2f147d2d`. Worktree aislado `/workspace/cola-t2-isolation`. Complementa `T2-mezcla4.md` publicado en `a64cb10`; no sustituye sus hallazgos ni duplica PLA-05.

## Alta · El restablecimiento de clave permite a la operadora entrar como administradora sin concesión de soporte

**Estado:** capacidad funcional comprobada; nueva respecto a `2f147d2d`, introducida por `512611d7a2ed5903f4d9c40451b9adbb4ce2e177`. No es acceso anónimo, fuga entre dos usuarios empresariales ni un fallo de la firma JWT: requiere la credencial válida de plataforma. El restablecimiento es una función deliberada y tiene botón y prueba; la discrepancia es con la frontera declarada de acceso de la operadora al negocio.

**Evidencia:**

- `apps/api/src/platform.ts:194-220`: `POST /platform/tenants/:slug/password-reset` exige el token de plataforma, selecciona la primera administradora activa, borra sesiones y devuelve `invitationUrl` con el token de un solo uso. No exige que la empresa haya habilitado soporte ni una aprobación de la dueña. El identificador de la operadora es una etiqueta de entorno (`:207`), no su identidad autenticada individual.
- `apps/api/src/registration.ts:182-220`: `acceptInvitation` acepta ese token, permite al portador fijar contraseña y PIN, y conserva el rol de la cuenta existente. Un tenant creado por plataforma tiene administradora con `permissions: ["*"]` (`:103-110`).
- `apps/api/src/common.ts:799-821`: las restricciones de solo lectura se aplican a `support`; una sesión nueva de la cuenta administradora no se clasifica como soporte.
- `apps/web/src/PlatformPanel.tsx:704-716,839-853`: el panel entrega el enlace de restablecimiento a la operadora. El texto dice que se lo dará a la administradora, pero esa intención no limita técnicamente quién puede consumirlo.
- `docs/producto/SOPORTE_OPERADOR.md:3-5,24-33`: declara que soporte solo entra cuando la empresa permite, solo lee y sin permiso vigente obtiene 403.
- `tests/product-plataforma-arreglos-postgres.test.ts:206-235`: prueba existente ejecutada; la operadora obtiene el enlace, lo consume con una contraseña distinta y logra iniciar sesión en la cuenta empresarial. La prueba no habilita soporte ni solicita aprobación de la empresa.

**Reproducción en entorno descartable:**

1. Crear y activar una empresa de prueba con acuerdo registrado y sin habilitar `support-access`.
2. Con token `Platform` válido, pedir `POST /api/platform/tenants/<slug>/password-reset`.
3. Extraer el token del fragmento del enlace recibido y llamar a `POST /api/auth/accept-invitation` con contraseña y PIN elegidos por la operadora y consentimiento formal del esquema.
4. Iniciar sesión usando código de empresa, correo de la administradora y la nueva contraseña. La prueba existente confirma HTTP 201.
5. Esa sesión conserva el rol administrativo: puede leer datos empresariales mediante las rutas normales; las escrituras que exigen terminal siguen exigiéndolo. Este último alcance procede de la revisión del rol y AuthGuard, no de una prueba adicional de lectura de ventas.

**Esperado bajo la garantía de aislamiento de soporte:** la operadora puede iniciar una recuperación, pero no obtiene un secreto suficiente para suplantar a la administradora ni evita el consentimiento y la caducidad del acceso de soporte.

**Actual:** el poseedor del token de plataforma puede recuperar por sí mismo la cuenta empresarial y cambiar también su PIN. El RLS mantiene esa sesión dentro de la empresa elegida, pero no distingue a la operadora de la administradora suplantada. La acción queda en bitácora; no es un acceso oculto, pero el registro no impide la sustitución de identidad.

**Arreglo propuesto, sin implementar:** separar la solicitud de recuperación de su aprobación: enviar el token directamente a un canal verificado de la dueña, no devolverlo a la operadora ni al panel; exigir prueba de posesión o aprobación independiente antes de cambiar credenciales. Separar la recuperación de contraseña del PIN y revocar sesiones al completar la recuperación, con bitácora de iniciador y aprobador. Si la dueña decide que la operadora tenga de forma deliberada esta capacidad total, debe declararse como una excepción administrativa al aislamiento: no se puede seguir prometiendo acceso empresarial únicamente mediante soporte consentido y de solo lectura. Una conexión PostgreSQL de mínimo privilegio (T6) por sí sola no elimina este camino si sigue concediendo la función que entrega el token.

**Prueba negativa que falta:** con soporte desactivado, una operadora puede solicitar recuperación pero nunca recibe un token utilizable ni puede aceptar la recuperación sin el factor de la dueña. La prueba positiva actual certifica exactamente la capacidad que contradice esa garantía, por lo que su éxito no resuelve el hallazgo.

## Comprobaciones adicionales de esta revisión

Ejecución local, sin modificar código ni pruebas:

```text
pnpm install --frozen-lockfile
pnpm db:generate
pnpm exec vitest run tests/product-plataforma-arreglos-postgres.test.ts tests/product-support-platform-postgres.test.ts tests/product-tenants-postgres.test.ts tests/support-n05.test.ts

Test Files  4 passed (4)
     Tests  17 passed (17)
Duration   7.71s
Salida     0
```

Log conservado: `/tmp/cola-t2-isolation-tests.log`. Las suites crean PostgreSQL temporal propio y la app Nest local; no se llamó al producto en vivo ni a Render. Las pruebas cierran las apps y eliminan las bases temporales.

Alcance positivo: se ejercieron la separación de tenants y claves repetidas, las defensas de soporte (permiso previo, solo lectura, bitácora, vencimiento), y el flujo de plataforma existente. La revisión del diff confirma que `isSupportAccount` y la clasificación fija en `AuthGuard` sobreviven la mezcla; editar permisos de un rol no concede escrituras a soporte. Los endpoints de listado y resumen de plataforma seleccionan datos de operación de plataforma, no ventas/clientes/productos. PLA-05 —su cliente propietario de base— permanece cubierto por T6 y no se presenta aquí como un hallazgo nuevo.

No se ejecutó toda la suite del repositorio, ni un ensayo adicional de lectura de ventas después del restablecimiento; se distingue arriba el tramo demostrado por la prueba existente del alcance derivado del código. No se certifica ausencia total de fugas. Dinero, NCF y caja ciega se cubren en las otras partes de T2/T4.
