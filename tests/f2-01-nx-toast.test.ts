import { expect, it } from "vitest";
import { atributosToast } from "../packages/ui/src/nx-toast";

it("atributosToast usa role correcto y no cierra solo los errores", () => {
  expect(atributosToast("exito")).toEqual({ role: "status", duracionMs: 4000 });
  expect(atributosToast("aviso")).toEqual({ role: "status", duracionMs: 4000 });
  expect(atributosToast("error")).toEqual({ role: "alert", duracionMs: null });
});
