import { Body, Controller, Get, Inject, Param, Patch, Post } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { z } from "@fitstore/shared";
import { Actor, CurrentUser, Database, Permit, audit, bad, conflict, parse, uuid } from "./common";
import { currentTenantId } from "./tenant-context";

// Inventario administrativo de rangos. El «próximo» se declara a mano y sólo
// avanza al vender cuando la empresa activa ncfMode «sequences» (takeNcf).
const digits = z.string().regex(/^\d{1,12}$/, "Escribe de 1 a 12 dígitos.");
const nextDigits = z.string().regex(/^\d{1,13}$/, "Escribe de 1 a 13 dígitos.");
const civilDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha inválida.").refine(
  (value) => !Number.isNaN(Date.parse(value + "T00:00:00Z")) &&
    new Date(value + "T00:00:00Z").toISOString().slice(0, 10) === value,
  "Fecha inválida.",
);
const createSequence = z.object({
  // Patrón administrativo, no validación fiscal ni habilitación de emisión.
  type: z.string().regex(/^[BE]\d{2}$/, "Escribe un tipo Bxx o Exx."),
  authorizationReference: z.string().trim().min(1).max(100),
  firstNumber: digits,
  lastNumber: digits,
  nextNumber: nextDigits,
  expiryApplies: z.boolean(),
  expiresOn: civilDate.nullable(),
}).strict();
const updateSequence = z.object({ nextNumber: nextDigits.optional(), active: z.boolean().optional() })
  .strict().refine((value) => value.nextNumber !== undefined || value.active !== undefined,
    "Indica el próximo número o el estado.");

export type NcfSequenceSnapshot = {
  id: string; type: string; nextNumber: { toString(): string };
  lastNumber: { toString(): string }; expiryApplies: boolean;
  expiresOn: Date | null; active: boolean; nextConfirmedAt: Date;
};

export function ncfSequenceWarnings(row: NcfSequenceSnapshot, today: string) {
  if (!row.active) return [];
  const remaining = BigInt(row.lastNumber.toString()) - BigInt(row.nextNumber.toString()) + 1n;
  const warnings: Array<{ kind: "numbers" | "expiry"; message: string }> = [];
  if (remaining < 20n) {
    const declaredOn = row.nextConfirmedAt.toISOString().slice(0, 10).split("-").reverse().join("/");
    warnings.push({ kind: "numbers",
      message: `${row.type}: quedan ${remaining < 0n ? "0" : remaining.toString()} números según el próximo declarado el ${declaredOn} (fecha UTC). Confirma uso fuera de Norexos y saldo con la contable.` });
  }
  if (row.expiryApplies && row.expiresOn) {
    const due = Date.parse(row.expiresOn.toISOString().slice(0, 10) + "T12:00:00Z");
    const now = Date.parse(today + "T12:00:00Z");
    const days = Math.round((due - now) / 86_400_000);
    if (days <= 15) warnings.push({ kind: "expiry",
      message: `${row.type}: ${days < 0 ? "venció" : `vence en ${days} días`} según la fecha declarada. Confirma con la contable.` });
  }
  return warnings;
}

export function ncfTenantToday(timeZone: string, at = new Date()) {
  try {
    const parts = new Intl.DateTimeFormat("en", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(at);
    const part = (type: string) => parts.find((value) => value.type === type)?.value;
    const date = `${part("year")}-${part("month")}-${part("day")}`;
    return /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : null;
  } catch (error) {
    if (error instanceof RangeError) return null;
    throw error;
  }
}

/** NCF tradicional para una venta (ncfMode «sequences»). Toma el próximo
 *  número del rango activo y vigente de esta empresa bajo el mismo candado
 *  que el alta/activación, así dos ventas nunca reciben el mismo número.
 *  Va dentro de la transacción de la venta: si la venta falla, el número no
 *  se gasta. Sin rango válido no hay venta (dueña: «toda venta lleva su
 *  comprobante»). */
export async function takeNcf(tx: any, type: string) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`ncf:${currentTenantId()}:${type}`}))`;
  const tenant = await tx.$queryRaw`
    SELECT "timeZone" FROM "Tenant" WHERE id = ${currentTenantId()}::uuid`;
  const today = tenant[0] ? ncfTenantToday(tenant[0].timeZone) : null;
  if (!today) bad("Zona horaria de empresa inválida; no se puede asignar el NCF.");
  const rows = await tx.ncfSequence.findMany({ where: { type, active: true }, orderBy: { firstNumber: "asc" } });
  const row = rows.find((r: any) =>
    BigInt(r.nextNumber.toString()) <= BigInt(r.lastNumber.toString()) &&
    (!r.expiryApplies || (r.expiresOn && r.expiresOn.toISOString().slice(0, 10) >= today)));
  if (!row)
    bad(`No hay secuencia ${type} activa, vigente y con números disponibles. Declárala en Ajustes › Comprobantes antes de vender.`);
  await tx.ncfSequence.update({ where: { id: row.id }, data: { nextNumber: { increment: 1 } } });
  return type + row.nextNumber.toString().padStart(row.numberWidth, "0");
}

const view = (row: any, today: string) => ({
  id: row.id, type: row.type, authorizationReference: row.authorizationReference,
  firstNumber: row.firstNumber.toString().padStart(row.numberWidth, "0"),
  lastNumber: row.lastNumber.toString().padStart(row.numberWidth, "0"),
  nextNumber: row.nextNumber.toString().padStart(row.numberWidth, "0"),
  nextConfirmedAt: row.nextConfirmedAt,
  numberWidth: row.numberWidth, expiryApplies: row.expiryApplies,
  expiresOn: row.expiresOn?.toISOString().slice(0, 10) ?? null,
  active: row.active, warnings: ncfSequenceWarnings(row, today),
  createdAt: row.createdAt, updatedAt: row.updatedAt,
});

@Controller("ncf-sequences")
export class NcfSequencesController {
  constructor(@Inject(Database) private readonly db: Database) {}

  private async today() {
    const tenant = await this.db.$queryRaw<{ timeZone: string }[]>`
      SELECT "timeZone" FROM "Tenant" WHERE id = ${currentTenantId()}::uuid`;
    if (!tenant[0]) bad("Empresa no encontrada.");
    const today = ncfTenantToday(tenant[0].timeZone);
    if (!today) bad("Zona horaria de empresa inválida; no se puede evaluar la secuencia.");
    return today;
  }

  @Get() @Permit("*") async list() {
    const today = await this.today();
    return (await this.db.ncfSequence.findMany({ orderBy: { createdAt: "desc" } }))
      .map((row) => view(row, today));
  }

  @Post() @Permit("*") async create(@Body() body: unknown, @CurrentUser() actor: Actor) {
    const input = parse(createSequence, body);
    const first = BigInt(input.firstNumber), last = BigInt(input.lastNumber), next = BigInt(input.nextNumber);
    if (last < first || next < first || next > last + 1n) bad("El rango y el próximo número no coinciden.");
    const requiredWidth = input.type.startsWith("B") ? 8 : 10;
    if (input.firstNumber.length !== requiredWidth)
      bad(`Este tipo requiere ${requiredWidth} dígitos en el número declarado.`);
    if (input.firstNumber.length !== input.lastNumber.length ||
      (input.nextNumber.length !== input.firstNumber.length && !(next === last + 1n && input.nextNumber.length === input.firstNumber.length + 1)))
      bad("Los números deben conservar la misma cantidad de dígitos del rango autorizado.");
    if (input.expiryApplies !== !!input.expiresOn)
      bad("Indica si este tipo tiene vencimiento y su fecha, o deja la fecha vacía.");
    if (["B02", "B04", "B12"].includes(input.type) && input.expiryApplies)
      bad("Este tipo no usa aviso de vencimiento; confirma las reglas fiscales con la contable.");
    if (!["B02", "B04", "B12"].includes(input.type) && !input.expiryApplies)
      bad("Declara la fecha de vencimiento confirmada para vigilar esta secuencia.");
    const today = await this.today();
    const result = await this.db.$transaction(async (tx) => {
      // Serializa altas del mismo tipo y empresa para que dos administradores
      // no declaren rangos activos superpuestos de forma simultánea.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`ncf:${currentTenantId()}:${input.type}`}))`;
      const previous = await tx.ncfSequence.findFirst({
        where: { type: input.type, authorizationReference: input.authorizationReference },
      });
      if (previous) {
        if (previous.numberWidth === input.firstNumber.length &&
          previous.firstNumber.toString() === first.toString() && previous.lastNumber.toString() === last.toString() &&
          previous.nextNumber.toString() === next.toString() && previous.expiryApplies === input.expiryApplies &&
          (previous.expiresOn?.toISOString().slice(0, 10) ?? null) === input.expiresOn) return previous;
        conflict("Esa referencia ya tiene datos distintos. Revísala antes de continuar.");
      }
      const overlap = await tx.ncfSequence.findFirst({ where: {
        type: input.type, active: true,
        firstNumber: { lte: last.toString() }, lastNumber: { gte: first.toString() },
      } });
      if (overlap) conflict("Ese rango se superpone con otra secuencia activa de este tipo.");
      const row = await tx.ncfSequence.create({ data: {
        id: randomUUID(), tenantId: currentTenantId(), type: input.type, authorizationReference: input.authorizationReference,
        firstNumber: first.toString(), lastNumber: last.toString(), nextNumber: next.toString(),
        numberWidth: input.firstNumber.length,
        expiryApplies: input.expiryApplies,
        expiresOn: input.expiresOn ? new Date(input.expiresOn + "T00:00:00Z") : null,
        recordedBy: actor.id,
      } });
      await audit(tx, actor, "create", "ncf-sequence", row.id, undefined, view(row, today));
      return row;
    });
    return view(result, today);
  }

  @Patch(":id") @Permit("*") async update(@Param("id") id: string, @Body() body: unknown,
    @CurrentUser() actor: Actor) {
    const sequenceId = parse(uuid, id);
    const input = parse(updateSequence, body);
    const today = await this.today();
    const row = await this.db.$transaction(async (tx) => {
      // NCF-01: siempre el candado de takeNcf; corregir o desactivar nunca se
      // intercala entre la lectura y el incremento de una venta.
      const target = await tx.ncfSequence.findFirst({ where: { id: sequenceId }, select: { type: true } });
      if (!target) bad("Secuencia no encontrada.");
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`ncf:${currentTenantId()}:${target.type}`}))`;
      const previous = await tx.ncfSequence.findFirst({ where: { id: sequenceId } });
      if (!previous) bad("Secuencia no encontrada.");
      if (input.active === true && !previous.active) {
        const overlap = await tx.ncfSequence.findFirst({ where: {
          id: { not: sequenceId }, type: previous.type, active: true,
          firstNumber: { lte: previous.lastNumber }, lastNumber: { gte: previous.firstNumber },
        } });
        if (overlap) conflict("Ese rango se superpone con otra secuencia activa de este tipo.");
      }
      const next = input.nextNumber === undefined ? null : BigInt(input.nextNumber);
      if (next !== null && input.nextNumber!.length !== previous.numberWidth &&
        !(next === BigInt(previous.lastNumber.toString()) + 1n && input.nextNumber!.length === previous.numberWidth + 1))
        bad("Conserva la cantidad de dígitos del rango autorizado.");
      if (next !== null && (next < BigInt(previous.nextNumber.toString()) ||
        next > BigInt(previous.lastNumber.toString()) + 1n))
        bad("El próximo número no puede retroceder ni salir del rango.");
      const changed = await tx.ncfSequence.updateMany({ where: {
        id: sequenceId,
        ...(next === null ? {} : { nextNumber: { lte: next.toString() } }),
      }, data: {
        ...(next === null ? {} : { nextNumber: next.toString() }),
        ...(next === null || next === BigInt(previous.nextNumber.toString()) ? {} : { nextConfirmedAt: new Date() }),
        ...(input.active === undefined ? {} : { active: input.active }),
      } });
      if (changed.count !== 1) conflict("La secuencia cambió mientras la editabas. Vuelve a cargarla.");
      const updated = await tx.ncfSequence.findFirstOrThrow({ where: { id: sequenceId } });
      await audit(tx, actor, "update", "ncf-sequence", sequenceId, view(previous, today), view(updated, today));
      return updated;
    });
    return view(row, today);
  }
}
