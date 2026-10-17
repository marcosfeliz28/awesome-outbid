import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiExceptionFilter } from "../apps/api/src/common";
import { RetentionWorker } from "../apps/api/src/retention";
import {
  configuredWebOrigin,
  preventPrivateResponseCaching,
} from "../apps/api/src/http-security";
import { errorDiagnostic, logInternalError } from "../apps/api/src/safe-log";
import { validateSecret } from "../apps/api/src/security";
import express from "express";
import request from "supertest";
import { Logger } from "../apps/api/node_modules/@nestjs/common";
import { InventoryImportController } from "../apps/api/src/inventory-import";

afterEach(() => vi.restoreAllMocks());

describe("3ag · los fallos internos no registran credenciales ni datos", () => {
  it("la importación no registra un nombre o código de error de texto libre", () => {
    const secret = "credencial-ficticia-" + crypto.randomUUID();
    const log = vi
      .spyOn(Logger.prototype, "error")
      .mockImplementation(() => {});
    const api = new InventoryImportController({} as any);
    expect(() => (api as any).fail({ name: secret, code: secret })).toThrow();
    expect(log).toHaveBeenCalled();
    expect(JSON.stringify(log.mock.calls)).not.toContain(secret);
  });
  it("un error de Prisma no expone el SQL, parámetros, mensaje ni stack en consola o respuesta", () => {
    const secret = "credencial-ficticia-" + crypto.randomUUID();
    const error = Object.assign(new Error(`SQL VALUES ('${secret}')`), {
      name: "PrismaClientValidationError",
      meta: { password: secret },
      cause: new Error(secret),
    });
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const res: any = {
      setHeader: vi.fn(),
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    };
    new ApiExceptionFilter().catch(error, {
      switchToHttp: () => ({
        getResponse: () => res,
        getRequest: () => ({ path: "/api/sales?token=" + secret }),
      }),
    } as any);
    expect(res.status).toHaveBeenCalledWith(500);
    expect(log).toHaveBeenCalled();
    const printed = log.mock.calls
      .map((call) =>
        call
          .map((v) =>
            v instanceof Error ? String(v.stack) : JSON.stringify(v),
          )
          .join(" "),
      )
      .join("\n");
    expect(printed).not.toContain(secret);
    expect(JSON.stringify(res.json.mock.calls)).not.toContain(secret);
  });

  it("la retención conserva diagnóstico por control sin imprimir el mensaje del servidor", async () => {
    const secret = "credencial-ficticia-" + crypto.randomUUID();
    const log = vi.spyOn(console, "warn").mockImplementation(() => {});
    const db = { $executeRaw: vi.fn().mockRejectedValue(new Error(secret)) };
    await new RetentionWorker(db as any).run();
    expect(log).toHaveBeenCalled();
    expect(JSON.stringify(log.mock.calls)).not.toContain(secret);
  });
});

describe("3ag · diagnóstico seguro de configuración al arrancar", () => {
  it.each([
    {
      label: "ausente",
      secret: undefined,
      message: "Configura JWT_SECRET con al menos 32 caracteres aleatorios.",
    },
    {
      label: "ejemplo",
      secret: "replace-with-a-random-secret-of-at-least-32-characters",
      message:
        "JWT_SECRET de producción debe ser aleatorio; genera 32 bytes con crypto.randomBytes.",
    },
    {
      label: "repetido",
      secret: "a".repeat(64),
      message:
        "JWT_SECRET de producción debe ser aleatorio; genera 32 bytes con crypto.randomBytes.",
    },
    {
      label: "patrón",
      secret: "0123456789abcdef".repeat(4),
      message:
        "JWT_SECRET de producción debe ser aleatorio; genera 32 bytes con crypto.randomBytes.",
    },
  ])(
    "conserva la indicación fija de JWT_SECRET $label sin revelar su valor",
    ({ secret, message }) => {
      const log = vi.spyOn(console, "error").mockImplementation(() => {});
      let failure: unknown;
      try {
        validateSecret(secret, true);
      } catch (error) {
        failure = error;
      }
      expect(failure).toBeInstanceOf(Error);
      logInternalError(failure, "startup");
      const printed = JSON.stringify(log.mock.calls);
      expect(printed).toContain(message);
      if (secret) expect(printed).not.toContain(secret);
    },
  );

  it("la coincidencia exige el texto completo y sólo se admite al arrancar", () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const fixed = "Configura JWT_SECRET con al menos 32 caracteres aleatorios.";
    const privateValue = "credencial-ficticia-" + crypto.randomUUID();
    for (const message of [
      fixed + privateValue,
      privateValue + fixed,
      fixed + "\n" + privateValue,
    ]) {
      const error = Object.assign(new Error(message), {
        cause: new Error(privateValue),
        meta: { password: privateValue },
      });
      logInternalError(error, "startup");
    }
    logInternalError(new Error(fixed), "api");
    const printed = JSON.stringify(log.mock.calls);
    expect(printed).not.toContain(privateValue);
    expect(printed).not.toContain(fixed);
  });
});

describe("3ag · origen CORS y diagnósticos de formato cerrado", () => {
  it("una respuesta privada no puede almacenarse en la caché HTTP", async () => {
    const app = express();
    app.use(preventPrivateResponseCaching);
    app.get("/api/data", (_req, res) => res.json({ value: "dato ficticio" }));
    const response = await request(app).get("/api/data");
    expect(response.status).toBe(200);
    expect(response.headers["cache-control"]).toBe("no-store");
  });
  it.each([
    "*",
    "null",
    "https://*.example.test",
    "https://example.test/path",
    "https://example.test?token=privado",
    "https://example.test#privado",
    "https://usuario:clave@example.test",
    "https://a.test,https://b.test",
    "data:text/plain,abc",
    "file:///archivo",
  ])("rechaza WEB_ORIGIN no válido sin incluirlo en el error: %s", (origin) => {
    expect(() =>
      configuredWebOrigin({ NODE_ENV: "production", WEB_ORIGIN: origin }),
    ).toThrow(
      "WEB_ORIGIN debe ser un único origen HTTP(S), sin ruta ni credenciales.",
    );
  });
  it("exige origen en producción y conserva el origen local en desarrollo", () => {
    expect(() => configuredWebOrigin({ NODE_ENV: "production" })).toThrow(
      "obligatorio",
    );
    expect(configuredWebOrigin({})).toBe("http://localhost:5173");
    expect(
      configuredWebOrigin({ WEB_ORIGIN: "https://MI-TIENDA.example:443/" }),
    ).toBe("https://mi-tienda.example");
  });
  it("conserva sólo códigos y tipos conocidos; nunca texto libre", () => {
    expect(
      errorDiagnostic({ code: "P2028", name: "PrismaClientKnownRequestError" }),
    ).toEqual({ code: "P2028", type: "PrismaClientKnownRequestError" });
    expect(
      errorDiagnostic({ code: "token-privado", name: "clave-privada" }),
    ).toEqual({ type: "Error" });
  });
});
