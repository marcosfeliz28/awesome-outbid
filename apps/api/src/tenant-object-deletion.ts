import { Inject, Injectable, Logger } from "@nestjs/common";
import { Database } from "./common";
import { tenantScope } from "./tenant-context";
import { tenantObjectStore } from "./tenant-object-store";

const HOUR = 3_600_000;
const ORPHAN_GRACE_MS = 24 * HOUR;

/** Reserva durable antes de subir bytes: si la petición cae, el worker los elimina. */
export async function reserveTenantObject(db: Database, tenantId: string, objectKey: string) {
  await db.tenantObjectDeletion.create({ data: {
    tenantId, objectKey, nextAttemptAt: new Date(Date.now() + ORPHAN_GRACE_MS),
  } });
}

/** Reintenta borrados confirmados por la base; incluye empresas suspendidas. */
export async function processTenantObjectDeletions(db: Database, tenantId: string, now = new Date()) {
  return tenantScope.run({ tenantId }, async () => {
    const due = await db.tenantObjectDeletion.findMany({
      where: { nextAttemptAt: { lte: now } },
      orderBy: { createdAt: "asc" }, take: 100,
      select: { id: true, objectKey: true, attempts: true },
    });
    if (!due.length) return 0;
    const store = tenantObjectStore();
    let removed = 0;
    for (const row of due) {
      try {
        await store.delete(tenantId, row.objectKey);
        await db.tenantObjectDeletion.deleteMany({ where: { id: row.id } });
        removed++;
      } catch {
        const attempts = row.attempts + 1;
        await db.tenantObjectDeletion.updateMany({ where: { id: row.id }, data: {
          attempts, nextAttemptAt: new Date(now.getTime() + Math.min(24, 2 ** Math.min(attempts, 5)) * HOUR),
        } });
      }
    }
    return removed;
  });
}

@Injectable()
export class TenantObjectDeletionWorker {
  private readonly logger = new Logger(TenantObjectDeletionWorker.name);
  private first?: ReturnType<typeof setTimeout>;
  private timer?: ReturnType<typeof setInterval>;
  private running = false;
  constructor(@Inject(Database) private readonly db: Database) {}
  onApplicationBootstrap() {
    if (process.env.PRODUCT_TENANCY !== "required") return;
    this.first = setTimeout(() => void this.run(), 60_000);
    this.first.unref();
    this.timer = setInterval(() => void this.run(), HOUR);
    this.timer.unref();
  }
  onModuleDestroy() {
    if (this.first) clearTimeout(this.first);
    if (this.timer) clearInterval(this.timer);
  }
  async run() {
    if (this.running) return;
    this.running = true;
    try {
      for (const tenantId of await this.db.loginTenantIds()) {
        await processTenantObjectDeletions(this.db, tenantId).catch(() => {
          this.logger.error("No se pudo limpiar el almacenamiento de una empresa; se reintentará.");
        });
      }
    } catch {
      // El timer nunca puede emitir un rechazo no manejado durante una caída de PostgreSQL.
      this.logger.error("No se pudo consultar la cola de objetos; se reintentará.");
    } finally {
      this.running = false;
    }
  }
}
