# Restaurar la base de Nexora POS (Render)

Procedimiento para recuperar `nexora-pos-db` (PostgreSQL 17, Render,
Virginia). Responde al hallazgo B1 de la auditoría de infraestructura.

**Regla:** nunca se restaura encima de la base que está en uso. Siempre se
restaura en una base **nueva**, se comprueba y sólo después se cambia la API
para que la use. La base vieja se conserva intacta hasta que el negocio decida.

## Qué existe y qué no (10-oct-2026)

| Recurso                                      | Estado                                                              |
| -------------------------------------------- | ------------------------------------------------------------------- |
| PITR de Render (volver a un minuto concreto) | Activo. Ventana de **3 días** en el workspace Hobby; 7 días en Pro. |
| Export lógico desde el panel (`.dir.tar.gz`) | Disponible; Render lo guarda 7 días. **Hay que descargarlo**.       |
| Copia fuera de Render (cron a S3, laptop)    | **No existe todavía.** Ver la tarea semanal de abajo.               |
| Ensayo en Render                             | **No hecho.** Es la primera acción pendiente de la dueña.           |
| Ensayo local con PostgreSQL 17.11            | Hecho el 10-oct-2026 (resultados al final).                         |

## Tarea semanal mientras no haya copia automática (dueña o técnico)

1. Render › `nexora-pos-db` › **Recovery** › **Export** (crear export lógico).
2. Al terminar, **descargar** el `.dir.tar.gz`.
3. Anotar su huella (en PowerShell: `Get-FileHash .\archivo.dir.tar.gz -Algorithm SHA256`;
   en Linux/macOS: `sha256sum archivo.dir.tar.gz > archivo.dir.tar.gz.sha256`).
4. Guardar el archivo y su huella en dos lugares: la laptop y una USB u
   OneDrive. Contiene datos de clientes: guardarlo como dato confidencial.

Así, aunque pasen más de 3 días o la cuenta de Render tenga un problema,
siempre hay una copia de la última semana.

## Herramientas (técnico)

- PostgreSQL **17** cliente (`pg_restore`, `psql`) en la laptop. Con otra
  versión mayor `pg_restore` puede negarse o fallar.
- Node 24 y el repositorio (para `scripts/restore.mjs` y `prisma migrate status`).
- Las URL de conexión se pegan en variables de entorno de la terminal, nunca en
  el historial de órdenes ni en archivos del repositorio.

La base de Render no acepta conexiones desde Internet (`ipAllowList: []`). Para
restaurar desde la laptop hay que permitir **temporalmente** la IP del técnico
en la base **nueva** (Render › base nueva › _Access Control_ / _Networking_) y
quitarla al terminar. No abrir la base en uso.

## Camino 1: PITR de Render (errores de los últimos 3 días)

Para «se anuló o se borró algo por error» o «una migración dañó datos», si se
descubre dentro de la ventana.

1. Anotar la hora (UTC) **anterior** al problema. RD = UTC − 4.
2. Render › `nexora-pos-db` › **Recovery** › _Point-in-Time Recovery_ ›
   _Restore Database_. Elegir la hora y un nombre nuevo, por ejemplo
   `nexora-pos-db-restaurada-AAAAMMDD`. Render crea una **base nueva** (mismo
   plan) con otra URL. Anotar cuánto tarda (RTO).
3. Comprobar la base nueva (ver «Comprobaciones», abajo).
4. Cambiar la API a la base nueva: «Cambiar la API de base», abajo.

## Camino 2: desde un export de Render (`.dir.tar.gz`) o un `.dump` propio

Para cuando ya pasaron los 3 días, la base se borró o se recupera en otra
cuenta o en la laptop de reserva (modo isla).

1. **Comprobar la huella antes de nada:**

   ```text
   sha256sum -c archivo.dir.tar.gz.sha256      # export de Render
   sha256sum -c nexora-fitstore-....dump.sha256  # respaldo propio
   ```

   Si no dice `OK`, **no restaurar** ese archivo: buscar otra copia.

2. Crear una base nueva y vacía: en Render, _New › PostgreSQL_ (versión 17,
   región Virginia, plan `0.5c-1g` o superior, disco ≥ 5 GB); o en la laptop,
   `createdb`.
3. Restaurar **todo o nada** (si algo falla no queda una base a medias):
   - Export de Render, ya extraído con `tar -xzf archivo.dir.tar.gz`:

     ```text
     pg_restore --format=directory --single-transaction --exit-on-error --no-owner --no-privileges --dbname="$URL_BASE_NUEVA" <directorio_extraido>
     ```

   - Respaldo propio `.dump` (comprueba la huella y el tamaño por su cuenta y
     aplica las mismas opciones):

     ```text
     RESTORE_DATABASE_URL="$URL_BASE_NUEVA" node scripts/restore.mjs nexora-fitstore-....dump
     ```

4. Comprobar (abajo) y, si es en Render, cambiar la API de base.

## Comprobaciones (obligatorias antes de usar la base)

1. Esquema al día:

   ```text
   cd apps/api
   DATABASE_URL="$URL_BASE_NUEVA" node node_modules/prisma/build/index.js migrate status --schema prisma/schema.prisma
   ```

   Debe decir `Database schema is up to date!`.

2. Conteos y dinero, en la base vieja (si existe) y en la nueva:

   ```sql
   SELECT (SELECT count(*) FROM "Sale")              AS ventas,
          (SELECT sum(total) FROM "Sale")            AS total_vendido,
          (SELECT count(*) FROM "InventoryMovement") AS movimientos,
          (SELECT count(*) FROM "CashSession")       AS cajas,
          (SELECT max("createdAt") FROM "Sale")      AS ultima_venta;
   ```

   Con PITR, `ultima_venta` debe ser anterior a la hora elegida. Con un
   export, igual a la del día del export.

3. Índices que pueden faltar sin aviso (ver
   [MIGRACIONES_SEGURAS.md](MIGRACIONES_SEGURAS.md)).

## Cambiar la API de base (Render)

1. Render › base nueva › _Info_ › copiar la **Internal Database URL**.
2. Render › `nexora-pos-api` › _Environment_ › editar `RENDER_DATABASE_URL`
   con esa URL › _Save, rebuild and deploy_ (fuera de horario si se puede).
3. Al terminar: `https://nexora-pos-web.onrender.com/api/health` debe dar
   `{"database":"ok"}` (o Actions › «Comprobación posterior al despliegue»).
   Probar inicio de sesión, una venta pequeña y su anulación.
4. **Blueprint:** `render.yaml` toma la URL de la base llamada
   `nexora-pos-db`. Antes de volver a sincronizar el Blueprint, dejar escrito
   en el repositorio qué base es la buena (o renombrar las bases en Render
   para que la buena se llame `nexora-pos-db`), o la sincronización podría
   volver a apuntar a la vieja. (No verificado en Render.)
5. Conservar la base vieja apagada o intacta unos días y borrarla sólo cuando
   la dueña lo apruebe. Cada base cuesta dinero mientras exista.

## Ensayo pendiente en Render (dueña o técnico, 30–60 min, fuera de horario)

1. PITR de `nexora-pos-db` a «hace 1 hora» hacia una base de prueba.
2. Anotar el tiempo hasta que la base está disponible (RTO).
3. Comprobaciones de arriba contra la base de prueba (permitiendo
   temporalmente la IP del técnico **sólo en la base de prueba**).
4. **No** cambiar la API. Borrar la base de prueba al terminar.
5. Anotar fecha, RTO, conteos y quién lo hizo al final de este documento.

## Ensayo local del 10-oct-2026 (PostgreSQL 17.11, sin Render)

Hecho en Docker con `postgres:17.11` y cliente `pg_dump`/`pg_restore` 17.11,
sobre la base de demostración (`db:seed`: 846 ventas). No se tocó producción.

| Paso                                                         | Resultado                                                                                   | Tiempo |
| ------------------------------------------------------------ | ------------------------------------------------------------------------------------------- | ------ |
| `scripts/backup.mjs`                                         | `.dump` de 437 KB con `.sha256` y `.json`; `sha256sum -c` OK                                | 0,7 s  |
| `scripts/restore.mjs` en base nueva                          | Huella verificada, restauración completa                                                    | 0,5 s  |
| Comparación                                                  | 49 tablas con conteos idénticos; 846 ventas y RD$ 2 415 400,00 en ambas                     | < 1 s  |
| Negativa: `.dump` cortado a la mitad                         | Rechazado antes de restaurar («Tamaño distinto al del manifiesto»); base destino sin tablas | < 1 s  |
| Export tipo Render (`pg_dump --format=directory` + `tar.gz`) | Huella OK; `pg_restore --format=directory --single-transaction …`                           | 0,5 s  |
| Comparación del export                                       | 49 tablas con conteos idénticos                                                             | < 1 s  |
| `prisma migrate status` en ambas restauradas                 | `Database schema is up to date!`                                                            | —      |
| API (imagen de Render) contra cada base restaurada           | `/api/health` 200 `{"database":"ok"}`; inicio de sesión 201                                 | < 10 s |

Limitaciones: el export «tipo Render» se generó con `pg_dump` en formato
directorio; el archivo real del panel no se probó. Con datos reales de meses
los tiempos serán mayores. La prueba anterior con PostgreSQL 16
(9-oct-2026) está en [PRUEBA_RESTAURACION.md](PRUEBA_RESTAURACION.md).

## Registro de ensayos en Render

| Fecha | Quién | Tipo (PITR / export) | RTO | Conteos coinciden | Notas |
| ----- | ----- | -------------------- | --- | ----------------- | ----- |
|       |       |                      |     |                   |       |
