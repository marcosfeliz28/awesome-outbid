import { describe, expect, it } from "vitest";
import {
  receivableApprovalReason,
  receivableApprovalMessage,
  receivableNeedsApproval,
  margin,
} from "../packages/shared/src/index";

describe("3x · misma decisión y motivo del PIN", () => {
  const config = {
    allowCreditSales: true,
    creditApprovalThreshold: 1000,
    receivableShiftLimit: 3000,
  };
  const cod = (amount: number) => [{ method: "cod", amount }];
  it("distingue importe, deuda acumulada, turno e interruptor apagado", () => {
    expect(receivableApprovalReason(cod(1001), config, false)).toBe("amount");
    expect(receivableApprovalReason(cod(500), config, false, 600)).toBe(
      "client_debt",
    );
    expect(receivableApprovalReason(cod(500), config, false, 0, 2600)).toBe(
      "shift_limit",
    );
    expect(
      receivableApprovalReason(
        cod(1),
        { ...config, allowCreditSales: false },
        false,
      ),
    ).toBe("credit_disabled");
    expect(receivableApprovalReason(cod(1000), config, false)).toBeNull();
  });
  it("no cambia la regla booleana, incluso umbrales cero y administración", () => {
    const previous = (
      method: string,
      amount: number,
      settings: typeof config,
      manage: boolean,
      debt: number,
      shift: number,
    ) => {
      const credit = method === "credit" ? amount : 0,
        cod = method === "cod" ? amount : 0;
      if (credit > settings.creditApprovalThreshold) return true;
      if (
        !manage &&
        credit + cod > 0 &&
        debt + credit + cod > settings.creditApprovalThreshold
      )
        return true;
      if (
        !manage &&
        credit + cod > 0 &&
        shift + credit + cod > settings.receivableShiftLimit
      )
        return true;
      if (manage || cod <= 0) return false;
      return (
        settings.allowCreditSales !== true ||
        cod > settings.creditApprovalThreshold
      );
    };
    for (const settings of [
      config,
      { ...config, creditApprovalThreshold: 0, receivableShiftLimit: 0 },
      { ...config, allowCreditSales: false },
    ])
      for (const amount of [0, 1, 999, 1001])
        for (const manage of [false, true])
          for (const method of ["cod", "credit"])
            for (const debt of [0, 600])
              for (const shift of [0, 2600])
                expect(
                  receivableNeedsApproval(
                    [{ method, amount }],
                    settings,
                    manage,
                    debt,
                    shift,
                  ),
                ).toBe(previous(method, amount, settings, manage, debt, shift));
    expect(receivableApprovalReason(cod(1001), config, true)).toBeNull();
    expect(
      receivableApprovalReason(
        [{ method: "credit", amount: 1001 }],
        config,
        true,
      ),
    ).toBe("amount");
  });
  it("explica cada motivo y calcula margen sin restar ITBIS", () => {
    expect(receivableApprovalMessage("amount", config)).toContain(
      "monto a crédito",
    );
    expect(receivableApprovalMessage("client_debt", config)).toContain(
      "deuda pendiente",
    );
    expect(receivableApprovalMessage("shift_limit", config)).toContain("turno");
    expect(receivableApprovalMessage("credit_disabled", config)).toContain(
      "deshabilitadas",
    );
    expect(margin(43800, 36300)).toBeCloseTo(17.12, 2);
  });
});
