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
