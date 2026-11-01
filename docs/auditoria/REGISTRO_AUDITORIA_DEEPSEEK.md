# Registro de auditoría por fases (DeepSeek)

Aquí guardo cada bloque `INSTRUCTIVO FASE N` que DeepSeek me entregue, porque él no conserva la información entre sesiones.

Paquetes: 57, en 7 fases. Índice y paquetes en la carpeta de trabajo temporal, archivo `paquetes-deepseek/INDICE.md`. Instrucciones: `docs/auditoria/INSTRUCCIONES_FASES_DEEPSEEK.md`.

| Fase | Estado | Entregado en | Hallazgos críticos o altos | Verificado por Claude |
|---|---|---|---|---|
| 1 | entregada, con rechazos | Respuesta de DeepSeek a F1-P01 a F1-P04 (1 nov 2026) | Tres endpoints de `admin.ts` sin `@RequireTerminal()` (líneas 587, 675, 722): **decisión de negocio, no bug confirmado**. Rate limit de administración (`rate-limit.ts:184-229`): confirmado, medio. | Ver detalle abajo |
| 1b | P02 y P03 repetidos archivo por archivo (2.ª entrega) y **aceptados como revisión**, con dos correcciones de Claude (ver abajo). | Segunda respuesta de DeepSeek (1 nov 2026) | Ningún hallazgo crítico. Un medio y varios bajos, todos sin impacto confirmado. | Verificado por Claude |
| 2 | entregada y revisada (16 paquetes) | Informe consolidado de DeepSeek (1 nov 2026) | Falso crítico del modelo `claude-opus-5-5` rechazado. Confirmado, medio: pagos en USD con método electrónico cuentan como efectivo (`cash.ts`). | Verificado por Claude (muestra); resto sin revisar a fondo |
| 3 | entregada y revisada (7 paquetes) | Informe «10 pasadas» de DeepSeek (1 nov 2026) | Categoría compartida entre sucursales (`Category.name` único): medio, decisión humana. | Verificado por Claude (muestra) |
| 4 | entregada; hallazgos GV **no comprobados** | Mismo informe | Dinero GV en US$: pendiente de prueba (ver `Q-04` y `Q-05`). | Parcial |
| 5 | entregada y revisada (1 paquete) | Mismo informe | Ninguno crítico ni alto. | Parcial |
| 6 | entregada y revisada (2 paquetes) | Informe de fases 6 y 7 (1 nov 2026) | Cuatro hallazgos bajos de componentes compartidos. | Verificado por Claude |
| 7 | entregada y revisada (23 paquetes) | Mismo informe | Dos «altos» de DeepSeek bajan a medio y a «confirmado en código, impacto por probar». | Verificado por Claude (muestra) |

Regla: un hallazgo solo pasa a «verificado» cuando lo compruebo leyendo el archivo y la línea citados en el repo.

## Veredictos de la fase 1 (verificados por Claude, 1 nov 2026)

| # | Hallazgo de DeepSeek | Archivo:línea | Veredicto | Motivo |
|---|---|---|---|---|
| 1 | `supplier-payments` sin `@RequireTerminal()` | `apps/api/src/admin.ts:587` | **Decisión humana** (no bug) | La línea existe y el control existe (`common.ts:84`), pero ningún endpoint de `admin.ts` lo usa. Añadirlo bloquea la administración desde equipos que no son caja. Severidad «alta» sobrestimada. |
| 2 | `expenses` sin `@RequireTerminal()` | `apps/api/src/admin.ts:675` | **Decisión humana** | Igual que el 1. |
| 3 | `expenses/:id/void` sin `@RequireTerminal()` | `apps/api/src/admin.ts:722` | **Decisión humana** | Igual que el 1. Anular un gasto sí es sensible: conviene revisar quién tiene `expense:write`. |
| 4 | Rate limit no cubre rutas de administración | `apps/api/src/rate-limit.ts:184-229` | **Confirmado, medio** | El guard lista rutas concretas (`/auth/pin`, `/sales`, imports…). Falta comprobar si hay un límite general para el resto. |
| 5 | Lecturas con permiso de escritura | `apps/api/src/admin.ts:250` (`GET customers` con `customers:write`) | **Confirmado, bajo** | Exige más permiso del necesario para leer; no da acceso indebido. |

## Segunda entrega (P02 y P03, archivo por archivo)

Comprobé con grep cada afirmación de la segunda entrega. La mayoría es correcta: `DUMMY_PASSWORD_HASH` (auth.ts:63), `randomBytes(48)` y `sameSite: "strict"` (auth.ts:354, 398), `FOR UPDATE` (auth.ts:362), rotación de uso único con `deleteMany` (auth.ts:774), `canSwitchUserTo` (auth.ts:845), `randomInt` (password-policy.ts:2), filtro `safe()` (common.ts:367), `ApiExceptionFilter` con P2002/P2025 (common.ts:776-805), helmet, límites de 100 kb y 4 mb (main.ts:42-46), `connection_limit` (database-pool.ts), `sort()` antes de `FOR UPDATE` (require-password-change.ts:70-72) y jitter en reintentos de deadlock (database-errors.ts:84).

**Correcciones de Claude**

| # | Hallazgo de DeepSeek | Veredicto | Motivo |
|---|---|---|---|
| 1 | `app.ts:54`: `/health/ready` revela el estado de la base de datos a cualquiera | **Rechazado como fallo** | El código lo hace a propósito (comentario S-06 en `app.ts`): la ruta pública solo dice listo o no listo, sin detalle de la base. Revelar solo disponibilidad es aceptable; decidir si se queda es humano. Bajo. |
| 2 | `auth.ts:754-790`: descripción de la rotación del refresh | **Correcto con precisión** | La rotación es real (`deleteMany` por hash, uso único), pero el mismo archivo también borra todas las sesiones de un usuario (auth.ts:613-615). Eso es otra función, no la rotación. |

**Pendientes que no se pudieron comprobar en esta fase:** el `JWT_SECRET` y `validateSecret` (en `security.ts`, fuera del paquete) y la configuración real de Nginx.

**Preguntas de DeepSeek para la fase 3:** el bloqueo `FOR UPDATE` en inventario concurrente y los endpoints de `sales.ts` que anulan o registran pagos mixtos. Ambas van en la fase 2 y la 3; las anoto para cuando lleguemos.

## Fase 2 · paquete F2-P01 (`cash.ts`), verificado por Claude

| # | Hallazgo de DeepSeek | Veredicto | Motivo |
|---|---|---|---|
| 1, 2, 3 | Pagos en USD se cuentan como efectivo en dólares sin filtrar por método (`cash.ts:89-92`, `152-154`, `387-393`) | **Confirmado, medio (un solo hallazgo, en tres lugares)** | El POS solo manda USD como efectivo (comentario en `POS.tsx:1777`), así que en uso normal no pasa. Pero el servidor (`sales.ts:490`) convierte cualquier pago con `currency: "USD"` sin importar el método, y no encontré una validación que lo rechace. Una llamada directa a la API con tarjeta en USD se contaría como dólares físicos. Es un hueco de validación en el servidor; requiere revisión humana porque toca dinero. |
| 4 | Umbral de diferencias en USD multiplicado por `usdRate \|\| 0` (`cash.ts:1389-1393`) | **Confirmado, bajo** | Si no hay tasa, la diferencia en dólares vale 0 y no dispara alerta. En ventas en USD no se puede llegar ahí sin tasa, así que el caso es raro. |
| 5 | `openingSuggestion` «no definida» (`cash.ts:872`) | **Rechazado** | Sí está definida en `cash.ts:1435`. DeepSeek solo buscó en sus primeras 1,400 líneas. |
| 6-13 | Otros controles marcados «sin hallazgo» | **Aceptados sin revisar uno por uno** | Comprobé solo el cálculo y el umbral de USD. Los demás no los verifiqué individualmente. |

Nota: DeepSeek marcó tres veces el mismo problema (1, 2 y 3). Lo registro como un solo hallazgo.

## Fase 2 · paquete F2-P03 (`incentives.ts`, `formal-report.ts`), verificado por Claude

Ninguna de las propuestas de corrección se aplica sin revisión humana: tocan incentivos y cálculos de dinero.

| # | Hallazgo de DeepSeek | Veredicto | Motivo |
|---|---|---|---|
| 1 | Suma de incentivos convierte `Decimal` a `number` (`incentives.ts:599-603`) | **Confirmado, bajo-medio** | El código hace `left.toNumber()` antes de sumar. Con montos de pesos a dos decimales el error es muy pequeño, pero rompe la regla de aritmética decimal. La propuesta (`d(...).plus(left)`) es razonable; falta confirmar que `out` guarda `Decimal` y no `number`. **Requiere revisión humana.** |
| 2 | Fecha `"2026-10-27"` fija en la rotación de `formal-report.ts:364` | **Confirmado, bajo** | La fecha existe en el código. La propuesta de leerla de una variable de entorno es **riesgosa**: si la variable se configura mal en producción, cambia en silencio qué períodos DGII se calculan. Mejor dejar la fecha en una constante con nombre y un comentario que diga de dónde sale. **Requiere revisión humana.** |
| 3 | `paidFraction` no se acota entre 0 y 1 (`incentives.ts:309-311`) | **Confirmado, bajo** | La fórmula no tiene límites. Si `creditBalance` supera el total por un dato corrupto, el incentivo sale negativo o mayor que el total. Acotarlo oculta el dato malo: conviene también registrar el caso. **Requiere revisión humana.** |

Pendiente: DeepSeek marcó «Aprobado con observaciones» sin detallar los demás controles del paquete. No los he verificado.

## Fase 2 · paquetes F2-P04 (`incentives.ts`, `income-report.ts`, `income-day.ts`) y F2-P05 (`invoice.ts`), verificados por Claude

| # | Hallazgo de DeepSeek | Veredicto | Motivo |
|---|---|---|---|
| P04-1 | `userId` sin mensaje de negocio claro (`incentives.ts:1029`) | **Confirmado, bajo** | Solo es mensaje de error, no afecta dinero. Corrección pequeña y segura. |
| P04-2 | PDF limitado a 10,000 movimientos mientras CSV y XLSX llegan a 50,000 (`income-report.ts:471` y `356`) | **Confirmado, bajo** | Inconsistencia real. Puede ser deliberada (tamaño del PDF). Decisión de la dueña. |
| P04-3 | `Number(m.amount)` en la suma de movimientos (`income-report.ts:261-264`) | **Confirmado, bajo** | Conversión a número en una comparación. **Requiere revisión humana** porque toca un cuadre de caja. |
| P04-4 | Suma decimal de incentivos (`incentives.ts:917`) | **Aceptado** | Es Decimal de principio a fin. Correcto. |
| P04-5 | Centavos enteros en `income-day.ts:52` | **Aceptado** | Se divide al final. Correcto. |
| P04-6 | Cierre de mes con bloqueo (`incentives.ts:852-924`) | **Aceptado sin revisar a fondo** | No verifiqué el bloqueo. |
| P05-1 | `DEFAULT_INVOICE_MODEL = "claude-opus-5-5"` «no existe» (`invoice.ts:324`) | **Rechazado** | El SDK instalado lo lista (`node_modules/@anthropic-ai/sdk/src/resources/beta/agents/agents.ts:943`) y el proyecto lo usa a propósito (`docs/coordinacion/VEREDICTO_GEMINI_2_24OCT.md:37`). Lo que sí vale la pena revisar es el costo: ese documento dice que es el modelo más caro. Eso es decisión de la dueña, no un fallo. |
| P05-2 | Beta `server-side-fallback-2026-07-01` no soportada (`invoice.ts:400`) | **Rechazado** | El SDK instalado la contiene (`helpers/beta` y `lib/middleware.ts`). |
| P05-3 | `betaZodOutputFormat` podría no existir (`invoice.ts:402-404`) | **Rechazado** | Existe en `helpers/beta/zod.mjs` y `.d.ts` del mismo SDK. |
| P05-4 a 7 | Otros controles marcados «sin hallazgo» | **Aceptados sin revisar uno por uno** | No los verifiqué. |

Nota de método: DeepSeek basa sus afirmaciones sobre nombres de modelos y betas en conocimiento que puede no estar al día. Antes de aceptar un hallazgo de ese tipo, hay que comprobarlo en el SDK instalado.

## Fase 2 · informe consolidado de DeepSeek (16 paquetes), verificado por Claude

Muestra comprobada en el código: P02-1, P06-1, P07-2, P08-2, P10-1, P12-1, P13-2, P14-1, P16-1. Las citas son reales, y casi todos los comentarios de «sin hallazgo» corresponden a código que existe. No comprobé en detalle el resto de los «sin hallazgo».

| Paquete | Hallazgo | Veredicto |
|---|---|---|
| P05-1 (`invoice.ts:324`) | Modelo `claude-opus-5-5` «inválido» (ahora marcado como **crítico**) | **Rechazado, de nuevo.** Está en el SDK instalado y el proyecto lo usa a propósito. El informe consolidado lo repite como crítico sin nueva evidencia. |
| P05-2 y P05-3 | Beta y `betaZodOutputFormat` sin verificar | **Rechazados.** Están en el SDK instalado. |
| P01-1 a P01-3 (`cash.ts:89, 152, 387`) | USD con método electrónico cuenta como efectivo | **Confirmado, medio** (como ya estaba registrado). |
| P01-4 (`cash.ts:1389`) | Tasa en cero silencia la alerta | **Confirmado, bajo.** La corrección propuesta (`?? 1`) es mala idea: usaría una tasa inventada. Mejor marcar la alerta cuando no haya tasa. |
| P02-1 (`courier.ts:101`) | Nombre de mensajería «Addison» por defecto en la API | **Confirmado, bajo.** También está en la web (`CourierFeeEditor.tsx:20`). Es dato de negocio fijo en el código. |
| P02-2 (`credit-reminder.ts:162`) | `findMany` con `distinct` cargaría muchas filas | **No comprobado en detalle.** La línea existe, pero no vi el cuerpo del `distinct`. Bajo; sugerencia de rendimiento. |
| P06 a P16 | «Sin hallazgo» | **Aceptados como revisados solo en las muestras citadas.** |
| P11-1 (`Incentives.tsx:337`) | Dice «bloquea el cierre del mes en curso» | **Impreciso.** El código bloquea meses posteriores al último cerrado, no el mes en curso. |
| P15-1 (`Purchases.tsx:361`) | «Step acotado a 0,001» | **No comprobado.** El fragmento citado no muestra el `step`. |

Repetidos sin cambios respecto a lo ya registrado: P03 (`formal-report.ts:364`, `incentives.ts:602`, `incentives.ts:311`) y P04 (`incentives.ts:1029`, `income-report.ts:471`, `income-report.ts:262`).

## Fases 3, 4 y 5 · informe de DeepSeek («10 pasadas»), verificado por Claude

Muestra comprobada: F3-P01, F3-P02, F3-P03, F3-P04, F4-P01, F4-P02, F4-P03, F5-P01. Las citas son reales en la mayoría.

| Paquete | Hallazgo | Veredicto |
|---|---|---|
| F3-P04-1 (`merchandise.ts:264-266`) | «Crítico»: modelo inválido heredado | **Rechazado, de nuevo.** Es el mismo falso positivo del modelo. Se usa `DEFAULT_INVOICE_MODEL`, que existe en el SDK. |
| F3-P02-1 (`inventory-import.ts:379-386`) | Categorías mezcladas entre sucursales por `upsert` por nombre (**alto**) | **Confirmado, medio, requiere decisión humana.** `Category.name` es `@unique` global (`schema.prisma:62`), así que una categoría es compartida entre sucursales por diseño. El riesgo es de modelo de datos, no de la importación. La corrección no es un cambio chico. |
| F3-P01-1 (`catalog.ts:459-465`) | Dos altas simultáneas pueden repetir SKU | **Confirmado parcialmente, bajo.** El código sí calcula con `count`, pero `assertCodesFree` revisa dentro de la misma transacción. El riesgo es un error de conflicto, no un SKU duplicado. |
| F3-P03-1 (`inventory.ts:386`) | Fecha `'2026-10-16'` fija en el SQL | **Confirmado, bajo.** Mismo caso que la fecha de rotación DGII. |
| F3-P05-1 (`Merchandise.tsx:1146`) | Umbral de margen 15 fijo | **No revisado.** El umbral sí tiene sentido de negocio; no es fallo. |
| F3-P07-1 (`WarehousesPanel.tsx:181`) | `transfer.lots` puede no venir | **No comprobado.** Depende del padre; bajo. |
| F4-P01-1 y 2 (`gv-money.ts:565-569`) | «Crítico»: validación de importación ignora pagos en US$ | **No comprobado, medio.** `sum` usa `valorEnMoneda(p, "RD$")` por defecto. Falta comprobar si `valorEnMoneda` devuelve `null` para pagos en US$ sin `amountDop` (si lo hace, el hallazgo es real). **Requiere revisión humana**: dinero GV. |
| F4-P02-1 y 2 (`gv.ts:598-610`, `642`) | «Crítico»: reembolsos mezclan monedas en el reporte neto | **No comprobado, medio.** Se suma `refundAmount` sin conversión, pero `total` sí usa `valorPesos`. Si `refundAmount` se guarda en RD$, no hay error. Falta confirmarlo en el esquema. **Requiere revisión humana.** |
| F4-P03-1 (`Gv.tsx:17` del fragmento, `currency: "DOP"`) | El formulario de pago arranca en RD$ aunque el curso sea en US$ | **Confirmado, bajo.** Es un defecto de la interfaz GV. Ojo: `Gv.tsx` lo trabaja otro agente; no lo toco. |
| F4-P04-1 (`GvCitas.tsx:575-592`) | Banco como texto libre en citas | **No comprobado** en detalle. |
| F5-P01 (`reportes/clientes.ts`, `customerSearch.ts`) | Saldo actual en reporte histórico; `pickOnEnter` | **No comprobado** en detalle. |

Conclusión sobre el resumen de DeepSeek: sobrestima la gravedad de los hallazgos de GV («crítico») sin comprobar la moneda de `refundAmount` ni el comportamiento de `valorEnMoneda`. Hasta que se compruebe, no son críticos.

## Flujo acordado con la dueña (1 nov 2026)

- Claude anota y verifica todo lo que entrega DeepSeek. Claude es el filtro.
- Al final de las fases, todo el registro se envía a **Norexos 1**, que reaudita y decide. Ninguna corrección de dinero se aplica antes de esa decisión.
- Siguiente entrega: **F4-P01 a F4-P04 juntos**, en un solo documento con instrucciones y notas (`ENCARGO-DEEPSEEK-F4-COMPLETO.txt`, scratchpad).
- Los hallazgos de GV marcados como «críticos» en el informe anterior quedan **no comprobados** hasta verificar la moneda de los datos.

## Fases 6 y 7 · informe de DeepSeek (25 paquetes), verificado por Claude

DeepSeek aclara que leyó solo el texto pegado y marca como «no comprobado» lo que depende de archivos fuera del pegado. Comprobé en el repo las citas de sus hallazgos principales.

| Paquete | Hallazgo | Veredicto |
|---|---|---|
| F7-P04 (`notifications.ts:695-698` y `101-103`) | «Alto»: el nombre del aprobador entra al HTML del correo sin escapar | **Confirmado en el código, medio.** El texto con `aprobó con PIN: ${approver}` se arma sin `cleanText`, mientras que cajera y cliente sí lo usan, y luego el cuerpo va como HTML con saltos de línea convertidos a `<br>`. No comprobé si `userName` ya escapa el nombre. El que lo controla es quien crea o renombra usuarios, así que el riesgo es bajo-medio. **Requiere revisión humana.** |
| F7-P17 (`pendingSales.ts:69-86`) | «Alto»: `lineDiscount` sin tope de 100 al repreciar ventas offline | **Confirmado en el código; impacto no comprobado.** `lineDiscount` puede pasar de 100 si `discountAmount` supera el bruto; no comprobé si `lineTotals` lo acota. La pantalla de caja sí acota el descuento manual (0-100). **Requiere revisión humana** (dinero y offline). |
| F7-P02 (`drive-backup-core.ts:111-124`) | Los límites de scrypt aceptan valores muy grandes | **Confirmado, bajo-medio.** Con `maxmem: 128*N*r*p + 32 MiB` (línea 73), una cabecera manipulada con log2N=20, r=16, p=4 pediría unos 8 GiB. El comentario del propio código dice que no debe pedir gigabytes. Solo aplica al restaurar un respaldo alterado. |
| F7-P18 (`styles.css:155-158` vs `nx-primitivos.css:1-12`) | `button:not(.button)` pisa el fondo y el borde de `.nx-button` | **Confirmado en teoría, sin impacto hoy.** `.nx-button` no lleva la clase `button`, así que pierde por especificidad, pero no encontré ningún uso de NxButton en `apps/web`. |
| F6-P02-1 (`nx-primitivos.tsx:25`) | `{...props}` pisa el `className` base | **Confirmado, bajo.** `className` va antes de `{...props}`. |
| F6-P02-2 (`nx-primitivos.tsx:147-170`) | `aria-controls` apunta a paneles que no se renderizan | **Confirmado, bajo.** Solo se renderiza el panel activo. |
| F6-P02-3 (`nx-button.ts:34-39`) | `alturaMinimaPx` no es atributo DOM | **Confirmado en el código, bajo.** No comprobé si se esparce en un `<button>`. |
| F6-P02-4 (`nx-primitivos.tsx:222-225`) | `NxMoney` lanza con NaN | **Confirmado, bajo.** `formatDOP` lanza `Importe no finito` (`nx-money.ts:4`) y `NxMoney` solo revisa `null`. |
| F7-P09 (`usd-rate.ts:54-63`) | `userId: "sistema"` en `AuditLog` | **Resuelto: sin problema.** `AuditLog.userId` es `String` sin relación a `User`, así que acepta «sistema». |
| F7-P06 (`reportes/margen.ts:9, 26`) | El costo usa `unitCost`, no el costo contabilizado | **No comprobado.** El cálculo es como lo describe, pero no comparé con `bookedLineCosts`. **Requiere revisión humana** (reportes de dinero). |
| F7-P16-1 (`VoidRequests.tsx:98-101`) | Importes de pagos visibles con caja ciega | **No comprobado.** La interfaz muestra el monto; falta ver si la API los devuelve cuando `hiddenUntilClose` es verdadero. **Requiere revisión humana.** |
| F7-P16-2, P16-3, P17-2, P17-3 | Timeout en descargas, reset de «al por mayor», intervalos de PWA, `step` del formulario | **No comprobados.** Bajos. |
| Resto (F6-P01, F7-P01, P03, P05, P07, P08, P10 a P15, P19 a P23) | «Sin hallazgo» | **Aceptados sin revisar a fondo.** DeepSeek declaró leer solo el texto pegado; no verifiqué estos paquetes uno por uno. |

Nota: DeepSeek marcó dos hallazgos como «altos». Tras revisar, ninguno se confirma como alto: el del correo requiere acceso para renombrar usuarios, y el offline depende de un acotamiento que no comprobé.
