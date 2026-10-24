import { afterEach, describe, expect, it, vi } from "vitest";
import { RealtimeHub } from "../apps/api/src/realtime";
import { tenantScope } from "../apps/api/src/tenant-context";

afterEach(() => vi.restoreAllMocks());

const branchId = "main";
const tenant = (i: number) => `00000000-0000-0000-0000-${String(i).padStart(12, "0")}`;

function controlledClock() {
  let now = 0;
  vi.spyOn(Date, "now").mockImplementation(() => now);
  vi.spyOn(globalThis, "setInterval").mockImplementation((() => 1) as any);
  vi.spyOn(globalThis, "clearInterval").mockImplementation((() => {}) as any);
  return { advance: (ms: number) => { now += ms; } };
}

describe("N24 · sondeo multiempresa", () => {
  it("reduce las consultas inactivas para 3, 20 y 100 empresas sin dejar de consultar ninguna", async () => {
    const measurements: string[] = [];
    for (const tenantCount of [3, 20, 100]) {
      const clock = controlledClock();
      const perTenant = new Map<string, number>();
      const db: any = { realtimeEvent: {
        aggregate: async () => ({ _max: { id: 0n } }),
        findMany: async () => {
          const id = tenantScope.getStore()?.tenantId ?? "unknown";
          perTenant.set(id, (perTenant.get(id) ?? 0) + 1);
          return [];
        },
      } };
      const hub = new RealtimeHub(db);
      const remove = await Promise.all(Array.from({ length: tenantCount }, (_, i) =>
        tenantScope.run({ tenantId: tenant(i + 1) }, () => hub.add({ branchId, send: () => true }))));
      for (let elapsed = 0; elapsed < 30_000; elapsed += 150) {
        await (hub as any).poll();
        clock.advance(150);
      }
      const queries = [...perTenant.values()].reduce((sum, n) => sum + n, 0);
      measurements.push(`${tenantCount} empresas: ${queries} consultas/30 s`);
      expect(perTenant.size).toBe(tenantCount);
      // Antes: 200 consultas/empresa/30 s. El límite conserva margen para
      // el arranque adaptativo y exige una reducción superior a 4×.
      expect(queries).toBeLessThanOrEqual(tenantCount * 45);
      remove.forEach((fn) => fn());
      vi.restoreAllMocks();
    }
    console.info(`N24 medición en reposo: ${measurements.join("; ")}`);
  });

  it("entrega una ráfaga mayor que el lote y sigue funcionando tras reconectar", async () => {
    const clock = controlledClock();
    const rows = Array.from({ length: 1_201 }, (_, i) => ({
      id: BigInt(i + 1), branchId, type: "stock.changed", data: { i },
    }));
    let queries = 0;
    const db: any = { realtimeEvent: {
      aggregate: async () => ({ _max: { id: rows.at(-1)?.id ?? 0n } }),
      findMany: async ({ where, take }: any) => {
        queries++;
        return rows.filter((row) => row.id > where.id.gt).slice(0, take);
      },
    } };
    const hub = new RealtimeHub(db);
    const received: bigint[] = [];
    const remove = await tenantScope.run({ tenantId: tenant(1) }, () => hub.add({
      branchId, send: (row) => (received.push(row.id), true),
    }));
    // La conexión arranca en el último ID existente. Esta ráfaga aparece después.
    rows.length = 0;
    await (hub as any).poll();
    for (let elapsed = 0; elapsed < 10_000; elapsed += 150) {
      clock.advance(150);
      await (hub as any).poll();
    }
    expect(queries).toBeLessThan(25);
    rows.push(...Array.from({ length: 1_201 }, (_, i) => ({
      id: BigInt(i + 1_202), branchId, type: "stock.changed", data: { i },
    })));
    for (let elapsed = 0; elapsed < 4_000 && received.length < 1_201; elapsed += 150) {
      clock.advance(150);
      await (hub as any).poll();
    }
    expect(received).toHaveLength(1_201);
    expect(received[0]).toBe(1_202n);
    expect(received.at(-1)).toBe(2_402n);
    remove();
    rows.push({ id: 2_403n, branchId, type: "stock.changed", data: { i: 1_201 } });
    const afterReconnect: bigint[] = [];
    const reconnect = await tenantScope.run({ tenantId: tenant(1) }, () => hub.add({
      branchId, send: (row) => (afterReconnect.push(row.id), true),
    }));
    rows.push({ id: 2_404n, branchId, type: "stock.changed", data: { i: 1_202 } });
    clock.advance(150);
    await (hub as any).poll();
    expect(afterReconnect).toEqual([2_404n]);
    reconnect();
  });

  it("ignora un sondeo viejo que termina después de reconectar", async () => {
    const clock = controlledClock();
    let max = 0n;
    let resolveOld!: (rows: unknown[]) => void;
    let reads = 0;
    const db: any = { realtimeEvent: {
      aggregate: async () => ({ _max: { id: max } }),
      findMany: ({ where }: any) => {
        reads++;
        if (reads === 1) return new Promise((resolve) => { resolveOld = resolve; });
        return Promise.resolve([{ id: 11n, branchId, type: "stock.changed", data: {} }]
          .filter((row) => row.id > where.id.gt));
      },
    } };
    const hub = new RealtimeHub(db);
    const remove = await tenantScope.run({ tenantId: tenant(1) }, () => hub.add({ branchId, send: () => true }));
    const stale = (hub as any).poll();
    remove();
    max = 10n;
    const received: bigint[] = [];
    const reconnect = await tenantScope.run({ tenantId: tenant(1) }, () => hub.add({
      branchId, send: (row) => (received.push(row.id), true),
    }));
    // La consulta vieja vio un evento más nuevo que la inicialización de la
    // reconexión. No puede adelantar su cursor y saltarse el evento 11.
    resolveOld([{ id: 12n, branchId, type: "stock.changed", data: {} }]);
    await stale;
    clock.advance(150);
    await (hub as any).poll();
    expect(received).toEqual([11n]);
    reconnect();
  });
});
