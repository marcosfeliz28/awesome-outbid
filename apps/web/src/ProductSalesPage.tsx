import "./productSalesPage.css";

type SalesPlan = {
  name: string;
  monthly: string;
  annual: string;
  inclusions: [string, string, string, string];
  featured?: boolean;
};

const plans: SalesPlan[] = [
  {
    name: "Autoservicio",
    monthly: "RD$1,250",
    annual: "RD$12,500",
    inclusions: [
      "1 sucursal",
      "1 caja",
      "2 usuarios",
      "100 preguntas de IA al mes",
    ],
  },
  {
    name: "Básico",
    monthly: "RD$2,000",
    annual: "RD$20,000",
    inclusions: [
      "1 sucursal",
      "2 cajas",
      "3 usuarios",
      "250 preguntas de IA al mes",
    ],
  },
  {
    name: "Pro",
    monthly: "RD$4,000",
    annual: "RD$40,000",
    inclusions: [
      "2 sucursales",
      "6 cajas",
      "10 usuarios",
      "600 preguntas de IA al mes",
    ],
    featured: true,
  },
  {
    name: "Premium",
    monthly: "RD$7,000",
    annual: "RD$70,000",
    inclusions: [
      "5 sucursales",
      "20 cajas",
      "30 usuarios",
      "1,500 preguntas de IA al mes",
    ],
  },
];

export function ProductSalesPage() {
  return (
    <main className="sales-page">
      <a className="sales-skip-link" href="#planes">
        Ir a los planes
      </a>

      <header className="sales-header">
        <a
          className="sales-brand"
          href="#inicio"
          aria-label="Nexora POS, inicio"
        >
          <span aria-hidden="true">N</span>
          <strong>Nexora POS</strong>
        </a>
        <a className="sales-login-link" href="/entrar">
          Entrar
        </a>
      </header>

      <section className="sales-hero" id="inicio" aria-labelledby="sales-title">
        <p className="sales-eyebrow">Punto de venta para tu negocio</p>
        <h1 id="sales-title">
          Elige el plan de Nexora POS que se ajuste a tu etapa
        </h1>
        <p className="sales-lead">
          Estamos en un piloto por invitación. El registro público aún está
          cerrado y cada activación se coordina de forma manual.
        </p>
        <div className="sales-hero-actions">
          <a
            className="sales-button sales-button-primary"
            href="#proceso-piloto"
          >
            Ver cómo participar
          </a>
          <a className="sales-button sales-button-secondary" href="/entrar">
            Ya tengo acceso
          </a>
        </div>
      </section>

      <section
        className="sales-plans-section"
        id="planes"
        aria-labelledby="plans-title"
      >
        <div className="sales-section-heading">
          <p className="sales-eyebrow">
            Precios mensuales en pesos dominicanos
          </p>
          <h2 id="plans-title">Cuatro planes para distintas etapas</h2>
          <p>
            Al pagar el año recibes 2 meses gratis: pagas el equivalente a 10
            meses.
          </p>
        </div>

        <div className="sales-plans-grid">
          {plans.map((plan) => (
            <article
              className={`sales-plan-card${plan.featured ? " sales-plan-card-featured" : ""}`}
              data-plan={plan.name.toLowerCase()}
              key={plan.name}
            >
              {plan.featured ? (
                <p className="sales-plan-label">Opción destacada</p>
              ) : null}
              <h3>{plan.name}</h3>
              <p className="sales-plan-price">
                <strong>{plan.monthly}</strong>
                <span>/mes</span>
              </p>
              <p className="sales-plan-annual">
                <span>Pago anual</span>
                <strong>{plan.annual}</strong>
                <small>2 meses gratis</small>
              </p>
              <ul
                className="sales-plan-inclusions"
                aria-label={`Incluye el plan ${plan.name}`}
              >
                {plan.inclusions.map((inclusion) => (
                  <li key={inclusion}>{inclusion}</li>
                ))}
              </ul>
              <a
                className="sales-button sales-button-card"
                href="#proceso-piloto"
              >
                Ver proceso del piloto
              </a>
            </article>
          ))}
        </div>
      </section>

      <section
        className="sales-info-grid"
        aria-label="Pago y uso de inteligencia artificial"
      >
        <article className="sales-info-card">
          <p className="sales-card-kicker">Pago manual</p>
          <h2>Transferencia o efectivo</h2>
          <p>
            Durante el piloto, el pago se coordina y se confirma manualmente.
            Esta página no procesa tarjetas ni utiliza una pasarela de pago.
          </p>
          <p className="sales-note">
            No envíes dinero hasta recibir las instrucciones del proceso de
            invitación.
          </p>
        </article>

        <article
          className="sales-info-card"
          aria-labelledby="ai-packages-title"
        >
          <p className="sales-card-kicker">Uso adicional de IA</p>
          <h2 id="ai-packages-title">Paquetes de preguntas</h2>
          <ul className="sales-ai-packages">
            <li>
              <strong>100 preguntas</strong>
              <span>RD$399</span>
            </li>
            <li>
              <strong>300 preguntas</strong>
              <span>RD$999</span>
            </li>
          </ul>
          <p className="sales-note">
            Si agotas las preguntas incluidas, solo se pausa la IA. Las demás
            funciones de Nexora POS continúan disponibles según tu plan.
          </p>
        </article>
      </section>

      <section
        className="sales-process"
        id="proceso-piloto"
        aria-labelledby="pilot-title"
      >
        <div>
          <p className="sales-eyebrow">Proceso transparente</p>
          <h2 id="pilot-title">El piloto funciona por invitación</h2>
        </div>
        <ol>
          <li>
            <span>1</span>
            <p>
              <strong>Revisa los planes.</strong> Elige la opción que quieres
              evaluar.
            </p>
          </li>
          <li>
            <span>2</span>
            <p>
              <strong>Espera la invitación.</strong> El registro público todavía
              no está abierto.
            </p>
          </li>
          <li>
            <span>3</span>
            <p>
              <strong>Coordina el pago.</strong> La transferencia o el efectivo
              se confirman manualmente antes de activar el plan.
            </p>
          </li>
        </ol>
        <a className="sales-button sales-button-primary" href="/entrar">
          Entrar si ya fui invitado
        </a>
      </section>

      <footer className="sales-footer">
        <strong>Nexora POS</strong>
        <p>Registro público cerrado durante el piloto por invitación.</p>
        <a href="/entrar">Acceso de clientes</a>
      </footer>
    </main>
  );
}
