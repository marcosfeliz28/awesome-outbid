import { afterEach, expect, it, vi } from "vitest";
import { cashDrawerRequired, nativeOpenDrawer, nativePrintTest, prepareThermalText } from "../apps/web/src/desktopPrinter";

afterEach(() => vi.unstubAllGlobals());

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
  vi.stubGlobal("window", { __TAURI__: { core: { invoke } } });
  vi.stubGlobal("localStorage", { getItem: () => "Térmica 80", setItem: vi.fn(), removeItem: vi.fn() });
  await nativePrintTest();
  expect(invoke).toHaveBeenCalledWith("print_thermal", expect.objectContaining({
    printerName: "Térmica 80", columns: 48, openDrawer: false,
  }));
  await nativeOpenDrawer();
  expect(invoke).toHaveBeenLastCalledWith("open_cash_drawer", { printerName: "Térmica 80" });
});
