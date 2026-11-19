import { describe, expect, it, vi } from "vitest";
import { createRequire } from "node:module";
import { SalesController } from "../apps/api/src/sales";
import {
  bankGroup,
  amountCents,
  reconciliationCsv,
  selectedTotalCents,
  verifyOneByOne,
} from "../apps/web/src/transfer-reconciliation-utils";
const requireApi = createRequire(
  new URL("../apps/api/package.json", import.meta.url),
);
const { Prisma } = requireApi("@prisma/client");

const actor = {
  id: "admin",
  branchId: "sucursal-uno",
  permissions: ["sale:manage"],
  name: "Administradora",
  email: "admin@example.test",
  role: "manager",
};

describe("conciliación de transferencias", () => {
  it("lee solo pendientes de la sucursal con fecha dominicana y campos necesarios", async () => {
    const day = new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/Santo_Domingo",
    }).format(new Date());
    const paymentDate = new Date(day + "T14:00:00Z");
    const findMany = vi.fn().mockResolvedValue([
      {
        id: "pago-1",
        saleId: "venta-1",
        createdAt: paymentDate,
        amount: new Prisma.Decimal("1250.50"),
        bank: "Banco BHD",
        reference: "ABC-1",
        receivedById: null,
        cashSession: { userId: "cajera-1" },
        sale: {
          number: "FS-1",
          sellerId: "cajera-1",
          courierFee: new Prisma.Decimal(0),
          payments: [{ id: "pago-1" }],
          customer: { name: "Cliente de prueba" },
        },
      },
    ]);
    const users = vi
      .fn()
      .mockResolvedValue([{ id: "cajera-1", name: "Cajera Uno" }]);
    const db = { payment: { findMany }, user: { findMany: users } };
    const controller = new SalesController(db as never);
    const rows = await controller.pendingTransfers(actor, { date: day });
    expect(Reflect.getMetadata("permission", controller.pendingTransfers)).toBe(
      "sale:manage",
    );
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          method: "transfer",
          status: "pending_verification",
          sale: { branchId: "sucursal-uno", status: "completed" },
          createdAt: {
            gte: new Date(day + "T00:00:00-04:00"),
            lte: new Date(day + "T23:59:59.999-04:00"),
          },
        },
      }),
    );
    expect(rows).toEqual([
      {
        id: "pago-1",
        saleId: "venta-1",
        date: paymentDate.toISOString(),
        invoice: "FS-1",
        customer: "Cliente de prueba",
        amount: "1250.5",
        courierFee: "0.00",
        expected: "1250.50",
        difference: "0.00",
        bank: "Banco BHD",
        reference: "ABC-1",
        seller: "Cajera Uno",
        cashier: "Cajera Uno",
      },
    ]);
    expect(JSON.stringify(rows)).not.toContain("costTotal");
  });

  it("rechaza una fecha imposible antes de consultar pagos", async () => {
    const findMany = vi.fn();
    const controller = new SalesController({ payment: { findMany } } as never);
    await expect(
      controller.pendingTransfers(actor, {
        date: new Date().getUTCFullYear() + "-02-31",
      }),
    ).rejects.toThrow("Fecha inválida");
    expect(findMany).not.toHaveBeenCalled();
  });

  it("asigna el envío una sola vez aunque la factura tenga transferencias divididas", async () => {
    const payment = (id: string) => ({
      id,
      saleId: "venta-1",
      createdAt: new Date(),
      amount: new Prisma.Decimal("50"),
      bank: "BHD",
      reference: id,
      receivedById: null,
      cashSession: null,
      sale: {
        number: "FS-1",
        sellerId: "cajera-1",
        courierFee: new Prisma.Decimal("400"),
        payments: [{ id: "pago-2" }],
        customer: null,
      },
    });
    const db = {
      payment: {
        findMany: vi
          .fn()
          .mockResolvedValue([payment("pago-2"), payment("pago-1")]),
      },
      user: { findMany: vi.fn().mockResolvedValue([]) },
    };
    const rows = await new SalesController(db as never).pendingTransfers(
      actor,
      {},
    );
    expect(rows.map((row) => row.courierFee)).toEqual(["400.00", "0.00"]);
    expect(rows.map((row) => row.expected)).toEqual(["450.00", "50.00"]);
  });

  it("agrupa bancos, suma centavos exactos y exporta CSV seguro", () => {
    expect(bankGroup("Banco BHD León")).toBe("BHD");
    expect(bankGroup("Banco Popular Dominicano")).toBe("Popular");
    expect(bankGroup("Banreservas")).toBe("Banreservas");
    expect(bankGroup("Otro banco")).toBe("Otros");
    const rows = [
      {
        id: "1",
        saleId: "venta-1",
        date: new Date().toISOString(),
        invoice: "FS-1",
        customer: '=HYPERLINK("x")',
        amount: "0.10",
        courierFee: "0.00",
        expected: "0.10",
        difference: "0.00",
        bank: "BHD",
        reference: "+123",
        cashier: "A",
      },
      {
        id: "2",
        saleId: "venta-2",
        date: new Date().toISOString(),
        invoice: "FS-2",
        customer: "B",
        amount: "0.20",
        courierFee: "0.00",
        expected: "0.20",
        difference: "0.00",
        bank: "BHD",
        reference: "abc",
        cashier: "B",
      },
    ];
    expect(selectedTotalCents(rows, new Set(["1", "2"]))).toBe(30);
    expect(() => amountCents("999999999999999999999")).toThrow(
      "Monto inválido",
    );
    const csv = reconciliationCsv(rows);
    expect(csv).toContain("'=");
    expect(csv).toContain("'+123");
  });

  it("verifica una por una y conserva el resultado de cada fallo", async () => {
    const call = vi
      .fn()
      .mockResolvedValueOnce({ ok: true })
      .mockRejectedValueOnce(new Error("Pago cambiado"));
    const result = await verifyOneByOne(["1", "2"], call);
    expect(call.mock.calls).toEqual([["1"], ["2"]]);
    expect(result).toEqual([
      { id: "1", ok: true, message: "Verificada" },
      { id: "2", ok: false, message: "Pago cambiado" },
    ]);
  });
});
