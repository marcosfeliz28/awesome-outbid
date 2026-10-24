import { describe, expect, it, vi } from "vitest";
import { generateKeyPairSync, sign } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
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
const claims = (overrides: Partial<LicenseClaims> = {}): LicenseClaims => ({
  version: 1,
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
      const unpaid = new LocalLicense({ directory: f.dir, publicKey, installationId: "test-installation", now: () => unpaidAt });
      unpaid.install(token(claims({ issuedAt: new Date(unpaidAt).toISOString(), status: "unpaid" })));
      const renewedAt = base + 2 * 86400000;
      const renewed = new LocalLicense({ directory: f.dir, publicKey, installationId: "test-installation", now: () => renewedAt });
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
            { capturedAt: new Date(base + 7 * 86400000 + 1000).toISOString() },
          ],
        }).status,
      ).toBe(423);
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
});
