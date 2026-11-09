// Alertas de la caja GV (5-nov): caja abierta a las 10 PM (hora RD) y día con pagos sin cierre.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { GvCajaVigilante } from "../apps/api/src/gv-vigilante";
import { resolveGvCashAlerts } from "../apps/api/src/gv-caja";

const requireApi = createRequire(
  new URL("../apps/api/package.json", import.meta.url),
);
requireApi("dotenv").config({
  path: fileURLToPath(new URL("../.env", import.meta.url)),
  quiet: true,
});
const { PrismaClient } = requireApi("@prisma/client");
const db = new PrismaClient();
const branchId = "qa-vig-" + Date.now().toString(36);

const day = (offset: number) =>
  new Date(Date.now() + offset * 86400000).toISOString().slice(0, 10);
const at = (d: string, time: string) => new Date(`${d}T${time}-04:00`);

let userId = "";
let enrollmentId = "";
beforeAll(async () => {
  userId = (await db.user.findFirst({ select: { id: true } })).id;
  const course = await db.gvCourse.create({
    data: {
      branchId,
      name: "QA vigilante",
      type: "otro",
      date: new Date(),
      price: 100,
      capacity: 5,
      createdBy: userId,
    },
  });
  enrollmentId = (
    await db.gvEnrollment.create({
      data: {
        branchId,
        courseId: course.id,
        clientName: "QA",
        agreedPrice: 100,
        createdBy: userId,
      },
    })
  ).id;
}, 60000);

afterAll(async () => {
  await db.gvPayment.deleteMany({ where: { branchId } });
  await db.gvEnrollment.deleteMany({ where: { branchId } });
  await db.gvCourse.deleteMany({ where: { branchId } });
  await db.gvCashSession.deleteMany({ where: { branchId } });
  await db.alert.deleteMany({ where: { branchId } });
  await db.$disconnect();
}, 60000);

describe("GV · vigilante de la caja", () => {
  it("avisa a las 10 PM con la caja abierta, una sola vez, y no antes", async () => {
    const s = await db.gvCashSession.create({
      data: { branchId, userId, openingAmount: 0 },
    });
    const service = new GvCajaVigilante(db);
    const d = day(60);
    const key = `gv-caja-noche:${s.id}:${d}`;
    expect((await service.run(at(d, "21:59:00"))).created).not.toContain(key);
    expect((await service.run(at(d, "22:00:00"))).created).toContain(key);
    expect((await service.run(at(d, "22:30:00"))).created).not.toContain(key);
    const row = await db.alert.findUnique({ where: { key } });
    expect(row).toMatchObject({
      type: "gv_cash_open_night",
      severity: "high",
      status: "new",
      branchId,
    });
    expect(row.message).toContain("10 PM");
    // Cerrada, ya no avisa otro día.
    await db.gvCashSession.update({
      where: { id: s.id },
      data: { closedAt: new Date() },
    });
    const next = day(61);
    expect((await service.run(at(next, "22:30:00"))).created).not.toContain(
      `gv-caja-noche:${s.id}:${next}`,
    );
  });

  it("avisa del día con pagos que terminó sin cierre y no del que sí cerró", async () => {
    const service = new GvCajaVigilante(db);
    const today = day(70);
    const [noClose, closed] = [day(68), day(67)];
    const mk = async (d: string, closedAt: Date | null) => {
      const s = await db.gvCashSession.create({
        data: {
          branchId,
          userId,
          openingAmount: 0,
          openedAt: at(d, "09:00:00"),
          closedAt,
        },
      });
      await db.gvPayment.create({
        data: {
          branchId,
          date: new Date(d),
          amount: 100,
          concept: "separo",
          method: "efectivo",
          createdBy: userId,
          enrollmentId,
          createdAt: at(d, "15:00:00"),
          cashSessionId: s.id,
        },
      });
    };
    await mk(noClose, at(day(69), "10:00:00")); // cerró al día siguiente
    await mk(closed, at(closed, "20:00:00"));
    const out = await service.run(at(today, "12:00:00"));
    expect(out.created).toContain(`gv-dia-sin-cierre:${branchId}:${noClose}`);
    expect(out.created).not.toContain(
      `gv-dia-sin-cierre:${branchId}:${closed}`,
    );
    const row = await db.alert.findUnique({
      where: { key: `gv-dia-sin-cierre:${branchId}:${noClose}` },
    });
    expect(row.type).toBe("gv_day_no_close");
    expect(row.message).toContain("sin cierre");
    // Repetir no duplica.
    expect((await service.run(at(today, "13:00:00"))).created).toEqual([]);
  });

  it("al cerrar la caja se resuelven sus avisos (10 PM y día sin cierre)", async () => {
    const service = new GvCajaVigilante(db);
    const d = day(80);
    const s = await db.gvCashSession.create({
      data: { branchId, userId, openingAmount: 0, openedAt: at(d, "09:00:00") },
    });
    await db.gvPayment.create({
      data: {
        branchId,
        date: new Date(d),
        amount: 100,
        concept: "separo",
        method: "efectivo",
        createdBy: userId,
        enrollmentId,
        createdAt: at(d, "15:00:00"),
        cashSessionId: s.id,
      },
    });
    await service.run(at(d, "22:30:00"));
    await service.run(at(day(82), "12:00:00"));
    const nightKey = `gv-caja-noche:${s.id}:${d}`;
    const dayKey = `gv-dia-sin-cierre:${branchId}:${d}`;
    const status = async (key: string) =>
      (await db.alert.findUnique({ where: { key } }))?.status;
    expect(await status(nightKey)).toBe("new");
    expect(await status(dayKey)).toBe("new");
    await db.$transaction((tx: any) => resolveGvCashAlerts(tx, branchId, s.id));
    expect(await status(nightKey)).toBe("resolved");
    expect(await status(dayKey)).toBe("resolved");
    // No se recrean al volver a correr el vigilante.
    await service.run(at(day(83), "22:30:00"));
    expect(await status(nightKey)).toBe("resolved");
  });
});
