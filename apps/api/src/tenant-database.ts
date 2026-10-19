import type { PrismaClient } from "@prisma/client";
import { DEMO_TENANT_ID, tenantScope } from "./tenant-context";

// Una transacción por operación garantiza que SET LOCAL no sobreviva en una
// conexión del pool. Los callbacks de $transaction comparten la MISMA conexión.
// El rol sin propiedad de tablas obliga a PostgreSQL a aplicar RLS.
export function tenantDatabaseProxy<T extends PrismaClient>(root: T): T {
  const scopeId = () => tenantScope.getStore()?.tenantId ?? DEMO_TENANT_ID;
  const prepare = async (tx: any, tenantId: string) => {
    await tx.$executeRawUnsafe("SET LOCAL ROLE nexora_tenant_runtime");
    await tx.$queryRawUnsafe(
      "SELECT set_config('app.tenant_id', $1, true)",
      tenantId,
    );
  };
  const scopedArgs = (method: string, args: unknown[], tenantId: string) => {
    const first = args[0];
    if (!first || typeof first !== "object" || Array.isArray(first)) return args;
    const input = { ...first as Record<string, any> };
    if (/^(?:find|count$|aggregate$|groupBy$|update|delete)/.test(method)) {
      input.where = { ...(input.where ?? {}), tenantId };
      if (method.startsWith("update") && input.data)
        input.data = { ...input.data, tenantId };
    }
    if (method === "create" && input.data)
      input.data = { ...input.data, tenantId };
    if ((method === "createMany" || method === "createManyAndReturn") && input.data)
      input.data = (Array.isArray(input.data) ? input.data : [input.data])
        .map((row: Record<string, unknown>) => ({ ...row, tenantId }));
    if (method === "upsert") {
      input.where = { ...(input.where ?? {}), tenantId };
      input.create = { ...(input.create ?? {}), tenantId };
      input.update = { ...(input.update ?? {}), tenantId };
    }
    return [input, ...args.slice(1)];
  };
  const execute = (model: string | null, method: string, args: unknown[]) => {
    const active: any = tenantScope.getStore()?.transaction;
    const tenantId = scopeId();
    const actualArgs = model ? scopedArgs(method, args, tenantId) : args;
    const invoke = (tx: any) =>
      model
        ? tx[model][method](...actualArgs)
        : tx[method](...actualArgs);
    if (active) return invoke(active);
    return root.$transaction(async (tx) => {
      await prepare(tx, tenantId);
      return invoke(tx);
    });
  };
  const proxyFor = (client: any): any =>
    new Proxy(client, {
      get(target, property) {
        const value = Reflect.get(target, property, target);
        if (property === "$transaction")
          return (callback: unknown, options?: unknown) => {
            if (typeof callback !== "function")
              throw new Error("Las transacciones del producto usan callback.");
            const active: any = tenantScope.getStore()?.transaction;
            if (active) return callback(proxyFor(active));
            const tenantId = scopeId();
            return root.$transaction(async (tx) => {
              await prepare(tx, tenantId);
              return tenantScope.run(
                { tenantId, transaction: tx },
                () => callback(proxyFor(tx)),
              );
            }, options as any);
          };
        if (
          typeof property === "string" &&
          /^\$(?:queryRaw|queryRawUnsafe|executeRaw|executeRawUnsafe)$/.test(property)
        )
          return (...args: unknown[]) => execute(null, property, args);
        if (value && typeof value === "object" && typeof value.findMany === "function")
          return new Proxy(value, {
            get(delegate, operation) {
              const original = Reflect.get(delegate, operation, delegate);
              return typeof operation === "string" && typeof original === "function"
                ? (...args: unknown[]) => execute(property as string, operation, args)
                : original;
            },
          });
        return typeof value === "function" ? value.bind(target) : value;
      },
    });
  return proxyFor(root) as T;
}
