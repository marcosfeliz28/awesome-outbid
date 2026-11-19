// Respaldo diario a Google Drive (docs/RESPALDO_DRIVE.md): tarjeta de
// Configuración, sólo para la administración. El permiso de Google y la frase
// de cifrado viven en el servidor; aquí sólo se ve el estado y se pulsan los
// botones Conectar, Respaldar ahora y Desconectar.
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Badge, Button, Modal } from "@fitstore/ui";
import { can } from "@fitstore/shared";
import { api, post, useStore } from "./api";
import { toast } from "./helpers";
import "./driveBackup.css";
import { useLanguage } from "./inicioLanguage";

export type DriveBackupStatus = {
  configured: boolean;
  missing: string[];
  redirectUri: string;
  folderName: string;
  connected: boolean;
  needsReconnect: boolean;
  account: string | null;
  running: boolean;
  lastRun: {
    at: string;
    trigger: "schedule" | "manual" | null;
    status: "success" | "failed" | null;
    error: string | null;
  } | null;
  lastSuccess: {
    at: string;
    size: number | null;
    fileName: string | null;
  } | null;
  consecutiveFailures: number;
  nextRunAt: string | null;
  telegramAlerts: boolean;
};

/** Mensaje al volver de Google (?drive=… en la dirección). */
export const DRIVE_RESULT: Record<string, [string, boolean]> = {
  connected: [
    "Google Drive quedó conectado. El respaldo se hará solo cada madrugada; si quieres, pulsa «Respaldar ahora».",
    false,
  ],
  denied: ["Cancelaste el permiso en Google. No se conectó nada.", true],
  invalid: [
    "El enlace de Google caducó o no es válido. Pulsa «Conectar con Google» otra vez.",
    true,
  ],
  scope: [
    "Falta marcar el permiso de Google Drive en la pantalla de Google. Inténtalo otra vez y marca la casilla.",
    true,
  ],
  error: [
    "Google no completó la conexión. Inténtalo de nuevo en unos minutos.",
    true,
  ],
  unconfigured: [
    "El respaldo a Google Drive no está configurado en el servidor.",
    true,
  ],
};

const when = (value: string, en = false) =>
  new Intl.DateTimeFormat(en ? "en-US" : "es-DO", {
    timeZone: "America/Santo_Domingo",
    day: "numeric",
    month: "long",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));

export function sizeLabel(bytes: number | null | undefined) {
  if (!bytes && bytes !== 0) return "";
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
  return `${(bytes / 1024 ** 3).toFixed(2)} GB`;
}

export function DriveBackupCard() {
  const user = useStore((s) => s.user)!;
  return can(user.permissions, "*") ? <DriveBackupPanel /> : null;
}

function DriveBackupPanel() {
  const en = useLanguage() === "en";
  const client = useQueryClient();
  const [busy, setBusy] = useState("");
  const [confirming, setConfirming] = useState(false);
  const status = useQuery({
    queryKey: ["drive-backup-status"],
    queryFn: () => api<DriveBackupStatus>("/backups/status"),
    refetchInterval: (query) =>
      (query.state.data as DriveBackupStatus | undefined)?.running
        ? 4000
        : 30000,
  });
  const data = status.data;

  // Vuelta desde Google: se avisa una vez y se limpia la dirección.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const result = params.get("drive");
    if (!result) return;
    const [message, error] = DRIVE_RESULT[result] ?? DRIVE_RESULT.error!;
    toast(message, error);
    params.delete("drive");
    const search = params.toString();
    window.history.replaceState(
      null,
      "",
      window.location.pathname +
        (search ? "?" + search : "") +
        window.location.hash,
    );
  }, []);

  const refresh = () =>
    client.invalidateQueries({ queryKey: ["drive-backup-status"] });
  const connect = async () => {
    setBusy("connect");
    try {
      const r = await api<{ url: string }>("/backups/google/connect");
      window.location.assign(r.url);
    } catch (e: any) {
      toast(e.message, true);
      setBusy("");
    }
  };
  const runNow = async () => {
    setBusy("run");
    try {
      const r = await post<{ message: string }>("/backups/run", {});
      toast(r.message);
    } catch (e: any) {
      toast(e.message, true);
    } finally {
      setBusy("");
      await refresh();
    }
  };
  const disconnect = async () => {
    setBusy("disconnect");
    try {
      await post("/backups/google/disconnect", {});
      toast("Google Drive quedó desconectado. Ya no se harán respaldos.");
    } catch (e: any) {
      toast(e.message, true);
    } finally {
      setBusy("");
      setConfirming(false);
      await refresh();
    }
  };

  const badge = !data
    ? null
    : !data.configured
      ? (["neutral", (en ? "Not configured" : "No configurado")] as const)
      : data.running
        ? (["violet", (en ? "Backing up\u2026" : "Respaldando…")] as const)
        : data.needsReconnect
          ? (["danger", (en ? "Reconnect required" : "Hay que reconectar")] as const)
          : !data.connected
            ? (["neutral", (en ? "Not connected" : "Sin conectar")] as const)
            : data.lastRun?.status === "failed"
              ? (["danger", (en ? "Last attempt failed" : "Último intento falló")] as const)
              : (["success", (en ? "Connected" : "Conectado")] as const);

  return (
    <section className="drive-card" aria-labelledby="drive-title">
      <div className="panel-heading">
        <h3 id="drive-title">{en ? "Daily Google Drive backup" : "Respaldo diario a Google Drive"}</h3>
        {badge && <Badge tone={badge[0]}>{badge[1]}</Badge>}
      </div>
      <p>
        {en ? "Every morning at 3:30, a full encrypted database copy is saved to your Google Drive in the “Nexora POS respaldos” folder. The last 365 days and one monthly copy for 10 years are retained." : "Cada madrugada (3:30) se guarda una copia completa y cifrada de la base\n        de datos en tu Google Drive, en la carpeta «Nexora POS respaldos». Se\n        guardan los últimos 365 días y una copia de cada mes durante 10 años."}
      </p>
      {status.isError && (
        <p className="drive-error" role="alert">
          {en ? "The backup status could not be loaded. Reload the page." : "No se pudo leer el estado del respaldo. Recarga la página."}
        </p>
      )}
      {data && !data.configured && (
        <>
          <p>
            {en ? "Server setup is required. Ask the Norexos installer to follow the daily Google Drive backup guide (docs/RESPALDO_DRIVE.md)." : "Falta configurarlo en el servidor. Pide a quien instaló Norexos que\n            siga la guía «Respaldo diario a Google Drive»\n            (docs/RESPALDO_DRIVE.md)."}
          </p>
          {/* 05-N10: los nombres de variables y la dirección de regreso son
              para el técnico; plegados, no ocupan la pantalla de la dueña. */}
          <details className="drive-details">
            <summary>{en ? "Technical details" : "Detalle para el técnico"}</summary>
            <p>{en ? "Missing:" : "Falta:"} {data.missing.join(", ")}.</p>
            <p>
              {en ? "Google redirect URI:" : "Dirección de regreso para Google:"}{" "}
              <code className="drive-code">{data.redirectUri}</code>
            </p>
          </details>
        </>
      )}
      {data?.configured && (
        <div className="drive-state" aria-live="polite">
          {data.needsReconnect && (
            <p className="drive-error" role="alert">
              {en ? "Google revoked backup permission. Select “Connect with Google” again." : "Google retiró el permiso para guardar los respaldos. Pulsa\n              «Conectar con Google» otra vez."}
            </p>
          )}
          {data.connected && data.account && (
            <p>
              {en ? "Google account:" : "Cuenta de Google:"} <strong>{data.account}</strong>
            </p>
          )}
          {data.running && (
            <p>
              <strong>{en ? "Backing up now…" : "Respaldando ahora…"}</strong> {en ? "This takes a few minutes; you can continue working." : "Tarda unos minutos; puedes\n              seguir trabajando."}
            </p>
          )}
          {data.lastSuccess ? (
            <p>
              {en ? "Last successful backup:" : "Último respaldo bueno:"}{" "}
              <strong>{when(data.lastSuccess.at, en)}</strong>
              {data.lastSuccess.size
                ? ` · ${sizeLabel(data.lastSuccess.size)}`
                : ""}
            </p>
          ) : (
            data.connected && <p>{en ? "No backups yet." : "Todavía no hay ningún respaldo."}</p>
          )}
          {data.lastRun?.status === "failed" && (
            <p className="drive-error">
              {en ? "The last attempt" : "El último intento"} ({when(data.lastRun.at, en)}) {en ? "failed:" : "falló:"}{" "}
              {data.lastRun.error}
            </p>
          )}
          {data.lastRun?.status === "success" && data.lastRun.error && (
            <p className="drive-warning">{data.lastRun.error}</p>
          )}
          {data.connected && data.nextRunAt && !data.running && (
            <p>{en ? "Next automatic backup:" : "Próximo respaldo automático:"} {when(data.nextRunAt, en)}</p>
          )}
          {data.connected && (
            <p>
              {data.telegramAlerts
                ? (en ? "Repeated failures will be reported via Telegram." : "Si falla varias veces seguidas, te avisamos por Telegram.")
                : (en ? "Tip: enable Telegram alerts to be notified if a backup fails." : "Consejo: activa los avisos por Telegram para enterarte si un respaldo falla.")}
            </p>
          )}
        </div>
      )}
      {data?.configured && (
        <div className="drive-actions">
          {!data.connected ? (
            <Button onClick={connect} disabled={!!busy}>
              {busy === "connect" ? (en ? "Opening Google…" : "Abriendo Google…") : (en ? "Connect with Google" : "Conectar con Google")}
            </Button>
          ) : (
            <>
              <Button onClick={runNow} disabled={!!busy || data.running}>
                {busy === "run" || data.running
                  ? (en ? "Backing up…" : "Respaldando…")
                  : (en ? "Back up now" : "Respaldar ahora")}
              </Button>
              <Button
                variant="ghost"
                onClick={() => setConfirming(true)}
                disabled={!!busy}
              >
                {en ? "Disconnect" : "Desconectar"}
              </Button>
            </>
          )}
        </div>
      )}
      {confirming && (
        <Modal
          open
          title={en ? "Disconnect Google Drive?" : "¿Desconectar Google Drive?"}
          closeLabel={en ? "Close" : "Cerrar"}
          onClose={() => setConfirming(false)}
        >
          <p>
            {en ? "Daily backups will stop. Existing copies in your Google Drive will not be deleted." : "Se dejarán de hacer respaldos diarios. Las copias que ya están en tu\n            Google Drive no se borran."}
          </p>
          <div className="drive-actions">
            <Button
              variant="danger"
              onClick={disconnect}
              disabled={busy === "disconnect"}
            >
              {busy === "disconnect" ? (en ? "Disconnecting…" : "Desconectando…") : (en ? "Yes, disconnect" : "Sí, desconectar")}
            </Button>
            <Button variant="secondary" onClick={() => setConfirming(false)}>
              {en ? "Cancel" : "Cancelar"}
            </Button>
          </div>
        </Modal>
      )}
    </section>
  );
}
