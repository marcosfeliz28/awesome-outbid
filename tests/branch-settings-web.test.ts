import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { describe, expect, it, vi } from "vitest";
import {
  QueryClient,
  QueryClientProvider,
} from "../apps/web/node_modules/@tanstack/react-query/build/modern/index.js";
import { BranchSettings } from "../apps/web/src/BranchSettings";

const state = { user: { id: "admin-1", permissions: ["*"] } };
vi.mock("../apps/web/src/api", () => ({
  api: vi.fn(),
  post: vi.fn(),
  useStore: (selector: (s: typeof state) => unknown) => selector(state),
}));

const webRequire = createRequire(resolve("apps/web/package.json"));
const { createElement } = webRequire("react") as typeof import("react");
const { renderToStaticMarkup } = webRequire(
  "react-dom/server",
) as typeof import("react-dom/server");

const render = () => {
  const client = new QueryClient();
  client.setQueryData(
    ["branches", "admin-1"],
    [
      {
        id: "main",
        name: "Principal",
        active: true,
        current: true,
        users: [{ id: "admin-1", name: "Dueña", role: "admin" }],
      },
      {
        id: "s2",
        name: "Santiago",
        active: true,
        current: false,
        users: [{ id: "u2", name: "Caja Santiago", role: "seller" }],
      },
      { id: "s3", name: "Vieja", active: false, current: false, users: [] },
    ],
  );
  return renderToStaticMarkup(
    createElement(
      QueryClientProvider,
      { client },
      createElement(BranchSettings),
    ),
  );
};

describe("Configuración › Sucursales", () => {
  it("lista sucursales, marca la actual y ofrece cambiarse, mover gente y crear", () => {
    const html = render();
    expect(html).toContain("Sucursales");
    expect(html).toContain("Principal</strong> · estás aquí");
    expect(html).toContain("Santiago");
    expect(html).toContain("Vieja</strong> · desactivada");
    expect(html).toContain("Cambiarme a esta sucursal");
    expect(html).toContain("Caja Santiago (seller)");
    expect(html).toContain("Crear sucursal");
    expect(html).toContain("no su inventario");
    // La persona no se mueve a una sucursal desactivada.
    expect(html).not.toMatch(/<option value="s3"/);
  });

  it("no se muestra a quien no es administración", () => {
    state.user.permissions = ["sale:manage"];
    try {
      expect(render()).toBe("");
    } finally {
      state.user.permissions = ["*"];
    }
  });

  it("aparece en Configuración del producto", () => {
    const management = readFileSync("apps/web/src/Management.tsx", "utf8");
    expect(management).toContain("{product && <BranchSettings />}");
  });
});
