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
