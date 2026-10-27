# Auditoría de Fase 6 — «Pregúntale a Nexora»

Fecha: 27-oct-2026  
Base: `producto-nexora` `c6148bac`  
Modalidad: solo lectura; sin claves reales, Render, producción o datos de la tienda.

## Veredicto

«Pregúntale a Nexora» está implementado, limitado a lectura y correctamente aislado por empresa en la base auditada. La evaluación local contra PostgreSQL aprobó **79/79** preguntas. No encontré un crítico ni un alto en el asistente principal.

Puede pasar a un piloto cerrado con administradores de empresas ficticias. No debe anunciarse todavía como canal de soporte ni fijarse un costo comercial definitivo: quedan las brechas indicadas abajo.

## Controles comprobados

- Entrada estricta, máximo 20 mensajes y 500 caracteres por pregunta: `apps/api/src/assistant.ts:1251-1258` y `:1481-1494`.
- Modelo económico configurable y sin clave devuelve 503: `apps/api/src/assistant.ts:1259-1281` y `:1483-1488`.
- Presupuesto total por pregunta de herramientas, datos y tokens: `apps/api/src/assistant.ts:1242-1243`.
- El cliente no puede inyectar respuestas anteriores del asistente: `apps/api/src/assistant.ts:1307-1320`.
- Lista cerrada de herramientas y rutas; las llamadas heredan el token del usuario y sus permisos.
- Costos y márgenes no salen a una vendedora: `apps/api/src/assistant.ts:1238-1240`.
- La caja ciega protege la respuesta rápida “mis ventas de hoy”: `apps/api/src/assistant.ts:1447-1464`.
- La cuota se reserva bajo candado por empresa antes del modelo: `apps/api/src/platform-ai-packs.ts:70-113`.
- La evaluación HTTP usa un modelo falso y PostgreSQL; resultado observado: 79/79.

## Hallazgos y pendientes

### IA-27-01 — Medio — soporte no puede usar el chat prometido

`apps/api/src/common.ts:814-822` bloquea correctamente toda petición no GET del rol soporte, salvo logout. El chat usa `POST /api/assistant/ask` en `apps/api/src/assistant.ts:1481-1483`, así que soporte recibe 403. Esta defensa evita escrituras indirectas, pero contradice el requisito antiguo de que soporte use el mismo chat.

**Reproducción:** entrar con una sesión temporal de soporte y llamar `POST /api/assistant/ask`; la guardia niega antes del controlador.

**Arreglo propuesto:** decisión de arquitectura. Recomendación: conservar el bloqueo y no dar chat libre a soporte; crear, si se aprueba, un endpoint GET estrictamente parametrizado para consultas cerradas o mantener soporte con pantallas/reportes de lectura. Cualquier excepción POST necesitaría una prueba HTTP que demuestre transacción `READ ONLY` y cero herramientas de escritura.

### IA-27-02 — Medio — el costo comercial no está medido con preguntas reales

El arnés N-06 usa tokens sintéticos de un modelo falso. Sirve para seguridad y lógica, no para afirmar costo por pregunta. No se usó `ANTHROPIC_API_KEY` real, como exige la regla de secretos.

**Reproducción:** revisar `tests/assistant-n06.test.ts`; los conteos no vienen de una factura del proveedor.

**Arreglo propuesto:** presupuesto autorizado y 20 preguntas de datos ficticios en un entorno de prueba; registrar tokens de entrada/salida, vueltas de herramientas y costo oficial sin guardar prompts sensibles. No poner claves en Git o chat.

### IA-27-03 — Medio — resumen diario sin consentimiento por empresa

`apps/api/src/daily-summary.ts:91-120` se activa con configuración global y recorre todas las empresas activas. Falta un interruptor por empresa apagado por defecto.

**Arreglo propuesto:** rama `fase6/resumen-opt-in`, con dos empresas de preferencias opuestas, bitácora y prueba roja/verde. Mantener cola idempotente y reintentos actuales.

### IA-27-04 — Medio — lectura de facturas sigue usando Opus por defecto

`apps/api/src/invoice.ts:324` fija `claude-opus-5-5`; `apps/api/src/merchandise.ts:278` permite reemplazarlo por entorno. Ya se extraen RNC, NCF e ITBIS, pero no existe la comparación autorizada de 10 facturas reales.

**Arreglo propuesto:** benchmark cerrado Haiku/Sonnet/Opus con 10 documentos autorizados, exactitud campo por campo y costo medido. Ninguna factura se guarda en Git.

### IA-27-05 — Bajo — MCP necesita un cliente comercial piloto

`apps/api/src/mcp.ts:65-136` aplica PKCE, código de un uso y token de 15 minutos. `apps/api/src/mcp.ts:139-205` revalida sesión, limita llamadas y usa RLS + `READ ONLY`. La prueba PostgreSQL pasa, pero faltan descubrimiento/registro dinámico y compatibilidad demostrada con el cliente que usará el negocio.

### IA-27-06 — Bloqueo externo — WhatsApp no se programa todavía

La Fase 0 documental existe. Faltan confirmación de política de Meta, verificación, elegibilidad de coexistencia y un número nuevo de prueba. No se debe programar ni conectar el número principal antes de resolverlos.

## Pruebas observadas

- `tests/assistant-eval-postgres.test.ts`: 79/79.
- Pruebas de exactitud, ataques, cuotas, presupuestos, caja ciega y errores: verdes dentro de la suite auditada.
- `tests/product-platform-ai-packs-postgres.test.ts`: paquetes y límite por empresa verdes.
- `tests/mcp-readonly-postgres.test.ts`: OAuth, canje único, revocación, RLS y rechazo de escritura verdes.
- Base `c6148bac`: `verify`, `windows-installer` y `render-images` verdes en GitHub.

## Próximas ramas, en orden

1. `chatgpt-nube/fase6-resumen-opt-in`: corrección IA-27-03 con regresión que falle antes y pase después.
2. `chatgpt-nube/fase6-costo-piloto`: solo cuando la dueña autorice presupuesto y canal de secreto.
3. `chatgpt-nube/fase6-facturas-modelo`: solo al recibir 10 documentos autorizados.
4. `chatgpt-nube/fase6-mcp-piloto`: cuando se elija el cliente MCP comercial.

No se cambió código en esta rama: la pieza «Pregúntale a Nexora» ya está integrada y probada; duplicarla crearía riesgo. Las correcciones se separan para mantener cada regresión y cada decisión aisladas.
