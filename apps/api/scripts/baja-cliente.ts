// Baja de cliente: comando de administración (no hay endpoint).
// Uso y orden de los pasos: docs/operacion/BAJA_DE_CLIENTE.md.
//
//   pnpm --filter @fitstore/api baja estado    --sucursal <id>
//   pnpm --filter @fitstore/api baja terminar  --sucursal <id>
//   pnpm --filter @fitstore/api baja exportar  --sucursal <id> --salida <carpeta>   (BAJA_CLAVE)
//   pnpm --filter @fitstore/api baja suprimir  --sucursal <id> --paquete <carpeta> --acta <archivo>
//                                              (BAJA_CLAVE; pide la frase y la fecha en la consola)
//   pnpm --filter @fitstore/api baja descifrar --archivo <Tabla.jsonl.enc> --salida <Tabla.jsonl>   (BAJA_CLAVE)
import { createReadStream, createWriteStream } from "node:fs";
import { writeFile } from "node:fs/promises";
import { pipeline } from "node:stream/promises";
import { createInterface } from "node:readline/promises";
import { parseArgs } from "node:util";
import { config } from "dotenv";
import { PrismaClient } from "@prisma/client";
import { conteos, exportar, frase, suprimir, terminar } from "../src/baja";
import { createDecryptStream } from "../src/drive-backup-core";

config({ path: "../../.env", quiet: true });

async function main() {
  const { positionals, values } = parseArgs({
    allowPositionals: true,
    options: {
      sucursal: { type: "string" },
      salida: { type: "string" },
      paquete: { type: "string" },
      acta: { type: "string" },
      archivo: { type: "string" },
    },
  });
  const [comando] = positionals;
  if (comando === "descifrar") {
    // No toca la base: abre un <Tabla>.jsonl.enc del paquete con BAJA_CLAVE.
    if (!values.archivo || !values.salida)
      throw new Error(
        "Uso: descifrar --archivo <Tabla.jsonl.enc> --salida <Tabla.jsonl>",
      );
    await pipeline(
      createReadStream(values.archivo),
      createDecryptStream(process.env.BAJA_CLAVE ?? ""),
      createWriteStream(values.salida, { flags: "wx" }),
    );
    return;
  }
  const branchId = values.sucursal ?? "";
  if (!branchId) throw new Error("Falta --sucursal <branchId>.");
  const db = new PrismaClient();
  try {
    if (comando === "estado") {
      const estado = await db.branchTermination.findUnique({
        where: { branchId },
      });
      console.log(
        JSON.stringify({ estado, filas: await conteos(db, branchId) }, null, 2),
      );
    } else if (comando === "terminar") {
      console.log(JSON.stringify(await terminar(db, branchId), null, 2));
    } else if (comando === "exportar") {
      if (!values.salida) throw new Error("Falta --salida <carpeta>.");
      const r = await exportar(
        db,
        branchId,
        values.salida,
        process.env.BAJA_CLAVE ?? "",
      );
      console.log(
        `Exportadas ${r.manifiesto.totalFilas} filas en ${r.manifiesto.tablas.length} tablas.`,
      );
      console.log(`SHA-256 del manifiesto: ${r.paqueteSha256}`);
    } else if (comando === "suprimir") {
      if (!values.paquete)
        throw new Error("Falta --paquete <carpeta de la exportación>.");
      if (!values.acta)
        throw new Error("Falta --acta <archivo> para guardar el acta.");
      // Confirmación doble escrita por una persona: sin consola, no se suprime.
      if (!process.stdin.isTTY)
        throw new Error("suprimir solo se confirma escribiendo en la consola.");
      const rl = createInterface({
        input: process.stdin,
        output: process.stdout,
      });
      const confirmacion = (
        await rl.question(
          `Para borrar TODO de «${branchId}» escribe: ${frase(branchId)}\n> `,
        )
      ).trim();
      const fecha = (
        await rl.question("Escribe la fecha de hoy (AAAA-MM-DD)\n> ")
      ).trim();
      rl.close();
      const r = await suprimir(db, branchId, {
        confirmacion,
        fecha,
        carpeta: values.paquete,
        clave: process.env.BAJA_CLAVE ?? "",
        // Solo sube el piso de 30 días.
        diasMinimos: Number(process.env.BAJA_DIAS_MINIMOS ?? 30),
      });
      await writeFile(values.acta, r.actaTexto, { flag: "wx" });
      console.log(
        r.yaSuprimida
          ? `Ya estaba suprimida; no se borró nada. Acta guardada en ${values.acta}.`
          : `Suprimida. Acta en ${values.acta}.`,
      );
      console.log(JSON.stringify(r.borradas, null, 2));
    } else {
      throw new Error(
        "Comando: estado | terminar | exportar | suprimir | descifrar.",
      );
    }
  } finally {
    await db.$disconnect();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "Operación fallida.");
  process.exitCode = 1;
});
