// 05-A2 en la caja (sin navegador): qué se le dice a la cajera de cada
// conflicto, qué se manda a la bitácora al descartar y el aviso del cierre.
import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import {
  conflictHelp,
  discardWithApproval,
  pendingCloseMessage,
  pendingSaleDetail,
} from "../apps/web/src/pendingSales";

const sale: any = {
  id: "11111111-1111-4111-8111-111111111111",
  userId: "cajera",
  userName: "Camila López",
  branchId: "main",
  status: "conflict",
  message: "Stock insuficiente para Jogger Relax",
  createdAt: 1,
  input: {
    offlineUuid: "11111111-1111-4111-8111-111111111111",
    capturedAt: "2026-10-10T12:00:00.000Z",
    customerId: "c1",
    cashSessionId: "s1",
    items: [{ variantId: "v1", qty: 3 }],
    globalDiscount: 0,
    expectedTotal: 3150,
    payments: [{ method: "cash", amount: 3150 }],
  },
  receipt: {
    number: "LOCAL-11111111",
    total: 3150,
    snapshot: [
      {
        variantId: "v1",
        name: "Jogger Relax · M",
        sku: "JR-M",
        qty: 3,
        unitPrice: 1050,
        lineTotal: 3150,
      },
    ],
  },
};

describe("05-A2 · conflicto de una venta sin conexión", () => {
  it("cada conflicto dice qué hacer y quién lo resuelve", () => {
    expect(conflictHelp("Stock insuficiente para Jogger Relax")).toMatch(
      /gerencia que ajuste el inventario.*«Reintentar».*PIN/,
    );
    expect(
      conflictHelp("La venta offline supera el plazo máximo de 48 horas."),
    ).toMatch(/ya no se puede reintentar.*descarte con su PIN/);
    expect(conflictHelp("Las ventas sin conexión están desactivadas.")).toMatch(
      /ya no se puede reintentar/,
    );
    expect(
      conflictHelp("Los precios o promociones cambiaron; revisa la venta."),
    ).toContain("Actualizar precios y reintentar");
    expect(conflictHelp(undefined)).toMatch(/Reintentar.*gerencia/);
  });
  it("el descarte manda a la bitácora artículos y pagos y sólo después borra la copia local", async () => {
    const calls: string[] = [];
    const post = vi.fn(async (path: string) => {
      calls.push("post " + path);
    });
    const deleteLocal = vi.fn(async (id: string) => {
      calls.push("delete " + id);
    });
    await discardWithApproval(sale, "  Sin unidades  ", "234567", {
      post,
      deleteLocal,
    });
    expect(calls).toEqual([
      "post /sales/offline-review/discard",
      "delete " + sale.id,
    ]);
    expect(post.mock.calls[0][1]).toEqual({
      offlineUuid: sale.input.offlineUuid,
      reason: "Sin unidades",
      managerPin: "234567",
      detail: {
        receiptNumber: "LOCAL-11111111",
        total: 3150,
        capturedAt: "2026-10-10T12:00:00.000Z",
        items: [
          {
            variantId: "v1",
            name: "Jogger Relax · M",
            sku: "JR-M",
            qty: 3,
            unitPrice: 1050,
            lineTotal: 3150,
          },
        ],
        payments: [{ method: "cash", amount: 3150 }],
      },
    });
    // Si el servidor no lo acepta, la copia local no se toca.
    const failing = vi.fn(async () => {
      throw new Error("PIN incorrecto.");
    });
    const keep = vi.fn(async () => {});
    await expect(
      discardWithApproval(sale, "Motivo", "000000", {
        post: failing,
        deleteLocal: keep,
      }),
    ).rejects.toThrow("PIN incorrecto.");
    expect(keep).not.toHaveBeenCalled();
    // Gerencia con su sesión: sin PIN.
    const manager = vi.fn(async () => {});
    await discardWithApproval(sale, "Motivo", undefined, {
      post: manager,
      deleteLocal: async () => {},
    });
    expect(manager.mock.calls[0]).not.toHaveProperty("1.managerPin");
  });
  it("M-6: si el cliente se llevó la mercancía, el descarte lo manda al servidor", async () => {
    const post = vi.fn(async () => {});
    await discardWithApproval(
      sale,
      "Precio subió",
      "234567",
      { post, deleteLocal: async () => {} },
      "delivered",
    );
    expect((post.mock.calls[0] as any[])[1]).toMatchObject({
      outcome: "delivered",
    });
  });
  it("una venta de una versión vieja sin detalle manda al menos sus artículos", () => {
    const detail = pendingSaleDetail({
      ...sale,
      receipt: { number: "LOCAL-x" },
    });
    expect(detail.items).toEqual([
      { variantId: "v1", name: "Artículo", qty: 3 },
    ]);
    expect(detail.total).toBe(3150);
  });
  it("el cierre avisa cuántas ventas quedan y qué hacer", () => {
    expect(pendingCloseMessage(0, 0)).toBe("");
    expect(pendingCloseMessage(1, 1)).toMatch(
      /^Hay 1 venta guardada en este equipo .*\(1 requiere revisión\).*Sincronizar.*gerencia la descarta con su PIN/,
    );
    expect(pendingCloseMessage(3, 0)).toMatch(/^Hay 3 ventas guardadas/);
  });
  it("Caja: gerencia ve las ventas del equipo y la cajera puede pedir el descarte con PIN", () => {
    const management = readFileSync("apps/web/src/Management.tsx", "utf8");
    expect(management).toContain(
      "localDB.sales.filter((s) => s.branchId === user.branchId).toArray()",
    );
    expect(management).toContain('"Descartar con PIN de gerente"');
    expect(management).toContain('networkMode: "always"');
    expect(management).not.toContain("discardPendingSale(");
  });
});
