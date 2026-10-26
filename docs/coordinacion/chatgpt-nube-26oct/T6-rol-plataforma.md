# T6 · PLA-05: rol PostgreSQL de mínimo privilegio para plataforma

Fecha: 2026-10-26  
Rama auditada: `origin/claude/producto-mezcla-4`  
Commit auditado: `1e7b1b25d91d0cadab1167e243eaac7d32b2d4a0`  
Alcance: diseño solamente; no se implementó migración, variable ni cambio de aplicación.

## Riesgo que resuelve

### Alta · Las rutas del operador usan una conexión propietaria

- `apps/api/src/registration.ts:124-128`: `RegistrationService` crea un `PrismaClient` con `DATABASE_URL`, sin rol restringido.
- `apps/api/src/platform.ts:82-92`, `apps/api/src/platform-billing.ts:69-82` y `apps/api/src/platform-ai-packs.ts:124-135`: las rutas de plataforma consumen esa conexión.
- `apps/api/src/registration.ts:94-121`: el alta actual ejecuta `SET LOCAL ROLE nexora_tenant_runtime`; dar esa membresía al rol de plataforma le permitiría acceder a tablas de negocio.
- `apps/api/prisma/migrations/202610280004_product_billing/migration.sql:8-29` y `202610280006_product_cash_quota/migration.sql:1-6`: el rol de facturación existente tiene lectura que excede PLA-05, por lo que no debe reutilizarse.
- `render.yaml:50,58-61` y `deploy/render/with-cloud-env.mjs:63-105`: hoy se entrega una única conexión propietaria.

**Cómo reproducir el riesgo:** comprometer una consulta construida por una ruta `/platform`; esa ruta comparte las credenciales capaces de consultar tablas empresariales, aunque el contrato HTTP no las exponga.

**Arreglo propuesto:** conexión exclusiva `PLATFORM_DATABASE_URL`, sin privilegios directos sobre tablas, que solo pueda ejecutar funciones cerradas del esquema `nexora_platform`.

## Objetos propuestos

1. `nexora_platform_executor NOLOGIN`: propietario de las funciones cerradas y con permisos internos mínimos.
2. `nexora_platform_api NOLOGIN`: creado por migración y habilitado como `LOGIN` después, con secreto generado fuera del repositorio.
3. Esquema `nexora_platform`: contiene únicamente las funciones accesibles por la API.

`nexora_platform_api`:

- no pertenece a `nexora_tenant_runtime`, `nexora_platform_billing` ni al ejecutor;
- no recibe permisos directos sobre tablas o secuencias;
- recibe solo `CONNECT`, `USAGE` del esquema y `EXECUTE` función por función;
- no tiene `SUPERUSER`, `CREATEDB`, `CREATEROLE`, `REPLICATION` ni `BYPASSRLS`.

Las funciones serán `SECURITY DEFINER`, propiedad de `nexora_platform_executor`, y deben usar:

- `search_path = pg_catalog`;
- nombres totalmente cualificados, por ejemplo `public."Tenant"`;
- ningún SQL dinámico;
- `REVOKE EXECUTE ... FROM PUBLIC`;
- validación e invariantes dentro de la misma transacción.

## Funciones permitidas

Lectura:

- `list_tenants()`;
- `platform_summary()`;
- `tenant_detail(slug)`;
- `list_platform_payments(slug)`;
- `ai_usage(slug)`;
- `list_support_grants()`.

Mutación:

- `create_tenant_with_invitation(...)`;
- `replace_invitation(..., action)`;
- `create_password_reset(...)`;
- `register_platform_payment(...)`;
- `void_platform_payment(...)`;
- `credit_ai_pack(...)`;
- `open_support_session(...)`;
- `claim_operator_notice(...)`;
- `mark_operator_notice_sent(...)`.

El alta completa debe vivir dentro de `create_tenant_with_invitation`; la cuenta de la API nunca debe poder ejecutar `SET ROLE nexora_tenant_runtime`.

## Acceso interno del ejecutor

| Tabla | Operaciones mínimas | Motivo |
|---|---|---|
| `Tenant` | `SELECT`, `INSERT` y `UPDATE` de columnas concretas | Empresa, plan y vigencia |
| `Role` | `SELECT`, `INSERT` | Roles iniciales |
| `User` | `SELECT`, `INSERT` y `UPDATE` limitado | Dueña, invitación y recuperación |
| `Settings` | `INSERT` | Configuración inicial |
| `Customer` | Solo `INSERT` | Crear exactamente «Consumidor final» en el alta |
| `RefreshToken` | `DELETE` por usuario | Recuperación de contraseña |
| `AuthSession` | `INSERT`, `DELETE` por usuario | Soporte y cierre de sesiones |
| `AuditLog` | `INSERT` y lectura agregada limitada | Bitácora y consumo IA |
| `PlatformPayment` | `SELECT`, `INSERT` | Cobro manual y anulación inmutable |
| `AiPackCredit` | `SELECT` agregado, `INSERT` | Paquetes IA |
| `TenantLifecycleNotice` | `SELECT`, `INSERT`, `UPDATE` limitado | Avisos idempotentes |

No se concede ninguna operación sobre `Sale`, `SaleItem`, `Payment`, `Product`, `Variant`, inventario, costos o caja. Aunque el ejecutor requiera `INSERT` en `Customer`, `nexora_platform_api` no recibe ese permiso: solo invoca la función de alta con contrato cerrado.

## Migración propuesta

Nombre: `202611010002_pla05_platform_runtime`.

Debe:

1. Crear ambos roles como `NOLOGIN` de forma idempotente.
2. Crear el esquema `nexora_platform`.
3. Revocar todos los permisos de tablas y secuencias a `nexora_platform_api`.
4. Conceder al ejecutor solo columnas y operaciones expresamente enumeradas.
5. Crear las políticas RLS necesarias únicamente para tablas operativas.
6. Crear las funciones con contratos estrechos.
7. Revocar ejecución a `PUBLIC` y concederla función por función.
8. Configurar `statement_timeout = 10s`, `lock_timeout = 2s`, `idle_in_transaction_session_timeout = 10s` y `CONNECTION LIMIT 5`.
9. Fallar si `nexora_platform_api` es miembro de `nexora_tenant_runtime`, `nexora_platform_billing` o `nexora_platform_executor`.

La migración no debe contener contraseña. Un paso administrativo posterior activa `LOGIN` y recibe el secreto por un canal seguro, nunca como argumento visible ni archivo versionado.

## Variable y conexión de aplicación

Variable nueva: `PLATFORM_DATABASE_URL`.

Debe apuntar a `nexora_platform_api`, exigir TLS y UTC y usar un pool pequeño. La futura clase `PlatformDatabase` debe:

1. usar exclusivamente esa variable;
2. cancelar el arranque en modo producto si falta;
3. comprobar `current_user` y la ausencia de privilegios elevados;
4. comprobar negativamente permisos sobre `Sale`, `Customer` y `Product`;
5. no tener fallback silencioso a `DATABASE_URL`.

La conexión propietaria queda temporalmente reservada para migraciones y servicios globales aún no separados.

## Despliegue gradual en Render sin corte

1. Aplicar la migración aditiva con la conexión propietaria actual; no cambia rutas ni datos.
2. Generar una contraseña aleatoria fuera del repositorio, habilitar `nexora_platform_api LOGIN` y guardar `PLATFORM_DATABASE_URL` como secreto.
3. Probar la conexión restringida y todas las negativas antes de cambiar controladores.
4. Desplegar una versión que inyecte `PlatformDatabase` en todas las rutas `/platform`.
5. Hacer que el proceso pruebe ambas conexiones antes de declararse saludable; si falla el arranque, Render conserva la versión anterior.
6. Validar todas las rutas del operador y repetir la comprobación de privilegios.
7. No retirar todavía los objetos aditivos; para rollback basta volver al código anterior.
8. Después de estabilizar, separar plataforma y trabajadores globales en otro servicio sin `DATABASE_URL` propietaria.

## Pruebas obligatorias

Con `PLATFORM_DATABASE_URL` directamente:

- `SELECT`, `INSERT`, `UPDATE`, `DELETE` y `TRUNCATE` sobre `Sale`: SQLSTATE `42501`.
- Las mismas operaciones sobre `Product`: `42501`.
- `SELECT`, `UPDATE`, `DELETE` e inserción arbitraria sobre `Customer`: `42501`.
- `SET ROLE nexora_tenant_runtime`: `42501`.
- `CREATE ROLE`, `CREATE TABLE` y `ALTER TABLE`: denegados.
- `has_table_privilege(...)` falso para `Sale`, `Customer` y `Product`.
- ejecución de cualquier función no enumerada: denegada.

Pruebas positivas:

- crear empresa e invitación;
- reenviar y revocar invitación;
- recuperar contraseña y cerrar sesiones;
- registrar, listar y anular cobros;
- acreditar paquete IA y consultar consumo;
- abrir soporte solo con autorización;
- escribir bitácora y reclamar avisos;
- sembrar valores secretos en ventas, clientes y productos y confirmar que ninguna respuesta `/platform` los contiene.

## Límite explícito

PLA-05 reduce el daño de consultas accidentales o inyección SQL en las rutas del operador. No protege frente a ejecución arbitraria en todo el proceso mientras otros servicios del mismo proceso conserven `DATABASE_URL`; el aislamiento completo exige separar posteriormente la plataforma y los trabajadores globales en otro servicio.

## Revisión independiente del diseño T6 · precisiones antes de implementar

Revisión de solo lectura del documento T6 publicado en `eefb0fc` y del código `1e7b1b25d91d0cadab1167e243eaac7d32b2d4a0`. No se ejecutó SQL, se creó una migración ni se modificó la aplicación. Esta sección complementa el plan; no certifica un rol que aún no existe.

### Alta · Separar la prohibición de leer con el rol SQL de la suplantación mediante recuperación

**Evidencia:** `apps/api/src/platform.ts:194-220` entrega a quien tiene la credencial Platform un enlace para restablecer al administrador de una empresa existente. `apps/api/src/registration.ts:181-223` acepta ese enlace y fija contraseña/PIN del administrador. La función propuesta `create_password_reset` del plan T6 conserva este flujo.

**Reproducción propuesta, solo en empresa sintética:** solicitar reset de la empresa A como operador; aceptar el enlace con nuevas credenciales; iniciar sesión como su administrador; solicitar ventas/clientes/productos. Esto prueba una vía indirecta distinta de `SELECT` con `PLATFORM_DATABASE_URL`.

**Esperado:** el operador sin autorización de soporte no debe adquirir lectura de negocio. **Observado estáticamente:** una conexión SQL restringida no impide obtener una sesión admin mediante ese enlace. **Propuesta:** no considerar PLA-05 como cierre de este riesgo. Separar la recuperación de empresas ya activas del alta inicial: entrega al contacto verificado por un canal que no devuelva el token al operador y confirmación del titular, antes de emitir una sesión. El cambio de seguridad requiere aprobación e implementación aparte; mientras tanto, documentar que la garantía es únicamente sobre las credenciales SQL. El soporte autorizado existente (`support-access.ts:126-144`) es una excepción explícita de lectura temporal, no una prueba de acceso general prohibido.

### Media · El `search_path` propuesto debe considerar los triggers existentes y `pg_temp`

**Evidencia:** T6 propone `search_path = pg_catalog`; `apps/api/prisma/migrations/202611010001_tenant_fk_indice/migration.sql:10-14` resuelve `quote_ident(TG_ARGV[0])::regclass` y consulta el padre sin esquema. El alta crea `Role` y `User` (`registration.ts:103-111`), por lo que ejecuta esta guardia. El padre se resuelve usando el contexto del invocador; cualificar solo las consultas de la función exterior no cualifica esas del trigger.

**Reproducción propuesta:** en una copia sintética, crear los futuros wrappers con `search_path=pg_catalog` y ejecutar el alta completa. Sin una tabla temporal homónima, el trigger puede no resolver `public."Role"`; con permiso TEMP y una tabla temporal homónima, el orden implícito de `pg_temp` cambia la resolución. No se afirma una explotación reproducida.

**Esperado:** alta funcional y resolución exclusiva de tablas confiables. **Propuesta:** inventariar el árbol completo de funciones/triggers invocados. O cualificar y fijar el esquema de la guardia existente en un cambio específico revisado, o usar en el wrapper `SET search_path = pg_catalog, public, pg_temp`, con `CREATE` en `public` revocado a todos los principales no confiables; todas las consultas propias siguen cualificadas. `pg_temp` debe aparecer explícitamente al final, no quedar implícito al principio. Probar la función con un temporal `"Role"` preparado por el cliente y demostrar que no influye. No conceder membresía en el ejecutor al login como arreglo del problema.

### Media · Comprobar permisos efectivos, no solo revocaciones directas

**Evidencia:** T6, pasos de migración 3 y 9, revoca al API y revisa tres membresías. PostgreSQL suma permisos directos, heredados y de `PUBLIC`; `REVOKE ... FROM nexora_platform_api` no elimina un permiso recibido por `PUBLIC` ni a través de otro rol. `NOINHERIT` por sí solo tampoco impide `SET ROLE` autorizado.

**Reproducción propuesta:** en la base sintética, conceder `SELECT` de `Customer` a `PUBLIC` o a un rol intermedio miembro del API; ejecutar las revocaciones directas del plan; intentar la lectura. También probar un rol preexistente con el mismo nombre, propietario de una tabla o con una membresía transitiva elevada.

**Esperado:** preflight/migración fallan antes de habilitar la conexión. **Propuesta:** verificar cierre transitivo de `pg_auth_members`, privilegios efectivos con `has_table_privilege` y `has_any_column_privilege`, propietarios de tablas/esquemas, atributos de cada rol alcanzable y permisos `SET` según versión de PostgreSQL. Excluir también `pg_read_all_data`, `pg_write_all_data`, `pg_read_server_files`, `pg_write_server_files` y `pg_execute_server_program`. Un nombre de rol existente no debe adoptarse silenciosamente con `IF NOT EXISTS`: comprobar su estado completo o abortar con diagnóstico. Inventariar permisos `PUBLIC` en la base, esquema, funciones y relaciones; retirar los peligrosos solo tras reponer explícitamente lo que necesiten las conexiones legítimas. No hacer una revocación global ciega durante la transición.

### Media · Concretar el contrato de funciones que pueden crear identidades

**Evidencia:** el plan ofrece `create_tenant_with_invitation`, `replace_invitation`, `create_password_reset` y `open_support_session`; su ejecutor necesita escribir `User`, `Role`, `Settings`, `Customer` y `AuthSession`. El alta actual genera la empresa internamente (`registration.ts:100`) y los roles base en código (`:103-105`). Soporte valida rol, actividad y vencimiento (`support-access.ts:133-135`).

**Reproducción propuesta:** llamar cada función directamente como login de plataforma, sin pasar por Zod/HTTP, con tenant existente, usuario admin ajeno, rol arbitrario, permiso `*`, `action` inesperada y JSON con campos extra. Probar llamadas simultáneas de aceptar/reemitir invitación y de revocar/abrir soporte.

**Esperado:** estas entradas se rechazan sin crear usuarios, cambiar permisos ni emitir sesiones ajenas. **Propuesta:** contrato de argumentos tipado, sin columnas/roles/SQL/JSON de actualización libre. El alta genera el UUID y solo si acaba de crear esa empresa inserta el único consumidor final y los roles constantes; no admite usar un tenant existente. La función de soporte deriva internamente el usuario reservado, valida rol/vencimiento/autorización y lo bloquea dentro de la transacción antes de crear la sesión. La función nunca acepta un `userId` arbitrario para convertirse en otro usuario. `replace_invitation` utiliza una enumeración cerrada de acciones y comparación del hash vigente; no decide permisos a partir de `app.tenant_id` aportado por el cliente.

Separar ejecutores `NOLOGIN` por capacidad (bootstrap, identidad/soporte, cobros, uso/avisos) reduce el alcance de un error en una función. Ninguno debe ser propietario de las tablas de negocio ni tener `BYPASSRLS`. Las políticas globales de cada ejecutor se limitan a sus operaciones/columnas; nunca se añade una política global a `Sale`, `Product`, `Payment`, inventario o caja. En `AuditLog`, «lectura agregada» debe convertirse en permisos de columnas (`tenantId`, `action`, `createdAt`) más una función que devuelve solo conteos; no `SELECT` de `before/after` ni de toda la tabla. No devolver hashes, tokens de sesión ni objetos completos de Prisma.

### Ampliación de aceptación y transición

- Ejecutar los negativos desde una **conexión real autenticada como el login nuevo**, no desde una conexión propietaria que simplemente hizo `SET ROLE`: esta última puede recuperar al propietario con `RESET ROLE`. Probar `SET ROLE`, `RESET ROLE`, cambio de `app.tenant_id` a A/B/vacío y `SET row_security=off`; ninguna variante debe dar acceso a negocios.
- Sembrar marcadores distintos en ventas, productos y clientes de A y B. Probar acceso directo, subconsultas, joins, `COPY ... TO STDOUT`, vistas y funciones de aplicación accesibles; inspeccionar también permisos por columna. No debe bastar con que una consulta devuelva cero filas: el requisito de este login es ausencia del privilegio.
- La prueba «cualquier función no enumerada está denegada» se refiere a funciones de aplicación/`SECURITY DEFINER` que alcanzan datos, no a todo `pg_catalog`: funciones inocuas del motor siguen siendo necesarias. Auditar todas las funciones definidoras existentes con `prosecdef`, ACL, propietario y `proconfig`; ningún ejecutable por `PUBLIC` puede servir de puente a tablas protegidas. Crear/revocar/grant de nuevas funciones en una sola transacción evita una ventana de ejecución pública.
- Antes de migrar, comprobar si el usuario administrativo del proveedor permite crear roles y asignar propietarios. Si no, el aprovisionamiento lo debe hacer el administrador autorizado; **no** sustituir el rol limitado por el propietario. El nombre del prefijo de migración debe reservarse después de conocer la última migración de la rama de integración; `202611010002` es una propuesta, no una reserva segura mientras otros agentes trabajan.
- No prometer disponibilidad por una propiedad de Render no comprobada: la estrategia de conservar versión anterior exige comprobar healthcheck, recursos y comportamiento de reemplazo del servicio concreto. Hacer primero ensayo local/staging con versión vieja/nueva, drenado del pool y migración compatible. El rollback de código anterior recuperaría el riesgo de PLA-05: debe quedar explícito, no contarse como seguridad conservada.
- Los respaldos/exports necesitan leer tablas empresariales: `tenant-backup.ts:168-189` recorre cada tabla. No conceder esos permisos al login de plataforma para mantenerlos funcionando. Conservarlos bajo identidad y autorización separadas; una exportación pedida por un operador no debe convertirse en descarga arbitraria de un tenant.

No se implementaron ni ejecutaron estas pruebas: son condiciones de aceptación para el futuro cambio PLA-05. El plan base sigue válido como dirección, pero estos puntos deben incorporarse antes de certificar aislamiento del operador o una transición sin interrupciones.
