// Q-20 (auditoría 07 v2): las dos configuraciones de Vitest listan archivo por
// archivo; una prueba nueva que no se agrega a ninguna no corre y nadie se
// entera. Cada tests/*.test.ts debe estar en la lista unitaria o en la de
// integración, y no en las dos.
import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync } from "node:fs";

const listed = (config: string) =>
  new Set(
    [
      ...readFileSync(config, "utf8").matchAll(/"(tests\/[^"]+\.test\.ts)"/g),
    ].map((m) => m[1]!),
  );

describe("configuración de pruebas", () => {
  const unit = listed("vitest.config.ts");
  const integration = listed("vitest.integration.config.ts");
  const files = readdirSync("tests")
    .filter((name) => name.endsWith(".test.ts"))
    .map((name) => "tests/" + name);

  it("cada archivo de pruebas corre en la configuración unitaria o en la de integración", () => {
    expect(files.length).toBeGreaterThan(40);
    expect(
      files.filter((f) => !unit.has(f) && !integration.has(f)),
      "agrégalo a vitest.config.ts o a vitest.integration.config.ts",
    ).toEqual([]);
  });
  it("ninguno corre en las dos y todo lo listado existe", () => {
    expect(files.filter((f) => unit.has(f) && integration.has(f))).toEqual([]);
    expect([...unit, ...integration].filter((f) => !files.includes(f))).toEqual(
      [],
    );
  });
});
