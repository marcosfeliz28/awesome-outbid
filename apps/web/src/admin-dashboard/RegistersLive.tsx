import "./RegistersLive.css";

export type LiveCashSession = {
  id: string;
  userName?: string | null;
  registerName?: string | null;
  openedAt: string | Date;
  closedAt?: string | Date | null;
  expected?: {
    cash?: number | string | null;
  } | null;
};

export type RegistersLiveProps = {
  sessions: readonly LiveCashSession[];
  deliveryThreshold?: number | null;
  now?: Date;
};

const money = new Intl.NumberFormat("es-DO", {
  style: "currency",
  currency: "DOP",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function formatOpenDuration(openedAt: string | Date, now = new Date()) {
  const opened = new Date(openedAt).getTime();
  if (!Number.isFinite(opened)) return "Tiempo no disponible";

  const totalMinutes = Math.max(
    0,
    Math.floor((now.getTime() - opened) / 60_000),
  );
  const days = Math.floor(totalMinutes / 1_440);
  const hours = Math.floor((totalMinutes % 1_440) / 60);
  const minutes = totalMinutes % 60;

  if (days > 0) return `${days} d ${hours} h`;
  if (hours > 0) return `${hours} h ${minutes} min`;
  return `${minutes} min`;
}

function expectedCash(session: LiveCashSession) {
  if (!session.expected || !("cash" in session.expected)) return null;
  const raw = session.expected.cash;
  if (raw === null || raw === undefined || raw === "") return null;
  const value = Number(raw);
  return Number.isFinite(value) ? value : null;
}

export function RegistersLive({
  sessions,
  deliveryThreshold = null,
  now = new Date(),
}: RegistersLiveProps) {
  const openSessions = sessions.filter((session) => !session.closedAt);
  const countLabel = `${openSessions.length} ${
    openSessions.length === 1 ? "caja abierta" : "cajas abiertas"
  }`;
  const threshold = Number(deliveryThreshold);
  const hasThreshold =
    deliveryThreshold !== null && Number.isFinite(threshold) && threshold > 0;

  return (
    <section className="registers-live" aria-labelledby="registers-live-title">
      <header className="registers-live__header">
        <div>
          <p className="registers-live__eyebrow">Operación actual</p>
          <h2 id="registers-live-title">Cajas en vivo</h2>
        </div>
        <span className="registers-live__count" aria-label={countLabel}>
          {openSessions.length}{" "}
          {openSessions.length === 1 ? "abierta" : "abiertas"}
        </span>
      </header>

      {openSessions.length === 0 ? (
        <p className="registers-live__empty" role="status">
          No hay cajas abiertas ahora.
        </p>
      ) : (
        <ul className="registers-live__list" aria-label="Cajas abiertas">
          {openSessions.map((session) => {
            const cash = expectedCash(session);
            const suggestDelivery =
              cash !== null && hasThreshold && cash > threshold;
            const openedAt = new Date(session.openedAt);
            const validOpenedAt = Number.isFinite(openedAt.getTime());

            return (
              <li className="registers-live__item" key={session.id}>
                <article className="registers-live__session">
                  <div className="registers-live__identity">
                    <h3>{session.userName?.trim() || "Cajera sin nombre"}</h3>
                    {session.registerName ? (
                      <p>{session.registerName}</p>
                    ) : null}
                  </div>

                  <dl className="registers-live__details">
                    <div>
                      <dt>Tiempo abierta</dt>
                      <dd>
                        <time
                          dateTime={
                            validOpenedAt ? openedAt.toISOString() : undefined
                          }
                        >
                          {formatOpenDuration(session.openedAt, now)}
                        </time>
                      </dd>
                    </div>
                    {cash !== null ? (
                      <div>
                        <dt>Efectivo esperado</dt>
                        <dd data-private-value>{money.format(cash)}</dd>
                      </div>
                    ) : null}
                  </dl>

                  {suggestDelivery ? (
                    <p className="registers-live__delivery-note" role="status">
                      Conviene una entrega
                    </p>
                  ) : null}
                </article>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
