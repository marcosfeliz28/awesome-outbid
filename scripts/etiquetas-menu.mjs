// Extrae las etiquetas del menú de apps/web/src/App.tsx (lista navigation) y las compara con la tabla de docs/sistema/PANTALLAS.md.
// Salida: docs/auditoria/MENU_VS_PANTALLAS.md (solo diferencias)
import { readFileSync, writeFileSync } from "node:fs";

const app = readFileSync("apps/web/src/App.tsx", "utf8");
const pantallas = readFileSync("docs/sistema/PANTALLAS.md", "utf8");
const bloque = app.slice(app.indexOf("const navigation = ["), app.indexOf("];", app.indexOf("const navigation = [")) + 2);
const etiquetasCodigo = [...bloque.matchAll(/label:\s*"([^"]+)"/g)].map((m) => m[1]);
const etiquetasDoc = [...pantallas.matchAll(/^\|\s*\d+\s*\|\s*\*\*([^*]+)\*\*/gm)].map((m) => m[1].trim());
const soloCodigo = etiquetasCodigo.filter((e) => !etiquetasDoc.includes(e));
const soloDoc = etiquetasDoc.filter((e) => !etiquetasCodigo.includes(e));
writeFileSync("docs/auditoria/MENU_VS_PANTALLAS.md", ["# Menú del código frente a PANTALLAS.md (solo diferencias)", "", "Borrador verificado por script.", "",
  `Etiquetas en el código: ${etiquetasCodigo.length}. En PANTALLAS.md: ${etiquetasDoc.length}.`, "",
  "## Solo en el código", ...(soloCodigo.length ? soloCodigo.map((e) => `- ${e}`) : ["- ninguna"]), "",
  "## Solo en PANTALLAS.md", ...(soloDoc.length ? soloDoc.map((e) => `- ${e}`) : ["- ninguna"]), ""].join("\n"));
console.log("código:", etiquetasCodigo.length, "doc:", etiquetasDoc.length, "solo código:", soloCodigo.length, "solo doc:", soloDoc.length);
