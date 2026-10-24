import { describe, expect, it } from "vitest";
import { QueryClient } from "../apps/web/node_modules/@tanstack/react-query";
import { applyRealtimeStock } from "../apps/web/src/catalog-stock";

describe("CI · dos ventas simultáneas y catálogo", () => {
  it("una respuesta antigua de catálogo no pisa el evento de stock más reciente", async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const product = (stock: string) => [{ id: "p1", variants: [{ id: "v1", stock }] }];
    client.setQueryData(["catalog"], product("3"));
    let finish!: (value: ReturnType<typeof product>) => void;
    const pending = client.fetchQuery({ queryKey: ["catalog"], queryFn: () => new Promise<ReturnType<typeof product>>((resolve) => { finish = resolve; }) });
    await Promise.resolve();
    await applyRealtimeStock(client, "v1", 1);
    finish(product("2")); // GET lanzado después de la primera venta
    await pending.catch(() => undefined);
    expect(client.getQueryData<ReturnType<typeof product>>(["catalog"])?.[0].variants[0].stock).toBe("1");
    client.clear();
  });
});
