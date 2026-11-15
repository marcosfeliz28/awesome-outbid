// @vitest-environment node
import { readFileSync } from "node:fs";
import { QueryClient } from "../apps/web/node_modules/@tanstack/react-query";
import { expect, it } from "vitest";
import { refreshAfterSale } from "../apps/web/src/postSaleRefresh";

// EFI-01: vender no vuelve a bajar el catálogo entero.
const KEYS = [
  "catalog",
  "categories",
  "settings",
  "promotions",
  "sales",
  "cash-sessions",
  "pending-sales",
  "cod-pending",
  "customers",
  "credit-accounts",
  "dashboard",
  "alerts",
];

it("tras una venta se refrescan las derivadas y no categorías, ajustes ni promociones", () => {
  const client = new QueryClient();
  for (const k of KEYS) client.setQueryData([k], []);
  refreshAfterSale(client);
  const stale = (k: string) => client.getQueryState([k])?.isInvalidated;
  for (const k of KEYS.slice(4)) expect(stale(k), k).toBe(true);
  for (const k of ["categories", "settings", "promotions"])
    expect(stale(k), k).toBe(false);
});

it("el catálogo queda marcado viejo pero sin descargarse ahora", async () => {
  const client = new QueryClient();
  let fetches = 0;
  await client.prefetchQuery({
    queryKey: ["catalog"],
    queryFn: async () => (++fetches, []),
  });
  const obs = client.getQueryCache().find({ queryKey: ["catalog"] })!;
  obs.addObserver({
    onQueryUpdate() {},
    listeners: new Set(),
    getCurrentResult: () => ({}) as never,
    shouldFetchOnWindowFocus: () => false,
    options: { queryKey: ["catalog"], queryFn: async () => (++fetches, []) },
  } as never);
  refreshAfterSale(client);
  await new Promise((r) => setTimeout(r, 20));
  expect(client.getQueryState(["catalog"])?.isInvalidated).toBe(true);
  expect(fetches).toBe(1);
});

it("POS usa la función nueva y mantiene el refresco de catálogo solo en el conflicto de precio", () => {
  const pos = readFileSync("apps/web/src/POS.tsx", "utf8");
  expect(pos).toContain("refreshAfterSale(client);");
  expect(pos).not.toMatch(/clearCart\(\);\s*await client\.invalidateQueries\(\);/);
  expect(pos).toMatch(/\["catalog", "promotions", "settings"\]\.map/);
});
