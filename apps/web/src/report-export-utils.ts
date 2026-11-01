export type ReportExportFormat = "pdf" | "xlsx";

export function buildReportExportPath(
  reportId: string,
  format: ReportExportFormat,
  from: string,
  to: string,
) {
  return `/reports/${encodeURIComponent(reportId)}/export?${new URLSearchParams({
    format,
    from,
    to,
  })}`;
}

export function reportExportFilename(
  reportName: string,
  format: ReportExportFormat,
  from: string,
  to: string,
) {
  const slug = reportName
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("es-DO")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `${slug || "reporte"}-${from}-a-${to}.${format}`;
}
