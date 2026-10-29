import { Injectable, Controller, Post, Body, Req, HttpException, OnModuleDestroy, Inject } from "@nestjs/common";
import { Prisma, PrismaClient } from "@prisma/client";
import { hash } from "bcryptjs";
import { createHash, randomBytes } from "node:crypto";
import type { Request } from "express";
import { DEFAULT_SETTINGS, permissions, z } from "@fitstore/shared";
import { Public, parse } from "./common";
import { passwordSchemaForRole, isNonTrivialCashierPassword } from "./password-policy";
import { clientIp, RequestRateLimitService } from "./rate-limit";
import { normalizeUsername } from "./auth";
import { notifyOperator } from "./platform-notify";

const registration = z.object({
  businessName: z.string().trim().min(2).max(120),
  ownerName: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(254),
  password: passwordSchemaForRole("admin"),
  managerPin: z.string().refine(isNonTrivialCashierPassword, "El PIN debe tener 6 números y no ser una secuencia fácil."),
  businessType: z.enum(["general", "retail", "beauty", "fitness", "services"]),
  companyCode: z.string().trim().toLowerCase().regex(/^[a-z0-9][a-z0-9-]{1,62}$/),
  termsAccepted: z.literal(true),
  privacyAccepted: z.literal(true),
  termsVersion: z.string().trim().min(1).max(80),
  privacyVersion: z.string().trim().min(1).max(80),
}).strict();
const tokenSchema = z.object({ token: z.string().regex(/^[a-f0-9]{64}$/) }).strict();
const resendSchema = z.object({
  companyCode: registration.shape.companyCode,
  email: registration.shape.email,
}).strict();
const invitationSchema = z.object({
  token: tokenSchema.shape.token,
  password: registration.shape.password,
  managerPin: registration.shape.managerPin,
  // INV-01: la dueña acepta de forma explícita; las versiones las da la web
  // cuando los textos públicos están aprobados.
  consentAccepted: z.literal(true),
  termsVersion: registration.shape.termsVersion.optional(),
  privacyVersion: registration.shape.privacyVersion.optional(),
}).strict();
const digest = (value: string) => createHash("sha256").update(value).digest("hex");
const verificationToken = () => randomBytes(32).toString("hex");
const expiration = () => new Date(Date.now() + 24 * 60 * 60 * 1000);
// Prefijo visible: verify-email (que no fija clave) nunca acepta una invitación
// y resend-verification no la reemplaza.
export const invitationDigest = (token: string) => `invite:${digest(token)}`;

function legalConfiguration() {
  const termsVersion = process.env.PRODUCT_TERMS_VERSION?.trim();
  const privacyVersion = process.env.PRODUCT_PRIVACY_VERSION?.trim();
  // Los documentos 0.1 del repositorio son BORRADORES. No son consentimiento
  // publicable: solo una aprobación externa y versiones explícitas habilitan
  // este paso. El gate de registro público es independiente y sigue cerrado.
  if (process.env.PRODUCT_LEGAL_APPROVED !== "confirmed"
    || !termsVersion || !privacyVersion
    || !/^[A-Za-z0-9._-]{1,80}$/.test(termsVersion)
    || !/^[A-Za-z0-9._-]{1,80}$/.test(privacyVersion))
    throw new HttpException("El registro todavía no está disponible.", 503);
  return { termsVersion, privacyVersion };
}

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
      from, to: [email], subject: "Confirma tu correo de Norexos",
      html: `<p>Confirma tu correo para entrar a Norexos.</p><p><a href="${url.toString()}">Confirmar correo</a></p><p>El enlace vence en 24 horas.</p>`,
    }),
    signal: AbortSignal.timeout(8000),
  }).catch(() => null);
  if (!response?.ok) throw new HttpException("La cuenta se creó, pero no se pudo enviar el correo. Usa Reenviar confirmación.", 503);
}

/** Roles que nace con cada empresa además de «admin» (migración 202610280024_product_base_roles_customer). */
export const BASE_ROLES = ["manager", "seller", "warehouse"] as const;

/** Alta global compartida (registro e invitación): crea Tenant antes de asumir el rol RLS. */
export async function createTenantWithOwner(
  tx: Prisma.TransactionClient,
  tenantData: Prisma.TenantCreateInput,
  owner: { name: string; email: string; passwordHash: string; pinHash: string; verificationHash: string; verificationExpiresAt: Date },
) {
  const tenant = await tx.tenant.create({ data: tenantData });
  await tx.$executeRawUnsafe("SET LOCAL ROLE nexora_tenant_runtime");
  await tx.$queryRawUnsafe("SELECT set_config('app.tenant_id', $1, true)", tenant.id);
  const role = await tx.role.create({ data: { tenantId: tenant.id, name: "admin", permissions: ["*"] } });
  // Los mismos roles base de la tienda (seed.ts): cajera, gerente y almacén.
  await tx.role.createMany({ data: BASE_ROLES.map(name => ({ tenantId: tenant.id, name, permissions: permissions[name] })) });
  await tx.user.create({ data: {
    tenantId: tenant.id, name: owner.name, username: owner.email,
    usernameKey: normalizeUsername(owner.email), email: owner.email,
    passwordHash: owner.passwordHash, pinHash: owner.pinHash,
    roleId: role.id, branchId: "main", emailVerifiedAt: null,
    emailVerificationHash: owner.verificationHash, emailVerificationExpiresAt: owner.verificationExpiresAt,
  } });
  await tx.settings.create({ data: { tenantId: tenant.id, id: "main", data: {
    ...DEFAULT_SETTINGS, name: tenant.name,
    // Un negocio nuevo vende al mostrador sin pedir cliente (venta a
    // «Consumidor final»); lo puede encender en Configuración.
    requireCustomer: false,
    businessType: tenant.businessType, onboarding: { dismissed: false },
  } } });
  await tx.customer.create({ data: { tenantId: tenant.id, name: "Consumidor final" } });
  return tenant;
}

/** Único acceso de alta global: la transacción crea Tenant antes de asumir el rol RLS. */
@Injectable()
export class RegistrationService implements OnModuleDestroy {
  readonly db = new PrismaClient();
  async onModuleDestroy() { await this.db.$disconnect(); }

  async register(input: z.infer<typeof registration>) {
    if (process.env.PRODUCT_TENANCY !== "required") throw new HttpException("No disponible.", 404);
    // El modo multiempresa por sí solo NO autoriza abrir altas públicas.
    // Mantener cerrado hasta aprobar los textos legales y quitar la marca de
    // la tienda del producto; el opt-in debe ser explícito en el despliegue.
    if (process.env.PRODUCT_PUBLIC_REGISTRATION !== "enabled")
      throw new HttpException("No disponible.", 404);
    const legal = legalConfiguration();
    if (input.termsVersion !== legal.termsVersion || input.privacyVersion !== legal.privacyVersion)
      throw new HttpException("Los documentos cambiaron. Vuelve a leerlos y acepta la versión actual.", 409);
    mailConfiguration(); // Fallar cerrado antes de guardar una cuenta sin salida de correo.
    const email = input.email.toLowerCase();
    const token = verificationToken();
    const passwordHash = await hash(input.password, 12);
    const pinHash = await hash(input.managerPin, 12);
    const acceptedAt = new Date();
    try {
      await this.db.$transaction(tx => createTenantWithOwner(tx, {
        slug: input.companyCode, name: input.businessName,
        businessType: input.businessType, plan: "trial", status: "trial",
        trialEndsAt: new Date(Date.now() + 14 * 86400000),
        termsVersion: legal.termsVersion, termsAcceptedAt: acceptedAt,
        privacyVersion: legal.privacyVersion, privacyAcceptedAt: acceptedAt,
      }, {
        name: input.ownerName, email, passwordHash, pinHash,
        verificationHash: digest(token), verificationExpiresAt: expiration(),
      }));
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

  /** Invitación de la plataforma: fija clave y PIN, una sola vez y antes de vencer. */
  async acceptInvitation(input: z.infer<typeof invitationSchema>, ip?: string) {
    if (process.env.PRODUCT_TENANCY !== "required") throw new HttpException("No disponible.", 404);
    const where = {
      emailVerificationHash: invitationDigest(input.token),
      emailVerificationExpiresAt: { gt: new Date() }, emailVerifiedAt: null,
    };
    const invalid = () => new HttpException("La invitación venció o ya se usó. Pide una nueva.", 400);
    const invited = await this.db.user.findFirst({ where, select: { id: true, tenantId: true } });
    if (!invited) throw invalid();
    // INV-01: textos web aprobados (versión vigente) o acuerdo en papel registrado al invitar.
    const tenant = await this.db.tenant.findUnique({ where: { id: invited.tenantId }, select: { termsVersion: true, privacyVersion: true } });
    let consent: { metodo: "digital" | "papel"; termsVersion: string; privacyVersion: string };
    if (process.env.PRODUCT_LEGAL_APPROVED === "confirmed") {
      const legal = legalConfiguration();
      if (input.termsVersion !== legal.termsVersion || input.privacyVersion !== legal.privacyVersion)
        throw new HttpException("Los documentos cambiaron. Vuelve a leerlos y acepta la versión actual.", 409);
      consent = { metodo: "digital", ...legal };
    } else if (tenant?.termsVersion?.startsWith("papel:"))
      consent = { metodo: "papel", termsVersion: tenant.termsVersion, privacyVersion: tenant.privacyVersion ?? tenant.termsVersion };
    else throw new HttpException("Falta registrar el acuerdo de servicio de esta empresa. Pide a Norexos una invitación nueva.", 409);
    const [passwordHash, pinHash] = await Promise.all([hash(input.password, 12), hash(input.managerPin, 12)]);
    const acceptedAt = new Date();
    await this.db.$transaction(async (tx) => {
      // updateMany condicional: dos envíos simultáneos no aceptan dos veces.
      const result = await tx.user.updateMany({ where, data: {
        passwordHash, pinHash, emailVerifiedAt: acceptedAt,
        emailVerificationHash: null, emailVerificationExpiresAt: null,
        failedAttempts: 0, lockedUntil: null,
      } });
      if (result.count !== 1) throw invalid();
      await tx.tenant.update({ where: { id: invited.tenantId }, data: {
        termsVersion: consent.termsVersion, termsAcceptedAt: acceptedAt,
        privacyVersion: consent.privacyVersion, privacyAcceptedAt: acceptedAt,
      } });
      await tx.auditLog.create({ data: {
        tenantId: invited.tenantId, userId: invited.id, action: "invitation.accepted",
        entity: "invitation", entityId: invited.tenantId, ip, after: consent,
      } });
    });
    // Clave fija: un solo aviso de alta por empresa.
    await notifyOperator(this.db, { tenantId: invited.tenantId, event: "op_activated", key: new Date(0) });
    return { message: "Listo. Ya puedes entrar con tu código de empresa, correo y contraseña." };
  }

  async resend(companyCode: string, emailValue: string) {
    if (process.env.PRODUCT_TENANCY !== "required") throw new HttpException("No disponible.", 404);
    mailConfiguration();
    const email = emailValue.toLowerCase();
    const tenant = await this.db.tenant.findUnique({ where: { slug: companyCode }, select: { id: true } });
    const user = tenant && await this.db.user.findFirst({
      where: { tenantId: tenant.id, email, emailVerifiedAt: null,
        OR: [{ emailVerificationHash: null }, { NOT: { emailVerificationHash: { startsWith: "invite:" } } }] },
      select: { id: true },
    });
    // Respuesta idéntica para no revelar si existe la empresa o el correo.
    if (!user) return { message: "Si la cuenta está pendiente, recibirás un enlace nuevo." };
    const token = verificationToken();
    // Un fallo transitorio del proveedor no debe invalidar el enlace anterior.
    await sendVerification(email, token);
    await this.db.user.updateMany({ where: { id: user.id, emailVerifiedAt: null }, data: {
      emailVerificationHash: digest(token), emailVerificationExpiresAt: expiration(),
    } });
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
  @Public() @Post("accept-invitation")
  async acceptInvitation(@Body() body: unknown, @Req() req: Request) {
    this.limits.assert("accept-invitation-ip", [clientIp(req)], 10);
    return this.registrationService.acceptInvitation(parse(invitationSchema, body), clientIp(req));
  }
  @Public() @Post("resend-verification")
  async resend(@Body() body: unknown, @Req() req: Request) {
    this.limits.assert("resend-verification-ip", [clientIp(req)], 3);
    const data = parse(resendSchema, body);
    return this.registrationService.resend(data.companyCode, data.email);
  }
}
