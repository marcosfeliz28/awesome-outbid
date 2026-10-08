import { createReadStream, readFileSync, statSync } from "node:fs";
import { createServer } from "node:https";
import http from "node:http";
import path from "node:path";
import console from "node:console";
import process from "node:process";
import { fileURLToPath, URL } from "node:url";

const MIME = new Map([
  [".css", "text/css; charset=utf-8"],
  [".html", "text/html; charset=utf-8"],
  [".ico", "image/x-icon"],
  [".js", "text/javascript; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".map", "application/json; charset=utf-8"],
  [".png", "image/png"],
  [".svg", "image/svg+xml"],
  [".webmanifest", "application/manifest+json; charset=utf-8"],
  [".woff", "font/woff"],
  [".woff2", "font/woff2"],
]);

export function contentType(filePath) {
  return MIME.get(path.extname(filePath).toLowerCase()) || "application/octet-stream";
}

export function resolveStaticPath(webRoot, rawPathname) {
  let decoded;
  try {
    decoded = decodeURIComponent(rawPathname).replaceAll("\\", "/");
  } catch {
    return null;
  }
  if (decoded.includes("\0") || decoded.split("/").includes("..")) return null;
  const relative = decoded.replace(/^\/+/, "") || "index.html";
  const root = path.resolve(webRoot);
  const candidate = path.resolve(root, relative);
  if (candidate !== root && !candidate.startsWith(`${root}${path.sep}`)) return null;
  return candidate;
}

export function proxyHeaders(request) {
  const remote = request.socket?.remoteAddress || "127.0.0.1";
  const headers = { ...request.headers };
  delete headers["proxy-authorization"];
  delete headers["x-forwarded-for"];
  delete headers["x-forwarded-host"];
  delete headers["x-forwarded-proto"];
  headers.host = "127.0.0.1:3001";
  headers["x-forwarded-for"] = remote;
  headers["x-forwarded-host"] = request.headers.host || "localhost:4173";
  headers["x-forwarded-proto"] = "https";
  return headers;
}

function baseHeaders(response) {
  response.setHeader("X-Content-Type-Options", "nosniff");
  response.setHeader("X-Frame-Options", "DENY");
  response.setHeader("Referrer-Policy", "same-origin");
  response.setHeader("Permissions-Policy", "geolocation=(), microphone=()");
}

function proxyApi(request, response, apiPort) {
  const upstream = http.request(
    {
      host: "127.0.0.1",
      port: apiPort,
      method: request.method,
      path: request.url,
      headers: proxyHeaders(request),
    },
    (upstreamResponse) => {
      response.writeHead(upstreamResponse.statusCode || 502, upstreamResponse.headers);
      upstreamResponse.pipe(response);
    },
  );
  upstream.setTimeout(0);
  upstream.on("error", (error) => {
    if (response.headersSent) {
      response.destroy(error);
      return;
    }
    response.writeHead(502, { "Content-Type": "application/json; charset=utf-8" });
    response.end(JSON.stringify({ message: "El servicio de FitStore no está disponible." }));
  });
  request.on("aborted", () => upstream.destroy());
  request.pipe(upstream);
}

function serveFile(request, response, filePath) {
  const name = path.basename(filePath).toLowerCase();
  const immutable = filePath.includes(`${path.sep}assets${path.sep}`);
  const noCache = name === "index.html" || name === "sw.js" || name.endsWith(".webmanifest");
  const stats = statSync(filePath);
  response.statusCode = 200;
  response.setHeader("Content-Type", contentType(filePath));
  response.setHeader("Content-Length", stats.size);
  response.setHeader(
    "Cache-Control",
    noCache ? "no-cache, no-store, must-revalidate" : immutable ? "public, max-age=31536000, immutable" : "public, max-age=3600",
  );
  if (request.method === "HEAD") {
    response.end();
    return;
  }
  const stream = createReadStream(filePath);
  stream.on("error", () => {
    if (!response.headersSent) response.writeHead(500);
    response.end();
  });
  stream.pipe(response);
}

export function createHandler(config) {
  const webRoot = path.resolve(config.webRoot);
  const apiPort = Number(config.apiPort || 3001);
  return (request, response) => {
    baseHeaders(response);
    let url;
    try {
      url = new URL(request.url || "/", "https://fitstore.local");
    } catch {
      response.writeHead(400).end();
      return;
    }
    if (url.pathname === "/__fitstore/health") {
      response.writeHead(200, {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "no-store",
      });
      response.end(JSON.stringify({ status: "ok", service: "FitStore Web HTTPS" }));
      return;
    }
    if (url.pathname === "/api" || url.pathname.startsWith("/api/")) {
      proxyApi(request, response, apiPort);
      return;
    }
    if (request.method !== "GET" && request.method !== "HEAD") {
      response.writeHead(405, { Allow: "GET, HEAD" }).end();
      return;
    }
    const requested = resolveStaticPath(webRoot, url.pathname);
    if (!requested) {
      response.writeHead(400).end();
      return;
    }
    try {
      if (statSync(requested).isFile()) {
        serveFile(request, response, requested);
        return;
      }
    } catch {
      // La ruta SPA se atiende con index.html.
    }
    const acceptsHtml = String(request.headers.accept || "").includes("text/html");
    const spaRoute = !path.posix.extname(url.pathname);
    const indexPath = path.join(webRoot, "index.html");
    if (acceptsHtml && spaRoute) {
      try {
        serveFile(request, response, indexPath);
        return;
      } catch {
        // Continúa con 404.
      }
    }
    response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    response.end("No encontrado");
  };
}

export function startServer(configPath) {
  const config = JSON.parse(readFileSync(configPath, "utf8"));
  const tls = {
    pfx: readFileSync(config.pfxPath),
    passphrase: config.pfxPassword,
    minVersion: "TLSv1.2",
  };
  const server = createServer(tls, createHandler(config));
  server.requestTimeout = 0;
  server.headersTimeout = 65000;
  server.keepAliveTimeout = 5000;
  server.on("clientError", (_error, socket) => socket.end("HTTP/1.1 400 Bad Request\r\n\r\n"));
  server.listen(Number(config.port || 4173), config.host || "0.0.0.0", () => {
    console.log(`FitStore Web HTTPS listo en el puerto ${Number(config.port || 4173)}.`);
  });
  return server;
}

const invoked = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));
if (invoked) {
  const configPath = process.argv[2];
  if (!configPath) throw new Error("Falta la ruta del archivo server.json.");
  startServer(configPath);
}
