export type ImportProblem = { row?: number; column?: string; message: string };

export const csvCell = (value: string | number) => {
  const raw = String(value);
  // Excel puede ejecutar fórmulas aun dentro de comillas CSV.
  const safe = /^\s*[=+\-@]/.test(raw) ? "'" + raw : raw;
  return '"' + safe.replace(/"/g, '""') + '"';
};

export function problemsCsv(problems: ImportProblem[]) {
  return "\ufeff" + [
    ["Fila del Excel", "Columna", "Causa"],
    ...problems.map((p) => [p.row ?? "", p.column ?? "General", p.message]),
  ].map((row) => row.map(csvCell).join(";")).join("\r\n");
}

export type ImportReview = {
  id: string;
  name: string;
  category: string;
  qty: number;
  active: boolean;
  notes: string[];
};

export function reviewCsv(rows: ImportReview[]) {
  return "\ufeff" + [
    ["ID", "Producto", "Categoría", "Existencia", "Activo", "Avisos"],
    ...rows.map((row) => [row.id, row.name, row.category, row.qty, row.active ? "Sí" : "No", row.notes.join("; ")]),
  ].map((row) => row.map(csvCell).join(";")).join("\r\n");
}
