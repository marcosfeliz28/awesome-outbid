// Lote seguridad menor (1-nov-2026, hallazgos H-03, H-05, H-15, H-16, H-17, H-07, H-02).
import { readFileSync } from "node:fs";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import {
  BackupFormatError,
  decodeHeader,
  encodeHeader,
  SCRYPT,
} from "../apps/api/src/drive-backup-core";
// @ts-expect-error -- script .mjs sin tipos
import { parseHeader } from "../scripts/decrypt-backup.mjs";

// El almacén de la app se crea al cargar api.ts y lee localStorage (no hay DOM).
let download: (typeof import("../apps/web/src/api"))["download"];

const read = (path: string) => readFileSync(path, "utf8");

describe("H-03 · el aprobador del correo se escapa", () => {
  it("el nombre del aprobador pasa por cleanText antes de entrar al HTML", () => {
    const src = read("apps/api/src/notifications.ts");
    expect(src).toContain("cleanText(approver");
    expect(src).not.toMatch(/\$\{approver \?\? "—"\}/);
  });
});

describe("H-05 · el descifrado de respaldos no pide gigabytes de memoria", () => {
  const base = {
    chunkBytes: 4096,
    salt: Buffer.alloc(16),
    noncePrefix: Buffer.alloc(7),
  };
  const decodeWith = (params: { log2N: number; r: number; p: number }) =>
    decodeHeader(encodeHeader({ ...base, params }));

  it("acepta los parámetros que usa el respaldo", () => {
    expect(() => decodeWith(SCRYPT)).not.toThrow();
  });
  it("rechaza costos que superan ~160 MiB de memoria", () => {
    expect(() => decodeWith({ log2N: 17, r: 8, p: 1 })).toThrow(
      BackupFormatError,
    );
    expect(() => decodeWith({ log2N: 15, r: 16, p: 4 })).toThrow(
      BackupFormatError,
    );
  });
  it("el descifrador de scripts/decrypt-backup.mjs tiene los mismos límites", () => {
    const ok = (fn: () => unknown) => {
      try {
        fn();
        return true;
      } catch {
        return false;
      }
    };
    const boundary: [{ log2N: number; r: number; p: number }, boolean][] = [
      [{ log2N: 16, r: 8, p: 2 }, true],
      [{ log2N: 14, r: 1, p: 1 }, true],
      [{ log2N: 17, r: 8, p: 2 }, false],
      [{ log2N: 16, r: 9, p: 2 }, false],
      [{ log2N: 16, r: 8, p: 3 }, false],
      [{ log2N: 13, r: 8, p: 1 }, false],
    ];
    for (const [params, accepted] of boundary) {
      const header = encodeHeader({ ...base, params });
      expect(
        ok(() => decodeHeader(header)),
        JSON.stringify(params),
      ).toBe(accepted);
      expect(
        ok(() => parseHeader(header)),
        JSON.stringify(params),
      ).toBe(accepted);
    }
  });
});

describe("H-15 · download() tiene tiempo máximo y tope de reintentos", () => {
  const src = read("apps/web/src/api.ts");
  const fn = src.slice(src.indexOf("export async function download("));

  beforeAll(async () => {
    vi.stubGlobal("localStorage", { getItem: () => null, setItem: () => {} });
    ({ download } = await import("../apps/web/src/api"));
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });
  it("solo los encabezados tienen tiempo máximo: un cuerpo lento no se corta", async () => {
    vi.stubGlobal("fetch", async () => ({
      ok: true,
      status: 200,
      // El cuerpo tarda más que el tope de encabezados.
      blob: () =>
        new Promise((done) => setTimeout(() => done(new Blob(["x"])), 150)),
    }));
    vi.stubGlobal("document", { createElement: () => ({ click: () => {} }) });
    vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:test");
    await expect(
      download("/reportes/x.csv", "x.csv", true, 50),
    ).resolves.toBeUndefined();
  });
  it("si los encabezados no llegan a tiempo, la descarga aborta", async () => {
    vi.stubGlobal(
      "fetch",
      (_url: string, init: RequestInit) =>
        new Promise((_, reject) =>
          init.signal?.addEventListener("abort", () =>
            reject(new DOMException("aborted", "AbortError")),
          ),
        ),
    );
    await expect(
      download("/reportes/x.csv", "x.csv", true, 50),
    ).rejects.toMatchObject({
      name: "AbortError",
    });
  }, 5000);
  it("tras refrescar la sesión, un 401 que persiste no vuelve a reintentar", () => {
    expect(fn).toContain("return download(path, filename, false, timeoutMs);");
  });
});

describe("H-16 · el intervalo de recarga se guarda y se limpia", () => {
  const src = read("apps/web/src/pwaUpdate.ts");
  it("un solo intervalo, guardado, y se limpia antes de recargar", () => {
    expect(src).toContain("reloadTimer ??= setInterval(reloadIfFree, 15_000);");
    expect(src).toMatch(/clearInterval\(reloadTimer\);\s*reloading = true;/);
  });
});

describe("H-17 · step=0.01 solo en campos numéricos", () => {
  const src = read("apps/web/src/helpers.tsx");
  it("los campos de texto no reciben step", () => {
    expect(src).not.toContain('step={f.step || "0.01"}');
    expect(src).toContain(
      'step={f.step || (f.type === "number" ? "0.01" : undefined)}',
    );
  });
});

describe("H-07 · fechas de corte como constantes con nombre", () => {
  it("la rotación DGII usa una constante, no un literal", () => {
    const src = read("apps/api/src/formal-report.ts");
    expect(src).toMatch(/const DGII_ROTATION_FROM = "2026-10-27";/);
    expect(src).toContain("period.to >= DGII_ROTATION_FROM");
    expect(src.split('"2026-10-27"').length - 1).toBe(1);
  });
  it("la corrección de conteos usa una constante, no un literal", () => {
    const src = read("apps/api/src/inventory.ts");
    expect(src).toMatch(/const COUNT_CORRECTION_BEFORE = "2026-10-16";/);
    expect(src).toContain("m.\"createdAt\" < '${COUNT_CORRECTION_BEFORE}'");
  });
});
