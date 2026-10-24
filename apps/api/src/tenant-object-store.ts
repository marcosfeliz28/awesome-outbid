import { GetObjectCommand, PutObjectCommand, DeleteObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { HttpException } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, unlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve, sep } from "node:path";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const OBJECT_KEY = /^(payment|billing|invoice)\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface TenantObjectStore {
  put(tenantId: string, key: string, bytes: Buffer, mime: string): Promise<void>;
  get(tenantId: string, key: string): Promise<Buffer>;
  delete(tenantId: string, key: string): Promise<void>;
}

export function newObjectKey(kind: "payment" | "billing" | "invoice") {
  return `${kind}/${randomUUID()}`;
}

function scopedKey(tenantId: string, key: string) {
  if (!UUID.test(tenantId) || !OBJECT_KEY.test(key)) throw new HttpException("Archivo inválido.", 400);
  return `${tenantId.toLowerCase()}/${key.toLowerCase()}`;
}

class LocalTenantObjectStore implements TenantObjectStore {
  constructor(private readonly root: string) {}
  private path(tenantId: string, key: string) {
    const root = resolve(this.root);
    const path = resolve(root, scopedKey(tenantId, key));
    if (!path.startsWith(root + sep)) throw new HttpException("Archivo inválido.", 400);
    return path;
  }
  async put(tenantId: string, key: string, bytes: Buffer) {
    const path = this.path(tenantId, key);
    await mkdir(dirname(path), { recursive: true });
    const temporary = `${path}.${randomUUID()}.tmp`;
    try {
      await writeFile(temporary, bytes, { flag: "wx", mode: 0o600 });
      await rename(temporary, path);
    } catch (error) {
      await unlink(temporary).catch(() => undefined);
      throw error;
    }
  }
  async get(tenantId: string, key: string) {
    return readFile(this.path(tenantId, key));
  }
  async delete(tenantId: string, key: string) {
    await unlink(this.path(tenantId, key)).catch((error: NodeJS.ErrnoException) => {
      if (error.code !== "ENOENT") throw error;
    });
  }
}

class S3TenantObjectStore implements TenantObjectStore {
  private readonly client: S3Client;
  constructor(private readonly bucket: string, region: string, endpoint?: string) {
    this.client = new S3Client({ region, ...(endpoint ? { endpoint, forcePathStyle: true } : {}) });
  }
  async put(tenantId: string, key: string, bytes: Buffer, mime: string) {
    await this.client.send(new PutObjectCommand({
      Bucket: this.bucket, Key: scopedKey(tenantId, key), Body: bytes, ContentType: mime,
      ServerSideEncryption: "AES256",
    }));
  }
  async get(tenantId: string, key: string) {
    const row = await this.client.send(new GetObjectCommand({ Bucket: this.bucket, Key: scopedKey(tenantId, key) }));
    if (!row.Body) throw new HttpException("Archivo no disponible.", 503);
    return Buffer.from(await row.Body.transformToByteArray());
  }
  async delete(tenantId: string, key: string) {
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: scopedKey(tenantId, key) }));
  }
}

/** Local sólo en pruebas; producción falla cerrada sin bucket S3 por empresa. */
export function tenantObjectStore(): TenantObjectStore {
  if (process.env.PRODUCT_TENANCY !== "required")
    throw new HttpException("Almacenamiento de producto no disponible.", 503);
  if (process.env.NODE_ENV === "test")
    return new LocalTenantObjectStore(process.env.PRODUCT_OBJECT_STORE_DIR || join(tmpdir(), "nexora-product-objects-test", String(process.pid)));
  const bucket = process.env.PRODUCT_OBJECT_BUCKET?.trim();
  const region = process.env.PRODUCT_OBJECT_REGION?.trim();
  if (!bucket || !region) throw new HttpException("Almacenamiento de objetos no configurado.", 503);
  return new S3TenantObjectStore(bucket, region, process.env.PRODUCT_OBJECT_ENDPOINT?.trim());
}

const PAYMENT_REF = /^object:v1:(payment\/[0-9a-f-]{36}):(image\/(?:png|jpeg|webp)):(\d{1,8})$/i;
export function paymentObjectReference(key: string, mime: string, bytes: number) {
  if (!OBJECT_KEY.test(key) || !key.startsWith("payment/") || !/^image\/(png|jpeg|webp)$/.test(mime) || bytes < 1 || bytes > 2 * 1024 * 1024)
    throw new HttpException("Evidencia inválida.", 400);
  return `object:v1:${key}:${mime}:${bytes}`;
}
export function parsePaymentObjectReference(value: string | null | undefined) {
  const match = PAYMENT_REF.exec(value ?? "");
  return match ? { key: match[1], mime: match[2], bytes: Number(match[3]) } : null;
}
