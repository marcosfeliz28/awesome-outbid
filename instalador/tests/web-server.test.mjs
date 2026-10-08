import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile, mkdir } from "node:fs/promises";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { contentType, createHandler, proxyHeaders, resolveStaticPath } from "../runtime/web-server.mjs";

function listen(server) {
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => resolve(server.address().port));
  });
}

function close(server) {
  return new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
}

test("resuelve sólo rutas dentro de la PWA", () => {
  const root = path.resolve(os.tmpdir(), "fitstore-web");
  assert.equal(resolveStaticPath(root, "/"), path.join(root, "index.html"));
  assert.equal(resolveStaticPath(root, "/assets/app.js"), path.join(root, "assets", "app.js"));
  assert.equal(resolveStaticPath(root, "/../secrets.json"), null);
  assert.equal(resolveStaticPath(root, "/%2e%2e/secrets.json"), null);
  assert.equal(resolveStaticPath(root, "/..%5csecrets.json"), null);
  assert.equal(resolveStaticPath(root, "/%00.txt"), null);
});

test("define tipos de contenido seguros", () => {
  assert.equal(contentType("app.js"), "text/javascript; charset=utf-8");
  assert.equal(contentType("manifest.webmanifest"), "application/manifest+json; charset=utf-8");
  assert.equal(contentType("archivo.desconocido"), "application/octet-stream");
});

test("el proxy descarta cabeceras reenviadas por el cliente", () => {
  const request = {
    headers: {
      host: "192.168.1.20:4173",
      "x-forwarded-for": "203.0.113.10",
      "x-forwarded-proto": "http",
      "proxy-authorization": "secreto",
    },
    socket: { remoteAddress: "192.168.1.50" },
  };
  const headers = proxyHeaders(request);
  assert.equal(headers["x-forwarded-for"], "192.168.1.50");
  assert.equal(headers["x-forwarded-proto"], "https");
  assert.equal(headers["x-forwarded-host"], "192.168.1.20:4173");
  assert.equal(headers.host, "127.0.0.1:3001");
  assert.equal(headers["proxy-authorization"], undefined);
});

test("sirve PWA, fallback SPA, salud y proxy de mismo origen", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "fitstore-web-test-"));
  await mkdir(path.join(root, "assets"));
  await writeFile(path.join(root, "index.html"), "<!doctype html><title>FitStore</title>");
  await writeFile(path.join(root, "assets", "app.js"), "console.log('fitstore')");
  const api = http.createServer((request, response) => {
    response.setHeader("content-type", "application/json");
    response.end(JSON.stringify({ forwarded: request.headers["x-forwarded-for"], proto: request.headers["x-forwarded-proto"] }));
  });
  const apiPort = await listen(api);
  const web = http.createServer(createHandler({ webRoot: root, apiPort }));
  const webPort = await listen(web);
  try {
    const health = await globalThis.fetch(`http://127.0.0.1:${webPort}/__fitstore/health`);
    assert.equal(health.status, 200);
    assert.equal((await health.json()).status, "ok");

    const asset = await globalThis.fetch(`http://127.0.0.1:${webPort}/assets/app.js`);
    assert.equal(asset.status, 200);
    assert.match(asset.headers.get("cache-control"), /immutable/);

    const spa = await globalThis.fetch(`http://127.0.0.1:${webPort}/ventas/actual`, { headers: { accept: "text/html" } });
    assert.equal(spa.status, 200);
    assert.match(await spa.text(), /FitStore/);

    const proxied = await globalThis.fetch(`http://127.0.0.1:${webPort}/api/health`, { headers: { "x-forwarded-for": "203.0.113.7" } });
    assert.equal(proxied.status, 200);
    const body = await proxied.json();
    assert.notEqual(body.forwarded, "203.0.113.7");
    assert.equal(body.proto, "https");
  } finally {
    await close(web);
    await close(api);
    await rm(root, { recursive: true, force: true });
  }
});
