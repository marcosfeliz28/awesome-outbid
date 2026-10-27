import { expect, it } from "vitest";
import config from "../vitest.config";

it("limita en todos los sistemas las suites que levantan PostgreSQL", () => {
  const test = "test" in config ? config.test : undefined;

  expect(test?.maxWorkers).toBe(4);
});
