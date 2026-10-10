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

const when = (value: string) =>
  new Intl.DateTimeFormat("es-DO", {
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
      ? (["neutral", "No configurado"] as const)
      : data.running
        ? (["violet", "Respaldando…"] as const)
        : data.needsReconnect
          ? (["danger", "Hay que reconectar"] as const)
          : !data.connected
            ? (["neutral", "Sin conectar"] as const)
            : data.lastRun?.status === "failed"
              ? (["danger", "Último intento falló"] as const)
              : (["success", "Conectado"] as const);

  return (
    <section className="drive-card" aria-labelledby="drive-title">
      <div className="panel-heading">
        <h3 id="drive-title">Respaldo diario a Google Drive</h3>
        {badge && <Badge tone={badge[0]}>{badge[1]}</Badge>}
      </div>
      <p>
        Cada madrugada (3:30) se guarda una copia completa y cifrada de la base
        de datos en tu Google Drive, en la carpeta «Nexora POS respaldos». Se
        guardan los últimos 30 días y una copia de cada uno de los últimos 12
        meses.
      </p>
      {status.isError && (
        <p className="drive-error" role="alert">
          No se pudo leer el estado del respaldo. Recarga la página.
        </p>
      )}
      {data && !data.configured && (
        <>
          <p>
            Falta configurarlo en el servidor. Pide a quien instaló Nexora que
            siga la guía «Respaldo diario a Google Drive»
            (docs/RESPALDO_DRIVE.md).
          </p>
          {/* 05-N10: los nombres de variables y la dirección de regreso son
              para el técnico; plegados, no ocupan la pantalla de la dueña. */}
          <details className="drive-details">
            <summary>Detalle para el técnico</summary>
            <p>Falta: {data.missing.join(", ")}.</p>
            <p>
              Dirección de regreso para Google:{" "}
              <code className="drive-code">{data.redirectUri}</code>
            </p>
          </details>
        </>
      )}
      {data?.configured && (
        <div className="drive-state" aria-live="polite">
          {data.needsReconnect && (
            <p className="drive-error" role="alert">
              Google retiró el permiso para guardar los respaldos. Pulsa
              «Conectar con Google» otra vez.
            </p>
          )}
          {data.connected && data.account && (
            <p>
              Cuenta de Google: <strong>{data.account}</strong>
            </p>
          )}
          {data.running && (
            <p>
              <strong>Respaldando ahora…</strong> Tarda unos minutos; puedes
              seguir trabajando.
            </p>
          )}
          {data.lastSuccess ? (
            <p>
              Último respaldo bueno:{" "}
              <strong>{when(data.lastSuccess.at)}</strong>
              {data.lastSuccess.size
                ? ` · ${sizeLabel(data.lastSuccess.size)}`
                : ""}
            </p>
          ) : (
            data.connected && <p>Todavía no hay ningún respaldo.</p>
          )}
          {data.lastRun?.status === "failed" && (
            <p className="drive-error">
              El último intento ({when(data.lastRun.at)}) falló:{" "}
              {data.lastRun.error}
            </p>
          )}
          {data.lastRun?.status === "success" && data.lastRun.error && (
            <p className="drive-warning">{data.lastRun.error}</p>
          )}
          {data.connected && data.nextRunAt && !data.running && (
            <p>Próximo respaldo automático: {when(data.nextRunAt)}</p>
          )}
          {data.connected && (
            <p>
              {data.telegramAlerts
                ? "Si falla varias veces seguidas, te avisamos por Telegram."
                : "Consejo: activa los avisos por Telegram para enterarte si un respaldo falla."}
            </p>
          )}
        </div>
      )}
      {data?.configured && (
        <div className="drive-actions">
          {!data.connected ? (
            <Button onClick={connect} disabled={!!busy}>
              {busy === "connect" ? "Abriendo Google…" : "Conectar con Google"}
            </Button>
          ) : (
            <>
              <Button onClick={runNow} disabled={!!busy || data.running}>
                {busy === "run" || data.running
                  ? "Respaldando…"
                  : "Respaldar ahora"}
              </Button>
              <Button
                variant="ghost"
                onClick={() => setConfirming(true)}
                disabled={!!busy}
              >
                Desconectar
              </Button>
            </>
          )}
        </div>
      )}
      {confirming && (
        <Modal
          open
          title="¿Desconectar Google Drive?"
          onClose={() => setConfirming(false)}
        >
          <p>
            Se dejarán de hacer respaldos diarios. Las copias que ya están en tu
            Google Drive no se borran.
          </p>
          <div className="drive-actions">
            <Button
              variant="danger"
              onClick={disconnect}
              disabled={busy === "disconnect"}
            >
              {busy === "disconnect" ? "Desconectando…" : "Sí, desconectar"}
            </Button>
            <Button variant="secondary" onClick={() => setConfirming(false)}>
              Cancelar
            </Button>
          </div>
        </Modal>
      )}
    </section>
  );
}
