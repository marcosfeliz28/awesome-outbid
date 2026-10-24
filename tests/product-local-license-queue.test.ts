import { describe, expect, it } from "vitest";
import { sendLicenseAwareBatches } from "../apps/web/src/local-license";

const locked = (message: string, reason?: string) =>
  Object.assign(new Error(message), { status: 423, reason });

describe("PC-19 cola con licencia local", () => {
  it("aísla una captura inválida y deja pasar el resto del lote", async () => {
    const rows = Array.from({ length: 100 }, (_, index) => index + 1);
    const calls: number[][] = [];
    const result = await sendLicenseAwareBatches(rows, async (part) => {
      calls.push(part);
      if (part.includes(51)) throw locked("captura fuera de vigencia");
      return part.map((id) => "ok-" + id);
    });
    expect(result.accepted).toHaveLength(99);
    expect(result.accepted).toContain("ok-1");
    expect(result.accepted).toContain("ok-100");
    expect(result.rejected).toEqual([
      { row: 51, message: "captura fuera de vigencia" },
    ]);
    expect(calls).toContainEqual([51]);
  });

  it("no convierte un vencimiento global en conflicto", async () => {
    await expect(
      sendLicenseAwareBatches([1, 2], async () => {
        throw locked("licencia vencida", "expired");
      }),
    ).rejects.toMatchObject({ status: 423, reason: "expired" });
  });
});
