import { describe, it, expect } from "vitest";
import { parecEmail } from "../packages/ui/src/nx-parec-email";

describe("parecEmail (F3-09)", () => {
  it("acepta la forma algo@algo.algo", () => {
    expect(parecEmail("a@b.co")).toBe(true);
  });
  it("rechaza espacios, dos arrobas, sin punto y vacío", () => {
    expect(parecEmail("a b@c.d")).toBe(false);
    expect(parecEmail("a@@b.c")).toBe(false);
    expect(parecEmail("a@bc")).toBe(false);
    expect(parecEmail("")).toBe(false);
  });
});
