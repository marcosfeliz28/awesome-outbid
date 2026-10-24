import { afterEach, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  cashDrawerRequired,
  nativeOpenDrawer,
  nativePrintCurrentSheet,
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

it("PC-16: Tauri habilita el JSON que usa al autorizar la gaveta", () => {
  const cargo = readFileSync(
    join(import.meta.dirname, "../apps/web/src-tauri/Cargo.toml"),
    "utf8",
  );
  expect(cargo).toMatch(
    /reqwest\s*=\s*\{[^\n]*features\s*=\s*\[[^\]]*"json"/,
  );
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
  expect(invoke.mock.calls[0]?.[1]).not.toHaveProperty("openDrawer");
  const authorization = {
    accessToken: "token-de-prueba",
    mode: "manual" as const,
    operationId: "660e8400-e29b-41d4-a716-446655440000",
    reason: "Cambio solicitado por cliente",
    saleId: "550e8400-e29b-41d4-a716-446655440000",
  };
  await nativeOpenDrawer(authorization);
  expect(invoke).toHaveBeenLastCalledWith("open_cash_drawer", {
    printerName: "Térmica 80",
    accessToken: authorization.accessToken,
    mode: authorization.mode,
    operationId: authorization.operationId,
    reason: authorization.reason,
    saleId: authorization.saleId,
    movementId: null,
  });
});

it("PC-16: dos tickets seguidos consumen la autorización de gaveta una sola vez", () => {
  const authorization = {
    accessToken: "token-de-prueba",
    mode: "automatic" as const,
    operationId: "660e8400-e29b-41d4-a716-446655440000",
    reason: "Cobro en efectivo de la venta",
    saleId: "550e8400-e29b-41d4-a716-446655440000",
  };
  openDrawerOnNextPrint(authorization);
  expect(takeDrawerAuthorizationForNextPrint()).toEqual(authorization);
  expect(takeDrawerAuthorizationForNextPrint()).toBeNull();
});

it("PC-16: un fallo del API de gaveta no convierte el ticket impreso en error", async () => {
  const invoke = vi.fn()
    .mockResolvedValueOnce(null)
    .mockRejectedValueOnce(new Error("API no disponible"));
  setNativeInvokeForTest(invoke);
  vi.stubGlobal("localStorage", { getItem: () => "Térmica 80", setItem: vi.fn(), removeItem: vi.fn() });
  const preview = { style: { cssText: "" }, innerText: "NEXORA POS\nTicket 42", remove: vi.fn() };
  vi.stubGlobal("document", {
    querySelector: () => ({
      classList: { contains: () => false },
      cloneNode: () => preview,
    }),
    body: { appendChild: vi.fn() },
  });
  openDrawerOnNextPrint({
    accessToken: "token-de-prueba",
    mode: "automatic",
    operationId: "660e8400-e29b-41d4-a716-446655440000",
    reason: "Cobro en efectivo de la venta",
    saleId: "550e8400-e29b-41d4-a716-446655440000",
  });

  await expect(nativePrintCurrentSheet()).resolves.toEqual({ drawerError: "API no disponible" });
  expect(invoke).toHaveBeenNthCalledWith(1, "print_thermal", {
    printerName: "Térmica 80",
    text: "NEXORA POS\nTicket 42",
    columns: 48,
  });
  expect(invoke).toHaveBeenNthCalledWith(2, "open_cash_drawer", expect.any(Object));
});
