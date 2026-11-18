import { test, expect } from "./apoyo";
import { createServer, type Server } from "node:http";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";

// Sin API ni clientes reales: se compila la guardia y el plugin instalados.
// Solo el store de la caja es una fixture. SW y Workbox se ejecutan en Chromium.
const requireWeb = createRequire(resolve("apps/web/package.json"));
const requireVite = createRequire(requireWeb.resolve("vite"));
const { build } = requireVite("esbuild") as {
  build(options: any): Promise<{ outputFiles: { text: string }[] }>;
};
let server: Server;
let url: string;
let version = 1;
let bundle: string;

test.beforeAll(async () => {
  const plugin = readFileSync(
    resolve(
      dirname(requireWeb.resolve("vite-plugin-pwa")),
      "client/build/register.js",
    ),
    "utf8",
  )
    .replaceAll("__SW__", "/sw.js")
    .replaceAll("__SCOPE__", "/")
    .replaceAll("__TYPE__", "classic")
    .replaceAll("__SW_AUTO_UPDATE__", "false")
    .replaceAll("__SW_SELF_DESTROYING__", "false");
  const result = await build({
    stdin: {
      contents: `import {startPwaUpdates} from './apps/web/src/pwaUpdate'; import {useStore} from './apps/web/src/api';
      const loads=Number(sessionStorage.getItem('loads')||0)+1; sessionStorage.setItem('loads',String(loads));
      window.harness={loads,setCart(n){useStore.setState({cart:Array(n).fill({})})},setPayment(open){document.getElementById('payment')?.remove();if(open){const d=document.createElement('div');d.id='payment';d.role='dialog';document.body.append(d)}}}; startPwaUpdates();`,
      resolveDir: process.cwd(),
    },
    bundle: true,
    write: false,
    format: "iife",
    platform: "browser",
    plugins: [
      {
        name: "pwa-real-fixture",
        setup(builder: any) {
          builder.onResolve({ filter: /^virtual:pwa-register$/ }, () => ({
            path: "register",
            namespace: "fixture",
          }));
          builder.onLoad({ filter: /.*/, namespace: "fixture" }, () => ({
            contents: plugin,
            resolveDir: resolve("apps/web"),
          }));
          builder.onResolve({ filter: /\/api$/ }, (args: any) =>
            args.importer.endsWith("pwaUpdate.ts") ||
            (args.kind === "import-statement" &&
              args.path === "./apps/web/src/api")
              ? { path: "store", namespace: "store" }
              : undefined,
          );
          builder.onLoad({ filter: /.*/, namespace: "store" }, () => ({
            contents: `let state={cart:[]};const listeners=[];export const useStore={getState:()=>state,subscribe:fn=>listeners.push(fn),setState(next){const previous=state;state={...state,...next};listeners.forEach(fn=>fn(state,previous))}};`,
          }));
        },
      },
    ],
  });
  bundle = result.outputFiles[0].text;
  server = createServer((req, res) => {
    res.setHeader("Cache-Control", "no-store");
    if (req.url === "/sw.js") {
      res.setHeader("Content-Type", "application/javascript");
      res.end(
        `// version ${version}\nself.addEventListener('install',()=>{});self.addEventListener('activate',event=>event.waitUntil(clients.claim()));self.addEventListener('message',event=>{if(event.data?.type==='SKIP_WAITING')self.skipWaiting()});`,
      );
    } else if (req.url === "/app.js") {
      res.setHeader("Content-Type", "application/javascript");
      res.end(bundle);
    } else {
      res.setHeader("Content-Type", "text/html");
      res.end(
        '<!doctype html><html><body><h1>Prueba aislada PWA</h1><script src="/app.js"></script></body></html>',
      );
    }
  });
  await new Promise<void>((done) => server.listen(0, "127.0.0.1", done));
  const address = server.address();
  if (!address || typeof address === "string")
    throw new Error("Puerto de prueba no disponible");
  url = `http://127.0.0.1:${address.port}`;
});
test.afterAll(async () => {
  if (server) await new Promise<void>((done) => server.close(() => done()));
});

test("SW real: otra pestaña actualiza; carrito y pago no se recargan", async ({
  browser,
}) => {
  const context = await browser.newContext({ serviceWorkers: "allow" });
  try {
    const active = await context.newPage();
    await active.goto(url);
    await active.waitForFunction(() => !!navigator.serviceWorker.controller);
    await active.reload(); // instala listener con controlador ya existente
    const free = await context.newPage();
    await free.goto(url);
    await free.waitForFunction(() => !!(window as any).harness);
    await active.evaluate(() => {
      (window as any).harness.setCart(1);
      (window as any).harness.setPayment(true);
    });
    const loads = await active.evaluate(() => (window as any).harness.loads);
    version++;
    await free.evaluate(async () => {
      const r = await navigator.serviceWorker.ready;
      await r.update();
    });
    await expect(
      free.getByRole("button", { name: "Actualizar ahora" }),
    ).toBeVisible();
    // El SW provoca una navegación real a la MISMA URL. Registrar la espera
    // antes del clic evita evaluar el documento que Chromium está destruyendo.
    await Promise.all([
      free.waitForNavigation({ waitUntil: "load" }),
      free.getByRole("button", { name: "Actualizar ahora" }).click(),
    ]);
    expect(await free.evaluate(() => (window as any).harness.loads)).toBe(2);
    await active.waitForTimeout(500);
    expect(await active.evaluate(() => (window as any).harness.loads)).toBe(
      loads,
    );
    await active.evaluate(() => (window as any).harness.setCart(0));
    await active.waitForTimeout(250);
    expect(await active.evaluate(() => (window as any).harness.loads)).toBe(
      loads,
    );
    // También la pestaña ocupada debe recargar exactamente una vez, pero solo
    // tras retirar AMBAS barreras. Sin navegación, la espera falla: no se oculta
    // ninguna excepción ni se rebaja el conteo para hacer pasar la prueba.
    await Promise.all([
      active.waitForNavigation({ waitUntil: "load" }),
      active.evaluate(() => {
        (window as any).harness.setPayment(false);
        (window as any).harness.setCart(1);
        (window as any).harness.setCart(0);
      }),
    ]);
    expect(await active.evaluate(() => (window as any).harness.loads)).toBe(
      loads + 1,
    );
  } finally {
    await context.close();
  }
});
