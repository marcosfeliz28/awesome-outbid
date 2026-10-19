import "reflect-metadata";
import { config } from "dotenv";
import { resolve } from "node:path";
import { NestFactory } from "@nestjs/core";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import { createAppModule } from "./app";
import { validateSecret } from "./security";
import { ApiExceptionFilter } from "./common";
import { captureApiException, initializeApiMonitoring } from "./monitoring";
import { createRequestRateLimiter } from "./rate-limit";

config({ path: resolve(process.cwd(), "../../.env") });
config();
async function bootstrap() {
  initializeApiMonitoring();
  const production = process.env.NODE_ENV === "production";
  const webOrigin = process.env.WEB_ORIGIN?.trim();
  if (production && !webOrigin)
    throw new Error("WEB_ORIGIN es obligatorio en producción.");
  const secret = validateSecret(process.env.JWT_SECRET, production);
  const app = await NestFactory.create(createAppModule(secret));
  app.getHttpAdapter().getInstance().set("trust proxy", 1);
  app.setGlobalPrefix("api");
  app.use(helmet());
  app.use(cookieParser());
  app.enableCors({
    origin: webOrigin || "http://localhost:5173",
    credentials: true,
  });
  app.useGlobalFilters(new ApiExceptionFilter());
  app.use(createRequestRateLimiter());
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
  await app.listen(Number(process.env.PORT || 3001), "0.0.0.0");
}
bootstrap().catch((error) => {
  captureApiException(error, "startup");
  console.error(error);
  process.exit(1);
});
