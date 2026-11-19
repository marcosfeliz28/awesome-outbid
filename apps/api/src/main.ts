import "reflect-metadata";
import { config } from "dotenv";
import { resolve } from "node:path";
import { NestFactory } from "@nestjs/core";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import { json as jsonBodyParser } from "express";
import { createAppModule } from "./app";
import { largeJsonBody, validateSecret } from "./security";
import { JwtService } from "@nestjs/jwt";
import { corsOrigin } from "./cors-origin";
import { trustedProxies } from "./rate-limit";
import { ApiExceptionFilter } from "./common";
import { captureApiException, initializeApiMonitoring } from "./monitoring";
import { PrismaClient } from "@prisma/client";
import { safelyForcePasswordChangeAtStartup } from "./require-password-change";

config({ path: resolve(process.cwd(), "../../.env") });
config();
async function bootstrap() {
  initializeApiMonitoring();
  const production = process.env.NODE_ENV === "production";
  const webOrigin = process.env.WEB_ORIGIN?.trim();
  if (production && !webOrigin)
    throw new Error("WEB_ORIGIN es obligatorio en producción.");
  const secret = validateSecret(process.env.JWT_SECRET, production);
  const startupDb = new PrismaClient();
  try {
    await safelyForcePasswordChangeAtStartup(startupDb);
  } finally {
    await startupDb.$disconnect();
  }
  // Nest no registra su parser interno: instalamos exactamente uno. Los
  // limitadores públicos se aplican después de resolver una cuenta real.
  const app = await NestFactory.create(createAppModule(secret), {
    bodyParser: false,
  });
  // Sólo se cree la X-Forwarded-For que llega desde la red privada (Nginx);
  // ver trustedProxies y deploy/render/nginx.conf.template.
  app.getHttpAdapter().getInstance().set("trust proxy", trustedProxies());
  app.setGlobalPrefix("api");
  app.use(helmet());
  // La importación de GV (Excel en JSON) y los pagos y cierre de GV (foto del
  // voucher en base64) admiten 4 MB, por debajo de Nginx (5 MB), sólo en esas
  // rutas exactas y con sesión (B4, ver largeJsonBody). El resto, 100 kb.
  app.use(
    largeJsonBody(
      app.get(JwtService),
      jsonBodyParser({ limit: "4mb" }),
      jsonBodyParser({ limit: "100kb" }),
    ),
  );
  app.use(cookieParser());
  app.enableCors({
    origin: corsOrigin(webOrigin, process.env.NODE_ENV),
    credentials: true,
    // Paginación de GET /alerts y /credit-notes (cursor de la página siguiente).
    exposedHeaders: ["X-Next-Cursor"],
  });
  app.useGlobalFilters(new ApiExceptionFilter());
  if (!production || process.env.ENABLE_SWAGGER === "true") {
    const document = SwaggerModule.createDocument(
      app,
      new DocumentBuilder()
        .setTitle("Nexora POS")
        .setDescription(
          "API interna · comprobantes no fiscales · RBAC y transacciones",
        )
        .setVersion("0.1.0")
        .addBearerAuth()
        .build(),
    );
    SwaggerModule.setup("api/docs", app, document);
  }
  app.enableShutdownHooks();
  // Producción (Render) y el instalador de Windows necesitan "0.0.0.0" para
  // que el proxy/servicio del sistema alcance la API; no cambiar el default.
  // API_HOST es solo para copias de prueba locales (10-nov, aviso de Claude
  // PC): fijarla a "127.0.0.1" evita que otro equipo de la misma red LAN
  // alcance la copia mientras se hacen pruebas de seguridad.
  await app.listen(
    Number(process.env.PORT || 3001),
    process.env.API_HOST?.trim() || "0.0.0.0",
  );
}
bootstrap().catch((error) => {
  captureApiException(error, "startup");
  console.error(error);
  process.exit(1);
});
