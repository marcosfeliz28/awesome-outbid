import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { QueryClient } from "../apps/web/node_modules/@tanstack/react-query";

// Ejecuta api.ts real; IndexedDB y fetch se controlan para intercalar dos
// identidades exactamente entre el envío, la lectura y el guardado.
const fixture = vi.hoisted(() => ({
  rows: new Map<string, any>(),
  transactionGate: null as Promise<void> | null,
  putGate: null as Promise<void> | null,
}));
vi.mock("../apps/web/node_modules/dexie", () => ({
  default: class {
    cache = {
      get: async (key: string) => fixture.rows.get(key),
      put: async (row: any) => {
        const gate = fixture.putGate;
        fixture.putGate = null;
        if (gate) await gate;
        fixture.rows.set(row.key, structuredClone(row));
      },
      clear: async () => fixture.rows.clear(),
    };
    version() {
      return {
        stores: () => {
          this.cache = {
            get: async (key: string) => fixture.rows.get(key),
            put: async (row: any) => {
              const gate = fixture.putGate;
              fixture.putGate = null;
              if (gate) await gate;
              fixture.rows.set(row.key, structuredClone(row));
            },
            clear: async () => fixture.rows.clear(),
          };
        },
      };
    }
    async transaction(
      _mode: string,
      _table: unknown,
      run: () => Promise<void>,
    ) {
      const gate = fixture.transactionGate;
      fixture.transactionGate = null;
      if (gate) await gate;
      // Como IndexedDB, una excepción del callback aborta todas sus escrituras.
      const before = structuredClone([...fixture.rows]);
      try {
        return await run();
      } catch (error) {
        fixture.rows.clear();
        for (const [key, row] of before) fixture.rows.set(key, row);
        throw error;
      }
    }
  },
}));
vi.mock("../apps/web/src/monitoring", () => ({
  businessOperationName: () => null,
  traceBusinessOperation: (_name: unknown, run: () => unknown) => run(),
}));
const actor = (id: string, permissions = ["sale:read"], branchId = "main") => ({
  id,
  name: id,
  email: id + "@example.invalid",
  role: "seller",
  permissions,
  branchId,
});
const json = (value: unknown, status = 200) =>
  new Response(JSON.stringify(value), {
    status,
    headers: { "Content-Type": "application/json" },
  });
const deferred = <T>() => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
};

beforeEach(() => {
  vi.resetModules();
  fixture.rows.clear();
  fixture.transactionGate = null;
  fixture.putGate = null;
  vi.stubGlobal("navigator", { onLine: true });
  vi.stubGlobal("localStorage", { getItem: () => null });
  vi.stubGlobal("fetch", vi.fn());
});
afterEach(() => {
  vi.unstubAllGlobals();
});

describe("3ag · copias privadas por usuario, sucursal y permisos", () => {
  it("guarda catálogo y clientes reales en sus claves lógicas con dueño obligatorio", async () => {
    const mod = await import("../apps/web/src/api");
    const user = actor("a", ["reports:read", "sale:read"]);
    mod.useStore.getState().setSession(user, "token-a");
    const products = [
      { id: "p", variants: [{ id: "v", stock: "5", price: "30" }] },
    ];
    vi.mocked(fetch)
      .mockResolvedValueOnce(json({ items: products, total: 1 }))
      .mockResolvedValueOnce(
        json([{ id: "customer-a", name: "Cliente real" }]),
      );
    await mod.loadCatalog();
    await mod.cachedApi("/customers", "customers:a");
    expect([...fixture.rows.keys()].sort()).toEqual([
      "catalog:main",
      "customers:a",
    ]);
    const owner = JSON.stringify([
      "main",
      "a",
      "seller",
      ["reports:read", "sale:read"],
    ]);
    expect(fixture.rows.get("catalog:main")).toEqual({
      key: "catalog:main",
      owner,
      data: products,
    });
    expect(fixture.rows.get("customers:a")).toEqual({
      key: "customers:a",
      owner,
      data: [{ id: "customer-a", name: "Cliente real" }],
    });
  });

  it("sobrescribe la misma clave al cambiar de usuario y nunca entrega esa copia al dueño anterior", async () => {
    const mod = await import("../apps/web/src/api");
    mod.useStore.getState().setSession(actor("a"), "token-a");
    vi.mocked(fetch).mockResolvedValueOnce(json(["datos de a"]));
    await mod.cachedApi("/settings", "settings:main");
    mod.useStore.getState().setSession(actor("b"), "token-b");
    vi.mocked(fetch).mockResolvedValueOnce(json(["datos de b"]));
    await mod.cachedApi("/settings", "settings:main");
    expect([...fixture.rows.keys()]).toEqual(["settings:main"]);
    mod.useStore.getState().setOnline(false);
    await expect(mod.cachedApi("/settings", "settings:main")).resolves.toEqual([
      "datos de b",
    ]);
    mod.useStore.getState().setSession(actor("a"), "new-token-a");
    await expect(mod.cachedApi("/settings", "settings:main")).rejects.toThrow();
  });

  it("lee la clave lógica sólo con owner exacto y normaliza el orden de permisos", async () => {
    const mod = await import("../apps/web/src/api");
    const user = actor("a", ["sale:read", "reports:read"]);
    mod.useStore.getState().setSession(user, "token-a");
    mod.useStore.getState().setOnline(false);
    fixture.rows.set("customers:a", {
      key: "customers:a",
      data: ["copia propia"],
      owner: JSON.stringify([
        "main",
        "a",
        "seller",
        ["reports:read", "sale:read"],
      ]),
    });
    await expect(mod.cachedApi("/customers", "customers:a")).resolves.toEqual([
      "copia propia",
    ]);
  });

  it.each([
    undefined,
    JSON.stringify(["main", "other", "seller", ["sale:read"]]),
    JSON.stringify(["other", "a", "seller", ["sale:read"]]),
    JSON.stringify(["main", "a", "admin", ["sale:read"]]),
    JSON.stringify(["main", "a", "seller", ["*"]]),
  ])(
    "ignora una fila de la clave real con owner ausente o distinto %j",
    async (owner) => {
      const mod = await import("../apps/web/src/api");
      mod.useStore.getState().setSession(actor("a"), "token-a");
      mod.useStore.getState().setOnline(false);
      fixture.rows.set("customers:a", {
        key: "customers:a",
        owner,
        data: ["ajeno"],
      });
      await expect(
        mod.cachedApi("/customers", "customers:a"),
      ).rejects.toThrow();
      expect(fetch).not.toHaveBeenCalled();
    },
  );

  it("el efecto de un render o SSE anterior no etiqueta datos ajenos con el usuario nuevo", async () => {
    const mod = await import("../apps/web/src/api");
    const first = actor("a");
    mod.useStore.getState().setSession(first, "token-a");
    await mod.writePrivateCache("catalog:main", ["catálogo de a"], first);
    const saved = await mod.readPrivateCache("catalog:main", first);
    mod.useStore.getState().setSession(actor("b"), "token-b");
    await expect(
      mod.writePrivateCache(saved!.key, ["stock viejo"], first),
    ).rejects.toMatchObject({ status: 401 });
    await expect(
      mod.readPrivateCache("catalog:main", actor("b")),
    ).resolves.toBeUndefined();
    expect(fixture.rows.get("catalog:main")).toEqual(saved);
  });

  it("una escritura en cola no recrea datos después del purge de logout", async () => {
    const mod = await import("../apps/web/src/api");
    const first = actor("a");
    mod.useStore.getState().setSession(first, "token-a");
    const gate = deferred<void>();
    fixture.transactionGate = gate.promise;
    const pending = mod.writePrivateCache(
      "customers:a",
      ["respuesta antigua"],
      first,
    );
    const rejected = expect(pending).rejects.toMatchObject({ status: 401 });
    mod.useStore.getState().clearSession();
    await mod.forgetSessionData();
    gate.resolve();
    await rejected;
    expect(fixture.rows.size).toBe(0);
  });

  it("aborta la transacción si cambia la sesión durante el put", async () => {
    const mod = await import("../apps/web/src/api");
    const first = actor("a");
    mod.useStore.getState().setSession(first, "token-a");
    const gate = deferred<void>();
    fixture.putGate = gate.promise;
    const pending = mod.writePrivateCache(
      "customers:a",
      ["respuesta antigua"],
      first,
    );
    const rejected = expect(pending).rejects.toMatchObject({ status: 401 });
    mod.useStore.getState().clearSession();
    gate.resolve();
    await rejected;
    expect(fixture.rows.size).toBe(0);
  });

  it("descuenta stock sólo en el catálogo del owner vigente y conserva sus metadatos", async () => {
    const mod = await import("../apps/web/src/api");
    const first = actor("a");
    mod.useStore.getState().setSession(first, "token-a");
    const client = new QueryClient();
    const stop = mod.isolateQueryClient(client);
    const products = [
      { id: "p", variants: [{ id: "v", stock: "5", price: "30" }] },
    ];
    await mod.writePrivateCache("catalog:main", products, first);
    const owner = fixture.rows.get("catalog:main").owner;
    client.setQueryData(["catalog"], products);
    await mod.discountLocalStock(client, [{ variantId: "v", qty: 2 }]);
    expect(fixture.rows.get("catalog:main").data[0].variants[0].stock).toBe(
      "3",
    );
    expect(fixture.rows.get("catalog:main").owner).toBe(owner);
    mod.useStore.getState().setSession(actor("b"), "token-b");
    await mod.discountLocalStock(client, [{ variantId: "v", qty: 1 }]);
    expect(fixture.rows.get("catalog:main").data[0].variants[0].stock).toBe(
      "3",
    );
    expect(fixture.rows.get("catalog:main").owner).toBe(owner);
    stop();
  });

  it.each([
    ["otra persona", actor("cashier")],
    ["otra sucursal", actor("admin", ["*"], "other")],
    ["menos permisos de la misma persona", actor("admin")],
  ])(
    "no entrega datos de administración a %s sin conexión",
    async (_name, next) => {
      const mod = await import("../apps/web/src/api");
      mod.useStore.getState().setSession(actor("admin", ["*"]), "token-a");
      vi.mocked(fetch).mockResolvedValue(json([{ legalId: "datos privados" }]));
      await mod.cachedApi("/customers", "customers");
      mod.useStore.getState().setSession(next, "token-b");
      mod.useStore.getState().setOnline(false);
      await expect(mod.cachedApi("/customers", "customers")).rejects.toThrow();
    },
  );

  it("ignora una copia heredada sin dueño y conserva la copia propia", async () => {
    const mod = await import("../apps/web/src/api");
    mod.useStore.getState().setSession(actor("cashier"), "token-b");
    fixture.rows.set("customers", { key: "customers", data: ["otro usuario"] });
    mod.useStore.getState().setOnline(false);
    await expect(mod.cachedApi("/customers", "customers")).rejects.toThrow();
    mod.useStore.getState().setOnline(true);
    vi.mocked(fetch).mockResolvedValue(json(["copia propia"]));
    await mod.cachedApi("/customers", "customers");
    mod.useStore.getState().setOnline(false);
    await expect(mod.cachedApi("/customers", "customers")).resolves.toEqual([
      "copia propia",
    ]);
  });

  it("descarta la respuesta antigua aunque A cambie a B y vuelva a A", async () => {
    const mod = await import("../apps/web/src/api");
    const response = deferred<Response>();
    mod.useStore.getState().setSession(actor("a"), "token-a");
    vi.mocked(fetch).mockReturnValue(response.promise);
    const pending = mod.cachedApi("/customers", "customers");
    mod.useStore.getState().setSession(actor("b"), "token-b");
    mod.useStore.getState().setSession(actor("a"), "token-new-a");
    response.resolve(json(["respuesta de la sesión anterior"]));
    await expect(pending).rejects.toMatchObject({ status: 401 });
    expect(fixture.rows.size).toBe(0);
  });

  it("no renueva ni reenvía con credenciales de B una petición enviada por A", async () => {
    const mod = await import("../apps/web/src/api");
    const response = deferred<Response>();
    mod.useStore.getState().setSession(actor("a"), "token-a");
    vi.mocked(fetch)
      .mockImplementation(async () =>
        json({ user: actor("b"), accessToken: "b" }),
      )
      .mockReturnValueOnce(response.promise);
    const pending = mod.api("/customers");
    mod.useStore.getState().setSession(actor("b"), "token-b");
    response.resolve(json({}, 401));
    await expect(pending).rejects.toMatchObject({ status: 401 });
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("el catálogo propio sin conexión conserva existencias y elimina costos", async () => {
    const mod = await import("../apps/web/src/api");
    mod.useStore.getState().setSession(actor("a", ["*"]), "token-a");
    vi.mocked(fetch).mockResolvedValue(
      json({
        total: 1,
        items: [
          {
            id: "p",
            variants: [
              {
                id: "v",
                price: "30",
                stock: "5",
                costAvg: "20",
                lots: [{ cost: "20", qty: "5" }],
              },
            ],
          },
        ],
      }),
    );
    await mod.loadCatalog();
    mod.useStore.getState().setOnline(false);
    const copy = await mod.loadCatalog();
    expect(copy[0].variants[0]).toEqual({
      id: "v",
      price: "30",
      stock: "5",
      lots: [{ qty: "5" }],
    });
    mod.useStore.getState().setSession(actor("b"), "token-b");
    await expect(mod.loadCatalog()).rejects.toThrow(/descargar el catálogo/);
  });

  it("borra React Query al cambiar permisos y conserva datos al rotar el token", async () => {
    const mod = await import("../apps/web/src/api");
    const client = new QueryClient();
    const stop = mod.isolateQueryClient(client);
    mod.useStore.getState().setSession(actor("a", ["*"]), "token-a");
    client.setQueryData(["customers"], ["datos privados"]);
    mod.useStore.getState().setSession(actor("a", ["*"]), "renewed-a");
    expect(client.getQueryData(["customers"])).toEqual(["datos privados"]);
    mod.useStore.getState().setSession(actor("a"), "limited-a");
    expect(client.getQueryData(["customers"])).toBeUndefined();
    stop();
  });

  it("no reutiliza costos de admin al pasar a seller con los mismos permisos", async () => {
    const mod = await import("../apps/web/src/api");
    const admin = { ...actor("same", ["*"]), role: "admin" };
    mod.useStore.getState().setSession(admin, "admin-token");
    vi.mocked(fetch).mockResolvedValue(json([{ unitCost: "20" }]));
    await mod.cachedApi("/goods-receipts", "goods-receipts");
    mod.useStore
      .getState()
      .setSession({ ...admin, role: "seller" }, "seller-token");
    mod.useStore.getState().setOnline(false);
    await expect(
      mod.cachedApi("/goods-receipts", "goods-receipts"),
    ).rejects.toThrow();
  });

  it("borra React Query al cambiar de rol con id y permisos intactos", async () => {
    const mod = await import("../apps/web/src/api");
    const client = new QueryClient();
    const stop = mod.isolateQueryClient(client);
    const admin = { ...actor("same", ["*"]), role: "admin" };
    mod.useStore.getState().setSession(admin, "admin-token");
    client.setQueryData(["goods-receipts"], [{ unitCost: "20" }]);
    mod.useStore
      .getState()
      .setSession({ ...admin, role: "seller" }, "seller-token");
    expect(client.getQueryData(["goods-receipts"])).toBeUndefined();
    stop();
  });

  it("las solicitudes autenticadas no usan la caché HTTP del navegador", async () => {
    const mod = await import("../apps/web/src/api");
    mod.useStore.getState().setSession(actor("a"), "token-a");
    vi.mocked(fetch).mockResolvedValue(json([]));
    await mod.api("/customers");
    expect(fetch).toHaveBeenCalledWith(
      "/api/customers",
      expect.objectContaining({ cache: "no-store" }),
    );
  });
});

describe("3ag · respuestas de renovación fuera de su sesión", () => {
  it.each([
    { name: "sin sesión guardada", data: undefined },
    { name: "marcador de cierre vencido", data: { expiresAt: 0 } },
    {
      name: "usuario guardado vencido",
      data: { user: actor("a"), expiresAt: 1 },
    },
    {
      name: "registro vigente sin usuario",
      data: { expiresAt: Date.now() + 60000 },
    },
  ])(
    "no envía refresh con $name aunque quede una cookie válida",
    async ({ data }) => {
      const mod = await import("../apps/web/src/api");
      if (data) fixture.rows.set("session", { key: "session", data });
      vi.mocked(fetch).mockImplementation(async () =>
        json({ user: actor("a"), accessToken: "cookie-still-valid" }),
      );
      await expect(mod.refreshSession()).rejects.toMatchObject({ status: 401 });
      expect(fetch).not.toHaveBeenCalled();
      expect(mod.useStore.getState().user).toBeNull();
    },
  );

  it("restaura al recargar un usuario guardado vigente sin prolongar su plazo", async () => {
    const mod = await import("../apps/web/src/api");
    const expiresAt = Date.now() + 60000;
    fixture.rows.set("session", {
      key: "session",
      data: { user: actor("a"), expiresAt },
    });
    vi.mocked(fetch).mockResolvedValue(
      json({ user: actor("a"), accessToken: "renewed-a" }),
    );
    await mod.refreshSession();
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(mod.useStore.getState().user?.id).toBe("a");
    expect(mod.useStore.getState().token).toBe("renewed-a");
    expect(fixture.rows.get("session").data.expiresAt).toBe(expiresAt);
  });

  it("un 401 posterior al cierre fallido no revive la sesión con su cookie", async () => {
    const mod = await import("../apps/web/src/api");
    mod.useStore.getState().setSession(actor("a"), "token-a");
    vi.mocked(fetch).mockResolvedValueOnce(json({}, 401));
    await mod.endSession();
    vi.mocked(fetch).mockClear();
    vi.mocked(fetch).mockImplementation(async (url) =>
      String(url).endsWith("/auth/refresh")
        ? json({ user: actor("a"), accessToken: "cookie-still-valid" })
        : json({}, 401),
    );
    await expect(mod.api("/customers")).rejects.toMatchObject({ status: 401 });
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(vi.mocked(fetch).mock.calls[0][0]).toBe("/api/customers");
    expect(mod.useStore.getState().user).toBeNull();
    expect(fixture.rows.get("session")).toEqual({
      key: "session",
      data: { expiresAt: 0 },
    });
  });

  it("renueva una sola vez la sesión vigente y reintenta con su token nuevo", async () => {
    const mod = await import("../apps/web/src/api");
    mod.useStore.getState().setSession(actor("a"), "old-a");
    vi.mocked(fetch)
      .mockResolvedValueOnce(json({}, 401))
      .mockResolvedValueOnce(json({ user: actor("a"), accessToken: "new-a" }))
      .mockResolvedValueOnce(json(["datos de a"]));
    await expect(mod.api("/customers")).resolves.toEqual(["datos de a"]);
    const headers = vi.mocked(fetch).mock.calls[2][1]?.headers as Headers;
    expect(headers.get("Authorization")).toBe("Bearer new-a");
    expect(JSON.stringify([...fixture.rows.values()])).not.toContain("new-a");
  });

  it("una descarga rechazada otra vez termina sin bucle de renovaciones", async () => {
    const mod = await import("../apps/web/src/api");
    mod.useStore.getState().setSession(actor("a"), "old-a");
    vi.mocked(fetch)
      .mockResolvedValueOnce(json({}, 401))
      .mockResolvedValueOnce(json({ user: actor("a"), accessToken: "new-a" }))
      .mockResolvedValueOnce(json({}, 401));
    await expect(mod.download("/sales/export", "ventas.xlsx")).rejects.toThrow(
      mod.DOWNLOAD_FAILED,
    );
    expect(fetch).toHaveBeenCalledTimes(3);
  });

  it("no restaura una sesión que ya fue cerrada", async () => {
    const mod = await import("../apps/web/src/api");
    const response = deferred<Response>();
    mod.useStore.getState().setSession(actor("a"), "token-a");
    vi.mocked(fetch).mockReturnValue(response.promise);
    const pending = mod.refreshSession();
    await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
    mod.useStore.getState().clearSession();
    response.resolve(json({ user: actor("a"), accessToken: "late-token" }));
    await expect(pending).rejects.toMatchObject({ status: 401 });
    expect(mod.useStore.getState().user).toBeNull();
    expect(fixture.rows.has("session")).toBe(false);
  });

  it("no reemplaza B con una renovación iniciada por A", async () => {
    const mod = await import("../apps/web/src/api");
    const response = deferred<Response>();
    mod.useStore.getState().setSession(actor("a"), "token-a");
    vi.mocked(fetch).mockReturnValue(response.promise);
    const pending = mod.refreshSession();
    await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
    mod.useStore.getState().setSession(actor("b"), "token-b");
    response.resolve(json({ user: actor("a"), accessToken: "late-token" }));
    await expect(pending).rejects.toMatchObject({ status: 401 });
    expect(mod.useStore.getState().user?.id).toBe("b");
    expect(mod.useStore.getState().token).toBe("token-b");
  });

  it("rechaza una cookie de otra persona al renovar la sesión guardada", async () => {
    const mod = await import("../apps/web/src/api");
    fixture.rows.set("session", {
      key: "session",
      data: { user: actor("b"), expiresAt: Date.now() + 60000 },
    });
    vi.mocked(fetch).mockResolvedValue(
      json({ user: actor("a"), accessToken: "a" }),
    );
    await expect(mod.refreshSession()).rejects.toMatchObject({ status: 401 });
    expect(mod.useStore.getState().user).toBeNull();
  });

  it("al cerrar invalida de inmediato una renovación que aún está en vuelo", async () => {
    const mod = await import("../apps/web/src/api");
    const renewal = deferred<Response>();
    const logout = deferred<Response>();
    mod.useStore.getState().setSession(actor("a"), "token-a");
    vi.mocked(fetch)
      .mockReturnValueOnce(renewal.promise)
      .mockReturnValueOnce(logout.promise);
    const pending = mod.refreshSession();
    await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
    const rejected = expect(pending).rejects.toMatchObject({ status: 401 });
    const closing = mod.endSession();
    renewal.resolve(json({ user: actor("a"), accessToken: "late-a" }));
    await rejected;
    logout.resolve(json({ ok: true }));
    await closing;
    expect(mod.useStore.getState().user).toBeNull();
    expect(fixture.rows.size).toBe(0);
  });

  it("un rechazo al revocar deja el marcador vencido y no intenta renovar", async () => {
    const mod = await import("../apps/web/src/api");
    mod.useStore.getState().setSession(actor("a"), "token-a");
    vi.mocked(fetch).mockResolvedValue(json({}, 401));
    await mod.endSession();
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fixture.rows.get("session")).toEqual({
      key: "session",
      data: { expiresAt: 0 },
    });
    expect(mod.useStore.getState().user).toBeNull();
  });
});
