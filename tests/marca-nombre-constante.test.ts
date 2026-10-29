import { expect, it } from "vitest";
import { BRAND_NAME } from "../packages/ui/src/nx-brand";

it("BRAND_NAME es Norexos, una sola constante para la marca", () => {
  expect(BRAND_NAME).toBe("Norexos");
});
