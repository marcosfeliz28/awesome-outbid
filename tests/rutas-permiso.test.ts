import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";
import { createAppModule } from "../apps/api/src/app";

// Seguridad (dueña, 23-oct, punto 1 «Revisa los permisos»): toda ruta declara
// su permiso o es pública a propósito; el guardia niega lo que no lo declara.
const requireApi = createRequire(
  new URL("../apps/api/package.json", import.meta.url),
);
requireApi("reflect-metadata");
const { RequestMethod } = requireApi("@nestjs/common");
const { Reflector } = requireApi("@nestjs/core");
const reflector = new Reflector();
const controllers: any[] = Reflect.getMetadata(
  "controllers",
  createAppModule("clave-de-prueba-local-de-al-menos-32-caracteres"),
);
const routes = controllers.flatMap((controller) =>
  Object.getOwnPropertyNames(controller.prototype).flatMap((name) => {
    const handler = controller.prototype[name];
    const method = Reflect.getMetadata("method", handler);
    if (method === undefined) return [];
    const prefix = Reflect.getMetadata("path", controller) ?? "";
    const path = Reflect.getMetadata("path", handler) ?? "";
    return [
      {
        route: `${RequestMethod[method]} /${[prefix, path].flat().filter(Boolean).join("/")}`,
        permission: reflector.getAllAndOverride("permission", [
          handler,
          controller,
        ]),
        public: !!reflector.getAllAndOverride("public", [handler, controller]),
      },
    ];
  }),
);

describe("Permisos declarados en todas las rutas", () => {
  it("ninguna ruta queda sin @Permit ni @Public", () => {
    expect(routes.length).toBeGreaterThan(100);
    const missing = routes
      .filter((r) => !r.public && !r.permission)
      .map((r) => r.route);
    expect(missing).toEqual([]);
  });
});
