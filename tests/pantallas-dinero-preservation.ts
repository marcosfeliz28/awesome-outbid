import { readFileSync } from "node:fs";

type FileName = "Management" | "POS";
type Edit = { before: string; after: string };

const ledger = JSON.parse(
  readFileSync("docs/diseno/PRESERVACION_DINERO_PENDIENTE.json", "utf8"),
) as Record<FileName, Edit[]>;

export function reversePendingMoney(source: string, file: FileName) {
  for (const edit of [...ledger[file]].reverse()) {
    const occurrences = source.split(edit.after).length - 1;
    if (occurrences !== 1)
      throw new Error(
        `DINERO-PENDIENTE ${file}: se esperaba una coincidencia reversible y hubo ${occurrences}: ${edit.after.slice(0, 60)}`,
      );
    source = source.replace(edit.after, edit.before);
  }
  return source;
}
