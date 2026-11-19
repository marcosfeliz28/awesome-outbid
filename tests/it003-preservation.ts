import { readFileSync } from "node:fs";

type It003File = "Management" | "Incentives" | "Tienda";
type Edit = { before: string; after: string };

const ledger = JSON.parse(
  readFileSync("docs/auditoria-ui/IT-003_REVERSIBLE.json", "utf8"),
) as Record<It003File, Edit[]>;

/**
 * Retira solamente la presentación ES/EN añadida por IT-003. Las pruebas de
 * preservación existentes pueden así seguir comprobando sus bases históricas
 * byte por byte, incluso cuando varias capas visuales conviven en el archivo.
 */
export function reverseIt003(source: string, file: It003File) {
  for (const edit of [...ledger[file]].reverse()) {
    const occurrences = source.split(edit.after).length - 1;
    if (occurrences !== 1) {
      throw new Error(
        `IT-003 ${file}: se esperaba una coincidencia reversible y hubo ${occurrences}`,
      );
    }
    source = source.replace(edit.after, edit.before);
  }
  return source;
}
