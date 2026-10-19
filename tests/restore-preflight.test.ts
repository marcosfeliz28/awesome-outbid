import { mkdtemp } from "node:fs/promises";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import EmbeddedPostgres from "embedded-postgres";
import { describe, expect, it, vi } from "vitest";
import {
  assertEmptyRestoreTarget,
  RESTORE_TARGET_OBJECT_COUNT_SQL,
} from "../scripts/backup.mjs";
import { removeTemporaryDirectory } from "./temp-cleanup";

const freePort = () =>
  new Promise<number>((resolvePort, reject) => {
    const server = createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        server.close();
        reject(new Error("No se pudo reservar el puerto de PostgreSQL."));
        return;
      }
      server.close((error) =>
        error ? reject(error) : resolvePort(address.port),
      );
    });
  });

describe("D-02 · preflight de restauración", () => {
  it("consulta el destino por psql y permite sólo una salida limpia con cero objetos", () => {
    const spawnSyncImpl = vi.fn(() => ({ status: 0, stdout: "0\n" }));
    expect(() =>
      assertEmptyRestoreTarget(
        { PGDATABASE: "restore_test" },
        { spawnSyncImpl },
      ),
    ).not.toThrow();
    expect(spawnSyncImpl).toHaveBeenCalledWith(
      "psql",
      expect.arrayContaining([
        "--no-password",
        "--set=ON_ERROR_STOP=1",
        "--command",
      ]),
      expect.objectContaining({
        encoding: "utf8",
        windowsHide: true,
        env: { PGDATABASE: "restore_test" },
      }),
    );
  });

  it("rechaza una base con objetos antes de iniciar pg_restore", () => {
    const spawnSyncImpl = vi.fn(() => ({ status: 0, stdout: "1\n" }));
    expect(() =>
      assertEmptyRestoreTarget({}, { spawnSyncImpl }),
    ).toThrow("La base de destino no está vacía; se rechazó la restauración.");
    expect(spawnSyncImpl).toHaveBeenCalledOnce();
  });

  it("falla cerrado si psql no existe o no puede comprobar la base", () => {
    expect(() =>
      assertEmptyRestoreTarget({}, {
        spawnSyncImpl: () => ({ status: null, stdout: "", error: { code: "ENOENT" } }),
      }),
    ).toThrow("No se encontró psql");
    expect(() =>
      assertEmptyRestoreTarget({}, {
        spawnSyncImpl: () => ({ status: 2, stdout: "", stderr: "no details" }),
      }),
    ).toThrow("No se pudo comprobar que la base de destino esté vacía");
  });

  it("la consulta exacta del preflight reconoce una base vacía y una con tabla", async () => {
    const dir = await mkdtemp(join(tmpdir(), "nexora-restore-preflight-"));
    const database = new EmbeddedPostgres({
      databaseDir: dir,
      user: "nexora_test",
      password: "nexora_test_only",
      port: await freePort(),
      // Keep cleanup under the retry helper; embedded-postgres itself calls
      // fs.rm without retries when persistent is false.
      persistent: true,
      authMethod: "scram-sha-256",
      initdbFlags: ["--encoding=UTF8", "--locale=C"],
      postgresFlags: ["-c", "listen_addresses=127.0.0.1"],
      onLog: () => undefined,
      onError: () => undefined,
    });
    let client: any;
    try {
      await database.initialise();
      await database.start();
      await database.createDatabase("restore_preflight");
      client = database.getPgClient("restore_preflight", "127.0.0.1");
      await client.connect();
      const empty = await client.query(RESTORE_TARGET_OBJECT_COUNT_SQL);
      expect(empty.rows[0].object_count).toBe("0");
      await client.query("CREATE TABLE preserve_me (id integer)");
      const nonempty = await client.query(RESTORE_TARGET_OBJECT_COUNT_SQL);
      expect(Number(nonempty.rows[0].object_count)).toBeGreaterThan(0);
      await client.query("DROP TABLE preserve_me");
      await client.query("CREATE DOMAIN public.preserve_me AS text");
      const typed = await client.query(RESTORE_TARGET_OBJECT_COUNT_SQL);
      expect(Number(typed.rows[0].object_count)).toBeGreaterThan(0);
    } finally {
      try {
        if (client) await client.end();
      } finally {
        try {
          await database.stop();
        } finally {
          await removeTemporaryDirectory(dir);
        }
      }
    }
  }, 120_000);

});
