// 05 v2 (N2, N3b): reglas del borrador del carrito y del cierre por
// inactividad con trabajo sin terminar. Los plazos se miden contra `now`, sin
// fechas fijas.
import { describe, expect, it } from "vitest";
import {
  DRAFT_MAX_AGE_MS,
  IDLE_WORK_CAP_MS,
  draftExpired,
  inactivityWaits,
} from "../apps/web/src/cartDraftPolicy";

const now = Date.now();
const work = {
  cartItems: 0,
  pendingSales: 0,
  online: true,
  untouchedMs: 0,
  timeoutMs: 30 * 60_000,
};

describe("05-N3b: caducidad del borrador", () => {
  it("un borrador reciente se recupera; uno de más de 12 h, no", () => {
    expect(DRAFT_MAX_AGE_MS).toBe(12 * 3_600_000);
    expect(draftExpired(now - 60_000, now)).toBe(false);
    expect(draftExpired(now - DRAFT_MAX_AGE_MS, now)).toBe(false);
    expect(draftExpired(now - DRAFT_MAX_AGE_MS - 1, now)).toBe(true);
  });
  it("sin fecha válida se descarta", () => {
    for (const bad of [undefined, null, "", "x", 0, -5, NaN])
      expect(draftExpired(bad, now)).toBe(true);
  });
});

describe("05-N2: la inactividad espera con trabajo, pero con tope", () => {
  it("sin carrito ni cola no espera", () => {
    expect(inactivityWaits({ ...work, untouchedMs: 99 * 60_000 })).toBe(false);
  });
  it("un carrito espera hasta el tope y luego deja bloquear", () => {
    const cart = { ...work, cartItems: 2 };
    expect(inactivityWaits({ ...cart, untouchedMs: 31 * 60_000 })).toBe(true);
    expect(
      inactivityWaits({ ...cart, untouchedMs: IDLE_WORK_CAP_MS - 1 }),
    ).toBe(true);
    expect(inactivityWaits({ ...cart, untouchedMs: IDLE_WORK_CAP_MS })).toBe(
      false,
    );
  });
  it("ventas pendientes con internet también tienen tope", () => {
    const queued = { ...work, pendingSales: 1, untouchedMs: IDLE_WORK_CAP_MS };
    expect(inactivityWaits(queued)).toBe(false);
  });
  it("ventas pendientes sin internet esperan sin tope", () => {
    expect(
      inactivityWaits({
        ...work,
        pendingSales: 1,
        online: false,
        untouchedMs: 48 * 3_600_000,
      }),
    ).toBe(true);
  });
  it("el tope nunca es menor que el plazo de inactividad configurado", () => {
    const long = { ...work, cartItems: 1, timeoutMs: 5 * 3_600_000 };
    expect(inactivityWaits({ ...long, untouchedMs: 3 * 3_600_000 })).toBe(true);
    expect(inactivityWaits({ ...long, untouchedMs: 5 * 3_600_000 })).toBe(
      false,
    );
  });
});
