import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

type ManagementLedger = {
  source_commit: string;
  base_sha256: string;
  changes: Array<{ before: string; after: string }>;
};

function readLedger(path: string): ManagementLedger {
  return JSON.parse(readFileSync(path, "utf8"));
}

export const managementProductLedger = {
  caja: readLedger("docs/diseno/caja-turnos/PRESENTACION_REVERSIBLE_PRODUCTO.json"),
  catalog: readLedger("docs/diseno/productos-higgsfield/PRESENTACION_REVERSIBLE_PRODUCTO.json"),
  operations: readLedger("docs/diseno/operaciones-4k/PRESERVACION_PRODUCTO.json"),
};

export function reverseManagement(source: string, ledger: ManagementLedger) {
  for (const edit of [...ledger.changes].reverse()) {
    if (source.split(edit.after).length !== 2) {
      throw new Error(`La inversión no identifica un cambio único: ${edit.after.slice(0, 100)}`);
    }
    source = source.replace(edit.after, () => edit.before);
  }
  return source;
}

export function managementDigest(source: string) {
  return createHash("sha256").update(source).digest("hex");
}
