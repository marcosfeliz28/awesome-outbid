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
      contents: `import {startPwaUpdates} from './apps/web/src/pwaUpdate'; import {useStore,localDB} from './apps/web/src/api'; import {keepCartDraft,flushEmptyDraftBeforeReload} from './apps/web/src/cartDraft';
      const loads=Number(sessionStorage.getItem('loads')||0)+1; sessionStorage.setItem('loads',String(loads));
      window.harness={loads,setCart(n){useStore.setState({cart:Array(n).fill({variant:{id:'v1',price:10},product:{id:'p1',variants:[]},qty:1})})},getCart(){return useStore.getState().cart},saved(){return localDB.cache.get('cart-draft:u1')},setPayment(open){document.getElementById('payment')?.remove();if(open){const d=document.createElement('div');d.id='payment';d.role='dialog';document.body.append(d)}}}; startPwaUpdates(flushEmptyDraftBeforeReload); keepCartDraft(); useStore.setState({user:{id:'u1'}});`,
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
            args.importer.endsWith("cartDraft.ts") ||
            (args.kind === "import-statement" &&
              args.path === "./apps/web/src/api")
              ? { path: "store", namespace: "store" }
              : undefined,
          );
          builder.onResolve({ filter: /^\.\/(Incentives|helpers)$/ }, (args) =>
            args.importer.endsWith("cartDraft.ts")
              ? { path: args.path, namespace: "draft-deps" }
              : undefined,
          );
          builder.onLoad({ filter: /.*/, namespace: "draft-deps" }, () => ({
            contents:
              "export const toast=()=>{};export const useWholesale={getState:()=>({on:false,set:()=>{}})};",
          }));
          builder.onLoad({ filter: /.*/, namespace: "store" }, () => ({
            resolveDir: resolve("apps/web"),
            contents: `let state={cart:[],user:null,customerId:null,globalDiscount:0};const listeners=[];export const useStore={getState:()=>state,subscribe:fn=>listeners.push(fn),setState(next){const previous=state;state={...state,...next};listeners.forEach(fn=>fn(state,previous))}};
            import Dexie from 'dexie'; export const localDB=new Dexie('real-cart-draft');localDB.version(1).stores({cache:'key',sales:'uuid'});`,
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

test("SW real y cartDraft real: quitar último artículo no lo restaura tras recargar", async ({
  browser,
}) => {
  const context = await browser.newContext({ serviceWorkers: "allow" });
  try {
    const active = await context.newPage();
    await active.goto(url);
    await active.waitForFunction(() => !!navigator.serviceWorker.controller);
    await active.reload();
    const free = await context.newPage();
    await free.goto(url);
    await free.waitForFunction(() => !!(window as any).harness);
    await active.evaluate(() => (window as any).harness.setCart(1));
    await expect
      .poll(() =>
        active.evaluate(
          async () =>
            (await (window as any).harness.saved())?.data.items.length,
        ),
      )
      .toBe(1);
    version++;
    await free.evaluate(async () =>
      (await navigator.serviceWorker.ready).update(),
    );
    await expect(
      free.getByRole("button", { name: "Actualizar ahora" }),
    ).toBeVisible();
    await Promise.all([
      free.waitForNavigation({ waitUntil: "load" }),
      free.getByRole("button", { name: "Actualizar ahora" }).click(),
    ]);
    const loads = await active.evaluate(() => (window as any).harness.loads);
    await Promise.all([
      active.waitForNavigation({ waitUntil: "load" }),
      active.evaluate(() => (window as any).harness.setCart(0)),
    ]);
    await expect
      .poll(() => active.evaluate(() => (window as any).harness.loads))
      .toBe(loads + 1);
    await expect
      .poll(() =>
        active.evaluate(() => (window as any).harness.getCart().length),
      )
      .toBe(0);
    expect(
      await active.evaluate(() => (window as any).harness.saved()),
    ).toBeUndefined();
    await active.reload();
    await expect
      .poll(() =>
        active.evaluate(() => (window as any).harness.getCart().length),
      )
      .toBe(0);
  } finally {
    await context.close();
  }
});

test("IndexedDB real: vaciar A no borra la revisión nueva de B del mismo usuario", async ({
  browser,
}) => {
  const context = await browser.newContext({ serviceWorkers: "allow" });
  try {
    const a = await context.newPage();
    await a.goto(url);
    await a.waitForFunction(() => !!navigator.serviceWorker.controller);
    await a.reload();
    const free = await context.newPage();
    await free.goto(url);
    await free.waitForFunction(() => !!(window as any).harness);
    await a.evaluate(() => (window as any).harness.setCart(1));
    await expect
      .poll(() =>
        a.evaluate(
          async () =>
            (await (window as any).harness.saved())?.data.items.length,
        ),
      )
      .toBe(1);
    const b = await context.newPage();
    await b.goto(url);
    await expect
      .poll(() => b.evaluate(() => (window as any).harness?.getCart().length))
      .toBe(1);
    await b.evaluate(() => (window as any).harness.setCart(9));
    await expect
      .poll(() =>
        b.evaluate(
          async () =>
            (await (window as any).harness.saved())?.data.items.length,
        ),
      )
      .toBe(9);
    version++;
    await free.evaluate(async () =>
      (await navigator.serviceWorker.ready).update(),
    );
    await expect(
      free.getByRole("button", { name: "Actualizar ahora" }),
    ).toBeVisible();
    await Promise.all([
      free.waitForNavigation({ waitUntil: "load" }),
      free.getByRole("button", { name: "Actualizar ahora" }).click(),
    ]);
    const loads = await a.evaluate(() => (window as any).harness.loads);
    await a.evaluate(() => (window as any).harness.setCart(0));
    await a.waitForTimeout(3000);
    expect(await a.evaluate(() => (window as any).harness.loads)).toBe(loads);
    expect(
      await b.evaluate(
        async () => (await (window as any).harness.saved()).data.items.length,
      ),
    ).toBe(9);
    await b.reload();
    await expect
      .poll(() => b.evaluate(() => (window as any).harness?.getCart().length))
      .toBe(9);
  } finally {
    await context.close();
  }
});
