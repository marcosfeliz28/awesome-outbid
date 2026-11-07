# Auditoría técnica del contrato · 7-nov-2026

Alcance: contraste de `01` a `05` y `PUNTOS_PARA_ABOGADO.md` contra
`origin/nexora-cloud` (`3606676a`) y, solo como código candidato aún no
integrado, `claude-pc/ia-ventas-rescate` (`8954a099`). No se revisó producción,
Render, datos reales ni credenciales. Esta es una auditoría técnica, no legal.
No se cambió ningún precio.

## Resumen

El contrato acierta al presentar como pendientes los precios y decisiones de la
dueña, al aclarar que los recibos no son NCF/e-CF y al condicionar el respaldo
externo a que Google Drive esté conectado. Antes de firmarlo hay que corregir
seis afirmaciones técnicas: la IA de ventas todavía no forma parte de
`nexora-cloud`; su medidor guarda una fila por consulta, no un contador diario;
no existe una supresión automática por empresa al terminar el contrato; falta
fijar la rotación real de respaldos; el sistema no detecta datos personales
escritos dentro de una pregunta; y el rechazo de inyección protege las
herramientas, pero no impide enviar la pregunta al proveedor.

## Desajustes y texto propuesto

### 1. La IA de ventas aún no está integrada ni desplegada — alta

**Dónde:** `01_CONTRATO_SERVICIO_SAAS.md:161`,
`02_POLITICA_PRIVACIDAD.md:30,50`,
`03_ACUERDO_ENCARGADO_TRATAMIENTO.md:97,126` y
`04_TERMINOS_USO_IA_VENTAS.md:13-43`.

**Evidencia:** `origin/nexora-cloud` no contiene `apps/api/src/assistant.ts`.
El código existe únicamente en la rama candidata `claude-pc/ia-ventas-rescate`
al momento de esta auditoría. El propio punto 14 de `PUNTOS_PARA_ABOGADO.md`
reconoce que la afirmación depende de lo desplegado.

**Riesgo:** firmar el texto actual promete una función y controles que el
producto base todavía no ofrece.

**Texto corregido propuesto:**

> La IA de ventas es una función opcional que solo queda incluida cuando la
> Hoja de contratación la identifica como activa y la versión instalada del
> Servicio contiene esa función. Antes de activarla, la proveedora verifica que
> el código desplegado cumple los controles descritos en este anexo. Mientras
> no esté activa, las afirmaciones técnicas de las secciones 2 a 4 no aplican.

### 2. No se guarda un “contador diario”; se guarda una fila por consulta — media

**Dónde:** `02_POLITICA_PRIVACIDAD.md:30,50`.

**Evidencia:** la rama candidata reserva una fila `AiUsage` por pregunta con
usuario, sucursal, fecha/hora, función, modelo, tokens, costo estimado y estado
(`apps/api/src/assistant.ts:565-605`; modelo en
`apps/api/prisma/schema.prisma:1266-1279`). No hay columnas para el texto de la
pregunta o de la respuesta. `04_TERMINOS_USO_IA_VENTAS.md` ya fue corregido en
la rama candidata, pero `02` y `03` conservan la descripción anterior.

**Texto corregido propuesto:**

> Por cada consulta se guarda un registro de uso: usuario, sucursal, fecha y
> hora, función, modelo, tokens, costo estimado y si terminó correctamente. Ese
> registro no contiene el texto de la pregunta ni el de la respuesta.

### 3. La supresión por terminación no está automatizada — alta

**Dónde:** `01_CONTRATO_SERVICIO_SAAS.md:77,219`,
`02_POLITICA_PRIVACIDAD.md:97`,
`03_ACUERDO_ENCARGADO_TRATAMIENTO.md:89-91` y
`05_CONDICIONES_DE_COBRO.md:55`.

**Evidencia:** `apps/api/src/retention.ts` purga eventos técnicos, avisos,
intentos de autenticación, tokens vencidos, parte de la bitácora y adjuntos
huérfanos. No hay un proceso que, a los 30/60 días de terminar un contrato,
bloquee y suprima todos los datos de una empresa. Tampoco se encontró una
marca de terminación de contrato que active ese proceso.

**Riesgo:** el plazo puede asumirse como una capacidad automática ya existente.

**Texto corregido propuesto mientras no exista el flujo:**

> Al terminar el contrato, la proveedora ejecutará un procedimiento documentado
> de exportación, bloqueo y supresión. Los plazos de [30] y [60] días son un
> compromiso operativo pendiente de aprobación y de implementar un control por
> empresa; no dependen hoy de una purga automática del sistema. La supresión
> excluye lo que deba conservarse por ley y las copias sujetas a la rotación
> indicada expresamente en este contrato.

Antes de firmar debe existir el procedimiento, una persona responsable y una
prueba de ejecución; de lo contrario, eliminar los plazos o marcarlos como
PENDIENTES.

### 4. La rotación de respaldos sigue sin quedar determinada — media

**Dónde:** `02_POLITICA_PRIVACIDAD.md:97` y
`03_ACUERDO_ENCARGADO_TRATAMIENTO.md:91,124`.

**Evidencia:** el código sí crea respaldos cifrados AES-256-GCM cuando Drive
está conectado (`apps/api/src/drive-backup.ts` y
`drive-backup-core.ts`). También tiene un plan de rotación técnica, pero el
contrato deja “calendario real: COMPLETAR” y no incorpora ese calendario como
obligación contractual. El respaldo local del instalador y el respaldo SaaS de
Drive son mecanismos distintos.

**Texto corregido propuesto:**

> Si el respaldo externo está conectado y operativo, el Servicio intenta un
> respaldo diario cifrado. La política de rotación aplicable es: [COMPLETAR CON
> EL CALENDARIO APROBADO]. Si no está conectado o falla, el panel administrativo
> muestra el estado; la proveedora no debe afirmar que existe una copia externa
> exitosa sin comprobarla. Los respaldos locales del producto instalado no
> sustituyen este respaldo del servicio SaaS.

### 5. “No guarda consultas” necesita una reserva sobre registros externos — media

**Dónde:** `01_CONTRATO_SERVICIO_SAAS.md:161`,
`02_POLITICA_PRIVACIDAD.md:50-52`,
`03_ACUERDO_ENCARGADO_TRATAMIENTO.md:97` y
`04_TERMINOS_USO_IA_VENTAS.md:21-27`.

**Evidencia:** en la rama candidata no se encontró escritura de pregunta o
respuesta en la base ni en `AuditLog`; cada llamada empieza sin historial. Sin
embargo, la pregunta se envía íntegra a Anthropic
(`apps/api/src/assistant.ts:464,483-490`) y no se inspeccionaron registros del
alojamiento o del proveedor. El contrato ya marca parte de esto como
`NO VERIFICADO`, pero el titular “No guarda consultas” es absoluto.

**Texto corregido propuesto:**

> Norexos no persiste el texto de las preguntas ni de las respuestas en su base
> funcional y no crea historial entre consultas. La pregunta sí se transmite al
> proveedor de IA para responder. La retención en registros técnicos de
> alojamiento y del proveedor es NO CONFIRMADA hasta revisar y anexar sus
> términos vigentes.

### 6. No hay detección de datos personales ni rechazo previo de inyección — media

**Dónde:** `04_TERMINOS_USO_IA_VENTAS.md:25,63` y
`02_POLITICA_PRIVACIDAD.md:50-52`.

**Evidencia:** la API limita la pregunta a 500 caracteres y los esquemas de las
herramientas son estrictos. Las herramientas no aceptan `branchId`, `userId` ni
operaciones de escritura; los reportes usan el actor autenticado. Esto evita
que una instrucción maliciosa cambie de empresa o ejecute una acción. Sin
embargo, no existe un clasificador que rechace la pregunta por contener una
inyección o datos personales: el texto se envía al proveedor y el modelo recibe
instrucciones para ignorarla (`apps/api/src/assistant.ts:432-448,637-657`).

**Texto corregido propuesto:**

> El Servicio valida en el servidor las herramientas y la pertenencia de los
> datos, por lo que una instrucción incluida en la pregunta no autoriza acciones
> ni acceso a otra empresa. El sistema no detecta ni elimina automáticamente
> datos personales o secretos escritos por el usuario antes de enviarlos al
> proveedor; el usuario no debe incluirlos. Una pregunta manipuladora puede ser
> procesada por el proveedor, aunque sus solicitudes de herramientas se
> rechacen.

## Afirmaciones comprobadas

- Los recibos siguen marcados como no fiscales y el modo preparado solo recoge
  una solicitud de tipo NCF; no asigna ni emite el NCF/e-CF.
- Contraseñas y PIN se guardan como hash/verificador, no en texto legible.
- El respaldo externo usa cifrado AES-256-GCM cuando Drive está conectado.
- El endpoint del medidor `GET /ai/usage` está reservado a `@Permit("*")` y
  filtra las filas por `actor.branchId`.
- La rama candidata de IA ofrece solo herramientas de lectura, limita la
  pregunta a 500 caracteres, aplica topes diarios y filtra costo/utilidad por
  permiso.

## Pendiente de terceros o de la dueña

- Abogado dominicano: todos los puntos de `PUNTOS_PARA_ABOGADO.md`, en especial
  plazos, transferencias internacionales, responsabilidad y terminación.
- Dueña: aprobar planes, precios, plazos, soporte y calendario de rotación.
- Operaciones: documentar y probar exportación/supresión al terminar contratos.
- Proveedor de IA y alojamiento: confirmar región, retención, entrenamiento y
  contenido de registros técnicos. Hasta entonces: **NO CONFIRMADO**.
