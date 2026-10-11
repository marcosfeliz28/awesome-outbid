// Una sola tabla de promociones para las tres copias de la lógica: la API
// (apps/api/src/sales.ts, probada en tests/calidad-dinero-api.test.ts), la cola
// offline (apps/web/src/pendingSales.ts) y la caja (apps/web/src/POS.tsx),
// probadas en tests/promociones-paridad.test.ts. Si una copia diverge, falla
// la prueba de esa copia con el mismo total esperado.
export type PromotionCase = {
  id: string;
  type: "percent" | "amount" | "special_price" | "nxm" | "second_half";
  value: number;
  scope?: { buy?: number; pay?: number };
  price: number;
  qty: number;
  /** Total de la línea con la promoción aplicada (sin impuesto). */
  total: number;
};
export const PROMOTION_CASES: PromotionCase[] = [
  {
    id: "percent",
    type: "percent",
    value: 20,
    price: 1000,
    qty: 1,
    total: 800,
  },
  // 150 de 1000 = 15 %: 2 × 1000 → 1700.
  {
    id: "amount",
    type: "amount",
    value: 150,
    price: 1000,
    qty: 2,
    total: 1700,
  },
  // Precio especial 800 sobre 1000 = 20 % menos.
  {
    id: "special",
    type: "special_price",
    value: 800,
    price: 1000,
    qty: 1,
    total: 800,
  },
  // 3×2: de 4 unidades, una gratis (25 %) → 3000.
  {
    id: "nxm",
    type: "nxm",
    value: 0,
    scope: { buy: 3, pay: 2 },
    price: 1000,
    qty: 4,
    total: 3000,
  },
  // Segundo a mitad de precio: de 3 unidades, una a 500 → 2500.
  {
    id: "second",
    type: "second_half",
    value: 0,
    price: 1000,
    qty: 3,
    total: 2500,
  },
];
