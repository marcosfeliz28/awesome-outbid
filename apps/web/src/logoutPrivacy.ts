import type Dexie from "dexie";
import type { Table } from "dexie";

type LogoutDatabase = {
  transaction: Dexie["transaction"];
  cache: Table<{ key: string; data: any }, string>;
  sales: Table<any, string>;
  merchandise: Table<any, string>;
};

/** No borra colas: incluso conflictos siguen siendo operaciones recuperables. */
export async function hasLogoutPending(db: LogoutDatabase) {
  return (await db.sales.count()) > 0 || (await db.merchandise.count()) > 0;
}

export async function clearLogoutCache(db: LogoutDatabase, revoked: boolean) {
  await db.transaction("rw", [db.cache, db.sales, db.merchandise], async () => {
    if (await hasLogoutPending(db)) {
      // El bloqueo por inactividad no puede destruir operaciones pendientes.
      await db.cache.update("session", { "data.expiresAt": 0 });
      return;
    }
    await db.cache.clear();
    // Sólo un marcador sin usuario/token evita renovar una cookie offline viva.
    if (!revoked)
      await db.cache.put({ key: "session", data: { expiresAt: 0 } });
  });
}
