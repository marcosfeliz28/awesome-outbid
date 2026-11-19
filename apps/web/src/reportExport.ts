// Ruta de descarga PDF/Excel de un reporte exportable (motor del servidor).
export type ExportFormat = "pdf" | "xlsx";

export const exportPath = (
  name: string,
  from: string,
  to: string,
  f: ExportFormat,
) =>
  `/reports/${encodeURIComponent(name)}/export?` +
  new URLSearchParams({ from, to, format: f });

export const exportFileName = (name: string, f: ExportFormat) => `${name}.${f}`;
