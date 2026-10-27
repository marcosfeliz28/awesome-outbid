# Auditoría total de Nexora POS — 27-oct-2026

## Dictamen

No encontré un crítico en la base publicada del producto. `producto-nexora` (`c6148bac`) tiene los tres trabajos de CI en verde y la comprobación local completa pasó con PostgreSQL, incluida la evaluación del asistente (79/79) y las pruebas de aislamiento entre empresas.

Sí hay **tres hallazgos altos de dinero/caja**. Los tres ya tienen una corrección construida y verde en ramas separadas, pero cambian reglas visibles y no deben mezclarse sin la decisión de la dueña. La cadena de rediseño interior tampoco es mezclable todavía: sus trabajos `verify` están rojos.

Esta auditoría fue de solo lectura sobre código y ramas. Los únicos cambios de esta entrega son este informe y la actualización del estado en `docs/coordinacion/PLAN-10-MEJORAS-PRODUCTO.md`.

## Base y método

- Tienda y documentos: `origin/nexora-cloud` en `da8ba9ea`.
- Producto auditado: `origin/producto-nexora` en `c6148bac`.
- Se revisaron los PR #11 a #16 y las ramas `chatgpt-pc/lumina-motion-integracion`, `claude-pc/pc23-anulacion-fix`, `claude-pc/a1-formula-utilidad`, `claude-pc/b01-ventas-caja-ciega` y `chatgpt-pc/cola3-26oct`.
- Se compararon los árboles y se ejecutó `git merge-tree`: no aparecen conflictos textuales al aplicar cada rama por separado, pero eso **no** demuestra que la cadena combinada funcione.
- En `producto-nexora`: `pnpm db:generate && pnpm check`. El primer intento, antes de generar Prisma Client, falló por tipos ausentes; después de `pnpm db:generate` la comprobación completa pasó. No fue un fallo del código.
- Para móvil se usaron los resultados exactos de Playwright de los PR abiertos. No se repitió una prueba visual sobre ramas que ya estaban rojas y basadas en una revisión anterior.

## Hallazgos

| ID | Gravedad | Área | Estado |
|---|---|---|---|
| AT-01 | Alto | Anulación de cobros del producto | Corrección verde en rama; decisión pendiente |
| AT-02 | Alto | Arqueo ciego | Corrección verde en rama; decisión pendiente |
| AT-03 | Alto | Fórmula de utilidad | Corrección verde en rama; decisión pendiente |
| AT-04 | Medio | Cadena visual #16, #11, #13 y #14 | `verify` rojo |
| AT-05 | Medio | PR #15, propuesta duplicada de ventas ciegas | `verify` rojo y solapa B-01 |
| AT-06 | Medio | Acceso de la operadora | Credencial global compartida |
| AT-07 | Medio | Instalador/producto | Prueba física pendiente y texto FitStore |
| AT-08 | Medio | Facturas con IA | Opus sigue predeterminado; medición pendiente |
| AT-09 | Medio | Resumen diario | No tiene opt-in por empresa |
| AT-10 | Bajo | Producto vendible | Código base hecho, activación comercial pendiente |

### AT-01 — Anular un pago puede dejar mal el estado y el vencimiento del cliente

**Gravedad: alto.**

**Evidencia:** `apps/api/src/platform-billing.ts:53-65` recompone solo `paidThroughAt` a partir de los pagos. `apps/api/src/platform-billing.ts:140-167` permite anular un pago anterior aunque existan pagos posteriores y actualiza solamente `paidThroughAt`; no restaura `status`, `trialEndsAt`, `pastDueAt` ni `suspendedAt`.

**Cómo reproducir:** crear una empresa en prueba, registrar dos pagos, anular el primero y consultar la empresa. También se reproduce anulando el único pago que convirtió una prueba en cuenta activa: la fecha cambia, pero el resto del ciclo de vida no vuelve de forma atómica a su estado anterior.

**Arreglo propuesto:** usar `claude-pc/pc23-anulacion-fix` (`163a245b`), que conserva el estado anterior, limita la anulación de la cadena y tiene los tres CI verdes. Antes de mezclar, la dueña debe confirmar las reglas PC-23.

### AT-02 — La cajera puede recuperar importes durante una caja ciega

**Gravedad: alto.**

**Evidencia:** `apps/api/src/sales.ts:1708-1763` devuelve a una vendedora sus ventas con pagos e importes sin consultar si tiene una caja abierta en modo ciego. `apps/api/src/sales.ts:4518-4565` genera el PDF de su venta bajo la misma regla. `apps/api/src/assistant.ts:481-520` incluye importes del cuadre cuando la API los entrega. La política no queda protegida en todos los canales por la base actual.

**Cómo reproducir:** activar la caja ciega, abrir turno como cajera, registrar una venta y consultar `GET /sales` o `GET /sales/:id/receipt.pdf` antes de cerrar. El importe puede recuperarse aunque el cierre pretenda no mostrar lo esperado.

**Arreglo propuesto:** elegir una sola implementación. `claude-pc/b01-ventas-caja-ciega` (`0500b03a`) tiene los tres CI verdes y cubre API/web/asistente/PDF. No mezclar además el PR #15, que implementa la misma política por otro camino y está rojo. La dueña debe decidir el tratamiento de créditos y recibos antes de activar la bandera.

### AT-03 — Dos bases distintas calculan “ganancia”

**Gravedad: alto.**

**Evidencia:** `apps/api/src/reports.ts:497-520` separa ventas cobradas (`revenue`) e ITBIS (`tax`). En `apps/api/src/reports.ts:543-559`, `grossProfit` y `margin` usan ventas con ITBIS, mientras `netProfit` usa `net`, ya sin ITBIS. `apps/api/src/cash.ts:488-507` también resta ITBIS para la rentabilidad del cuadre. `packages/shared/src/index.ts:525-538` acepta cualquiera de esas bases sin imponer una sola definición.

**Cómo reproducir:** registrar una venta con ITBIS y costo, sin gastos. Comparar margen/ganancia bruta del informe con `netProfit` y rentabilidad del cierre. Los valores difieren exactamente por el ITBIS según la pantalla.

**Arreglo propuesto:** decidir qué significa “utilidad” para la dueña y usar una sola base en informes y caja. La regla escrita indica margen `(precio - costo) / precio`, sin restar ITBIS. `claude-pc/a1-formula-utilidad` (`498df5ee`) aplica la unificación y tiene los tres CI verdes; necesita una nota visible porque cambia cifras históricas mostradas.

### AT-04 — La cadena visual no pasa móvil a 320 px

**Gravedad: medio.**

**Evidencia:** los PR #16, #11, #13 y #14 tienen `windows-installer` y `render-images` verdes, pero `verify` rojo. El fallo de `tests/e2e/fuentes.spec.ts:395` informa, entre otros, `Punto de venta: la ruta se recorta 12 px`, `Promociones: la ruta se recorta 3 px` y `Configuración: la ruta se recorta 9 px`, tanto en claro como en oscuro. También falla la comprobación del menú en `tests/e2e/fuentes.spec.ts:452`. PR #13 añade una regresión del Asistente.

**Cómo reproducir:** ejecutar el `verify` de cualquiera de esas ramas o las pruebas de fuentes a 320 px en claro y oscuro.

**Arreglo propuesto:** rearmar y corregir la cadena en el orden `chatgpt-pc/lumina-motion-integracion` → #16 → #11 → #13 → #14, sobre la portada actual, y volver a correr las tres comprobaciones después de cada pieza. No “arreglar” relajando los umbrales de 320 px.

### AT-05 — El PR #15 duplica B-01 y rompe contratos existentes

**Gravedad: medio.**

**Evidencia:** el `verify` del PR #15 falla en tres pruebas API porque recibe `403` donde el contrato esperaba `200`: SEC-05 del PDF y dos casos de PDF de crédito en `tests/api.test.ts` y `tests/credito-api.test.ts`. A la vez, `claude-pc/b01-ventas-caja-ciega` resuelve el mismo problema y está verde.

**Cómo reproducir:** ejecutar `pnpm check` en el commit `92b58553` del PR #15.

**Arreglo propuesto:** cerrar o archivar #15 después de conservar cualquier prueba útil que no exista en B-01. Integrar una sola rama, actualizar explícitamente los contratos del PDF según la decisión de la dueña y exigir los tres CI verdes.

### AT-06 — La plataforma usa una credencial compartida para todas las operadoras

**Gravedad: medio.**

**Evidencia:** `apps/api/src/platform.ts:15-23` reconoce que la operadora se identifica por texto mientras la credencial es compartida. `apps/api/src/platform.ts:48-68` autoriza las rutas con un único `PLATFORM_ADMIN_TOKEN_SHA256` (más uno temporal para rotación). La bitácora registra una etiqueta suministrada, no una identidad autenticada individual.

**Cómo reproducir:** dos operadoras usan el mismo token y envían etiquetas distintas. Ambas quedan autorizadas; retirar acceso a una exige rotar el secreto de todas y la atribución depende del texto enviado.

**Arreglo propuesto:** antes de operar con más de una persona, usar cuentas individuales con MFA o identidad administrada, permisos mínimos y revocación por persona. Mantener el token global solo como mecanismo de transición/recuperación con rotación y alertas.

### AT-07 — El instalador no tiene prueba física final y filtra la marca anterior

**Gravedad: medio.**

**Evidencia:** `chatgpt-pc/cola3-26oct` (`ba5c3c2e`) tiene los tres CI verdes, pero el plan declara pendiente la instalación limpia en Windows 11. Además, `instalador/runtime/web-server.mjs:85`, `:122`, `:127-132` y `:185` muestran o usan `FitStore` en respuestas, salud y consola del servidor HTTPS.

**Cómo reproducir:** instalar en una Windows 11 limpia, detener la API y abrir la PWA o consultar `/__fitstore/health`; aparece la marca anterior. La prueba física de servicio, firewall, certificado, respaldo y restauración todavía no tiene acta.

**Arreglo propuesto:** rama exclusiva de marca del instalador con prueba de textos, seguida de la prueba física indicada en la Fase 7. No instalar sobre la tienda ni tocar sus datos para esa prueba.

### AT-08 — La lectura fiscal está hecha, pero el costo de IA no está reducido ni medido

**Gravedad: medio.**

**Evidencia:** `apps/api/src/invoice.ts:324` fija `claude-opus-5-5` como modelo predeterminado; `apps/api/src/merchandise.ts:278` solo lo reemplaza si existe `ANTHROPIC_MODEL`. La extracción de RNC, NCF e ITBIS ya está en el producto, pero no existe el resultado exigido de 10 facturas reales con calidad y costo medidos.

**Cómo reproducir:** ejecutar la lectura sin `ANTHROPIC_MODEL`; se selecciona Opus. Revisar los artefactos: no hay una matriz aprobada de las 10 facturas reales.

**Arreglo propuesto:** prueba cerrada con 10 documentos autorizados, datos anonimizados en el informe, comparación Haiku/Sonnet/Opus y fallback explícito. El cambio de configuración lo hará únicamente quien despliega después de los tres CI verdes.

### AT-09 — El resumen diario se activa globalmente, no por empresa

**Gravedad: medio.**

**Evidencia:** `apps/api/src/daily-summary.ts:91-104` habilita el trabajador con configuración global. `apps/api/src/daily-summary.ts:107-120` recorre todas las empresas activas y envía al primer administrador verificado de cada sucursal; no consulta un consentimiento o interruptor de esa empresa.

**Cómo reproducir:** configurar las claves de correo e IA en un entorno con dos empresas activas. Al llegar la hora, ambas entran al recorrido aunque una nunca haya pedido el resumen.

**Arreglo propuesto:** opción por empresa apagada por defecto, visible solo a administración, con bitácora de alta/baja. Probar dos empresas con preferencias opuestas y conservar idempotencia/reintentos. Después, prueba real de siete noches con una empresa piloto.

### AT-10 — El núcleo SaaS existe, pero aún no es un producto activable por público

**Gravedad: bajo (brecha de salida, no defecto).**

**Evidencia:** `apps/api/src/registration.ts:130-168` implementa registro y confirmación, pero falla cerrado salvo `PRODUCT_TENANCY=required` y `PRODUCT_PUBLIC_REGISTRATION=enabled`. `apps/api/src/tenant-lifecycle.ts:18-38` implementa siete días de gracia y `apps/api/src/common.ts:834-847` deja a una empresa suspendida en consulta/exportación. Las pruebas de exportación, respaldo, tres empresas y cobro de prueba pasan. No hay cobro real ni infraestructura pública separada autorizada.

**Cómo reproducir:** iniciar el producto sin la bandera de registro: el alta devuelve 404 y el enlace no se ofrece. Es el comportamiento correcto mientras falten legales, procesador, piloto e infraestructura.

**Arreglo propuesto:** mantener cerrado. Completar auditoría de Fase 3, legales aprobados, procesador real, respaldo/restore y piloto antes de activar el registro. No convertir esta bandera en un atajo.

## Controles revisados sin hallazgo bloqueante

- **Permisos:** las rutas autenticadas sin permiso declarado se deniegan por defecto en `apps/api/src/common.ts:823-833`.
- **Aislamiento:** pasaron localmente las pruebas PostgreSQL de rutas de catálogo, inventario, dinero, exportaciones, administración, autenticación, NCF y tres empresas piloto.
- **Concurrencia e idempotencia:** pasaron pruebas de pagos, paquetes de IA, recepción/traspasos, códigos de variantes y migraciones repetibles.
- **IA “Pregúntale a Nexora”:** `apps/api/src/assistant.ts:1242-1298` limita herramientas, caracteres, tokens, tamaño de respuesta, tiempo y redirecciones; `apps/api/src/assistant.ts:1307-1320` no confía en respuestas `assistant` enviadas por el cliente. `apps/api/src/platform-ai-packs.ts:70-103` reserva consultas bajo candado por empresa. Evaluación local: 79/79.
- **MCP/OAuth:** `apps/api/src/mcp.ts:65-136` exige administrador, PKCE, código de un uso y token de 15 minutos; `apps/api/src/mcp.ts:139-205` revalida sesión, limita llamadas y ejecuta herramientas bajo RLS y transacción `READ ONLY`. La prueba PostgreSQL de dos empresas pasó. Falta ensayo con cliente comercial y las propuestas siguen desactivadas.
- **Marca en la web:** `apps/web/src/App.tsx:360-374` usa caras neutrales en modo producto y `apps/web/src/App.tsx:428-442` separa el texto de MacGen/GV del producto. Queda el instalador señalado en AT-07.
- **Política de plugins:** PR #12 (`10900848`) es solo documentación y sus tres trabajos están verdes.

## Estado de ramas y orden de mezcla

| Pieza | Commit revisado | CI | Veredicto |
|---|---:|---|---|
| Base `producto-nexora` | `c6148bac` | 3 verdes | Base válida |
| Portada `lumina-motion-integracion` | `287db57e` | 3 verdes | Mezclable con el “sí” de la dueña |
| PR #16, pantallas A | `2df2c752` | `verify` rojo | No mezclar |
| PR #11, QA visual | `16eb1142` | `verify` rojo | No mezclar |
| PR #13, Mercancía/Asistente | `d4355f87` | `verify` rojo | No mezclar |
| PR #14, Reportes/Configuración | `0f5c6dd5` | `verify` rojo | No mezclar |
| PR #15, venta ciega | `92b58553` | `verify` rojo | No mezclar; solapa B-01 |
| PR #12, plugins | `10900848` | 3 verdes | Seguro por código; requiere decisión de política |
| PC-23 | `163a245b` | 3 verdes | Decisión de la dueña |
| A1 utilidad | `498df5ee` | 3 verdes | Decisión de la dueña |
| B-01 caja ciega | `0500b03a` | 3 verdes | Decisión de la dueña |
| Instalador | `ba5c3c2e` | 3 verdes | Falta prueba física y AT-07 |

El orden recomendado se mantiene: portada → #16 → #11 → #13 → #14. Cada pieza debe reconstruirse o mezclarse sobre la anterior y volver a pasar los tres CI; que no haya conflicto textual no evita regresiones CSS o de comportamiento.

## Qué se puede mezclar ahora

1. PR #12, porque solo cambia documentación y tiene los tres CI verdes, **si la dueña acepta su política**.
2. `chatgpt-pc/lumina-motion-integracion`, porque tiene tres CI verdes, **solo después del “sí” visual de la dueña**.

No es seguro mezclar #11, #13, #14, #15 o #16 en su estado actual. PC-23, A1 y B-01 son técnicamente verdes, pero cambian reglas de negocio y esperan decisiones expresas.

## Decisiones que necesita la dueña

1. PC-23: reglas de anulación y restauración del estado de la empresa.
2. A1: definición única de utilidad/rentabilidad y aceptación de que cambiarán cifras mostradas.
3. B-01: encender caja ciega y tratamiento de créditos, tickets y PDF durante el turno.
4. Aceptar o rechazar la portada nueva.
5. Aceptar la política de plugins del PR #12.
6. Nombre/registro ONAPI, abogado y términos definitivos.
7. Procesador de pago, infraestructura separada y empresas piloto antes de abrir registro.
8. Facilitar 10 facturas reales autorizadas para elegir el modelo de lectura.
9. Autorizar una prueba física del instalador en una Windows 11 que no sea la tienda.

## Ramas de arreglo propuestas

- `fix/pc23-anulacion`: partir de la rama verde existente; prueba de estado anterior y prohibición/orden de anulación.
- `fix/b01-caja-ciega`: partir de B-01; prueba API, PDF, ticket, historial y asistente con caja abierta/cerrada.
- `fix/a1-utilidad`: partir de A1; prueba única que compare informe, tablero y cierre sobre la misma venta con ITBIS.
- Una rama por cada pieza visual, rebasada por mezcla sobre la anterior, con Playwright a 320 y 390 px, claro/oscuro, teclado y movimiento reducido.
- `fix/marca-instalador`: solo runtime/documentación/pruebas del instalador; después acta de prueba física.
- `fase6/modelo-facturas`: benchmark de las 10 facturas, sin incluir documentos del negocio en Git.
- `fase6/resumen-opt-in`: preferencia por empresa apagada por defecto y prueba multiempresa.

## Límites y trabajo omitido deliberadamente

- No se desplegó ni se consultó Render, producción, credenciales o la base de la tienda.
- No se probaron pagos reales, correos reales ni modelos con documentos reales.
- No se ejecutó el instalador en Windows 11 físico.
- No se validó visualmente cada pantalla a mano porque las ramas visuales actuales ya tienen fallos reproducibles en su Playwright de CI; debe repetirse después de corregir/rearmar la cadena.
- No se usaron cambios amplios ni refactorizaciones: principio Ponytail. Los riesgos fuera de la auditoría quedan explícitos arriba.
