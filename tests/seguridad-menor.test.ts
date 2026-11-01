// Lote seguridad menor (1-nov-2026, hallazgos H-03, H-05, H-15, H-16, H-17, H-07, H-02).
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { BackupFormatError, decodeHeader, encodeHeader, SCRYPT } from "../apps/api/src/drive-backup-core";

const read = (path: string) => readFileSync(path, "utf8");

describe("H-03 · el aprobador del correo se escapa", () => {
  it("el nombre del aprobador pasa por cleanText antes de entrar al HTML", () => {
    const src = read("apps/api/src/notifications.ts");
    expect(src).toContain("cleanText(approver");
    expect(src).not.toMatch(/\$\{approver \?\? "—"\}/);
  });
});


describe("H-05 · el descifrado de respaldos no pide gigabytes de memoria", () => {
  const base = { chunkBytes: 4096, salt: Buffer.alloc(16), noncePrefix: Buffer.alloc(7) };
  const decodeWith = (params: { log2N: number; r: number; p: number }) =>
    decodeHeader(encodeHeader({ ...base, params }));

  it("acepta los parámetros que usa el respaldo", () => {
    expect(() => decodeWith(SCRYPT)).not.toThrow();
  });
  it("rechaza costos que superan ~160 MiB de memoria", () => {
    expect(() => decodeWith({ log2N: 17, r: 8, p: 1 })).toThrow(BackupFormatError);
    expect(() => decodeWith({ log2N: 15, r: 16, p: 4 })).toThrow(BackupFormatError);
  });
});

describe("H-15 · download() tiene tiempo máximo y tope de reintentos", () => {
  const src = read("apps/web/src/api.ts");
  const fn = src.slice(src.indexOf("export async function download("));

  it("la petición tiene tiempo máximo", () => {
    expect(fn.slice(0, 400)).toMatch(/signal: AbortSignal\.timeout\(DOWNLOAD_TIMEOUT_MS\)/);
  });
  it("tras refrescar la sesión, un 401 que persiste no vuelve a reintentar", () => {
    expect(fn).toContain("return download(path, filename, false);");
  });
});
