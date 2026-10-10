// Respaldo a Google Drive: piezas puras (cifrado NXBK, token, state OAuth,
// nombres, retención, calendario) y el descifrador independiente
// scripts/decrypt-backup.mjs. La integración con un Google falso y una base
// real está en tests/drive-backup.test.ts.
import { describe, expect, it } from "vitest";
import { randomBytes, createHash } from "node:crypto";
import {
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { Writable } from "node:stream";
import {
  HEADER_BYTES,
  TAG_BYTES,
  backupName,
  createDecryptStream,
  createEncryptStream,
  decodeHeader,
  maskAccount,
  nextScheduledRun,
  openSecret,
  parseBackupName,
  pkceChallenge,
  pkceVerifier,
  retentionPlan,
  sanitizeBackupError,
  scheduledRunDue,
  sealSecret,
  signState,
  stateKey,
  verifyState,
} from "../apps/api/src/drive-backup-core";
import {
  driveBackupSettings,
  pgEnvironment,
} from "../apps/api/src/drive-backup";
// @ts-expect-error -- script .mjs sin tipos
import { decryptBackup } from "../scripts/decrypt-backup.mjs";

const PASS = "frase-de-prueba-larga-2026-ñandú";
const FAST = { chunkBytes: 4096, params: { log2N: 14, r: 8, p: 1 } };

async function encrypt(plain: Buffer, pass = PASS, pieces = 7) {
  const out: Buffer[] = [];
  const parts: Buffer[] = [];
  for (let i = 0; i < plain.length; i += pieces * 97)
    parts.push(plain.subarray(i, i + pieces * 97));
  await pipeline(
    Readable.from(parts),
    await createEncryptStream(pass, FAST),
    new Writable({
      write(chunk, _e, done) {
        out.push(chunk);
        done();
      },
    }),
  );
  return Buffer.concat(out);
}
async function decrypt(sealed: Buffer, pass = PASS) {
  const out: Buffer[] = [];
  const parts: Buffer[] = [];
  for (let i = 0; i < sealed.length; i += 1000)
    parts.push(sealed.subarray(i, i + 1000));
  await pipeline(
    Readable.from(parts),
    createDecryptStream(pass),
    new Writable({
      write(chunk, _e, done) {
        out.push(chunk);
        done();
      },
    }),
  );
  return Buffer.concat(out);
}
const dump = (n: number) =>
  Buffer.concat([
    Buffer.from("PGDMP"),
    randomBytes(Math.max(0, n - 5)),
  ]).subarray(0, n);

describe("Formato NXBK v1 (cifrado en flujo por bloques)", () => {
  it("cifra y descifra contenidos de todos los tamaños de borde", async () => {
    for (const size of [0, 1, 4095, 4096, 4097, 8192, 3 * 4096 + 17]) {
      const plain = randomBytes(size);
      const sealed = await encrypt(plain);
      const chunks = Math.max(1, Math.ceil(size / 4096));
      expect(sealed.length).toBe(HEADER_BYTES + size + chunks * TAG_BYTES);
      expect((await decrypt(sealed)).equals(plain)).toBe(true);
    }
  });

  it("cabecera documentada; sal y nonce nuevos en cada archivo", async () => {
    const plain = dump(5000);
    const [a, b] = [await encrypt(plain), await encrypt(plain)];
    expect(a.subarray(0, 4).toString()).toBe("NXBK");
    expect(a[4]).toBe(1);
    const h = decodeHeader(a);
    expect(h.params).toEqual({ log2N: 14, r: 8, p: 1 });
    expect(h.chunkBytes).toBe(4096);
    expect(h.salt.equals(decodeHeader(b).salt)).toBe(false);
    expect(a.subarray(HEADER_BYTES).equals(b.subarray(HEADER_BYTES))).toBe(
      false,
    );
    // Ni el contenido en claro aparece en el cifrado.
    expect(a.includes(plain.subarray(0, 64))).toBe(false);
  });

  it("detecta frase incorrecta y cualquier manipulación", async () => {
    const plain = randomBytes(3 * 4096 + 100);
    const sealed = await encrypt(plain);
    const block = 4096 + TAG_BYTES;
    await expect(decrypt(sealed, PASS + "x")).rejects.toThrow(/frase/);
    const flips = [
      13, // sal (cabecera)
      30, // prefijo del nonce (cabecera)
      HEADER_BYTES + 5, // texto cifrado del bloque 0
      HEADER_BYTES + block - 1, // etiqueta del bloque 0
      sealed.length - 1, // etiqueta del último bloque
    ];
    for (const at of flips) {
      const bad = Buffer.from(sealed);
      bad[at] ^= 1;
      await expect(decrypt(bad)).rejects.toThrow();
    }
    // Cortado justo en el límite de un bloque: falta la marca de final.
    await expect(
      decrypt(sealed.subarray(0, HEADER_BYTES + 2 * block)),
    ).rejects.toThrow();
    // Cortado a mitad, sin cuerpo o sin cabecera completa.
    await expect(
      decrypt(sealed.subarray(0, sealed.length - 7)),
    ).rejects.toThrow();
    await expect(decrypt(sealed.subarray(0, HEADER_BYTES))).rejects.toThrow();
    await expect(decrypt(sealed.subarray(0, 20))).rejects.toThrow();
    // Bloques intercambiados.
    const swapped = Buffer.concat([
      sealed.subarray(0, HEADER_BYTES),
      sealed.subarray(HEADER_BYTES + block, HEADER_BYTES + 2 * block),
      sealed.subarray(HEADER_BYTES, HEADER_BYTES + block),
      sealed.subarray(HEADER_BYTES + 2 * block),
    ]);
    await expect(decrypt(swapped)).rejects.toThrow();
    // Bloque añadido al final.
    await expect(
      decrypt(
        Buffer.concat([
          sealed,
          sealed.subarray(HEADER_BYTES, HEADER_BYTES + block),
        ]),
      ),
    ).rejects.toThrow();
  });

  it("rechaza cabeceras ajenas o con parámetros que agotarían la memoria", () => {
    const base = Buffer.alloc(HEADER_BYTES);
    Buffer.from("NXBK").copy(base);
    base[4] = 1;
    base[5] = 1;
    base[6] = 15;
    base[7] = 8;
    base[8] = 1;
    base.writeUInt32BE(4096, 9);
    expect(() => decodeHeader(base)).not.toThrow();
    const variants: [number, number][] = [
      [0, 0x41], // magia
      [4, 2], // versión
      [5, 2], // KDF
      [6, 24], // N enorme
      [7, 200], // r
    ];
    for (const [at, value] of variants) {
      const bad = Buffer.from(base);
      bad[at] = value;
      expect(() => decodeHeader(bad)).toThrow();
    }
    const big = Buffer.from(base);
    big.writeUInt32BE(64 * 1024 * 1024, 9);
    expect(() => decodeHeader(big)).toThrow();
  });

  it("scripts/decrypt-backup.mjs (implementación independiente) abre lo que cifra la API", async () => {
    const dir = mkdtempSync(join(tmpdir(), "nxbk-test-"));
    try {
      const plain = dump(4096 * 5 + 333);
      const input = join(dir, "nexora-2026-10-10-0330.dump.enc");
      writeFileSync(input, await encrypt(plain));
      const output = join(dir, "salida.dump");
      const result = await decryptBackup(input, output, PASS);
      expect(readFileSync(output).equals(plain)).toBe(true);
      const sha = createHash("sha256").update(plain).digest("hex");
      expect(result.sha256).toBe(sha);
      // Lo que restore.mjs exige antes de restaurar.
      const manifest = JSON.parse(readFileSync(output + ".json", "utf8"));
      expect(manifest).toMatchObject({
        schemaVersion: 1,
        bytes: plain.length,
        sha256: sha,
        file: "salida.dump",
      });
      expect(readFileSync(output + ".sha256", "utf8")).toBe(
        `${sha} *salida.dump\n`,
      );

      // Frase errónea o archivo alterado: no deja nada a medias.
      const bad = join(dir, "malo.dump");
      await expect(decryptBackup(input, bad, PASS + "!")).rejects.toThrow(
        /frase/,
      );
      const tampered = readFileSync(input);
      tampered[tampered.length - 3] ^= 0x10;
      writeFileSync(join(dir, "t.dump.enc"), tampered);
      await expect(
        decryptBackup(join(dir, "t.dump.enc"), bad, PASS),
      ).rejects.toThrow();
      const names = readdirSync(dir);
      expect(names.filter((n) => n.startsWith("malo"))).toEqual([]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe("Permiso de Google cifrado en reposo", () => {
  it("sella y abre; otra frase o un cambio no abren", async () => {
    const token = "1//0gFAKE-refresh-token-for-tests_abcdefghijklmnop";
    const sealed = await sealSecret(token, PASS);
    expect(sealed.startsWith("v1.")).toBe(true);
    expect(sealed).not.toContain(token);
    expect(sealed).not.toBe(await sealSecret(token, PASS));
    expect(await openSecret(sealed, PASS)).toBe(token);
    await expect(openSecret(sealed, PASS + "x")).rejects.toThrow();
    const raw = Buffer.from(sealed.slice(3), "base64url");
    raw[raw.length - 1] ^= 1;
    await expect(
      openSecret("v1." + raw.toString("base64url"), PASS),
    ).rejects.toThrow();
    await expect(openSecret("v2.xxx", PASS)).rejects.toThrow();
  });
});

describe("state de OAuth y PKCE", () => {
  const key = stateKey("jwt-secret-de-prueba-con-32-caracteres!!");
  const payload = {
    u: "user",
    s: "session",
    n: "a".repeat(64),
    e: Date.now() + 60000,
  };
  it("válido sólo con la firma correcta y antes de caducar", () => {
    const state = signState(payload, key);
    expect(verifyState(state, key)).toEqual(payload);
    expect(
      verifyState(state, stateKey("otro-secreto-de-prueba-con-32-caracteres")),
    ).toBeNull();
    expect(verifyState(state, key, payload.e + 1)).toBeNull();
    const [body, mac] = state.split(".");
    const forged = Buffer.from(
      JSON.stringify({ v: 1, ...payload, u: "otra" }),
    ).toString("base64url");
    expect(verifyState(forged + "." + mac, key)).toBeNull();
    expect(verifyState(body + "." + mac + ".x", key)).toBeNull();
    for (const bad of [undefined, 5, "", "abc", "a.b", "x".repeat(5000)])
      expect(verifyState(bad, key)).toBeNull();
  });
  it("PKCE S256 derivado de la cookie", () => {
    const v = pkceVerifier(key, "nonce");
    expect(v).toMatch(/^[\w-]{43}$/);
    expect(pkceVerifier(key, "otro")).not.toBe(v);
    expect(pkceChallenge(v)).toBe(
      createHash("sha256").update(v).digest("base64url"),
    );
  });
});

describe("Nombres en hora de Santo Domingo", () => {
  it("nexora-AAAA-MM-DD-HHmm.dump.enc", () => {
    expect(backupName(new Date("2026-10-10T07:30:00Z"))).toBe(
      "nexora-2026-10-10-0330.dump.enc",
    );
    // Medianoche local: aún es 31 de diciembre.
    expect(backupName(new Date("2026-01-01T03:59:00Z"))).toBe(
      "nexora-2025-12-31-2359.dump.enc",
    );
    expect(parseBackupName("nexora-2026-10-10-0330.dump.enc")).toEqual({
      day: "2026-10-10",
      month: "2026-10",
      stamp: "202610100330",
    });
    for (const bad of [
      "nexora-2026-13-10-0330.dump.enc",
      "nexora-2026-10-10-2460.dump.enc",
      "nexora-2026-10-10-0330.dump",
      "Copia de nexora-2026-10-10-0330.dump.enc",
      "nexora-2026-10-10-0330.dump.enc.txt",
      "notas.txt",
      null,
    ])
      expect(parseBackupName(bad)).toBeNull();
  });
});

describe("Retención: 30 diarias + 12 mensuales", () => {
  const file = (day: string, hhmm = "0330", id = day + hhmm) => ({
    id,
    name: `nexora-${day}-${hhmm}.dump.enc`,
  });
  const days = (count: number, start = Date.UTC(2026, 9, 10)) =>
    Array.from({ length: count }, (_, i) =>
      new Date(start - i * 86400000).toISOString().slice(0, 10),
    );

  it("con 45 días seguidos conserva los 30 últimos y el primero de cada mes", () => {
    const files = days(45).map((d) => file(d));
    const plan = retentionPlan(files);
    const kept = plan.keep.map((f) => f.id).sort();
    const expected = new Set(days(30).map((d) => d + "0330"));
    // Primeros de mes presentes: 2026-08-27 (primero en la lista de agosto), 09-01, 10-01.
    expected.add("2026-08-270330");
    expected.add("2026-09-010330");
    expected.add("2026-10-010330");
    expect(kept).toEqual([...expected].sort());
    expect(plan.remove).toHaveLength(45 - expected.size);
  });

  it("varias copias el mismo día: sólo la más reciente cuenta como diaria", () => {
    const files = [
      file("2026-10-10", "0330"),
      file("2026-10-10", "1015"),
      file("2026-10-10", "1700"),
      file("2026-10-09", "0330"),
    ];
    const plan = retentionPlan(files, { daily: 30, monthly: 0 });
    expect(plan.keep.map((f) => f.id).sort()).toEqual([
      "2026-10-090330",
      "2026-10-101700",
    ]);
    expect(plan.remove.map((f) => f.id).sort()).toEqual([
      "2026-10-100330",
      "2026-10-101015",
    ]);
  });

  it("14 meses de mensuales: sólo los 12 más recientes", () => {
    const files = Array.from({ length: 14 }, (_, i) => {
      const d = new Date(Date.UTC(2025, 8 + i, 1));
      return file(d.toISOString().slice(0, 10));
    });
    const plan = retentionPlan(files, { daily: 0 });
    expect(plan.keep).toHaveLength(12);
    expect(plan.remove.map((f) => f.id)).toEqual([
      "2025-09-010330",
      "2025-10-010330",
    ]);
  });

  it("nunca toca nombres ajenos y respeta la copia recién subida", () => {
    const files = [
      ...days(40).map((d) => file(d)),
      { id: "otro", name: "notas.txt" },
      { id: "copia", name: "Copia de nexora-2026-01-01-0330.dump.enc" },
    ];
    const plan = retentionPlan(files, {
      daily: 1,
      monthly: 0,
      keep: ["2026-09-150330"],
    });
    const removed = plan.remove.map((f) => f.id);
    expect(removed).not.toContain("otro");
    expect(removed).not.toContain("copia");
    expect(plan.keep.map((f) => f.id).sort()).toEqual([
      "2026-09-150330",
      "2026-10-100330",
    ]);
    expect(retentionPlan([])).toEqual({ keep: [], remove: [] });
  });
});

describe("Calendario diario 03:30 (Santo Domingo, UTC−4)", () => {
  const at = (iso: string) => new Date(iso);
  it("sólo después de las 03:30, sin éxito reciente y con intentos disponibles", () => {
    expect(scheduledRunDue({}, at("2026-10-10T07:29:00Z"))).toBe(false);
    expect(scheduledRunDue({}, at("2026-10-10T07:30:00Z"))).toBe(true);
    expect(
      scheduledRunDue({}, at("2026-10-10T07:29:00Z"), { ignoreHour: true }),
    ).toBe(true);
    expect(
      scheduledRunDue(
        { lastSuccessAt: at("2026-10-09T15:00:00Z") },
        at("2026-10-10T07:30:00Z"),
      ),
    ).toBe(false); // 16,5 h
    expect(
      scheduledRunDue(
        { lastSuccessAt: at("2026-10-09T07:31:00Z") },
        at("2026-10-10T07:31:00Z"),
      ),
    ).toBe(true);
    expect(
      scheduledRunDue(
        { dayKey: "2026-10-10", dayAttempts: 3 },
        at("2026-10-10T09:00:00Z"),
      ),
    ).toBe(false);
    // Los intentos de ayer no cuentan hoy.
    expect(
      scheduledRunDue(
        { dayKey: "2026-10-09", dayAttempts: 3 },
        at("2026-10-10T09:00:00Z"),
      ),
    ).toBe(true);
    expect(
      scheduledRunDue(
        {
          dayKey: "2026-10-10",
          dayAttempts: 1,
          nextRetryAt: at("2026-10-10T08:00:00Z"),
        },
        at("2026-10-10T07:50:00Z"),
      ),
    ).toBe(false);
  });
  it("un respaldo bueno después de las 03:30 cierra el día (no se repite a las 23:35)", () => {
    const success = { lastSuccessAt: at("2026-10-10T07:35:00Z") };
    // 23:35 locales del mismo día: ya pasaron 20 h, pero el día está hecho.
    expect(scheduledRunDue(success, at("2026-10-11T03:35:00Z"))).toBe(false);
    // Al día siguiente vuelve a tocar a las 03:30.
    expect(scheduledRunDue(success, at("2026-10-11T07:29:00Z"))).toBe(false);
    expect(scheduledRunDue(success, at("2026-10-11T07:30:00Z"))).toBe(true);
  });
  it("próxima ejecución", () => {
    const success = at("2026-10-10T07:35:00Z");
    expect(
      nextScheduledRun(
        { lastSuccessAt: success },
        at("2026-10-10T12:00:00Z"),
      ).toISOString(),
    ).toBe("2026-10-11T07:30:00.000Z");
    expect(nextScheduledRun({}, at("2026-10-10T05:00:00Z")).toISOString()).toBe(
      "2026-10-10T07:30:00.000Z",
    );
    expect(
      nextScheduledRun(
        {
          dayKey: "2026-10-10",
          dayAttempts: 1,
          nextRetryAt: at("2026-10-10T08:00:00Z"),
        },
        at("2026-10-10T07:50:00Z"),
      ).toISOString(),
    ).toBe("2026-10-10T08:00:00.000Z");
    expect(
      nextScheduledRun(
        { dayKey: "2026-10-10", dayAttempts: 3 },
        at("2026-10-10T09:00:00Z"),
      ).toISOString(),
    ).toBe("2026-10-11T07:30:00.000Z");
    // Éxito manual a las 22:00: la siguiente, 20 h después.
    expect(
      nextScheduledRun(
        { lastSuccessAt: at("2026-10-11T02:00:00Z") },
        at("2026-10-11T03:00:00Z"),
      ).toISOString(),
    ).toBe("2026-10-11T22:00:00.000Z");
  });
});

describe("Configuración y mensajes sin secretos", () => {
  it("desactivado sin las tres variables o con una frase corta", () => {
    expect(driveBackupSettings({}).configured).toBe(false);
    const full = {
      GOOGLE_OAUTH_CLIENT_ID: "id",
      GOOGLE_OAUTH_CLIENT_SECRET: "secret",
      BACKUP_ENCRYPTION_KEY: "x".repeat(24),
    };
    expect(driveBackupSettings(full).configured).toBe(true);
    expect(
      driveBackupSettings({ ...full, BACKUP_ENCRYPTION_KEY: "corta" }).missing,
    ).toEqual(["BACKUP_ENCRYPTION_KEY (24 caracteres o más)"]);
    const s = driveBackupSettings({
      ...full,
      WEB_ORIGIN: "https://pos.example.com/",
    });
    expect(s.redirectUri).toBe(
      "https://pos.example.com/api/backups/google/callback",
    );
    expect(s.authUrl).toBe("https://accounts.google.com/o/oauth2/v2/auth");
    expect(s.tokenUrl).toBe("https://oauth2.googleapis.com/token");
    // Las perillas de prueba no existen en producción.
    const prod = driveBackupSettings({
      ...full,
      NODE_ENV: "production",
      DRIVE_BACKUP_TEST_IGNORE_HOUR: "1",
      DRIVE_BACKUP_START_DELAY_MS: "1",
    });
    expect(prod.ignoreHour).toBe(false);
    expect(prod.startDelayMs).toBe(120000);
  });

  it("pg_dump recibe la conexión por variables de entorno, sin argv", () => {
    const env = pgEnvironment(
      "postgresql://fit%40store:p%40ss%20word@db.internal:6543/fitstore?sslmode=require&options=-c%20TimeZone%3DUTC&schema=public",
    );
    expect(env).toMatchObject({
      PGHOST: "db.internal",
      PGPORT: "6543",
      PGUSER: "fit@store",
      PGPASSWORD: "p@ss word",
      PGDATABASE: "fitstore",
      PGSSLMODE: "require",
      PGOPTIONS: "-c TimeZone=UTC",
    });
    expect(() => pgEnvironment("mysql://a:b@c/d")).toThrow();
    expect(() => pgEnvironment(undefined)).toThrow();
  });

  it("los errores no llevan URLs, tokens ni correos", () => {
    const text = sanitizeBackupError(
      "fallo https://oauth2.googleapis.com/token?x=1 con ya29.a0AfB_byFAKE y 1//0gREFRESH-x token ABCDEFGHIJKLMNOPQRSTUVWXYZabcdef0123 de dueña@gmail.com secreto-xyz",
      ["secreto-xyz"],
    );
    expect(text).not.toMatch(
      /https?:|ya29|1\/\/0g|ABCDEFGHIJ|gmail|secreto-xyz/,
    );
    expect(maskAccount("duena@gmail.com")).toBe("d•••@gmail.com");
  });
});

describe("Despliegue del respaldo", () => {
  it("la imagen de la API trae pg_dump 17 del repositorio PGDG con la clave fijada", () => {
    const docker = readFileSync("deploy/render/Dockerfile.api", "utf8");
    const runtime = docker.slice(docker.indexOf("AS runtime"));
    expect(runtime).toMatch(
      /ADD --checksum=sha256:0144068502a1eddd2a0280ede10ef607d1ec592ce819940991203941564e8e76 --chmod=644 \\\n\s+https:\/\/www\.postgresql\.org\/media\/keys\/ACCC4CF8\.asc/,
    );
    expect(runtime).toContain(
      "signed-by=/usr/share/keyrings/pgdg.asc] https://apt.postgresql.org/pub/repos/apt bookworm-pgdg main",
    );
    expect(runtime).toContain("apt-get download postgresql-client-17");
    expect(runtime).toContain("/usr/lib/postgresql/17/bin/pg_dump --version");
    expect(runtime).toContain("! ldd /usr/lib/postgresql/17/bin/pg_dump");
    expect(runtime).toContain(
      "ENV PG_DUMP_BIN=/usr/lib/postgresql/17/bin/pg_dump",
    );
    // Antes de pasar al usuario sin privilegios.
    expect(runtime.indexOf("PG_DUMP_BIN")).toBeLessThan(
      runtime.indexOf("USER node"),
    );
  });

  it("la PWA no sirve index.html en la vuelta desde Google (/api/…)", () => {
    const vite = readFileSync("apps/web/vite.config.ts", "utf8");
    const list =
      /navigateFallbackDenylist:\s*\[([^\]]*)\]/.exec(vite)?.[1] ?? "";
    const patterns = [...list.matchAll(/\/(.+?)\/(?=\s*(?:,|$))/g)].map(
      (m) => new RegExp(m[1]!),
    );
    expect(patterns.length).toBeGreaterThan(0);
    expect(patterns.some((p) => p.test("/api/backups/google/callback"))).toBe(
      true,
    );
  });
});
