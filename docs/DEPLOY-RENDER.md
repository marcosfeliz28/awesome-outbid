# Preparación de Nexora POS para Render

**Estado:** código preparado y validable; no se ha creado, comprado ni desplegado ningún recurso.

Este documento acompaña `render.yaml`. El Blueprint describe una web pública,
una API privada y PostgreSQL sin acceso público. Los nombres internos
`fitstore` de la base, el usuario y los paquetes se conservan deliberadamente:
son identificadores técnicos existentes, no la marca visible.

## Arquitectura declarada

```text
Internet -> HTTPS de Render -> nexora-pos-web (Nginx + PWA)
                                  |
                                  | /api/* por red privada
                                  v
                              nexora-pos-api
                                  |
                                  | URL interna + TLS
                                  v
                              nexora-pos-db
```

- Sólo `nexora-pos-web` es un servicio público.
- `nexora-pos-api` es `pserv`; no recibe subdominio público.
- `nexora-pos-db` tiene `ipAllowList: []`, por lo que no acepta conexiones
  desde Internet.
- Los tres recursos están fijados en `virginia` y usan una sola instancia para
  el piloto.
- `autoDeployTrigger: off` evita que web, API y migraciones se publiquen en un
  orden accidental. Cada liberación debe iniciarse de forma controlada.

## Archivos de despliegue

| Archivo                               | Función                                                                   |
| ------------------------------------- | ------------------------------------------------------------------------- |
| `render.yaml`                         | Blueprint reproducible, tamaños, región, conexiones y secretos generados. |
| `deploy/render/Dockerfile.web`        | Construye la PWA y la sirve con Nginx 1.30.5.                             |
| `deploy/render/nginx.conf.template`   | Publica la web, cabeceras de seguridad y `/api` a la red privada.         |
| `deploy/render/security-headers.conf` | CSP/PWA, cámara y cabeceras HTTP defensivas.                              |
| `deploy/render/start-nginx.sh`        | Valida el destino privado y re-resuelve la API cada 10 s (recarga Nginx). |
| `deploy/render/Dockerfile.api`        | Construye y ejecuta exclusivamente la API.                                |
| `deploy/render/with-cloud-env.mjs`    | Forma `DATABASE_URL` con TLS y UTC sin revelar credenciales.              |
| `tests/cloud-deploy.test.ts`          | Comprueba las reglas de aislamiento y configuración anteriores.           |

## Variables y secretos

El repositorio no contiene valores secretos.

- `JWT_SECRET` se crea con `generateValue: true`. Render genera 256 bits una
  sola vez y conserva el valor en futuras sincronizaciones del Blueprint.
- `RENDER_DATABASE_URL` llega desde `fromDatabase.connectionString`. El
  lanzador la convierte dentro del proceso a `DATABASE_URL`, añade
  `sslmode=require` y `options=-c TimeZone=UTC`, elimina la variable intermedia
  del entorno del proceso hijo y nunca imprime la URL.
- `WEB_ORIGIN` se copia de `RENDER_EXTERNAL_URL` de la web. Así el primer piloto
  usa automáticamente su dirección `https://…onrender.com` real.
- `ANTHROPIC_API_KEY` no está declarada. La lectura con IA permanece apagada
  hasta que el negocio decida activarla como secreto separado.
- Swagger queda apagado en producción.

Cuando se apruebe un dominio propio, cambiar en `render.yaml` la entrada de
`WEB_ORIGIN` de la API por el origen exacto, sin barra final:

```yaml
- key: WEB_ORIGIN
  value: https://pos.dominio-elegido.com
```

Ese cambio y el dominio se deben aplicar juntos. La PWA instalada desde la URL
provisional se reinstala desde el dominio definitivo.

## DNS privado y cabeceras del cliente

Render inyecta `API_UPSTREAM` mediante `fromService.hostport`. Nginx usa un
upstream con zona compartida, la opción `resolve` y el servidor DNS que el
contenedor recibió en `/etc/resolv.conf`; vuelve a resolver el nombre cada diez
segundos. Esto evita conservar una IP antigua cuando Render reemplaza la API.

El Nginx cloud no usa como fuente de identidad ninguna cabecera de IP que pueda
mandar el cliente. El mapa toma únicamente `$remote_addr` y reemplaza
`X-Real-IP` y `X-Forwarded-For` con ese valor; la API confía en el salto Nginx
(`trust proxy = 1`). La documentación publicada por Render recomienda leer
`X-Forwarded-For` para obtener la IP real y señala que `CF-Ray` se reenvía, pero
no especifica que Render sobrescriba siempre `CF-Connecting-IP` o elimine las
partes falsificables de `X-Forwarded-For`. Por eso no usamos esas cabeceras para
autorización ni límites de seguridad hasta que Render confirme formalmente una
frontera de confianza. Como consecuencia, `$remote_addr` puede ser la IP del
proxy inmediato y no la del cliente; no se presenta como identificación
individual fiable. La regresión envía `CF-Ray`, `CF-Connecting-IP` y
`X-Forwarded-For` falsificados a la vez y comprueba que ninguno se reenvía. La
prueba dinámica con Nginx/Render queda pendiente si no se dispone del binario o
del entorno aislado. El Compose local sigue usando `deploy/nginx.conf`.

Fuente: [Render, How Render handles DDoS attacks](https://render.com/articles/how-render-handles-ddos-attacks)
(consulta del 8-oct-2026). Esa guía recomienda `X-Forwarded-For`, pero no
declara que el borde lo sobrescriba siempre ante valores enviados por el
cliente.

El snippet de seguridad instala CSP, HSTS, `X-Frame-Options: DENY`,
`X-Content-Type-Options: nosniff` y `Referrer-Policy`. La CSP permite módulos
locales, workers `blob:` usados por la PWA, peticiones al mismo origen y
ingesta de Sentry; la política de permisos conserva cámara sólo en el mismo
origen para el lector. La cámara requiere HTTPS (o localhost). Pruebas de
cabeceras en un Nginx ejecutándose y recorrido visual/offline de la cámara
siguen pendientes porque Docker no está disponible en el equipo de revisión.

## Salud y preparación

- Render consulta `GET /healthz` en la web. Devuelve `204` aunque PostgreSQL
  esté temporalmente caído, por lo que una avería de datos no reinicia una web
  sana.
- Render sólo realiza comprobación TCP nativa al servicio privado.
- `GET /api/health/live` confirma que el proceso de la API vive.
- `GET /api/health` y `GET /api/health/ready` consultan PostgreSQL y devuelven
  `503` si la base no está disponible.
- Después de cada publicación, la comprobación funcional obligatoria es
  `https://URL-DE-LA-WEB/api/health`. Recorre web, DNS privado, API y base.

El `HEALTHCHECK` de cada imagen también sirve para pruebas con Docker, pero no
sustituye las reglas anteriores de Render.

## Migraciones

Antes de poner en servicio una nueva API, Render ejecuta:

```text
node deploy/render/with-cloud-env.mjs node apps/api/node_modules/prisma/build/index.js migrate deploy --schema apps/api/prisma/schema.prisma
```

Si la migración falla, el despliegue se detiene. No se ejecuta `prisma db push`
ni el seed de demostración. Las migraciones nuevas deben seguir el patrón
“ampliar y luego retirar”:

1. Añadir tablas, columnas o índices de forma compatible.
2. Publicar una API que entienda la estructura vieja y la nueva.
3. Publicar la web y comprobar una venta controlada.
4. Retirar estructuras antiguas sólo en una liberación posterior y después de
   un respaldo verificable.

Volver al contenedor anterior no revierte una migración de datos.

### Contraseñas temporales de cajero

La migración `202610130001_password_change_required` agrega una marca por
usuario. La pantalla de entrada la activa cuando la API detecta esa marca; el
servidor no emite sesión normal hasta completar el cambio. La clave nueva debe
tener 12–72 bytes UTF-8 (límite de bcrypt), mayúscula, minúscula, número y
símbolo. Las cuentas temporales ya existentes se marcan mediante una tarea
puntual, después de desplegar API/migración. Configura sólo los nombres reales
que correspondan en variables temporales de la tarea, sin agregar nombres ni
contraseñas al repositorio:

```text
PASSWORD_CHANGE_CONFIRM=ROTATE_TEMPORARY_PASSWORDS
PASSWORD_CHANGE_USERNAMES=<lista de nombres separados por coma>
node deploy/render/with-cloud-env.mjs node apps/api/node_modules/tsx/dist/cli.mjs apps/api/scripts/require-password-change.ts
```

El comando valida que todas las cuentas indicadas existan y estén activas antes
de modificar ninguna, invalida sesiones y tokens previos y registra una acción
de auditoría. Ejecutarlo sólo como proceso puntual dentro del servicio API
correcto; no usarlo en una copia de producción desde una laptop. Los nuevos
usuarios creados por la pantalla de administración y los cambios de contraseña
hechos por un administrador quedan marcados para que la persona cambie la clave
en su primer acceso.

## Validación local sin desplegar

Desde la raíz del proyecto:

```text
pnpm cloud:validate
pnpm typecheck
pnpm build
```

Si Docker está disponible, construir ambas imágenes sin iniciarlas:

```text
docker build -f deploy/render/Dockerfile.api -t nexora-api:verify .
docker build -f deploy/render/Dockerfile.web -t nexora-web:verify .
```

Cuando el código esté en un repositorio privado conectado a Render, validar el
Blueprint antes de sincronizarlo:

```text
render blueprints validate render.yaml
```

La validación del CLI no compra ni crea recursos. La sincronización del
Blueprint sí los crea y sólo debe hacerse después de aprobar el gasto.

## Secuencia del primer piloto

1. Subir esta carpeta a un repositorio Git privado de la empresa.
2. Confirmar en el panel de Render el precio vigente de los dos planes
   `0.5c-512mb`, PostgreSQL `0.1c-256mb` y 1 GB. No aceptar el Blueprint si el
   total supera el presupuesto aprobado.
3. Validar `render.yaml` y revisar que PostgreSQL muestre cero reglas de entrada
   pública.
4. Crear los recursos desde el Blueprint. No cargar todavía datos reales.
5. Esperar que termine la migración previa de la API.
6. Abrir `/healthz`, luego `/api/health`; ambos deben responder correctamente.
7. Crear el administrador mediante una tarea puntual de la imagen de la API.
   Configurar temporalmente `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `ADMIN_PIN`,
   `ADMIN_NAME` y `ADMIN_MODE=bootstrap`, y ejecutar exactamente:

   ```text
   node deploy/render/with-cloud-env.mjs node apps/api/node_modules/tsx/dist/cli.mjs apps/api/scripts/create-admin.ts
   ```

   `bootstrap` es el modo de primera instalación; `repair` queda reservado para
   reparar una cuenta administradora ya existente. Retirar inmediatamente las
   cinco variables temporales cuando el comando confirme la verificación.

8. Cargar sólo los datos autorizados y ejecutar las pruebas del piloto descritas
   en el plan maestro externo `../../outputs/cloud/PLAN-NEXORA-CLOUD.md` de esta
   entrega.

## Publicaciones posteriores

1. Confirmar un respaldo recuperable.
2. Publicar primero la API; su `preDeployCommand` aplica la migración.
3. Verificar `/api/health` y una transacción controlada.
4. Publicar la web.
5. Verificar inicio de sesión, venta, SSE, impresión y cola offline.
6. Observar errores antes de declarar finalizada la liberación.

Los disparadores automáticos permanecen apagados para conservar este orden.

## Respaldo y recuperación de Render

`render.yaml` configura PostgreSQL pagado `0.1c-256mb`, pero no permite inferir
el plan del workspace Render. El panel de facturación verificó el plan Hobby
para este workspace el 8 de octubre de 2026: Render publica
PITR continuo con ventana de 3 días en Hobby y 7 días en Pro o superior; los
exports lógicos iniciados desde el Dashboard se conservan 7 días. PITR y los
exports lógicos no están disponibles para bases Free. Fuente y fecha de
consulta: [documentación oficial de Render](https://render.com/docs/postgresql-backups),
consultada el 8 de octubre de 2026. Esta ventana depende del workspace, no del
tamaño `0.1c-256mb` del servicio.

**Procedimiento recomendado de recuperación Render (sin sobrescribir la base
fuente):**

1. En el Dashboard de la base, abrir Recovery → Point-in-Time Recovery → Restore
   Database. Render crea una instancia nueva; elegir un nombre distinto y la
   hora de recuperación. No apuntar la aplicación a ella todavía.
2. Comprobar que la instancia recuperada está disponible. Conectar un cliente
   autorizado de forma temporal y verificar salud, migraciones, conteos de datos
   y una operación de lectura. No ejecutar una restauración destructiva sobre
   la base original.
3. Si se usa un export lógico `.dir.tar.gz`, descargarlo y extraerlo en un
   equipo controlado. Crear una base vacía aislada, y usar PostgreSQL 17:

   ```text
   pg_restore --format=directory --no-owner --no-privileges --exit-on-error --dbname=<URL_DE_BASE_NUEVA_VACIA> <directorio_extraido>
   ```

   El procedimiento de Render documenta este formato y recomienda no restaurar
   sobre un esquema con datos importantes. La contraseña/URL se proporciona
   mediante el gestor de secretos del cliente, nunca en el historial o como
   argumento literal.

4. Sólo después de validar la instancia recuperada, cambiar `RENDER_DATABASE_URL`
   en el servicio API al connection string de esa nueva base, revisar el
   despliegue y validar `/api/health` y operaciones de lectura/escritura
   controladas. Mantener la instancia anterior intacta hasta completar la
   verificación y decisión del negocio.

No se ejecutó PITR ni una restauración lógica en Render: todavía no se ha
confirmado la cuenta/plan del workspace y no se debe ensayar sobre datos reales.
La fault-injection local del instalador no sustituye la prueba de restauración
cloud. Un ensayo real requiere una base descartable y Docker/`pg_restore`, que
no están disponibles en este equipo durante esta revisión.

## Trabajo que sigue pendiente

Esta preparación no incluye ni autoriza:

- compra, cuenta, repositorio, dominio o despliegue;
- importación del inventario real;
- activar y programar el pipeline privado de Render a S3 y de S3 a la laptop.
  Diseño, fragmento de cron no activo, cliente local y límites: [Respaldo cloud
  de Render](./RESPALDO_CLOUD_RENDER.md);
- monitor externo y alertas operativas;
- ensayo de restauración con base descartable en Render;
- pruebas reales con dos laptops, celular, impresora, lector y cortes de red;
- aceptación del riesgo de una sola instancia.

Tampoco se añadió `ANTHROPIC_API_KEY` ni se cambió el instalador Windows.

## Referencias de plataforma verificadas

- Blueprint: <https://render.com/docs/blueprint-spec>
- Red privada: <https://render.com/docs/private-network>
- Servicios privados: <https://render.com/docs/private-services>
- Variables predeterminadas: <https://render.com/docs/environment-variables>
- Health checks: <https://render.com/docs/health-checks>
- Despliegues y pre-deploy: <https://render.com/docs/deploys>
- PostgreSQL y acceso: <https://render.com/docs/postgresql-creating-connecting>
- Nginx `resolve`: <https://nginx.org/en/docs/http/ngx_http_upstream_module.html>
