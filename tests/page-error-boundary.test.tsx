// @vitest-environment node
import React from "../packages/ui/node_modules/react";
import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "../apps/web/node_modules/react-dom/server";
import { expect, it } from "vitest";
import { PageErrorBoundary } from "../apps/web/src/PageErrorBoundary";

// EST-03: una pantalla que falla no deja toda la app en blanco.
it("sin fallo muestra la pantalla tal cual", () => {
  const b = new PageErrorBoundary({
    page: "reports",
    children: React.createElement("p", null, "contenido"),
  });
  expect(renderToStaticMarkup(b.render() as React.ReactElement)).toContain(
    "contenido",
  );
});

it("con fallo muestra un aviso con Reintentar y Volver a Caja, sin el contenido", () => {
  expect(PageErrorBoundary.getDerivedStateFromError()).toEqual({
    failed: true,
  });
  const b = new PageErrorBoundary({
    page: "reports",
    children: React.createElement("p", null, "contenido"),
  });
  b.state = { failed: true };
  const html = renderToStaticMarkup(b.render() as React.ReactElement);
  expect(html).toContain("Esta pantalla tuvo un problema");
  expect(html).toContain("Reintentar");
  expect(html).toContain("Volver a Caja");
  expect(html).toContain('role="alert"');
  expect(html).not.toContain("contenido");
});

it("App envuelve solo la pantalla activa, con una clave por pantalla", () => {
  const app = readFileSync("apps/web/src/App.tsx", "utf8");
  expect(app).toMatch(
    /<PageErrorBoundary\s+key=\{page\.split\("\?"\)\[0\]\}\s+page=\{page\}\s+onRetry=\{\(\) => void client\.resetQueries\(\)\}/,
  );
  const main = app.indexOf("<main");
  const boundary = app.indexOf("<PageErrorBoundary");
  const footer = app.indexOf("<footer");
  expect(boundary).toBeGreaterThan(main);
  expect(boundary).toBeLessThan(footer);
});

it("el aviso a monitoreo lleva solo el nombre de la pantalla", () => {
  const src = readFileSync("apps/web/src/monitoring.ts", "utf8");
  expect(src).toContain(
    'captureMessage("ui-render-error: " + page.split("?")[0]',
  );
});

it("Reintentar vuelve a pedir las respuestas guardadas antes de dibujar de nuevo", () => {
  const src = readFileSync("apps/web/src/PageErrorBoundary.tsx", "utf8");
  expect(src).toMatch(
    /this\.props\.onRetry\?\.\(\);\s+this\.setState\(\{ failed: false \}\)/,
  );
});
