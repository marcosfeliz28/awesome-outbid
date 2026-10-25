import { describe, expect, it, vi } from "vitest";
import { assessTransferProof, parseTransferProof, TransferProofReviewController } from "../apps/api/src/transfer-proof-review";

const saved = { bank: "BHD", reference: "827647262", amount: "1500.00" };

describe("N-08 · lectura de comprobante de transferencia", () => {
  it("extrae sólo banco, fecha, referencia y monto de JSON estricto", () => {
    expect(parseTransferProof('{"bank":"BHD","date":"2026-10-24","reference":"827647262","amount":"1500.00"}'))
      .toEqual({ bank: "BHD", date: "2026-10-24", reference: "827647262", amount: "1500.00" });
    expect(parseTransferProof('{"bank":"BHD","date":"2026-02-30","reference":"827647262","amount":"1500.00"}')).toBeNull();
    expect(parseTransferProof('{"bank":"BHD","date":"2026-10-24","reference":"827647262","amount":"1500.00","tenantId":"otro"}')).toBeNull();
  });
  it("propone verificar sólo si coincide y la referencia no está repetida", () => {
    expect(assessTransferProof(saved, { bank: "BHD", date: "2026-10-24", reference: "827647262", amount: "1500.00" }, false).recommendation).toBe("verificar");
    expect(assessTransferProof({ ...saved, bank: "Banco BHD" }, { bank: "BHD", date: "2026-10-24", reference: "827647262", amount: "1500.00" }, false).recommendation).toBe("verificar");
  });
  it("advierte referencia repetida y no propone verificar", () => {
    const result = assessTransferProof(saved, { bank: "BHD", date: "2026-10-24", reference: "827647262", amount: "1500.00" }, true);
    expect(result.recommendation).toBe("revisar");
    expect(result.warnings.join(" ")).toMatch(/ya se usó/);
  });
  it("señala referencias de prueba sin afirmar que son fraude", () => {
    const result = assessTransferProof(saved, { bank: "BHD", date: "2026-10-24", reference: "1111", amount: "1500.00" }, false);
    expect(result.recommendation).toBe("rechazar");
    expect(result.warnings.join(" ")).toMatch(/no verificable/);
  });
  it("mantiene la decisión humana ante monto o banco diferentes", () => {
    const result = assessTransferProof(saved, { bank: "Popular", date: "2026-10-24", reference: "827647262", amount: "1200.00" }, false);
    expect(result.recommendation).toBe("revisar");
    expect(result.warnings.join(" ")).toMatch(/banco|monto/);
  });
  it("consulta sólo la sucursal autenticada y no verifica ni rechaza el pago", async () => {
    const old = process.env.ANTHROPIC_API_KEY;
    process.env.ANTHROPIC_API_KEY = "falsa-de-prueba";
    const findFirst = vi.fn()
      .mockResolvedValueOnce({ id: "10000000-0000-4000-8000-000000000001", bank: "BHD", reference: "827647262", amount: "1500.00",
        proofUrl: "data:image/png;base64,aGVsbG8=" })
      .mockResolvedValueOnce(null);
    const db: any = { payment: { findFirst } };
    const limits: any = { assert: vi.fn() };
    const actor: any = { id: "u1", tenantId: "t1", branchId: "local" };
    const extract = vi.fn().mockResolvedValue({ bank: "BHD", date: "2026-10-24", reference: "827647262", amount: "1500.00" });
    try {
      const result = await new TransferProofReviewController(db, limits).review("10000000-0000-4000-8000-000000000001", actor, extract);
      expect(result.recommendation).toBe("verificar");
      expect(findFirst.mock.calls[0][0].where.sale.branchId).toBe("local");
      expect(findFirst.mock.calls[1][0].where.sale.branchId).toBe("local");
      expect(Object.keys(db.payment)).toEqual(["findFirst"]);
      expect(extract).toHaveBeenCalledWith(Buffer.from("hello"), "image/png", "falsa-de-prueba");
    } finally {
      if (old === undefined) delete process.env.ANTHROPIC_API_KEY; else process.env.ANTHROPIC_API_KEY = old;
    }
  });
});
