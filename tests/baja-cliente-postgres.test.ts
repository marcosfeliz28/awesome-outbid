import { execFile } from "node:child_process";
import { createServer } from "node:net";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { createRequire } from "node:module";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import EmbeddedPostgres from "embedded-postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Readable } from "node:stream";

// Baja de cliente (src/baja.ts): la exportación coincide con los conteos, el
// bloqueo, la supresión toca sólo la sucursal indicada y todo es idempotente.
// Contra PostgreSQL real: NEXORA_TEST_PG_URL o uno embebido.
const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const apiRequire = createRequire(join(root, "apps", "api", "package.json"));
const prismaCli = apiRequire.resolve("prisma/build/index.js");
const { PrismaClient } = apiRequire("@prisma/client");
const { Client } = createRequire(
  createRequire(import.meta.url).resolve("embedded-postgres"),
)("pg");
const run = promisify(execFile);

const freePort = () =>
  new Promise<number>((resolvePort, reject) => {
    const server = createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        server.close();
        reject(new Error("No se pudo reservar un puerto para PostgreSQL."));
        return;
      }
      server.close((error) =>
        error ? reject(error) : resolvePort(address.port),
      );
    });
  });

const DATABASE = "nexora_baja_cliente";
let adminUrl = "";
let stopServer: () => Promise<void> = async () => undefined;
let prisma: any;
let sql: any;

const urlFor = (db: string) => {
  const u = new URL(adminUrl);
  u.pathname = "/" + db;
  return u.toString();
};

beforeAll(async () => {
  const external = process.env.NEXORA_TEST_PG_URL;
  if (external) adminUrl = external;
  else {
    const dataDir = await mkdtemp(join(tmpdir(), "nexora-baja-db-"));
    const port = await freePort();
    const database = new EmbeddedPostgres({
      databaseDir: dataDir,
      user: "nexora_test",
      password: "nexora_test_only",
      port,
      persistent: false,
      authMethod: "scram-sha-256",
      initdbFlags: ["--encoding=UTF8", "--locale=C"],
      postgresFlags: ["-c", "listen_addresses=127.0.0.1", "-c", "timezone=UTC"],
      onLog: () => undefined,
      onError: () => undefined,
    });
    await database.initialise();
    await database.start();
    adminUrl = `postgresql://nexora_test:nexora_test_only@127.0.0.1:${port}/postgres`;
    stopServer = async () => {
      await database.stop().catch(() => undefined);
      await rm(dataDir, { recursive: true, force: true }).catch(
        () => undefined,
      );
    };
  }
  const admin = new Client({ connectionString: adminUrl });
  await admin.connect();
  await admin.query(`DROP DATABASE IF EXISTS "${DATABASE}" WITH (FORCE)`);
  await admin.query(`CREATE DATABASE "${DATABASE}"`);
  await admin.end();
  await run(
    process.execPath,
    [
      prismaCli,
      "migrate",
      "deploy",
      "--schema",
      join(root, "apps", "api", "prisma", "schema.prisma"),
    ],
    {
      cwd: root,
      env: {
        ...process.env,
        DATABASE_URL: urlFor(DATABASE),
        PRISMA_HIDE_UPDATE_MESSAGE: "1",
      },
      timeout: 120_000,
    },
  );
  prisma = new PrismaClient({
    datasources: { db: { url: urlFor(DATABASE) } },
  });
  sql = new Client({ connectionString: urlFor(DATABASE) });
  await sql.connect();
}, 240_000);

afterAll(async () => {
  await sql?.end().catch(() => undefined);
  await prisma?.$disconnect().catch(() => undefined);
  if (adminUrl) {
    const admin = new Client({ connectionString: adminUrl });
    await admin.connect().catch(() => undefined);
    await admin
      .query(`DROP DATABASE IF EXISTS "${DATABASE}" WITH (FORCE)`)
      .catch(() => undefined);
    await admin.end().catch(() => undefined);
  }
  await stopServer();
}, 60_000);

const CLAVE = "Baja-Prueba-9f3K2mQ7xR4tW8vZ1cL6nP0sD5hJ";
let role: any;

// Una sucursal con algo en cada familia de tablas (hijas incluidas).
async function sembrar(b: string) {
  role ??= await prisma.role.create({
    data: { name: "baja-prueba", permissions: ["*"] },
  });
  const user = await prisma.user.create({
    data: {
      name: "Cajera " + b,
      email: `cajera-${b}@prueba.local`,
      passwordHash: "x",
      pinHash: "x",
      roleId: role.id,
      branchId: b,
    },
  });
  await prisma.settings.create({ data: { id: b, data: { nombre: b } } });
  const category = await prisma.category.create({
    data: { name: "Cat " + b, branchId: b },
  });
  const product = await prisma.product.create({
    data: {
      name: "Prod " + b,
      sku: "P-" + b,
      categoryId: category.id,
      branchId: b,
    },
  });
  const variant = await prisma.variant.create({
    data: {
      productId: product.id,
      sku: "V-" + b,
      barcode: "B-" + b,
      costAvg: 10,
      price: 20,
      branchId: b,
    },
  });
  // Una migración ya crea los almacenes de cada sucursal al aparecer.
  const warehouse =
    (await prisma.warehouse.findFirst({
      where: { branchId: b, kind: "store" },
    })) ??
    (await prisma.warehouse.create({
      data: { name: "Tienda " + b, kind: "store", sellable: true, branchId: b },
    }));
  await prisma.variantStock.upsert({
    where: {
      variantId_warehouseId: {
        variantId: variant.id,
        warehouseId: warehouse.id,
      },
    },
    create: { variantId: variant.id, warehouseId: warehouse.id, qty: 5 },
    update: { qty: 5 },
  });
  const customer = await prisma.customer.create({
    data: { name: "Cliente " + b, branchId: b },
  });
  const cash = await prisma.cashSession.create({
    data: { userId: user.id, openingAmount: 0, branchId: b },
  });
  await prisma.cashMovement.create({
    data: {
      sessionId: cash.id,
      type: "in",
      amount: 1,
      reason: "x",
      userId: user.id,
    },
  });
  const sale = await prisma.sale.create({
    data: {
      number: "S-" + b,
      offlineUuid: crypto.randomUUID(),
      sellerId: user.id,
      customerId: customer.id,
      cashSessionId: cash.id,
      subtotal: 20,
      discountTotal: 0,
      taxTotal: 0,
      total: 20,
      costTotal: 10,
      branchId: b,
    },
  });
  await prisma.saleItem.create({
    data: {
      saleId: sale.id,
      variantId: variant.id,
      qty: 1,
      unitPrice: 20,
      unitCost: 10,
      discount: 0,
      tax: 0,
      lineTotal: 20,
    },
  });
  await prisma.payment.create({
    data: { saleId: sale.id, method: "cash", amount: 20, tendered: 20 },
  });
  await prisma.auditLog.create({
    data: {
      userId: user.id,
      action: "sale",
      entity: "sale",
      entityId: sale.id,
      branchId: b,
    },
  });
  await prisma.counter.create({ data: { key: "sale:" + b, value: 1 } });
  await prisma.refreshToken.create({
    data: {
      userId: user.id,
      hash: "h-" + b,
      expiresAt: new Date(Date.now() + 864e5),
    },
  });
  await prisma.authSession.create({ data: { userId: user.id } });
  await prisma.terminal.create({
    data: { id: crypto.randomUUID(), name: "Caja " + b, branchId: b },
  });
}

// Huella de TODAS las filas de las tablas de la base, para ver que otra
// sucursal (y las globales) quedan idénticas byte a byte.
async function huella(excluir: string[] = []) {
  const { rows } = await sql.query(
    `SELECT table_name AS t FROM information_schema.tables
      WHERE table_schema='public' AND table_type='BASE TABLE' ORDER BY 1`,
  );
  const out: Record<string, string> = {};
  for (const { t } of rows) {
    if (excluir.includes(t)) continue;
    const r = await sql.query(
      `SELECT md5(coalesce(string_agg(x, '|' ORDER BY x), '')) AS h, count(*)::int AS n
         FROM (SELECT row_to_json(q)::text AS x FROM "${t}" q) s`,
    );
    out[t] = `${r.rows[0].n}:${r.rows[0].h}`;
  }
  return out;
}

async function descifrar(archivo: string) {
  const { createDecryptStream } =
    await import("../apps/api/src/drive-backup-core");
  const partes: Buffer[] = [];
  const flujo = Readable.from([await readFile(archivo)]).pipe(
    createDecryptStream(CLAVE),
  );
  for await (const p of flujo) partes.push(p as Buffer);
  return Buffer.concat(partes).toString("utf8");
}

describe("baja de cliente", () => {
  it("clasifica todas las tablas de la base migrada (ninguna queda sin decidir)", async () => {
    const { alcance } = await import("../apps/api/src/baja");
    await sembrar("otra");
    const lista = await alcance(prisma, "otra");
    expect(lista.map((x) => x.tabla)).toContain("Sale");
    // Hijas antes que padres.
    const pos = (t: string) => lista.findIndex((x) => x.tabla === t);
    expect(pos("SaleItem")).toBeLessThan(pos("Sale"));
    expect(pos("Payment")).toBeLessThan(pos("Sale"));
    expect(pos("Sale")).toBeLessThan(pos("Customer"));
    expect(pos("VariantStock")).toBeLessThan(pos("Variant"));
  });

  it("exporta, termina y suprime sólo la sucursal indicada; idempotente", async () => {
    const baja = await import("../apps/api/src/baja");
    await sembrar("cliente-a");
    const antesOtra = await baja.conteos(prisma, "otra");
    const contA = await baja.conteos(prisma, "cliente-a");
    expect(contA.Sale).toBe(1);
    expect(contA.Payment).toBe(1);
    expect(contA.Settings).toBe(1);
    expect(contA.Counter).toBe(1);

    // (2) terminar: bloquea; repetir no cambia la fecha.
    const t0 = new Date("2026-01-10T12:00:00Z");
    const term = await baja.terminar(prisma, "cliente-a", t0);
    expect(term).toMatchObject({
      usuariosBloqueados: 1,
      tokensBorrados: 1,
      sesionesCerradas: 1,
      terminalesRevocadas: 1,
    });
    const again = await baja.terminar(
      prisma,
      "cliente-a",
      new Date("2026-01-11T12:00:00Z"),
    );
    expect(again.terminadaEl).toBe(t0.toISOString());
    expect(again.usuariosBloqueados).toBe(0);
    const u = await prisma.user.findFirst({ where: { branchId: "cliente-a" } });
    expect(u.active).toBe(false);
    expect(u.authVersion).toBe(1);
    expect(
      (await prisma.user.findFirst({ where: { branchId: "otra" } })).active,
    ).toBe(true);

    // Suprimir antes de exportar: no.
    const t1 = new Date("2026-03-01T15:00:00Z");
    const ok = {
      confirmacion: "SUPRIMIR cliente-a",
      fecha: baja.hoy(t1),
      diasMinimos: 30,
      now: t1,
    };
    await expect(baja.suprimir(prisma, "cliente-a", ok)).rejects.toThrow(
      /exportación/,
    );

    // (1) exportar: cada archivo descifrado tiene las filas del manifiesto,
    // que son las de la base.
    const conteoTrasTerminar = await baja.conteos(prisma, "cliente-a");
    const dir = await mkdtemp(join(tmpdir(), "nexora-baja-paquete-"));
    try {
      const { manifiesto } = await baja.exportar(
        prisma,
        "cliente-a",
        dir,
        CLAVE,
        new Date("2026-01-12T12:00:00Z"),
      );
      expect(
        Object.fromEntries(
          manifiesto.tablas.map((t: any) => [t.tabla, t.filas]),
        ),
      ).toEqual(conteoTrasTerminar);
      for (const t of manifiesto.tablas) {
        const texto = await descifrar(join(dir, t.archivo));
        const lineas = texto.split("\n").filter(Boolean);
        expect(lineas.length, t.tabla).toBe(t.filas);
        for (const l of lineas) expect(JSON.parse(l)).toBeTypeOf("object");
        const { createHash } = await import("node:crypto");
        expect(createHash("sha256").update(texto).digest("hex")).toBe(
          t.sha256Contenido,
        );
      }
      const ventas = (await descifrar(join(dir, "Sale.jsonl.enc"))).trim();
      expect(JSON.parse(ventas).number).toBe("S-cliente-a");
      // Nada de otra sucursal en el paquete ni datos en claro.
      for (const f of await readdir(dir)) {
        const bruto = await readFile(join(dir, f), "utf8");
        expect(bruto).not.toContain("S-otra");
        if (f !== "manifiesto.json") expect(bruto).not.toContain("cliente-a");
      }
      await expect(
        baja.exportar(prisma, "cliente-a", dir, "corta", new Date()),
      ).rejects.toThrow(/BAJA_CLAVE/);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }

    // Confirmaciones y plazo.
    await expect(
      baja.suprimir(prisma, "cliente-a", {
        ...ok,
        confirmacion: "SUPRIMIR otra",
      }),
    ).rejects.toThrow(/exactamente/);
    await expect(
      baja.suprimir(prisma, "cliente-a", { ...ok, fecha: "2026-02-28" }),
    ).rejects.toThrow(/hoy/);
    await expect(
      baja.suprimir(prisma, "cliente-a", { ...ok, diasMinimos: 60 }),
    ).rejects.toThrow(/Faltan días/);

    // (3) suprimir: la otra sucursal y las tablas globales quedan idénticas.
    const huellaOtra = async () => {
      const r: Record<string, number> = await baja.conteos(prisma, "otra");
      return r;
    };
    const globalesAntes = await huella(
      Object.keys(contA).concat("BranchTermination"),
    );
    const r = await baja.suprimir(prisma, "cliente-a", ok);
    expect(r.yaSuprimida).toBe(false);
    expect(r.borradas).toEqual(conteoTrasTerminar);
    expect(
      Object.values(await baja.conteos(prisma, "cliente-a")).every(
        (n) => n === 0,
      ),
    ).toBe(true);
    expect(await huellaOtra()).toEqual(antesOtra);
    expect(
      await huella(Object.keys(contA).concat("BranchTermination")),
    ).toEqual(globalesAntes);
    // Acta sin datos personales y su huella guardada.
    expect(r.actaTexto).not.toMatch(/cajera|Cliente cliente-a|@/i);
    const est = await prisma.branchTermination.findUnique({
      where: { branchId: "cliente-a" },
    });
    const { createHash } = await import("node:crypto");
    expect(est.actaSha256).toBe(
      createHash("sha256").update(r.actaTexto!).digest("hex"),
    );

    // Idempotente: repetir no borra nada más ni cambia el acta.
    const r2 = await baja.suprimir(prisma, "cliente-a", ok);
    expect(r2.yaSuprimida).toBe(true);
    expect(Object.values(r2.borradas).every((n) => n === 0)).toBe(true);
    expect(
      (
        await prisma.branchTermination.findUnique({
          where: { branchId: "cliente-a" },
        })
      ).actaSha256,
    ).toBe(est.actaSha256);
    expect(await huellaOtra()).toEqual(antesOtra);
    await expect(baja.terminar(prisma, "cliente-a")).rejects.toThrow(
      /suprimida/,
    );
  }, 120_000);

  it("no borra nada si una fila de otra sucursal apunta a la que se suprime", async () => {
    const baja = await import("../apps/api/src/baja");
    await sembrar("cliente-b");
    // Existencia de una variante de cliente-b en un almacén de «otra»: la fila
    // cruza el borde y el control la detecta por la llave del almacén.
    const vB = await prisma.variant.findFirst({
      where: { branchId: "cliente-b" },
    });
    const wOtra = await prisma.warehouse.findFirst({
      where: { branchId: "otra" },
    });
    await prisma.variantStock.upsert({
      where: {
        variantId_warehouseId: { variantId: vB.id, warehouseId: wOtra.id },
      },
      create: { variantId: vB.id, warehouseId: wOtra.id, qty: 1 },
      update: { qty: 1 },
    });
    const now = new Date("2026-05-01T12:00:00Z");
    await baja.terminar(prisma, "cliente-b", new Date("2026-01-01T12:00:00Z"));
    const dir = await mkdtemp(join(tmpdir(), "nexora-baja-paquete-"));
    await baja.exportar(
      prisma,
      "cliente-b",
      dir,
      CLAVE,
      new Date("2026-01-02T12:00:00Z"),
    );
    await rm(dir, { recursive: true, force: true });
    const antes = await huella();
    const intento = baja.suprimir(prisma, "cliente-b", {
      confirmacion: "SUPRIMIR cliente-b",
      fecha: baja.hoy(now),
      diasMinimos: 30,
      now,
    });
    await expect(intento).rejects.toThrow(/No se borró nada/);
    expect(await huella()).toEqual(antes);
  }, 120_000);

  it("rechaza una sucursal que no existe", async () => {
    const { terminar } = await import("../apps/api/src/baja");
    await expect(terminar(prisma, "no-existe")).rejects.toThrow(/No existe/);
  });
});
