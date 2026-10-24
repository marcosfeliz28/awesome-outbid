export function tableRowsKey(rows: readonly Record<string, unknown>[]) {
  return rows.map((row) => String(row.id ?? row.sku ?? JSON.stringify(row))).join("\u001f");
}

export function tablePage(page: number, rowCount: number, pageSize = 20) {
  const totalPages = Math.max(1, Math.ceil(rowCount / pageSize));
  return { current: Math.max(1, Math.min(page, totalPages)), totalPages };
}
