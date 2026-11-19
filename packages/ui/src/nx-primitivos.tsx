import { useRef, useState, type ReactNode } from "react";
import { claseVariante as claseBoton, type VarianteBoton } from "./nx-button";
import { claseVariante as claseTarjeta, type VarianteTarjeta } from "./nx-card";
import { atributosCampo } from "./nx-field";
import { claseTono, type TonoEstado } from "./nx-status-badge";
import { atributosVacio } from "./nx-empty-state";
import { claseEsqueleto, type FormaEsqueleto } from "./nx-skeleton";
import { atributosToast, type TipoToast } from "./nx-toast";
import { atributosPestana, indiceTecla } from "./nx-tabs";
import { encabezadoPagina } from "./nx-page-header";
import { porcentajeProgreso } from "./nx-progress";
import { formatDOP } from "./nx-money";
import { regionesApp } from "./nx-app-shell";

/** Los 12 primitivos Nx*: solo envuelven los helpers puros nx-* con las clases y tokens de tokens.css. */

export function NxButton({
  variante = "primary",
  children,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variante?: VarianteBoton;
}) {
  return (
    <button className={claseBoton(variante)} {...props}>
      {children}
    </button>
  );
}

export function NxCard({
  variante = "default",
  children,
}: {
  variante?: VarianteTarjeta;
  children: ReactNode;
}) {
  return <div className={claseTarjeta(variante)}>{children}</div>;
}

export function NxField({
  id,
  label,
  ayuda,
  error,
  ...props
}: Omit<React.InputHTMLAttributes<HTMLInputElement>, "id"> & {
  id: string;
  label: string;
  ayuda?: string;
  error?: string;
}) {
  const a = atributosCampo({ id, ayuda, error });
  return (
    <div className="nx-field">
      <label htmlFor={id}>{label}</label>
      <input
        {...props}
        id={a.id}
        aria-describedby={a["aria-describedby"]}
        aria-invalid={a["aria-invalid"]}
      />
      {ayuda && <small id={a.ayudaId}>{ayuda}</small>}
      {error && (
        <small id={a.errorId} className="nx-field__error">
          {error}
        </small>
      )}
    </div>
  );
}

export function NxBadge({
  tono = "neutro",
  children,
}: {
  tono?: TonoEstado;
  children: ReactNode;
}) {
  return <span className={claseTono(tono)}>{children}</span>;
}

export function NxEmpty({
  titulo,
  texto,
  accion,
}: {
  titulo: string;
  texto: string;
  accion?: ReactNode;
}) {
  const a = atributosVacio({ titulo, texto, accion: "" });
  return (
    <div className="nx-empty" role={a.role}>
      <h3>{titulo}</h3>
      <p>{texto}</p>
      {accion}
    </div>
  );
}

export function NxSkeleton({ forma = "linea" }: { forma?: FormaEsqueleto }) {
  return <span className={claseEsqueleto(forma)} aria-hidden="true" />;
}

export function NxToast({
  tipo,
  children,
}: {
  tipo: TipoToast;
  children: ReactNode;
}) {
  return (
    <div
      className={`nx-toast nx-toast--${tipo}`}
      role={atributosToast(tipo).role}
    >
      {children}
    </div>
  );
}

export function NxTabs({
  etiqueta,
  pestanas,
  inicial = 0,
}: {
  etiqueta: string;
  pestanas: { titulo: string; contenido: ReactNode }[];
  inicial?: number;
}) {
  const [activa, setActiva] = useState(inicial);
  const botones = useRef<(HTMLButtonElement | null)[]>([]);
  const ir = (i: number) => {
    setActiva(i);
    botones.current[i]?.focus();
  };
  return (
    <div className="nx-tabs">
      <div role="tablist" aria-label={etiqueta}>
        {pestanas.map((p, i) => (
          <button
            key={p.titulo}
            ref={(el) => {
              botones.current[i] = el;
            }}
            {...atributosPestana({
              id: `nx-tab-${i}`,
              panelId: `nx-panel-${i}`,
              activo: i === activa,
            })}
            onClick={() => setActiva(i)}
            onKeyDown={(e) => {
              const n = indiceTecla(i, pestanas.length, e.key);
              if (n !== i) {
                e.preventDefault();
                ir(n);
              }
            }}
          >
            {p.titulo}
          </button>
        ))}
      </div>
      <div
        role="tabpanel"
        id={`nx-panel-${activa}`}
        aria-labelledby={`nx-tab-${activa}`}
      >
        {pestanas[activa]?.contenido}
      </div>
    </div>
  );
}

export function NxPageHeader({
  titulo,
  subtitulo,
  acciones,
}: {
  titulo: string;
  subtitulo?: string;
  acciones?: ReactNode;
}) {
  const h = encabezadoPagina({ titulo, subtitulo });
  return (
    <header className="nx-page-header">
      <div>
        <h1>{h.h1}</h1>
        {h.subtitulo && <p>{h.subtitulo}</p>}
      </div>
      {acciones}
    </header>
  );
}

export function NxProgress({
  valor,
  total,
  etiqueta,
}: {
  valor: number;
  total: number;
  etiqueta: string;
}) {
  const pct = porcentajeProgreso(valor, total);
  return (
    <div
      className="nx-progress"
      role="progressbar"
      aria-label={etiqueta}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={pct}
    >
      <span style={{ width: `${pct}%` }} />
    </div>
  );
}

/** Solo da formato: la caja ciega la aplica el servidor, y aquí `null` se muestra como «—». */
export function NxMoney({ valor }: { valor: number | null | undefined }) {
  return (
    <span className="nx-money">{valor == null ? "—" : formatDOP(valor)}</span>
  );
}

export function NxAppShell({
  navegacion,
  encabezado,
  children,
}: {
  navegacion: ReactNode;
  encabezado?: ReactNode;
  children: ReactNode;
}) {
  const r = regionesApp();
  return (
    <div className="nx-app-shell">
      <a className="nx-skip" href={r.saltar.href}>
        {r.saltar.texto}
      </a>
      {encabezado && <div {...r.banner}>{encabezado}</div>}
      <nav aria-label={r.navegacion["aria-label"]}>{navegacion}</nav>
      <main id={r.principal.id} aria-label={r.principal["aria-label"]}>
        {children}
      </main>
    </div>
  );
}
