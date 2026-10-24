import { describe, expect, it, vi } from "vitest";
import {
  merchandiseFailureStatus,
  syncMerchandiseRows,
} from "../apps/web/src/merchandise-sync";

const locked = () =>
  Object.assign(new Error("La licencia local está en solo lectura."), {
    status: 423,
    reason: "expired",
  });

describe("PC-19 mercancía pendiente durante solo lectura", () => {
  it("conserva el 423 como pendiente y lo sincroniza tras la renovación", async () => {
    const row = { id: "operacion-1", input: { direction: "entry" } };
    const remove = vi.fn(async () => undefined);
    const markPending = vi.fn(async () => undefined);
    const markConflict = vi.fn(async () => undefined);
    let renewed = false;
    const dependencies = {
      send: vi.fn(async () => {
        if (!renewed) throw locked();
      }),
      remove,
      markPending,
      markConflict,
      online: () => true,
    };

    expect(await syncMerchandiseRows([row], dependencies)).toEqual({
      synced: 0,
      conflicts: 0,
      retry: 1,
    });
    expect(markPending).toHaveBeenCalledWith(
      row.id,
      "La licencia local está en solo lectura.",
    );
    expect(markConflict).not.toHaveBeenCalled();
    expect(remove).not.toHaveBeenCalled();

    renewed = true;
    expect(await syncMerchandiseRows([row], dependencies)).toEqual({
      synced: 1,
      conflicts: 0,
      retry: 0,
    });
    expect(remove).toHaveBeenCalledWith(row.id);
  });

  it("también deja pendiente la captura inmediata y conserva conflictos reales", () => {
    expect(merchandiseFailureStatus(locked(), true)).toBe("pending");
    expect(
      merchandiseFailureStatus(
        Object.assign(new Error("Stock insuficiente"), { status: 409 }),
        true,
      ),
    ).toBe("conflict");
  });
});
