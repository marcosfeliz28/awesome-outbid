// G9 · Privacidad en el navegador: el service worker no guarda respuestas de
// /api (datos de clientes, ventas, pagos) y el cierre de sesión no borra la
// cola de ventas sin sincronizar. Lo de extremo a extremo está en
// tests/e2e/privacidad-sesion.spec.ts.
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const read = (path: string) =>
  readFileSync(new URL("../" + path, import.meta.url), "utf8");

describe("G9 · service worker", () => {
  const vite = read("apps/web/vite.config.ts");
  const workbox = vite.slice(vite.indexOf("workbox:"));

  it("sólo precachea archivos estáticos de la PWA (nada de JSON ni de /api)", () => {
    const patterns = /globPatterns:\s*\[([^\]]*)\]/.exec(workbox)?.[1] ?? "";
    expect(patterns).toBeTruthy();
    expect(patterns).not.toMatch(/json|api/i);
  });

  it("el fallback de navegación de la PWA no captura /api ni /healthz", () => {
    expect(workbox).toMatch(/navigateFallback:\s*"\/index\.html"/);
    const list = /navigateFallbackDenylist:\s*\[([^\]]*)\]/.exec(workbox)?.[1];
    expect(list).toBeDefined();
    // Se evalúan las expresiones tal cual están en la configuración.
    const denylist = (list!.match(/\/\^[^,]*\//g) ?? []).map((literal) => {
      const body = literal.slice(1, literal.lastIndexOf("/"));
      return new RegExp(body);
    });
    expect(denylist.length).toBeGreaterThanOrEqual(2);
    // Workbox compara con pathname + search.
    const denied = (path: string) => denylist.some((re) => re.test(path));
    for (const path of [
      "/api",
      "/api/",
      "/api/health",
      "/api/sales/123/receipt.pdf",
      "/api/events?token=x",
      "/healthz",
      "/healthz/deep",
    ])
      expect(denied(path), path).toBe(true);
    // Las rutas de la SPA siguen cayendo en index.html sin conexión.
    for (const path of ["/", "/pos", "/caja", "/apis", "/api-docs-app", "/healthzone"])
      expect(denied(path), path).toBe(false);
  });

  it("no tiene reglas de caché en tiempo de ejecución para /api, salvo NetworkOnly", () => {
    const runtime = /runtimeCaching:\s*\[([\s\S]*?)\]\s*,/.exec(workbox)?.[1];
    expect(runtime).toBeDefined();
    // Hoy la lista está vacía. Si alguien añade una regla para /api, debe ser
    // NetworkOnly: una respuesta con datos personales no se guarda en Cache
    // Storage, donde sobreviviría al cierre de sesión.
    if (/\/api/.test(runtime!))
      expect(runtime).toMatch(/handler:\s*["']NetworkOnly["']/);
    expect(runtime).not.toMatch(
      /CacheFirst|StaleWhileRevalidate|NetworkFirst|CacheOnly/,
    );
  });
});

describe("G9 · cierre de sesión", () => {
  const api = read("apps/web/src/api.ts");
  const forget = api.slice(
    api.indexOf("export async function forgetSessionData"),
    api.indexOf("const stillSignedIn"),
  );

  it("endSession borra los datos recuperables del servidor", () => {
    const end = api.slice(
      api.indexOf("export async function endSession"),
      api.indexOf("export async function forgetSessionData"),
    );
    expect(end).toContain("forgetSessionData(revoked)");
    expect(forget).toContain("localDB.cache.clear()");
    expect(forget).toContain("caches.delete");
  });

  it("nunca borra la cola de ventas ni de mercancía sin sincronizar", () => {
    expect(forget).not.toMatch(/localDB\.(sales|merchandise)/);
    expect(forget).not.toMatch(/\.delete\(\)\s*;?\s*$/m);
    expect(forget).not.toMatch(/Dexie\.delete|localDB\.delete/);
  });
});
