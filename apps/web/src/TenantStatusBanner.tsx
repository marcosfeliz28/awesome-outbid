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
      className="support-mode-banner"
      style={urgent ? { background: "#7a1f1f", color: "#fff" } : undefined}
    >
      <span>{text}</span>{" "}
      <button type="button" onClick={onPay}>
        Ir a Plan y facturación
      </button>
      {status.data?.status === "suspended" && status.data.supportContact && (
        <span> · Habla con nosotros: {status.data.supportContact}</span>
      )}
    </div>
  );
}
