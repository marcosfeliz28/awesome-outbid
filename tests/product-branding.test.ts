import { describe, expect, it, vi } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { assertSeedAllowed } from "../apps/api/prisma/seed-guard";
import {
  businessSidebarLabels,
  productLoginFaces,
  warehouseLabel,
} from "../apps/web/src/product-branding";
import { WarehousesController } from "../apps/api/src/warehouses";
import { inventario } from "../apps/api/src/reportes/inventario";

const BRAND = /macgen|gv\s?makeup|fitstore/i;

/** Identificadores internos que el usuario nunca ve (claves, cookies, locks, paquetes, variables). */
const INTERNAL_IDENTIFIERS: RegExp[] = [
  /@fitstore\/[\w-]+/g, // paquetes del monorepo
  /fitstore[-_][\w:-]*/g, // localStorage fitstore-*, IndexedDB fitstore-pos-v1, cookie fitstore_refresh
  /fitstore:[\w:-]*/g, // nombres de lock de PostgreSQL
  /com\.fitstore\.pos/g, // id de aplicación nativa
  /FITSTORE_[A-Z_]+/g, // variables de entorno de desarrollo (vite.config.ts)
];

/**
 * Marcas de la tienda que SOLO se ven en modo tienda. `guard` debe aparecer en las
 * 8 líneas previas (o en todo el archivo con scope "file"): prueba que la rama está
 * cerrada por la comprobación de modo producto. Una marca nueva sin entrada falla.
 */
const STORE_ONLY: { file: string; line: string; guard: RegExp; scope?: "file"; reason: string }[] = [
  {
    file: "apps/web/src/App.tsx",
    line: 'title: "GV Makeup Studio",',
    guard: /PRODUCT_TENANCY_REQUIRED\s*\?\s*productLoginFaces[\s\S]*:\s*LOGIN_CUBE/,
    scope: "file",
    reason: "cara de LOGIN_CUBE, solo usada en la rama de tienda de Login()",
  },
  {
    file: "apps/web/src/App.tsx",
    line: ': "GRUPO MACGEN · GV MAKEUP STUDIO"}',
    guard: /PRODUCT_TENANCY_REQUIRED/,
    reason: "rama falsa del ternario PRODUCT_TENANCY_REQUIRED (tienda)",
  },
  {
    file: "apps/web/src/App.tsx",
    line: ': "Suplementos, fajas, tenis y maquillaje de Grupo MacGen, y los cursos y servicios de GV Makeup Studio, en un solo sistema."}',
    guard: /PRODUCT_TENANCY_REQUIRED/,
    reason: "rama falsa del ternario PRODUCT_TENANCY_REQUIRED (tienda)",
  },
  {
    file: "apps/web/src/App.tsx",
    line: ': "BIENVENIDA · MACGEN & GV"}',
    guard: /PRODUCT_TENANCY_REQUIRED/,
    reason: "rama falsa del ternario PRODUCT_TENANCY_REQUIRED (tienda)",
  },
  {
    file: "apps/web/src/App.tsx",
    line: "Cuenta: admin@fitstore.demo",
    guard: /!PRODUCT_TENANCY_REQUIRED/,
    reason: "credenciales de demostración, ocultas con !PRODUCT_TENANCY_REQUIRED",
  },
  {
    file: "apps/web/src/App.tsx",
    line: "Contraseña: FitStore-Demo-2026!",
    guard: /!PRODUCT_TENANCY_REQUIRED/,
    reason: "credenciales de demostración, ocultas con !PRODUCT_TENANCY_REQUIRED",
  },
  {
    file: "apps/api/src/reportes/margen.ts",
    line: ": Prisma.sql`CASE WHEN c.name ILIKE 'GV %' THEN 'GV Makeup Studio' ELSE 'MacGen' END`,",
    guard: /process\.env\.PRODUCT_TENANCY === "required"/,
    reason: "rama de tienda; en modo producto el reporte usa el nombre de Ajustes",
  },
  {
    file: "apps/api/src/secret-strength.ts",
    line: "/replace|example|changeme|fitstore|nexora|secret-of|password|contrase|qwerty/i;",
    guard: /./,
    scope: "file",
    reason: "lista interna de secretos débiles; nunca se muestra",
  },
];

/** Quita comentarios de línea y de bloque (o de HTML) respetando cadenas y plantillas. */
function stripComments(src: string, html: boolean): string {
  if (html) return src.replace(/<!--[\s\S]*?-->/g, (m) => m.replace(/[^\n]/g, ""));
  let out = "";
  let i = 0;
  let quote = "";
  while (i < src.length) {
    const c = src[i];
    const two = src.slice(i, i + 2);
    if (quote) {
      out += c;
      if (c === "\\") out += src[++i] ?? "";
      else if (c === quote) quote = "";
      i++;
    } else if (two === "//" && src[i - 1] !== ":") {
      while (i < src.length && src[i] !== "\n") i++;
    } else if (two === "/*") {
      const end = src.indexOf("*/", i + 2);
      const stop = end < 0 ? src.length : end + 2;
      out += src.slice(i, stop).replace(/[^\n]/g, "");
      i = stop;
    } else {
      if (c === '"' || c === "'" || c === "`") quote = c;
      out += c;
      i++;
    }
  }
  return out;
}

/** README: solo los paquetes @fitstore/* (comandos pnpm --filter) se toleran; ni variables ni archivos. */
function brandLines(src: string, html = false, ids = INTERNAL_IDENTIFIERS) {
  const hits: { n: number; text: string }[] = [];
  stripComments(src, html)
    .split("\n")
    .forEach((raw, idx) => {
      const text = raw.trim();
      const visible = ids.reduce((t, re) => t.replace(re, ""), text);
      if (BRAND.test(visible)) hits.push({ n: idx + 1, text });
    });
  return hits;
}

const scanFile = (file: string) =>
  brandLines(readFileSync(file, "utf8"), file.endsWith(".html"), file === "README.md" ? INTERNAL_IDENTIFIERS.slice(0, 1) : INTERNAL_IDENTIFIERS);

function walk(dir: string, accept: (f: string) => boolean): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name).replace(/\\/g, "/");
    if (name === "node_modules" || name === "dist") return [];
    return statSync(full).isDirectory() ? walk(full, accept) : accept(full) ? [full] : [];
  });
}

function scanProductBranding(): string[] {
  const leaks: string[] = [];
  const code = (f: string) => /\.tsx?$/.test(f) && !f.endsWith(".d.ts");
  const files = [
    ...walk("apps/web/src", code),
    ...walk("apps/api/src", code),
    "apps/web/index.html",
    "apps/web/vite.config.ts",
    "README.md",
  ];
  for (const file of files) {
    const whole = stripComments(readFileSync(file, "utf8"), file.endsWith(".html"));
    const lines = whole.split("\n");
    for (const hit of scanFile(file)) {
      const entry = STORE_ONLY.find((e) => e.file === file && e.line === hit.text);
      const guarded =
        entry &&
        (entry.scope === "file"
          ? entry.guard.test(whole)
          : entry.guard.test(lines.slice(Math.max(0, hit.n - 9), hit.n).join("\n")));
      if (!guarded) leaks.push(`${file}:${hit.n}: ${hit.text.slice(0, 100)}`);
    }
  }
  // public/ se sirve tal cual en la compilación de producto: nombre y contenido
  for (const file of walk("apps/web/public", () => true)) {
    if (BRAND.test(file.replace("apps/web/public/", ""))) leaks.push(`${file}: nombre de archivo`);
    if (/\.(html|js|txt|svg|json|webmanifest|css|xml)$/.test(file))
      for (const hit of scanFile(file)) leaks.push(`${file}:${hit.n}: ${hit.text.slice(0, 100)}`);
  }
  return leaks;
}

describe("PC-10 marca y almacenes por empresa", () => {
  it("ninguna pantalla, ticket, PDF, reporte, manifiesto ni README del producto muestra la marca de la tienda", () => {
    const leaks = scanProductBranding();
    expect(leaks, leaks.join("\n")).toEqual([]);
  });

  it("cada excepción de la lista de permitidos sigue existiendo (no se acumulan obsoletas)", () => {
    for (const entry of STORE_ONLY)
      expect(
        scanFile(entry.file).some((l) => l.text === entry.line),
        `${entry.file}: ${entry.line}`,
      ).toBe(true);
  });

  it("el detector marca una cadena nueva y ignora comentarios e identificadores internos", () => {
    expect(
      brandLines(
        'const t = "Bienvenida a FitStore";\n// MacGen\nconst u = \'fitstore-theme\';\nconst h = "http://x"; /* GV Makeup */',
      ),
    ).toEqual([{ n: 1, text: 'const t = "Bienvenida a FitStore";' }]);
  });

  it("la semilla de demostración se niega en modo producto y en producción", () => {
    expect(() => assertSeedAllowed({ PRODUCT_TENANCY: "required" })).toThrow(/modo producto/);
    expect(() => assertSeedAllowed({ NODE_ENV: "production" })).toThrow(/producción/);
    expect(() => assertSeedAllowed({})).not.toThrow();
  });

  it("la entrada de producto no anuncia categorías ni marcas de la tienda", () => {
    expect(productLoginFaces).toHaveLength(6);
    expect(JSON.stringify(productLoginFaces)).not.toMatch(
      /Macgen|GV Makeup|FitStore|Fajas|Suplementos/i,
    );
  });

  it("usa el nombre persistido de cada almacén y un fallback neutro", () => {
    expect(warehouseLabel({ name: "Depósito Norte", kind: "home" })).toBe(
      "Depósito Norte",
    );
    expect(warehouseLabel({ name: " Mostrador Centro ", kind: "store" })).toBe(
      "Mostrador Centro",
    );
    expect(warehouseLabel({ name: "", kind: "home" })).toBe("Almacén");
  });

  it("los reportes de inventario usan los nombres reales de ambos almacenes", async () => {
    const findMany = vi.fn().mockResolvedValue([
      { kind: "store", name: "Mostrador Centro" },
      { kind: "home", name: "Depósito Norte" },
    ]);
    const db = {
      $queryRaw: vi.fn().mockResolvedValue([
        {
          sku: "A-1",
          name: "Artículo",
          category: "General",
          store: 2,
          home: 5,
          min: 4,
        },
      ]),
      warehouse: { findMany },
    };
    const rows = await inventario["bajo-minimo"].run(
      db,
      { branchId: "main" } as never,
      { gte: new Date(), lte: new Date() },
      {},
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]["Existencia en Mostrador Centro"]).toBe(2);
    expect(rows[0]["Existencia en Depósito Norte"]).toBe(5);
    expect(rows[0]).not.toHaveProperty("Tienda");
    expect(rows[0]).not.toHaveProperty("Casa");
    expect(inventario.traspasos.title).toBe("Traspasos entre almacenes");
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ branchId: "main" }) }),
    );
  });

  it("un almacén llamado SKU no sobrescribe el SKU del reporte", async () => {
    const rows = await inventario["bajo-minimo"].run(
      {
        $queryRaw: async () => [{ sku: "A-1", name: "Artículo", category: "General", store: 2, home: 5, min: 4 }],
        warehouse: { findMany: async () => [{ kind: "store", name: "SKU" }, { kind: "home", name: "Mínimo" }] },
      },
      { branchId: "main" } as never,
      { gte: new Date(), lte: new Date() },
      {},
    );
    expect(rows[0]).toMatchObject({ SKU: "A-1", Mínimo: 4, "Existencia en SKU": 2, "Existencia en Mínimo": 5 });
  });

  it("la barra lateral usa la empresa y sucursal de Ajustes", () => {
    expect(businessSidebarLabels({ name: "Empresa A", branchName: "Centro" })).toEqual({
      branch: "Centro", business: "Empresa A",
    });
    expect(businessSidebarLabels()).toEqual({ branch: "Sucursal", business: "Nexora POS" });
  });

  it("renombra solamente un almacén activo de la sucursal y audita el cambio", async () => {
    expect(
      Reflect.getMetadata(
        "permission",
        WarehousesController.prototype.renameWarehouse,
      ),
    ).toBe("*");
    const before = {
      id: "10000000-0000-4000-8000-000000000101",
      name: "Casa",
      branchId: "main",
    };
    const findFirst = vi.fn().mockResolvedValue(before);
    const update = vi
      .fn()
      .mockResolvedValue({ ...before, name: "Depósito Norte" });
    const create = vi.fn().mockResolvedValue({ id: "audit" });
    const db = {
      $transaction: async (fn: (tx: unknown) => Promise<unknown>) =>
        fn({
          warehouse: { findFirst, update },
          auditLog: { create },
        }),
    };
    const controller = new WarehousesController(db as never);
    const actor = { id: "admin", branchId: "main" } as never;
    const result = await controller.renameWarehouse(
      before.id,
      { name: " Depósito Norte " },
      actor,
    );
    expect(result.name).toBe("Depósito Norte");
    expect(findFirst).toHaveBeenCalledWith({
      where: { id: before.id, branchId: "main", active: true },
    });
    expect(update).toHaveBeenCalledWith({
      where: { id: before.id, branchId: "main", active: true },
      data: { name: "Depósito Norte" },
    });
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ action: "warehouse_renamed" }),
      }),
    );
  });

  it("rechaza un almacén que no pertenece a la sucursal", async () => {
    const update = vi.fn();
    const controller = new WarehousesController({
      $transaction: async (fn: (tx: unknown) => Promise<unknown>) =>
        fn({
          warehouse: {
            findFirst: vi.fn().mockResolvedValue(null),
            update,
          },
        }),
    } as never);
    await expect(
      controller.renameWarehouse(
        "10000000-0000-4000-8000-000000000101",
        { name: "Ajeno" },
        { id: "admin", branchId: "main" } as never,
      ),
    ).rejects.toThrow();
    expect(update).not.toHaveBeenCalled();
  });

  it("el reporte de empresa en modo producto toma el nombre de Ajustes", async () => {
    vi.stubEnv("PRODUCT_TENANCY", "required");
    vi.resetModules();
    try {
      const { margen } = await import("../apps/api/src/reportes/margen");
      let keySql = "";
      const db = {
        $queryRaw: async (
          _strings: TemplateStringsArray,
          key: { strings: string[] },
        ) => {
          keySql = key.strings.join("");
          return [{ k: "Empresa A", units: 1, venta: 100, costo: 50 }];
        },
      };
      const rows = await margen["margen-por-empresa"].run(
        db,
        {
          branchId: "main",
        } as never,
        { gte: new Date(), lte: new Date() },
        {},
      );
      expect(rows[0].Empresa).toBe("Empresa A");
      expect(keySql).toContain("Settings");
      expect(keySql).toContain("st.data->>'name'");
      expect(keySql).not.toMatch(/MacGen|GV Makeup/);
    } finally {
      vi.unstubAllEnvs();
      vi.resetModules();
    }
  });
});
