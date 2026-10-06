// Higiene de la suite E2E (revisión local de la ronda 9): que una corrida no
// ensucie el repositorio y que se pueda repetir. Comprobaciones sin navegador.
import { afterEach, describe, expect, it, vi } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const e2e = join(root, "tests", "e2e");
const specs = (readdirSync(e2e, { recursive: true }) as string[])
  .filter((file) => /\.spec\.ts$/.test(file))
  .map((file) => [file, readFileSync(join(e2e, file), "utf8")] as const);
const slashes = (path: string) => path.replaceAll("\\", "/");
// Texto de cada llamada `name(…)`, hasta el paréntesis que la cierra.
function calls(source: string, name: string) {
  const found: string[] = [];
  for (
    let at = source.indexOf(name + "(");
    at >= 0;
    at = source.indexOf(name + "(", at + 1)
  ) {
    let depth = 0,
      end = at + name.length;
    do {
      const c = source[end++];
      if (c === "(") depth++;
      else if (c === ")") depth--;
    } while (depth > 0 && end < source.length);
    found.push(source.slice(at, end));
  }
  return found;
}

describe("suite E2E · no ensucia el repositorio (WP-3)", () => {
  it("hay pruebas E2E que revisar", () => {
    expect(specs.length).toBeGreaterThan(0);
  });
  it("ninguna prueba escribe una captura en docs/ sin pasar por screenshotPath()", () => {
    const direct: string[] = [];
    for (const [file, source] of specs) {
      for (const call of calls(source, ".screenshot")) {
        const path = /\bpath\s*:\s*([^\n]*)/.exec(call)?.[1];
        if (path !== undefined && !path.startsWith("screenshotPath("))
          direct.push(file + ": " + call.replace(/\s+/g, " "));
      }
      // Ni con la ruta guardada antes en una variable.
      const rest = source.replace(
        /screenshotPath\(\s*(["'`])[^"'`]*\1\s*,?\s*\)/g,
        "",
      );
      for (const literal of rest.matchAll(
        /["'`](?:\.{0,2}\/)*docs\/[^"'`]*["'`]/g,
      ))
        direct.push(file + ": " + literal[0]);
    }
    expect(direct).toEqual([]);
  });
  it("una corrida normal deja las capturas en la carpeta de resultados, que git ignora; sólo FITSTORE_ACTUALIZAR_CAPTURAS=1 las lleva a docs/", async () => {
    const { screenshotTarget, SCREENSHOTS_ENV } = await import("./e2e/apoyo");
    const where = { root, outputDir: join(root, "test-results") };
    const target = (path: string, update: boolean) =>
      slashes(relative(root, screenshotTarget(path, { ...where, update })));
    expect(target("docs/cobro-exitoso.png", false)).toBe(
      "test-results/capturas/docs/cobro-exitoso.png",
    );
    expect(
      readFileSync(join(root, ".gitignore"), "utf8").split(/\r?\n/),
    ).toContain("test-results/");
    expect(SCREENSHOTS_ENV).toBe("FITSTORE_ACTUALIZAR_CAPTURAS");
    expect(
      target("docs/validacion/ronda6-capturas/cel-equipos-320.png", true),
    ).toBe("docs/validacion/ronda6-capturas/cel-equipos-320.png");
    // Fuera de docs/ no se escribe ni a propósito.
    for (const outside of ["../fuera.png", "docs/../fuera.png", "apps/x.png"])
      expect(() => target(outside, true), outside).toThrow(/docs\//);
  });
});

describe("suite E2E · se puede repetir (TS-2)", () => {
  it("todas las pruebas toman `test` de apoyo.ts: así cada una llega a la API con su propia dirección", () => {
    const own =
      /import\s*\{[^}]*\btest\b[^}]*\}\s*from\s*["'](?:\.\.?\/)+apoyo["']/;
    const bare =
      /import\s*\{[^}]*\btest\b[^}]*\}\s*from\s*["']@playwright\/test["']/;
    expect(
      specs
        .filter(([, source]) => !own.test(source) || bare.test(source))
        .map(([file]) => file),
    ).toEqual([]);
  });
});

describe("playwright.config.ts · cada copia del proyecto prueba su propia compilación (PI-3)", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });
  async function config(env: Record<string, string>) {
    for (const name of [
      "FITSTORE_WEB_URL",
      "FITSTORE_WEB_PORT",
      "FITSTORE_API_PROXY",
      "CI",
    ])
      vi.stubEnv(name, env[name]);
    vi.resetModules();
    return (await import("../playwright.config")).default as any;
  }
  it("sin variables todo sigue como estaba: puerto 4173 y se reutiliza la vista previa que ya esté abierta", async () => {
    const c = await config({});
    expect(c.use.baseURL).toBe("http://127.0.0.1:4173");
    expect(c.webServer.url).toBe("http://127.0.0.1:4173");
    expect(c.webServer.command).toContain("--port 4173 --strictPort");
    expect(c.webServer.reuseExistingServer).toBe(true);
    expect((await config({ CI: "1" })).webServer.reuseExistingServer).toBe(
      false,
    );
  });
  it("FITSTORE_WEB_PORT cambia a la vez el puerto de la vista previa, la URL que Playwright espera y la de las pruebas", async () => {
    const c = await config({ FITSTORE_WEB_PORT: "4199" });
    expect(c.webServer.command).toContain("--port 4199 --strictPort");
    expect(c.webServer.command).not.toContain("4173");
    expect(c.webServer.url).toBe("http://127.0.0.1:4199");
    expect(c.use.baseURL).toBe("http://127.0.0.1:4199");
  });
  it("con un puerto propio no se reutiliza lo que ya escuche ahí: si está ocupado, la corrida falla en vez de probar otra compilación", async () => {
    const c = await config({ FITSTORE_WEB_PORT: "4199" });
    expect(c.webServer.reuseExistingServer).toBe(false);
  });
  it("la vista previa que arranca Playwright recibe FITSTORE_API_PROXY", async () => {
    const c = await config({
      FITSTORE_WEB_PORT: "4199",
      FITSTORE_API_PROXY: "http://127.0.0.1:3999",
    });
    expect(c.webServer.env.FITSTORE_API_PROXY).toBe("http://127.0.0.1:3999");
  });
  it("FITSTORE_WEB_URL sigue teniendo prioridad: no se arranca ninguna vista previa", async () => {
    const c = await config({
      FITSTORE_WEB_URL: "http://127.0.0.1:4555",
      FITSTORE_WEB_PORT: "4199",
    });
    expect(c.webServer).toBeUndefined();
    expect(c.use.baseURL).toBe("http://127.0.0.1:4555");
  });
  it("un FITSTORE_WEB_PORT que no es un puerto se rechaza con un mensaje claro", async () => {
    for (const bad of ["abc", "0", "70000", "41.5"])
      await expect(config({ FITSTORE_WEB_PORT: bad }), bad).rejects.toThrow(
        /FITSTORE_WEB_PORT/,
      );
  });
});
