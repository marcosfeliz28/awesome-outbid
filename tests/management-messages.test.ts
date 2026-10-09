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
  it("Int P3: los mensajes de negocio de caja, lector y dinero SE VEN", () => {
    // Textos reales del POS y de la API que el filtro en lista blanca
    // ocultaba (auditoría del lote, P3-1).
    for (const message of [
      "Código no encontrado: 7501234567890.",
      "No hay suficiente stock de Camiseta Dry-Fit M (quedan 2).",
      "El código 123 es de 2 productos. Búscalo por nombre.",
      "No se agregó nada: el producto no tiene existencia.",
      "Abre tu caja antes de cobrar.",
      "Las salidas de efectivo de este turno superan RD$ 1,000.00: se requiere el PIN de un gerente.",
      "El fondo es menor que lo dejado en el último cierre (RD$ 500.00). Agrega una nota y el PIN de un gerente.",
      "No hay suficiente efectivo en tu caja para este reembolso.",
      "Verifica o rechaza primero los abonos por transferencia pendientes de esta venta.",
      "La venta tiene abonos. Usa una devolución.",
      "La venta excede el plazo de devolución.",
      "El código 7501 ya es de «Proteína Whey». Usa otro código o búscalo.",
    ])
      expect(businessErrorMessage({ message })).toBe(message);
  });
  it("Int P3: con el código de estado, 401/403 y los 4xx de negocio se explican", () => {
    expect(
      managementQueryError({ status: 404, message: "Venta no encontrada." }),
    ).toBe("Venta no encontrada.");
    expect(
      managementQueryError({ status: 400, message: "Prisma P2025 SELECT" }),
    ).toContain("Revisa los datos");
    expect(managementQueryError({ status: 500, message: "Boom" })).toContain(
      "Revisa tu conexión",
    );
    // api() adjunta el código de estado; sin él las ramas 401/403 no corrían.
    const api = readFileSync("apps/web/src/api.ts", "utf8");
    expect(api).toMatch(
      /Object\.assign\(new Error\(result\.message\),\s*\{\s*status: response\.status/,
    );
  });
  it("Int P3: los avisos (toast) no pasan por el filtro", () => {
    const helpers = readFileSync("apps/web/src/helpers.tsx", "utf8");
    expect(helpers).toContain("toastHandler(message, error);");
    expect(helpers).not.toMatch(
      /toastHandler\(\s*error \? businessErrorMessage/,
    );
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
