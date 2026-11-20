export function dashboardCategoryShares(totals: readonly number[]) {
  const total = totals.reduce((sum, value) => sum + value, 0);
  if (!total || !Number.isFinite(total)) {
    return totals.map(() => ({ exact: 0, rounded: 0 }));
  }

  const exact = totals.map((value) => (value / total) * 100);
  const rounded = exact.map(Math.floor);
  const points = 100 - rounded.reduce((sum, value) => sum + value, 0);

  // Los empates conservan el orden de las categorías en pantalla.
  if (points >= 0 && points <= exact.length) {
    const order = exact
      .map((value, index) => ({ index, rest: value - rounded[index] }))
      .sort((a, b) => b.rest - a.rest || a.index - b.index);
    for (let i = 0; i < points; i++) rounded[order[i].index]++;
  } else {
    // Totales con cancelación numérica extrema: conservar el redondeo local.
    return exact.map((value) => ({ exact: value, rounded: Math.round(value) }));
  }

  return exact.map((value, index) => ({
    exact: value,
    rounded: rounded[index],
  }));
}
