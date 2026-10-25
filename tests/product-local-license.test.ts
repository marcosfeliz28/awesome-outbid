import { describe, expect, it, vi } from "vitest";
import { generateKeyPairSync, sign } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  LocalLicense,
  localLicenseHttp,
  licensePayload,
  type LicenseClaims,
} from "../apps/api/src/local-license";

const keys = generateKeyPairSync("ed25519");
const other = generateKeyPairSync("ed25519");
const publicKey = keys.publicKey
  .export({ type: "spki", format: "pem" })
  .toString();
const base = Date.parse("2026-10-24T12:00:00Z");
const TENANT = "00000000-0000-0000-0000-000000000007";
const DEVICE = "a".repeat(64);
const claims = (overrides: Partial<LicenseClaims> = {}): LicenseClaims => ({
  version: 2,
  tenantId: TENANT,
  deviceHash: DEVICE,
  installationId: "test-installation",
  issuedAt: new Date(base).toISOString(),
  expiresAt: new Date(base + 7 * 86400000).toISOString(),
  status: "active",
  ...overrides,
});
const token = (data: LicenseClaims, privateKey = keys.privateKey) => ({
  claims: data,
  signature: sign(null, Buffer.from(licensePayload(data)), privateKey).toString(
    "base64url",
  ),
});

function fixture() {
  const dir = mkdtempSync(join(tmpdir(), "pc19-"));
  const license = new LocalLicense({
    directory: dir,
    publicKey,
    installationId: "test-installation",
    tenantId: TENANT,
    deviceHash: DEVICE,
    now: () => base,
  });
  return {
    license,
    dir,
    cleanup: () => rmSync(dir, { recursive: true, force: true }),
  };
}

describe("PC-19 licencia local", () => {
  it("acepta solo Ed25519 de esta instalación y no admite alterar estado ni fechas", () => {
    const f = fixture();
    try {
      expect(() =>
        f.license.install(token(claims(), other.privateKey)),
      ).toThrow();
      expect(() =>
        f.license.install({
          ...token(claims()),
          claims: claims({ status: "unpaid" }),
        }),
      ).toThrow();
      expect(() =>
        f.license.install(token(claims({ installationId: "otra" }))),
      ).toThrow();
      f.license.install(token(claims()));
      expect(f.license.state().mode).toBe("write");
    } finally {
      f.cleanup();
    }
  });

  it("renueva a los 7 días y falla cerrado al vencer o en impago", () => {
    const f = fixture();
    try {
      f.license.install(token(claims()));
      expect(f.license.state(base + 7 * 86400000 - 1).mode).toBe("write");
      expect(f.license.state(base + 7 * 86400000).mode).toBe("read-only");
      const renewed = new LocalLicense({
        directory: f.dir,
        publicKey,
        installationId: "test-installation",
        tenantId: TENANT,
        deviceHash: DEVICE,
        now: () => base + 7 * 86400000,
      });
      renewed.install(
        token(
          claims({
            issuedAt: new Date(base + 86400000).toISOString(),
            expiresAt: new Date(base + 8 * 86400000).toISOString(),
            status: "unpaid",
          }),
        ),
      );
      expect(renewed.state().mode).toBe("read-only");
    } finally {
      f.cleanup();
    }
  });

  it("detecta reloj atrasado incluso tras reiniciar y no acepta renovar con un token viejo", () => {
    const f = fixture();
    try {
      f.license.install(token(claims()));
      expect(f.license.state(base + 2 * 86400000).mode).toBe("write");
      const restarted = new LocalLicense({
        directory: f.dir,
        publicKey,
        installationId: "test-installation",
        tenantId: TENANT,
        deviceHash: DEVICE,
        now: () => base,
      });
      expect(restarted.state().reason).toBe("clock-backwards");
      expect(() => restarted.install(token(claims()))).toThrow();
    } finally {
      f.cleanup();
    }
  });

  it("cola vencida queda sin escritura y tampoco se habilita con captura anterior", () => {
    const f = fixture();
    try {
      f.license.install(token(claims()));
      expect(f.license.canWrite(base + 7 * 86400000, base + 1000)).toBe(false);
      expect(f.license.canWrite(base + 7 * 86400000 - 1, base + 1000)).toBe(
        true,
      );
    } finally {
      f.cleanup();
    }
  });
  it("una renovación posterior no legaliza ventas capturadas durante impago", () => {
    const f = fixture();
    try {
      f.license.install(token(claims()));
      const unpaidAt = base + 86400000;
      const unpaid = new LocalLicense({ directory: f.dir, publicKey, installationId: "test-installation", tenantId: TENANT, deviceHash: DEVICE, now: () => unpaidAt });
      unpaid.install(token(claims({ issuedAt: new Date(unpaidAt).toISOString(), status: "unpaid" })));
      const renewedAt = base + 2 * 86400000;
      const renewed = new LocalLicense({ directory: f.dir, publicKey, installationId: "test-installation", tenantId: TENANT, deviceHash: DEVICE, now: () => renewedAt });
      renewed.install(token(claims({ issuedAt: new Date(renewedAt).toISOString() })));
      expect(renewed.canWrite(renewedAt, base + 12 * 3600000)).toBe(true);
      expect(renewed.canWrite(renewedAt, unpaidAt + 12 * 3600000)).toBe(false);
    } finally {
      f.cleanup();
    }
  });
  it("impago corta escrituras HTTP, incluidas sincronizaciones; permite lectura y acceso", () => {
    const f = fixture();
    try {
      f.license.install(token(claims({ status: "unpaid" })));
      expect(
        localLicenseHttp("POST", "/api/sales/sync", f.license).status,
      ).toBe(423);
      expect(localLicenseHttp("POST", "/api/sales", f.license).status).toBe(
        423,
      );
      expect(
        localLicenseHttp("PATCH", "/api/catalog/one", f.license).status,
      ).toBe(423);
      expect(localLicenseHttp("GET", "/api/sales", f.license).status).toBe(0);
      expect(
        localLicenseHttp("POST", "/api/auth/login", f.license).status,
      ).toBe(0);
      expect(
        localLicenseHttp("GET", "/api/local-license/status", f.license),
      ).toMatchObject({
        status: 200,
        body: { mode: "read-only", reason: "unpaid" },
      });
    } finally {
      f.cleanup();
    }
  });
  it("no acepta token ausente, vencido ni periodo mayor de siete días", () => {
    const f = fixture();
    try {
      expect(f.license.state().mode).toBe("read-only");
      expect(() =>
        f.license.install(
          token(
            claims({ expiresAt: new Date(base + 8 * 86400000).toISOString() }),
          ),
        ),
      ).toThrow();
      f.license.install(
        token(
          claims({
            issuedAt: new Date(base - 7 * 86400000).toISOString(),
            expiresAt: new Date(base - 1000).toISOString(),
          }),
        ),
      );
      expect(f.license.state().reason).toBe("expired");
    } finally {
      f.cleanup();
    }
  });

  it("tras renovar, solo sincroniza capturas hechas bajo una licencia vigente", () => {
    const f = fixture();
    try {
      f.license.install(token(claims()));
      const renewed = new LocalLicense({
        directory: f.dir,
        publicKey,
        installationId: "test-installation",
        tenantId: TENANT,
        deviceHash: DEVICE,
        now: () => base + 8 * 86400000,
      });
      renewed.install(
        token(
          claims({
            issuedAt: new Date(base + 8 * 86400000).toISOString(),
            expiresAt: new Date(base + 15 * 86400000).toISOString(),
          }),
        ),
      );
      expect(renewed.canWrite(base + 8 * 86400000, base + 86400000)).toBe(true);
      expect(
        renewed.canWrite(base + 8 * 86400000, base + 7 * 86400000 + 1000),
      ).toBe(false);
      expect(
        localLicenseHttp("POST", "/api/sales/sync/", renewed, {
          sales: [
            { offlineUuid: "fuera", capturedAt: new Date(base + 7 * 86400000 + 1000).toISOString() },
          ],
        }).body,
      ).toEqual({ results: [expect.objectContaining({ offlineUuid: "fuera", status: "conflict" })] });
      expect(
        localLicenseHttp("POST", "/api/sales/sync", renewed, {
          sales: [{ capturedAt: new Date(base + 86400000).toISOString() }],
        }).status,
      ).toBe(0);
    } finally {
      f.cleanup();
    }
  });

  it("renueva por HTTPS con credencial y verifica la respuesta antes de instalarla", async () => {
    const f = fixture();
    const previous = process.env.PRODUCT_LOCAL_LICENSE_RENEW_TOKEN;
    process.env.PRODUCT_LOCAL_LICENSE_RENEW_TOKEN = "credencial-de-prueba";
    const fetcher = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue({
        ok: true,
        json: async () => token(claims()),
      } as Response);
    try {
      await expect(
        f.license.renew("http://licencias.example/renew"),
      ).rejects.toThrow("HTTPS");
      await f.license.renew("https://licencias.example/renew");
      expect(fetcher).toHaveBeenCalledWith(
        "https://licencias.example/renew",
        expect.objectContaining({
          method: "POST",
          headers: expect.objectContaining({
            authorization: "Bearer credencial-de-prueba",
          }),
        }),
      );
      expect(f.license.state().mode).toBe("write");
    } finally {
      fetcher.mockRestore();
      if (previous === undefined)
        delete process.env.PRODUCT_LOCAL_LICENSE_RENEW_TOKEN;
      else process.env.PRODUCT_LOCAL_LICENSE_RENEW_TOKEN = previous;
      f.cleanup();
    }
  });

  it("CPC-9: la licencia de otra empresa o de otro equipo no sirve", () => {
    const f = fixture();
    try {
      expect(() => f.license.install(token(claims({ tenantId: "00000000-0000-0000-0000-000000000008" })))).toThrow();
      expect(() => f.license.install(token(claims({ deviceHash: "b".repeat(64) })))).toThrow();
      // La firma cubre empresa y equipo: no se pueden cambiar después.
      expect(() => f.license.install({ ...token(claims()), claims: claims({ deviceHash: "b".repeat(64) }) })).toThrow();
      f.license.install(token(claims()));
      const copied = new LocalLicense({
        directory: f.dir, publicKey, installationId: "test-installation",
        tenantId: TENANT, deviceHash: "c".repeat(64), now: () => base,
      });
      expect(copied.state()).toMatchObject({ mode: "read-only", reason: "invalid" });
    } finally {
      f.cleanup();
    }
  });

  it("CPC-9: un reloj adelantado y luego corregido se recupera al renovar", () => {
    const f = fixture();
    try {
      f.license.install(token(claims()));
      expect(f.license.state(Date.parse("2099-01-01T00:00:00Z")).mode).toBe("read-only");
      const fixedAt = base + 3600000;
      const fixed = new LocalLicense({
        directory: f.dir, publicKey, installationId: "test-installation",
        tenantId: TENANT, deviceHash: DEVICE, now: () => fixedAt,
      });
      expect(fixed.state().reason).toBe("clock-backwards");
      fixed.install(token(claims({
        issuedAt: new Date(fixedAt).toISOString(),
        expiresAt: new Date(fixedAt + 7 * 86400000).toISOString(),
      })));
      expect(fixed.state().mode).toBe("write");
    } finally {
      f.cleanup();
    }
  });

  it("CPC-9: conserva las licencias por vigencia, no solo las 60 últimas", () => {
    const f = fixture();
    try {
      let now = base;
      for (let hour = 0; hour < 80; hour++) {
        now = base + hour * 3600000;
        const at = now;
        new LocalLicense({
          directory: f.dir, publicKey, installationId: "test-installation",
          tenantId: TENANT, deviceHash: DEVICE, now: () => at,
        }).install(token(claims({
          issuedAt: new Date(at).toISOString(),
          expiresAt: new Date(at + 7 * 86400000).toISOString(),
        })));
      }
      // Venta capturada en la primera hora, bajo la primera licencia.
      expect(f.license.canWrite(now, base + 60000)).toBe(true);
    } finally {
      f.cleanup();
    }
  });

  it("CPC-9: una venta mala no atasca el lote y la ruta no se salta con mayúsculas", () => {
    const f = fixture();
    try {
      f.license.install(token(claims()));
      const result = localLicenseHttp("POST", "/API//Sales/Sync", f.license, {
        sales: [
          { offlineUuid: "buena", capturedAt: new Date(base + 1000).toISOString() },
          { offlineUuid: "mala", capturedAt: new Date(base - 86400000).toISOString() },
        ],
      });
      expect(result).toEqual({
        status: 200,
        body: { results: [
          { offlineUuid: "buena", status: "retry" },
          expect.objectContaining({ offlineUuid: "mala", status: "conflict" }),
        ] },
      });
      // Sin la venta mala, el lote pasa al controlador.
      expect(localLicenseHttp("POST", "/api/sales/sync", f.license, {
        sales: [{ offlineUuid: "buena", capturedAt: new Date(base + 1000).toISOString() }],
      }).status).toBe(0);
      const unpaid = fixture();
      try {
        unpaid.license.install(token(claims({ status: "unpaid" })));
        expect(localLicenseHttp("POST", "/API/SALES", unpaid.license).status).toBe(423);
        expect(localLicenseHttp("GET", "/API/local-license/STATUS", unpaid.license).status).toBe(200);
      } finally {
        unpaid.cleanup();
      }
    } finally {
      f.cleanup();
    }
  });

  it("CPC-9: la retención no borra nada con la licencia en solo lectura", async () => {
    const dir = mkdtempSync(join(tmpdir(), "pc19-ret-"));
    const saved = { ...process.env };
    Object.assign(process.env, {
      PRODUCT_LOCAL_LICENSE: "required",
      PRODUCT_LOCAL_LICENSE_DIR: dir,
      PRODUCT_LOCAL_LICENSE_PUBLIC_KEY: publicKey,
      PRODUCT_LOCAL_INSTALLATION_ID: "test-installation",
    });
    try {
      const { RetentionWorker } = await import("../apps/api/src/retention");
      const touched = vi.fn();
      const db = new Proxy({}, { get: () => { touched(); return new Proxy(() => undefined, { get: () => touched, apply: touched }); } });
      await new RetentionWorker(db as never).run();
      expect(touched).not.toHaveBeenCalled();
    } finally {
      process.env = saved;
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("CPC-9: el instalador final rechaza la clave pública de pruebas del CI", async () => {
    const { rejectsTestKey, CI_LICENSE_KEY } = await import("../instalador/tools/license-key-guard.mjs");
    const ci = readFileSync(".github/workflows/ci.yml", "utf8");
    expect(ci).toContain(CI_LICENSE_KEY);
    const pem = `-----BEGIN PUBLIC KEY-----\n${CI_LICENSE_KEY}\n-----END PUBLIC KEY-----\n`;
    expect(rejectsTestKey(pem, {})).toBe(true);
    expect(rejectsTestKey(pem, { CI: "true" })).toBe(false);
    expect(rejectsTestKey(publicKey, {})).toBe(false);
    expect(readFileSync("instalador/build.ps1", "utf8")).toContain("license-key-guard.mjs");
  });

  it("CPC-8: la edición local usa cookies propias y no pisa la sesión de la tienda", async () => {
    const { refreshCookieName, tenantCookieName } = await import("../apps/api/src/tenant-context");
    const saved = process.env.PRODUCT_LOCAL_LICENSE;
    try {
      delete process.env.PRODUCT_LOCAL_LICENSE;
      expect([refreshCookieName(), tenantCookieName()]).toEqual(["fitstore_refresh", "nexora_tenant"]);
      process.env.PRODUCT_LOCAL_LICENSE = "required";
      expect([refreshCookieName(), tenantCookieName()]).toEqual(["nexora_local_refresh", "nexora_local_tenant"]);
      expect(readFileSync("apps/api/src/auth.ts", "utf8")).not.toMatch(/"fitstore_refresh"|"nexora_tenant"/);
    } finally {
      if (saved === undefined) delete process.env.PRODUCT_LOCAL_LICENSE;
      else process.env.PRODUCT_LOCAL_LICENSE = saved;
    }
  });
});
