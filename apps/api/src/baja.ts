// Baja de cliente: exportar, bloquear y suprimir los datos de UNA sucursal
// (branchId). Lo usa sólo el comando de administración scripts/baja-cliente.ts;
// no hay endpoint. Procedimiento: docs/operacion/BAJA_DE_CLIENTE.md.
//
// Alcance de una sucursal = toda tabla con columna "branchId" igual al indicado
// + las tablas hijas sin esa columna (HIJAS, por su padre) + GLOBALES, que no
// se tocan. Una tabla nueva sin clasificar hace fallar las tres operaciones:
// así nadie suprime a medias tras agregar un modelo.
import { createHash } from "node:crypto";
import { createWriteStream } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { Prisma } from "@prisma/client";
import {
  MIN_PASSPHRASE,
  TIME_ZONE,
  createDecryptStream,
  createEncryptStream,
} from "./drive-backup-core";
import { weakSecretReason } from "./secret-strength";

type Sql = Prisma.Sql;

/** Tablas compartidas por todas las sucursales o constancias: no se exportan ni se borran. */
export const GLOBALES = [
  "_prisma_migrations",
  "BranchTermination", // la constancia de la propia baja
  "Role",
  "Brand",
  "ExpenseCategory",
  "AlertRule",
  // Claves «login:<correo>»: la purga de retention.ts las borra a los 2/30 días.
  "AuthAttempt",
] as const;

const enSucursal = (tabla: string, b: string, col = "id") =>
  Prisma.sql`(SELECT ${Prisma.raw(`"${col}"`)} FROM ${Prisma.raw(`"${tabla}"`)} WHERE "branchId" = ${b})`;

/** Tablas sin "branchId": pertenecen a la sucursal por su fila padre. */
export const HIJAS: Record<string, (b: string) => Sql> = {
  RefreshToken: (b) => Prisma.sql`"userId" IN ${enSucursal("User", b)}`,
  AuthSession: (b) => Prisma.sql`"userId" IN ${enSucursal("User", b)}`,
  KitComponent: (b) =>
    Prisma.sql`"kitVariantId" IN ${enSucursal("Variant", b)}`,
  LotIdentityConflict: (b) =>
    Prisma.sql`"variantId" IN ${enSucursal("Variant", b)}`,
  VariantStock: (b) => Prisma.sql`"variantId" IN ${enSucursal("Variant", b)}`,
  LotStock: (b) => Prisma.sql`"lotId" IN ${enSucursal("Lot", b)}`,
  StockTransferLine: (b) =>
    Prisma.sql`"transferId" IN ${enSucursal("StockTransfer", b)}`,
  CourierPayoutItem: (b) =>
    Prisma.sql`"payoutId" IN ${enSucursal("CourierPayout", b, "operationId")}`,
  SaleItem: (b) => Prisma.sql`"saleId" IN ${enSucursal("Sale", b)}`,
  Payment: (b) => Prisma.sql`"saleId" IN ${enSucursal("Sale", b)}`,
  CreditNote: (b) => Prisma.sql`"returnId" IN ${enSucursal("SaleReturn", b)}`,
  PurchaseItem: (b) =>
    Prisma.sql`"orderId" IN ${enSucursal("PurchaseOrder", b)}`,
  CashMovement: (b) =>
    Prisma.sql`"sessionId" IN ${enSucursal("CashSession", b)}`,
  GvProof: (b) =>
    Prisma.sql`("paymentId" IN ${enSucursal("GvPayment", b)} OR "cashSessionId" IN ${enSucursal("GvCashSession", b)})`,
  Settings: (b) => Prisma.sql`id = ${b}`,
  // Contadores por sucursal (sales.ts, gv-money.ts); «purchase» es global.
  Counter: (b) =>
    Prisma.sql`key = ANY(${["sale:" + b, "return:" + b, "gvrecibo:" + b]}::text[])`,
};

const NOMBRE = /^[A-Za-z_][A-Za-z0-9_]*$/;
const ident = (t: string) => {
  if (!NOMBRE.test(t)) throw new Error(`Nombre de tabla inválido: ${t}`);
  return Prisma.raw(`"${t}"`);
};

export type Alcance = { tabla: string; donde: Sql }[];

/**
 * Sucursales que el comando nunca toca. «main» es el negocio de la dueña y
 * está fijo en el código; BAJA_SUCURSALES_PROTEGIDAS (lista con comas) solo
 * AGREGA otras, no puede quitar ninguna.
 */
export const PROTEGIDAS_FIJAS = ["main"] as const;
export function protegidas(env = process.env.BAJA_SUCURSALES_PROTEGIDAS) {
  const extra = (env ?? "")
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);
  return [...new Set([...PROTEGIDAS_FIJAS, ...extra])];
}
export function noProtegida(branchId: string) {
  if (protegidas().includes(branchId))
    throw new Error(
      `La sucursal «${branchId}» está protegida: la baja no la toca.`,
    );
}

/**
 * Columnas con credenciales que NO salen en el paquete: el cliente recibe sus
 * datos de negocio, no contraseñas, PIN ni secretos (sí se suprimen).
 */
export const SENSIBLES: Record<string, string[]> = {
  User: ["passwordHash", "pinHash"],
  RefreshToken: ["hash"],
  Terminal: ["secretHash"],
  DriveBackup: ["refreshTokenEnc"],
};

/** Plazo mínimo fijo entre terminar y suprimir (decisión de la dueña, 9-nov). */
export const DIAS_MINIMOS = 30;

/** Tablas de la sucursal en orden de borrado (hijas antes que padres). */
export async function alcance(db: any, branchId: string): Promise<Alcance> {
  if (!branchId || branchId.length > 100)
    throw new Error("Indica la sucursal (branchId).");
  noProtegida(branchId);
  const tablas: { t: string; b: boolean }[] = await db.$queryRaw`
    SELECT t.table_name AS t,
           EXISTS (SELECT 1 FROM information_schema.columns c
                    WHERE c.table_schema = 'public' AND c.table_name = t.table_name
                      AND c.column_name = 'branchId') AS b
      FROM information_schema.tables t
     WHERE t.table_schema = 'public' AND t.table_type = 'BASE TABLE'`;
  const lista: Alcance = [];
  const sinClasificar: string[] = [];
  for (const { t, b } of tablas) {
    if ((GLOBALES as readonly string[]).includes(t)) continue;
    if (HIJAS[t]) lista.push({ tabla: t, donde: HIJAS[t](branchId) });
    else if (b)
      lista.push({ tabla: t, donde: Prisma.sql`"branchId" = ${branchId}` });
    else sinClasificar.push(t);
  }
  if (sinClasificar.length)
    throw new Error(
      `Tablas sin clasificar en baja.ts (agrégalas a HIJAS o GLOBALES): ${sinClasificar.sort().join(", ")}`,
    );
  // Orden topológico por las llaves foráneas: una tabla se borra después de
  // todas las que la referencian.
  const fks = await llaves(db);
  const nombres = new Set(lista.map((x) => x.tabla));
  const pendientes = new Map(lista.map((x) => [x.tabla, x]));
  const orden: Alcance = [];
  while (pendientes.size) {
    const libre = [...pendientes.keys()]
      .sort()
      .find(
        (t) =>
          !fks.some(
            (f) =>
              f.padre === t &&
              f.hija !== t &&
              nombres.has(f.hija) &&
              pendientes.has(f.hija),
          ),
      );
    if (!libre) throw new Error("Ciclo de llaves foráneas: revisar baja.ts.");
    orden.push(pendientes.get(libre)!);
    pendientes.delete(libre);
  }
  return orden;
}

type Llave = { hija: string; col: string; padre: string; pcol: string };
async function llaves(db: any): Promise<Llave[]> {
  const rows: (Llave & { n: number })[] = await db.$queryRaw`
    SELECT ch.relname AS hija, a.attname AS col, pa.relname AS padre,
           af.attname AS pcol, array_length(c.conkey, 1) AS n
      FROM pg_constraint c
      JOIN pg_class ch ON ch.oid = c.conrelid
      JOIN pg_class pa ON pa.oid = c.confrelid
      JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = c.conkey[1]
      JOIN pg_attribute af ON af.attrelid = c.confrelid AND af.attnum = c.confkey[1]
     WHERE c.contype = 'f' AND c.connamespace = 'public'::regnamespace`;
  if (rows.some((r) => Number(r.n) !== 1))
    throw new Error("Hay llaves foráneas compuestas: revisar baja.ts.");
  return rows;
}

/** Filas por tabla de la sucursal. */
export async function conteos(db: any, branchId: string) {
  const out: Record<string, number> = {};
  for (const { tabla, donde } of await alcance(db, branchId)) {
    const [{ n }] =
      await db.$queryRaw`SELECT count(*)::int AS n FROM ${ident(tabla)} WHERE ${donde}`;
    out[tabla] = Number(n);
  }
  return out;
}

const sha256 = (data: Buffer | string) =>
  createHash("sha256").update(data).digest("hex");

/** Hoy en la zona de la tienda, AAAA-MM-DD. */
export const hoy = (now = new Date()) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: TIME_ZONE }).format(now);

async function existe(db: any, branchId: string) {
  noProtegida(branchId);
  const [{ n }] = await db.$queryRaw`
    SELECT (SELECT count(*) FROM "User" WHERE "branchId" = ${branchId})
         + (SELECT count(*) FROM "Settings" WHERE id = ${branchId})
         + (SELECT count(*) FROM "BranchTermination" WHERE "branchId" = ${branchId}) AS n`;
  if (Number(n) === 0)
    throw new Error(
      `No existe la sucursal «${branchId}» (ni usuarios ni configuración).`,
    );
}

export function validarClave(clave: string | undefined) {
  const c = (clave ?? "").trim();
  if (c.length < MIN_PASSPHRASE)
    throw new Error(
      `BAJA_CLAVE debe tener ${MIN_PASSPHRASE} caracteres o más.`,
    );
  const debil = weakSecretReason(c);
  if (debil) throw new Error(`BAJA_CLAVE es demasiado simple: ${debil}.`);
  return c;
}

async function descifrar(archivo: string, clave: string) {
  const partes: Buffer[] = [];
  const flujo = Readable.from([await readFile(archivo)]).pipe(
    createDecryptStream(clave),
  );
  for await (const p of flujo) partes.push(p as Buffer);
  return Buffer.concat(partes);
}

/**
 * (1) Exporta la sucursal a `carpeta`: un <Tabla>.jsonl.enc por tabla (una fila
 * JSON por línea, cifrado NXBK) y un manifiesto.json en claro con filas y
 * SHA-256 del contenido y del archivo cifrado, sin datos personales. Sin las
 * columnas de SENSIBLES. Lectura en una sola instantánea (REPEATABLE READ).
 */
export async function exportar(
  db: any,
  branchId: string,
  carpeta: string,
  clave: string,
  now = new Date(),
) {
  const frase = validarClave(clave);
  await existe(db, branchId);
  await mkdir(carpeta, { recursive: true });
  const tablas = await db.$transaction(
    async (tx: any) => {
      const lista = await alcance(tx, branchId);
      const out = [];
      for (const { tabla, donde } of [...lista].sort((a, b) =>
        a.tabla.localeCompare(b.tabla),
      )) {
        const quitar = SENSIBLES[tabla] ?? [];
        // shortcut: la tabla entera en memoria; basta para una tienda (base de
        // 1 GB). Si un cliente crece, pasar a cursor por lotes.
        const rows: { j: string }[] = await tx.$queryRaw`
          SELECT (to_jsonb(t) - ${quitar}::text[])::text AS j
            FROM ${ident(tabla)} t WHERE ${donde} ORDER BY 1`;
        const plano = Buffer.from(rows.map((r) => r.j + "\n").join(""), "utf8");
        const archivo = `${tabla}.jsonl.enc`;
        await pipeline(
          Readable.from([plano]),
          await createEncryptStream(frase),
          createWriteStream(join(carpeta, archivo), { flags: "wx" }),
        );
        out.push({
          tabla,
          filas: rows.length,
          archivo,
          sha256Contenido: sha256(plano),
          sha256Cifrado: sha256(await readFile(join(carpeta, archivo))),
          columnasExcluidas: quitar,
        });
      }
      return out;
    },
    {
      isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead,
      timeout: 600_000,
      maxWait: 30_000,
    },
  );
  const manifiesto = {
    formato: "nexora-baja-exportacion-1",
    sucursal: branchId,
    exportadoEl: now.toISOString(),
    cifrado: "NXBK v1 (AES-256-GCM, clave scrypt de BAJA_CLAVE)",
    tablas,
    totalFilas: tablas.reduce((s: number, t: any) => s + t.filas, 0),
    tablasGlobalesNoIncluidas: [...GLOBALES],
  };
  const texto = JSON.stringify(manifiesto, null, 2) + "\n";
  await writeFile(join(carpeta, "manifiesto.json"), texto, { flag: "wx" });
  const paqueteSha256 = sha256(texto);
  await db.branchTermination.upsert({
    where: { branchId },
    create: { branchId, exportedAt: now, exportSha256: paqueteSha256 },
    update: { exportedAt: now, exportSha256: paqueteSha256 },
  });
  return { manifiesto, paqueteSha256 };
}

/**
 * (2) Marca la sucursal como terminada y bloquea el ingreso: usuarios
 * inactivos (con authVersion nueva, lo que invalida cada sesión abierta en la
 * siguiente petición), tokens y sesiones borrados, terminales revocadas.
 * Idempotente: repetirla conserva la fecha original.
 */
export async function terminar(db: any, branchId: string, now = new Date()) {
  await existe(db, branchId);
  return db.$transaction(async (tx: any) => {
    const previa = await tx.branchTermination.findUnique({
      where: { branchId },
    });
    if (previa?.suppressedAt) throw new Error("La sucursal ya fue suprimida.");
    const terminatedAt = previa?.terminatedAt ?? now;
    await tx.branchTermination.upsert({
      where: { branchId },
      create: { branchId, terminatedAt },
      update: { terminatedAt },
    });
    const usuarios = await tx.user.updateMany({
      where: { branchId, active: true },
      data: { active: false, authVersion: { increment: 1 } },
    });
    const ids = Prisma.sql`(SELECT id FROM "User" WHERE "branchId" = ${branchId})`;
    const tokens =
      await tx.$executeRaw`DELETE FROM "RefreshToken" WHERE "userId" IN ${ids}`;
    const sesiones =
      await tx.$executeRaw`DELETE FROM "AuthSession" WHERE "userId" IN ${ids}`;
    const terminales = await tx.terminal.updateMany({
      where: { branchId, revokedAt: null },
      data: { revokedAt: now },
    });
    return {
      terminadaEl: terminatedAt.toISOString(),
      usuariosBloqueados: usuarios.count,
      tokensBorrados: Number(tokens),
      sesionesCerradas: Number(sesiones),
      terminalesRevocadas: terminales.count,
    };
  });
}

export const frase = (branchId: string) => `SUPRIMIR ${branchId}`;

/**
 * Abre el paquete y lo compara con lo guardado al exportar: SHA-256 del
 * manifiesto, de cada archivo cifrado y de su contenido, y filas por archivo.
 * Devuelve las filas por tabla del manifiesto.
 */
export async function verificarPaquete(
  carpeta: string,
  clave: string,
  branchId: string,
  exportSha256: string | null,
) {
  let texto: string;
  try {
    texto = await readFile(join(carpeta, "manifiesto.json"), "utf8");
  } catch {
    throw new Error(
      "No se encontró manifiesto.json en la carpeta del paquete.",
    );
  }
  if (sha256(texto) !== exportSha256)
    throw new Error(
      "El manifiesto no es el de la última exportación registrada.",
    );
  const m = JSON.parse(texto);
  if (m.sucursal !== branchId)
    throw new Error("El paquete es de otra sucursal.");
  const filas: Record<string, number> = {};
  for (const t of m.tablas) {
    const ruta = join(carpeta, String(t.archivo));
    let cifrado: Buffer;
    try {
      cifrado = await readFile(ruta);
    } catch {
      throw new Error(`Falta ${t.archivo} en el paquete.`);
    }
    if (sha256(cifrado) !== t.sha256Cifrado)
      throw new Error(`${t.archivo} fue modificado (SHA-256 distinto).`);
    let plano: Buffer;
    try {
      plano = await descifrar(ruta, clave);
    } catch {
      throw new Error(
        `${t.archivo} no se puede abrir: clave incorrecta o archivo dañado.`,
      );
    }
    const lineas = plano.toString("utf8").split("\n").filter(Boolean).length;
    if (sha256(plano) !== t.sha256Contenido || lineas !== t.filas)
      throw new Error(`${t.archivo} no coincide con el manifiesto.`);
    filas[t.tabla] = t.filas;
  }
  return filas;
}

/**
 * (3) Suprime los datos de la sucursal. Exige: terminada hace DIAS_MINIMOS
 * días o más (diasMinimos solo puede subir el piso), exportada después de
 * terminar, el paquete presente y abierto con su clave, `confirmacion` =
 * «SUPRIMIR <branchId>» y `fecha` = hoy (zona de la tienda), ambas escritas
 * por una persona (scripts/baja-cliente.ts). Todo en una transacción; si las
 * filas actuales o las borradas no son exactamente las del paquete, o una
 * llave cruza a otra sucursal, no se borra nada. El acta (sin datos
 * personales) queda en BranchTermination.
 */
export async function suprimir(
  db: any,
  branchId: string,
  opciones: {
    confirmacion: string;
    fecha: string;
    carpeta: string;
    clave: string;
    diasMinimos?: number;
    now?: Date;
  },
) {
  const now = opciones.now ?? new Date();
  noProtegida(branchId);
  if (opciones.confirmacion !== frase(branchId))
    throw new Error(`Confirma escribiendo exactamente «${frase(branchId)}».`);
  if (opciones.fecha !== hoy(now))
    throw new Error(`La fecha de confirmación debe ser hoy (${hoy(now)}).`);
  const pedido = Number(opciones.diasMinimos ?? DIAS_MINIMOS);
  const minimo = Math.max(
    DIAS_MINIMOS,
    Number.isFinite(pedido) ? pedido : DIAS_MINIMOS,
  );
  const estado = await db.branchTermination.findUnique({
    where: { branchId },
  });
  if (estado?.suppressedAt) {
    // Nunca se vuelve a borrar: un branchId reutilizado pasa otra vez por
    // terminar y exportar con otra constancia.
    const restantes = await conteos(db, branchId);
    const total = Object.values(restantes).reduce((s, n) => s + n, 0);
    if (total > 0)
      throw new Error(
        `La sucursal ya fue suprimida el ${estado.suppressedAt.toISOString()} y tiene ${total} filas nuevas. No se borró nada: revisar a mano.`,
      );
    return {
      yaSuprimida: true,
      borradas: restantes,
      actaTexto: estado.actaTexto as string,
    };
  }
  if (!estado?.terminatedAt)
    throw new Error("Primero hay que terminar la sucursal (comando terminar).");
  if (!estado.exportedAt || estado.exportedAt < estado.terminatedAt)
    throw new Error(
      "Falta una exportación hecha después de terminar (comando exportar).",
    );
  const dias = (now.getTime() - estado.terminatedAt.getTime()) / 86_400_000;
  if (dias < minimo)
    throw new Error(
      `Faltan días: terminada hace ${Math.floor(dias)}; el mínimo es ${minimo}.`,
    );
  const esperadas = await verificarPaquete(
    opciones.carpeta,
    opciones.clave,
    branchId,
    estado.exportSha256,
  );
  return db.$transaction(
    async (tx: any) => {
      const lista = await alcance(tx, branchId);
      const actuales: Record<string, number> = {};
      for (const { tabla, donde } of lista) {
        const [{ n }] =
          await tx.$queryRaw`SELECT count(*)::int AS n FROM ${ident(tabla)} WHERE ${donde}`;
        actuales[tabla] = Number(n);
      }
      const distintas = (a: Record<string, number>) =>
        [...new Set([...Object.keys(a), ...Object.keys(esperadas)])]
          .filter((t) => (a[t] ?? 0) !== (esperadas[t] ?? 0))
          .map((t) => `${t}: ${a[t] ?? 0} ≠ ${esperadas[t] ?? 0}`);
      const cambios = distintas(actuales);
      if (cambios.length)
        throw new Error(
          `Los datos cambiaron después de exportar (${cambios.join("; ")}). No se borró nada: exportar de nuevo.`,
        );
      await sinReferenciasAjenas(tx, lista);
      const borradas: Record<string, number> = {};
      for (const { tabla, donde } of lista)
        borradas[tabla] = Number(
          await tx.$executeRaw`DELETE FROM ${ident(tabla)} WHERE ${donde}`,
        );
      // Una fila que entró entre el conteo y el borrado no está en el paquete.
      const tarde = distintas(borradas);
      if (tarde.length)
        throw new Error(
          `Entraron filas durante la supresión (${tarde.join("; ")}). No se borró nada: exportar de nuevo.`,
        );
      const acta = {
        formato: "nexora-acta-supresion-1",
        sucursal: branchId,
        terminadaEl: estado.terminatedAt.toISOString(),
        exportadaEl: estado.exportedAt.toISOString(),
        paqueteSha256: estado.exportSha256,
        suprimidaEl: now.toISOString(),
        filasBorradas: borradas,
        totalFilasBorradas: Object.values(borradas).reduce((s, n) => s + n, 0),
        tablasGlobalesConservadas: [...GLOBALES],
      };
      const actaTexto = JSON.stringify(acta, null, 2) + "\n";
      await tx.branchTermination.update({
        where: { branchId },
        data: { suppressedAt: now, actaSha256: sha256(actaTexto), actaTexto },
      });
      return { yaSuprimida: false, borradas, acta, actaTexto };
    },
    { timeout: 600_000, maxWait: 30_000 },
  );
}

/**
 * Antes de borrar: ninguna llave foránea puede cruzar el borde de la sucursal.
 * (a) una fila FUERA apunta a una DENTRO: el borrado la arrastraría por
 * CASCADE o fallaría; (b) una fila DENTRO apunta a una fila de otra sucursal:
 * mezcla de datos. Corta con el detalle para revisarlo a mano.
 */
async function sinReferenciasAjenas(tx: any, lista: Alcance) {
  const por = new Map(lista.map((x) => [x.tabla, x.donde]));
  for (const f of await llaves(tx)) {
    const dondePadre = por.get(f.padre);
    if (!dondePadre) continue;
    const dondeHija = por.get(f.hija);
    const padres = Prisma.sql`(SELECT ${ident(f.pcol)} FROM ${ident(f.padre)} WHERE ${dondePadre})`;
    const [{ n }] = await tx.$queryRaw`
      SELECT count(*)::int AS n FROM ${ident(f.hija)}
       WHERE ${ident(f.col)} IN ${padres}
         AND ${dondeHija ? Prisma.sql`NOT (${dondeHija})` : Prisma.sql`TRUE`}`;
    const [{ m }] = dondeHija
      ? await tx.$queryRaw`
      SELECT count(*)::int AS m FROM ${ident(f.hija)}
       WHERE ${dondeHija} AND ${ident(f.col)} IS NOT NULL
         AND ${ident(f.col)} NOT IN ${padres}`
      : [{ m: 0 }];
    if (Number(n) + Number(m) > 0)
      throw new Error(
        `${f.hija}.${f.col} → ${f.padre}: ${n} fila(s) de fuera apuntan a la sucursal y ${m} de la sucursal apuntan fuera. No se borró nada.`,
      );
  }
}
