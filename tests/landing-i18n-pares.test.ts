// Cada texto traducible de la portada tiene su par ES/EN en la misma etiqueta, sin valores vacíos.
// Así el cambio de idioma nunca deja un texto sin traducir ni una etiqueta a medias.
import { readFileSync } from "node:fs";
import { expect, it } from "vitest";

const html = readFileSync("apps/web/public/venta/index.html", "utf8");
const etiquetas = html.match(/<[a-zA-Z][^>]*data-(es|en)=[^>]*>/g) ?? [];

it("la portada tiene al menos un texto traducible", () => {
  expect(etiquetas.length).toBeGreaterThan(20);
});

it("cada etiqueta con data-es tiene data-en y viceversa, y ninguno está vacío", () => {
  const sinPar = etiquetas.filter((t) => {
    const es = /data-es="([^"]*)"/.exec(t);
    const en = /data-en="([^"]*)"/.exec(t);
    return !es || !en || es[1].trim() === "" || en[1].trim() === "";
  });
  expect(sinPar).toEqual([]);
});

it("la portada no envía mensajes de WhatsApp con el nombre anterior", () => {
  expect(html).not.toMatch(/Nexora%20POS|Nexora POS/);
});
