import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { can } from "@fitstore/shared";
import { api, useStore } from "./api";
import { buildKpis } from "./kpiStripModel";
import { today } from "./helpers";

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
    showProfit: can(user.permissions, "profit:read"),
  });
  return (
    <section aria-label="Resumen de hoy" className="kpi-strip">
      {kpis.map((k) => (
        <article key={k.key} className="kpi-strip-card">
          <h2>{k.label}</h2>
          <strong className="amount">{k.value}</strong>
          <small>{k.note}</small>
        </article>
      ))}
    </section>
  );
}
