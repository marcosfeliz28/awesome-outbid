export function dashboardCategoryShares(totals: readonly number[]) {
  const total = totals.reduce((sum, amount) => sum + amount, 0);
  const percentages = totals.map((amount) =>
    total ? (amount / total) * 100 : 0,
  );
  const labels = percentages.map(Math.floor);

  if (total && Number.isFinite(total) && percentages.every(Number.isFinite)) {
    const byRemainder = percentages
      .map((percent, index) => ({ index, remainder: percent - labels[index] }))
      .sort((a, b) => b.remainder - a.remainder || a.index - b.index);
    const remaining = 100 - labels.reduce((sum, label) => sum + label, 0);

    // Los rótulos deben sumar 100; las barras conservan la proporción real.
    for (const { index } of byRemainder.slice(0, Math.max(0, remaining))) {
      labels[index] += 1;
    }
  }

  return percentages.map((percent, index) => ({
    percent,
    label: labels[index],
  }));
}
