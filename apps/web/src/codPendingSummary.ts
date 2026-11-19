type PendingRow = { pending?: unknown; hiddenUntilClose?: boolean };

/** Totales que la API permite mostrar durante una caja ciega. */
export function creditPendingSummary(rows: PendingRow[]) {
  return {
    visibleTotal: rows.reduce(
      (sum, row) => sum + (Number(row.pending) || 0),
      0,
    ),
    hiddenCount: rows.filter((row) => row.hiddenUntilClose).length,
  };
}
