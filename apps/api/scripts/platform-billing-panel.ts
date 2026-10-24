/**
 * Panel operacional de Nexora. Proceso separado: nunca se registra en la API
 * de las empresas ni usa sus sesiones. Sólo escucha en 127.0.0.1.
 */
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { reviewProductBilling } from "./review-product-billing";
import { tenantObjectStore } from "../src/tenant-object-store";

type PanelOptions = { reviewer: string; token: string };
const idPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const hostPattern = /^127\.0\.0\.1(?::\d{1,5})?$/;
const headers = {
  "Cache-Control": "no-store",
  "Content-Security-Policy": "default-src 'none'; script-src 'self'; style-src 'unsafe-inline'; img-src 'self'; connect-src 'self'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'",
  "Referrer-Policy": "no-referrer",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
};

function reply(res: ServerResponse, status: number, body: unknown) {
  res.writeHead(status, { ...headers, "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(body));
}

function authorized(req: IncomingMessage, token: string): boolean {
  const value = req.headers.authorization;
  if (!value?.startsWith("Basic ") || value.length > 256) return false;
  const decoded = Buffer.from(value.slice(6), "base64").toString("utf8");
  const [username, supplied] = decoded.split(":", 2);
  const expected = Buffer.from(token);
  const actual = Buffer.from(supplied ?? "");
  return username === "operador" && actual.length === expected.length && timingSafeEqual(actual, expected);
}

async function readJson(req: IncomingMessage) {
  if (!req.headers["content-type"]?.startsWith("application/json")) throw new Error("Envía JSON.");
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    const bytes = Buffer.from(chunk);
    size += bytes.length;
    if (size > 4096) throw new Error("Solicitud demasiado grande.");
    chunks.push(bytes);
  }
  const body: unknown = JSON.parse(Buffer.concat(chunks).toString("utf8"));
  if (!body || typeof body !== "object" || Array.isArray(body)) throw new Error("Solicitud inválida.");
  return body as Record<string, unknown>;
}

// Ambas lecturas usan exclusivamente el rol operacional de plataforma.
async function pendingRequests(db: PrismaClient) {
  const rows = await db.$transaction(async (tx) => {
    await tx.$executeRawUnsafe("SET LOCAL ROLE nexora_platform_billing");
    return tx.$queryRaw<Array<{
      id: string; tenantId: string; tenantName: string; plan: string; amount: string; provider: string;
      submittedAt: Date | null; createdAt: Date; hasLegacyProof: boolean;
      legacyProofSha256: string | null; proofObjectKey: string | null;
    }>>`
      SELECT r.id, r."tenantId", t.name AS "tenantName", r.plan, r.amount::text, r.provider,
             r."submittedAt", r."createdAt", r.proof IS NOT NULL AS "hasLegacyProof",
             encode(sha256(r.proof), 'hex') AS "legacyProofSha256", r."proofObjectKey"
      FROM "BillingRequest" r JOIN "Tenant" t ON t.id=r."tenantId"
      WHERE r.status='pending_review'
      ORDER BY r."submittedAt" ASC NULLS LAST, r."createdAt" ASC
      LIMIT 100`;
  }, { isolationLevel: "ReadCommitted" });
  // El comprobante nuevo vive fuera de PostgreSQL. No mantengas una transacción
  // operacional abierta mientras el almacén de objetos responde.
  return Promise.all(rows.map(async ({ tenantId, proofObjectKey, hasLegacyProof, legacyProofSha256, ...row }) => ({
    ...row,
    hasProof: hasLegacyProof || proofObjectKey !== null,
    proofSha256: proofObjectKey
      ? createHash("sha256").update(await tenantObjectStore().get(tenantId, proofObjectKey)).digest("hex")
      : legacyProofSha256,
  })));
}

async function proofForReview(db: PrismaClient, id: string) {
  const row = await db.$transaction(async (tx) => {
    await tx.$executeRawUnsafe("SET LOCAL ROLE nexora_platform_billing");
    const rows = await tx.$queryRaw<Array<{
      tenantId: string; proof: Uint8Array | null; proofObjectKey: string | null; proofMime: string | null;
    }>>`
      SELECT "tenantId", proof, "proofObjectKey", "proofMime"
      FROM "BillingRequest" WHERE id=${id}::uuid AND status='pending_review'`;
    return rows[0] ?? null;
  }, { isolationLevel: "ReadCommitted" });
  if (!row) return null;
  return {
    proof: row.proofObjectKey ? await tenantObjectStore().get(row.tenantId, row.proofObjectKey) : row.proof,
    proofMime: row.proofMime,
  };
}

const page = `<!doctype html><html lang="es"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Nexora · Conciliación de planes</title><style>
body{font:16px system-ui;background:#f4f6fa;color:#182333;max-width:1100px;margin:auto;padding:1.5rem}
h1{font-size:1.5rem} .card{background:white;border:1px solid #bcc8d6;border-radius:12px;padding:1rem;margin:1rem 0}
button,input,select,textarea{font:inherit;padding:.65rem;border:1px solid #566c84;border-radius:7px}
button{background:#163b77;color:white;cursor:pointer;min-height:44px} button:disabled{opacity:.55}
label{display:block;margin:.7rem 0} input,textarea,select{display:block;width:100%;box-sizing:border-box}
img{max-width:100%;max-height:360px;object-fit:contain} .muted{color:#42566d} .warning{background:#fff4d1;padding:.7rem}
@media(max-width:390px){body{padding:.6rem}.card{padding:.7rem}}
</style><h1>Conciliación de planes Nexora</h1>
<p class="warning">La imagen no acredita el pago. Comprueba el movimiento en el banco antes de aprobar.</p>
<button id="reload">Actualizar solicitudes</button><p id="status" role="status"></p><main id="requests"></main>
<script src="/panel.js" defer></script></html>`;

const clientScript = `const root=document.getElementById('requests'),status=document.getElementById('status');
const el=(tag,text)=>{const node=document.createElement(tag);if(text!==undefined)node.textContent=text;return node};
async function load(){root.replaceChildren();status.textContent='Cargando…';try{
 const response=await fetch('/api/requests',{cache:'no-store'});if(!response.ok)throw new Error('No se pudieron consultar las solicitudes');
 const {requests}=await response.json();status.textContent=requests.length+' solicitudes pendientes';
 for(const row of requests){const card=el('section');card.className='card';card.append(el('h2',row.tenantName+' · '+row.plan),el('p','RD$ '+row.amount+' · '+row.provider+' · '+row.id));
  const hash=el('p','SHA-256 de imagen: '+(row.proofSha256||'Sin comprobante'));hash.className='muted';card.append(hash);
  if(row.hasProof){const img=el('img');img.alt='Comprobante presentado por '+row.tenantName;img.src='/api/requests/'+row.id+'/proof';card.append(img)}
  const reason=el('textarea');reason.placeholder='Motivo y referencia bancaria comprobada';reason.setAttribute('aria-label','Motivo de revisión');card.append(reason);
  const paid=el('input');paid.type='date';paid.setAttribute('aria-label','Vigencia pagada hasta');card.append(paid);
  for(const decision of ['approved','rejected']){const button=el('button',decision==='approved'?'Aprobar pago':'Rechazar');button.onclick=async()=>{
   if(!reason.value.trim()){status.textContent='Escribe el motivo y la referencia bancaria';return}
   if(decision==='approved'&&!paid.value){status.textContent='Indica la fecha de vigencia';return}
   if(!confirm('¿Confirmas '+(decision==='approved'?'APROBAR':'RECHAZAR')+' esta solicitud tras cotejar el banco?'))return;
   button.disabled=true;try{const response=await fetch('/api/requests/'+row.id+'/decision',{method:'POST',headers:{'Content-Type':'application/json','X-Nexora-Panel':'1'},
    body:JSON.stringify({decision,reason:reason.value.trim(),paidThroughAt:decision==='approved'?paid.value+'T23:59:59.000Z':undefined,expectedProofSha256:row.proofSha256})});
    const result=await response.json();if(!response.ok)throw new Error(result.error||'No se guardó la decisión');await load();status.textContent='Decisión guardada: '+result.status;
   }catch(error){status.textContent=String(error.message||error)}finally{button.disabled=false}};card.append(button,el('span',' '))}
  root.append(card)}
 }catch(error){status.textContent=String(error.message||error)}}
document.getElementById('reload').onclick=load;load();`;

export function createPlatformBillingPanel(db: PrismaClient, options: PanelOptions): Server {
  if (!options.reviewer.trim() || !options.token) throw new Error("Faltan operador o credencial local.");
  return createServer(async (req, res) => {
    if (!hostPattern.test(req.headers.host ?? "") || !["127.0.0.1", "::1", "::ffff:127.0.0.1"].includes(req.socket.remoteAddress ?? "")) {
      reply(res, 403, { error: "Panel sólo local." }); return;
    }
    if (!authorized(req, options.token)) {
      res.writeHead(401, { ...headers, "WWW-Authenticate": 'Basic realm="Nexora plataforma"', "Content-Type": "text/plain" });
      res.end("Credencial de operador requerida."); return;
    }
    const origin = `http://${req.headers.host}`;
    if (req.method === "POST" && (req.headers.origin !== origin || req.headers["x-nexora-panel"] !== "1")) {
      reply(res, 403, { error: "Origen de operación inválido." }); return;
    }
    try {
      const path = new URL(req.url ?? "/", origin).pathname;
      if (req.method === "GET" && path === "/") {
        res.writeHead(200, { ...headers, "Content-Type": "text/html; charset=utf-8" }); res.end(page); return;
      }
      if (req.method === "GET" && path === "/panel.js") {
        res.writeHead(200, { ...headers, "Content-Type": "text/javascript; charset=utf-8" }); res.end(clientScript); return;
      }
      if (req.method === "GET" && path === "/api/requests") {
        reply(res, 200, { requests: await pendingRequests(db) }); return;
      }
      const match = /^\/api\/requests\/([^/]+)\/(proof|decision)$/.exec(path);
      if (!match || !idPattern.test(match[1])) { reply(res, 404, { error: "Ruta desconocida." }); return; }
      const id = match[1];
      if (req.method === "GET" && match[2] === "proof") {
        const proof = await proofForReview(db, id);
        if (!proof?.proof || !["image/png", "image/jpeg", "image/webp"].includes(proof.proofMime ?? "")) {
          reply(res, 404, { error: "Comprobante no disponible." }); return;
        }
        res.writeHead(200, { ...headers, "Content-Type": proof.proofMime!, "X-Proof-SHA256": createHash("sha256").update(proof.proof).digest("hex") });
        res.end(Buffer.from(proof.proof)); return;
      }
      if (req.method === "POST" && match[2] === "decision") {
        const body = await readJson(req);
        if (!["approved", "rejected"].includes(String(body.decision)) || typeof body.reason !== "string" ||
          (body.paidThroughAt !== undefined && typeof body.paidThroughAt !== "string") ||
          (body.expectedProofSha256 !== undefined && typeof body.expectedProofSha256 !== "string"))
          throw new Error("Decisión inválida.");
        const result = await reviewProductBilling(db, {
          requestId: id, reviewer: options.reviewer, decision: body.decision as "approved" | "rejected",
          reason: body.reason, paidThroughAt: typeof body.paidThroughAt === "string" ? new Date(body.paidThroughAt) : undefined,
          expectedProofSha256: body.expectedProofSha256 as string | undefined,
        });
        reply(res, 200, result); return;
      }
      reply(res, 405, { error: "Método no permitido." });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Error inesperado";
      const known = /Solicitud inexistente|pendiente|ya fue revisada|SHA-256|Falta el comprobante|Libera cupos|Identificador inválido|Escribe el motivo|fecha pagada|Plan desconocido|Decisión inválida|Envía JSON|Solicitud inválida|demasiado grande/.test(message);
      reply(res, known ? 400 : 500, { error: known ? message : "No se pudo completar la operación." });
    }
  });
}

if (process.argv[1]?.replaceAll("\\", "/").endsWith("platform-billing-panel.ts")) {
  const url = process.env.PLATFORM_BILLING_DATABASE_URL;
  const reviewer = process.env.NEXORA_BILLING_OPERATOR_ID?.trim();
  if (process.env.PRODUCT_TENANCY !== "required" || !url || !reviewer)
    throw new Error("Se requiere PRODUCT_TENANCY=required, conexión operacional y operador identificado.");
  const db = new PrismaClient({ datasources: { db: { url } } });
  const token = randomBytes(32).toString("base64url");
  const server = createPlatformBillingPanel(db, { reviewer, token });
  server.listen(0, "127.0.0.1", () => {
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("Sin puerto local.");
    process.stdout.write(`Abre http://127.0.0.1:${address.port} y escribe usuario operador y contraseña temporal ${token}\n`);
  });
  const stop = () => server.close(() => { void db.$disconnect(); });
  process.once("SIGINT", stop); process.once("SIGTERM", stop);
}
