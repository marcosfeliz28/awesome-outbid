import "reflect-metadata";
import { RealtimeController } from "./realtime";
import { MerchandiseController } from "./merchandise";
import {
  Controller,
  Get,
  Inject,
  Module,
  ServiceUnavailableException,
} from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { JwtModule } from "@nestjs/jwt";
import { AuthGuard, Database, Public } from "./common";
import { AuthController } from "./auth";
import { CatalogController } from "./catalog";
import { InventoryController } from "./inventory";
import { SalesController } from "./sales";
import { AdminController } from "./admin";
import { CashController } from "./cash";
import { ReportsController } from "./reports";
import { AlertEngine, AlertsController } from "./alerts";
import { OfflineSalesController } from "./offline-sales";
import { OfflineSaleReviewController } from "./offline-sale-review";
import { IncentivesController } from "./incentives";
import { NotificationsController, NotificationWorker } from "./notifications";
import { RetentionWorker } from "./retention";
import {
  DriveBackupController,
  DriveBackupService,
  DriveBackupWorker,
} from "./drive-backup";
import {
  AuthenticatedRateLimitGuard,
  RequestRateLimitService,
} from "./rate-limit";
import { SecurityMaintenance } from "./security";

@Controller()
export class HealthController {
  constructor(@Inject(Database) private readonly db: Database) {}

  // S-06: las rutas públicas sólo dicen si el servicio está listo (200) o no
  // (503), sin nombre del producto ni detalle de la base de datos.
  @Public() @Get("health/live") live() {
    return { status: "ok" };
  }

  // Preparación: comprueba la base. Nginx la consulta en /healthz/deep (sin
  // cuerpo) y post-deploy-check.mjs en /api/health.
  @Public() @Get(["health", "health/ready"]) async ready() {
    try {
      await this.db.$queryRaw`SELECT 1`;
      return { status: "ok" };
    } catch {
      throw new ServiceUnavailableException("Servicio no disponible.");
    }
  }
}
export function createAppModule(secret: string) {
  @Module({
    imports: [JwtModule.register({ secret })],
    controllers: [
      HealthController,
      RealtimeController,
      MerchandiseController,
      AuthController,
      CatalogController,
      InventoryController,
      SalesController,
      AdminController,
      CashController,
      ReportsController,
      AlertsController,
      OfflineSalesController,
      OfflineSaleReviewController,
      NotificationsController,
      IncentivesController,
      DriveBackupController,
    ],
    providers: [
      Database,
      AlertEngine,
      NotificationWorker,
      DriveBackupService,
      DriveBackupWorker,
      RetentionWorker,
      RequestRateLimitService,
      SecurityMaintenance,
      { provide: APP_GUARD, useClass: AuthGuard },
      { provide: APP_GUARD, useClass: AuthenticatedRateLimitGuard },
    ],
  })
  class AppModule {}
  return AppModule;
}
