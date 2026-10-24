import { Body, Controller, Get, Inject, Param, Post, Res, UploadedFile, UseInterceptors } from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import type { Response } from "express";
import { z } from "@fitstore/shared";
import { Actor, CurrentUser, Database, Permit, bad, conflict, imageType, parse, uuid } from "./common";
import { RequestRateLimitService } from "./rate-limit";
import { BILLING_PLANS } from "./billing-plans";

// Precios de referencia: la dueña debe ratificarlos antes de ofrecer cobros.

export interface BillingProvider {
  readonly kind: "test" | "bank_transfer";
  available(): boolean;
  instructions(): Record<string, string> | null;
}

class TestBillingProvider implements BillingProvider {
  readonly kind = "test";
  available() { return process.env.NODE_ENV !== "production" && process.env.BILLING_TEST_MODE === "enabled"; }
  instructions() { return null; }
}

class BankTransferBillingProvider implements BillingProvider {
  readonly kind = "bank_transfer";
  available() { return !!(process.env.NEXORA_BILLING_BANK_NAME && process.env.NEXORA_BILLING_BANK_ACCOUNT && process.env.NEXORA_BILLING_BANK_HOLDER); }
  instructions() {
    if (!this.available()) return null;
    return {
      bank: process.env.NEXORA_BILLING_BANK_NAME!,
      account: process.env.NEXORA_BILLING_BANK_ACCOUNT!,
      holder: process.env.NEXORA_BILLING_BANK_HOLDER!,
    };
  }
}

const providers: Record<BillingProvider["kind"], BillingProvider> = {
  test: new TestBillingProvider(),
  bank_transfer: new BankTransferBillingProvider(),
};
const requestInput = z.object({
  plan: z.enum(["autoservicio", "basico", "pro", "premium"]),
  provider: z.enum(["test", "bank_transfer"]),
}).strict();
const MAX_PROOF_BYTES = 2 * 1024 * 1024;

@Controller("billing")
export class ProductBillingController {
  constructor(@Inject(Database) private readonly db: Database, @Inject(RequestRateLimitService) private readonly limits: RequestRateLimitService) {}

  @Get("plans") @Permit("authenticated")
  plans() {
    return Object.entries(BILLING_PLANS).map(([id, plan]) => ({ id, monthlyPrice: plan.monthlyDop, currency: "DOP", branches: plan.branches, boxes: plan.boxes, users: plan.users }));
  }

  @Get("providers") @Permit("authenticated")
  availableProviders() {
    return Object.values(providers).filter((provider) => provider.available()).map((provider) => ({ kind: provider.kind, instructions: provider.instructions() }));
  }

  @Get("requests") @Permit("*")
  async requests() {
    const rows = await this.db.billingRequest.findMany({
      orderBy: { createdAt: "desc" }, take: 30,
      select: { id: true, plan: true, provider: true, amount: true, status: true,
        submittedAt: true, reviewedAt: true, reviewReason: true,
        paidThroughAt: true, createdAt: true, proofMime: true },
    });
    return rows.map(({ proofMime, ...row }) => ({ ...row, hasProof: proofMime !== null }));
  }

  @Post("requests") @Permit("*")
  async request(@Body() body: unknown, @CurrentUser() actor: Actor) {
    this.limits.assert("billing-request", [actor.tenantId, actor.id], 5);
    const data = parse(requestInput, body);
    const provider = providers[data.provider];
    if (!provider.available()) bad("Este medio de pago no está disponible.");
    // El servidor fija el precio; un cliente nunca declara el monto.
    const amount = BILLING_PLANS[data.plan].monthlyDop;
    const row = await this.db.billingRequest.create({ data: {
      tenantId: actor.tenantId, plan: data.plan, provider: data.provider,
      amount, status: data.provider === "test" ? "pending_review" : "pending_proof",
    } });
    return { id: row.id, plan: row.plan, provider: row.provider, amount: row.amount, status: row.status, instructions: provider.instructions() };
  }

  @Post("requests/:id/proof") @Permit("*")
  @UseInterceptors(FileInterceptor("file", { limits: { fileSize: MAX_PROOF_BYTES + 1, files: 1 } }))
  async submitProof(@Param("id") id: string, @UploadedFile() file: any) {
    if (!file?.buffer?.length) bad("Adjunta el comprobante.");
    if (file.size > MAX_PROOF_BYTES) bad("El comprobante debe pesar como máximo 2 MB.");
    const type = imageType(file.buffer);
    if (!type || type === "gif") bad("El comprobante debe ser JPG, PNG o WebP.");
    return this.db.$transaction(async (tx) => {
      const requestId = parse(uuid, id);
      await tx.$queryRaw`SELECT id FROM "BillingRequest" WHERE id=${requestId}::uuid FOR UPDATE`;
      const row = await tx.billingRequest.findFirst({ where: { id: requestId } });
      if (!row) bad("Solicitud no encontrada.");
      if (row.provider !== "bank_transfer" || !["pending_proof", "pending_review"].includes(row.status))
        conflict("Esta solicitud ya fue revisada.");
      await tx.billingRequest.update({ where: { id: requestId }, data: {
        proof: file.buffer, proofMime: `image/${type}`, submittedAt: new Date(), status: "pending_review",
      } });
      return { id: requestId, status: "pending_review", hasProof: true };
    });
  }

  @Get("requests/:id/proof") @Permit("*")
  async proof(@Param("id") id: string, @Res() res: Response) {
    const row = await this.db.billingRequest.findFirst({ where: { id: parse(uuid, id) }, select: { proof: true, proofMime: true } });
    if (!row?.proof || !row.proofMime) bad("El comprobante no existe.");
    res.setHeader("Content-Type", row.proofMime);
    res.setHeader("Cache-Control", "private, no-store");
    res.send(Buffer.from(row.proof));
  }
}
