import { spawnSync } from "node:child_process";
import {
  copyFileSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  statSync,
  truncateSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { restoreDump, verifyDump } from "../scripts/backup.mjs";

// Requiere un PostgreSQL descartable: BACKUP_TEST_ADMIN_URL con un usuario que
// pueda crear bases (p. ej. postgresql://usuario@127.0.0.1:5791/postgres) y
// pg_dump/pg_restore/psql en el PATH. Sin eso se salta con un mensaje claro.
const adminUrl = process.env.BACKUP_TEST_ADMIN_URL;
const hasTools = ["pg_dump", "pg_restore", "psql"].every(
  (t) => spawnSync(t, ["--version"]).status === 0,
);
const enabled = Boolean(adminUrl) && hasTools;
if (!enabled) {
  console.warn(
    "[backup-restore] SALTADA: define BACKUP_TEST_ADMIN_URL (PostgreSQL descartable) y ten pg_dump/pg_restore/psql en el PATH.",
  );
}

const suffix = `${process.pid}_${Date.now()}`;
const sourceDb = `bkt_src_${suffix}`;
const createdDbs: string[] = [];
let dir = "";

function urlFor(db: string) {
  const u = new URL(adminUrl!);
  u.pathname = `/${db}`;
  return u.toString();
}
function psql(db: string, sql: string) {
  const r = spawnSync(
    "psql",
    [urlFor(db), "-v", "ON_ERROR_STOP=1", "-At", "-c", sql],
    { encoding: "utf8" },
  );
  if (r.status !== 0) throw new Error(r.stderr);
  return r.stdout.trim();
}
function newDb(name: string) {
  psql("postgres", `CREATE DATABASE "${name}"`);
  createdDbs.push(name);
  return name;
}
function tableCount(db: string) {
  return Number(
    psql(
      db,
      "SELECT count(*) FROM information_schema.tables WHERE table_schema='public'",
    ),
  );
}
function makeDump(name: string) {
  const dump = join(dir, name);
  const r = spawnSync(
    "pg_dump",
    ["--format=custom", "--file", dump, urlFor(sourceDb)],
    { encoding: "utf8" },
  );
  expect(r.status, r.stderr).toBe(0);
  return dump;
}
async function sidecars(dump: string) {
  const { createHash } = await import("node:crypto");
  const sha = createHash("sha256").update(readFileSync(dump)).digest("hex");
  writeFileSync(`${dump}.sha256`, `${sha} *x\n`);
  writeFileSync(
    `${dump}.json`,
    JSON.stringify({ sha256: sha, bytes: statSync(dump).size }),
  );
  return sha;
}

describe.skipIf(!enabled)(
  "Respaldo · verificación y restauración atómica",
  () => {
    beforeAll(() => {
      dir = mkdtempSync(join(tmpdir(), "bkt-"));
      newDb(sourceDb);
      psql(
        sourceDb,
        `CREATE TABLE a (id int primary key, v text);
       CREATE TABLE b (id int primary key, a_id int references a(id));
       INSERT INTO a SELECT g, repeat('x', 200) FROM generate_series(1, 3000) g;
       INSERT INTO b SELECT g, g FROM generate_series(1, 3000) g;`,
      );
    });
    afterAll(() => {
      for (const db of createdDbs)
        spawnSync("psql", [
          urlFor("postgres"),
          "-c",
          `DROP DATABASE IF EXISTS "${db}"`,
        ]);
      if (dir) rmSync(dir, { recursive: true, force: true });
    });

    it("acepta un dump íntegro", async () => {
      const dump = makeDump("ok.dump");
      await sidecars(dump);
      await expect(verifyDump(dump)).resolves.toMatchObject({
        bytes: statSync(dump).size,
      });
    });

    it("dump truncado: pg_restore --list lo acepta pero la verificación falla", async () => {
      const dump = makeDump("trunc.dump");
      await sidecars(dump);
      truncateSync(dump, Math.floor(statSync(dump).size / 2));
      expect(spawnSync("pg_restore", ["--list", dump]).status).toBe(0);
      await expect(verifyDump(dump)).rejects.toThrow(/Tamaño|SHA-256/);
      const target = newDb(`bkt_t_${suffix}`);
      await expect(restoreDump(dump, urlFor(target))).rejects.toThrow(
        /Tamaño|SHA-256/,
      );
      expect(tableCount(target)).toBe(0);
    });

    it("sha256 alterado: la verificación falla", async () => {
      const dump = makeDump("sha.dump");
      const sha = await sidecars(dump);
      const bad = (sha[0] === "0" ? "1" : "0") + sha.slice(1);
      writeFileSync(`${dump}.sha256`, `${bad} *x\n`);
      writeFileSync(
        `${dump}.json`,
        JSON.stringify({ sha256: bad, bytes: statSync(dump).size }),
      );
      await expect(verifyDump(dump)).rejects.toThrow(/SHA-256/);
    });

    it("restauración fallida con --single-transaction no deja tablas parciales", async () => {
      const dump = makeDump("fail.dump");
      await sidecars(dump);
      // Base destino con una tabla "b" incompatible: el restore crea "a", falla en "b".
      const target = newDb(`bkt_f_${suffix}`);
      psql(target, "CREATE TABLE b (id int)");
      await expect(restoreDump(dump, urlFor(target))).rejects.toThrow(
        /pg_restore/,
      );
      // Atómico: "a" no quedó creada; solo sigue la "b" preexistente.
      expect(tableCount(target)).toBe(1);
      expect(psql(target, "SELECT to_regclass('public.a')")).toBe("");

      // Contraste: sin --single-transaction (jobs>1) sí queda parcial.
      const target2 = newDb(`bkt_p_${suffix}`);
      psql(target2, "CREATE TABLE b (id int)");
      await expect(
        restoreDump(dump, urlFor(target2), { jobs: 2 }),
      ).rejects.toThrow();
      expect(tableCount(target2)).toBeGreaterThan(1);
    });

    it("restaura un dump íntegro con conteos idénticos", async () => {
      const dump = makeDump("good.dump");
      await sidecars(dump);
      const target = newDb(`bkt_g_${suffix}`);
      await restoreDump(dump, urlFor(target));
      expect(psql(target, "SELECT count(*) FROM a")).toBe("3000");
      expect(psql(target, "SELECT count(*) FROM b")).toBe("3000");
      copyFileSync(dump, join(dir, "copia.dump"));
    });
  },
);
