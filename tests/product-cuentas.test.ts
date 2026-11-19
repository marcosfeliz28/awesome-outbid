import { createRequire } from "node:module";
import { resolve } from "node:path";
import { describe, expect, it, vi } from "vitest";
import {
  QueryClient,
  QueryClientProvider,
} from "../apps/web/node_modules/@tanstack/react-query/build/modern/index.js";
import {
  formatTenantDate,
  noticeText,
  tenantNotice,
} from "../apps/api/src/tenant-lifecycle";
import { TRIAL_DAYS } from "../apps/api/src/registration";
import {
  TenantStatusBanner,
  tenantBannerText,
  type TenantStatus,
} from "../apps/web/src/TenantStatusBanner";

vi.mock("../apps/web/src/api", () => ({ api: vi.fn() }));
const webRequire = createRequire(resolve("apps/web/package.json"));
const { createElement } = webRequire("react") as typeof import("react");
const { renderToStaticMarkup } = webRequire(
  "react-dom/server",
) as typeof import("react-dom/server");

// Decisiones de la dueña (19-nov): avisos 2 días antes y 2 días después; prueba de 7 días.
const DAY = 86_400_000;
const due = new Date("2030-03-10T02:00:00Z");
const trial = {
  status: "trial",
  trialEndsAt: due,
  paidThroughAt: null,
  pastDueAt: null,
};
const at = (days: number) => new Date(due.getTime() + days * DAY);

describe("avisos de pago", () => {
  it("2 días antes avisa una vez por período; antes de eso, nada", () => {
    expect(tenantNotice(trial, at(-2.01))).toBeNull();
    expect(tenantNotice(trial, at(-2))).toMatchObject({
      kind: "trial_due_2",
      dueAt: due,
    });
    expect(tenantNotice(trial, at(-0.1))).toMatchObject({
      kind: "trial_due_2",
      dueAt: due,
    });
    expect(
      tenantNotice(
        { ...trial, status: "active", trialEndsAt: null, paidThroughAt: due },
        at(-1),
      ),
    ).toMatchObject({ kind: "billing_due_2" });
  });
  it("2 días después del vencimiento (en mora) avisa la suspensión; suspendido ya no", () => {
    expect(tenantNotice(trial, at(1))).toBeNull();
    expect(tenantNotice(trial, at(2))).toMatchObject({
      kind: "overdue_2",
      dueAt: due,
      graceEndsAt: at(7),
    });
    expect(
      tenantNotice({ ...trial, status: "past_due", pastDueAt: due }, at(5)),
    ).toMatchObject({ kind: "overdue_2", dueAt: due });
    expect(tenantNotice(trial, at(7))).toBeNull();
    expect(tenantNotice({ ...trial, status: "suspended" }, at(3))).toBeNull();
  });
  it("fechas en la zona de la empresa (H10), no en UTC", () => {
    expect(formatTenantDate(due, "America/Santo_Domingo")).toBe(
      "9 de marzo de 2030",
    );
    expect(formatTenantDate(due, "UTC")).toBe("10 de marzo de 2030");
    expect(formatTenantDate(due, "Zona/Inventada")).toBe("9 de marzo de 2030");
    const before = noticeText(
      tenantNotice(trial, at(-1))!,
      "America/Santo_Domingo",
    );
    expect(before.text).toBe(
      "Tu prueba gratis de Norexos vence el 9 de marzo de 2030. Paga para seguir usando el sistema sin interrupciones (en «Plan y facturación»).",
    );
    const after = noticeText(
      tenantNotice(trial, at(3))!,
      "America/Santo_Domingo",
    );
    expect(after.subject).toMatch(/se va a suspender/);
    expect(after.text).toMatch(
      /antes del 16 de marzo de 2030, el sistema se suspende/,
    );
  });
  it("la prueba gratis dura 7 días", () => {
    expect(TRIAL_DAYS).toBe(7);
  });
});

describe("banner de estado en la web", () => {
  const overdue: TenantStatus = {
    status: "past_due",
    notice: { kind: "overdue_2", message: "Tu plan venció…" },
    supportContact: "WhatsApp 000",
  };
  it("la administración ve el aviso; la cajera, uno discreto", () => {
    expect(tenantBannerText(overdue, true)).toBe("Tu plan venció…");
    expect(tenantBannerText(overdue, false)).toBe(
      "Hay un aviso de pago del sistema. Avisa a la administración.",
    );
    expect(
      tenantBannerText({ ...overdue, status: "trial", notice: null }, true),
    ).toBeNull();
  });
  it("suspendido: pagar en la app o «Habla con nosotros» con el contacto configurado", () => {
    const cache = new QueryClient();
    cache.setQueryData(["tenant-status"], {
      status: "suspended",
      notice: null,
      supportContact: "WhatsApp 000",
    });
    const html = renderToStaticMarkup(
      createElement(
        QueryClientProvider,
        { client: cache },
        createElement(TenantStatusBanner, {
          admin: true,
          onPay: () => undefined,
        }),
      ),
    );
    expect(html).toContain("Ir a Plan y facturación");
    expect(html).toContain("Habla con nosotros: WhatsApp 000");
    const cashier = renderToStaticMarkup(
      createElement(
        QueryClientProvider,
        { client: cache },
        createElement(TenantStatusBanner, {
          admin: false,
          onPay: () => undefined,
        }),
      ),
    );
    expect(cashier).toContain("solo lectura");
    expect(cashier).not.toContain("Habla con nosotros");
  });
});
