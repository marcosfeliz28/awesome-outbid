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

| Archivo                             | Función                                                                   |
| ----------------------------------- | ------------------------------------------------------------------------- |
| `render.yaml`                       | Blueprint reproducible, tamaños, región, conexiones y secretos generados. |
| `deploy/render/Dockerfile.web`      | Construye la PWA y la sirve con Nginx 1.30.5.                             |
| `deploy/render/nginx.conf.template` | Publica la web, `/healthz` y reenvía `/api` a la red privada.             |
| `deploy/render/start-nginx.sh`      | Valida el destino privado y toma el DNS efectivo de `/etc/resolv.conf`.   |
| `deploy/render/Dockerfile.api`      | Construye y ejecuta exclusivamente la API.                                |
| `deploy/render/with-cloud-env.mjs`  | Forma `DATABASE_URL` con TLS y UTC sin revelar credenciales.              |
| `tests/cloud-deploy.test.ts`        | Comprueba las reglas de aislamiento y configuración anteriores.           |

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

El servicio público recibe `CF-Connecting-IP` de la capa de Render y lo copia a
un único `X-Forwarded-For`, reemplazando cualquier cadena aportada por el
cliente. La API ya confía exactamente en un salto (`trust proxy = 1`): Nginx.
En el Compose local se sigue usando `deploy/nginx.conf`; esta configuración
cloud no altera el instalador ni el funcionamiento local.

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

## Trabajo que sigue pendiente

Esta preparación no incluye ni autoriza:

- compra, cuenta, repositorio, dominio o despliegue;
- importación del inventario real;
- bucket S3 y cron nocturno para el respaldo externo;
- monitor externo y alertas operativas;
- ensayo de restauración;
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
