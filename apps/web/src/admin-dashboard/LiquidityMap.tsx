import { Banknote, HandCoins, Landmark, MapPin } from "lucide-react";
import "./LiquidityMap.css";

export type LiquiditySnapshot = {
  asOf: string;
  pockets: {
    drawers: { amount: string; openRegisters: number; basis: string };
    owner: { amount: string; basis: string };
    banks: {
      verified: string;
      pending: string;
      verifiedBasis: string;
      pendingBasis: string;
    };
    street: {
      cod: string;
      credit: string;
      unclassified: string;
      basis: string;
    };
  };
};

export const formatLiquidityMoney = (amount: string) =>
  new Intl.NumberFormat("es-DO", {
    style: "currency",
    currency: "DOP",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(amount));

const Amount = ({ value }: { value: string }) => (
  <strong className="liquidity-amount" data-private-value>
    {formatLiquidityMoney(value)}
  </strong>
);

export function LiquidityMap({
  data,
  busy = false,
  error = null,
}: {
  data?: LiquiditySnapshot;
  busy?: boolean;
  error?: string | null;
}) {
  return (
    <article
      className="admin-card liquidity-map"
      aria-labelledby="liquidity-title"
    >
      <header className="liquidity-heading">
        <span className="admin-card-icon" aria-hidden="true">
          <MapPin size={20} />
        </span>
        <div>
          <h2 id="liquidity-title">Mapa de liquidez</h2>
          <p>Cuatro lugares donde está o falta confirmar el dinero.</p>
        </div>
      </header>

      {busy ? (
        <p className="liquidity-state" role="status">
          Calculando los bolsillos…
        </p>
      ) : error ? (
        <p className="liquidity-state liquidity-error" role="alert">
          {error}
        </p>
      ) : !data ? (
        <p className="liquidity-state">No hay datos disponibles.</p>
      ) : (
        <div className="liquidity-grid">
          <section
            className="liquidity-pocket"
            aria-labelledby="liquidity-drawers"
          >
            <Banknote aria-hidden="true" />
            <div>
              <h3 id="liquidity-drawers">En gavetas</h3>
              <Amount value={data.pockets.drawers.amount} />
              <p>{data.pockets.drawers.basis}</p>
              <small>
                {data.pockets.drawers.openRegisters}{" "}
                {data.pockets.drawers.openRegisters === 1
                  ? "caja abierta"
                  : "cajas abiertas"}
              </small>
            </div>
          </section>

          <section
            className="liquidity-pocket"
            aria-labelledby="liquidity-owner"
          >
            <HandCoins aria-hidden="true" />
            <div>
              <h3 id="liquidity-owner">Recibido por la dueña hoy</h3>
              <Amount value={data.pockets.owner.amount} />
              <p>{data.pockets.owner.basis}</p>
            </div>
          </section>

          <section
            className="liquidity-pocket"
            aria-labelledby="liquidity-banks"
          >
            <Landmark aria-hidden="true" />
            <div>
              <h3 id="liquidity-banks">Transferencias bancarias</h3>
              <dl>
                <div>
                  <dt>Verificadas hoy</dt>
                  <dd>
                    <Amount value={data.pockets.banks.verified} />
                  </dd>
                </div>
                <div>
                  <dt>Por verificar</dt>
                  <dd>
                    <Amount value={data.pockets.banks.pending} />
                  </dd>
                </div>
              </dl>
              <p>{data.pockets.banks.verifiedBasis}</p>
              <small>{data.pockets.banks.pendingBasis}</small>
            </div>
          </section>

          <section
            className="liquidity-pocket"
            aria-labelledby="liquidity-street"
          >
            <MapPin aria-hidden="true" />
            <div>
              <h3 id="liquidity-street">En la calle</h3>
              <dl>
                <div>
                  <dt>Contraentregas</dt>
                  <dd>
                    <Amount value={data.pockets.street.cod} />
                  </dd>
                </div>
                <div>
                  <dt>Créditos</dt>
                  <dd>
                    <Amount value={data.pockets.street.credit} />
                  </dd>
                </div>
                <div>
                  <dt>Crédito / contraentrega histórico</dt>
                  <dd>
                    <Amount value={data.pockets.street.unclassified} />
                  </dd>
                </div>
              </dl>
              <p>{data.pockets.street.basis}</p>
            </div>
          </section>
        </div>
      )}

      {data && (
        <p className="liquidity-note">
          No sumes estos bolsillos como un total. Los abonos por transferencia
          pendientes se separan de la cuenta por cobrar.
        </p>
      )}
    </article>
  );
}
