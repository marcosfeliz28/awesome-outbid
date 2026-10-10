// Carga el inventario de la tienda desde el Excel "INVENTARIO 2026" (hoja con
// ID, DESCRIPCION, REFERENCIA, SUB-GRUPO DE ARTICULO, EXISTENCIA, COSTO y
// PRECIO DETALLE).
//
//   pnpm --filter @fitstore/api inventory:import ../../INVENTARIO_2026.xlsx
//   pnpm --filter @fitstore/api inventory:import archivo.xlsx --dry-run
//   pnpm --filter @fitstore/api inventory:import archivo.xlsx --dry-run --inactivar-precio-menor-o-igual-costo
//   pnpm --filter @fitstore/api inventory:import archivo.xlsx --actualizar-precios
//
// - Un producto por fila. El ID es el código para cobrar: se escribe en la caja
//   y Enter. Si la descripción trae "Barcode 0815…", ese es el código de barras.
// - Las existencias entran como "Inventario inicial" en el kardex, con su costo.
// - Productos sin precio o sin costo quedan inactivos (no se venden) y salen en
//   el reporte de revisión junto con márgenes bajos y agotados.
// - --inactivar-precio-menor-o-igual-costo aplica una política comercial segura:
//   conserva exactamente precio, costo y existencia, pero deja inactivos los
//   productos cuyo precio no supera el costo. La simulación permite revisar la
//   decisión antes de escribir.
// - La lógica vive en src/inventory-import-core.ts y la comparte la pantalla
//   «Importar inventario» de la web; aquí sólo se leen los argumentos.
// - Rechaza códigos que ya son de otro producto en la base, números
//   ambiguos, celdas con error de Excel o fórmulas sin calcular, y filas con
//   datos sin ID o sin DESCRIPCION. Si una categoría existente exige lote, se
//   detiene; --sin-lotes desactiva ese control (queda en la bitácora).
// - --dry-run da las mismas cifras que la carga real y avisa qué categorías
//   crearía o cambiaría, sin escribir nada.
// - Repetirlo no duplica ni pisa lo editado en la app: sólo crea los nuevos,
//   activa los que estaban inactivos por falta de precio o costo (completando
//   sólo lo que falta) y, con --actualizar-precios, cambia precios (queda en
//   la bitácora). Las existencias de productos ya cargados nunca se tocan.
import { config } from "dotenv";
import { PrismaClient } from "@prisma/client";
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { importInventory, readInventory } from "../src/inventory-import-core";
export {
  activeForImport,
  brandOf,
  checkCodes,
  lacksCommercialData,
  marginOf,
  parseNumber,
  priceAtOrBelowCost,
  readInventory,
  reviewOf,
} from "../src/inventory-import-core";
config({ path: "../../.env", quiet: true });

async function main() {
  const file = process.argv.find((a) => /\.xlsx$/i.test(a));
  const dryRun = process.argv.includes("--dry-run");
  const updatePrices = process.argv.includes("--actualizar-precios");
  const disableLots = process.argv.includes("--sin-lotes");
  const inactivatePriceAtOrBelowCost = process.argv.includes(
    "--inactivar-precio-menor-o-igual-costo",
  );
  const allowedFlags = new Set([
    "--dry-run",
    "--actualizar-precios",
    "--sin-lotes",
    "--inactivar-precio-menor-o-igual-costo",
  ]);
  const unknownFlag = process.argv
    .slice(2)
    .find((arg) => arg.startsWith("--") && !allowedFlags.has(arg));
  if (unknownFlag)
    throw new Error(
      "Opción desconocida «" +
        unknownFlag +
        "». Se detuvo sin importar para evitar aplicar una política distinta por un error de escritura.",
    );
  if (!file) throw new Error("Indica el archivo .xlsx del inventario.");
  const rows = await readInventory(resolve(process.cwd(), file));

  const db = new PrismaClient();
  try {
    const admin = await db.user.findFirst({
      where: { active: true, role: { name: "admin" } },
      orderBy: { createdAt: "asc" },
    });
    if (!admin)
      throw new Error("Crea primero el administrador (admin:create).");
    const origen = file.split(/[\\/]/).pop()!;
    const report = await importInventory(
      db,
      rows,
      { id: admin.id, branchId: admin.branchId },
      {
        dryRun,
        origen,
        lock: true,
        updatePrices,
        disableLots,
        inactivatePriceAtOrBelowCost,
      },
    );
    const { summary } = report;
    const out = resolve(process.cwd(), "revision-inventario.csv");
    writeFileSync(
      out,
      "\ufeff" +
        [
          [
            "ID",
            "Producto",
            "Categoría",
            "Existencia",
            "Costo",
            "Precio",
            "Estado al importar",
            "Revisar",
          ],
          ...report.review.map((r) => [
            r.id,
            r.name,
            r.category,
            String(r.qty),
            String(r.cost),
            String(r.price),
            r.active ? "Activo" : "Inactivo",
            r.notes.join("; "),
          ]),
        ]
          .map((r) => r.map((c) => '"' + c.replace(/"/g, '""') + '"').join(";"))
          .join("\r\n"),
    );
    for (const notice of report.notices) console.log(notice);
    if (inactivatePriceAtOrBelowCost)
      console.log(
        "Política segura: sólo quedarán activos los productos con precio y costo mayores que cero y precio superior al costo; no se alteran sus importes.",
      );
    console.log(
      (dryRun ? "Simulación: " : "") +
        rows.length +
        " productos leídos · " +
        summary.nuevos +
        " nuevos (" +
        summary.unidades +
        " unidades) · " +
        summary.sinCambios +
        " ya cargados sin cambios · " +
        summary.activados +
        " activados · " +
        summary.precios +
        " precios actualizados · " +
        summary.desactivados +
        " desactivados por política segura · " +
        summary.sinDatos +
        " sin precio o costo (inactivos) · " +
        summary.precioNoRentable +
        " con precio igual o menor al costo (" +
        (inactivatePriceAtOrBelowCost
          ? "inactivos por política segura"
          : "requieren revisión") +
        ").",
    );
    console.log(
      report.review.length +
        " productos para revisar en " +
        out +
        " (ábrelo en Excel).",
    );
  } finally {
    await db.$disconnect();
  }
}
if (process.argv[1]?.includes("import-inventario"))
  void main().catch((e) => {
    console.error(e.message);
    process.exit(1);
  });
