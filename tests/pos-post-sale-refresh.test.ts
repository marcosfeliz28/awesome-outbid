// @vitest-environment node
import { readFileSync } from "node:fs";
import { QueryClient } from "../apps/web/node_modules/@tanstack/react-query";
import { expect, it } from "vitest";
import { refreshAfterSale } from "../apps/web/src/postSaleRefresh";

// EFI-01: vender no relee lo que no cambia, ni retiene el recibo, pero sí
// recarga el catálogo (red de seguridad del stock).
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

it("tras una venta se refrescan las derivadas y el catálogo, y no categorías, ajustes ni promociones", () => {
  const client = new QueryClient();
  for (const k of KEYS) client.setQueryData([k], []);
  refreshAfterSale(client);
  const stale = (k: string) => client.getQueryState([k])?.isInvalidated;
  for (const k of ["catalog", ...KEYS.slice(4)]) expect(stale(k), k).toBe(true);
  for (const k of ["categories", "settings", "promotions"])
    expect(stale(k), k).toBe(false);
});

it("no retiene el recibo: no devuelve una promesa que haya que esperar", () => {
  expect(refreshAfterSale(new QueryClient())).toBeUndefined();
});

it("el catálogo activo se recarga en segundo plano y categorías no", async () => {
  const client = new QueryClient();
  const fetches = { catalog: 0, categories: 0 };
  for (const k of ["catalog", "categories"] as const)
    await client.prefetchQuery({
      queryKey: [k],
      queryFn: async () => (++fetches[k], []),
    });
  for (const k of ["catalog", "categories"] as const)
    client.getQueryCache().find({ queryKey: [k] })!.addObserver({
      options: { queryKey: [k], queryFn: async () => (++fetches[k], []) },
      shouldFetchOnWindowFocus: () => false,
      onQueryUpdate() {},
      getCurrentResult: () => ({}),
    } as never);
  refreshAfterSale(client);
  await new Promise((r) => setTimeout(r, 30));
  expect(fetches.catalog).toBe(2);
  expect(fetches.categories).toBe(1);
});

it("POS usa la función nueva y conserva el refresco explícito del conflicto de precio", () => {
  const pos = readFileSync("apps/web/src/POS.tsx", "utf8");
  expect(pos).toContain("refreshAfterSale(client);");
  expect(pos).not.toMatch(/clearCart\(\);\s*await client\.invalidateQueries\(\);/);
  expect(pos).toMatch(/\["catalog", "promotions", "settings"\]\.map/);
});
