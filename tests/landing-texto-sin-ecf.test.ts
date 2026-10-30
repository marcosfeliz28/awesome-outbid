// Textos de la landing: sin e-CF ni promesas de DGII (e-CF está en pausa y no se ofrece en v1),
// y con el nombre Norexos. La única mención permitida es la nota de revisión que pide quitarla.
import { readFileSync } from "node:fs";
import { expect, it } from "vitest";

it("LANDING_TEXTOS no ofrece e-CF ni DGII y usa Norexos", () => {
  const lineas = readFileSync("docs/venta/LANDING_TEXTOS.md", "utf8").split(
    "\n",
  );
  const sobrantes = lineas
    .map((l, i) => `${i + 1}: ${l}`)
    .filter((l) => /e-CF|\bDGII\b|Nexora POS|\bNexora\b/.test(l))
    .filter((l) => !l.startsWith("6: > **Revisión de Nexora 1"));
  expect(sobrantes).toEqual([]);
});
