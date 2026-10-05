// Regresiones de la auditoría R4 de ChatGPT (R4-05 y R4-06): mismas
// reproducciones controladas, con la expectativa corregida.
import { afterEach, describe, expect, it, vi } from "vitest";
import { EventEmitter } from "node:events";
import { RealtimeController, RealtimeHub } from "../apps/api/src/realtime";

afterEach(() => vi.restoreAllMocks());

function fakeTimers() {
  let next = 0;
  const live = new Map<number, () => unknown>();
  vi.spyOn(globalThis, "setInterval").mockImplementation(((fn: any) => {
    live.set(++next, fn);
    return next;
  }) as any);
  vi.spyOn(globalThis, "clearInterval").mockImplementation(((id: any) => {
    live.delete(id);
  }) as any);
  return live;
}
const flush = async () => {
  for (let i = 0; i < 5; i++) await Promise.resolve();
};
const actor = { id: "u1", sessionId: "s1", branchId: "main" } as any;
function response() {
  const res: any = new EventEmitter();
  res.code = 200;
  res.writes = [];
  res.destroyed = false;
  res.status = (code: number) => ((res.code = code), res);
  res.json = (data: unknown) => ((res.body = data), res);
  res.setHeader = () => {};
  res.flushHeaders = () => {};
  res.write = (data: string) => (res.writes.push(data), true);
  res.destroy = () => {
    res.destroyed = true;
    res.emit("close");
  };
  return res;
}
const request = () => Object.assign(new EventEmitter(), { socket: undefined });

describe("RealtimeHub · inicialización concurrente (R4-05)", () => {
  it("varias altas simultáneas: una consulta inicial, un intervalo y ningún evento perdido", async () => {
    const live = fakeTimers();
    const resolvers: ((v: unknown) => void)[] = [];
    const sent: string[] = [];
    const row = { id: 1n, branchId: "main", type: "stock.changed", data: {} };
    const db: any = {
      realtimeEvent: {
        aggregate: () => new Promise((r) => resolvers.push(r)),
        findMany: async ({ where }: any) => (row.id > where.id.gt ? [row] : []),
      },
    };
    const hub = new RealtimeHub(db);
    const first = hub.add({
      branchId: "main",
      send: (r) => (sent.push(String(r.id)), true),
    });
    const second = hub.add({ branchId: "main", send: () => true });
    const third = hub.add({ branchId: "main", send: () => true });
    expect(resolvers).toHaveLength(1);
    resolvers[0]({ _max: { id: 0n } });
    const removes = await Promise.all([first, second, third]);
    expect(live.size).toBe(1);
    // El evento 1 se confirma con los listeners activos: llega una vez.
    [...live.values()][0]();
    await flush();
    [...live.values()][0]();
    await flush();
    expect(sent).toEqual(["1"]);
    removes.forEach((r) => r());
    removes[0]();
    expect(hub.count()).toBe(0);
    expect(live.size).toBe(0);
  });

  it("desconectar todo durante la inicialización deja cero intervalos", async () => {
    const live = fakeTimers();
    let resolve!: (v: unknown) => void;
    const db: any = {
      realtimeEvent: {
        aggregate: () => new Promise((r) => (resolve = r)),
        findMany: async () => [],
      },
    };
    const hub = new RealtimeHub(db);
    let closed = false;
    const pending = hub.add(
      { branchId: "main", send: () => true },
      () => closed,
    );
    closed = true;
    resolve({ _max: { id: 5n } });
    const remove = await pending;
    remove();
    await flush();
    expect(hub.count()).toBe(0);
    expect(live.size).toBe(0);
    expect(hub.running()).toBe(false);
  });

  it("reinicia limpio después de quedarse sin clientes", async () => {
    const live = fakeTimers();
    let max = 0n;
    const db: any = {
      realtimeEvent: {
        aggregate: async () => ({ _max: { id: max } }),
        findMany: async () => [],
      },
    };
    const hub = new RealtimeHub(db);
    const r1 = await hub.add({ branchId: "main", send: () => true });
    r1();
    expect(live.size).toBe(0);
    max = 9n;
    const r2 = await hub.add({ branchId: "main", send: () => true });
    expect(live.size).toBe(1);
    r2();
    expect(live.size).toBe(0);
  });
});

describe("SSE · cupos y cierre durante el alta (R4-06)", () => {
  it("una ráfaga de 20 altas sobre una sesión acepta como máximo 2", async () => {
    fakeTimers();
    const pending: ((v: unknown) => void)[] = [];
    const controller = new RealtimeController({} as any);
    (controller as any).hub = {
      add: () => new Promise((resolve) => pending.push(resolve)),
    };
    const responses = Array.from({ length: 20 }, () => response());
    const calls = responses.map((r) =>
      controller.events(request() as any, r, actor),
    );
    expect(pending).toHaveLength(2);
    pending.forEach((resolve) => resolve(() => {}));
    await Promise.all(calls);
    expect(
      responses.filter((r) => r.code === 200 && r.writes.length),
    ).toHaveLength(2);
    expect(responses.filter((r) => r.code === 429)).toHaveLength(18);
    responses.forEach((r) => r.emit("close"));
    // Tras cerrar, el cupo vuelve a estar libre.
    (controller as any).hub = { add: async () => () => {} };
    const again = response();
    await controller.events(request() as any, again, actor);
    expect(again.code).toBe(200);
    again.emit("close");
  });

  it("varias sesiones del mismo usuario: como máximo 6", async () => {
    fakeTimers();
    const pending: ((v: unknown) => void)[] = [];
    const controller = new RealtimeController({} as any);
    (controller as any).hub = {
      add: () => new Promise((resolve) => pending.push(resolve)),
    };
    const responses = Array.from({ length: 10 }, () => response());
    const calls = responses.map((r, i) =>
      controller.events(request() as any, r, {
        ...actor,
        id: "multi",
        sessionId: "m" + i,
      }),
    );
    expect(pending).toHaveLength(6);
    pending.forEach((resolve) => resolve(() => {}));
    await Promise.all(calls);
    expect(responses.filter((r) => r.code === 429)).toHaveLength(4);
    responses.forEach((r) => r.emit("close"));
  });

  it("un cliente que cierra durante el alta no deja cupo, listener ni latido", async () => {
    const live = fakeTimers();
    let resolve!: (v: unknown) => void;
    let removed = 0;
    let closedSeen: (() => boolean) | undefined;
    const controller = new RealtimeController({} as any);
    (controller as any).hub = {
      add: (_l: unknown, isClosed: () => boolean) => {
        closedSeen = isClosed;
        return new Promise((r) => (resolve = r));
      },
    };
    const res = response();
    const who = { ...actor, sessionId: "closing" };
    const p = controller.events(request() as any, res, who);
    res.emit("close");
    expect(closedSeen?.()).toBe(true);
    resolve(() => removed++);
    await p;
    expect(removed).toBe(1);
    expect(res.writes).toHaveLength(0);
    expect(live.size).toBe(0);
    // El cupo de la sesión quedó libre: dos altas nuevas se aceptan.
    (controller as any).hub = { add: async () => () => {} };
    const a = response(),
      b = response();
    await controller.events(request() as any, a, who);
    await controller.events(request() as any, b, who);
    expect([a.code, b.code]).toEqual([200, 200]);
    a.emit("close");
    b.emit("close");
  });
});
