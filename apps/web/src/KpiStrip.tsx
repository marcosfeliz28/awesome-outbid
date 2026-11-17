import { t, useLanguage, money, invoiceLabel } from "./inicioLanguage";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { can } from "@fitstore/shared";
import { api, useStore } from "./api";
import { buildKpis } from "./kpiStripModel";
import { today } from "./helpers";
import { CountUp } from "./impacto";

// Día de negocio que se actualiza solo (copia de useBusinessDay de ExecutiveDashboard).
function useBusinessDay() {
  const [date, setDate] = useState(today);
  useEffect(() => {
    const timer = setInterval(() => setDate(today()), 30000);
    return () => clearInterval(timer);
  }, []);
  return date;
}

export function KpiStrip() {
  useLanguage();
  const user = useStore((s) => s.user)!;
  const date = useBusinessDay();
  const day = useQuery({
    queryKey: ["dashboard-day", date],
    queryFn: () => api("/dashboard/summary?from=" + date + "&to=" + date),
    enabled: can(user.permissions, "reports:read"),
  });
  const sessions = useQuery<any[]>({
    queryKey: ["cash-sessions"],
    queryFn: () => api("/cash-sessions"),
    enabled: can(user.permissions, "cash:write"),
  });
  const kpis = buildKpis({
    day: day.data,
    sessions: sessions.data,
    dayStatus: day.status,
  });
  return (
    <section aria-label={t("Resumen de hoy")} className="kpi-strip">
      {kpis.map((k) => (
        <article key={k.key} className="kpi-strip-card">
          <h2>{t(k.label)}</h2>
          <strong className="amount">
            <CountUp text={k.key === "ventas" && day.data ? money(Number(day.data.revenue ?? 0)) : k.value} />
          </strong>
          <small>{k.note.endsWith(" facturas") ? invoiceLabel(Number(day.data?.invoices ?? 0)) : t(k.note)}</small>
        </article>
      ))}
    </section>
  );
}
