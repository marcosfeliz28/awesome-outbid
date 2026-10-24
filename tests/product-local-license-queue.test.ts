import { describe, expect, it } from "vitest";
import { sendLicenseAwareBatches } from "../apps/web/src/local-license";

const locked = (message: string, reason?: string) =>
  Object.assign(new Error(message), { status: 423, reason });

describe("PC-19 cola con licencia local", () => {
  it("aísla una captura inválida y deja pasar el resto del lote", async () => {
    const calls: number[][] = [];
    const result = await sendLicenseAwareBatches([1, 2, 3], async (rows) => {
      calls.push(rows);
      if (rows.includes(2)) throw locked("captura fuera de vigencia");
      return rows.map((id) => "ok-" + id);
    });
    expect(result.accepted).toEqual(["ok-1", "ok-3"]);
    expect(result.rejected).toEqual([
      { row: 2, message: "captura fuera de vigencia" },
    ]);
    expect(calls).toContainEqual([1]);
    expect(calls).toContainEqual([3]);
  });

  it("no convierte un vencimiento global en conflicto", async () => {
    await expect(
      sendLicenseAwareBatches([1, 2], async () => {
        throw locked("licencia vencida", "expired");
      }),
    ).rejects.toMatchObject({ status: 423, reason: "expired" });
  });
});
