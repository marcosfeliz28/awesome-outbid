// Busca mojibake («Ã», «â€») en docs y apps/web/src, y «?» entre letras solo en texto de los .md.
// En código (.ts, .tsx, .css, .json, .html) no se busca «?»: en código es un operador o una URL.
// Solo informe. Salida: docs/auditoria/TILDES_NUEVAS.md
import { execSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";

const archivos = execSync("git ls-files docs apps/web/src", {
  encoding: "utf8",
})
  .split("\n")
  .filter(
    (f) =>
      /\.(md|tsx?|css|html|json)$/.test(f) &&
      !f.startsWith("docs/operacion/") &&
      !f.startsWith("docs/legal/") &&
      !f.startsWith("docs/seguridad/"),
  );
const reMojibake = /Ã|â€/;
const reInterrogacion = /[a-záéíóúñA-ZÁÉÍÓÚÑ]\?[a-záéíóúñA-ZÁÉÍÓÚÑ]/;
const hallazgos = [];
for (const f of archivos) {
  const esMd = f.endsWith(".md");
  readFileSync(f, "utf8")
    .split("\n")
    .forEach((linea, i) => {
      if (reMojibake.test(linea))
        hallazgos.push(
          `| ${f}:${i + 1} | mojibake | ${linea.trim().slice(0, 110).replace(/\|/g, "/")} |`,
        );
      else if (
        esMd &&
        reInterrogacion.test(linea.replace(/`[^`]*`/g, "")) &&
        !/https?:|\/api|\$\{/.test(linea)
      )
        hallazgos.push(
          `| ${f}:${i + 1} | ? en palabra | ${linea.trim().slice(0, 110).replace(/\|/g, "/")} |`,
        );
    });
}
writeFileSync(
  "docs/auditoria/TILDES_NUEVAS.md",
  [
    "# Tildes rotas (solo informe)",
    "",
    "Borrador verificado por script. «?» solo en documentos; código y URLs excluidos.",
    "",
    hallazgos.length ? "| archivo:línea | tipo | texto |" : "Ninguna.",
    hallazgos.length ? "|---|---|---|" : "",
    ...hallazgos,
    "",
  ].join("\n"),
);
console.log("archivos:", archivos.length, "hallazgos:", hallazgos.length);
