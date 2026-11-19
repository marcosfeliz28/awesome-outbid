import { useQuery } from "@tanstack/react-query";
import { api } from "./api";

// Avisos de pago (dueña, 19-nov): el servidor decide cuándo toca (2 días antes
// del vencimiento y 2 días después, en mora) y si está suspendido. La
// administración ve el aviso completo; la cajera, uno discreto.
export type TenantStatus = {
  status: "trial" | "active" | "past_due" | "suspended";
  notice: {
    kind: "trial_due_2" | "billing_due_2" | "overdue_2";
    message: string;
  } | null;
  supportContact: string | null;
};

export function tenantBannerText(
  data: TenantStatus | undefined,
  admin: boolean,
): string | null {
  if (!data) return null;
  if (data.status === "suspended") {
    if (!admin)
      return "El sistema está en solo lectura. Avisa a la administración.";
    return "Tu negocio está suspendido: puedes consultar y exportar, pero no vender. Paga en «Plan y facturación» para reactivarlo.";
  }
  if (!data.notice) return null;
  return admin
    ? data.notice.message
    : "Hay un aviso de pago del sistema. Avisa a la administración.";
}

export function TenantStatusBanner({
  admin,
  onPay,
}: {
  admin: boolean;
  onPay: () => void;
}) {
  const status = useQuery<TenantStatus>({
    queryKey: ["tenant-status"],
    queryFn: () => api("/tenant/status"),
    refetchInterval: 15 * 60_000,
  });
  const text = tenantBannerText(status.data, admin);
  if (!text) return null;
  const urgent =
    status.data?.status === "suspended" ||
    status.data?.notice?.kind === "overdue_2";
  if (!admin)
    return (
      <p role="status" className="tenant-status-note">
        {text}
      </p>
    );
  return (
    <div
      role="alert"
      className={`support-mode-banner tenant-status-banner${urgent ? " tenant-status-banner--urgent" : ""}`}
    >
      <div className="tenant-status-banner__content">
        <strong className="tenant-status-banner__eyebrow">
          Atención de facturación
        </strong>
        <span className="tenant-status-banner__message">{text}</span>
        {status.data?.supportContact && (
          <span className="tenant-status-banner__contact">
            Habla con nosotros: {status.data.supportContact}
          </span>
        )}
      </div>
      <button
        type="button"
        className="button primary tenant-status-banner__action"
        onClick={onPay}
      >
        Ir a Plan y facturación
      </button>
    </div>
  );
}
