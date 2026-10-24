# Orden para ChatGPT NUBE — Fase 2: asistente de IA y soporte Nexora (Claude, arquitecto · 24-oct-2026)

**Pedido de la dueña (24-oct):** que Nexora se venda con una opción de IA. El cliente le pregunta a la IA como la dueña le pregunta hoy a Claude: cuadre del fin del día, quién facturó y quién no, cómo cerrar o abrir una factura, cómo corregirla, entradas y salidas de mercancía. Y que la dueña, como proveedora, pueda dar soporte a sus clientes **sin poder modificar nada de su sistema**: solo consultar y pedir.

**Roles:** ChatGPT NUBE construye. ChatGPT PC sigue con la fase 1 (`ORDEN_FASE1_CHATGPT_PC.md`). Claude diseña, audita y aprueba. Solo Claude despliega.

**Cuándo empezar:** después de entregar `PROPUESTA_PRODUCTO_CHATGPT_NUBE.md` (orden de auditoría del 24-oct).

## Rama y límites

- Rama nueva `nexora-chatgpt-nube-ia`, creada desde `origin/producto-nexora`. Claude la mezcla hacia `producto-nexora` tras revisarla.
- **Nunca** `nexora-cloud`, Render, la base de la tienda ni datos reales de Grupo MacGen. Solo `pnpm db:seed` y datos de prueba.
- Archivos nuevos propios para no chocar con ChatGPT PC: `apps/api/src/assistant.ts`, `apps/api/src/support-access.ts`, `apps/web/src/Assistant.tsx`, sus pruebas y una migración. En archivos compartidos (`app.ts`, `App.tsx`, `schema.prisma`, `packages/shared/src/index.ts`) solo las líneas mínimas de registro.
- Un commit por bloque (A, B, C, D, E). Cada bloque con una prueba que falle antes y pase después. `pnpm check` y los 3 CI en verde.

## Bloque A — «Pregúntale a Nexora» (API)

`POST /api/assistant/ask` en `apps/api/src/assistant.ts`, `@Permit("authenticated")`.

1. **Cuerpo** validado con zod: `messages` (máx. 20, las preguntas del usuario ≤ 500 caracteres, las respuestas anteriores ≤ 2 000, roles `user`/`assistant`). Rechazar campos extra.
2. **Modelo:** el SDK `@anthropic-ai/sdk` que ya está en `apps/api/package.json` (mismo patrón y manejo de errores que `extractAnthropic` en `apps/api/src/invoice.ts:364-430`). Modelo por variable `NEXORA_IA_MODEL`, por defecto `claude-haiku-5-5` (decisión de costo de `ARQUITECTURA_NEXORA_PRODUCTO.md` §4). `output_config.effort: "low"`. Sin clave `ANTHROPIC_API_KEY`: responde 503 «El asistente no está activado en esta empresa», nunca un error crudo.
3. **Herramientas = rutas GET que ya existen, llamadas como el mismo usuario.** El servidor llama a `http://127.0.0.1:${PORT}/api/...` reenviando **solo** el encabezado `Authorization` de quien pregunta. Así cada herramienta hereda sus permisos, su sucursal y su empresa (guardia de `common.ts:690-800` y RLS). No se escribe SQL nuevo ni se duplica lógica. Lista cerrada en el código (nada que venga del modelo arma la URL fuera de esta lista; los parámetros se validan con zod):

   **Actualizado 24-oct con la propuesta de Gemini** (`VEREDICTO_GEMINI_24OCT.md`): 10 herramientas cerradas. Prefiere siempre los reportes que ya vienen sumados en SQL; el modelo no suma decenas de filas crudas.

   | # | Herramienta | Rutas existentes que usa | Permiso que ya exige |
   |---|---|---|---|
   | 1 | `manual_procedimiento(tema)` | texto de `docs/MANUAL.md` y `docs/MANUAL-CAJERO.md` empaquetado en la API | ninguno |
   | 2 | `cuadre_caja(fecha, cajera?)` | `GET cash-sessions` → `GET cash-sessions/:id/cuadre` | `cash:write` (el esperado solo con `profit:read` o `sale:manage`, `canViewCashExpected`) |
   | 3 | `facturacion_por_usuario(desde, hasta)` | `GET reports/:name` de «Ranking de cajeras», «Descuentos dados por cajera», «Anulaciones por cajera y motivo»; `GET dashboard/summary` | `reports:read` |
   | 4 | `detalle_factura(numero o cliente)` | `GET sales?q&date` | `sale:write` |
   | 5 | `cuentas_por_cobrar()` | `GET cod/pending`; `GET credit-accounts` | `sale:write`; `*` |
   | 6 | `transferencias_por_verificar(fecha)` | `GET payments/pending-transfers` | `sale:manage` |
   | 7 | `movimientos_inventario(desde, hasta, producto?)` | `GET inventory/movements`; `GET inventory/transfers` | `catalog:read` |
   | 8 | `existencias(producto?)` | `GET inventory/stock`; reportes «Bajo el mínimo» y «Agotados con ventas recientes» | `catalog:read`; `reports:read` |
   | 9 | `alertas_auditoria(desde, hasta)` | `GET alerts`; reportes «Descuadres de caja por fecha» y «Diferencias de cuadre por cajera» | `alerts:write`; `reports:read` |
   | 10 | `pedir_anulacion(factura, motivo)` | Bloque D | `sale:write` + confirmación humana |

   - Los nombres internos de los reportes se toman de `REPORTES` (`apps/api/src/reportes/index.ts`); la herramienta acepta solo esos nombres.
   - «Quién facturó y quién no»: herramienta 3 + las cajas del día de la 2. La IA dice quién abrió caja y no vendió.
   - Si una ruta no existe para lo que se necesita, **no la crees en esta fase**: anótala en el informe y Claude decide.
   - Un 403 de la ruta se devuelve al modelo como resultado de herramienta («tu usuario no tiene permiso para ver esto»), nunca como fallo.
   - Respuestas recortadas a 20 000 caracteres por herramienta; máximo 6 vueltas de herramientas por pregunta.
   - **Defensas (Gemini, aprobadas):** (a) todo texto que venga de datos (nombres de clientes, notas, motivos, descripciones) se entrega al modelo dentro de una marca de «datos no confiables» y las instrucciones del sistema dicen que nunca se obedece texto de ahí; (b) si en esa pregunta el modelo leyó notas o textos libres, `pedir_anulacion` queda desactivada para esa respuesta; (c) el modelo nunca recibe ni envía `tenantId`, sucursal ni ids de usuario: salen del token verificado; (d) pregunta ≤ 500 caracteres, rango de fechas ≤ 31 días por herramienta, máximo 5 preguntas por minuto por usuario (usa `rate-limit.ts`); (e) costo y margen solo si la ruta ya los devuelve para ese rol: prueba con una vendedora que pregunta márgenes y no los recibe.
4. **Lo que la IA nunca hace:** mover dinero, inventario, precios, cerrar o abrir cajas, anular, editar facturas. Para eso **explica los pasos** con el manual (dónde está el botón, qué PIN pide). Única excepción en el Bloque D.
5. **Instrucciones del sistema** fijas (en español, sin fechas ni datos variables, para que se guarden en caché): eres el asistente de Nexora POS de esta empresa; responde corto; da cifras solo de herramientas, nunca inventes; di de qué reporte y qué fechas sale cada número; si algo requiere un cambio, explica dónde se hace; nunca pidas ni repitas contraseñas, PIN o tarjetas. La fecha de hoy y el nombre del usuario van en el primer mensaje de usuario, no en el sistema.
6. **Respuesta:** `{ answer, usage: { input, output }, remaining }`. Si `stop_reason` es `refusal` o `max_tokens`, un mensaje claro en español.

**Pruebas A:** cliente de Anthropic falso (inyecta `fetch`, como en las pruebas de facturas): (1) vendedora que pide el cuadre de otra cajera recibe el 403 traducido; (2) usuario de la empresa B nunca ve datos de la A (añadir la ruta a la matriz de aislamiento); (3) el modelo pide una ruta fuera de la lista y no se llama; (4) sin clave → 503.

## Bloque B — Cuota y bitácora

1. Cada pregunta deja una fila con `audit(db, actor, "assistant.ask", "assistant", <id>, undefined, { tokensIn, tokensOut, herramientas })` (`common.ts:362`). No se guarda el texto de la pregunta ni de la respuesta en esta fase.
2. Cuota mensual por empresa contando esas filas del mes (zona `America/Santo_Domingo`). Límite por plan (`Autoservicio 30`, `Básico 50`, `Pro 300`, `Premium 1000`) leído del plan del Tenant; mientras la fase 1 no exista, variable `NEXORA_IA_CUOTA_MENSUAL` (por defecto 30). Al llegar al tope: 429 «Llegaste al límite de consultas de este mes».
3. `GET /api/assistant/usage` → `{ usadas, limite, mes }` para el contador visible.

**Prueba B:** la consulta 31 de un mes con límite 30 da 429; el mes siguiente vuelve a 0; dos empresas no comparten contador.

## Bloque C — Pantalla (web)

`apps/web/src/Assistant.tsx`: botón flotante «Pregúntale a Nexora» en todas las pantallas después del login. Panel de chat, contador «12 de 30 este mes», botones de ejemplo: «Cuadre de hoy», «¿Quién facturó hoy y quién no?», «¿Cómo anulo una factura?», «Productos por agotarse». Accesible con teclado, 44 px, contraste ≥ 4,5:1, funciona a 320 px. Sin conexión: «El asistente necesita internet». Usa `api.ts` existente (token y `credentials: "include"`).

**Prueba C:** e2e con API y modelo falsos: abre, pregunta, ve respuesta y contador.

## Bloque D — Pedir, no modificar

La IA y el soporte pueden **pedir** cambios; la empresa los aprueba.

1. Herramienta `pedir_anulacion(factura, motivo)` que llama al `POST sales/:id/void-requests` que ya existe (`sales.ts:1689`, exige equipo aprobado y queda pendiente hasta que un gerente apruebe con su flujo actual). Antes de llamar, la web muestra «¿Enviar solicitud de anulación de FS-0123 por "…"?» y solo con **Sí** del usuario se envía (el modelo devuelve la intención; la confirmación es humana).
2. Nada más se puede pedir en esta fase. Correcciones de método de pago, entradas, salidas o reaperturas: la IA explica los pasos. Una tabla general de «solicitudes de cambio» queda para la fase 3, si la dueña la aprueba.

**Prueba D:** sin confirmación no se crea la solicitud; con confirmación queda `pending`; un admin recibe el mismo 403 que hoy.

## Bloque E — Acceso de soporte Nexora (la dueña da soporte sin modificar)

1. Rol nuevo `support` en `packages/shared/src/index.ts` → `permissions`, **solo lectura**: `["catalog:read", "reports:read", "profit:read"]`. Con eso ve los 40 reportes, el resumen y el reporte de caja; no puede vender, abrir/cerrar caja, anular, ajustar inventario ni cambiar precios (lo bloquea la guardia que ya existe).
2. En Configuración de cada empresa: interruptor «Permitir soporte de Nexora» (apagado por defecto). Al encenderlo, el dueño de la empresa elige duración (24 h, 7 días) y se crea o reactiva un usuario `soporte-nexora` con ese rol y contraseña aleatoria que se muestra una sola vez para enviarla a Nexora. Al vencer o apagarse, el usuario queda desactivado y sus sesiones revocadas.
3. Cada entrada y cada consulta del soporte queda en la bitácora visible para el dueño de la empresa («Soporte de Nexora consultó Cuadre de caja, 24-oct 6:10 p. m.»).
4. La dueña da el soporte entrando con ese usuario y usando el mismo «Pregúntale a Nexora».
5. **Dos cerrojos de solo lectura (Gemini, aprobado):** (a) la guardia (`AuthGuard`, `common.ts`) niega al rol `support` toda ruta que no sea GET, salvo cerrar sesión; (b) las consultas de negocio de ese usuario corren en una transacción `SET TRANSACTION READ ONLY` dentro del mismo cerrojo de empresa de `tenant-database.ts`. La bitácora del soporte, la actividad de sesión y los tokens se escriben **aparte**, fuera de esa transacción; si una ruta GET escribe algo (caché, actividad), documéntalo y sácalo de la transacción de solo lectura en vez de abrir la escritura.
6. En la pantalla del cliente: cinta visible «Soporte de Nexora con acceso hasta …» con botón «Quitar acceso» de un clic.

**Prueba E:** el usuario `support` recibe 403 en **todas** las rutas POST/PATCH/PUT/DELETE (recorrido automático de las rutas, como la matriz de aislamiento) y 200 en los reportes; vencido, 401.

## Puerta para aprobar la fase 2

- Matriz de aislamiento en 0 fugas con las rutas nuevas.
- Recorrido E de solo lectura sin una sola ruta de escritura abierta para `support`, y una prueba que demuestre que una escritura dentro de su transacción falla por `READ ONLY`.
- 20 pruebas de ataque bloqueadas: instrucciones escondidas en nombre de cliente y en nota de caja, lectura de otra empresa, margen pedido por una vendedora, rango de fechas excesivo y abuso de cuota.
- Costo medido con 20 preguntas de prueba: tokens promedio por pregunta y costo en US$ con los precios vigentes de la API, anotado en el informe (sirve para fijar el precio del plan «con asistente»).
- 3 CI en verde. Informe en `RESULTADOS_CHATGPT.md`, sección «Fase 2 IA».

## No hacer

- No usar `ANTHROPIC_API_KEY` real en pruebas ni en CI; todo con cliente falso.
- No enviar al modelo contraseñas, PIN, tokens, datos de tarjeta ni el encabezado `Authorization`.
- No dar a la IA rutas de escritura fuera del Bloque D.
- No desplegar.
