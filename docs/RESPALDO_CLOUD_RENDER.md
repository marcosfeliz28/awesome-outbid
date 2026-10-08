# Copia diaria privada de Render a la laptop

## Arquitectura propuesta

1. Render PostgreSQL conserva su recuperación a un punto en el tiempo (PITR).
   Esa protección ayuda a recuperarse de errores recientes, pero no equivale a
   una copia lógica descargable a la laptop.
2. Un cron opcional de Render, en la misma región y red privada que PostgreSQL,
   ejecuta `pg_dump` directo a la URL interna, verifica el archivo con
   `pg_restore --list`, calcula SHA-256 y lo envía a un bucket S3 privado. La
   base no necesita URL externa ni cambio de reglas IP.
3. La laptop ejecuta `scripts/pull-cloud-backup.ps1` con AWS CLI y `pg_restore`.
   Utiliza un perfil lector del bucket, descarga el último archivo que tenga
   manifiesto, comprueba nombre/tamaño/hash y la legibilidad, y sólo entonces
   lo deja en la carpeta local persistente.
4. Cuando la laptop está apagada, Render sigue conservando la copia en S3.
   Al encenderla y ejecutarse la descarga, se trae la última copia disponible.

El cron se describe en
[`backup-cron.example.yaml`](../deploy/render/backup-cron.example.yaml) y su
contenedor en [`Dockerfile`](../deploy/render/backup/Dockerfile). El fragmento
no forma parte del Blueprint activo: incorporarlo y sincronizarlo crearía un
recurso facturable. El script local está en
[`pull-cloud-backup.ps1`](../scripts/pull-cloud-backup.ps1). Ninguna credencial,
cuenta o regla de red se añadió ni se configuró.

## Secretos y permisos

- El cron requiere `BACKUP_DATABASE_URL`, configurada como secreto en Render.
  Debe usar el host/puerto internos de PostgreSQL y una cuenta dedicada con
  acceso de lectura al contenido que se respaldará; no copies la URL externa ni
  la conexión principal de superusuario. Crear el rol y conceder sus permisos
  aún requiere una revisión/operación DBA; este trabajo no ejecuta SQL ni
  cambia usuarios o privilegios en la base.
- `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_REGION` y
  `S3_BUCKET_NAME` se completan como variables privadas en Render al activar el
  servicio. El archivo de ejemplo declara secretos `sync: false`, sin valores.
- Usa un bucket sin acceso público y una política de ciclo de vida para expirar
  respaldos tras 30 días. El uploader exige SSE-S3 (`AES256`) en cada objeto.
  La versión activa del
  objeto no se borra desde el cron. Habilitar versionado y expirar versiones
  antiguas es una decisión de costo/recuperación separada.
- La clave del cron debe limitarse a `s3:PutObject` y las operaciones de
  multipart necesarias únicamente bajo el prefijo `nexora/postgres/*` del
  bucket; no necesita `GetObject`, `DeleteObject`, ACL ni permiso de listar.
- El perfil de laptop debe ser distinto: sólo `s3:ListBucket` condicionado a
  ese prefijo y `s3:GetObject` sobre él. No debe poder escribir ni eliminar.
  AWS IAM Identity Center/SSO evita una clave estática permanente; si se
  requiere sincronización no interactiva, protege las credenciales de lectura
  como secreto local del usuario y cifra el disco.
- No pases contraseñas como argumentos de `pg_dump`, no habilites logs de
  variables, no incluyas URLs o claves en capturas, historial, `.env.example`,
  Git ni tickets. El script entrega credenciales a `pg_dump` mediante variables
  de ambiente mínimas y por separado.

## Activación futura (no ejecutada)

1. Crear bucket privado en AWS S3, aplicar cifrado y ciclo de vida, y crear dos
   identidades/policies mínimas: escritura para Render y lectura para la laptop.
2. Crear/revisar un usuario PostgreSQL dedicado de backup de sólo lectura,
   otorgando acceso de lectura a tablas, secuencias y objetos presentes y
   futuros en los esquemas de la aplicación. Confirmar que no se perderían filas
   por políticas RLS; no usar la URL del propietario/admin.
3. Confirmar la versión mayor real de PostgreSQL y la región de `nexora-pos-db`;
   el Dockerfile de respaldo fija cliente PostgreSQL 17, y la región del ejemplo
   Virginia corresponde al Blueprint actual. Si cualquiera cambia, actualizar
   y validar el ejemplo primero.
4. Completar `BACKUP_DATABASE_URL` y las variables secretas de S3 en Render y sincronizar sólo después de
   revisar el costo: Render cobra como mínimo US$1/mes por servicio cron; S3
   añade almacenamiento, solicitudes y transferencia.
5. Ejecutar una prueba manual desde Runs, comprobar en bucket que haya `.dump`,
   `.sha256` y `.json`, luego probar restauración en una base vacía/no productiva.
   No probar mediante restauración sobre `fitstore` de producción.
6. Configurar en Windows una tarea del usuario que posee el perfil AWS (no la
   tarea existente que corre como SYSTEM) para ejecutar el script de descarga
   cuando el equipo esté disponible. La tarea existente **FitStore POS -
   Respaldo diario** conserva la base PostgreSQL local y no realiza esta
   descarga cloud. Si el equipo está apagado, `StartWhenAvailable` permite
   recuperar al volver a encenderlo; no promete una copia física en la laptop
   mientras ésta permanece apagada.
7. Verificar semanalmente fechas, manifiestos y una restauración controlada.
   El cron se considera fallido si el comando falla; configura una alerta sobre
   las ejecuciones fallidas antes de depender del sistema para recuperación.

## Límites constatados

- Render ofrece PITR continuamente para bases pagadas; el período depende del
  plan del workspace (Hobby: 3 días; Pro o superior: 7 días). Los exports
  lógicos de la interfaz se retienen 7 días y no se generan en bases Free.
- Render Cron no recibe solicitudes entrantes y puede conectarse a servicios
  por la red privada, pero no tiene disco persistente. Por eso el cron transmite
  a almacenamiento externo y no guarda el dump en su filesystem como backup
  duradero.
- S3 protege el artefacto aun cuando la laptop esté apagada. Ningún sistema
  puede escribir un archivo en una laptop apagada; la copia local se actualiza
  al siguiente encendido y ejecución de la tarea.
- El cron no se incluyó en `render.yaml` activo ni se desplegó. No hay bucket,
  credenciales, política de retención, tarea de Windows, copia cloud reciente
  ni restauración probada configurados a partir de este cambio. La URL de
  backup-role, los permisos DB, la política IAM S3 y la agenda local necesitan
  revisión y configuración fuera del repositorio antes de ejecutar.

## Fuentes oficiales

- [Render Postgres Recovery and Backups](https://render.com/docs/postgresql-backups)
- [Back Up Render Postgres to Amazon S3](https://render.com/docs/backup-postgresql-to-s3)
- [Render Private Network](https://render.com/docs/private-network)
- [Render Cron Jobs](https://render.com/docs/cronjobs)
- [Render Environment Variables and Secrets](https://render.com/docs/configure-environment-variables)
- [Render Blueprint Specification](https://render.com/docs/blueprint-spec)
