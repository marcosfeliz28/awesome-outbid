// G14 · Avisos de terceros de lo que va dentro de la aplicación web compilada.
//
//   node scripts/licencias-web.mjs           escribe apps/web/public/licencias.txt
//   node scripts/licencias-web.mjs --check   falla si el archivo no está al día
//
// Compila la web con la configuración real (vite.config.ts) en una carpeta
// temporal y anota de qué paquete de node_modules sale cada módulo del JS y
// del CSS compilados (fuentes incluidas). La licencia declarada se contrasta
// con `pnpm licenses list --json --prod --filter @fitstore/web`; el texto
// completo sale del archivo LICENSE/OFL de cada paquete. El service worker lo
// arma workbox-build con workbox-core, -precaching, -routing y -strategies.
import { execFileSync } from "node:child_process";
import {
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const web = join(root, "apps", "web");
const target = join(web, "public", "licencias.txt");
// El aviso del instalador lleva la lista y los textos de fuentes e íconos.
const installer = join(root, "instalador", "THIRD_PARTY_NOTICES.txt");
const START = "<!-- licencias-web: inicio (node scripts/licencias-web.mjs) -->";
const END = "<!-- licencias-web: fin -->";
const check = process.argv.includes("--check");
const webRequire = createRequire(join(web, "package.json"));
const { build } = await import(webRequire.resolve("vite"));

// 1. Paquetes que entran en la compilación.
const packages = new Map(); // dir -> { name, version }
const packageDir = (id) => {
  const clean = id.replace(/^\0/, "").split("?")[0];
  const at = clean.lastIndexOf(sep + "node_modules" + sep);
  if (at < 0) return null;
  const rest = clean.slice(at + 14).split(sep);
  const parts = rest[0].startsWith("@") ? 2 : 1;
  return clean.slice(0, at + 14) + rest.slice(0, parts).join(sep);
};
const out = mkdtempSync(join(tmpdir(), "nexora-licencias-"));
let workbox = false;
try {
  await build({
    root: web,
    configFile: join(web, "vite.config.ts"),
    logLevel: "warn",
    build: { outDir: out, emptyOutDir: true },
    plugins: [
      {
        name: "nexora-licencias",
        generateBundle(_options, bundle) {
          const used = new Set();
          for (const file of Object.values(bundle))
            if (file.type === "chunk")
              for (const [id, mod] of Object.entries(file.modules))
                if (mod.renderedLength > 0) used.add(id);
          // CSS del grafo y archivos que el CSS copia (las fuentes .woff2).
          for (const id of this.getModuleIds())
            if (/\.css($|\?)/.test(id)) used.add(id);
          for (const file of Object.values(bundle))
            if (file.type === "asset")
              for (const name of file.originalFileNames ?? [])
                used.add(resolve(web, name));
          for (const id of used) {
            const dir = packageDir(id);
            if (!dir || packages.has(dir)) continue;
            const pkg = JSON.parse(
              readFileSync(join(dir, "package.json"), "utf8"),
            );
            packages.set(dir, { name: pkg.name, version: pkg.version });
          }
        },
      },
    ],
  });
  workbox = readdirSync(out).some((f) => /^workbox-.*\.js$/.test(f));
} finally {
  rmSync(out, { recursive: true, force: true });
}
if (workbox) {
  const buildDir = dirname(
    createRequire(webRequire.resolve("vite-plugin-pwa")).resolve(
      "workbox-build/package.json",
    ),
  );
  const wbRequire = createRequire(join(buildDir, "package.json"));
  for (const name of [
    "workbox-core",
    "workbox-precaching",
    "workbox-routing",
    "workbox-strategies",
  ]) {
    const dir = dirname(wbRequire.resolve(name + "/package.json"));
    const pkg = JSON.parse(readFileSync(join(dir, "package.json"), "utf8"));
    packages.set(dir, { name: pkg.name, version: pkg.version });
  }
}

// 2. Licencia declarada (pnpm licenses) y texto de cada paquete.
let pnpmLicenses = new Map();
try {
  const raw = execFileSync(
    "pnpm",
    ["licenses", "list", "--json", "--prod", "--filter", "@fitstore/web"],
    { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] },
  );
  for (const [license, list] of Object.entries(JSON.parse(raw)))
    for (const item of list)
      for (const version of item.versions)
        pnpmLicenses.set(item.name + "@" + version, license);
} catch {
  console.warn(
    "Aviso: `pnpm licenses list` no respondió; se usa package.json.",
  );
}
const licenseFiles = (dir) =>
  readdirSync(dir)
    .filter((f) => /^(licen[cs]e|copying|ofl|notice)([.-].*)?$/i.test(f))
    .sort();
// Paquete MIT o ISC sin archivo de licencia: se reproduce el texto estándar
// con el titular que declara su package.json (y se dice que es así).
const MIT = `Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.`;
const ISC = `Permission to use, copy, modify, and/or distribute this software for any
purpose with or without fee is hereby granted, provided that the above
copyright notice and this permission notice appear in all copies.

THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES
WITH REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF
MERCHANTABILITY AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR
ANY SPECIAL, DIRECT, INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES
WHATSOEVER RESULTING FROM LOSS OF USE, DATA OR PROFITS, WHETHER IN AN
ACTION OF CONTRACT, NEGLIGENCE OR OTHER TORTIOUS ACTION, ARISING OUT OF
OR IN CONNECTION WITH THE USE OR PERFORMANCE OF THIS SOFTWARE.`;
const standardText = (license, pkg) => {
  const template = { MIT, ISC }[license];
  if (!template) return null;
  const author = typeof pkg.author === "string" ? pkg.author : pkg.author?.name;
  if (!author) return null;
  return (
    "(El paquete no trae archivo de licencia: texto estándar " +
    license +
    " con el titular de su package.json.)\n\n" +
    "Copyright (c) " +
    author.replace(/\s*<[^>]*>/, "") +
    "\n\n" +
    template
  );
};
const entries = [];
const problems = [];
for (const [dir, { name, version }] of packages) {
  const pkg = JSON.parse(readFileSync(join(dir, "package.json"), "utf8"));
  const declared =
    typeof pkg.license === "string"
      ? pkg.license
      : pkg.license?.type ||
        (pkg.licenses || []).map((l) => l.type).join(" OR ");
  const listed = pnpmLicenses.get(name + "@" + version);
  if (listed && declared && listed !== declared)
    problems.push(
      `${name}@${version}: pnpm dice ${listed}, package.json ${declared}`,
    );
  const files = licenseFiles(dir);
  const texts = files.map((f) =>
    readFileSync(join(dir, f), "utf8").replace(/\r\n?/g, "\n").trim(),
  );
  if (!texts.length) {
    const standard = standardText(declared || listed, pkg);
    if (standard) texts.push(standard);
  }
  if (!declared && !listed)
    problems.push(`${name}@${version}: sin licencia declarada`);
  if (!texts.length)
    problems.push(`${name}@${version}: sin archivo de licencia`);
  const repo =
    typeof pkg.repository === "string" ? pkg.repository : pkg.repository?.url;
  entries.push({
    name,
    version,
    license: declared || listed || "SIN DECLARAR",
    source: (repo || pkg.homepage || "").replace(/^git\+/, ""),
    texts,
  });
}
entries.sort(
  (a, b) => a.name.localeCompare(b.name) || a.version.localeCompare(b.version),
);
// Paquetes sin archivo propio cuyo texto se conoce (no se inventa ninguno:
// si falta, la generación se detiene).
const missing = problems.filter(
  (p) => p.includes("sin archivo") || p.includes("sin licencia"),
);
if (missing.length) {
  console.error("Faltan datos de licencia:\n" + missing.join("\n"));
  process.exit(1);
}
for (const p of problems) console.warn("Aviso: " + p);

// 3. Texto final.
const line = "=".repeat(78);
const summary = entries
  .map((e) => `- ${e.name} ${e.version} · ${e.license}`)
  .join("\n");
const body = entries
  .map(
    (e) =>
      `${line}\n${e.name} ${e.version}\nLicencia: ${e.license}\n` +
      (e.source ? `Origen: ${e.source}\n` : "") +
      "\n" +
      e.texts.join("\n\n") +
      "\n",
  )
  .join("\n");
const text =
  `Nexora POS · Avisos de terceros de la aplicación web\n\n` +
  `Este archivo lo genera \`node scripts/licencias-web.mjs\` a partir de lo que\n` +
  `entra en la compilación de apps/web (JavaScript, CSS y fuentes) y del\n` +
  `service worker. Cada componente conserva su licencia; aquí se reproducen\n` +
  `sus avisos de copyright y sus textos de licencia completos.\n\n` +
  `Fuentes tipográficas: Inter y Plus Jakarta Sans, SIL Open Font License 1.1\n` +
  `(paquetes @fontsource-variable/*). Íconos: Lucide (ISC; partes derivadas de\n` +
  `Feather, MIT). El ícono de la app y las ilustraciones de productos son\n` +
  `propios (ver docs/legal/ORIGEN_DE_ACTIVOS.md).\n\n` +
  `Componentes (${entries.length}):\n${summary}\n\n${body}`;
const visible = entries.filter((e) =>
  /^(@fontsource-variable\/|lucide-react$)/.test(e.name),
);
const notices = readFileSync(installer, "utf8");
const from = notices.indexOf(START),
  to = notices.indexOf(END);
if (from < 0 || to < from) {
  console.error("Faltan las marcas licencias-web en " + installer);
  process.exit(1);
}
const block =
  START +
  "\n\nAPLICACIÓN WEB · COMPONENTES INCLUIDOS (" +
  entries.length +
  ")\n\n" +
  summary +
  "\n\n" +
  visible
    .map(
      (e) =>
        `${line}\n${e.name} ${e.version} · ${e.license}\n\n` +
        e.texts.join("\n\n") +
        "\n",
    )
    .join("\n") +
  "\n";
const installerText = notices.slice(0, from) + block + notices.slice(to);
if (check) {
  const read = (path) => {
    try {
      return readFileSync(path, "utf8");
    } catch {
      return "";
    }
  };
  const stale = [
    [target, text],
    [installer, installerText],
  ].filter(([path, wanted]) => read(path) !== wanted);
  if (stale.length) {
    console.error(
      stale.map(([path]) => path).join(", ") +
        " no está al día: corre node scripts/licencias-web.mjs",
    );
    process.exit(1);
  }
  console.log(`Avisos de licencia al día (${entries.length} componentes).`);
} else {
  writeFileSync(target, text);
  writeFileSync(installer, installerText);
  console.log(
    `Escritos ${target} e ${installer} (${entries.length} componentes).`,
  );
}
