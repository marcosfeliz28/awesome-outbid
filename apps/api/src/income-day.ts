export type IncomeEvent = {
  day: string;
  kind: string;
  amount: number | string;
};
export type IncomeDay = {
  day: string;
  cash: number;
  card: number;
  transfer: number;
  creditGenerated: number;
  collectionCash: number;
  collectionCard: number;
  collectionTransfer: number;
  returns: number;
  moneyIn: number;
  sold: number;
};
const kinds: Record<string, keyof Omit<IncomeDay, "day" | "moneyIn">> = {
  sale_cash: "cash",
  sale_card: "card",
  sale_transfer: "transfer",
  credit_generated: "creditGenerated",
  collection_cash: "collectionCash",
  collection_card: "collectionCard",
  collection_transfer: "collectionTransfer",
  return_total: "returns",
  sold: "sold",
  return_cash: "cash",
  return_card: "card",
  return_transfer: "transfer",
};
export function groupIncomeDays(events: IncomeEvent[]): IncomeDay[] {
  const rows = new Map<string, IncomeDay>();
  for (const event of events) {
    const field = kinds[event.kind];
    if (!field) continue;
    const day = rows.get(event.day) ?? {
      day: event.day,
      cash: 0,
      card: 0,
      transfer: 0,
      creditGenerated: 0,
      collectionCash: 0,
      collectionCard: 0,
      collectionTransfer: 0,
      returns: 0,
      moneyIn: 0,
      sold: 0,
    };
    // SQL ya agrupó los importes. Enteros en centavos evitan deriva binaria.
    day[field] += Math.round(Number(event.amount) * 100);
    if (event.kind === "return_total")
      day.sold += Math.round(Number(event.amount) * 100);
    rows.set(event.day, day);
  }
  return [...rows.values()]
    .sort((a, b) => a.day.localeCompare(b.day))
    .map((row) => {
      row.moneyIn =
        row.cash +
        row.card +
        row.transfer +
        row.collectionCash +
        row.collectionCard +
        row.collectionTransfer;
      for (const key of new Set([
        ...Object.values(kinds),
        "moneyIn",
      ] as (keyof IncomeDay)[]))
        if (key !== "day") (row as any)[key] = (row as any)[key] / 100;
      return row;
    });
}

// D15: la caja cuenta los dólares en su propia gaveta y de los pesos solo
// resta el vuelto (cashExpected); el reporte los suma como su equivalente en
// pesos. Para comparar con el cierre se quita ese equivalente y se resta el
// vuelto, igual que hace la caja.
export function cashReconciliation(
  row: IncomeDay,
  expected: { cash: number; card: number; transfer: number },
  usd: { amount: number; change: number } = { amount: 0, change: 0 },
) {
  const cents = (value: number) => Math.round(value * 100);
  const report = {
    cash:
      (cents(row.cash + row.collectionCash) -
        cents(usd.amount) -
        cents(usd.change)) /
      100,
    card: cents(row.card + row.collectionCard) / 100,
    transfer: cents(row.transfer + row.collectionTransfer) / 100,
  };
  const difference = {
    cash: (cents(report.cash) - cents(expected.cash)) / 100,
    card: (cents(report.card) - cents(expected.card)) / 100,
    transfer: (cents(report.transfer) - cents(expected.transfer)) / 100,
  };
  return {
    report,
    expected,
    difference,
    matches: Object.values(difference).every((value) => value === 0),
  };
}
