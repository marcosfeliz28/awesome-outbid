import { isLocalLicenseReadOnlyFailure } from "./local-license";

type Row = { id: string; input: unknown };
type Dependencies<T extends Row> = {
  send: (row: T) => Promise<void>;
  remove: (id: string) => Promise<unknown>;
  markPending: (id: string, message: string) => Promise<unknown>;
  markConflict: (id: string, message: string) => Promise<unknown>;
  online: () => boolean;
};

export type MerchandiseSyncResult = {
  synced: number;
  conflicts: number;
  retry: number;
};

export const merchandiseFailureStatus = (
  failure: unknown,
  online = navigator.onLine,
) =>
  !online || failure instanceof TypeError || isLocalLicenseReadOnlyFailure(failure)
    ? "pending"
    : "conflict";

/**
 * Sincroniza en orden. Un 423 significa que la licencia completa está en
 * solo lectura: conserva la fila pendiente y detiene el lote para que una
 * renovación posterior reintente exactamente la misma operación.
 */
export async function syncMerchandiseRows<T extends Row>(
  rows: T[],
  dependencies: Dependencies<T>,
): Promise<MerchandiseSyncResult> {
  const result = { synced: 0, conflicts: 0, retry: 0 };
  for (const row of rows) {
    try {
      await dependencies.send(row);
      await dependencies.remove(row.id);
      result.synced++;
    } catch (failure: any) {
      const status = merchandiseFailureStatus(failure, dependencies.online());
      if (status === "pending") {
        await dependencies.markPending(row.id, failure?.message ?? "Pendiente de sincronizar.");
        result.retry++;
        break;
      }
      await dependencies.markConflict(
        row.id,
        failure?.message ?? "La operación requiere revisión.",
      );
      result.conflicts++;
    }
  }
  return result;
}
