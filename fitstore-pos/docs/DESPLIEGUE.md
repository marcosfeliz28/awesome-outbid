# Ejecución y despliegue

## Instalación local

Usa los comandos del README. PostgreSQL embebido está destinado a desarrollo y pruebas; escucha en 127.0.0.1:5434 y conserva datos en `.local-db/`. Una base central de producción necesita PostgreSQL administrado o un servidor con volumen persistente y copias externas.

La compilación se verificó con Node 24. El backend compilado importa el paquete TypeScript compartido mediante el soporte de Node 24. No uses versiones anteriores sin compilar ese paquete por separado.

## Docker Compose

Se incluyen Dockerfile con etapas `api` y `web`, Compose para PostgreSQL/API/Nginx, y configuración de proxy de mismo origen. Estos archivos no se han ejecutado en este entorno: el acceso al socket de Docker fue rechazado por el aislamiento.

Define `POSTGRES_PASSWORD`, `JWT_SECRET` y `WEB_ORIGIN` en variables o un `.env` privado. La URL publicada debe usar HTTPS. `WEB_ORIGIN` debe coincidir exactamente con ese origen. La contraseña PostgreSQL debe codificarse para su uso en una URL si contiene caracteres reservados.

```bash
docker compose build
docker compose up -d database
docker compose run --rm api node node_modules/prisma/build/index.js migrate deploy
docker compose up -d api web
```

La configuración publica Nginx en el puerto 8080 para colocarlo detrás de un proxy HTTPS. La cookie de renovación de producción requiere HTTPS. No ejecutes el seed de demostración con `NODE_ENV=production`.

En entornos con proxy y CA propia, proporciona la CA de confianza al build como secreto `proxy_ca`. El Dockerfile mantiene la verificación TLS.

## Crear el primer administrador real

No existe alta pública de usuarios. Usa `pnpm admin:create` desde un entorno con `DATABASE_URL` para crear el primer administrador de una base vacía, con contraseña y PIN propios. El script lee las credenciales de variables y no las imprime. Después crea el resto del equipo en Configuración.

## PWA

La compilación precarga la aplicación y las ilustraciones locales. El catálogo y la cola de ventas se guardan en IndexedDB. Las respuestas autenticadas de la API no se incluyen en el service worker. El caché del catálogo offline elimina costos, incluidos los de los lotes.

El modo offline tras recargar requiere que el service worker haya sido instalado con anterioridad. Comprueba que la versión precargada es la última antes de usarla en caja. No se fuerza una actualización durante una venta.

## Aplicaciones móviles y escritorio

La PWA se puede instalar en PC y celular desde un navegador compatible. Se entregan configuraciones base de Capacitor y Tauri. No hay APK, AAB, IPA, EXE ni DMG construidos o firmados en esta entrega.

Para Capacitor, instala Android Studio/Xcode y configura una URL HTTPS de la misma app publicada, manteniendo el mismo origen de API y las cookies:

```bash
pnpm build
FITSTORE_WEB_URL=https://tu-dominio.example pnpm --filter @fitstore/web exec cap add android
FITSTORE_WEB_URL=https://tu-dominio.example pnpm --filter @fitstore/web exec cap sync android
pnpm --filter @fitstore/web exec cap open android
```

Para iOS, sustituye `android` por `ios` y usa macOS/Xcode. Las cuentas de desarrollador y firmas son externas. Sin `FITSTORE_WEB_URL`, la configuración sólo prepara los archivos web locales; debe resolverse el origen de la API antes de usar ese paquete.

Tauri incluye Cargo, configuración y ventana. Requiere Rust y dependencias nativas del sistema. La integración del servidor publicado y el acceso a impresoras nativas todavía requieren validación. Para una instalación utilizable ahora en escritorio, usa la PWA del navegador.

## Impresión, cámara y archivos

Ticket 58/80 mm y etiquetas usan el diálogo del navegador. Ajusta el ancho y los márgenes en el controlador de tu impresora. La impresión silenciosa USB/Bluetooth no está integrada. El PDF A4 no requiere impresora.

La cámara requiere HTTPS o localhost y permiso del usuario. Las fotografías y comprobantes actuales son URLs; la carga privada a S3/R2 todavía no está implementada y requiere configurar almacenamiento real.

## Respaldos

```bash
pnpm backup
```

Requiere `pg_dump` de versión igual o posterior al servidor; se puede indicar `PG_DUMP_BIN`. Escribe un archivo de formato custom en `backups/` y retiene 30 días. Programa el comando diariamente con cron/scheduler del proveedor y copia el resultado a un almacenamiento separado. La programación y la copia externa no están activadas automáticamente.

Restauración: detén el tráfico, restaura en una base nueva con `pg_restore`, verifica saldos/ventas y cambia `DATABASE_URL`. Prueba una restauración periódicamente. La restauración destructiva nunca se ejecuta automáticamente.

## Antes de operar con datos reales

Confirma política de devoluciones, impuestos por producto, obligaciones NCF/e-CF, datos del negocio, costos, stock inicial y permisos. Cambia las credenciales de demostración. Verifica impresora y lector con hardware real. Mide rendimiento con el volumen esperado; no se ha certificado el objetivo de 50,000 variantes/1,000,000 de líneas ni disponibilidad de 99.5%.

## Acceso a la API (revisión 2)

El puerto 3001 de la API debe permanecer interno: no lo publiques en el host ni lo abras en el firewall. Compose sólo expone 3001 entre contenedores; el único puerto publicado es 8080 de Nginx. Todo acceso HTTP a la API debe pasar por Nginx y el origen HTTPS configurado. No añadas `ports: 3001:3001` al servicio api.

Nginx sustituye X-Forwarded-For por la IP de su conexión. La API confía en un salto de proxy; permitir acceso directo invalidaría esa frontera de confianza. En desarrollo, enlaza los servicios a localhost. Antes de actualizar, respalda la base y aplica las migraciones, incluida `202610040005_round2`. Las notas existentes reciben un código único; vuelve a imprimirlas desde Ventas si se necesita ese código.

**Actualización a la ronda 6** (`202610060001_round6_audit`). Respalda la base antes de actualizar. La migración se puede volver a ejecutar sin duplicar datos y hace dos cosas:

- Deja **pendientes** los equipos registrados antes de la ronda 4. Ten un gerente disponible en la tienda el día de la actualización para aprobarlos con su PIN; los vendedores no podrán cobrar hasta entonces.
- Recupera el proveedor y el total de las compras anteriores. Usa la bitácora de cada operación de Mercancía y las líneas guardadas en cada recepción de orden. Revisa la columna **Sin conciliar** del reporte de compras.

## Eventos y recepción móvil (ronda 3)

Aplica las migraciones `202610040006_round3` y `202610040007_commit_events` antes de levantar la API. Los triggers diferidos guardan eventos dentro de la transacción, en orden de confirmación; una operación revertida no publica stock. Cada instancia de API consulta la tabla de eventos de su sucursal cada 100 ms mientras tiene un cliente SSE conectado. Esto funciona con varias instancias de API sobre la misma base central. Al reconectar se refresca el catálogo completo, sin depender de reproducción histórica.

Nginx incluye una ubicación exacta `/api/events` con HTTP/1.1, buffering y caché desactivados y timeout de 75 segundos. No publiques API 3001. Comprueba que cualquier proxy HTTPS/CDN adicional tampoco acumule los eventos. Los heartbeats son cada 15 segundos. Se considera conectado un equipo con actividad en los últimos 45 segundos; su revocación cierra la autorización de las peticiones siguientes y el stream al comprobar su sesión.

Opcionalmente configura `ANTHROPIC_API_KEY` y `ANTHROPIC_MODEL` como secretos/variables del servidor. Compose las pasa al contenedor API. Sin clave, sólo hay importación Excel/CSV. El modelo por defecto es `claude-opus-5-5`, llamado con el SDK oficial `@anthropic-ai/sdk`, salida estructurada (`output_config.format`) y respaldo automático del servidor (`fallbacks: "default"`) si la solicitud es rechazada. Si cambias `ANTHROPIC_MODEL`, usa un modelo vigente que admita salida estructurada. Las pruebas usan mocks, no consumen la API de Anthropic. Las fotos y PDF se envían a ese proveedor sólo cuando el operador solicita extracción; cada lectura cuesta unos pocos centavos de dólar según el tamaño de la factura.

Los comprobantes se guardan como bytes en PostgreSQL, hasta 5 MB por archivo, y sus rutas de descarga requieren permisos y sucursal. Inclúyelos en la capacidad de almacenamiento y en los respaldos. La tabla de eventos no es el kardex ni la auditoría: puedes programar una limpieza de eventos de más de siete días (`DELETE FROM "RealtimeEvent" WHERE "createdAt" < now() - interval '7 days'`). Esa limpieza no está programada automáticamente. No borres operaciones idempotentes ni auditoría como parte de esa tarea.

## Equipos, integraciones y tiempo real (ronda 4)

Las rutas que mueven inventario o dinero exigen un equipo aprobado: ventas y sincronización, anulación, devoluciones, abonos y su verificación, caja (abrir, movimientos, traslado, cierre), ajustes, recepciones de órdenes, aplicación de conteos y Mercancía. Sin equipo responden `403` con `code: "TERMINAL_REQUIRED"`; con un equipo pendiente, `code: "TERMINAL_PENDING"`.

Una integración que no sea navegador (script, otra aplicación) sigue el mismo proceso: genera un UUID y un secreto aleatorio de al menos 16 caracteres, guárdalos de forma privada y llama `POST /api/terminals/register` con `{ id, name, secret }` después de iniciar sesión con un usuario propio. Si el usuario no es gerente, un gerente debe aprobar ese equipo en Configuración › Equipos. Revocarlo corta sus sesiones. Los equipos registrados antes de la ronda 4 quedan aprobados y fijan su secreto en el siguiente registro.

El servidor consulta los eventos una sola vez cada 150 ms para todas las conexiones y admite como máximo 2 conexiones de tiempo real por sesión y 6 por usuario (`429` si se superan; la app reintenta). Para usar la app desde celulares, publícala con HTTPS: la cámara, la instalación de la PWA y el trabajo sin conexión lo exigen.
