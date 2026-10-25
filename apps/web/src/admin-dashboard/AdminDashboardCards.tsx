import { useQuery, useQueryClient } from "@tanstack/react-query";
import { can } from "@fitstore/shared";
import { api, post, useStore } from "../api";
import { toast } from "../helpers";
import { ApprovalDeck, type ApprovalDeckItem } from "./ApprovalDeck";
import { AnomalyScanner, type AuditFact } from "./AnomalyScanner";
import { LiquidityMap, type LiquiditySnapshot } from "./LiquidityMap";
import { PrivacyToggle } from "./PrivacyToggle";
import { RegistersLive, type LiveCashSession } from "./RegistersLive";
import type { AdminTheme } from "./preferences";
import "./themes.css";

type VoidDto = {
  id: string;
  requestedAt: string;
  reason: string;
  requester: { name: string };
  approvalBlocker?: string | null;
  sale: { id: string; number: string };
};

type TransferDto = {
  id: string;
  saleId: string;
  date: string;
  invoice: string;
  customer?: string | null;
  amount: string;
  bank?: string | null;
  reference?: string | null;
};

const refreshKeys = async (
  client: ReturnType<typeof useQueryClient>,
  keys: string[],
) => {
  await Promise.all(
    keys.map((key) => client.invalidateQueries({ queryKey: [key] })),
  );
};

export function AdminDashboardCards({
  go,
  theme,
}: {
  go: (page: string) => void;
  theme: AdminTheme;
}) {
  const user = useStore((state) => state.user)!;
  const client = useQueryClient();
  const isOwner = can(user.permissions, "*");
  const canSeeReports = can(user.permissions, "reports:read");
  const canSeeRegisters = canSeeReports && can(user.permissions, "cash:write");

  const settings = useQuery<any>({
    queryKey: ["settings", user.branchId],
    queryFn: () => api("/settings"),
    enabled: canSeeRegisters,
  });
  const sessions = useQuery<LiveCashSession[]>({
    queryKey: ["cash-sessions"],
    queryFn: () => api("/cash-sessions"),
    enabled: canSeeRegisters,
  });
  const voids = useQuery<VoidDto[]>({
    queryKey: ["void-requests", "pending"],
    queryFn: () => api("/void-requests?status=pending"),
    enabled: isOwner,
  });
  const transfers = useQuery<TransferDto[]>({
    queryKey: ["pending-transfers"],
    queryFn: () => api("/payments/pending-transfers"),
    enabled: isOwner,
  });
  const liquidity = useQuery<LiquiditySnapshot>({
    queryKey: ["dashboard-liquidity"],
    queryFn: () => api("/dashboard/liquidity"),
    enabled: isOwner,
  });
  const audit = useQuery<AuditFact[]>({
    queryKey: ["audit-log", "today"],
    queryFn: () => api("/audit-log"),
    enabled: isOwner,
  });

  if (!canSeeReports) return null;

  const voidRequests = (voids.data ?? []).map((row) => ({
    id: row.id,
    invoice: row.sale.number,
    requestedAt: row.requestedAt,
    requestedBy: row.requester.name,
    reason: row.reason,
    approvalBlocker: row.approvalBlocker,
  }));
  const pendingTransfers = (transfers.data ?? []).map((row) => ({
    id: row.id,
    invoice: row.invoice,
    createdAt: row.date,
    customer: row.customer,
    amount: row.amount,
    bank: row.bank,
    reference: row.reference,
  }));

  const openDetail = (item: ApprovalDeckItem) =>
    go(item.kind === "void" ? "void-requests" : "transfer-reconciliation");

  return (
    <section
      className="admin-dashboard"
      data-admin-theme={theme}
      aria-label="Centro de administración"
    >
      <div className="admin-dashboard-grid">
        <PrivacyToggle />
        {canSeeRegisters && (
          <RegistersLive
            sessions={sessions.data ?? []}
            deliveryThreshold={settings.data?.cashDeliveryThreshold ?? null}
          />
        )}
        {isOwner && (
          <>
            <ApprovalDeck
              voidRequests={voidRequests}
              pendingTransfers={pendingTransfers}
              onOpenDetail={openDetail}
              onApproveVoid={async (item) => {
                await post(`/void-requests/${item.id}/approve`, {});
                await refreshKeys(client, [
                  "void-requests",
                  "dashboard-liquidity",
                  "audit-log",
                ]);
                toast("Venta anulada y solicitud aprobada.");
              }}
              onRejectVoid={async (item, input) => {
                await post(`/void-requests/${item.id}/reject`, input);
                await refreshKeys(client, ["void-requests", "audit-log"]);
                toast("Solicitud de anulación rechazada.");
              }}
              onVerifyTransfer={async (item) => {
                await post(`/payments/${item.id}/verify`, {});
                await refreshKeys(client, [
                  "pending-transfers",
                  "dashboard-liquidity",
                  "audit-log",
                ]);
                toast("Transferencia verificada.");
              }}
              onRejectTransfer={async (item, input) => {
                await post(`/payments/${item.id}/reject`, input);
                await refreshKeys(client, [
                  "pending-transfers",
                  "dashboard-liquidity",
                  "audit-log",
                ]);
                toast("Transferencia rechazada.");
              }}
            />
            <LiquidityMap
              data={liquidity.data}
              busy={liquidity.isPending}
              error={liquidity.error?.message ?? null}
            />
            <AnomalyScanner
              rows={audit.data ?? []}
              busy={audit.isPending}
              onOpenSale={(saleId) => {
                try {
                  sessionStorage.setItem("nexora-open-sale-id", saleId);
                } catch {
                  // La lista de ventas sigue disponible aunque storage falle.
                }
                go("sales");
              }}
            />
          </>
        )}
      </div>
    </section>
  );
}
