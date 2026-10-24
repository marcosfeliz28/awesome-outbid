import { mkdtemp, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { PrismaClient } from "@prisma/client";
import type { Response } from "express";
import { expect, it } from "vitest";
import { exportTenantToFile, sendTenantExportFile } from "../apps/api/src/tenant-export";
import { tenantScope } from "../apps/api/src/tenant-context";

const tenantId = "70000000-0000-4000-8000-000000000001";

it("el exportador real elimina su directorio privado si open falla antes de la transacción", async () => {
  let directory = "";
  try {
    await expect(tenantScope.run({ tenantId }, () => exportTenantToFile(
      {} as PrismaClient, tenantId, "json", undefined, {
        createDirectory: async (prefix) => {
          directory = await mkdtemp(prefix);
          return directory;
        },
        createFile: async () => { throw new Error("FALLO_OPEN_INYECTADO"); },
      },
    ))).rejects.toThrow("FALLO_OPEN_INYECTADO");
    expect(directory).toMatch(/^.+nexora-tenant-export-/);
    await expect(stat(directory)).rejects.toMatchObject({ code: "ENOENT" });
  } finally {
    if (directory) await rm(directory, { recursive: true, force: true });
  }
});

it("la descarga real limpia el archivo si Express avisa una cancelación asíncrona", async () => {
  const directory = await mkdtemp(join(tmpdir(), "nexora-tenant-download-"));
  const path = join(directory, "empresa.json");
  await writeFile(path, "{}", { mode: 0o600 });
  const headers = new Map<string, string>();
  const response = {
    setHeader: (name: string, value: string) => { headers.set(name, value); },
    download: (_path: string, callback: (error: Error) => void) => {
      queueMicrotask(() => callback(new Error("CLIENTE_CANCELO_DESCARGA")));
    },
  } as unknown as Response;
  try {
    await expect(sendTenantExportFile(response, { directory, path, rows: 0, maxRowsBuffered: 0 }, "json", tenantId))
      .rejects.toThrow("CLIENTE_CANCELO_DESCARGA");
    expect(headers.get("Cache-Control")).toContain("no-store");
    await expect(stat(directory)).rejects.toMatchObject({ code: "ENOENT" });
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
