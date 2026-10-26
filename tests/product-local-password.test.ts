import { describe, expect, it } from "vitest";
import { createAdminInputSchema } from "../apps/api/scripts/create-admin-input";

const input = (password: string) => ({
  email: "prueba@nexora.invalid",
  password,
  pin: "583904",
  name: "Prueba Nexora",
  mode: "bootstrap" as const,
});

const repairInput = (password: string) => ({
  ...input(password),
  mode: "repair" as const,
});

describe("contraseña inicial del producto local", () => {
  const local = createAdminInputSchema(true);
  const cloud = createAdminInputSchema(false);

  it("acepta de 4 a 20 caracteres sin exigir composición", () => {
    expect(local.safeParse(input("aaa")).success).toBe(false);
    expect(local.safeParse(input("aaaa")).success).toBe(true);
    expect(local.safeParse(input("a".repeat(20))).success).toBe(true);
    expect(local.safeParse(input("a".repeat(21))).success).toBe(false);
  });

  it("no afloja el bootstrap de la nube", () => {
    expect(cloud.safeParse(input("a".repeat(11))).success).toBe(false);
    expect(cloud.safeParse(input("a".repeat(12))).success).toBe(true);
  });

  it("no afloja la reparación aunque se invoque desde el producto local", () => {
    expect(local.safeParse(repairInput("aaaa")).success).toBe(false);
    expect(local.safeParse(repairInput("a".repeat(12))).success).toBe(true);
  });
});
