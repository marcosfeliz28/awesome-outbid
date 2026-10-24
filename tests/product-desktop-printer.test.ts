import { afterEach, expect, it, vi } from "vitest";
import {
  cashDrawerRequired,
  nativeOpenDrawer,
  nativePrintThermal,
  nativePrintTest,
  openDrawerOnNextPrint,
  prepareThermalText,
  setNativeInvokeForTest,
  takeDrawerAuthorizationForNextPrint,
} from "../apps/web/src/desktopPrinter";

afterEach(() => {
  setNativeInvokeForTest(null);
  vi.unstubAllGlobals();
});

it("PC-16: un ticket nativo conserva sus líneas y rechaza controles de impresora enviados por datos", () => {
  expect(prepareThermalText("NEXORA\r\nVenta 42\u001b\u001d\nTotal RD$ 100"))
    .toBe("NEXORA\nVenta 42\nTotal RD$ 100");
  expect(() => prepareThermalText("   ")).toThrow();
  expect(() => prepareThermalText("a".repeat(32769))).toThrow();
});

it("PC-16: la gaveta automática se abre solo si entró efectivo real", () => {
  expect(cashDrawerRequired([{ method: "card", amount: "100" }])).toBe(false);
  expect(cashDrawerRequired([{ method: "cash", amount: "0" }, { method: "transfer", amount: "100" }])).toBe(false);
  expect(cashDrawerRequired([{ method: "card", amount: "100" }, { method: "cash", amount: "50" }])).toBe(true);
});

it("PC-16: la prueba térmica no abre la gaveta; la apertura requiere otra orden", async () => {
  const invoke = vi.fn().mockResolvedValue(null);
  setNativeInvokeForTest(invoke);
  vi.stubGlobal("localStorage", { getItem: () => "Térmica 80", setItem: vi.fn(), removeItem: vi.fn() });
  await nativePrintTest();
  expect(invoke).toHaveBeenCalledWith("print_thermal", expect.objectContaining({
    printerName: "Térmica 80", columns: 48,
  }));
  const authorization = {
    accessToken: "token-de-prueba",
    saleId: "550e8400-e29b-41d4-a716-446655440000",
  };
  await nativeOpenDrawer(authorization);
  expect(invoke).toHaveBeenLastCalledWith("open_cash_drawer", {
    printerName: "Térmica 80",
    accessToken: authorization.accessToken,
    saleId: authorization.saleId,
    movementId: null,
    automatic: false,
  });
});

it("PC-16: dos tickets seguidos consumen la autorización automática una sola vez", async () => {
  const invoke = vi.fn().mockResolvedValue(null);
  setNativeInvokeForTest(invoke);
  vi.stubGlobal("localStorage", { getItem: () => "Térmica 80", setItem: vi.fn(), removeItem: vi.fn() });
  const authorization = {
    accessToken: "token-de-prueba",
    saleId: "550e8400-e29b-41d4-a716-446655440000",
    automatic: true,
  };
  openDrawerOnNextPrint(authorization);
  await nativePrintThermal("Ticket uno", 48);
  await nativePrintThermal("Ticket dos", 48);

  expect(invoke.mock.calls.map(([command]) => command)).toEqual([
    "print_thermal",
    "open_cash_drawer",
    "print_thermal",
  ]);
  expect(invoke).toHaveBeenNthCalledWith(2, "open_cash_drawer", expect.objectContaining({
    automatic: true,
    saleId: authorization.saleId,
  }));
  expect(takeDrawerAuthorizationForNextPrint()).toBeNull();
});

it("PC-16: si falla la bitácora, imprime el ticket primero y no abre la gaveta", async () => {
  const invoke = vi.fn(async (command: string) => {
    if (command === "open_cash_drawer") throw new Error("API no disponible");
    return null;
  });
  setNativeInvokeForTest(invoke);
  vi.stubGlobal("localStorage", { getItem: () => "Térmica 80", setItem: vi.fn(), removeItem: vi.fn() });
  openDrawerOnNextPrint({
    accessToken: "token-de-prueba",
    saleId: "550e8400-e29b-41d4-a716-446655440000",
    automatic: true,
  });

  await expect(nativePrintThermal("Ticket protegido", 48)).rejects.toThrow("API no disponible");
  expect(invoke.mock.calls.map(([command]) => command)).toEqual([
    "print_thermal",
    "open_cash_drawer",
  ]);
});
