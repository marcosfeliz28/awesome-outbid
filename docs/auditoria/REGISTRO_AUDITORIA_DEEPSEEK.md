# Registro de auditoría por fases (DeepSeek)

Aquí guardo cada bloque `INSTRUCTIVO FASE N` que DeepSeek me entregue, porque él no conserva la información entre sesiones.

Paquetes: 57, en 7 fases. Índice y paquetes en la carpeta de trabajo temporal, archivo `paquetes-deepseek/INDICE.md`. Instrucciones: `docs/auditoria/INSTRUCCIONES_FASES_DEEPSEEK.md`.

| Fase | Estado | Entregado en | Hallazgos críticos o altos | Verificado por Claude |
|---|---|---|---|---|
| 1 | entregada, con rechazos | Respuesta de DeepSeek a F1-P01 a F1-P04 (1 nov 2026) | Tres endpoints de `admin.ts` sin `@RequireTerminal()` (líneas 587, 675, 722): **decisión de negocio, no bug confirmado**. Rate limit de administración (`rate-limit.ts:184-229`): confirmado, medio. | Ver detalle abajo |
| 1b | P02 y P03 repetidos archivo por archivo (2.ª entrega) y **aceptados como revisión**, con dos correcciones de Claude (ver abajo). | Segunda respuesta de DeepSeek (1 nov 2026) | Ningún hallazgo crítico. Un medio y varios bajos, todos sin impacto confirmado. | Verificado por Claude |
| 2 | pendiente | | | |
| 3 | pendiente | | | |
| 4 | pendiente | | | |
| 5 | pendiente | | | |
| 6 | pendiente | | | |
| 7 | pendiente | | | |

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

Comprobé con grep cada afirmación de la segunda entrega. La mayoría es correcta: `DUMMY_PASSWORD_HASH` (auth.ts:63), `randomBytes(48)` y `sameSite: "strict"` (auth.ts:354, 398), `FOR UPDATE` (auth.ts:362), rotación de uso único con `deleteMany` (auth.ts:21 del refresh), `canSwitchUserTo` (auth.ts:845), `randomInt` (password-policy.ts:2), filtro `safe()` (common.ts:367), `ApiExceptionFilter` con P2002/P2025 (common.ts:776-805), helmet, límites de 100 kb y 4 mb (main.ts:42-46), `connection_limit` (database-pool.ts), `sort()` antes de `FOR UPDATE` (require-password-change.ts:70-72) y jitter en reintentos de deadlock (database-errors.ts:84).

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
