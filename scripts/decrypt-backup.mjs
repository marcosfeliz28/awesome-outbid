// Descifra un respaldo de Google Drive (nexora-AAAA-MM-DD-HHmm.dump.enc) y deja
// el .dump que scripts/restore.mjs sabe restaurar, con su .sha256 y su .json.
//
// Uso:
//   node scripts/decrypt-backup.mjs <archivo.dump.enc> [salida.dump]
// La frase se toma de BACKUP_ENCRYPTION_KEY o, si no está, se pide en la
// consola sin mostrarla. Después:
//   RESTORE_DATABASE_URL=<base nueva y vacía> node scripts/restore.mjs <salida.dump>
//
// Formato NXBK v1 (lo mismo que escribe apps/api/src/drive-backup-core.ts; se
// reimplementa aquí sin dependencias a propósito, para que las pruebas
// comprueben el formato documentado y no sólo el código de la API):
//   cabecera de 36 bytes: «NXBK», versión 1, KDF 1 (scrypt), log2N, r, p,
//   tamaño de bloque (uint32 BE), sal (16), prefijo de nonce (7).
//   clave = scrypt(frase NFC, sal, 32, N=2^log2N, r, p)
//   bloques AES-256-GCM: nonce = prefijo ‖ nº de bloque (uint32 BE) ‖ marca de
//   último (1/0); datos asociados = cabecera; texto cifrado ‖ etiqueta (16).
//   Todos los bloques tienen «tamaño de bloque» bytes salvo el último (0 a
//   tamaño), que siempre existe.
import { createDecipheriv, createHash, scrypt } from "node:crypto";
import { open, rename, stat, unlink, writeFile } from "node:fs/promises";
import { basename, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HEADER = 36;
const TAG = 16;

function deriveKey(passphrase, salt, { log2N, r, p }) {
  const N = 2 ** log2N;
  return new Promise((done, fail) =>
    scrypt(
      Buffer.from(passphrase.normalize("NFC"), "utf8"),
      salt,
      32,
      { N, r, p, maxmem: 128 * N * r * p + 32 * 1024 * 1024 },
      (error, key) => (error ? fail(error) : done(key)),
    ),
  );
}

function parseHeader(header) {
  if (header.length < HEADER || header.toString("latin1", 0, 4) !== "NXBK")
    throw new Error("No es un respaldo cifrado de Nexora (falta «NXBK»).");
  if (header[4] !== 1)
    throw new Error(`Versión de formato no soportada: ${header[4]}.`);
  if (header[5] !== 1) throw new Error("Derivación de clave no soportada.");
  const params = { log2N: header[6], r: header[7], p: header[8] };
  const chunk = header.readUInt32BE(9);
  if (
    params.log2N < 14 ||
    params.log2N > 20 ||
    params.r < 1 ||
    params.r > 16 ||
    params.p < 1 ||
    params.p > 4 ||
    chunk < 4096 ||
    chunk > 16 * 1024 * 1024
  )
    throw new Error("Cabecera con parámetros fuera de rango.");
  return {
    params,
    chunk,
    salt: header.subarray(13, 29),
    prefix: header.subarray(29, 36),
  };
}

/** Descifra `input` en `output`. Lanza si la frase o el archivo no cuadran. */
export async function decryptBackup(input, output, passphrase) {
  const size = (await stat(input)).size;
  const source = await open(input, "r");
  const temporary = output + ".incompleto";
  let target;
  try {
    const header = Buffer.alloc(HEADER);
    const { bytesRead } = await source.read(header, 0, HEADER, 0);
    if (bytesRead < HEADER) throw new Error("El archivo es demasiado corto.");
    const { params, chunk, salt, prefix } = parseHeader(header);
    const body = size - HEADER;
    const sealed = chunk + TAG;
    const count = Math.max(1, Math.ceil(body / sealed));
    const lastBytes = body - (count - 1) * sealed;
    if (lastBytes < TAG) throw new Error("El archivo está cortado.");
    const key = await deriveKey(passphrase, salt, params);
    target = await open(temporary, "wx", 0o600);
    const hash = createHash("sha256");
    const buffer = Buffer.alloc(sealed);
    let position = HEADER;
    let plainBytes = 0;
    let magic = "";
    for (let index = 0; index < count; index++) {
      const last = index === count - 1;
      const length = last ? lastBytes : sealed;
      const read = await source.read(buffer, 0, length, position);
      if (read.bytesRead !== length)
        throw new Error("No se pudo leer el archivo.");
      position += length;
      const nonce = Buffer.alloc(12);
      prefix.copy(nonce, 0);
      nonce.writeUInt32BE(index, 7);
      nonce[11] = last ? 1 : 0;
      const decipher = createDecipheriv("aes-256-gcm", key, nonce);
      decipher.setAAD(header);
      decipher.setAuthTag(buffer.subarray(length - TAG, length));
      let plain;
      try {
        plain = Buffer.concat([
          decipher.update(buffer.subarray(0, length - TAG)),
          decipher.final(),
        ]);
      } catch {
        throw new Error(
          "La frase no es correcta o el archivo fue modificado o está incompleto.",
        );
      }
      if (magic.length < 5)
        magic = (magic + plain.toString("latin1", 0, 5 - magic.length)).slice(
          0,
          5,
        );
      hash.update(plain);
      plainBytes += plain.length;
      await target.write(plain);
    }
    key.fill(0);
    if (magic !== "PGDMP")
      throw new Error("El contenido descifrado no es un respaldo de pg_dump.");
    await target.close();
    target = undefined;
    await rename(temporary, output);
    const digest = hash.digest("hex");
    const file = basename(output);
    // Lo mismo que escribe scripts/backup.mjs: restore.mjs lo verifica antes.
    await writeFile(output + ".sha256", `${digest} *${file}\n`);
    await writeFile(
      output + ".json",
      JSON.stringify(
        {
          schemaVersion: 1,
          createdAt: new Date().toISOString(),
          database: "fitstore",
          bytes: plainBytes,
          sha256: digest,
          file,
          decryptedFrom: basename(input),
        },
        null,
        2,
      ) + "\n",
    );
    return { bytes: plainBytes, sha256: digest };
  } catch (error) {
    if (target) await target.close().catch(() => {});
    await unlink(temporary).catch(() => {});
    throw error;
  } finally {
    await source.close();
  }
}

/** Pide la frase sin mostrarla en pantalla. */
function askPassphrase() {
  return new Promise((done, fail) => {
    const input = process.stdin;
    if (!input.isTTY)
      return fail(
        new Error("Falta BACKUP_ENCRYPTION_KEY (o ejecútalo en una consola)."),
      );
    process.stderr.write("Frase de cifrado (no se muestra): ");
    input.setRawMode(true);
    input.resume();
    input.setEncoding("utf8");
    let value = "";
    const onData = (text) => {
      for (const char of text) {
        if (char === "\r" || char === "\n") {
          input.setRawMode(false);
          input.pause();
          input.off("data", onData);
          process.stderr.write("\n");
          return done(value);
        }
        if (char === "\u0003") {
          input.setRawMode(false);
          process.stderr.write("\n");
          return fail(new Error("Cancelado."));
        }
        if (char === "\u007f" || char === "\b") value = value.slice(0, -1);
        else value += char;
      }
    };
    input.on("data", onData);
  });
}

async function main() {
  const [input, outputArg] = process.argv.slice(2);
  if (!input || input === "--help" || input === "-h") {
    console.error(
      "Uso: node scripts/decrypt-backup.mjs <archivo.dump.enc> [salida.dump]\n" +
        "La frase se toma de BACKUP_ENCRYPTION_KEY o se pide en la consola.",
    );
    process.exitCode = 2;
    return;
  }
  const source = resolve(input);
  const output = resolve(
    outputArg || source.replace(/\.enc$/i, "").replace(/(\.dump)?$/i, ".dump"),
  );
  if (output === source)
    throw new Error("La salida no puede ser el mismo archivo cifrado.");
  const passphrase =
    process.env.BACKUP_ENCRYPTION_KEY || (await askPassphrase());
  const result = await decryptBackup(source, output, passphrase);
  console.log(
    `Respaldo descifrado y verificado: ${output} (${result.bytes} bytes).\n` +
      `Para restaurarlo en una base NUEVA y vacía:\n` +
      `  RESTORE_DATABASE_URL=<base nueva> node scripts/restore.mjs "${output}"`,
  );
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
)
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
