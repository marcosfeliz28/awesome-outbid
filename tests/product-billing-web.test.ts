import { createRequire } from "node:module";
import { resolve } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { QueryClient, QueryClientProvider } from "../apps/web/node_modules/@tanstack/react-query/build/modern/index.js";
import { Billing } from "../apps/web/src/Billing";

vi.mock("../apps/web/src/api", () => ({ api: vi.fn() }));

const webRequire = createRequire(resolve("apps/web/package.json"));
const { createElement } = webRequire("react") as typeof import("react");
const { renderToStaticMarkup } = webRequire("react-dom/server") as typeof import("react-dom/server");
const renderWithProviders = (providers: { kind: "test" | "bank_transfer"; instructions: { bank: string; account: string; holder: string } | null }[]) => {
  const cache = new QueryClient();
  cache.setQueryData(["billing-plans"], [{ id: "autoservicio", monthlyPrice: 990, currency: "DOP" }]);
  cache.setQueryData(["billing-providers"], providers);
  cache.setQueryData(["billing-requests"], []);
  return renderToStaticMarkup(createElement(QueryClientProvider, { client: cache }, createElement(Billing)));
};

describe("facturación en modo de prueba", () => {
  it("muestra la simulación sin dinero sólo cuando la API habilita el proveedor de prueba", () => {
    const simulated = renderWithProviders([{ kind: "test", instructions: null }]);
    expect(simulated).toContain("Crear solicitud de prueba");
    expect(simulated).toContain("No mueve dinero real");
    expect(simulated).not.toContain("Solicitar pago por transferencia");

    const bankOnly = renderWithProviders([{ kind: "bank_transfer", instructions: {
      bank: "Banco ficticio", account: "000TEST", holder: "Nexora prueba",
    } }]);
    expect(bankOnly).toContain("Solicitar pago por transferencia");
    expect(bankOnly).not.toContain("Crear solicitud de prueba");
  });
});
