// Higiene de la suite E2E (revisión local de la ronda 9): que una corrida no
// ensucie el repositorio y que se pueda repetir. Comprobaciones sin navegador.
import { afterEach, describe, expect, it, vi } from "vitest";

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
