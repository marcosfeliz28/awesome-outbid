import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, expect, it } from "vitest";
import { objectReferenceForRow, readPortableObject, recordObjectReference, verifiedPortableBytes } from "../apps/api/src/tenant-object-portability";
import { paymentObjectReference, tenantObjectStore } from "../apps/api/src/tenant-object-store";

const tenant = "10000000-0000-4000-8000-000000000001";
const other = "10000000-0000-4000-8000-000000000002";
const key = "payment/10000000-0000-4000-8000-000000000003";
const prior = { tenancy: process.env.PRODUCT_TENANCY, node: process.env.NODE_ENV, dir: process.env.PRODUCT_OBJECT_STORE_DIR };
afterEach(() => {
  for (const [name, value] of Object.entries({ PRODUCT_TENANCY: prior.tenancy, NODE_ENV: prior.node, PRODUCT_OBJECT_STORE_DIR: prior.dir }))
    if (value === undefined) delete process.env[name]; else process.env[name] = value;
});

it("incluye bytes externos, rechaza objetos alterados y no pisa la copia existente", async () => {
  const dir = await mkdtemp(join(tmpdir(), "nexora-portable-"));
  process.env.PRODUCT_TENANCY = "required";
  process.env.NODE_ENV = "test";
  process.env.PRODUCT_OBJECT_STORE_DIR = dir;
  const bytes = Buffer.from("evidencia de prueba");
  try {
    const store = tenantObjectStore();
    await store.put(tenant, key, bytes, "image/png");
    const reference = objectReferenceForRow("Payment", { proofUrl: paymentObjectReference(key, "image/png", bytes.length) });
    expect(reference).toEqual({ key, mime: "image/png", bytes: bytes.length });
    const collected = new Map();
    recordObjectReference(collected, reference);
    recordObjectReference(collected, objectReferenceForRow("Payment", { proofUrl: paymentObjectReference(key, "image/png", bytes.length) }));
    expect(collected.size).toBe(1);
    const merged = new Map();
    recordObjectReference(merged, { key, mime: "image/png" });
    recordObjectReference(merged, reference);
    expect(merged.get(key)).toEqual(reference);
    const portable = await readPortableObject(tenant, reference!);
    expect(verifiedPortableBytes(portable, reference!)).toEqual(bytes);
    await expect(store.putNew(tenant, key, Buffer.from("malicia"), "image/png")).rejects.toThrow();
    expect(await store.get(tenant, key)).toEqual(bytes);
    await expect(store.get(other, key)).rejects.toThrow();
    await expect(readPortableObject(other, reference!)).rejects.toThrow();
    expect(() => verifiedPortableBytes({ ...portable, base64: Buffer.from("alterado").toString("base64") }, reference!)).toThrow();
    expect(() => objectReferenceForRow("BillingRequest", { proofObjectKey: "../escape", proofMime: "image/png" })).toThrow();
    expect(() => objectReferenceForRow("FutureModel", { receiptObjectKey: key })).toThrow("sin clasificar");
  } finally { await rm(dir, { recursive: true, force: true }); }
});
