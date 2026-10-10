// N-M3 en la caja: la cola local reintenta con el mismo UUID ante un error
// transitorio y NUNCA marca «conflicto» ni pide revisión por él.
import { describe, expect, it, vi } from "vitest";
import {
  applyPendingSaleReprice,
  applySyncResults,
  retryDelayMs,
  retryMessage,
} from "../apps/web/src/pendingSales";

const uuid = (n: number) => `00000000-0000-4000-8000-00000000000${n}`;
const deps = () => ({
  deleteLocal: vi.fn(async () => undefined),
  markConflict: vi.fn(async () => undefined),
});

describe("N-M3 · cola de ventas sin conexión", () => {
  it("«retry» deja la venta pendiente: ni se borra ni se marca conflicto", async () => {
    const d = deps();
    const result = await applySyncResults(
      [
        { offlineUuid: uuid(1), status: "retry", message: "ocupado" },
        { offlineUuid: uuid(2), status: "synced" },
        {
          offlineUuid: uuid(3),
          status: "conflict",
          message: "Stock insuficiente",
        },
      ],
      d,
    );
    expect(result).toEqual({ synced: 1, conflicts: 1, retry: 1 });
    expect(d.deleteLocal).toHaveBeenCalledTimes(1);
    expect(d.deleteLocal).toHaveBeenCalledWith(uuid(2));
    expect(d.markConflict).toHaveBeenCalledTimes(1);
    expect(d.markConflict).toHaveBeenCalledWith(uuid(3), "Stock insuficiente");
  });

  it("un estado desconocido (servidor más nuevo) se trata como reintento, nunca como conflicto", async () => {
    const d = deps();
    const result = await applySyncResults(
      [{ offlineUuid: uuid(1), status: "algo-nuevo" as any }],
      d,
    );
    expect(result).toEqual({ synced: 0, conflicts: 0, retry: 1 });
    expect(d.markConflict).not.toHaveBeenCalled();
    expect(d.deleteLocal).not.toHaveBeenCalled();
  });

  it("reintenta cada vez con espera creciente y acotada", () => {
    expect(retryDelayMs(0)).toBe(15_000);
    expect(retryDelayMs(1)).toBe(30_000);
    expect(retryDelayMs(2)).toBe(60_000);
    expect(retryDelayMs(20)).toBe(300_000);
    expect(retryMessage(1)).toMatch(/se reintentará sola/);
    expect(retryMessage(3)).toMatch(/3 ventas.*se reintentarán solas/);
  });

  it("repreciar y reintentar con «retry» no marca conflicto y conserva la copia", async () => {
    const sale: any = {
      id: uuid(1),
      userId: "c",
      branchId: "main",
      status: "conflict",
      message: "Los precios o promociones cambiaron",
      createdAt: 1,
      input: {
        offlineUuid: uuid(1),
        cashSessionId: uuid(9),
        items: [{ variantId: uuid(5), qty: 1, discountPercent: 0 }],
        globalDiscount: 0,
        expectedTotal: 118,
        payments: [{ method: "cash", amount: 118 }],
      },
      receipt: { number: "LOCAL-1", total: 118 },
    };
    const products: any[] = [
      {
        id: uuid(6),
        taxRate: 18,
        variants: [{ id: uuid(5), price: "118", sku: "X" }],
        name: "Producto",
      },
    ];
    const updateLocal = vi.fn(async () => undefined);
    const recordResolution = vi.fn(async () => undefined);
    const deleteLocal = vi.fn(async () => undefined);
    const applied = await applyPendingSaleReprice(sale, products, [], true, {
      updateLocal,
      recordResolution,
      deleteLocal,
      syncOne: async () => ({ status: "retry", message: "ocupado" }),
    });
    expect(applied.synced.status).toBe("retry");
    expect(deleteLocal).not.toHaveBeenCalled();
    expect(recordResolution).not.toHaveBeenCalled();
    // Quedó «pendiente», nunca «conflict».
    expect(updateLocal).toHaveBeenCalledTimes(1);
    expect(updateLocal.mock.calls[0][1]).toMatchObject({ status: "pending" });
  });
});
