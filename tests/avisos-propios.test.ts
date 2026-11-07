// G9: el temporizador de un aviso viejo no borra el aviso nuevo.
import { expect, it } from "vitest";

it("un aviso sólo se cierra a sí mismo", async () => {
  // helpers.tsx carga el estado de la caja, que lee el tema guardado.
  Object.assign(globalThis, { localStorage: { getItem: () => null } });
  const { closeOwn } = await import("../apps/web/src/helpers");
  const viejo = { id: 1 },
    nuevo = { id: 2 };
  expect(closeOwn(viejo.id)(nuevo)).toBe(nuevo);
  expect(closeOwn(nuevo.id)(nuevo)).toBeNull();
  expect(closeOwn(viejo.id)(null)).toBeNull();
});
