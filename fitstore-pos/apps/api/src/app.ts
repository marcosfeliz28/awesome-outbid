import "reflect-metadata";
import { RealtimeController } from "./realtime";
import { MerchandiseController } from "./merchandise";
import { Controller, Get, Module } from "@nestjs/common";
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

@Controller()
class HealthController {
  @Public() @Get("health") health() {
    return { status: "ok", service: "FitStore POS" };
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
    ],
    providers: [
      Database,
      AlertEngine,
      { provide: APP_GUARD, useClass: AuthGuard },
    ],
  })
  class AppModule {}
  return AppModule;
}
