import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  businessErrorMessage,
  managementQueryError,
} from "../apps/web/src/managementMessages";

const management = readFileSync("apps/web/src/Management.tsx", "utf8");

describe("P3 · estados de administración", () => {
  it("conserva validaciones simples en español y oculta errores técnicos", () => {
    for (const message of [
      "Indica un monto positivo.",
      "Selecciona el cliente.",
      "Stock insuficiente.",
      "PIN incorrecto.",
    ])
      expect(businessErrorMessage({ message })).toBe(message);
    for (const message of [
      "Failed to fetch",
      "Prisma P2025",
      "Indica SELECT password FROM users",
      "Indica un monto.\nat internal.js:2",
      "{databasePassword: secreto}",
    ])
      expect(businessErrorMessage({ message })).toContain("Revisa los datos");
  });
  it.each([
    new Error("PrismaClientKnownRequestError P2025"),
    new TypeError("Failed to fetch"),
    { message: "SQL SELECT password FROM User" },
    null,
  ])("oculta detalles técnicos y ofrece una recuperación", (error) => {
    expect(managementQueryError(error)).toBe(
      "No pudimos cargar la información. Revisa tu conexión y pulsa Reintentar.",
    );
  });
  it("explica sesión y permisos sin mostrar el mensaje del servidor", () => {
    expect(managementQueryError({ status: 401 })).toContain("Vuelve a entrar");
    expect(managementQueryError({ status: 403 })).toContain("gerencia");
  });
  it("ofrece una acción concreta en las cinco pantallas vacías", () => {
    for (const suggestion of [
      "Revisa los filtros o agrega un producto con Nuevo producto.",
      "Revisa la búsqueda o registra una persona con Nuevo cliente.",
      "Revisa la búsqueda o registra una entrada de mercancía.",
      "Crea una Orden de compra para registrar tu próxima compra.",
      "Prueba otras fechas o registra una venta para consultar este reporte.",
    ])
      expect(management.includes(suggestion), suggestion).toBe(true);
  });

  it("no pasa errores técnicos sin filtrar al estado de consultas", () => {
    expect(management.includes("managementQueryError(query.error)")).toBe(true);
  });
  it("filtra errores de formularios y comprobantes de compras", () => {
    for (const file of ["helpers.tsx", "Purchases.tsx"]) {
      const source = readFileSync(`apps/web/src/${file}`, "utf8");
      expect(source.includes("setError(e.message)"), file).toBe(false);
      expect(source.includes("businessErrorMessage(e)"), file).toBe(true);
    }
  });
});
