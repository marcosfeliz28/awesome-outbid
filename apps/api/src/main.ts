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

config({ path: resolve(process.cwd(), "../../.env") });
config();
async function bootstrap() {
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
  // Límite por IP en rutas de autenticación y PIN. Los bloqueos de usuario persisten en PostgreSQL.
  const attempts = new Map<string, { count: number; until: number }>();
  app.use((req: any, res: any, next: () => void) => {
    // El enrutador no distingue mayúsculas: /api/Auth/login llega al mismo
    // controlador, así que se compara la ruta en minúsculas (R9-seguridad-2).
    const path = String(req.path ?? req.url.split("?")[0]).toLowerCase();
    const auth = path.startsWith("/api/auth/");
    if (auth || (req.method === "POST" && path.startsWith("/api/sales"))) {
      const key = (auth ? "auth:" : "sales:") + req.ip;
      const now = Date.now();
      const item = attempts.get(key);
      if (item && item.until > now && item.count >= (auth ? 60 : 120)) {
        res
          .status(429)
          .json({ message: "Demasiados intentos. Espera un minuto." });
        return;
      }
      attempts.set(key, {
        count: item && item.until > now ? item.count + 1 : 1,
        until: item && item.until > now ? item.until : now + 60000,
      });
      if (attempts.size > 10000)
        for (const [id, value] of attempts)
          if (value.until < now) attempts.delete(id);
    }
    next();
  });
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
  console.error(error);
  process.exit(1);
});
