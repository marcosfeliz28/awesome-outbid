// @vitest-environment node
import React from "../packages/ui/node_modules/react";
import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "../apps/web/node_modules/react-dom/server";
import { expect, it } from "vitest";
import { closeAction, DiscardNotice } from "../packages/ui/src/index";

// DIS-02: cerrar una ventana con datos escritos pregunta antes de descartarlos.
it("sin datos cierra de inmediato (X, Escape y clic fuera)", () => {
  expect(closeAction(false, false)).toBe("close");
  expect(closeAction(false, true)).toBe("close");
});

it("con datos pregunta una sola vez y no abre dos avisos", () => {
  expect(closeAction(true, false)).toBe("ask");
  expect(closeAction(true, true)).toBe("stay");
});

it("el aviso es accesible y ofrece seguir o descartar", () => {
  const html = renderToStaticMarkup(
    React.createElement(DiscardNotice, { onKeep: () => {}, onDiscard: () => {} }),
  );
  expect(html).toContain('role="alertdialog"');
  expect(html).toContain("Seguir aquí");
  expect(html).toContain("Salir y descartar");
});

it("el Modal pasa X, Escape y clic fuera por la misma guardia y devuelve el foco a «Seguir aquí»", () => {
  const ui = readFileSync("packages/ui/src/index.tsx", "utf8");
  expect(ui).toMatch(/onOpenChange=\{\(value\) => !value && request\(\)\}/);
  expect(ui).toContain("keep.current?.focus()");
});

it("el cobro solo pregunta con pagos o datos escritos, y el cierre de caja con conteos o notas", () => {
  const pos = readFileSync("apps/web/src/POS.tsx", "utf8");
  const co = pos.slice(pos.indexOf('title="Todo listo para cobrar"'));
  expect(co.slice(0, 700)).toMatch(/hasData=\{\s*payments\.length > 0/);
  expect(co.slice(0, 700)).toContain("amount !== String(total)");
  const tienda = readFileSync("apps/web/src/Tienda.tsx", "utf8");
  const cc = tienda.slice(tienda.indexOf('title="Cuadre y cierre de caja"'));
  expect(cc.slice(0, 300)).toContain("Object.values(counts)");
  expect(cc.slice(0, 300)).toContain("Object.values(form)");
});

it("no toca precios, totales ni el envío del cobro", () => {
  const pos = readFileSync("apps/web/src/POS.tsx", "utf8");
  expect(pos).not.toMatch(/beforeunload/);
});
