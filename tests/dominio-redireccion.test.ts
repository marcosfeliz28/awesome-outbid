import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const leer = (ruta: string) => readFileSync(resolve(root, ruta), "utf8");

describe("dominio norexos.ai: configuración preparada (orden 95 C)", () => {
  it("la redirección nginx envía nexorapos.net a norexos.ai con 301 y conserva ruta y consulta", () => {
    const conf = leer("deploy/redirect-nexorapos.nginx.conf");
    expect(conf).toMatch(
      /server_name\s+nexorapos\.net\s+www\.nexorapos\.net\s*;/,
    );
    expect(conf).toContain("return 301 https://norexos.ai$request_uri;");
    expect(conf).not.toMatch(/return 302|rewrite .* redirect;/);
  });

  it("la propuesta de landing estática es un sitio estático y no toca la API ni la base", () => {
    const y = leer("docs/venta/dominio/render-landing.propuesta.yaml");
    expect(y).toMatch(/runtime:\s*static/);
    expect(y).toContain("staticPublishPath: ./apps/landing");
    expect(y).toContain("norexos.ai");
    expect(y).not.toMatch(/databases:|type:\s*pserv|JWT_SECRET/);
  });

  it("render.yaml sigue sin el servicio de la landing (solo propuesta)", () => {
    expect(leer("render.yaml")).not.toMatch(/runtime:\s*static|nexora-landing/);
  });

  it("DNS_Y_CORREO.md lista los registros y marca lo desconocido como pendiente", () => {
    const d = leer("docs/venta/dominio/DNS_Y_CORREO.md");
    for (const t of [
      "SPF",
      "DKIM",
      "DMARC",
      "MX",
      "soporte@norexos.ai",
      "dig",
      "curl -I",
    ]) {
      expect(d).toContain(t);
    }
    expect(d).toContain("<PENDIENTE:");
  });

  it("ningún archivo nuevo contiene credenciales", () => {
    for (const r of [
      "deploy/redirect-nexorapos.nginx.conf",
      "docs/venta/dominio/render-landing.propuesta.yaml",
      "docs/venta/dominio/DNS_Y_CORREO.md",
    ]) {
      expect(existsSync(resolve(root, r))).toBe(true);
      expect(leer(r)).not.toMatch(
        /(api[_-]?key|secret|password|token)\s*[:=]\s*\S{8,}|p=[A-Za-z0-9+/]{40,}/i,
      );
    }
  });
});
