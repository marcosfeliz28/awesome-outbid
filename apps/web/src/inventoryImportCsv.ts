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
