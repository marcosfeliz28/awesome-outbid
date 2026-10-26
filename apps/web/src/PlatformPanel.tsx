// Panel de la operadora de Nexora POS (/plataforma). Vive fuera de la interfaz de
// las empresas: no usa su sesión ni su navegación, solo el token de plataforma.
import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@fitstore/ui";
import { SUPPORT_TOKEN_KEY } from "./api";

const TOKEN_KEY = "nexora-plataforma-token";
const DAY = 86400000;

// Solo sessionStorage: el token muere al cerrar la pestaña. Nunca localStorage.
export function readPlatformToken() {
  try {
    return sessionStorage.getItem(TOKEN_KEY) ?? "";
  } catch {
    return "";
  }
}
function savePlatformToken(token: string) {
  try {
    if (token) sessionStorage.setItem(TOKEN_KEY, token);
    else sessionStorage.removeItem(TOKEN_KEY);
  } catch {
    /* sin almacenamiento: el token vive solo en memoria */
  }
}

type Status = "trial" | "active" | "past_due" | "suspended";
type Tenant = {
  id: string;
  slug: string;
  name: string;
  plan: string;
  status: Status;
  trialEndsAt: string | null;
  paidUntil: string | null;
  createdAt: string;
};
type Detail = Tenant & {
  businessType: string;
  admin: {
    name: string;
    email: string;
    invitationPending: boolean;
    invitationExpiresAt: string | null;
  } | null;
};
type Summary = {
  total: number;
  alDia: number;
  enPrueba: number;
  porVencer: number;
  atrasados: number;
  suspendidos: number;
  month: string;
  monthIncome: number;
  monthPayments?: number;
  monthAiPacks?: number;
};
type Usage = {
  used: number;
  limit: number;
  packs: number;
  planQuota: number;
  month: string;
};
type Payment = {
  id: string;
  amount: string;
  method: string;
  reference: string;
  months: number;
  paidUntil: string;
  createdAt: string;
  voidsPaymentId?: string | null;
  voidReason?: string | null;
};

class PlatformError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

async function platformFetch<T>(
  token: string,
  path: string,
  body?: object,
): Promise<T> {
  const response = await fetch("/api/platform" + path, {
    method: body ? "POST" : "GET",
    headers: {
      Authorization: `Platform ${token}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!response.ok) {
    const result = await response.json().catch(() => ({}));
    const fallback =
      response.status === 401
        ? "Token incorrecto."
        : response.status === 404
          ? "El panel no está activado en este servidor."
          : "No se pudo completar la operación.";
    throw new PlatformError(
      typeof result.message === "string" ? result.message : fallback,
      response.status,
    );
  }
  return response.json();
}

const STATUS: Record<Status, { label: string; className: string }> = {
  trial: {
    label: "En prueba",
    className: "bg-sky-100 text-sky-900 border-sky-300",
  },
  active: {
    label: "Al día",
    className: "bg-emerald-100 text-emerald-900 border-emerald-300",
  },
  past_due: {
    label: "Atrasado",
    className: "bg-amber-100 text-amber-900 border-amber-400",
  },
  suspended: {
    label: "Suspendido",
    className: "bg-red-100 text-red-900 border-red-300",
  },
};
const PLANS = {
  autoservicio: "Autoservicio",
  basico: "Básico",
  pro: "Pro",
  premium: "Premium",
} as const;
const METHODS = {
  transfer: "Transferencia",
  cash: "Efectivo",
  card_in_store: "Tarjeta en local",
  courier: "Mensajero",
} as const;
const AI_PACKS = { 100: 399, 300: 999 } as const;
const BUSINESS_TYPES = {
  retail: "Tienda",
  beauty: "Belleza",
  fitness: "Gimnasio / suplementos",
  services: "Servicios",
  general: "Otro",
} as const;

const money = (value: number | string) =>
  "RD$" +
  Number(value).toLocaleString("es-DO", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
const date = (value: string | null) =>
  value
    ? new Date(value).toLocaleDateString("es-DO", {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : "—";
// Una prueba vencida sin pagos sigue contando desde el fin de la prueba.
const dueOf = (t: Tenant) =>
  t.status === "trial" ? t.trialEndsAt : (t.paidUntil ?? t.trialEndsAt);
const dueLabel = (t: Tenant) =>
  t.status !== "trial" && t.paidUntil ? "Pagado hasta" : "Prueba hasta";
const daysLeft = (value: string | null) =>
  value === null
    ? null
    : Math.ceil((new Date(value).getTime() - Date.now()) / DAY);
const dueSoon = (t: Tenant) => {
  const days = daysLeft(dueOf(t));
  return (
    (t.status === "trial" || t.status === "active") &&
    days !== null &&
    days <= 7
  );
};
function daysText(days: number | null) {
  if (days === null) return "Sin fecha";
  if (days === 0) return "Vence hoy";
  if (days > 0) return `Vence en ${days} ${days === 1 ? "día" : "días"}`;
  return `Venció hace ${-days} ${days === -1 ? "día" : "días"}`;
}

function StatusBadge({ tenant }: { tenant: Tenant }) {
  const status = STATUS[tenant.status];
  return (
    <span className="flex flex-wrap gap-1">
      <span
        className={`rounded-full border px-2 py-0.5 text-sm font-semibold ${status.className}`}
      >
        {status.label}
      </span>
      {dueSoon(tenant) && (
        <span className="rounded-full border border-amber-400 bg-amber-50 px-2 py-0.5 text-sm font-semibold text-amber-900">
          Por vencer
        </span>
      )}
    </span>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4">
      <h2 className="mb-3 text-lg text-slate-900">{title}</h2>
      {children}
    </section>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex min-w-0 flex-col gap-1 text-sm font-semibold text-slate-800">
      {label}
      {children}
    </label>
  );
}

const ErrorText = ({ text }: { text: string }) =>
  text ? (
    <div role="alert" className="text-sm font-semibold text-red-800">
      {text}
    </div>
  ) : null;

/** Enlace de invitación con copia y envío por WhatsApp. Nunca se escribe en la consola. */
export function InviteLink({
  url,
  adminName,
  adminEmail,
  businessName,
  slug,
  reset = false,
}: {
  url: string;
  adminName: string;
  adminEmail: string;
  businessName: string;
  slug: string;
  /** Enlace para restablecer la clave (24 h) en vez de invitación (7 días). */
  reset?: boolean;
}) {
  const [copied, setCopied] = useState(false);
  // Dice con qué correo y código se entra: sin eso la persona no sabía cuál usar.
  const login = `Para entrar usa el código de empresa «${slug}» y el correo ${adminEmail}.`;
  const message = reset
    ? `Hola ${adminName}, este es tu enlace para crear una contraseña y un PIN nuevos en Nexora POS (empresa «${businessName}»): ${url} ` +
      `${login} El enlace vence en 24 horas y sirve una sola vez.`
    : `Hola ${adminName}, te damos la bienvenida a Nexora POS. ` +
      `Para activar tu empresa «${businessName}», abre este enlace y crea tu contraseña: ${url} ` +
      `${login} El enlace vence en 7 días y sirve una sola vez.`;
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };
  return (
    <div className="flex flex-col gap-2 rounded-lg border border-violet-300 bg-violet-50 p-3">
      <div className="text-sm text-slate-800">
        {reset
          ? "Enlace para restablecer la clave (vence en 24 horas). Por seguridad solo se muestra ahora."
          : "Enlace de invitación (vence en 7 días). Por seguridad solo se muestra ahora: si se pierde, usa «Reenviar invitación»."}{" "}
        Entra con el correo <strong>{adminEmail}</strong> y el código{" "}
        <strong>{slug}</strong>.
      </div>
      <input
        readOnly
        aria-label="Enlace de invitación"
        value={url}
        onFocus={(e) => e.currentTarget.select()}
        className="w-full"
      />
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <Button type="button" variant="secondary" onClick={copy}>
          {copied ? "Enlace copiado" : "Copiar enlace de invitación"}
        </Button>
        <a
          className="button primary"
          href={`https://wa.me/?text=${encodeURIComponent(message)}`}
          target="_blank"
          rel="noopener noreferrer"
        >
          Enviar por WhatsApp
        </a>
      </div>
    </div>
  );
}

/** Dos pasos para todo lo que mueve dinero o invalida enlaces: revisar y confirmar. */
function ConfirmStep({
  text,
  busy,
  onConfirm,
  onBack,
}: {
  text: string;
  busy: boolean;
  onConfirm: () => void;
  onBack: () => void;
}) {
  return (
    <div className="flex flex-col gap-2 rounded-lg border border-amber-400 bg-amber-50 p-3">
      <div className="text-base font-semibold text-slate-900">{text}</div>
      <div className="grid grid-cols-2 gap-2">
        <Button
          type="button"
          variant="secondary"
          onClick={onBack}
          disabled={busy}
        >
          Volver
        </Button>
        <Button type="button" onClick={onConfirm} disabled={busy}>
          {busy ? "Guardando…" : "Confirmar"}
        </Button>
      </div>
    </div>
  );
}

function PaymentForm({
  token,
  tenant,
  onDone,
}: {
  token: string;
  tenant: Detail;
  onDone: () => void;
}) {
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<keyof typeof METHODS>("transfer");
  const [reference, setReference] = useState("");
  const [period, setPeriod] = useState("1");
  const [review, setReview] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState("");
  const value = Number(amount);
  const periodText =
    period === "year"
      ? "un año"
      : `${period} ${period === "1" ? "mes" : "meses"}`;
  const submit = (event: FormEvent) => {
    event.preventDefault();
    setError("");
    setDone("");
    if (!(value > 0) || Math.round(value * 100) !== value * 100)
      return setError("Escribe un monto válido (máximo 2 decimales).");
    if (!reference.trim()) return setError("Escribe la referencia del pago.");
    setReview(true);
  };
  const confirm = async () => {
    setBusy(true);
    setError("");
    try {
      const result = await platformFetch<{ tenant: { paidUntil: string } }>(
        token,
        `/tenants/${tenant.slug}/payments`,
        {
          amount: value,
          method,
          reference: reference.trim(),
          ...(period === "year" ? { year: true } : { months: Number(period) }),
        },
      );
      setDone(
        `Pago registrado. Pagado hasta ${date(result.tenant.paidUntil)}.`,
      );
      setAmount("");
      setReference("");
      setReview(false);
      onDone();
    } catch (cause) {
      setError((cause as Error).message);
      setReview(false);
    } finally {
      setBusy(false);
    }
  };
  return (
    <form onSubmit={submit} className="flex flex-col gap-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="Monto (RD$)">
          <input
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value.replace(",", "."))}
            required
            disabled={review}
          />
        </Field>
        <Field label="Método">
          <select
            value={method}
            onChange={(e) => setMethod(e.target.value as keyof typeof METHODS)}
            disabled={review}
          >
            {Object.entries(METHODS).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Referencia">
          <input
            value={reference}
            maxLength={120}
            onChange={(e) => setReference(e.target.value)}
            required
            disabled={review}
          />
        </Field>
        <Field label="Período">
          <select
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            disabled={review}
          >
            {Array.from({ length: 12 }, (_, i) => (
              <option key={i} value={String(i + 1)}>
                {i + 1} {i ? "meses" : "mes"}
              </option>
            ))}
            <option value="year">Un año</option>
          </select>
        </Field>
      </div>
      <ErrorText text={error} />
      {done && (
        <div role="status" className="text-sm font-semibold text-emerald-800">
          {done}
        </div>
      )}
      {review ? (
        <ConfirmStep
          busy={busy}
          onBack={() => setReview(false)}
          onConfirm={confirm}
          text={`¿Registrar ${money(value)} de ${tenant.name} por ${METHODS[method].toLowerCase()} (ref. ${reference.trim()}) por ${periodText}?`}
        />
      ) : (
        <Button>Revisar pago</Button>
      )}
    </form>
  );
}

function AiPackForm({
  token,
  tenant,
  onDone,
}: {
  token: string;
  tenant: Detail;
  onDone: () => void;
}) {
  const [size, setSize] = useState<100 | 300>(100);
  const [reference, setReference] = useState("");
  const [review, setReview] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState("");
  const submit = (event: FormEvent) => {
    event.preventDefault();
    setError("");
    setDone("");
    if (!reference.trim())
      return setError("Escribe la referencia del pago del paquete.");
    setReview(true);
  };
  const confirm = async () => {
    setBusy(true);
    try {
      await platformFetch(token, `/tenants/${tenant.slug}/ai-packs`, {
        size,
        reference: reference.trim(),
      });
      setDone(`Paquete de ${size} preguntas acreditado para este mes.`);
      setReference("");
      onDone();
    } catch (cause) {
      setError((cause as Error).message);
    } finally {
      setBusy(false);
      setReview(false);
    }
  };
  return (
    <form onSubmit={submit} className="flex flex-col gap-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="Paquete">
          <select
            value={size}
            onChange={(e) => setSize(Number(e.target.value) as 100 | 300)}
            disabled={review}
          >
            <option value={100}>100 preguntas · {money(AI_PACKS[100])}</option>
            <option value={300}>300 preguntas · {money(AI_PACKS[300])}</option>
          </select>
        </Field>
        <Field label="Referencia del pago">
          <input
            value={reference}
            maxLength={120}
            onChange={(e) => setReference(e.target.value)}
            required
            disabled={review}
          />
        </Field>
      </div>
      <ErrorText text={error} />
      {done && (
        <div role="status" className="text-sm font-semibold text-emerald-800">
          {done}
        </div>
      )}
      {review ? (
        <ConfirmStep
          busy={busy}
          onBack={() => setReview(false)}
          onConfirm={confirm}
          text={`¿Acreditar ${size} preguntas (${money(AI_PACKS[size])}, ref. ${reference.trim()}) a ${tenant.name}?`}
        />
      ) : (
        <Button>Revisar paquete</Button>
      )}
    </form>
  );
}

type SupportGrant = { slug: string; name: string; expiresAt: string };

function SupportSection({
  token,
  slug,
  onAuthError,
}: {
  token: string;
  slug: string;
  onAuthError: (e: unknown) => void;
}) {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  // SOP-04: quién abre y por qué queda en la bitácora de la empresa.
  const [operadora, setOperadora] = useState("");
  const [motivo, setMotivo] = useState("");
  const grants = useQuery({
    queryKey: ["platform", "support-grants"],
    queryFn: () =>
      platformFetch<SupportGrant[]>(token, "/support-grants").catch(
        onAuthError,
      ),
  });
  const grant = (grants.data as SupportGrant[] | undefined)?.find(
    (g) => g.slug === slug,
  );
  const open = async () => {
    setError("");
    // Se abre antes de esperar la respuesta: si no, el navegador bloquea la pestaña.
    const tab = window.open("", "_blank");
    if (!tab) return setError("El navegador bloqueó la pestaña nueva.");
    setBusy(true);
    try {
      const session = await platformFetch<{ accessToken: string }>(
        token,
        `/tenants/${slug}/support-session`,
        { operadora: operadora.trim(), motivo: motivo.trim() },
      );
      // La pestaña nueva hereda el sessionStorage del panel: se quita el token
      // de plataforma y queda solo el de soporte.
      tab.sessionStorage.removeItem(TOKEN_KEY);
      tab.sessionStorage.setItem(SUPPORT_TOKEN_KEY, session.accessToken);
      tab.opener = null;
      tab.location.href = "/";
    } catch (cause) {
      tab.close();
      setError((cause as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Section title="Soporte">
      {grants.isError ? (
        <ErrorText text={(grants.error as Error).message} />
      ) : !grants.data ? (
        <div>Cargando…</div>
      ) : grant ? (
        <div className="flex flex-col gap-3 text-base">
          <div>
            Acceso de soporte activo hasta{" "}
            <strong>{date(grant.expiresAt)}</strong>.
          </div>
          <Field label="Tu nombre (operadora)">
            <input
              value={operadora}
              maxLength={80}
              onChange={(e) => setOperadora(e.target.value)}
            />
          </Field>
          <Field label="Motivo (qué vas a revisar)">
            <input
              value={motivo}
              maxLength={200}
              onChange={(e) => setMotivo(e.target.value)}
            />
          </Field>
          <div>
            <Button
              disabled={busy || operadora.trim().length < 2 || motivo.trim().length < 8}
              onClick={() => void open()}
            >
              Abrir sesión de solo lectura
            </Button>
          </div>
          <ErrorText text={error} />
        </div>
      ) : (
        <div>La empresa no ha activado el acceso de soporte.</div>
      )}
    </Section>
  );
}

function ClientDetail({
  token,
  slug,
  onBack,
  onAuthError,
}: {
  token: string;
  slug: string;
  onBack: () => void;
  onAuthError: (e: unknown) => void;
}) {
  const client = useQueryClient();
  const [invite, setInvite] = useState("");
  const [confirmInvite, setConfirmInvite] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [resetLink, setResetLink] = useState(false);
  const [confirmRevoke, setConfirmRevoke] = useState(false);
  const [operadora, setOperadora] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const detail = useQuery({
    queryKey: ["platform", "tenant", slug],
    queryFn: () =>
      platformFetch<Detail>(token, `/tenants/${slug}`).catch(onAuthError),
  });
  const payments = useQuery({
    queryKey: ["platform", "payments", slug],
    queryFn: () =>
      platformFetch<Payment[]>(token, `/tenants/${slug}/payments`).catch(
        onAuthError,
      ),
  });
  const usage = useQuery({
    queryKey: ["platform", "ai", slug],
    queryFn: () =>
      platformFetch<Usage>(token, `/tenants/${slug}/ai-usage`).catch(
        onAuthError,
      ),
  });
  const refresh = () => client.invalidateQueries({ queryKey: ["platform"] });
  const tenant = detail.data as Detail | undefined;
  const reinvite = async () => {
    setBusy(true);
    setError("");
    try {
      const result = await platformFetch<{ invitationUrl: string }>(
        token,
        `/tenants/${slug}/reinvite`,
        { operadora: operadora.trim() },
      );
      setInvite(result.invitationUrl);
      refresh();
    } catch (cause) {
      setError((cause as Error).message);
    } finally {
      setBusy(false);
      setConfirmInvite(false);
    }
  };
  const passwordReset = async () => {
    setBusy(true);
    setError("");
    try {
      const result = await platformFetch<{ invitationUrl: string }>(
        token,
        `/tenants/${slug}/password-reset`,
        {},
      );
      setResetLink(true);
      setInvite(result.invitationUrl);
      refresh();
    } catch (cause) {
      setError((cause as Error).message);
    } finally {
      setBusy(false);
      setConfirmReset(false);
    }
  };
  // INV-02: cancelación explícita; queda en la bitácora con la operadora.
  const revoke = async () => {
    setBusy(true);
    setError("");
    try {
      await platformFetch(token, `/tenants/${slug}/revoke-invitation`, {
        operadora: operadora.trim(),
      });
      setInvite("");
      refresh();
    } catch (cause) {
      setError((cause as Error).message);
    } finally {
      setBusy(false);
      setConfirmRevoke(false);
    }
  };
  return (
    <div className="flex flex-col gap-4">
      <div>
        <Button variant="secondary" onClick={onBack}>
          ← Mis clientes
        </Button>
      </div>
      {detail.isError && <ErrorText text={(detail.error as Error).message} />}
      {!tenant ? (
        !detail.isError && <div role="status">Cargando…</div>
      ) : (
        <>
          <Section title={tenant.name}>
            <StatusBadge tenant={tenant} />
            <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 text-base">
              <dt className="text-slate-600">Código</dt>
              <dd className="break-all font-semibold">{tenant.slug}</dd>
              <dt className="text-slate-600">Plan</dt>
              <dd className="font-semibold">
                {PLANS[tenant.plan as keyof typeof PLANS] ?? tenant.plan}
              </dd>
              <dt className="text-slate-600">{dueLabel(tenant)}</dt>
              <dd className="font-semibold">{date(dueOf(tenant))}</dd>
              <dt className="text-slate-600">Días</dt>
              <dd className="font-semibold">
                {daysText(daysLeft(dueOf(tenant)))}
              </dd>
              <dt className="text-slate-600">Cliente desde</dt>
              <dd className="font-semibold">{date(tenant.createdAt)}</dd>
            </dl>
          </Section>
          <Section title="Contacto">
            {tenant.admin ? (
              <div className="flex flex-col gap-2 text-base">
                <div className="font-semibold">{tenant.admin.name}</div>
                <a
                  className="break-all font-semibold text-violet-800 underline"
                  href={`mailto:${tenant.admin.email}`}
                >
                  {tenant.admin.email}
                </a>
                <div className="text-slate-700">
                  {!tenant.admin.invitationPending
                    ? "Invitación aceptada: entra con su propia clave."
                    : new Date(tenant.admin.invitationExpiresAt ?? 0) <= new Date()
                      ? "Invitación vencida o cancelada."
                      : `Invitación pendiente (vence ${date(tenant.admin.invitationExpiresAt)}).`}
                </div>
                {tenant.admin.invitationPending && (
                  <Field label="Tu nombre (operadora)">
                    <input
                      value={operadora}
                      maxLength={80}
                      onChange={(e) => setOperadora(e.target.value)}
                    />
                  </Field>
                )}
                {tenant.admin.invitationPending &&
                  operadora.trim().length >= 2 &&
                  (confirmRevoke ? (
                    <ConfirmStep
                      busy={busy}
                      onBack={() => setConfirmRevoke(false)}
                      onConfirm={revoke}
                      text="El enlace dejará de servir. ¿Cancelar la invitación?"
                    />
                  ) : (
                    <Button variant="secondary" onClick={() => setConfirmRevoke(true)}>
                      Cancelar invitación
                    </Button>
                  ))}
                {tenant.admin.invitationPending &&
                  !invite &&
                  operadora.trim().length >= 2 &&
                  (confirmInvite ? (
                    <ConfirmStep
                      busy={busy}
                      onBack={() => setConfirmInvite(false)}
                      onConfirm={reinvite}
                      text="Se creará un enlace nuevo y el anterior dejará de servir. ¿Continuar?"
                    />
                  ) : (
                    <Button
                      variant="secondary"
                      onClick={() => setConfirmInvite(true)}
                    >
                      Reenviar invitación
                    </Button>
                  ))}
                {invite && (
                  <InviteLink
                    url={invite}
                    adminName={tenant.admin.name}
                    adminEmail={tenant.admin.email}
                    businessName={tenant.name}
                    slug={tenant.slug}
                    reset={resetLink}
                  />
                )}
                {!tenant.admin.invitationPending &&
                  !invite &&
                  (confirmReset ? (
                    <ConfirmStep
                      busy={busy}
                      onBack={() => setConfirmReset(false)}
                      onConfirm={passwordReset}
                      text="Su clave actual dejará de servir y se cerrarán sus sesiones. Le darás un enlace para crear clave y PIN nuevos. ¿Continuar?"
                    />
                  ) : (
                    <Button
                      variant="secondary"
                      onClick={() => setConfirmReset(true)}
                    >
                      Enlace para restablecer su clave
                    </Button>
                  ))}
                <ErrorText text={error} />
              </div>
            ) : (
              <div>Sin cuenta de administración.</div>
            )}
          </Section>
          <SupportSection token={token} slug={slug} onAuthError={onAuthError} />
          <Section title="Registrar pago">
            <PaymentForm token={token} tenant={tenant} onDone={refresh} />
          </Section>
          <Section title="Asistente IA este mes">
            {usage.data ? (
              <div className="mb-3 text-base">
                Usadas <strong>{(usage.data as Usage).used}</strong> de{" "}
                <strong>{(usage.data as Usage).limit}</strong> preguntas (
                {(usage.data as Usage).planQuota} del plan +{" "}
                {(usage.data as Usage).packs} de paquetes).
              </div>
            ) : (
              <div className="mb-3">Cargando uso…</div>
            )}
            <h3 className="mb-2 text-base">Acreditar paquete IA</h3>
            <AiPackForm token={token} tenant={tenant} onDone={refresh} />
          </Section>
          <Section title="Historial de pagos">
            {!payments.data ? (
              <div>Cargando…</div>
            ) : (payments.data as Payment[]).length === 0 ? (
              <div>Sin pagos registrados.</div>
            ) : (
              <ul className="flex flex-col divide-y divide-slate-200">
                {(payments.data as Payment[]).map((p) => (
                  <li key={p.id} className="flex flex-col py-2 text-base">
                    <span className="font-semibold">
                      {p.voidsPaymentId ? "Anulación · −" : ""}
                      {money(p.amount)} ·{" "}
                      {METHODS[p.method as keyof typeof METHODS] ?? p.method}
                      {(payments.data as Payment[]).some(
                        (v) => v.voidsPaymentId === p.id,
                      ) && " · ANULADO"}
                    </span>
                    {p.voidReason && (
                      <span className="text-sm text-slate-700">
                        Motivo: {p.voidReason}
                      </span>
                    )}
                    <span className="text-sm text-slate-700">
                      {date(p.createdAt)} · {p.months}{" "}
                      {p.months === 1 ? "mes" : "meses"} · hasta{" "}
                      {date(p.paidUntil)}
                    </span>
                    <span className="break-all text-sm text-slate-700">
                      Ref. {p.reference}
                    </span>
                    {!p.voidsPaymentId &&
                      !(payments.data as Payment[]).some(
                        (v) => v.voidsPaymentId === p.id,
                      ) && (
                        <VoidPayment
                          token={token}
                          slug={slug}
                          payment={p}
                          onDone={refresh}
                        />
                      )}
                  </li>
                ))}
              </ul>
            )}
          </Section>
        </>
      )}
    </div>
  );
}

/** «Anular pago»: pide el motivo y confirma. La API agrega una fila de
 * anulación (no edita ni borra) y rehace el «pagado hasta». */
function VoidPayment({
  token,
  slug,
  payment,
  onDone,
}: {
  token: string;
  slug: string;
  payment: Payment;
  onDone: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [review, setReview] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  if (!open)
    return (
      <div>
        <Button variant="secondary" onClick={() => setOpen(true)}>
          Anular pago
        </Button>
      </div>
    );
  const confirm = async () => {
    setBusy(true);
    setError("");
    try {
      await platformFetch(
        token,
        `/tenants/${slug}/payments/${payment.id}/void`,
        {
          reason: reason.trim(),
        },
      );
      setOpen(false);
      onDone();
    } catch (cause) {
      setError((cause as Error).message);
    } finally {
      setBusy(false);
      setReview(false);
    }
  };
  return (
    <div className="mt-2 flex flex-col gap-2">
      <Field label="Motivo de la anulación">
        <input
          value={reason}
          maxLength={300}
          onChange={(e) => setReason(e.target.value)}
          disabled={review}
        />
      </Field>
      {review ? (
        <ConfirmStep
          busy={busy}
          onBack={() => setReview(false)}
          onConfirm={confirm}
          text={`Se anulará el pago de ${money(payment.amount)} (Ref. ${payment.reference}) y se recalculará el «pagado hasta». ¿Continuar?`}
        />
      ) : (
        <div className="grid grid-cols-2 gap-2">
          <Button variant="secondary" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          <Button
            onClick={() =>
              reason.trim().length >= 3
                ? setReview(true)
                : setError("Escribe el motivo (mínimo 3 letras).")
            }
          >
            Anular pago
          </Button>
        </div>
      )}
      <ErrorText text={error} />
    </div>
  );
}

function CreateClient({
  token,
  onOpen,
  onBack,
}: {
  token: string;
  onOpen: (slug: string) => void;
  onBack: () => void;
}) {
  const client = useQueryClient();
  const [form, setForm] = useState({
    businessName: "",
    companyCode: "",
    businessType: "retail",
    plan: "basico",
    trialDays: "30",
    adminName: "",
    adminEmail: "",
    operadora: "",
    acuerdoVersion: "",
    acuerdoFecha: "",
    acuerdoReferencia: "",
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [created, setCreated] = useState<{
    slug: string;
    invitationUrl: string;
  } | null>(null);
  const set = (key: keyof typeof form) => (e: { target: { value: string } }) =>
    setForm({ ...form, [key]: e.target.value });
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const result = await platformFetch<{
        slug: string;
        invitationUrl: string;
      }>(token, "/tenants", {
        businessName: form.businessName,
        businessType: form.businessType,
        plan: form.plan,
        adminName: form.adminName,
        adminEmail: form.adminEmail,
        operadora: form.operadora,
        // INV-01: acuerdo de servicio firmado en papel, verificable.
        acuerdo: {
          version: form.acuerdoVersion.trim(),
          fecha: form.acuerdoFecha,
          referencia: form.acuerdoReferencia,
        },
        companyCode: form.companyCode.trim().toLowerCase(),
        trialDays: Number(form.trialDays),
      });
      setCreated(result);
      client.invalidateQueries({ queryKey: ["platform"] });
    } catch (cause) {
      setError((cause as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="flex flex-col gap-4">
      <div>
        <Button variant="secondary" onClick={onBack}>
          ← Mis clientes
        </Button>
      </div>
      <Section title="Crear empresa piloto">
        {created ? (
          <div className="flex flex-col gap-3">
            <div
              className="text-base font-semibold text-emerald-800"
              role="status"
            >
              Empresa «{form.businessName}» creada.
            </div>
            <InviteLink
              url={created.invitationUrl}
              adminName={form.adminName}
              adminEmail={form.adminEmail.trim().toLowerCase()}
              businessName={form.businessName}
              slug={created.slug}
            />
            <Button variant="secondary" onClick={() => onOpen(created.slug)}>
              Ver cliente
            </Button>
          </div>
        ) : (
          <form onSubmit={submit} className="flex flex-col gap-3">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label="Nombre del negocio">
                <input
                  value={form.businessName}
                  onChange={set("businessName")}
                  required
                  minLength={2}
                  maxLength={120}
                />
              </Field>
              <Field label="Código de empresa (para entrar)">
                <input
                  value={form.companyCode}
                  onChange={set("companyCode")}
                  required
                  pattern="[a-z0-9][a-z0-9\-]{1,62}"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                />
              </Field>
              <Field label="Tipo de negocio">
                <select
                  value={form.businessType}
                  onChange={set("businessType")}
                >
                  {Object.entries(BUSINESS_TYPES).map(([key, label]) => (
                    <option key={key} value={key}>
                      {label}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Plan">
                <select value={form.plan} onChange={set("plan")}>
                  {Object.entries(PLANS).map(([key, label]) => (
                    <option key={key} value={key}>
                      {label}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Días de prueba">
                <input
                  type="number"
                  min={1}
                  max={365}
                  value={form.trialDays}
                  onChange={set("trialDays")}
                  required
                />
              </Field>
              <Field label="Nombre de la dueña o encargado">
                <input
                  value={form.adminName}
                  onChange={set("adminName")}
                  required
                  minLength={2}
                  maxLength={120}
                />
              </Field>
              <Field label="Correo de la dueña o encargado">
                <input
                  type="email"
                  value={form.adminEmail}
                  onChange={set("adminEmail")}
                  required
                  maxLength={254}
                  autoCapitalize="none"
                />
              </Field>
              <Field label="Versión del acuerdo firmado">
                <input
                  value={form.acuerdoVersion}
                  onChange={set("acuerdoVersion")}
                  required
                  pattern="[A-Za-z0-9._\-]{1,40}"
                />
              </Field>
              <Field label="Fecha de la firma">
                <input
                  type="date"
                  value={form.acuerdoFecha}
                  onChange={set("acuerdoFecha")}
                  required
                />
              </Field>
              <Field label="Referencia del acuerdo (archivo o folio)">
                <input
                  value={form.acuerdoReferencia}
                  onChange={set("acuerdoReferencia")}
                  required
                  minLength={3}
                  maxLength={120}
                />
              </Field>
              <Field label="Tu nombre (operadora)">
                <input
                  value={form.operadora}
                  onChange={set("operadora")}
                  required
                  minLength={2}
                  maxLength={80}
                />
              </Field>
            </div>
            <div className="text-sm text-slate-700">
              El código usa minúsculas, números y guiones. Ejemplo:
              tienda-maria.
            </div>
            <ErrorText text={error} />
            <Button disabled={busy}>
              {busy ? "Creando…" : "Crear empresa y enlace"}
            </Button>
          </form>
        )}
      </Section>
    </div>
  );
}

const FILTERS = {
  all: "Todos",
  trial: "En prueba",
  active: "Al día",
  soon: "Por vencer (≤7 días)",
  past_due: "Atrasados",
  suspended: "Suspendidos",
} as const;

function ClientList({
  token,
  onOpen,
  onCreate,
  onAuthError,
}: {
  token: string;
  onOpen: (slug: string) => void;
  onCreate: () => void;
  onAuthError: (e: unknown) => void;
}) {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<keyof typeof FILTERS>("all");
  const summary = useQuery({
    queryKey: ["platform", "summary"],
    queryFn: () => platformFetch<Summary>(token, "/summary").catch(onAuthError),
  });
  const tenants = useQuery({
    queryKey: ["platform", "tenants"],
    queryFn: () =>
      platformFetch<Tenant[]>(token, "/tenants").catch(onAuthError),
  });
  const rows = (tenants.data as Tenant[] | undefined) ?? [];
  // shortcut: una consulta de uso de IA por empresa; con cientos de clientes, moverlo a una sola ruta.
  const usage = useQueries({
    queries: rows.map((t) => ({
      queryKey: ["platform", "ai", t.slug],
      queryFn: () => platformFetch<Usage>(token, `/tenants/${t.slug}/ai-usage`),
    })),
  });
  const s = summary.data as Summary | undefined;
  const q = search.trim().toLowerCase();
  const visible = rows
    .map((t, i) => ({ t, ai: usage[i]?.data }))
    .filter(
      ({ t }) => !q || t.name.toLowerCase().includes(q) || t.slug.includes(q),
    )
    .filter(
      ({ t }) =>
        filter === "all" ||
        (filter === "soon" ? dueSoon(t) : t.status === filter),
    );
  const card = (label: string, value: ReactNode, tone = "border-slate-200") => (
    <div className={`rounded-xl border bg-white p-3 ${tone}`}>
      <div className="text-sm text-slate-700">{label}</div>
      <div className="text-xl font-bold text-slate-900">{value}</div>
    </div>
  );
  return (
    <div className="flex flex-col gap-4">
      {s && (
        <div
          className="grid grid-cols-2 gap-2 sm:grid-cols-4"
          aria-label="Resumen"
        >
          {card("Clientes", s.total)}
          {card("Al día", s.alDia, "border-emerald-300")}
          {card("En prueba", s.enPrueba, "border-sky-300")}
          {card("Por vencer (≤7 días)", s.porVencer, "border-amber-400")}
          {card("Atrasados", s.atrasados, "border-amber-400")}
          {card("Suspendidos", s.suspendidos, "border-red-300")}
          <div className="col-span-2">
            {card(
              "Ingreso del mes",
              <>
                {money(s.monthIncome)}
                {s.monthAiPacks !== undefined && (
                  <div className="text-sm font-normal text-slate-700">
                    Planes {money(s.monthPayments ?? 0)} · Paquetes IA{" "}
                    {money(s.monthAiPacks)}
                  </div>
                )}
              </>,
              "border-violet-300",
            )}
          </div>
        </div>
      )}
      <Button onClick={onCreate}>+ Crear empresa piloto</Button>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <Field label="Buscar">
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Nombre o código"
          />
        </Field>
        <Field label="Estado">
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value as keyof typeof FILTERS)}
          >
            {Object.entries(FILTERS).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </Field>
      </div>
      {tenants.isError && <ErrorText text={(tenants.error as Error).message} />}
      {tenants.isLoading ? (
        <div role="status">Cargando clientes…</div>
      ) : visible.length === 0 ? (
        <div>No hay clientes con ese filtro.</div>
      ) : (
        <ul className="flex flex-col gap-2" aria-label="Mis clientes">
          {visible.map(({ t, ai }) => (
            <li key={t.id}>
              <button
                type="button"
                onClick={() => onOpen(t.slug)}
                // Estilo en línea: la regla global button:not(.button) quita fondo y borde.
                className="flex w-full min-w-0 flex-col items-start gap-1 rounded-xl p-3 text-left"
                style={{ background: "#fff", border: "1px solid #94a3b8" }}
              >
                <span className="w-full break-words text-base font-bold text-slate-900">
                  {t.name}
                </span>
                <span className="text-sm text-slate-700">
                  {t.slug} · {PLANS[t.plan as keyof typeof PLANS] ?? t.plan}
                </span>
                <StatusBadge tenant={t} />
                <span className="text-sm text-slate-800">
                  {dueLabel(t)} {date(dueOf(t))} ·{" "}
                  {daysText(daysLeft(dueOf(t)))}
                </span>
                <span className="text-sm text-slate-800">
                  IA este mes: {ai ? `${ai.used} / ${ai.limit}` : "…"}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Login({ onEnter }: { onEnter: (token: string) => void }) {
  const [value, setValue] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    const token = value.trim();
    try {
      await platformFetch(token, "/summary");
      onEnter(token);
    } catch (cause) {
      setError(
        cause instanceof PlatformError && cause.status === 404
          ? "El panel no está activado en este servidor."
          : (cause as Error).message,
      );
    } finally {
      setBusy(false);
      setValue("");
    }
  };
  return (
    <form
      onSubmit={submit}
      className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4"
    >
      <h2 className="text-lg">Entrar al panel</h2>
      <div className="text-base text-slate-700">
        Pega el token de plataforma. Se guarda solo en esta pestaña y se borra
        al cerrarla o al pulsar «Salir».
      </div>
      <Field label="Token de plataforma">
        <input
          type="password"
          autoComplete="off"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          required
        />
      </Field>
      <ErrorText text={error} />
      <Button disabled={busy}>{busy ? "Comprobando…" : "Entrar"}</Button>
    </form>
  );
}

export function PlatformPanel() {
  const client = useQueryClient();
  const [token, setToken] = useState(readPlatformToken);
  const [view, setView] = useState<
    { name: "list" } | { name: "create" } | { name: "detail"; slug: string }
  >({ name: "list" });
  // Con llaves: en Chromium nuevo scrollTo devuelve una promesa y React la
  // tomaría por la función de limpieza («is not a function», pantalla en blanco).
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [view]);
  const exit = () => {
    savePlatformToken("");
    setToken("");
    setView({ name: "list" });
    client.removeQueries({ queryKey: ["platform"] });
  };
  // Token revocado o cambiado en el servidor: de vuelta a la entrada.
  const onAuthError = (error: unknown): never => {
    if (error instanceof PlatformError && error.status === 401) exit();
    throw error;
  };
  return (
    <div className="min-h-screen bg-slate-100 text-base text-slate-900">
      <header className="flex items-center justify-between gap-2 border-b border-slate-200 bg-white px-4 py-3">
        <div className="min-w-0">
          <div className="text-sm font-semibold text-violet-800">
            Nexora POS
          </div>
          <h1 className="text-xl leading-tight">Panel de plataforma</h1>
        </div>
        {token && (
          <Button variant="secondary" onClick={exit}>
            Salir
          </Button>
        )}
      </header>
      <main className="mx-auto flex w-full max-w-3xl flex-col gap-4 p-4">
        {!token ? (
          <Login
            onEnter={(t) => {
              savePlatformToken(t);
              setToken(t);
            }}
          />
        ) : view.name === "detail" ? (
          <ClientDetail
            token={token}
            slug={view.slug}
            onBack={() => setView({ name: "list" })}
            onAuthError={onAuthError}
          />
        ) : view.name === "create" ? (
          <CreateClient
            token={token}
            onOpen={(slug) => setView({ name: "detail", slug })}
            onBack={() => setView({ name: "list" })}
          />
        ) : (
          <ClientList
            token={token}
            onOpen={(slug) => setView({ name: "detail", slug })}
            onCreate={() => setView({ name: "create" })}
            onAuthError={onAuthError}
          />
        )}
        {token && (
          <Section title="Manual de soporte">
            <ul className="flex flex-col gap-2">
              <li>
                <a
                  className="font-semibold text-violet-800 underline"
                  href="/soporte-operador/MANUAL_SOPORTE_DUENA.md"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Manual: 25 problemas y cómo resolverlos
                </a>
              </li>
              <li>
                <a
                  className="font-semibold text-violet-800 underline"
                  href="/soporte-operador/RESPUESTAS_WHATSAPP.md"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Respuestas listas para WhatsApp
                </a>
              </li>
            </ul>
          </Section>
        )}
      </main>
    </div>
  );
}
