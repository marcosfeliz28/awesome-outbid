import { createHash } from "node:crypto";
import { parsePaymentObjectReference, tenantObjectStore, type TenantObjectStore } from "./tenant-object-store";

export type PortableObject = { key: string; mime: string; sha256: string; base64: string };
export type ObjectReference = { key: string; mime: string; bytes?: number };
const MAX_OBJECT_BYTES = 16 * 1024 * 1024;
const KEY = /^(payment|billing|invoice)\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** The only fields that may point to the external product object store. */
export function objectReferenceForRow(table: string, row: Record<string, unknown>): ObjectReference | null {
  if (table === "Payment" && typeof row.proofUrl === "string" && row.proofUrl.startsWith("object:")) {
    const ref = parsePaymentObjectReference(row.proofUrl);
    if (!ref) throw new Error("Referencia de comprobante de pago inválida.");
    return ref;
  }
  if (table === "InvoiceAttachment" && row.objectKey != null)
    return checkedReference(row.objectKey, row.mime);
  if (table === "BillingRequest" && row.proofObjectKey != null)
    return checkedReference(row.proofObjectKey, row.proofMime);
  // A future migration must not add another external key that exports only
  // the reference. The deletion ledger is intentionally not a live reference.
  if (table !== "TenantObjectDeletion" && Object.entries(row).some(([field, value]) =>
    value != null && /(?:^objectKey$|ObjectKey$)/.test(field)))
    throw new Error(`Objeto externo sin clasificar en ${table}.`);
  return null;
}

function checkedReference(key: unknown, mime: unknown): ObjectReference {
  if (typeof key !== "string" || !KEY.test(key) || typeof mime !== "string" || !/^(image\/(png|jpeg|webp)|application\/pdf|text\/csv|application\/vnd\.openxmlformats-officedocument\.spreadsheetml\.sheet)$/.test(mime))
    throw new Error("Referencia de objeto inválida en la base.");
  return { key, mime };
}

export function recordObjectReference(target: Map<string, ObjectReference>, ref: ObjectReference | null) {
  if (!ref) return;
  const previous = target.get(ref.key);
  if (previous && (previous.mime !== ref.mime || (previous.bytes != null && ref.bytes != null && previous.bytes !== ref.bytes)))
    throw new Error("Referencias contradictorias del mismo objeto.");
  target.set(ref.key, previous ? { ...previous, bytes: previous.bytes ?? ref.bytes } : ref);
}

export async function readPortableObject(tenantId: string, ref: ObjectReference, store: TenantObjectStore = tenantObjectStore()): Promise<PortableObject> {
  const bytes = await store.get(tenantId, ref.key);
  if (!bytes.length || bytes.length > MAX_OBJECT_BYTES || (ref.bytes != null && bytes.length !== ref.bytes))
    throw new Error(`Tamaño inválido o incompleto del objeto ${ref.key}.`);
  return { key: ref.key, mime: ref.mime, sha256: createHash("sha256").update(bytes).digest("hex"), base64: bytes.toString("base64") };
}

export function verifiedPortableBytes(object: PortableObject, ref: ObjectReference): Buffer {
  if (object.key !== ref.key || object.mime !== ref.mime || !/^[a-f0-9]{64}$/.test(object.sha256) ||
    !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(object.base64))
    throw new Error("Manifiesto de objeto inválido.");
  const bytes = Buffer.from(object.base64, "base64");
  if (!bytes.length || bytes.length > MAX_OBJECT_BYTES || (ref.bytes != null && bytes.length !== ref.bytes) ||
    createHash("sha256").update(bytes).digest("hex") !== object.sha256)
    throw new Error("Objeto incompleto o alterado en el respaldo.");
  return bytes;
}
