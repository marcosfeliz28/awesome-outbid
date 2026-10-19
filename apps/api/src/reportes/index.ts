import type { ReportDef } from "./base";
import { ventas } from "./ventas";
import { dinero } from "./dinero";
import { margen } from "./margen";
import { inventario } from "./inventario";
import { clientes } from "./clientes";

export const REPORTES: Record<string, ReportDef> = {
  ...ventas,
  ...dinero,
  ...margen,
  ...inventario,
  ...clientes,
};
