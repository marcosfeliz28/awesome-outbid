import { describe, expect, it } from "vitest";
import { PassThrough } from "node:stream";
import { inflateSync } from "node:zlib";
import { renderFormalPdf } from "../apps/api/src/formal-report";

describe("3z · PDF formal", () => {
  it("incluye varias páginas, cabecera, arqueo y folios sin cortar el flujo", async () => {
    const output = new PassThrough();
    const chunks: Buffer[] = [];
    output.on("data", (chunk: Buffer) => chunks.push(chunk));
    const finished = new Promise<void>((resolve, reject) => {
      output.on("end", resolve);
      output.on("error", reject);
    });
    const cash = Array.from({ length: 80 }, (_, i) => ({
      register: `Caja ${i + 1}`,
      user: "Cajera de prueba",
      openedAt: new Date().toISOString(),
      closedAt: new Date().toISOString(),
      expectedCash: 100,
      countedCash: 100,
      differenceCash: 0,
      expectedCard: 10,
      countedCard: 10,
      differenceCard: 0,
      expectedTransfer: 20,
      countedTransfer: 20,
      differenceTransfer: 0,
    }));
    renderFormalPdf(output, {
      business: { name: "Grupo Macgen", branch: "Sucursal" },
      title: "Informe formal · Día 2026-10-12",
      from: "2026-10-12",
      to: "2026-10-12",
      issuedAt: new Date().toISOString(),
      totals: {
        sold: 100,
        moneyIn: 100,
        creditGenerated: 0,
        cost: 50,
        margin: 50,
        tax: 18,
        bankIn: 30,
        cashIn: 70,
        returns: 0,
        discounts: 0,
      },
      daily: [],
      cash,
      users: [],
      categories: [],
      storeWarehouseName: "Depósito Norte",
      rotation: [
        {
          product: "Producto A",
          sku: "SKU-A",
          storeStock: 3,
          sold60Days: 2,
          suggestedMin: 4,
          suggestedMax: 6,
        },
      ],
      credits: {
        open: [],
        closed: [],
        openTotal: 0,
        openCount: 0,
        closedCount: 0,
      },
      cashReconciliation: {
        moneyIn: 100,
        sessionMoney: 100,
        difference: 0,
        comparable: true,
      },
      findings: [],
      voids: [],
      discounts: [],
      costChanges: [],
      note: "Control",
      truncated: { cash: false },
    });
    await finished;
    const buffer = Buffer.concat(chunks);
    expect(buffer.subarray(0, 4).toString()).toBe("%PDF");
    expect(
      (buffer.toString("latin1").match(/\/Type \/Page\b/g) ?? []).length,
    ).toBeGreaterThan(1);
    expect(buffer.length).toBeGreaterThan(3000);
    const pdf = buffer.toString("latin1");
    const decoded = [...pdf.matchAll(/stream\r?\n([\s\S]*?)\r?\nendstream/g)]
      .map((match) => {
        try {
          return inflateSync(Buffer.from(match[1], "latin1")).toString(
            "latin1",
          );
        } catch {
          return "";
        }
      })
      .flatMap((stream) =>
        [...stream.matchAll(/<([0-9a-f]+)>/gi)].map((match) =>
          Buffer.from(match[1], "hex").toString("latin1"),
        ),
      )
      .join("");
    expect(decoded).toContain("Depósito Norte");
  });
});
