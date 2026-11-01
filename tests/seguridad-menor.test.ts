// Lote seguridad menor (1-nov-2026, hallazgos H-03, H-05, H-15, H-16, H-17, H-07, H-02).
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(path, "utf8");

describe("H-03 · el aprobador del correo se escapa", () => {
  it("el nombre del aprobador pasa por cleanText antes de entrar al HTML", () => {
    const src = read("apps/api/src/notifications.ts");
    expect(src).toContain("cleanText(approver");
    expect(src).not.toMatch(/\$\{approver \?\? "—"\}/);
  });
});
