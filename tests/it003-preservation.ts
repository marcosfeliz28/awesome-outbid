import { readFileSync } from "node:fs";

type It003File = "Management" | "Incentives" | "Tienda";
type Edit = { before: string; after: string };

const ledger = JSON.parse(
  readFileSync("docs/auditoria-ui/IT-003_REVERSIBLE.json", "utf8"),
) as Record<It003File, Edit[]>;
const reportsLedger = JSON.parse(
  readFileSync(
    "docs/auditoria-ui/PRODUCTO-REPORTES_REVERSIBLE.json",
    "utf8",
  ),
) as Edit[];
const customerSearchLedger = JSON.parse(
  readFileSync(
    "docs/auditoria-ui/PRODUCTO-CLIENTES-BUSQUEDA_REVERSIBLE.json",
    "utf8",
  ),
) as Edit[];
const warehouseFilterLedger = JSON.parse(
  readFileSync(
    "docs/auditoria-ui/PRODUCTO-ALMACEN-FILTRO_REVERSIBLE.json",
    "utf8",
  ),
) as Edit[];
const storeCloseLedger = JSON.parse(
  readFileSync(
    "docs/auditoria-ui/PRODUCTO-TIENDA-CIERRE_REVERSIBLE.json",
    "utf8",
  ),
) as Edit[];
const storePendingTotalLedger = JSON.parse(
  readFileSync(
    "docs/auditoria-ui/PRODUCTO-TIENDA-POR-COBRAR_REVERSIBLE.json",
    "utf8",
  ),
) as Edit[];

function reverseEdits(source: string, edits: Edit[], label: string) {
  for (const edit of [...edits].reverse()) {
    const occurrences = source.split(edit.after).length - 1;
    if (occurrences !== 1) {
      throw new Error(
        `${label}: se esperaba una coincidencia reversible y hubo ${occurrences}`,
      );
    }
    source = source.replace(edit.after, edit.before);
  }
  return source;
}

/**
 * Retira solamente la presentación ES/EN añadida por IT-003. Las pruebas de
 * preservación existentes pueden así seguir comprobando sus bases históricas
 * byte por byte, incluso cuando varias capas visuales conviven en el archivo.
 */
export function reverseIt003(source: string, file: It003File) {
  if (file === "Management") {
    source = reverseEdits(
      source,
      warehouseFilterLedger,
      "PRODUCTO-ALMACEN-FILTRO",
    );
    source = reverseEdits(
      source,
      customerSearchLedger,
      "PRODUCTO-CLIENTES-BUSQUEDA",
    );
    source = reverseEdits(source, reportsLedger, "PRODUCTO-REPORTES");
  }
  if (file === "Tienda") {
    source = reverseEdits(
      source,
      storePendingTotalLedger,
      "PRODUCTO-TIENDA-POR-COBRAR",
    );
    source = reverseEdits(source, storeCloseLedger, "PRODUCTO-TIENDA-CIERRE");
  }
  return reverseEdits(source, ledger[file], `IT-003 ${file}`);
}
