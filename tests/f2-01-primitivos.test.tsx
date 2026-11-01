// @vitest-environment node
import React from "../packages/ui/node_modules/react";
import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "../apps/web/node_modules/react-dom/server";
import { expect, it } from "vitest";
import * as ui from "../packages/ui/src/index";

const DOCE = [
  "NxButton",
  "NxCard",
  "NxField",
  "NxBadge",
  "NxEmpty",
  "NxSkeleton",
  "NxToast",
  "NxTabs",
  "NxPageHeader",
  "NxProgress",
  "NxMoney",
  "NxAppShell",
];

it("exporta los 12 primitivos Nx*", () => {
  for (const n of DOCE)
    expect(typeof (ui as Record<string, unknown>)[n]).toBe("function");
});

it("renderiza con roles y etiquetas accesibles", () => {
  const h = (e: React.ReactElement) => renderToStaticMarkup(e);
  expect(h(<ui.NxMoney valor={1234.5} />)).toContain("RD$ 1,234.50");
  expect(h(<ui.NxMoney valor={null} />)).toContain("—");
  expect(h(<ui.NxToast tipo="error">x</ui.NxToast>)).toContain('role="alert"');
  expect(h(<ui.NxProgress valor={5} total={10} etiqueta="Avance" />)).toContain(
    'aria-valuenow="50"',
  );
  expect(h(<ui.NxField id="a" label="Nombre" error="Falta" />)).toContain(
    'aria-invalid="true"',
  );
  expect(h(<ui.NxEmpty titulo="Vacío" texto="t" />)).toContain('role="status"');
  expect(
    h(
      <ui.NxTabs
        etiqueta="T"
        pestanas={[
          { titulo: "A", contenido: "a" },
          { titulo: "B", contenido: "b" },
        ]}
      />,
    ),
  ).toContain('aria-selected="true"');
  expect(h(<ui.NxAppShell navegacion="n">c</ui.NxAppShell>)).toContain(
    'href="#contenido"',
  );
  expect(h(<ui.NxPageHeader titulo="Tablero" />)).toContain("<h1>Tablero</h1>");
});

it("los tokens de componente de los primitivos existen en tokens.css", () => {
  const css = readFileSync("packages/ui/src/nx-primitivos.css", "utf8");
  const tokens = readFileSync("packages/ui/src/tokens.css", "utf8");
  for (const v of new Set(css.match(/--nx-[a-z0-9-]+/g)))
    expect(tokens + css).toContain(`${v}:`);
});
