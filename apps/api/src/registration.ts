import { Injectable, Controller, Post, Body, Req, HttpException, OnModuleDestroy, Inject } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";
import { hash } from "bcryptjs";
import { createHash, randomBytes } from "node:crypto";
import type { Request } from "express";
import { z } from "@fitstore/shared";
import { Public, parse } from "./common";
import { passwordSchemaForRole, isNonTrivialCashierPassword } from "./password-policy";
import { clientIp, RequestRateLimitService } from "./rate-limit";
import { normalizeUsername } from "./auth";

const registration = z.object({
  businessName: z.string().trim().min(2).max(120),
  ownerName: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(254),
  password: passwordSchemaForRole("admin"),
  managerPin: z.string().refine(isNonTrivialCashierPassword, "El PIN debe tener 6 números y no ser una secuencia fácil."),
  businessType: z.enum(["general", "retail", "beauty", "fitness", "services"]),
  companyCode: z.string().trim().toLowerCase().regex(/^[a-z0-9][a-z0-9-]{1,62}$/),
}).strict();
const tokenSchema = z.object({ token: z.string().regex(/^[a-f0-9]{64}$/) }).strict();
const resendSchema = z.object({
  companyCode: registration.shape.companyCode,
  email: registration.shape.email,
}).strict();
const digest = (value: string) => createHash("sha256").update(value).digest("hex");
const verificationToken = () => randomBytes(32).toString("hex");
const expiration = () => new Date(Date.now() + 24 * 60 * 60 * 1000);

function mailConfiguration() {
  const key = process.env.RESEND_API_KEY?.trim();
  const from = process.env.NOTIFY_EMAIL_FROM?.trim();
  const publicUrl = process.env.APP_PUBLIC_URL?.trim();
  if (!key || !from || !publicUrl) throw new HttpException("El registro por correo aún no está disponible.", 503);
  const url = new URL(publicUrl);
  if (process.env.NODE_ENV === "production" && url.protocol !== "https:")
    throw new HttpException("El registro por correo aún no está disponible.", 503);
  return { key, from, url, apiBase: (process.env.RESEND_API_BASE?.trim() || "https://api.resend.com").replace(/\/+$/, "") };
}

async function sendVerification(email: string, token: string) {
  const { key, from, url, apiBase } = mailConfiguration();
  url.pathname = "/confirmar-correo";
  url.search = "";
  // Fragmento: el token no llega al servidor web, logs HTTP ni Referer.
  url.hash = `token=${token}`;
  const response = await fetch(`${apiBase}/emails`, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from, to: [email], subject: "Confirma tu correo de Nexora POS",
      html: `<p>Confirma tu correo para entrar a Nexora POS.</p><p><a href="${url.toString()}">Confirmar correo</a></p><p>El enlace vence en 24 horas.</p>`,
    }),
    signal: AbortSignal.timeout(8000),
  }).catch(() => null);
  if (!response?.ok) throw new HttpException("La cuenta se creó, pero no se pudo enviar el correo. Usa Reenviar confirmación.", 503);
}

/** Único acceso de alta global: la transacción crea Tenant antes de asumir el rol RLS. */
@Injectable()
export class RegistrationService implements OnModuleDestroy {
  private readonly db = new PrismaClient();
  async onModuleDestroy() { await this.db.$disconnect(); }

  async register(input: z.infer<typeof registration>) {
    if (process.env.PRODUCT_TENANCY !== "required") throw new HttpException("No disponible.", 404);
    mailConfiguration(); // Fallar cerrado antes de guardar una cuenta sin salida de correo.
    const email = input.email.toLowerCase();
    const token = verificationToken();
    const passwordHash = await hash(input.password, 12);
    const pinHash = await hash(input.managerPin, 12);
    try {
      await this.db.$transaction(async (tx) => {
        const tenant = await tx.tenant.create({ data: {
          slug: input.companyCode, name: input.businessName,
          businessType: input.businessType, plan: "trial", status: "trial",
          trialEndsAt: new Date(Date.now() + 14 * 86400000),
        } });
        await tx.$executeRawUnsafe("SET LOCAL ROLE nexora_tenant_runtime");
        await tx.$queryRawUnsafe("SELECT set_config('app.tenant_id', $1, true)", tenant.id);
        const role = await tx.role.create({ data: { tenantId: tenant.id, name: "admin", permissions: ["*"] } });
        await tx.user.create({ data: {
          tenantId: tenant.id, name: input.ownerName, username: email,
          usernameKey: normalizeUsername(email), email, passwordHash, pinHash,
          roleId: role.id, branchId: "main", emailVerifiedAt: null,
          emailVerificationHash: digest(token), emailVerificationExpiresAt: expiration(),
        } });
        await tx.settings.create({ data: { tenantId: tenant.id, id: "main", data: {
          name: input.businessName, branchName: "", currency: "DOP",
          taxIncluded: true, receiptWidth: "80", requireCustomer: true,
          allowOfflineSales: false, cashDifferenceLimit: 100,
        } } });
      });
    } catch (error: any) {
      if (error?.code === "P2002") throw new HttpException("Este código de empresa ya está ocupado.", 409);
      throw error;
    }
    try {
      await sendVerification(email, token);
      return { message: "Cuenta creada. Confirma tu correo para entrar." };
    } catch {
      // La transacción ya se confirmó. Informar que no se creó permitiría
      // intentar otra vez con el mismo código y dejaría el alta sin salida.
      return { message: "Cuenta creada, pero no llegó la confirmación. Usa Reenviar confirmación.", deliveryPending: true };
    }
  }

  async verify(token: string) {
    if (process.env.PRODUCT_TENANCY !== "required") throw new HttpException("No disponible.", 404);
    const result = await this.db.user.updateMany({
      where: { emailVerificationHash: digest(token), emailVerificationExpiresAt: { gt: new Date() }, emailVerifiedAt: null },
      data: { emailVerifiedAt: new Date(), emailVerificationHash: null, emailVerificationExpiresAt: null },
    });
    if (result.count !== 1) throw new HttpException("El enlace venció o ya se usó. Solicita uno nuevo.", 400);
    return { message: "Correo confirmado. Ya puedes entrar." };
  }

  async resend(companyCode: string, emailValue: string) {
    if (process.env.PRODUCT_TENANCY !== "required") throw new HttpException("No disponible.", 404);
    mailConfiguration();
    const email = emailValue.toLowerCase();
    const tenant = await this.db.tenant.findUnique({ where: { slug: companyCode }, select: { id: true } });
    const user = tenant && await this.db.user.findFirst({
      where: { tenantId: tenant.id, email, emailVerifiedAt: null }, select: { id: true },
    });
    // Respuesta idéntica para no revelar si existe la empresa o el correo.
    if (!user) return { message: "Si la cuenta está pendiente, recibirás un enlace nuevo." };
    const token = verificationToken();
    await this.db.user.update({ where: { id: user.id }, data: {
      emailVerificationHash: digest(token), emailVerificationExpiresAt: expiration(),
    } });
    await sendVerification(email, token);
    return { message: "Si la cuenta está pendiente, recibirás un enlace nuevo." };
  }
}

@Controller("auth")
export class RegistrationController {
  constructor(
    @Inject(RegistrationService) private readonly registrationService: RegistrationService,
    @Inject(RequestRateLimitService) private readonly limits: RequestRateLimitService,
  ) {}
  @Public() @Post("register")
  async register(@Body() body: unknown, @Req() req: Request) {
    this.limits.assert("registration-ip", [clientIp(req)], 5);
    return this.registrationService.register(parse(registration, body));
  }
  @Public() @Post("verify-email")
  async verify(@Body() body: unknown, @Req() req: Request) {
    this.limits.assert("verify-email-ip", [clientIp(req)], 20);
    return this.registrationService.verify(parse(tokenSchema, body).token);
  }
  @Public() @Post("resend-verification")
  async resend(@Body() body: unknown, @Req() req: Request) {
    this.limits.assert("resend-verification-ip", [clientIp(req)], 3);
    const data = parse(resendSchema, body);
    return this.registrationService.resend(data.companyCode, data.email);
  }
}
