import { Controller, Get, Header, Inject } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { businessDate, d } from "@fitstore/shared";
import { Actor, CurrentUser, Database, Permit } from "./common";
import { cashExpectedMany } from "./cash";

type ReceivableRow = {
  cod: Prisma.Decimal | null;
  credit: Prisma.Decimal | null;
  unclassified: Prisma.Decimal | null;
};

const fixedMoney = (value: unknown) =>
  d((value ?? 0) as any)
    .toDecimalPlaces(2)
    .toFixed(2);

@Controller()
export class DashboardLiquidityController {
  constructor(@Inject(Database) private readonly db: Database) {}

  @Get("dashboard/liquidity")
  @Permit("*")
  @Header("Cache-Control", "private, no-store")
  async liquidity(@CurrentUser() actor: Actor) {
    const day = businessDate();
    const today = {
      gte: new Date(day + "T00:00:00-04:00"),
      lte: new Date(day + "T23:59:59.999-04:00"),
    };
    // Todos los bolsillos deben representar el mismo instante lógico. Con
    // READ COMMITTED una verificación concurrente podía quedar pendiente en
    // una consulta y confirmada en otra dentro de la misma respuesta.
    return this.db.$transaction(
      async (snapshot) => {
        const openSessions = await snapshot.cashSession.findMany({
          where: { branchId: actor.branchId, closedAt: null },
          select: {
            id: true,
            openingAmount: true,
            openedAt: true,
            closedAt: true,
          },
        });

        const [expectedBySession, verifiedLogs, pending, receivables] =
          await Promise.all([
            cashExpectedMany(snapshot, openSessions),
            snapshot.auditLog.findMany({
              where: {
                branchId: actor.branchId,
                action: "verify",
                entity: "payment",
                createdAt: today,
              },
              select: { entityId: true },
            }),
            // Es una cola actual, no un saldo bancario ni un histórico del día.
            snapshot.payment.aggregate({
              where: {
                method: "transfer",
                status: "pending_verification",
                sale: { branchId: actor.branchId, status: "completed" },
              },
              _sum: { amount: true },
            }),
            snapshot.$queryRaw<ReceivableRow[]>`
          WITH outstanding AS (
            SELECT
              s.*,
              GREATEST(
                s."creditBalance" - COALESCE((
                  SELECT SUM(reserved.amount)
                  FROM "Payment" reserved
                  WHERE reserved."saleId" = s.id
                    AND reserved."entryType" = 'installment'
                    AND reserved.method = 'transfer'
                    AND reserved.status = 'pending_verification'
                ), 0),
                0
              ) AS "availableBalance"
            FROM "Sale" s
            WHERE s."branchId" = ${actor.branchId}
              AND s.status = 'completed'
              AND s."creditBalance" > 0
              AND EXISTS (
                SELECT 1 FROM "Payment" source
                WHERE source."saleId" = s.id
                  AND source."entryType" = 'sale'
                  AND source.method IN ('credit', 'cod')
              )
          )
          SELECT
            COALESCE(SUM(CASE WHEN COALESCE(
              s."receivableKind", ''
            ) = 'cod' THEN s."availableBalance" ELSE 0 END), 0) AS cod,
            COALESCE(SUM(CASE WHEN s."receivableKind" = 'credit'
              OR (s."receivableKind" IS NULL AND EXISTS (
                SELECT 1 FROM "Payment" original
                WHERE original."saleId" = s.id
                  AND original."entryType" = 'sale'
                  AND original.method = 'credit'
              ) AND NOT EXISTS (
                SELECT 1 FROM "Payment" original_cod
                WHERE original_cod."saleId" = s.id
                  AND original_cod."entryType" = 'sale'
                  AND original_cod.method = 'cod'
              )) THEN s."availableBalance" ELSE 0 END), 0) AS credit,
            COALESCE(SUM(CASE WHEN s."receivableKind" IS NULL AND EXISTS (
              SELECT 1 FROM "Payment" original
              WHERE original."saleId" = s.id
                AND original."entryType" = 'sale'
                AND original.method = 'cod'
            ) THEN s."availableBalance" ELSE 0 END), 0) AS unclassified
          FROM outstanding s
        `,
          ]);

        const verifiedIds = [
          ...new Set(verifiedLogs.map((row) => row.entityId)),
        ];
        const [verified, ownerReceived] = await Promise.all([
          verifiedIds.length
            ? snapshot.payment.aggregate({
                where: {
                  id: { in: verifiedIds },
                  method: "transfer",
                  status: "ok",
                  sale: { branchId: actor.branchId, status: "completed" },
                },
                _sum: { amount: true },
              })
            : Promise.resolve({ _sum: { amount: null } }),
          snapshot.payment.aggregate({
            where: {
              entryType: "installment",
              method: "cash",
              cashSessionId: null,
              status: "ok",
              reference: { startsWith: "Recibido por la dueña" },
              createdAt: today,
              sale: { branchId: actor.branchId, status: "completed" },
            },
            _sum: { amount: true },
          }),
        ]);

        const drawers = [...expectedBySession.values()].reduce(
          (total, expected) => total.plus(expected.cash),
          d(0),
        );
        const balances = receivables[0] ?? {
          cod: null,
          credit: null,
          unclassified: null,
        };

        return {
          asOf: new Date().toISOString(),
          pockets: {
            drawers: {
              amount: fixedMoney(drawers),
              openRegisters: openSessions.length,
              basis: "Efectivo esperado en cajas abiertas, al momento",
            },
            owner: {
              amount: fixedMoney(ownerReceived._sum.amount),
              basis: "Efectivo recibido por la dueña hoy; no es un saldo",
            },
            banks: {
              verified: fixedMoney(verified._sum.amount),
              pending: fixedMoney(pending._sum.amount),
              verifiedBasis:
                "Transferencias confirmadas mediante revisión hoy; no es saldo bancario",
              pendingBasis:
                "Transferencias por verificar pendientes actualmente",
            },
            street: {
              cod: fixedMoney(balances.cod),
              credit: fixedMoney(balances.credit),
              unclassified: fixedMoney(balances.unclassified),
              basis: "Cuentas por cobrar pendientes actualmente",
            },
          },
        };
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead,
        maxWait: 5_000,
        timeout: 15_000,
      },
    );
  }
}
