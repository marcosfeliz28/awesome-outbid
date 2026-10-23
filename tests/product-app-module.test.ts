import { afterEach, describe, expect, it } from "vitest";
import { createAppModule } from "../apps/api/src/app";
import { UsdRateWorker } from "../apps/api/src/usd-rate";
import {
  DriveBackupController,
  DriveBackupService,
  DriveBackupWorker,
} from "../apps/api/src/drive-backup";

const previousMode = process.env.PRODUCT_TENANCY;

afterEach(() => {
  if (previousMode === undefined) delete process.env.PRODUCT_TENANCY;
  else process.env.PRODUCT_TENANCY = previousMode;
});

function metadata(mode: string | undefined) {
  if (mode === undefined) delete process.env.PRODUCT_TENANCY;
  else process.env.PRODUCT_TENANCY = mode;
  const module = createAppModule("product-app-module-test-secret-2026");
  return {
    controllers: Reflect.getMetadata("controllers", module) as unknown[],
    providers: Reflect.getMetadata("providers", module) as unknown[],
  };
}

describe("servicios exclusivos de la tienda", () => {
  it("no registra respaldo completo ni tasa global en el producto multiempresa", () => {
    const { controllers, providers } = metadata("required");
    expect(controllers).not.toContain(DriveBackupController);
    expect(providers).not.toContain(DriveBackupService);
    expect(providers).not.toContain(DriveBackupWorker);
    expect(providers).not.toContain(UsdRateWorker);
  });

  it("los conserva en la aplicación tradicional de la tienda", () => {
    const { controllers, providers } = metadata(undefined);
    expect(controllers).toContain(DriveBackupController);
    expect(providers).toContain(DriveBackupService);
    expect(providers).toContain(DriveBackupWorker);
    expect(providers).toContain(UsdRateWorker);
  });
});
