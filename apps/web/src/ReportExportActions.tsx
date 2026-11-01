import { useState } from "react";
import { Download, LoaderCircle } from "lucide-react";
import { Button } from "@fitstore/ui";
import { download, DOWNLOAD_FAILED } from "./api";
import {
  buildReportExportPath,
  reportExportFilename,
  type ReportExportFormat,
} from "./report-export-utils";

export { buildReportExportPath, reportExportFilename } from "./report-export-utils";

// El motor nuevo pertenece a la pieza A. Hasta que esa rama esté integrada, la
// pantalla conserva la descarga anterior cuando existe y no llama una ruta que
// aún no está publicada.
const enhancedExportsEnabled =
  import.meta.env.VITE_REPORT_EXPORTS_V1 === "true";

type Props = {
  reportId: string;
  reportName: string;
  from: string;
  to: string;
  hasData?: boolean;
  /** Ruta anterior disponible mientras el exportador v1 no esté integrado. */
  legacyPath?: (format: ReportExportFormat) => string | null;
};

export function ReportExportActions({
  reportId,
  reportName,
  from,
  to,
  hasData = true,
  legacyPath,
}: Props) {
  const [busy, setBusy] = useState<ReportExportFormat | null>(null);
  const [error, setError] = useState("");
  const canUseLegacy = Boolean(legacyPath);

  const exportReport = async (format: ReportExportFormat) => {
    if (!hasData) return;
    const path = enhancedExportsEnabled
      ? buildReportExportPath(reportId, format, from, to)
      : legacyPath?.(format) ?? null;
    if (!path) {
      setError(
        "La exportación mejorada de este informe se habilitará al actualizar el sistema.",
      );
      return;
    }
    setBusy(format);
    setError("");
    try {
      await download(path, reportExportFilename(reportName, format, from, to));
    } catch (caught: any) {
      setError(
        caught?.message !== DOWNLOAD_FAILED
          ? caught?.message || "No se pudo preparar el archivo."
          : "No se pudo descargar el archivo. Revisa las fechas y tu conexión e inténtalo de nuevo.",
      );
    } finally {
      setBusy(null);
    }
  };

  const unavailable = !hasData || (!enhancedExportsEnabled && !canUseLegacy);
  const hint = !hasData
    ? "No hay datos para exportar con estos filtros."
    : !enhancedExportsEnabled && !canUseLegacy
      ? "La exportación estará disponible cuando el motor de informes se actualice."
      : "El archivo usará exactamente el período seleccionado.";

  return (
    <div className="report-export" aria-label={`Exportar ${reportName}`}>
      <div className="report-export-actions">
        {(["pdf", "xlsx"] as const).map((format) => (
          <Button
            variant="secondary"
            key={format}
            disabled={unavailable || busy !== null}
            aria-label={`Descargar ${reportName} en ${format === "xlsx" ? "Excel" : "PDF"}`}
            onClick={() => exportReport(format)}
          >
            {busy === format ? (
              <LoaderCircle className="spin" size={16} aria-hidden="true" />
            ) : (
              <Download size={16} aria-hidden="true" />
            )}
            {busy === format
              ? `Preparando ${format === "xlsx" ? "Excel" : "PDF"}…`
              : format === "xlsx"
                ? "Excel"
                : "PDF"}
          </Button>
        ))}
      </div>
      <p className="report-export-hint" role="status" aria-live="polite">
        {hint}
      </p>
      {error && (
        <p className="report-export-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
