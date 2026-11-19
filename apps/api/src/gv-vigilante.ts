// Vigilante de la caja de GV (orden de la dueña, 5-nov): avisa a la dueña con el
// sistema de alertas existente (tabla Alert; sin servicios nuevos) si a las
// 10 PM (hora RD) hay una caja GV abierta, o si un día con pagos terminó sin cierre.
// Idempotente: la clave lleva la caja/día; una alerta resuelta no se recrea.
import { Inject, Injectable } from "@nestjs/common";
import { BUSINESS_TIME_ZONE, businessDate } from "@fitstore/shared";
import { Database } from "./common";

export const GV_NIGHT_HOUR = 22;
const DAYS_BACK = 7;
const hourOf = (at: Date) =>
  Number(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: BUSINESS_TIME_ZONE,
      hour: "2-digit",
      hourCycle: "h23",
    }).format(at),
  );
const dayStart = (day: string) => new Date(day + "T00:00:00-04:00");
const shiftDay = (day: string, n: number) =>
  new Date(Date.parse(day + "T12:00:00Z") + n * 86400000)
    .toISOString()
    .slice(0, 10);
const dmy = (day: string) => day.split("-").reverse().join("/");

@Injectable()
export class GvCajaVigilante {
  private timer: ReturnType<typeof setInterval> | undefined;
  constructor(@Inject(Database) private db: any) {}
  onModuleInit() {
    this.timer = setInterval(
      () => void this.run().catch((e) => console.warn("[gv-caja]", e?.message)),
      10 * 60000,
    );
    this.timer.unref();
  }
  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  private async alert(
    type: string,
    key: string,
    entityId: string,
    branchId: string,
    message: string,
  ) {
    if (
      await this.db.alert.findUnique({ where: { key }, select: { id: true } })
    )
      return false;
    await this.db.alert.upsert({
      where: { key },
      create: { key, type, severity: "high", entityId, branchId, message },
      update: {},
    });
    return true;
  }

  /** Crea los avisos que toquen en `at`. Devuelve las claves nuevas. */
  async run(at: Date = new Date()): Promise<{ created: string[] }> {
    const created: string[] = [];
    const today = businessDate(at);
    // 1) Pasadas las 10 PM con una caja GV abierta.
    if (hourOf(at) >= GV_NIGHT_HOUR) {
      const open = await this.db.gvCashSession.findMany({
        where: { closedAt: null },
        select: { id: true, branchId: true, userId: true },
      });
      for (const s of open) {
        const user = await this.db.user.findUnique({
          where: { id: s.userId },
          select: { name: true },
        });
        const key = `gv-caja-noche:${s.id}:${today}`;
        if (
          await this.alert(
            "gv_cash_open_night",
            key,
            s.id,
            s.branchId,
            `La caja de GV de ${user?.name ?? "la vendedora"} sigue abierta pasadas las 10 PM. Debe cerrarla y mandar la foto del voucher y del cierre de lote.`,
          )
        )
          created.push(key);
      }
    }
    // 2) Días anteriores con pagos en una caja GV y sin ningún cierre ese día.
    const from = dayStart(shiftDay(today, -DAYS_BACK));
    const to = dayStart(today);
    const [payments, closed] = await Promise.all([
      this.db.gvPayment.findMany({
        where: {
          createdAt: { gte: from, lt: to },
          rejectedAt: null,
          cashSessionId: { not: null },
        },
        select: { branchId: true, createdAt: true },
      }),
      this.db.gvCashSession.findMany({
        where: { closedAt: { gte: from } },
        select: { branchId: true, closedAt: true },
      }),
    ]);
    const closedDays = new Set(
      closed.map((c: any) => c.branchId + "|" + businessDate(c.closedAt)),
    );
    const days = new Map<string, number>();
    for (const p of payments) {
      const k = p.branchId + "|" + businessDate(p.createdAt);
      days.set(k, (days.get(k) ?? 0) + 1);
    }
    for (const [k, count] of days) {
      if (closedDays.has(k)) continue;
      const [branchId, day] = k.split("|");
      const key = `gv-dia-sin-cierre:${branchId}:${day}`;
      if (
        await this.alert(
          "gv_day_no_close",
          key,
          day,
          branchId,
          `El ${dmy(day)} hubo ${count} ${count === 1 ? "pago" : "pagos"} en GV y el día terminó sin cierre de caja. Pídele a la vendedora que cierre y mande las fotos.`,
        )
      )
        created.push(key);
    }
    return { created };
  }
}
