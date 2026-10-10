// GET /api/alerts superó 60 s (8-oct) con el inventario importado: cada GET
// recalculaba todo el motor y escribía alerta por alerta, y cada evento en
// tiempo real hacía que todas las pestañas lo pidieran a la vez. Estas pruebas
// fijan el contrato de rendimiento del motor sin cambiar sus reglas.
import { describe, expect, it } from "vitest";
import { createRequire } from "node:module";
import * as alerts from "../apps/api/src/alerts";

// rxjs es dependencia de la API, no de la raíz.
const { lastValueFrom, of } = createRequire(
  new URL("../apps/api/package.json", import.meta.url),
)("rxjs");

const { AlertEngine, AlertsController } = alerts;
const actor = {
  id: "admin-1",
  name: "Admin",
  email: "admin@example.test",
  role: "admin",
  permissions: ["*"],
  branchId: "main",
} as any;

const deferred = () => {
  let release!: () => void;
  const promise = new Promise<void>((resolve) => (release = resolve));
  return { promise, release };
};
const flush = async () => {
  for (let i = 0; i < 20; i++) await new Promise((r) => setImmediate(r));
};

// Variantes sin stock: cada una genera una alerta out_of_stock.
const variants = (n: number) =>
  Array.from({ length: n }, (_, i) => ({
    id: "v-" + i,
    productId: "p-" + i,
    sku: "SKU-" + i,
    stock: 0,
    costAvg: 50,
    price: 118,
    createdAt: new Date(),
    product: {
      name: "Producto " + i,
      minStock: 5,
      maxStock: 80,
      taxRate: 18,
      imageUrl: null,
      category: { name: "General" },
    },
    lots: [],
  }));

// Base falsa que registra cada llamada «modelo.método». `gate` permite
// retener la lectura de variantes para simular evaluaciones lentas.
function fakeDb(rows = variants(3)) {
  const calls: string[] = [];
  const gates: ReturnType<typeof deferred>[] = [];
  let holding = false;
  const impl: Record<string, (...args: any[]) => any> = {
    "variant.findMany": async () => {
      if (holding) {
        const gate = deferred();
        gates.push(gate);
        await gate.promise;
      }
      return rows;
    },
    "alert.createMany": async ({ data }: any) => ({ count: data.length }),
    "alert.updateMany": async () => ({ count: 0 }),
    "alert.findMany": async () => [],
  };
  const model = (name: string) =>
    new Proxy(
      {},
      {
        get: (_, method) => {
          const key = name + "." + String(method);
          return async (...args: any[]) => {
            calls.push(key);
            if (impl[key]) return impl[key](...args);
            if (String(method) === "findUnique") return null;
            if (String(method).startsWith("find")) return [];
            if (String(method) === "groupBy") return [];
            return {};
          };
        },
      },
    );
  const db: any = new Proxy(
    {},
    {
      get: (_, prop) => {
        const name = String(prop);
        if (name === "$queryRaw" || name === "$executeRaw")
          return async () => {
            calls.push(name);
            return name === "$queryRaw" ? [] : 0;
          };
        if (name === "$transaction")
          return async (fn: any) => {
            calls.push("$transaction");
            return typeof fn === "function" ? fn(db) : Promise.all(fn);
          };
        if (name === "then") return undefined;
        return model(name);
      },
    },
  );
  return {
    db,
    calls,
    evaluations: () => calls.filter((c) => c === "variant.findMany").length,
    hold: () => (holding = true),
    releaseAll: () => {
      holding = false;
      gates.splice(0).forEach((g) => g.release());
    },
  };
}

describe("Alertas · rendimiento con catálogo grande", () => {
  it("cuatro GET simultáneos ejecutan una sola evaluación", async () => {
    const fake = fakeDb();
    const engine = new AlertEngine(fake.db);
    const controller = new AlertsController(fake.db, engine);
    await Promise.all(
      Array.from({ length: 4 }, () => controller.alerts(actor, {})),
    );
    expect(fake.evaluations()).toBe(1);
  });

  it("un GET dentro de los 60 s siguientes responde desde la tabla sin recalcular", async () => {
    const fake = fakeDb();
    const engine = new AlertEngine(fake.db);
    const controller = new AlertsController(fake.db, engine);
    await controller.alerts(actor, {});
    const before = fake.calls.length;
    await controller.alerts(actor, { status: "new" });
    // Sólo la lectura de la tabla Alert.
    expect(fake.calls.slice(before)).toEqual(["alert.findMany"]);
    await controller.candidates(actor);
    expect(fake.evaluations()).toBe(1);
  });

  it("después de una escritura el siguiente GET espera una evaluación nueva", async () => {
    const fake = fakeDb();
    const engine = new AlertEngine(fake.db);
    const controller = new AlertsController(fake.db, engine);
    await controller.alerts(actor, {});
    engine.invalidate();
    fake.hold();
    let done = false;
    const pending = controller.alerts(actor, {}).then(() => (done = true));
    await flush();
    expect(fake.evaluations()).toBe(2);
    expect(done).toBe(false);
    fake.releaseAll();
    await pending;
    expect(done).toBe(true);
  });

  it("nunca corre dos evaluaciones a la vez: la nueva espera a que termine la anterior", async () => {
    const fake = fakeDb();
    const engine = new AlertEngine(fake.db);
    const controller = new AlertsController(fake.db, engine);
    fake.hold();
    const first = controller.alerts(actor, {});
    await flush();
    expect(fake.evaluations()).toBe(1);
    engine.invalidate();
    const second = controller.alerts(actor, {});
    const third = controller.alerts(actor, {});
    await flush();
    expect(fake.evaluations()).toBe(1);
    fake.releaseAll();
    await first;
    await flush();
    // Una sola evaluación nueva para las dos peticiones que llegaron después.
    expect(fake.evaluations()).toBe(2);
    fake.releaseAll();
    await Promise.all([second, third]);
    expect(fake.evaluations()).toBe(2);
  });

  it("vencidos los 60 s sin cambios, el GET responde de inmediato y recalcula en segundo plano una sola vez", async () => {
    const fake = fakeDb();
    const engine = new AlertEngine(fake.db);
    const controller = new AlertsController(fake.db, engine);
    let now = Date.parse("2026-10-08T14:00:00Z");
    (engine as any).now = () => now;
    await controller.alerts(actor, {});
    now += 61_000;
    fake.hold();
    await controller.alerts(actor, {});
    await controller.alerts(actor, {});
    await flush();
    expect(fake.evaluations()).toBe(2);
    fake.releaseAll();
    await flush();
    await controller.alerts(actor, {});
    expect(fake.evaluations()).toBe(2);
  });

  it("escribe las alertas en lote: sin findUnique ni upsert por alerta", async () => {
    const fake = fakeDb(variants(500));
    const engine = new AlertEngine(fake.db);
    await engine.evaluate("main", { fresh: true });
    expect(fake.calls).not.toContain("alert.findUnique");
    expect(fake.calls).not.toContain("alert.upsert");
    expect(fake.calls.filter((c) => c.startsWith("alert.")).length).toBe(
      // resolver, leer existentes, crear en lote
      3,
    );
    expect(fake.calls.length).toBeLessThan(20);
  });

  it("una escritura de la API invalida la caché; lecturas, sesión y equipos no", async () => {
    const Interceptor = (alerts as any).AlertCacheInterceptor;
    expect(Interceptor).toBeTypeOf("function");
    const engine = new AlertEngine(fakeDb().db);
    const interceptor = new Interceptor(engine);
    const run = async (method: string, controller: string, handler = "x") => {
      const before = engine.generation;
      const context: any = {
        getType: () => "http",
        switchToHttp: () => ({ getRequest: () => ({ method }) }),
        getClass: () => ({ name: controller }),
        getHandler: () => ({ name: handler }),
      };
      await lastValueFrom(
        interceptor.intercept(context, { handle: () => of({ ok: true }) }),
      );
      return engine.generation !== before;
    };
    expect(await run("POST", "SalesController")).toBe(true);
    expect(await run("PUT", "AdminController")).toBe(true);
    expect(await run("PATCH", "AlertsController", "state")).toBe(true);
    expect(await run("DELETE", "CatalogController")).toBe(true);
    expect(await run("GET", "SalesController")).toBe(false);
    expect(await run("POST", "AuthController")).toBe(false);
    expect(await run("POST", "RealtimeController")).toBe(false);
    expect(await run("POST", "AlertsController", "evaluate")).toBe(false);
  });
});
