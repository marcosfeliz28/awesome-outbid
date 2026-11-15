/* global console, process */
import { mkdir, readFile } from "node:fs/promises";
import { createServer } from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "/opt/codex/runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs";

const root = path.dirname(fileURLToPath(import.meta.url));
const output = path.join(root, "capturas");
await mkdir(output, { recursive: true });

const server = createServer(async (request, response) => {
  try {
    const pathname = decodeURIComponent(new URL(request.url, "http://local").pathname);
    const relative = pathname === "/" ? "index.html" : pathname.slice(1);
    const target = path.join(root, relative);
    if (!target.startsWith(root)) throw new Error("Ruta fuera del preview");
    const body = await readFile(target);
    const type = target.endsWith(".css") ? "text/css" : "text/html";
    response.writeHead(200, { "content-type": `${type}; charset=utf-8` });
    response.end(body);
  } catch {
    response.writeHead(404);
    response.end("No encontrado");
  }
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const address = server.address();
const baseUrl = `http://127.0.0.1:${address.port}`;

const pages = [
  { file: "caja.html", slug: "caja", depth: "25d" },
  { file: "direccion.html", slug: "direccion", depth: "3d" },
  { file: "mercancia.html", slug: "mercancia", depth: "25d" },
];
const viewports = [
  { slug: "1440", width: 1440, height: 900 },
  { slug: "390", width: 390, height: 844 },
];

const browser = await chromium.launch({
  executablePath: "/usr/bin/chromium",
  headless: true,
  args: ["--no-sandbox", "--disable-dev-shm-usage"],
});

async function capture({ pageSpec, viewport, theme, depth, filename }) {
  const context = await browser.newContext({
    colorScheme: theme === "oscuro" ? "dark" : "light",
    reducedMotion: "reduce",
    viewport: { width: viewport.width, height: viewport.height },
  });
  const page = await context.newPage();
  await page.goto(`${baseUrl}/${pageSpec.file}`);
  if (!depth) {
    await page.evaluate(() => {
      document.body.className = "";
    });
  }
  const audit = await page.evaluate(() => {
    const visibleText = [...document.querySelectorAll("body *")].filter((element) => {
      const style = getComputedStyle(element);
      return (
        element.childElementCount === 0 &&
        element.textContent.trim() &&
        style.display !== "none" &&
        style.visibility !== "hidden" &&
        element.getBoundingClientRect().width > 0
      );
    });
    return {
      overflow: document.documentElement.scrollWidth - window.innerWidth,
      minimumFont: Math.min(
        ...visibleText.map((element) => Number.parseFloat(getComputedStyle(element).fontSize)),
      ),
      h1: document.querySelectorAll("h1").length,
      main: document.querySelectorAll("main").length,
    };
  });
  if (audit.overflow > 0 || audit.minimumFont < 14 || audit.h1 !== 1 || audit.main !== 1) {
    throw new Error(`${filename}: auditoria visual invalida ${JSON.stringify(audit)}`);
  }
  await page.screenshot({
    path: path.join(output, filename),
    fullPage: false,
    animations: "disabled",
  });
  await context.close();
}

for (const pageSpec of pages) {
  for (const viewport of viewports) {
    await capture({
      pageSpec,
      viewport,
      theme: "claro",
      depth: false,
      filename: `${pageSpec.slug}-claro-${viewport.slug}.png`,
    });
  }
}

for (const pageSpec of pages) {
  for (const theme of ["claro", "oscuro"]) {
    for (const viewport of viewports) {
      await capture({
        pageSpec,
        viewport,
        theme,
        depth: true,
        filename: `${pageSpec.slug}-${pageSpec.depth}-${theme}-${viewport.slug}.png`,
      });
    }
  }
}

await browser.close();
server.close();
console.log("PASS: 6 capturas claras + 12 capturas B2 = 18");
