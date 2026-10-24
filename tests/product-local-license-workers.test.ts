import { describe, expect, it, vi } from "vitest";
import { AlertEngine } from "../apps/api/src/alerts";
import { CreditReminderService } from "../apps/api/src/credit-reminder";
import { DriveBackupWorker } from "../apps/api/src/drive-backup";
import {
  backgroundEffectAllowed,
  type LocalLicenseBackgroundPolicy,
} from "../apps/api/src/local-license-background";
import { NotificationWorker } from "../apps/api/src/notifications";
import { RetentionWorker } from "../apps/api/src/retention";
import { SecurityMaintenance } from "../apps/api/src/security";
import { TenantLifecycleWorker } from "../apps/api/src/tenant-lifecycle";
import { TenantObjectDeletionWorker } from "../apps/api/src/tenant-object-deletion";
import { UsdRateWorker } from "../apps/api/src/usd-rate";

const readOnly = {
  allows: (effect: string) => effect === "read-only-backup",
} as LocalLicenseBackgroundPolicy;

const forbidden = new Proxy(
  {},
  {
    get(_target, property) {
      throw new Error(`El worker intentó acceder a ${String(property)}`);
    },
  },
) as any;

describe("PC-19 política de licencia para procesos de fondo", () => {
  it("bloquea escrituras y borrados, pero permite respaldos de solo lectura", () => {
    expect(
      backgroundEffectAllowed("write-or-delete", {
        mode: "read-only",
        reason: "expired",
      }),
    ).toBe(false);
    expect(
      backgroundEffectAllowed("read-only-backup", {
        mode: "read-only",
        reason: "expired",
      }),
    ).toBe(true);
    expect(
      backgroundEffectAllowed("write-or-delete", {
        mode: "write",
        reason: "active",
      }),
    ).toBe(true);
    expect(backgroundEffectAllowed("write-or-delete", undefined)).toBe(true);
  });

  it("no deja que ningún worker con efectos toque datos en solo lectura", async () => {
    const lifecycle = {
      queueNotices: vi.fn(),
      advance: vi.fn(),
      sendPendingNotices: vi.fn(),
    };
    const backup = { tick: vi.fn(), stop: vi.fn() };

    expect(
      await new CreditReminderService(forbidden, readOnly).run(
        new Date("2026-10-26T13:00:00.000Z"),
      ),
    ).toEqual({ created: [] });
    await new NotificationWorker(forbidden, readOnly).tick();
    await new RetentionWorker(forbidden, readOnly).run();
    await new SecurityMaintenance(forbidden, readOnly).run();
    await new TenantObjectDeletionWorker(forbidden, readOnly).run();
    await new UsdRateWorker(forbidden, readOnly).run();
    await new AlertEngine(forbidden, readOnly).runScheduled();
    await new TenantLifecycleWorker(lifecycle as any, readOnly).run();
    await new DriveBackupWorker(backup as any, readOnly).run();

    expect(lifecycle.queueNotices).not.toHaveBeenCalled();
    expect(lifecycle.advance).not.toHaveBeenCalled();
    expect(lifecycle.sendPendingNotices).not.toHaveBeenCalled();
    expect(backup.tick).not.toHaveBeenCalled();
  });
});
