import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it, vi } from "vitest";
import {
  QueryClient,
  QueryClientProvider,
} from "../apps/web/node_modules/@tanstack/react-query/build/modern/index.js";
import {
  BranchSettings,
  isBranchPlanLimitMessage,
} from "../apps/web/src/BranchSettings";

const state = { user: { id: "admin-1", permissions: ["*"] } };
vi.mock("../apps/web/src/api", () => ({
  api: vi.fn(),
  post: vi.fn(),
  useStore: (selector: (value: typeof state) => unknown) => selector(state),
}));

const webRequire = createRequire(resolve("apps/web/package.json"));
const { createElement } = webRequire("react") as typeof import("react");
const { renderToStaticMarkup } = webRequire(
  "react-dom/server",
) as typeof import("react-dom/server");

function render() {
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
        users: [{ id: "u2", name: "Ana", role: "seller" }],
      },
      {
        id: "s3",
        name: "Cerrada",
        active: false,
        current: false,
        users: [],
      },
    ],
  );
  return renderToStaticMarkup(
    createElement(
      QueryClientProvider,
      { client },
      createElement(BranchSettings),
    ),
  );
}

describe("BranchSettings · tarjetas y acciones", () => {
  it("presenta estados, personas y acciones con jerarquía legible", () => {
    const html = render();
    expect(html).toContain('class="branch-settings"');
    expect(html).toContain('class="branch-grid"');
    expect(html).toContain("branch-card branch-card--current");
    expect(html).toContain("branch-card branch-card--inactive");
    expect(html).toContain("Sucursal actual");
    expect(html).toContain("Desactivada");
    expect(html).toContain('class="branch-card__people"');
    expect(html).toContain('class="branch-person-assignment field"');
    expect(html).toContain('class="branch-card__actions"');
  });

  it("reconoce y conserva el mensaje de límite que ya entrega la API", () => {
    const message =
      "El plan Autoservicio permite 1 sucursal. Desactiva una o cambia de plan en «Plan y facturación».";
    expect(isBranchPlanLimitMessage(message)).toBe(true);
    expect(isBranchPlanLimitMessage("La sucursal está desactivada.")).toBe(
      false,
    );
  });

  it("tiene contrato 390/1440, oscuro y texto de al menos 14 px", () => {
    const css = readFileSync("apps/web/src/styles.css", "utf8");
    expect(css).toContain(':root[data-theme="dark"] .branch-card');
    expect(css).toMatch(
      /\.branch-settings\s*\{[\s\S]*font-size:\s*max\(var\(--fs-min\),\s*14px\)/,
    );
    expect(css).toMatch(/@media \(max-width: 560px\)\s*\{[\s\S]*\.branch-grid/);
    expect(css).toContain(
      "grid-template-columns: repeat(auto-fit, minmax(280px, 1fr))",
    );
  });
});
