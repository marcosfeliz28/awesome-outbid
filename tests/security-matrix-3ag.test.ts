import { describe, expect, it, vi } from "vitest";
import { randomUUID } from "node:crypto";
import { CatalogController } from "../apps/api/src/catalog";

const actor: any = {
  id: randomUUID(),
  branchId: "qa-matrix",
  role: "admin",
  permissions: ["*"],
};

const attributes = (sizes: number[]) =>
  Object.fromEntries(
    sizes.map((size, index) => [
      "qa-matrix-" + index,
      Array.from({ length: size }, (_, value) => String(value)),
    ]),
  );

// Intercepta sólo el producto cartesiano de esta entrada. Si la versión
// vulnerable intenta materializar >500, detiene el trabajo tras el primer
// grupo (como máximo 30 objetos), antes de consumir memoria sin límite.
async function withMatrixBudget<T>(work: () => Promise<T>) {
  const flatMap = Array.prototype.flatMap;
  let maxProjection = 0;
  let materializedInStage = 0;
  let maxMaterializedInStage = 0;
  Array.prototype.flatMap = function (callback: any, thisArg?: any) {
    materializedInStage = 0;
    return flatMap.call(this, (value: any, index: number, array: any[]) => {
      const mapped = callback.call(thisArg, value, index, array);
      if (
        Array.isArray(mapped) &&
        mapped.length &&
        mapped.every(
          (row) =>
            row &&
            typeof row === "object" &&
            Object.keys(row).some((key) => key.startsWith("qa-matrix-")),
        )
      ) {
        materializedInStage += mapped.length;
        maxMaterializedInStage = Math.max(
          maxMaterializedInStage,
          materializedInStage,
        );
        const projection = array.length * mapped.length;
        maxProjection = Math.max(maxProjection, projection);
        if (projection > 500)
          throw new Error(
            "Instrumentación: se intentó materializar una matriz superior a 500.",
          );
      }
      return mapped;
    });
  } as typeof Array.prototype.flatMap;
  try {
    let result: T | undefined;
    let error: unknown;
    try {
      result = await work();
    } catch (caught) {
      error = caught;
    }
    return { result, error, maxProjection, maxMaterializedInStage };
  } finally {
    Array.prototype.flatMap = flatMap;
  }
}

const setup = () => {
  const id = randomUUID();
  const tx = {
    variant: {
      count: vi.fn().mockResolvedValue(0),
      create: vi.fn().mockImplementation(async ({ data }) => ({
        id: randomUUID(),
        ...data,
      })),
    },
    $queryRaw: vi.fn().mockResolvedValue([]),
    auditLog: { create: vi.fn().mockResolvedValue({}) },
  };
  const db = {
    product: {
      findFirstOrThrow: vi.fn().mockResolvedValue({ id, sku: "QA-MATRIX" }),
    },
    $transaction: vi.fn().mockImplementation(async (work) => work(tx)),
  };
  return { id, db, tx, controller: new CatalogController(db as any) };
};

describe("3ag · presupuesto de memoria de las matrices de variantes", () => {
  it("rechaza 30×30×30 antes de materializar más de 500 y antes de escribir", async () => {
    const { controller, id, db, tx } = setup();
    const outcome = await withMatrixBudget(() =>
      controller.variants(
        id,
        {
          attributes: attributes([30, 30, 30]),
          price: 10,
          costAvg: 2,
        },
        actor,
      ),
    );
    expect(outcome.error).toMatchObject({
      status: 400,
      message: "La matriz no puede exceder 500 variantes.",
    });
    expect(outcome.maxProjection).toBeLessThanOrEqual(500);
    expect(outcome.maxMaterializedInStage).toBeLessThanOrEqual(500);
    expect(db.$transaction).not.toHaveBeenCalled();
    expect(tx.variant.create).not.toHaveBeenCalled();
  });

  it("permite exactamente 500 variantes y conserva sucursal, precios y auditoría", async () => {
    const { controller, id, db, tx } = setup();
    const outcome = await withMatrixBudget(() =>
      controller.variants(
        id,
        {
          attributes: attributes([5, 10, 10]),
          price: 10,
          costAvg: 2,
        },
        actor,
      ),
    );
    expect(outcome.error).toBeUndefined();
    expect(outcome.result).toHaveLength(500);
    expect(outcome.maxProjection).toBeLessThanOrEqual(500);
    expect(outcome.maxMaterializedInStage).toBeLessThanOrEqual(500);
    expect(db.$transaction).toHaveBeenCalledOnce();
    expect(tx.variant.create).toHaveBeenCalledTimes(500);
    expect(tx.variant.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        branchId: actor.branchId,
        productId: id,
        price: 10,
        costAvg: 2,
      }),
    });
    expect(tx.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: "matrix",
        entityId: id,
        after: { count: 500 },
        branchId: actor.branchId,
      }),
    });
  });
});
