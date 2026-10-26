import { createRequire } from "node:module";
import { resolve } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { QueryClient, QueryClientProvider } from "../apps/web/node_modules/@tanstack/react-query/build/modern/index.js";
import { NcfSequenceSettings } from "../apps/web/src/NcfSequenceSettings";

vi.mock("../apps/web/src/productTenancy", () => ({ productTenancyRequired: () => true }));
vi.mock("../apps/web/src/api", () => ({
  api: vi.fn(), post: vi.fn(),
  useStore: (selector: (state: { user: { id: string } }) => unknown) =>
    selector({ user: { id: "admin-1" } }),
}));

const webRequire = createRequire(resolve("apps/web/package.json"));
const { createElement } = webRequire("react") as typeof import("react");
const { renderToStaticMarkup } = webRequire("react-dom/server") as typeof import("react-dom/server");

describe("PC-13: configuración visible solo como inventario declarado", () => {
  it("empieza sin secuencias ni números fiscales inventados", () => {
    const client = new QueryClient();
    client.setQueryData(["ncf-sequences", "admin-1"], []);
    const html = renderToStaticMarkup(createElement(QueryClientProvider, { client },
      createElement(NcfSequenceSettings)));
    expect(html).toContain("No hay secuencias declaradas");
    expect(html).toContain("Los avisos fiscales están inactivos");
    expect(html).not.toContain("00000000");
  });

  it("muestra datos manuales y alertas sin presentar emisión ni validez fiscal", () => {
    const client = new QueryClient();
    client.setQueryData(["ncf-sequences", "admin-1"], [{
      id: "00000000-0000-0000-0000-000000000333", type: "B01",
      authorizationReference: "REFERENCIA-DE-PRUEBA", firstNumber: "00000001",
      lastNumber: "00000025", nextNumber: "00000007", numberWidth: 8,
      nextConfirmedAt: "2026-10-24T12:00:00.000Z",
      expiryApplies: true, expiresOn: "2027-01-15", active: true,
      updatedAt: "2026-10-24T00:00:00.000Z",
      warnings: [{ kind: "numbers", message: "Quedan 19 números declarados." }],
    }]);
    const html = renderToStaticMarkup(createElement(QueryClientProvider, { client },
      createElement(NcfSequenceSettings)));
    expect(html).toContain("Avisos de secuencias NCF");
    expect(html).toContain("si no, Nexora no emite NCF");
    expect(html).toContain("no consulta la DGII ni certifica que una secuencia esté vigente");
    expect(html).toContain("00000001");
    expect(html).toContain("00000025");
    expect(html).toContain("Quedan 19 números declarados.");
  });
});
