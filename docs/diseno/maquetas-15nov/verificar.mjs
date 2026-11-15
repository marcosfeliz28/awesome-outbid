/* global console, process */
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(fileURLToPath(import.meta.url));
const pages = [
  ["caja.html", "Caja"],
  ["direccion.html", "El pulso de tu negocio"],
  ["mercancia.html", "Mercancía"],
];
const captures = [
  ["capturas/caja-oscuro-1440.png", 1440, 900],
  ["capturas/caja-oscuro-390.png", 390, 844],
  ["capturas/direccion-oscuro-1440.png", 1440, 900],
  ["capturas/direccion-oscuro-390.png", 390, 844],
  ["capturas/mercancia-oscuro-1440.png", 1440, 900],
  ["capturas/mercancia-oscuro-390.png", 390, 844],
];

const css = await readFile(path.join(root, "styles.css"), "utf8");
const failures = [];

function luminance(hex) {
  const channels = hex
    .slice(1)
    .match(/.{2}/g)
    .map((channel) => Number.parseInt(channel, 16) / 255)
    .map((channel) =>
      channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4,
    );
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

function contrast(foreground, background) {
  const values = [luminance(foreground), luminance(background)].sort(
    (a, b) => b - a,
  );
  return (values[0] + 0.05) / (values[1] + 0.05);
}

const aaPairs = [
  ["texto claro", "#17162b", "#ffffff"],
  ["texto secundario claro", "#686781", "#ffffff"],
  ["botón claro", "#ffffff", "#5930b6"],
  ["texto oscuro", "#f4f1ff", "#171525"],
  ["texto secundario oscuro", "#b7b3ce", "#171525"],
  ["botón oscuro", "#17162b", "#bba4ff"],
];

for (const [label, foreground, background] of aaPairs) {
  const ratio = contrast(foreground, background);
  if (ratio < 4.5) failures.push(`${label}: contraste ${ratio.toFixed(2)}:1`);
}

if (!css.includes("--font-size-min: 14px")) {
  failures.push("styles.css debe declarar --font-size-min: 14px");
}
if (!css.includes("#theme-toggle:checked ~ .app-shell")) {
  failures.push("styles.css debe incluir el selector del modo oscuro");
}
if (!css.includes("prefers-reduced-motion: reduce")) {
  failures.push("styles.css debe respetar prefers-reduced-motion");
}

for (const [file, heading] of pages) {
  let html;
  try {
    html = await readFile(path.join(root, file), "utf8");
  } catch {
    failures.push(`${file} no existe`);
    continue;
  }
  if (!html.includes('lang="es"')) failures.push(`${file}: falta lang=es`);
  if (!html.includes('name="viewport"'))
    failures.push(`${file}: falta viewport`);
  if (!html.includes('href="styles.css"'))
    failures.push(`${file}: falta CSS compartido`);
  if (!html.includes('id="theme-toggle"'))
    failures.push(`${file}: falta control de tema`);
  if (!html.includes(heading))
    failures.push(`${file}: falta el título ${heading}`);
  if (!html.includes("Datos de demostración")) {
    failures.push(`${file}: los datos de muestra no están identificados`);
  }
}

for (const [file, expectedWidth, expectedHeight] of captures) {
  const png = await readFile(path.join(root, file));
  const width = png.readUInt32BE(16);
  const height = png.readUInt32BE(20);
  if (width !== expectedWidth || height !== expectedHeight) {
    failures.push(
      `${file}: ${width}x${height}; se esperaba ${expectedWidth}x${expectedHeight}`,
    );
  }
}

const direction = await readFile(path.join(root, "direccion.html"), "utf8");
for (const vagueLabel of ["Tendencia disponible", "Solo con permiso"]) {
  if (direction.includes(vagueLabel)) {
    failures.push(`direccion.html conserva el texto vago: ${vagueLabel}`);
  }
}

const forbiddenSizes = [...css.matchAll(/font-size:\s*(\d+(?:\.\d+)?)px/g)]
  .map((match) => Number(match[1]))
  .filter((size) => size < 14);
if (forbiddenSizes.length) {
  failures.push(
    `styles.css contiene tamaños menores de 14 px: ${forbiddenSizes.join(", ")}`,
  );
}

if (failures.length) {
  console.error(failures.map((failure) => `FAIL: ${failure}`).join("\n"));
  process.exit(1);
}

console.log(
  "PASS: 3 maquetas, CSS compartido, tema oscuro, contraste AA y texto mínimo de 14 px",
);
