import { describe, expect, it, vi } from "vitest";
import { requireLocalLicenseWrite } from "../apps/web/src/local-license";
const response = (mode: string, status = 200) =>
  ({ ok: status === 200, json: async () => ({ mode }) }) as Response;
describe("PC-19 caja offline", () => {
  it("solo permite guardar en cola cuando el servidor local autoriza escritura", async () => {
    const fetcher = vi.fn().mockResolvedValue(response("write"));
    await expect(
      requireLocalLicenseWrite(true, fetcher),
    ).resolves.toBeUndefined();
    expect(fetcher).toHaveBeenCalledWith("/api/local-license/status", {
      cache: "no-store",
    });
    fetcher.mockResolvedValue(response("read-only"));
    await expect(requireLocalLicenseWrite(true, fetcher)).rejects.toThrow(
      "solo lectura",
    );
    fetcher.mockResolvedValue(response("write", 404));
    await expect(requireLocalLicenseWrite(true, fetcher)).rejects.toThrow(
      "solo lectura",
    );
    fetcher.mockRejectedValue(new Error("offline"));
    await expect(requireLocalLicenseWrite(true, fetcher)).rejects.toThrow(
      "No se pudo comprobar",
    );
  });
});
