import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const platform = readFileSync("apps/web/src/PlatformPanel.tsx", "utf8");
const registration = readFileSync("apps/web/src/Registration.tsx", "utf8");

describe("presentación de plan, prueba e invitación", () => {
  it("ordena Plan y prueba con resumen, acciones y motivo claros", () => {
    expect(platform).toContain('aria-label="Resumen del plan y la prueba"');
    expect(platform).toContain("Plan actual");
    expect(platform).toContain("Fin de la prueba");
    expect(platform).toContain("Cambiar plan");
    expect(platform).toContain('Field label="Nuevo plan (opcional)"');
    expect(platform).toContain("Prorrogar prueba");
    expect(platform).toContain('Field label="Prórroga (días)"');
    expect(platform).toContain('Field label="Responsable del cambio"');
    expect(platform).toContain('Field label="Motivo del cambio"');
  });

  it("explica el plan que se cobrará cuando la empresa sigue en prueba", () => {
    expect(platform).toContain('Field label="Plan que paga"');
    expect(platform).toContain(
      "La empresa sigue en prueba. Elige el plan que empezará a pagar.",
    );
    expect(platform).toContain("Elige un plan…");
  });

  it("conserva llamadas y payloads existentes", () => {
    expect(platform).toContain("`/tenants/${tenant.slug}/payments`");
    expect(platform).toContain("...(needsPlan ? { plan } : {})");
    expect(platform).toContain("`/tenants/${tenant.slug}/plan`");
    expect(platform).toContain("operadora: operadora.trim()");
    expect(platform).toContain("motivo: motivo.trim()");
    expect(platform).toContain("...(changePlan ? { plan } : {})");
    expect(platform).toContain("...(extend ? { prorrogarDias: extend } : {})");
  });

  it("dice 7 días tanto al registrar como al compartir la invitación", () => {
    expect(registration).toContain("Prueba Norexos durante 7 días");
    expect(registration).toContain(
      "Tendrás 7 días de prueba para conocer Norexos.",
    );
    expect(platform).toContain(
      "El enlace vence en 7 días y sirve una sola vez.",
    );
    expect(platform).toContain("Enlace de invitación (vence en 7 días).");
  });

  it("ofrece una superficie legible también en modo oscuro", () => {
    const styles = readFileSync("apps/web/src/styles.css", "utf8");
    expect(platform).toContain('className="platform-panel min-h-screen');
    expect(styles).toContain(':root[data-theme="dark"] .platform-panel');
    expect(styles).toContain(
      ':root[data-theme="dark"] .platform-panel__surface',
    );
    expect(platform).not.toContain('style={{ background: "#fff"');
  });

  it("da fondo y borde propios a las tarjetas de Mis clientes", () => {
    const styles = readFileSync("apps/web/src/styles.css", "utf8");
    expect(platform).toContain('className="platform-client-card');
    expect(styles).toContain(".platform-client-card {");
    expect(styles).toContain(
      ':root[data-theme="dark"] .platform-client-card {',
    );
  });
});
