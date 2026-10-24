import { afterEach, expect, it, vi } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { newObjectKey, parsePaymentObjectReference, paymentObjectReference, tenantObjectStore } from "../apps/api/src/tenant-object-store";
import { TenantObjectDeletionWorker } from "../apps/api/src/tenant-object-deletion";
import type { Database } from "../apps/api/src/common";

const previous = {
  tenancy: process.env.PRODUCT_TENANCY,
  nodeEnv: process.env.NODE_ENV,
  directory: process.env.PRODUCT_OBJECT_STORE_DIR,
  retention: process.env.NEXORA_RETENTION,
};
afterEach(() => {
  vi.useRealTimers();
  for (const [key, value] of Object.entries({ PRODUCT_TENANCY: previous.tenancy, NODE_ENV: previous.nodeEnv, PRODUCT_OBJECT_STORE_DIR: previous.directory, NEXORA_RETENTION: previous.retention })) {
    if (value === undefined) delete process.env[key]; else process.env[key] = value;
  }
});

it("guarda objetos locales bajo la empresa y nunca deja leer el de otra", async () => {
  const directory = await mkdtemp(join(tmpdir(), "nexora-objects-"));
  process.env.PRODUCT_TENANCY = "required";
  process.env.NODE_ENV = "test";
  process.env.PRODUCT_OBJECT_STORE_DIR = directory;
  const a = "00000000-0000-4000-8000-000000000101";
  const b = "00000000-0000-4000-8000-000000000102";
  const key = newObjectKey("payment");
  const bytes = Buffer.from("solo la empresa A");
  try {
    const store = tenantObjectStore();
    await store.put(a, key, bytes, "image/png");
    expect(await store.get(a, key)).toEqual(bytes);
    await expect(store.get(b, key)).rejects.toThrow();
    await expect(store.get(a, "../payment/fuera")).rejects.toThrow();
    const reference = paymentObjectReference(key, "image/png", bytes.length);
    expect(parsePaymentObjectReference(reference)).toEqual({ key, mime: "image/png", bytes: bytes.length });
    expect(parsePaymentObjectReference(`data:image/png;base64,${bytes.toString("base64")}`)).toBeNull();
    await store.delete(a, key);
    await expect(store.get(a, key)).rejects.toThrow();
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

it("una caída de PostgreSQL al listar empresas no rechaza el timer de limpieza", async () => {
  const loginTenantIds = vi.fn().mockRejectedValueOnce(new Error("base no disponible")).mockResolvedValue([]);
  const worker = new TenantObjectDeletionWorker({ loginTenantIds } as unknown as Database);
  await expect(worker.run()).resolves.toBeUndefined();
  await expect(worker.run()).resolves.toBeUndefined();
  expect(loginTenantIds).toHaveBeenCalledTimes(2);
});

it("la limpieza de objetos sigue activa aunque la retención general esté desactivada", async () => {
  vi.useFakeTimers();
  process.env.PRODUCT_TENANCY = "required";
  process.env.NEXORA_RETENTION = "off";
  const worker = new TenantObjectDeletionWorker({} as Database);
  const run = vi.spyOn(worker, "run").mockResolvedValue(undefined);
  try {
    worker.onApplicationBootstrap();
    await vi.advanceTimersByTimeAsync(60_000);
    expect(run).toHaveBeenCalledOnce();
  } finally {
    worker.onModuleDestroy();
    run.mockRestore();
  }
});
