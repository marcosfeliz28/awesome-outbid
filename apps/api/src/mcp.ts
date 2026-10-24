import { createHash, randomBytes, randomUUID } from "node:crypto";
import { Body, Controller, Get, Header, HttpCode, Inject, Post, Query, Req, Res, ServiceUnavailableException, UnauthorizedException, ForbiddenException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import type { Request, Response } from "express";
import { audit, bad, Database, Permit, Public, type Actor, type ActorRequest } from "./common";
import { tenantScope } from "./tenant-context";
import { mcpClient, pkceChallenge, validateMcpAuthorization } from "./mcp-oauth-core";
import { RequestRateLimitService } from "./rate-limit";

const hash = (value: string) => createHash("sha256").update(value).digest("hex");
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const tools = [
  { name: "ventas_hoy", description: "Cantidad de facturas completadas y total facturado hoy en la sucursal del dueño. Solo lectura; no incluye clientes.", inputSchema: { type: "object", properties: {}, additionalProperties: false } },
  { name: "stock_bajo", description: "Hasta 20 variantes activas cuyo stock vendible en tienda está bajo su mínimo. Solo lectura; no cambia inventario.", inputSchema: { type: "object", properties: {}, additionalProperties: false } },
];

@Controller("mcp")
export class McpController {
  constructor(@Inject(Database) private readonly db: Database, @Inject(JwtService) private readonly jwt: JwtService,
    @Inject(RequestRateLimitService) private readonly limits: RequestRateLimitService) {}

  private config() {
    const secret = process.env.MCP_TOKEN_SECRET;
    const url = process.env.APP_PUBLIC_URL;
    if (process.env.PRODUCT_TENANCY !== "required" || process.env.PRODUCT_MCP_ENABLED !== "enabled" ||
      !secret || secret.length < 32 || !url || !process.env.MCP_OAUTH_CLIENTS)
      throw new ServiceUnavailableException("Conector MCP no configurado.");
    let origin: string;
    try {
      const parsed = new URL(url);
      if (parsed.protocol !== "https:" && !(parsed.protocol === "http:" && ["localhost", "127.0.0.1"].includes(parsed.hostname))) throw new Error();
      origin = parsed.origin;
    } catch { throw new ServiceUnavailableException("Origen MCP no configurado."); }
    return { secret, origin, clients: process.env.MCP_OAUTH_CLIENTS };
  }

  @Get("oauth/metadata") @Public() @Header("Cache-Control", "no-store")
  metadata() {
    const { origin } = this.config();
    return {
      issuer: origin,
      authorization_endpoint: origin + "/mcp/autorizar",
      token_endpoint: origin + "/api/mcp/oauth/token",
      response_types_supported: ["code"],
      grant_types_supported: ["authorization_code"],
      code_challenge_methods_supported: ["S256"],
      scopes_supported: ["read"],
      token_endpoint_auth_methods_supported: ["none"],
    };
  }

  @Get("oauth/client") @Public() @Header("Cache-Control", "no-store")
  client(@Query() query: Record<string, string>) {
    const config = this.config();
    try {
      const client = validateMcpAuthorization({
        clientId: query.client_id, redirectUri: query.redirect_uri,
        challenge: query.code_challenge, method: query.code_challenge_method,
      }, config.clients);
      return { name: client.name, id: client.id, scope: "read" };
    } catch { bad("Solicitud OAuth inválida."); }
  }

  @Post("oauth/authorize") @HttpCode(200) @Permit("*") @Header("Cache-Control", "no-store")
  async authorize(@Body() body: Record<string, unknown>, @Req() req: ActorRequest) {
    const config = this.config();
    if (body?.response_type !== "code" || body?.scope !== "read" ||
      typeof body.state !== "string" || !/^[\x21-\x7e]{8,256}$/.test(body.state)) bad("Solicitud OAuth inválida.");
    let client;
    try {
      client = validateMcpAuthorization({
        clientId: String(body.client_id ?? ""), redirectUri: String(body.redirect_uri ?? ""),
        challenge: String(body.code_challenge ?? ""), method: String(body.code_challenge_method ?? ""),
      }, config.clients);
    } catch { bad("Cliente OAuth no autorizado."); }
    const actor = req.actor;
    if (!actor.sessionId || actor.role === "support") throw new ForbiddenException("Este usuario no puede autorizar MCP.");
    this.limits.assert("mcp-authorize-user", [actor.id], 10);
    const user = await this.db.user.findUnique({ where: { id: actor.id }, select: { authVersion: true } });
    if (!user) throw new UnauthorizedException();
    const code = actor.tenantId + "." + randomBytes(32).toString("base64url");
    await this.db.$transaction(async (tx) => {
      await tx.mcpAuthorizationCode.deleteMany({ where: { expiresAt: { lt: new Date(Date.now() - 86400000) } } });
      await tx.mcpAuthorizationCode.create({ data: {
        tenantId: actor.tenantId, branchId: actor.branchId, userId: actor.id,
        sessionId: actor.sessionId!, authVersion: user.authVersion,
        clientId: client.id, redirectUri: String(body.redirect_uri), challenge: String(body.code_challenge),
        codeHash: hash(code), expiresAt: new Date(Date.now() + 5 * 60000),
      } });
      await audit(tx, actor, "mcp.authorized", "oauth", randomUUID(), undefined, { clientId: client.id, scope: "read" });
    });
    const redirect = new URL(String(body.redirect_uri));
    redirect.searchParams.set("code", code);
    redirect.searchParams.set("state", String(body.state));
    return { redirectTo: redirect.toString() };
  }

  @Post("oauth/token") @HttpCode(200) @Public() @Header("Cache-Control", "no-store")
  async token(@Body() body: Record<string, unknown>, @Req() req: Request) {
    const config = this.config();
    this.limits.assert("mcp-token-ip", [String(req.ip ?? "")], 20);
    const code = String(body?.code ?? "");
    const tenantId = code.split(".")[0];
    if (body?.grant_type !== "authorization_code" || !uuid.test(tenantId) || !/^[0-9a-f-]{36}\.[A-Za-z0-9_-]{43}$/.test(code))
      throw new UnauthorizedException("Código OAuth inválido.");
    let challenge: string;
    try { challenge = pkceChallenge(String(body.code_verifier ?? "")); }
    catch { throw new UnauthorizedException("PKCE inválido."); }
    return tenantScope.run({ tenantId }, async () => this.db.$transaction(async (tx) => {
      const row = await tx.mcpAuthorizationCode.findUnique({ where: { codeHash: hash(code) } });
      if (!row || row.tenantId !== tenantId || row.usedAt || row.expiresAt <= new Date() ||
        row.clientId !== body.client_id || row.redirectUri !== body.redirect_uri || row.challenge !== challenge ||
        !mcpClient(row.clientId, config.clients)?.redirectUris.includes(row.redirectUri))
        throw new UnauthorizedException("Código OAuth inválido o vencido.");
      const used = await tx.mcpAuthorizationCode.updateMany({ where: { id: row.id, usedAt: null, expiresAt: { gt: new Date() } }, data: { usedAt: new Date() } });
      if (used.count !== 1) throw new UnauthorizedException("Código OAuth ya utilizado.");
      const [user, session] = await Promise.all([
        tx.user.findUnique({ where: { id: row.userId }, include: { role: true } }),
        tx.authSession.findUnique({ where: { id: row.sessionId } }),
      ]);
      if (!user?.active || user.mustChangePassword || user.tenantId !== tenantId || user.branchId !== row.branchId ||
        user.authVersion !== row.authVersion || !user.role.permissions.includes("*") ||
        session?.userId !== user.id) throw new UnauthorizedException("Sesión OAuth vencida.");
      const accessToken = this.jwt.sign({ type: "mcp-read", sub: user.id, sid: session.id, tenantId,
        branchId: row.branchId, version: user.authVersion, clientId: row.clientId },
        { secret: config.secret, algorithm: "HS256", issuer: config.origin, audience: "nexora-mcp", expiresIn: "1h" });
      await audit(tx, { id: user.id, name: user.name, email: user.email, role: user.role.name,
        permissions: user.role.permissions as string[], branchId: user.branchId, tenantId },
      "mcp.token_issued", "oauth", row.id, undefined, { clientId: row.clientId });
      return { access_token: accessToken, token_type: "Bearer", expires_in: 3600, scope: "read" };
    }));
  }

  @Post() @HttpCode(200) @Public() @Header("Cache-Control", "no-store")
  async mcp(@Req() req: Request, @Body() body: Record<string, unknown>, @Res({ passthrough: true }) res: Response) {
    const config = this.config();
    const bearer = req.headers.authorization?.match(/^Bearer ([A-Za-z0-9._-]+)$/)?.[1];
    if (!bearer) throw new UnauthorizedException("Autoriza el conector MCP.");
    let payload: any;
    try {
      payload = this.jwt.verify(bearer, { secret: config.secret, algorithms: ["HS256"],
        issuer: config.origin, audience: "nexora-mcp" });
    } catch { throw new UnauthorizedException("Token MCP inválido."); }
    if (payload?.type !== "mcp-read" || !uuid.test(String(payload.tenantId)) ||
      !uuid.test(String(payload.sub)) || !uuid.test(String(payload.sid)) ||
      !mcpClient(String(payload.clientId), config.clients)) throw new UnauthorizedException("Token MCP inválido.");
    this.limits.assert("mcp-call-session", [String(payload.sid)], 60);
    if (!body || Array.isArray(body) || JSON.stringify(body).length > 16000 || body.jsonrpc !== "2.0" ||
      typeof body.method !== "string") bad("Solicitud MCP inválida.");
    return tenantScope.run({ tenantId: payload.tenantId }, async () => {
      const [user, session] = await Promise.all([
        this.db.user.findUnique({ where: { id: payload.sub }, include: { role: true } }),
        this.db.authSession.findUnique({ where: { id: payload.sid } }),
      ]);
      if (!user?.active || user.mustChangePassword || user.tenantId !== payload.tenantId ||
        user.branchId !== payload.branchId || user.authVersion !== payload.version ||
        !user.role.permissions.includes("*") || session?.userId !== user.id)
        throw new UnauthorizedException("Acceso MCP revocado.");
      const actor: Actor = { id: user.id, name: user.name, email: user.email, role: user.role.name,
        permissions: user.role.permissions as string[], branchId: user.branchId, tenantId: user.tenantId };
      const reply = (result: unknown) => ({ jsonrpc: "2.0", id: body.id ?? null, result });
      if (body.method === "initialize") return reply({ protocolVersion: "2025-06-18", capabilities: { tools: {} }, serverInfo: { name: "nexora-pos-readonly", version: "0.1.0" } });
      if (body.method === "notifications/initialized") { res.status(202); return null; }
      if (body.method === "tools/list") return reply({ tools });
      if (body.method !== "tools/call") return { jsonrpc: "2.0", id: body.id ?? null, error: { code: -32601, message: "Método no disponible." } };
      const params = body.params as Record<string, unknown> | undefined;
      const name = params?.name;
      const args = params?.arguments ?? {};
      if (typeof name !== "string" || !tools.some((tool) => tool.name === name) ||
        typeof args !== "object" || args === null || Array.isArray(args) || Object.keys(args).length)
        bad("Herramienta MCP inválida.");
      await audit(this.db, actor, "mcp.read", "tool", randomUUID(), undefined, { name, clientId: payload.clientId });
      const data = await this.db.$transaction(async (tx) => {
        await tx.$executeRaw`SET TRANSACTION READ ONLY`;
        if (name === "ventas_hoy") {
          const day = new Date().toLocaleDateString("en-CA", { timeZone: "America/Santo_Domingo" });
          const sales = await tx.sale.aggregate({ where: { branchId: user.branchId, status: "completed",
            createdAt: { gte: new Date(day + "T00:00:00-04:00"), lte: new Date(day + "T23:59:59.999-04:00") } },
            _count: { _all: true }, _sum: { total: true } });
          return { fecha: day, facturas: sales._count._all, totalFacturado: Number(sales._sum.total ?? 0) };
        }
        const rows: { sku: string; name: string; stock: unknown; minStock: unknown }[] = await tx.$queryRaw`
          SELECT v.sku, p.name, v.stock, p."minStock" FROM "Variant" v
          JOIN "Product" p ON p.id = v."productId"
          WHERE v."branchId" = ${user.branchId} AND v.active = true AND v.stock <= p."minStock"
          ORDER BY v.stock - p."minStock", p.name LIMIT 20`;
        return rows.map((row) => ({ sku: row.sku, producto: row.name,
          stockEnTienda: Number(row.stock), minimo: Number(row.minStock) }));
      });
      return reply({ content: [{ type: "text", text: JSON.stringify(data) }] });
    });
  }
}
