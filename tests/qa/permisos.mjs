// Matriz de permisos por API (copia local): estado HTTP de cada GET por rol, y
// claves de costo/margen/esperado que le llegan a la cajera.
//   node tests/qa/permisos.mjs   -> docs/qa/recorrido-26oct/permisos.json
import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { raiz } from "./comun.mjs";
import { token, get } from "./ayudas.mjs";

const MACGEN = [
  "/api/products?limit=5", "/api/inventory/stock", "/api/sales", "/api/cash-sessions",
  "/api/customers", "/api/dashboard/summary", "/api/reportes", "/api/reports/income-by-day",
  "/api/incentives", "/api/settings", "/api/users", "/api/audit-log", "/api/expenses",
  "/api/purchase-orders", "/api/suppliers", "/api/promotions", "/api/alerts",
  "/api/sales/mine/today", "/api/survey/summary", "/api/backups/status",
];
const GV = [
  "/api/gv/courses", "/api/gv/appointments", "/api/gv/leads", "/api/gv/reports",
  "/api/gv/transfers/pending",
];
const sensibles = /(^|\.)(cost|costAvg|unitCost|costTotal|wasteCostTotal|damagedCost|margin\w*|profit\w*|expected\w*|difference\w*)$/i;
function claves(o, r = "", out = [], d = 0) {
  if (d > 6 || o === null || typeof o !== "object") return out;
  for (const [k, v] of Object.entries(o)) {
    const p = Array.isArray(o) ? r : r ? r + "." + k : k;
    if (!Array.isArray(o) && sensibles.test(p) && v != null) out.push(p);
    claves(Array.isArray(v) ? v.slice(0, 5) : v, p, out, d + 1);
  }
  return [...new Set(out)];
}
const salida = {};
for (const rol of ["admin", "gerente", "cajera", "gv"]) {
  const tk = await token(rol);
  salida[rol] = {};
  for (const ruta of [...MACGEN, ...GV]) {
    const r = await get(ruta, tk);
    salida[rol][ruta] = { estado: r.estado, sensibles: r.estado === 200 ? claves(r.cuerpo) : [] };
    if (ruta === "/api/sales" && r.estado === 200) {
      const filas = r.cuerpo?.items ?? r.cuerpo ?? [];
      const hoy = new Date().toISOString().slice(0, 10);
      salida[rol][ruta].filas = filas.length;
      salida[rol][ruta].deHoy = filas.filter((s) => String(s.createdAt).startsWith(hoy)).length;
      salida[rol][ruta].vendedoras = [...new Set(filas.map((s) => s.userId ?? s.user?.name ?? s.createdBy))].length;
    }
  }
}
const dir = join(raiz, "docs", "qa", "recorrido-26oct");
mkdirSync(dir, { recursive: true });
writeFileSync(join(dir, "permisos.json"), JSON.stringify(salida, null, 1));
for (const [rol, m] of Object.entries(salida)) {
  console.log("==", rol);
  for (const [ruta, v] of Object.entries(m))
    console.log(String(v.estado), ruta, v.sensibles.length ? "SENSIBLES:" + v.sensibles.join(",") : "", v.filas !== undefined ? `filas=${v.filas} hoy=${v.deHoy} vendedoras=${v.vendedoras}` : "");
}
