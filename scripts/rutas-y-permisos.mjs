// Lista las rutas de apps/api/src (@Get, @Post, @Put, @Patch, @Delete) con su @Permit (si lo tienen).
// Solo lectura. Salida: docs/auditoria/RUTAS_Y_PERMISOS.md
import { execSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";

const archivos = execSync("git ls-files apps/api/src", { encoding: "utf8" }).split("\n").filter((f) => f.endsWith(".ts"));
const reRuta = /@(Get|Post|Put|Patch|Delete)\(\s*(?:["'`]([^"'`]*)["'`])?\s*\)/;
const rePermit = /@Permit\(\s*["'`]([^"'`]+)["'`]\s*\)/;
const filas = [];
for (const f of archivos) {
  const lineas = readFileSync(f, "utf8").split("\n");
  lineas.forEach((linea, i) => {
    const m = linea.match(reRuta);
    if (!m) return;
    let permiso = "SIN @Permit";
    for (let j = i; j >= Math.max(0, i - 3); j--) { const p = lineas[j].match(rePermit); if (p) { permiso = p[1]; break; } }
    filas.push(`| ${m[2] ?? "(raíz)"} | ${m[1].toUpperCase()} | ${permiso} | ${f}:${i + 1} |`);
  });
}
writeFileSync("docs/auditoria/RUTAS_Y_PERMISOS.md", ["# Rutas de la API y permisos (solo lectura)", "", "Borrador verificado por script. PARCIAL: el @Permit se busca solo 3 líneas arriba de cada ruta; un permiso puesto a nivel de clase no se ve aquí.", "",
  "| ruta | método | permiso | archivo:línea |", "|---|---|---|---|", ...filas, ""].join("\n"));
console.log("rutas:", filas.length, "sin permiso:", filas.filter((x) => x.includes("SIN @Permit")).length);
