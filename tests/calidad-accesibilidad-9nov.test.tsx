// @vitest-environment node
import React from "../apps/web/node_modules/react";
import { renderToStaticMarkup } from "../apps/web/node_modules/react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("../apps/web/src/api", () => ({
  api: vi.fn(),
  useStore: vi.fn(),
}));

import { AiUsageFeedback } from "../apps/web/src/AiUsage";

describe("calidad 9-nov · estado accesible del medidor de IA", () => {
  it("anuncia la carga como estado no intrusivo", () => {
    const html = renderToStaticMarkup(
      <AiUsageFeedback loading={true} error={false} />,
    );
    expect(html).toContain('role="status"');
    expect(html).toContain('aria-live="polite"');
    expect(html).toContain("Cargando");
  });

  it("anuncia el fallo como alerta y no conserva el estado de carga", () => {
    const html = renderToStaticMarkup(
      <AiUsageFeedback loading={false} error={true} />,
    );
    expect(html).toContain('role="alert"');
    expect(html).toContain("No se pudo cargar el uso de IA");
    expect(html).not.toContain('role="status"');
  });
});
