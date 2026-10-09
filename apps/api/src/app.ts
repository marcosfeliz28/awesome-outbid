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
import { NotificationsController, NotificationWorker } from "./notifications";
import {
  AuthenticatedRateLimitGuard,
  RequestRateLimitService,
} from "./rate-limit";

@Controller()
export class HealthController {
  constructor(@Inject(Database) private readonly db: Database) {}

  @Public() @Get("health/live") live() {
    return { status: "ok", service: "Nexora POS" };
  }

  @Public() @Get(["health", "health/ready"]) async ready() {
    try {
      await this.db.$queryRaw`SELECT 1`;
      return { status: "ok", service: "Nexora POS", database: "ok" };
    } catch {
      throw new ServiceUnavailableException(
        "La base de datos no está disponible.",
      );
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
      NotificationsController,
    ],
    providers: [
      Database,
      AlertEngine,
      NotificationWorker,
      RequestRateLimitService,
      { provide: APP_GUARD, useClass: AuthGuard },
      { provide: APP_GUARD, useClass: AuthenticatedRateLimitGuard },
    ],
  })
  class AppModule {}
  return AppModule;
}
