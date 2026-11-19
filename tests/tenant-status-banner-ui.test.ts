import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it, vi } from "vitest";
import {
  QueryClient,
  QueryClientProvider,
} from "../apps/web/node_modules/@tanstack/react-query/build/modern/index.js";
import { TenantStatusBanner } from "../apps/web/src/TenantStatusBanner";

vi.mock("../apps/web/src/api", () => ({ api: vi.fn() }));

const webRequire = createRequire(resolve("apps/web/package.json"));
const { createElement } = webRequire("react") as typeof import("react");
const { renderToStaticMarkup } = webRequire(
  "react-dom/server",
) as typeof import("react-dom/server");

function render(admin: boolean) {
  const client = new QueryClient();
  client.setQueryData(["tenant-status"], {
    status: "past_due",
    notice: { kind: "overdue_2", message: "Tu plan venció ayer." },
    supportContact: "WhatsApp 809-555-0100",
  });
  return renderToStaticMarkup(
    createElement(
      QueryClientProvider,
      { client },
      createElement(TenantStatusBanner, { admin, onPay: () => undefined }),
    ),
  );
}

describe("TenantStatusBanner · presentación por rol", () => {
  it("da a administración contexto, contacto y una acción principal", () => {
    const html = render(true);
    expect(html).toContain(
      'class="support-mode-banner tenant-status-banner tenant-status-banner--urgent"',
    );
    expect(html).toContain("Atención de facturación");
    expect(html).toContain("Tu plan venció ayer.");
    expect(html).toContain("WhatsApp 809-555-0100");
    expect(html).toContain(
      'class="button primary tenant-status-banner__action"',
    );
    expect(html).toContain("Ir a Plan y facturación");
  });

  it("mantiene para caja una sola línea discreta sin contacto ni CTA", () => {
    const html = render(false);
    expect(html).toContain('class="tenant-status-note"');
    expect(html.match(/<p\b/g)).toHaveLength(1);
    expect(html).not.toContain("WhatsApp");
    expect(html).not.toContain("<button");
  });

  it("tiene contrato responsive, oscuro y tipografía mínima", () => {
    const css = readFileSync("apps/web/src/styles.css", "utf8");
    expect(css).toContain(':root[data-theme="dark"] .tenant-status-banner');
    expect(css).toMatch(
      /\.tenant-status-banner\s*\{[\s\S]*font-size:\s*max\(var\(--fs-min\),\s*14px\)/,
    );
    expect(css).toMatch(
      /@media \(max-width: 560px\)\s*\{[\s\S]*\.tenant-status-banner/,
    );
  });
});
