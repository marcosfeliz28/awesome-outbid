// Q-08 (auditoría 07 v2): la comprobación previa de las suites de integración
// avisa con un mensaje claro cuando la API que contesta no es la de este
// repositorio ni usa la base de las pruebas.
import { describe, expect, it } from "vitest";
import { databaseLabel, verifyIntegrationApi } from "./setup/integration-api";
import { assertSafeTestTargets } from "../scripts/test-target-safety.mjs";

const jwt = (payload: object) =>
  "x." + Buffer.from(JSON.stringify(payload)).toString("base64url") + ".y";
const reply = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status });
const env = {
  FITSTORE_API_URL: "http://127.0.0.1:3001/api/",
  DATABASE_URL: "postgresql://fitstore:secreto@localhost:5434/fitstore?x=1",
  NEXORA_TEST_ALLOW_LOCAL_DATABASE: "1",
};
const fetchWith = (
  login: () => Response,
  health = () => reply(200, { status: "ok" }),
) =>
  (async (url: string) =>
    String(url).endsWith("/health") ? health() : login()) as typeof fetch;

describe("comprobación de la API de integración", () => {
  it("acepta una API sana cuya sesión existe en la base de las pruebas", async () => {
    const seen: string[] = [];
    const base = await verifyIntegrationApi({
      env,
      fetchFn: fetchWith(() =>
        reply(201, { accessToken: jwt({ sid: "s-1" }) }),
      ),
      sessionExists: async (id) => {
        seen.push(id);
        return true;
      },
    });
    expect(base).toBe("http://127.0.0.1:3001/api");
    expect(seen).toEqual(["s-1"]);
  });

  it("falla con un mensaje claro si nada contesta en el puerto", async () => {
    await expect(
      verifyIntegrationApi({
        env,
        fetchFn: (async () => {
          throw Object.assign(new TypeError("fetch failed"), {
            cause: { code: "ECONNREFUSED" },
          });
        }) as unknown as typeof fetch,
        sessionExists: async () => true,
      }),
    ).rejects.toThrow(
      /No hay una API que responda en http:\/\/127\.0\.0\.1:3001\/api \(ECONNREFUSED\).*pnpm verify/s,
    );
  });

  it("rechaza API remota antes de cualquier petición, incluso si se pide omitir la comprobación", async () => {
    let requests = 0;
    await expect(
      verifyIntegrationApi({
        env: {
          ...env,
          FITSTORE_API_URL: "https://pos.example.test/api",
          NEXORA_TEST_SKIP_API_CHECK: "1",
        },
        fetchFn: (async () => {
          requests += 1;
          return reply(200, {});
        }) as unknown as typeof fetch,
        sessionExists: async () => true,
      }),
    ).rejects.toThrow(/equipo local|loopback|remota/);
    expect(requests).toBe(0);
  });

  it("rechaza DATABASE_URL remota antes de llamar a la API", async () => {
    let requests = 0;
    await expect(
      verifyIntegrationApi({
        env: {
          ...env,
          DATABASE_URL:
            "postgresql://fitstore:secreto@db.example.test:5432/fitstore",
        },
        fetchFn: (async () => {
          requests += 1;
          return reply(200, {});
        }) as unknown as typeof fetch,
        sessionExists: async () => true,
      }),
    ).rejects.toThrow(/base local|loopback|remota|equipo local/);
    expect(requests).toBe(0);
  });

  it("rechaza hostaddr alterno escondido en los parámetros de la URL PostgreSQL", () => {
    expect(() =>
      assertSafeTestTargets({
        apiUrl: env.FITSTORE_API_URL,
        proxyUrl: undefined,
        databaseUrl:
          "postgresql://fitstore:secreto@localhost:5434/fitstore?hostaddr=db.example.test",
        env,
      }),
    ).toThrow(/base PostgreSQL del equipo local/);
  });

  it("rechaza proxy remoto de navegador aunque la API sea local", async () => {
    let requests = 0;
    await expect(
      verifyIntegrationApi({
        env: { ...env, FITSTORE_API_PROXY: "https://pos.example.test" },
        fetchFn: (async () => {
          requests += 1;
          return reply(200, {});
        }) as unknown as typeof fetch,
        sessionExists: async () => true,
      }),
    ).rejects.toThrow(/proxy|equipo local|loopback/);
    expect(requests).toBe(0);
  });

  it("exige autorización local fuera de CI, pero admite el PostgreSQL local aislado de Actions", async () => {
    const options = {
      fetchFn: fetchWith(() =>
        reply(201, { accessToken: jwt({ sid: "ci-s-1" }) }),
      ),
      sessionExists: async () => true,
    };
    await expect(
      verifyIntegrationApi({
        ...options,
        env: { ...env, NEXORA_TEST_ALLOW_LOCAL_DATABASE: undefined },
      }),
    ).rejects.toThrow(/NEXORA_TEST_ALLOW_LOCAL_DATABASE=1/);

    await expect(
      verifyIntegrationApi({
        ...options,
        env: {
          ...env,
          NEXORA_TEST_ALLOW_LOCAL_DATABASE: undefined,
          CI: "true",
          GITHUB_ACTIONS: "true",
        },
      }),
    ).resolves.toBe("http://127.0.0.1:3001/api");
  });

  it("falla si /health no está sano o el administrador demo no entra (otra copia del sistema)", async () => {
    await expect(
      verifyIntegrationApi({
        env,
        fetchFn: fetchWith(
          () => reply(201, {}),
          () => reply(503, {}),
        ),
        sessionExists: async () => true,
      }),
    ).rejects.toThrow(/respondió HTTP 503 a \/health/);
    await expect(
      verifyIntegrationApi({
        env,
        fetchFn: fetchWith(() => reply(400, { message: "no" })),
        sessionExists: async () => true,
      }),
    ).rejects.toThrow(/no dejó entrar al administrador demo \(HTTP 400\)/);
    await expect(
      verifyIntegrationApi({
        env,
        fetchFn: fetchWith(() => reply(201, { accessToken: "sin-sesion" })),
        sessionExists: async () => true,
      }),
    ).rejects.toThrow(/token sin sesión/);
  });

  it("falla si la API usa otra base: la sesión que creó no existe en la de las pruebas, sin exponer credenciales", async () => {
    let error: Error | undefined;
    try {
      await verifyIntegrationApi({
        env,
        fetchFn: fetchWith(() =>
          reply(201, { accessToken: jwt({ sid: "otra-base" }) }),
        ),
        sessionExists: async () => false,
      });
    } catch (e) {
      error = e as Error;
    }
    expect(error?.message).toMatch(/NO usa la base de datos de las pruebas/);
    expect(error?.message).toContain("localhost:5434/fitstore");
    expect(error?.message).not.toContain("secreto");
  });

  it("puerto 3001 por defecto, y se omite sólo con NEXORA_TEST_SKIP_API_CHECK=1", async () => {
    const urls: string[] = [];
    await verifyIntegrationApi({
      env: {
        ...env,
        FITSTORE_API_URL: undefined,
      },
      fetchFn: (async (url: string) => {
        urls.push(String(url));
        return String(url).endsWith("/health")
          ? reply(200, {})
          : reply(201, { accessToken: jwt({ sid: "s" }) });
      }) as unknown as typeof fetch,
      sessionExists: async () => true,
    });
    expect(urls[0]).toBe("http://127.0.0.1:3001/api/health");
    expect(
      await verifyIntegrationApi({
        env: { ...env, NEXORA_TEST_SKIP_API_CHECK: "1" },
        fetchFn: (async () => {
          throw new Error("no debe llamarse");
        }) as unknown as typeof fetch,
        sessionExists: async () => false,
      }),
    ).toBe("omitida");
    expect(databaseLabel(undefined)).toMatch(/sin definir/);
  });
});
