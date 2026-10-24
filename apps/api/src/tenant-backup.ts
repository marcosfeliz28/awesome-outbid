// Respaldo lógico cifrado de UNA empresa. No reutiliza pg_dump, que incluye
// todas las empresas. El formato NXTB/2 es una secuencia JSONL dentro del
// cifrado NXBK/1 existente (AES-256-GCM con scrypt y marca de fin).
import { execFile } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { createReadStream, createWriteStream } from "node:fs";
import { chmod, link, open, stat, unlink } from "node:fs/promises";
import { dirname, join } from "node:path";
import { Writable } from "node:stream";
import { StringDecoder } from "node:string_decoder";
import { pipeline } from "node:stream/promises";
import { promisify } from "node:util";
import { Prisma, PrismaClient } from "@prisma/client";
import { createDecryptStream, createEncryptStream, MIN_PASSPHRASE } from "./drive-backup-core";
import { weakSecretReason } from "./secret-strength";
import { objectReferenceForRow, readPortableObject, recordObjectReference, verifiedPortableBytes, type ObjectReference, type PortableObject } from "./tenant-object-portability";
import { tenantObjectStore } from "./tenant-object-store";

type Tx = Prisma.TransactionClient;
type Inventory = { table: string; columns: string[]; pk: string[]; dependsOn: string[] }[];
type BackupMeta = { kind: "meta"; format: "NXTB/2"; tenantId: string; schemaHash: string; tables: string[] };
type BackupRow = { kind: "row"; table: string; value: string };
type BackupObject = { kind: "object"; value: PortableObject };
type BackupEnd = { kind: "end"; counts: Record<string, number>; objectCount: number };

const quote = (name: string) => `"${name.replaceAll('"', '""')}"`;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_LINE = 32 * 1024 * 1024;
const execFileAsync = promisify(execFile);

// En Windows, mode=0600 no protege la DACL. Una ACL no verificable cancela el
// respaldo antes de escribir contenido y antes de publicar el nombre final.
const WINDOWS_PRIVATE_ACL = String.raw`
$ErrorActionPreference='Stop'
$path=$env:NEXORA_BACKUP_ACL_TARGET
$owner=[Security.Principal.WindowsIdentity]::GetCurrent().User
$allowed=@(@($owner.Value,'S-1-5-18','S-1-5-32-544') | Sort-Object -Unique)
$acl=[Security.AccessControl.FileSecurity]::new()
$acl.SetAccessRuleProtection($true,$false)
foreach($sid in $allowed) {
  $identity=[Security.Principal.SecurityIdentifier]::new($sid)
  $acl.AddAccessRule([Security.AccessControl.FileSystemAccessRule]::new(
    $identity,[Security.AccessControl.FileSystemRights]::FullControl,
    [Security.AccessControl.AccessControlType]::Allow))
}
[IO.File]::SetAccessControl($path,$acl)
$actual=[IO.File]::GetAccessControl($path)
$rules=@($actual.GetAccessRules($true,$true,[Security.Principal.SecurityIdentifier]))
if (-not $actual.AreAccessRulesProtected -or $rules.Count -ne $allowed.Count -or
    @($rules | Where-Object {
      $_.IdentityReference.Value -notin $allowed -or
      $_.AccessControlType -ne [Security.AccessControl.AccessControlType]::Allow -or
      ($_.FileSystemRights -band [Security.AccessControl.FileSystemRights]::FullControl) -ne
        [Security.AccessControl.FileSystemRights]::FullControl
    }).Count -gt 0) { throw 'No se puede garantizar una ACL privada.' }
`;

async function protectPrivateBackupFile(path: string) {
  if (process.platform === "win32") {
    try {
      await execFileAsync("powershell.exe", ["-NoProfile", "-NonInteractive", "-EncodedCommand",
        Buffer.from(WINDOWS_PRIVATE_ACL, "utf16le").toString("base64")], {
        env: { ...process.env, NEXORA_BACKUP_ACL_TARGET: path }, timeout: 15000,
      });
    } catch {
      throw new Error("No se pudo proteger el archivo de respaldo con una ACL privada en Windows.");
    }
  } else {
    await chmod(path, 0o600);
    if ((await stat(path)).mode & 0o077)
      throw new Error("No se pudo proteger el archivo de respaldo.");
  }
}

/** Enlace duro dentro del mismo directorio: publicación atómica y exclusiva.
 * Si el sistema de archivos no lo soporta, se cancela sin archivo final parcial. */
export async function publishPrivateBackup(temp: string, target: string) {
  await protectPrivateBackupFile(temp);
  // Windows exige un descriptor con permiso de escritura para FlushFileBuffers.
  const handle = await open(temp, "r+");
  try { await handle.sync(); }
  finally { await handle.close(); }
  await link(temp, target);
}

function checkPassphrase(passphrase: string) {
  if (passphrase.length < MIN_PASSPHRASE || weakSecretReason(passphrase))
    throw new Error("La frase de respaldo debe ser fuerte y tener al menos 32 caracteres.");
}

/** La base real y el cliente generado deben coincidir; una tabla nueva sin
 * tenantId bloquea el respaldo en vez de filtrarse por error. */
async function inventory(tx: Tx): Promise<Inventory> {
  const actual = await tx.$queryRawUnsafe<{ tablename: string }[]>(
    `SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename`,
  );
  const models = Prisma.dmmf.datamodel.models;
  const names = new Set(models.map(model => model.dbName ?? model.name));
  const tableNames = actual.map(row => row.tablename).filter(name => name !== "_prisma_migrations");
  if (tableNames.length !== names.size || tableNames.some(name => !names.has(name)))
    throw new Error("El inventario de tablas no coincide con Prisma; respaldo cancelado.");
  const columns = await tx.$queryRawUnsafe<{ table_name: string; column_name: string; ordinal_position: number }[]>(
    `SELECT table_name, column_name, ordinal_position FROM information_schema.columns WHERE table_schema = 'public' ORDER BY table_name, ordinal_position`,
  );
  const primary = await tx.$queryRawUnsafe<{ table_name: string; column_name: string; position: number }[]>(
    `SELECT c.relname AS table_name, a.attname AS column_name, k.ord::int AS position
       FROM pg_constraint x JOIN pg_class c ON c.oid=x.conrelid
       JOIN unnest(x.conkey) WITH ORDINALITY k(attnum, ord) ON TRUE
       JOIN pg_attribute a ON a.attrelid=c.oid AND a.attnum=k.attnum
      WHERE x.contype='p' AND c.relnamespace='public'::regnamespace
      ORDER BY c.relname, k.ord`,
  );
  const foreign = await tx.$queryRawUnsafe<{ table_name: string; parent_name: string }[]>(
    `SELECT child.relname AS table_name, parent.relname AS parent_name
       FROM pg_constraint x JOIN pg_class child ON child.oid=x.conrelid
       JOIN pg_class parent ON parent.oid=x.confrelid
      WHERE x.contype='f' AND child.relnamespace='public'::regnamespace
        AND parent.relnamespace='public'::regnamespace`,
  );
  const result = models.map(model => {
    const table = model.dbName ?? model.name;
    const expected = model.fields.filter(field => field.kind === "scalar" || field.kind === "enum").map(field => field.dbName ?? field.name);
    const present = columns.filter(row => row.table_name === table).map(row => row.column_name);
    if (expected.length !== present.length || expected.some(name => !present.includes(name)))
      throw new Error(`Columnas desconocidas en ${table}; respaldo cancelado.`);
    if (table !== "Tenant" && !present.includes("tenantId"))
      throw new Error(`La tabla ${table} no tiene tenantId; respaldo cancelado.`);
    const pk = primary.filter(row => row.table_name === table).map(row => row.column_name);
    if (!pk.length) throw new Error(`La tabla ${table} no tiene clave primaria.`);
    return { table, columns: present, pk, dependsOn: [...new Set(foreign.filter(row => row.table_name === table && row.parent_name !== table).map(row => row.parent_name))].sort() };
  });
  const ordered: Inventory = [];
  const pending = [...result];
  while (pending.length) {
    const index = pending.findIndex(row => row.dependsOn.every(name => ordered.some(parent => parent.table === name)));
    if (index < 0) throw new Error("Dependencias cíclicas o externas entre tablas; respaldo cancelado.");
    ordered.push(pending.splice(index, 1)[0]!);
  }
  if (ordered[0]?.table !== "Tenant") throw new Error("Tenant debe ser la primera tabla.");
  return ordered;
}

function schemaHash(tables: Inventory) {
  return createHash("sha256").update(JSON.stringify(tables)).digest("hex");
}

async function write(stream: NodeJS.WritableStream, line: unknown) {
  const bytes = Buffer.from(JSON.stringify(line) + "\n");
  if (!stream.write(bytes)) await new Promise<void>((resolve, reject) => {
    stream.once("drain", resolve); stream.once("error", reject);
  });
}

export async function createTenantBackup(args: {
  prisma: PrismaClient; tenantId: string; target: string; passphrase: string;
}) {
  if (!UUID.test(args.tenantId)) throw new Error("tenantId inválido.");
  checkPassphrase(args.passphrase);
  const temp = join(dirname(args.target), `.tenant-backup-${randomUUID()}.partial`);
  const encrypted = await createEncryptStream(args.passphrase);
  let writing: Promise<void> | undefined;
  try {
    const handle = await open(temp, "wx", 0o600);
    try { await protectPrivateBackupFile(temp); }
    finally { await handle.close(); }
    const file = createWriteStream(temp, { flags: "w" });
    writing = pipeline(encrypted, file);
    const counts = await args.prisma.$transaction(async tx => {
      await tx.$executeRawUnsafe("SET TRANSACTION READ ONLY");
      await tx.$queryRaw`SELECT set_config('app.tenant_id', ${args.tenantId}, true)`;
      const tables = await inventory(tx);
      const tenant = await tx.$queryRawUnsafe<{ id: string }[]>(`SELECT id FROM "Tenant" WHERE id=$1::uuid`, args.tenantId);
      if (tenant.length !== 1) throw new Error("Empresa no encontrada.");
      await write(encrypted, { kind: "meta", format: "NXTB/2", tenantId: args.tenantId, schemaHash: schemaHash(tables), tables: tables.map(row => row.table) } satisfies BackupMeta);
      const counts: Record<string, number> = {};
      const objects = new Map<string, ObjectReference>();
      for (const { table, pk } of tables) {
        counts[table] = 0;
        const where = table === "Tenant" ? `id=$1::uuid` : `"tenantId"=$1::uuid`;
        const order = pk.map(quote).join(", ");
        for (let offset = 0;; offset += 250) {
          const rows = await tx.$queryRawUnsafe<{ value: string }[]>(
            `SELECT row_to_json(t)::text AS value FROM ${quote(table)} t WHERE ${where} ORDER BY ${order} LIMIT 250 OFFSET ${offset}`,
            args.tenantId,
          );
          if (!rows.length) break;
          for (const row of rows) {
            recordObjectReference(objects, objectReferenceForRow(table, JSON.parse(row.value) as Record<string, unknown>));
            await write(encrypted, { kind: "row", table, value: row.value } satisfies BackupRow);
            counts[table]!++;
          }
        }
      }
      const objectStore = objects.size ? tenantObjectStore() : null;
      for (const ref of objects.values())
        await write(encrypted, { kind: "object", value: await readPortableObject(args.tenantId, ref, objectStore!) } satisfies BackupObject);
      await write(encrypted, { kind: "end", counts, objectCount: objects.size } satisfies BackupEnd);
      return counts;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead, timeout: 600_000 });
    encrypted.end();
    await writing;
    await publishPrivateBackup(temp, args.target);
    return counts;
  } catch (error) {
    encrypted.destroy();
    await writing?.catch(() => undefined);
    throw error;
  } finally {
    await unlink(temp).catch(() => undefined);
  }
}

/** Nunca restaurar sobre una base compartida: doble autorización explícita,
 * nombre de base de prueba, y cero empresas/filas antes de empezar. */
export async function restoreTenantBackup(args: {
  prisma: PrismaClient; source: string; passphrase: string; disposableConfirmation: "RESTORE_TO_DISPOSABLE_TEST_DATABASE";
}) {
  if (args.disposableConfirmation !== "RESTORE_TO_DISPOSABLE_TEST_DATABASE")
    throw new Error("Falta confirmar la base desechable.");
  if (process.env.NODE_ENV === "production")
    throw new Error("No se restaura desde un proceso de producción.");
  if ((await stat(args.source)).size > 2 * 1024 ** 3) throw new Error("Archivo demasiado grande.");
  const createdObjects: string[] = [];
  let restoreTenantId: string | undefined;
  let restoreObjectStore: ReturnType<typeof tenantObjectStore> | undefined;
  try { return await args.prisma.$transaction(async tx => {
    const [{ database, host }] = await tx.$queryRawUnsafe<{ database: string; host: string | null }[]>(
      `SELECT current_database() AS database, inet_server_addr()::text AS host`,
    );
    if (!/(?:^|_)(?:test|scratch|disposable)(?:_|$)/i.test(database) ||
      (host !== "127.0.0.1/32" && host !== "::1/128" && host !== "127.0.0.1" && host !== "::1"))
      throw new Error("Restauración permitida sólo en base local desechable de pruebas.");
    const tables = await inventory(tx);
    for (const { table } of tables) {
      // count(*) bajo RLS puede informar cero aunque haya filas de otra
      // empresa. La restauración exige visibilidad global antes de comprobar
      // que la base desechable está físicamente vacía.
      const [{ active }] = await tx.$queryRawUnsafe<{ active: boolean }[]>(
        `SELECT row_security_active($1::regclass) AS active`, `public.${quote(table)}`,
      );
      if (active) throw new Error("La conexión de restauración necesita visibilidad global; RLS está activa.");
      const [{ count }] = await tx.$queryRawUnsafe<{ count: bigint }[]>(`SELECT count(*) AS count FROM ${quote(table)}`);
      if (count !== 0n) throw new Error("La base de prueba debe estar vacía.");
    }
    // Los triggers de aplicación crean almacenes/stock/eventos al insertar
    // variantes. Desactivarlos SÓLO en esta transacción desechable preserva
    // exactamente el volcado; los triggers FK internos siguen activos.
    const triggers = await tx.$queryRawUnsafe<{ table_name: string; trigger_name: string }[]>(
      `SELECT c.relname AS table_name, t.tgname AS trigger_name
         FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid
        WHERE c.relnamespace='public'::regnamespace AND NOT t.tgisinternal
        ORDER BY c.relname, t.tgname`,
    );
    for (const trigger of triggers)
      await tx.$executeRawUnsafe(`ALTER TABLE ${quote(trigger.table_name)} DISABLE TRIGGER ${quote(trigger.trigger_name)}`);
    let meta: BackupMeta | undefined;
    let ended = false;
    let current = 0;
    let line = "";
    const decoder = new StringDecoder("utf8");
    const counts: Record<string, number> = Object.fromEntries(tables.map(row => [row.table, 0]));
    const referencedObjects = new Map<string, ObjectReference>();
    const restoredObjects = new Set<string>();
    const consume = async (content: string) => {
      if (content.length > MAX_LINE) throw new Error("Registro de respaldo demasiado largo.");
      const item = JSON.parse(content) as BackupMeta | BackupRow | BackupObject | BackupEnd;
      if (!meta) {
        if (item.kind !== "meta" || item.format !== "NXTB/2" || !UUID.test(item.tenantId) ||
          item.schemaHash !== schemaHash(tables) || JSON.stringify(item.tables) !== JSON.stringify(tables.map(row => row.table)))
          throw new Error("Esquema o empresa del respaldo no coinciden.");
        meta = item;
        restoreTenantId = item.tenantId;
        await tx.$queryRaw`SELECT set_config('app.tenant_id', ${item.tenantId}, true)`;
        return;
      }
      if (ended) throw new Error("Datos adicionales después del cierre.");
      if (item.kind === "end") {
        if (JSON.stringify(item.counts) !== JSON.stringify(counts) || counts.Tenant !== 1 ||
          item.objectCount !== referencedObjects.size || restoredObjects.size !== referencedObjects.size)
          throw new Error("Conteos del respaldo no coinciden.");
        ended = true;
        return;
      }
      if (item.kind === "object") {
        const object = (item as BackupObject).value;
        const ref = object && referencedObjects.get(object.key);
        if (!ref || restoredObjects.has(object.key)) throw new Error("Objeto inesperado o duplicado en respaldo.");
        const bytes = verifiedPortableBytes(object, ref);
        restoreObjectStore ??= tenantObjectStore();
        await restoreObjectStore.putNew(meta.tenantId, object.key, bytes, object.mime);
        createdObjects.push(object.key);
        restoredObjects.add(object.key);
        return;
      }
      if (item.kind !== "row" || typeof item.value !== "string") throw new Error("Registro inválido.");
      const index = tables.findIndex(row => row.table === item.table);
      if (index < current || index < 0) throw new Error("Orden de tablas inválido.");
      current = index;
      const value = JSON.parse(item.value) as Record<string, unknown>;
      if (!value || typeof value !== "object" ||
        (item.table === "Tenant" ? value.id : value.tenantId) !== meta.tenantId)
        throw new Error("Fila de otra empresa en respaldo.");
      recordObjectReference(referencedObjects, objectReferenceForRow(item.table, value));
      const table = tables[index]!;
      if (Object.keys(value).length !== table.columns.length || table.columns.some(column => !(column in value)))
        throw new Error("Columnas de fila no coinciden.");
      const names = table.columns.map(quote).join(",");
      await tx.$executeRawUnsafe(
        `INSERT INTO ${quote(table.table)} (${names}) SELECT ${names} FROM jsonb_populate_record(NULL::${quote(table.table)}, $1::jsonb)`,
        item.value,
      );
      counts[item.table]!++;
    };
    const decrypted = createDecryptStream(args.passphrase);
    await pipeline(createReadStream(args.source), decrypted, new Writable({
      async write(chunk: Buffer, _encoding, callback) {
        try {
          line += decoder.write(chunk);
          if (line.length > MAX_LINE) throw new Error("Registro de respaldo demasiado largo.");
          let end: number;
          while ((end = line.indexOf("\n")) !== -1) {
            await consume(line.slice(0, end));
            line = line.slice(end + 1);
          }
          callback();
        } catch (error) { callback(error as Error); }
      },
    }));
    if (line || decoder.end() || !ended) throw new Error("Respaldo incompleto.");
    for (const trigger of triggers)
      await tx.$executeRawUnsafe(`ALTER TABLE ${quote(trigger.table_name)} ENABLE TRIGGER ${quote(trigger.trigger_name)}`);
    // Los INSERT con IDs explícitos no avanzan las secuencias. Sin esto,
    // el próximo evento tras restaurar puede reutilizar una PK existente.
    // ALTER SEQUENCE RESTART es transaccional; un fallo posterior revierte el
    // ajuste junto con las filas, a diferencia de setval().
    const sequences = await tx.$queryRawUnsafe<{
      table_name: string; column_name: string; sequence_schema: string; sequence_name: string;
    }[]>(`SELECT tbl.relname AS table_name, att.attname AS column_name,
                ns.nspname AS sequence_schema, seq.relname AS sequence_name
           FROM pg_class seq
           JOIN pg_namespace ns ON ns.oid = seq.relnamespace
           JOIN pg_depend dep ON dep.objid = seq.oid AND dep.deptype IN ('a', 'i')
           JOIN pg_class tbl ON tbl.oid = dep.refobjid
           JOIN pg_attribute att ON att.attrelid = tbl.oid AND att.attnum = dep.refobjsubid
          WHERE seq.relkind = 'S' AND tbl.relnamespace = 'public'::regnamespace`);
    for (const sequence of sequences) {
      const table = tables.find(item => item.table === sequence.table_name);
      if (!table?.columns.includes(sequence.column_name))
        throw new Error("Secuencia fuera del inventario de respaldo.");
      const [{ next }] = await tx.$queryRawUnsafe<{ next: bigint }[]>(
        `SELECT COALESCE(MAX(${quote(sequence.column_name)}), 0)::bigint + 1 AS next FROM ${quote(table.table)}`,
      );
      await tx.$executeRawUnsafe(
        `ALTER SEQUENCE ${quote(sequence.sequence_schema)}.${quote(sequence.sequence_name)} RESTART WITH ${next.toString()}`,
      );
    }
    return { tenantId: meta!.tenantId, counts };
  }, { timeout: 600_000 });
  } catch (error) {
    if (restoreTenantId && createdObjects.length) {
      const cleanup = await Promise.allSettled(createdObjects.map(key => restoreObjectStore!.delete(restoreTenantId!, key)));
      if (cleanup.some(result => result.status === "rejected"))
        throw new Error("Falló la restauración y no se pudo limpiar el almacenamiento externo.", { cause: error });
    }
    throw error;
  }
}
