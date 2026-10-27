import "reflect-metadata";
import { RealtimeController } from "./realtime";
import { MerchandiseController } from "./merchandise";
import { InventoryImportController } from "./inventory-import";
import {
  Controller,
  Get,
  Inject,
  Module,
  ServiceUnavailableException,
} from "@nestjs/common";
import { APP_GUARD, APP_INTERCEPTOR } from "@nestjs/core";
import { JwtModule } from "@nestjs/jwt";
import { AuthGuard, Database, Public } from "./common";
import { AuthController } from "./auth";
import { CatalogController } from "./catalog";
import { InventoryController } from "./inventory";
import { WarehousesController } from "./warehouses";
import { SalesController } from "./sales";
import { CourierController } from "./courier";
import { AdminController } from "./admin";
import { CashController } from "./cash";
import { ReportsController } from "./reports";
import { CashierSurveyController } from "./cashier-survey";
import { IncomeReportController } from "./income-report";
import { FormalReportController } from "./formal-report";
import { AlertCacheInterceptor, AlertEngine, AlertsController } from "./alerts";
import { OfflineSalesController } from "./offline-sales";
import { OfflineSaleReviewController } from "./offline-sale-review";
import { IncentivesController } from "./incentives";
import { NotificationsController, NotificationWorker } from "./notifications";
import { CreditReminderService } from "./credit-reminder";
import { RetentionWorker } from "./retention";
import { UsdRateWorker } from "./usd-rate";
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
import { GvController } from "./gv";
import { GvCitasController } from "./gv-citas";

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
      InventoryImportController,
      AuthController,
      CatalogController,
      InventoryController,
      WarehousesController,
      SalesController,
      CourierController,
      AdminController,
      CashController,
      IncomeReportController,
      FormalReportController,
      ReportsController,
      CashierSurveyController,
      AlertsController,
      OfflineSalesController,
      OfflineSaleReviewController,
      NotificationsController,
      IncentivesController,
      DriveBackupController,
      GvController,
      GvCitasController,
    ],
    providers: [
      Database,
      AlertEngine,
      NotificationWorker,
      CreditReminderService,
      DriveBackupService,
      DriveBackupWorker,
      RetentionWorker,
      UsdRateWorker,
      RequestRateLimitService,
      SecurityMaintenance,
      { provide: APP_GUARD, useClass: AuthGuard },
      { provide: APP_GUARD, useClass: AuthenticatedRateLimitGuard },
      { provide: APP_INTERCEPTOR, useClass: AlertCacheInterceptor },
    ],
  })
  class AppModule {}
  return AppModule;
}
