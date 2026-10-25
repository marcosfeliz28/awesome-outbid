import "reflect-metadata";
import { RealtimeController } from "./realtime";
import { MerchandiseController } from "./merchandise";
import { InventoryImportController } from "./inventory-import";
import {
  Controller,
  Get,
  Inject,
  Module,
  MiddlewareConsumer,
  NestModule,
  ServiceUnavailableException,
} from "@nestjs/common";
import { APP_GUARD, APP_INTERCEPTOR } from "@nestjs/core";
import { JwtModule } from "@nestjs/jwt";
import { AuthGuard, Database, Public } from "./common";
import { AuthController } from "./auth";
import { RegistrationController, RegistrationService } from "./registration";
import { PlatformController } from "./platform";
import { PlatformAiPacksController } from "./platform-ai-packs";
import { PlatformBillingController } from "./platform-billing";
import { OnboardingController } from "./onboarding";
import { TenantLifecycleService, TenantLifecycleWorker } from "./tenant-lifecycle";
import { TenantLifecycleController } from "./tenant-lifecycle-controller";
import { ProductBillingController } from "./product-billing";
import { AssistantController } from "./assistant";
import { DailySummaryWorker } from "./daily-summary";
import { TransferProofReviewController } from "./transfer-proof-review";
import { PlatformSupportController, SupportAccessController, SupportAccessWorker } from "./support-access";
import { McpController } from "./mcp";
import { TenantExportController } from "./tenant-export";
import { SupportController } from "./support";
import { CatalogController } from "./catalog";
import { InventoryController } from "./inventory";
import { WarehousesController } from "./warehouses";
import { SalesController } from "./sales";
import { CourierController } from "./courier";
import { AdminController } from "./admin";
import { CashController } from "./cash";
import { ReportsController } from "./reports";
import { IncomeReportController } from "./income-report";
import { FormalReportController } from "./formal-report";
import { AlertCacheInterceptor, AlertEngine, AlertsController } from "./alerts";
import { NcfSequencesController } from "./ncf-sequences";
import { OfflineSalesController } from "./offline-sales";
import { OfflineSaleReviewController } from "./offline-sale-review";
import { IncentivesController } from "./incentives";
import { NotificationsController, NotificationWorker } from "./notifications";
import { CreditReminderService } from "./credit-reminder";
import { RetentionWorker } from "./retention";
import { TenantObjectDeletionWorker } from "./tenant-object-deletion";
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
import { tenantFromRequest, tenantScope } from "./tenant-context";

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
      if (process.env.PRODUCT_TENANCY === "required")
        await this.db.healthCheck();
      else await this.db.$queryRaw`SELECT 1`;
      return { status: "ok" };
    } catch {
      throw new ServiceUnavailableException("Servicio no disponible.");
    }
  }
}
export function createAppModule(secret: string) {
  const product = process.env.PRODUCT_TENANCY === "required";
  @Module({
    imports: [JwtModule.register({ secret })],
    controllers: [
      HealthController,
      RealtimeController,
      MerchandiseController,
      InventoryImportController,
      AuthController,
      ...(product ? [RegistrationController, PlatformController, PlatformBillingController, PlatformAiPacksController] : []),
      ...(product ? [OnboardingController] : []),
      ...(product ? [TenantLifecycleController] : []),
      ...(product ? [ProductBillingController] : []),
      ...(product ? [AssistantController] : []),
      ...(product ? [TransferProofReviewController] : []),
      ...(product ? [SupportAccessController, PlatformSupportController] : []),
      ...(product ? [McpController] : []),
      ...(product ? [TenantExportController, SupportController] : []),
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
      AlertsController,
      ...(product ? [NcfSequencesController] : []),
      OfflineSalesController,
      OfflineSaleReviewController,
      NotificationsController,
      IncentivesController,
      ...(!product ? [DriveBackupController] : []),
    ],
    providers: [
      Database,
      AlertEngine,
      NotificationWorker,
      CreditReminderService,
      RetentionWorker,
      TenantObjectDeletionWorker,
      ...(!product ? [DriveBackupService, DriveBackupWorker] : []),
      UsdRateWorker,
      RequestRateLimitService,
      ...(product ? [RegistrationService] : []),
      ...(product ? [SupportAccessWorker] : []),
      ...(product ? [DailySummaryWorker] : []),
      // Guard se inyecta también en modo tienda, pero nunca consulta el ciclo.
      TenantLifecycleService,
      ...(product ? [TenantLifecycleWorker] : []),
      SecurityMaintenance,
      { provide: APP_GUARD, useClass: AuthGuard },
      { provide: APP_GUARD, useClass: AuthenticatedRateLimitGuard },
      { provide: APP_INTERCEPTOR, useClass: AlertCacheInterceptor },
    ],
  })
  class AppModule implements NestModule {
    constructor(@Inject(Database) readonly db: Database) {}
    configure(consumer: MiddlewareConsumer) {
      consumer
        .apply((req: any, res: any, next: (error?: unknown) => void) => {
          if (!product) {
            tenantScope.run({ tenantId: tenantFromRequest(req)! }, next);
            return;
          }
          const path = String(req.originalUrl ?? req.url).split("?")[0];
          if (/^\/api\/health(?:\/live|\/ready)?\/?$/.test(path)) {
            next();
            return;
          }
          // OAuth público y MCP validan el token y el contexto dentro del
          // controlador; ningún tenant se deduce de un bearer sin verificar.
          if (/^\/api\/mcp(?:\/oauth\/(?:client|token|metadata))?\/?$/.test(path)) {
            next();
            return;
          }
          // Sin empresa: alta, invitación y operador de plataforma (credencial propia).
          if (/^\/api\/(?:auth\/(?:register|verify-email|resend-verification|accept-invitation)|platform\/(?:summary|support-grants|tenants(?:\/[a-z0-9-]{1,63}(?:\/(?:payments|ai-packs|ai-usage|reinvite|support-session))?)?))\/?$/.test(path)) {
            next();
            return;
          }
          if (/^\/api\/auth\/(?:login|change-password)\/?$/.test(path)) {
            const slug = req.headers["x-tenant-id"];
            if (
              typeof slug !== "string" ||
              !/^[a-z0-9][a-z0-9-]{1,62}$/.test(slug)
            ) {
              res
                .status(400)
                .json({ message: "Escribe el código de empresa." });
              return;
            }
            void this.db
              .resolveTenantSlug(slug)
              .then((tenantId) => {
                if (!tenantId)
                  res
                    .status(400)
                    .json({ message: "Código de empresa no disponible." });
                else tenantScope.run({ tenantId }, next);
              })
              .catch(next);
            return;
          }
          const tenantId = tenantFromRequest(req);
          if (!tenantId) {
            res.status(400).json({ message: "Falta el contexto de empresa." });
            return;
          }
          tenantScope.run({ tenantId }, next);
        })
        .forRoutes("*");
    }
  }
  return AppModule;
}
