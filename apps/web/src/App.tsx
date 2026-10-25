import {
  DeviceGate,
  useRealtime,
  registerTerminal,
  storedTerminalCredentials,
} from "./realtime";
import { Merchandise } from "./Merchandise";
import { PasswordChangeFields } from "./PasswordChangeFields";
import {
  isCashierPasswordRole,
  passwordChangeError,
  friendlyPasswordChangeError,
  type PasswordPolicy,
} from "./passwordChange";
import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  LayoutDashboard,
  ShoppingBag,
  Package,
  Boxes,
  Truck,
  Wallet,
  Users,
  Sparkles,
  ChartNoAxesCombined,
  Bell,
  Settings,
  Search,
  Sun,
  Moon,
  ChevronDown,
  LogOut,
  Menu,
  Wifi,
  WifiOff,
  RefreshCw,
  ArrowUpRight,
  Palette,
  ScanLine,
  Zap,
  Info,
  KeyRound,
  Dumbbell,
  Footprints,
  Brush,
  GraduationCap,
  Pill,
  Shirt,
} from "lucide-react";
import {
  initialCompanyCode,
  productTenancyRequired,
  publicRegistrationEnabled,
} from "./productTenancy";
import { businessSidebarLabels, productLoginFaces } from "./product-branding";
import { Registration, ConfirmEmail, AcceptInvitation } from "./Registration";
import { Onboarding, type OnboardingStatus } from "./Onboarding";
import { DesktopPrinterControls } from "./DesktopPrinterControls";
import { Billing } from "./Billing";
import { SupportHelp } from "./SupportHelp";
import { Button, Badge, Modal, Loading } from "@fitstore/ui";
import { can } from "@fitstore/shared";
import {
  useStore,
  post,
  localDB,
  saveSession,
  refreshSession,
  syncSales,
  syncMerchandise,
  api,
  endSession,
  isNetworkError,
  sessionDeadline,
} from "./api";
import { retryDelayMs, retryMessage } from "./pendingSales";
import { Toasts, toast } from "./helpers";
import { inactivityWaits } from "./cartDraftPolicy";
import { keepDraftThrough } from "./cartDraft";
import { Dashboard } from "./Dashboard";
import { MonthReport } from "./MonthReport";
import { VoidRequests } from "./VoidRequests";
import { TransferReconciliation } from "./TransferReconciliation";
import { CourierPayouts } from "./CourierPayouts";
import { Assistant } from "./Assistant";
import { McpAuthorize } from "./McpAuthorize";
import { SupportAccessBanner } from "./SupportAccess";
import { POS } from "./POS";
import { IncentivesIcon, IncentivesPage } from "./Incentives";
import {
  Catalog,
  Inventory,
  Purchases,
  Expenses,
  Cash,
  Customers,
  Promotions,
  Reports,
  Alerts,
  Configuration,
  StyleGuide,
  SalesHistory,
} from "./Management";

const SHOW_DEMO_CREDENTIALS =
  import.meta.env.VITE_SHOW_DEMO_CREDENTIALS === "true";
// La guía es una herramienta interna de desarrollo, nunca una pantalla de tienda.
const SHOW_STYLE_GUIDE = import.meta.env.DEV;
// G12: el aviso de inactividad sale 60 s antes del cierre (o a la mitad del
// plazo si éste es menor de 2 minutos).
export const IDLE_WARNING_MS = 60000;
// Mismo corte que styles.css: por debajo, el menú lateral es un cajón.
const MOBILE_MENU = "(max-width: 780px)";
function useMediaQuery(query: string) {
  const [matches, setMatches] = useState(() => matchMedia(query).matches);
  useEffect(() => {
    const list = matchMedia(query);
    const change = () => setMatches(list.matches);
    change();
    list.addEventListener("change", change);
    return () => list.removeEventListener("change", change);
  }, [query]);
  return matches;
}
function IdleWarning({
  deadline,
  onStay,
}: {
  deadline: number;
  onStay: () => void;
}) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  const seconds = Math.max(0, Math.ceil((deadline - now) / 1000));
  return (
    <Modal open onClose={onStay} title="¿Sigues ahí?">
      <p>
        Por inactividad, la sesión se cerrará en{" "}
        <strong aria-live="off">{seconds} s</strong>. Para seguir trabajando,
        pulsa el botón.
      </p>
      <Button onClick={onStay}>Seguir conectado</Button>
    </Modal>
  );
}
// G14: «Acerca de», con la versión, la nota de documento no fiscal y los
// avisos de licencia de lo que va dentro de la app (public/licencias.txt).
function About({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [notices, setNotices] = useState<string | null>(null);
  const load = async () => {
    if (notices) return;
    try {
      const response = await fetch("/licencias.txt", { cache: "no-cache" });
      if (!response.ok) throw new Error();
      setNotices(await response.text());
    } catch {
      setNotices("No se pudieron cargar los avisos. Revisa la conexión.");
    }
  };
  return (
    <Modal open={open} onClose={onClose} title="Acerca de Nexora POS" wide>
      <div className="about">
        <p>
          <strong>Versión {__NEXORA_VERSION__}</strong>
        </p>
        <p className="about-fiscal">
          <strong>Documento no fiscal.</strong> Los recibos, notas y reportes de
          Nexora POS son documentos internos y no sustituyen un comprobante
          fiscal (NCF/e-CF).
        </p>
        <h3>Privacidad</h3>
        <p className="about-privacy">
          Nexora guarda los datos de clientes que registra la tienda (nombre y,
          si se dan, teléfono, correo y cédula/RNC) sólo para sus ventas,
          garantías y créditos. Cada recibo lo recuerda en el pie.{" "}
          <a href="/privacidad.html" target="_blank" rel="noopener">
            Aviso de privacidad para clientes
          </a>
        </p>
        <p>
          Usa fuentes Inter y Plus Jakarta Sans (SIL Open Font License 1.1),
          íconos Lucide (ISC) y librerías de código abierto (MIT, ISC,
          Apache-2.0, 0BSD), cada una con su licencia.
        </p>
        <p>
          <a href="/licencias.txt" target="_blank" rel="noopener">
            Licencias de terceros (texto completo)
          </a>
        </p>
        <details onToggle={(e) => e.currentTarget.open && load()}>
          <summary>Ver las licencias aquí</summary>
          <pre className="about-licenses" tabIndex={0}>
            {notices ?? "Cargando…"}
          </pre>
        </details>
      </div>
    </Modal>
  );
}

const navigation = [
  {
    id: "onboarding",
    label: "Primeros pasos",
    icon: Sparkles,
    permission: "*",
  },
  { id: "billing", label: "Plan y facturación", icon: Wallet, permission: "*" },
  {
    id: "merchandise",
    label: "Mercancía",
    icon: Truck,
    permission: "inventory:write",
  },
  {
    id: "dashboard",
    label: "Resumen",
    icon: LayoutDashboard,
    permission: "reports:read",
  },
  {
    id: "pos",
    label: "Punto de venta",
    icon: ShoppingBag,
    permission: "sale:write",
  },
  { id: "sales", label: "Ventas", icon: ScanLine, permission: "sale:write" },
  {
    id: "void-requests",
    label: "Solicitudes de anulación",
    icon: Bell,
    permission: "sale:write",
  },
  {
    id: "transfer-reconciliation",
    label: "Conciliar transferencias",
    icon: Wallet,
    permission: "*",
  },
  {
    id: "courier-payouts",
    label: "Envíos del mensajero",
    icon: Truck,
    permission: "*",
  },
  {
    id: "products",
    label: "Productos",
    icon: Package,
    permission: "catalog:read",
  },
  {
    id: "inventory",
    label: "Inventario",
    icon: Boxes,
    permission: "inventory:write",
  },
  {
    id: "purchases",
    label: "Compras",
    icon: Truck,
    permission: "purchase:write",
  },
  { id: "cash", label: "Caja", icon: Wallet, permission: "cash:write" },
  {
    id: "expenses",
    label: "Gastos",
    icon: ChartNoAxesCombined,
    permission: "expense:write",
  },
  {
    id: "customers",
    label: "Clientes",
    icon: Users,
    permission: "customers:write",
  },
  {
    id: "promotions",
    label: "Promociones",
    icon: Sparkles,
    permission: "promotions:write",
  },
  {
    id: "reports",
    label: "Reportes",
    icon: ChartNoAxesCombined,
    permission: "reports:read",
  },
  { id: "alerts", label: "Alertas", icon: Bell, permission: "alerts:write" },
  {
    id: "incentives",
    label: "Incentivos",
    icon: IncentivesIcon,
    permission: "sale:manage",
  },
];
const PRODUCT_TENANCY_REQUIRED = productTenancyRequired(
  import.meta.env.VITE_PRODUCT_TENANCY,
);
// El registro no se ofrece hasta aprobar términos y marca para el producto.
const PUBLIC_REGISTRATION_ENABLED = publicRegistrationEnabled(
  import.meta.env.VITE_PRODUCT_TENANCY,
  import.meta.env.VITE_PRODUCT_PUBLIC_REGISTRATION,
);
// Caras del cubo de la entrada: lo que venden Grupo MacGen y GV Makeup
// Studio, por grupo (dueña, 23-oct).
const LOGIN_CUBE = [
  {
    face: "front",
    icon: Pill,
    title: "Suplementos",
    items: "Proteínas · Creatinas · Vitaminas",
  },
  {
    face: "right",
    icon: Shirt,
    title: "Fajas",
    items: "Corsets · Chalecos · Cinturillas",
  },
  {
    face: "back",
    icon: Footprints,
    title: "Tenis y ropa",
    items: "Tenis · Ropa deportiva",
  },
  {
    face: "left",
    icon: Dumbbell,
    title: "Accesorios",
    items: "Accesorios de gym",
  },
  {
    face: "top",
    icon: Brush,
    title: "Maquillaje",
    items: "Bases · Correctores · Brochas",
    gv: true,
  },
  {
    face: "bottom",
    icon: GraduationCap,
    title: "GV Makeup Studio",
    items: "Cursos · Servicios · Productos",
    gv: true,
  },
];

function Login() {
  const loginCube = PRODUCT_TENANCY_REQUIRED
    ? productLoginFaces.map((face) => ({
        ...face,
        icon: {
          front: Package,
          right: ShoppingBag,
          back: Users,
          left: Boxes,
          top: ChartNoAxesCombined,
          bottom: Sparkles,
        }[face.face],
        gv: false,
      }))
    : LOGIN_CUBE;
  const [companyCode, setCompanyCode] = useState(() =>
      initialCompanyCode(PRODUCT_TENANCY_REQUIRED),
    ),
    [login, setLogin] = useState(""),
    [password, setPassword] = useState(""),
    [showPassword, setShowPassword] = useState(false),
    [changeRequired, setChangeRequired] = useState(false),
    [passwordPolicy, setPasswordPolicy] = useState<PasswordPolicy>("strong"),
    [newPassword, setNewPassword] = useState(""),
    [confirmPassword, setConfirmPassword] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  return (
    <div className="login-page">
      <div className="login-art">
        <div className="brand">
          <div className="brand-icon">
            n<span>•</span>
          </div>
          <span>
            nexora<span className="brand-pos">POS</span>
          </span>
        </div>
        <div>
          <span className="eyebrow light">
            {PRODUCT_TENANCY_REQUIRED
              ? "NEXORA POS"
              : "GRUPO MACGEN · GV MAKEUP STUDIO"}
          </span>
          <h1>
            {PRODUCT_TENANCY_REQUIRED ? "Tu negocio." : "Fitness y belleza."}
            <br />
            Todo bajo control.
          </h1>
          <p>
            {PRODUCT_TENANCY_REQUIRED
              ? "Ventas, inventario y caja en un solo lugar."
              : "Suplementos, fajas, tenis y maquillaje de Grupo MacGen, y los cursos y servicios de GV Makeup Studio, en un solo sistema."}
          </p>
          <div className="login-stats">
            <span>
              <Zap />
              Vende en segundos
            </span>
            <span>
              <Boxes />
              Inventario al día
            </span>
            <span>
              <Sparkles />
              Decide con claridad
            </span>
          </div>
        </div>
        <small>
          {PRODUCT_TENANCY_REQUIRED
            ? "Hecho para tu negocio."
            : "Hecho para una tienda con energía."}
        </small>
        {/* Escena 3D decorativa (solo CSS): piso en perspectiva y cubo. */}
        <div className="login-scene" aria-hidden="true">
          <div className="scene-floor" />
          <div className="scene-orbit one" />
          <div className="scene-orbit two" />
          <div className="scene-cube">
            {loginCube.map(({ face, icon: Icon, title, items, gv }) => (
              <span key={face} className={"face " + face + (gv ? " gv" : "")}>
                <Icon />
                <strong>{title}</strong>
                <small>{items}</small>
              </span>
            ))}
          </div>
        </div>
      </div>
      <div className="login-form-panel">
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            const slug = companyCode.trim().toLowerCase();
            if (!/^[a-z0-9][a-z0-9-]{1,62}$/.test(slug)) {
              setError("Escribe el código de empresa.");
              return;
            }
            if (changeRequired) {
              const validation = passwordChangeError(
                newPassword,
                confirmPassword,
                password,
                "required",
                passwordPolicy,
              );
              if (validation) {
                setError(validation);
                return;
              }
            }
            setBusy(true);
            setError("");
            try {
              if (!changeRequired) {
                const terminal = storedTerminalCredentials();
                const data = await api("/auth/login", {
                  method: "POST",
                  headers: { "x-tenant-id": slug },
                  body: JSON.stringify({
                    login,
                    password,
                    ...(terminal ? { terminal } : {}),
                  }),
                });
                if (data.requiresPasswordChange) {
                  setPasswordPolicy(
                    data.passwordPolicy === "cashier-six-digits"
                      ? "cashier-six-digits"
                      : "strong",
                  );
                  setChangeRequired(true);
                  setError("");
                  return;
                }
                await saveSession(data.user, data.accessToken);
              } else {
                const terminal = storedTerminalCredentials();
                const data = await api("/auth/change-password", {
                  method: "POST",
                  headers: { "x-tenant-id": slug },
                  body: JSON.stringify({
                    login,
                    currentPassword: password,
                    newPassword,
                    confirmPassword,
                    ...(terminal ? { terminal } : {}),
                  }),
                });
                await saveSession(data.user, data.accessToken);
              }
            } catch (e: any) {
              setError(
                changeRequired
                  ? friendlyPasswordChangeError(e, "required", passwordPolicy)
                  : e.message,
              );
            } finally {
              setBusy(false);
            }
          }}
        >
          <span className="eyebrow">
            {PRODUCT_TENANCY_REQUIRED
              ? "BIENVENIDA A NEXORA"
              : "BIENVENIDA · MACGEN & GV"}
          </span>
          <h2>
            {changeRequired
              ? "Actualiza tu contraseña."
              : "Un nuevo día para crecer."}
          </h2>
          <p>
            {changeRequired
              ? "Por seguridad, crea una contraseña nueva para continuar."
              : "Inicia sesión para entrar a tu tienda."}
          </p>
          {PRODUCT_TENANCY_REQUIRED && (
            <label className="field">
              <span>Código de empresa</span>
              <input
                type="text"
                autoComplete="organization"
                required
                placeholder="Ejemplo: mi-tienda"
                value={companyCode}
                onChange={(e) => setCompanyCode(e.target.value)}
              />
            </label>
          )}
          <label className="field">
            <span>Usuario</span>
            <input
              type="text"
              autoComplete="username"
              required
              placeholder="Tu usuario o correo"
              value={login}
              onChange={(e) => setLogin(e.target.value)}
            />
          </label>
          <label className="field">
            <span>{changeRequired ? "Contraseña temporal" : "Contraseña"}</span>
            <input
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              required
              placeholder="Tu contraseña"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>
          {/* 05-B11: ver lo que se escribe, útil con el teclado del celular. */}
          <button
            type="button"
            className="link-button show-password"
            aria-pressed={showPassword}
            onClick={() => setShowPassword(!showPassword)}
          >
            Mostrar contraseña
          </button>
          {changeRequired && (
            <PasswordChangeFields
              password={newPassword}
              confirmation={confirmPassword}
              onPassword={setNewPassword}
              onConfirmation={setConfirmPassword}
              policy={passwordPolicy}
            />
          )}
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          <Button className="full-width" disabled={busy}>
            {busy
              ? "Procesando…"
              : changeRequired
                ? "Guardar contraseña y entrar"
                : PRODUCT_TENANCY_REQUIRED
                  ? "Entrar a mi empresa"
                  : "Entrar a mi tienda"}
            <ArrowUpRight size={18} />
          </Button>
          {PUBLIC_REGISTRATION_ENABLED && (
            <p>
              <a href="/registro">Crear empresa · 14 días gratis</a>
            </p>
          )}
          {SHOW_DEMO_CREDENTIALS && !PRODUCT_TENANCY_REQUIRED && (
            <div className="demo-note">
              <Badge tone="violet">Demostración</Badge>
              <p>
                Cuenta: admin@fitstore.demo
                <br />
                Contraseña: FitStore-Demo-2026!
              </p>
              <small>Datos ficticios · comprobantes internos no fiscales</small>
            </div>
          )}
        </form>
      </div>
    </div>
  );
}

// «Cambiar mi contraseña» desde el menú de la cuenta, para cualquier usuario.
// Mismas reglas que el cambio obligatorio; el servidor exige la contraseña
// actual, cierra las demás sesiones y deja este equipo dentro.
function ChangeOwnPassword({ onClose }: { onClose: () => void }) {
  const [current, setCurrent] = useState(""),
    [newPassword, setNewPassword] = useState(""),
    [confirmPassword, setConfirmPassword] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const user = useStore((s) => s.user);
  const role = user?.role;
  const policy =
    (user as (typeof user & { passwordPolicy?: PasswordPolicy }) | null)
      ?.passwordPolicy ??
    (isCashierPasswordRole(role) ? "cashier-six-digits" : "strong");
  return (
    <Modal open onClose={onClose} title="Cambiar mi contraseña">
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          const validation = passwordChangeError(
            newPassword,
            confirmPassword,
            current,
            "voluntary",
            policy,
          );
          if (validation) {
            setError(validation);
            return;
          }
          setBusy(true);
          setError("");
          try {
            const data = await post("/auth/password", {
              currentPassword: current,
              newPassword,
              confirmPassword,
            });
            await saveSession(data.user, data.accessToken);
            toast(
              "Tu contraseña se cambió. Se cerraron tus otras sesiones abiertas.",
            );
            onClose();
          } catch (e) {
            setError(friendlyPasswordChangeError(e, "voluntary", policy));
          } finally {
            setBusy(false);
          }
        }}
      >
        <label className="field">
          <span>Contraseña actual</span>
          <input
            type="password"
            autoComplete="current-password"
            autoCapitalize="none"
            spellCheck={false}
            inputMode="text"
            required
            maxLength={128}
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
          />
        </label>
        <PasswordChangeFields
          password={newPassword}
          confirmation={confirmPassword}
          onPassword={setNewPassword}
          onConfirmation={setConfirmPassword}
          policy={policy}
          intro="Elige una contraseña nueva y personal; no la compartas. Al guardar se cierran tus otras sesiones abiertas; en este equipo sigues dentro."
        />
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <div className="modal-footer">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button disabled={busy}>
            {busy ? "Guardando…" : "Guardar contraseña"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function Shell() {
  const { user, online, theme, toggleTheme, setOnline } = useStore();
  const businessSettings = useQuery<{ name?: string; branchName?: string }>({
    queryKey: ["settings", user?.branchId],
    queryFn: () => api("/settings"),
    enabled: !!user && online && can(user.permissions, "catalog:read"),
  });
  const sidebarLabels = businessSidebarLabels(businessSettings.data);
  const alertBell = useQuery({
    queryKey: ["alert-bell"],
    queryFn: () => api<any[]>("/alerts?status=new"),
    enabled: !!user && online && can(user.permissions, "alerts:write"),
  });
  const alertCount =
    alertBell.data?.filter((a) => a.status === "new").length ?? 0;
  const [ready, setReady] = useState(false),
    [page, setPage] = useState(location.hash.slice(1) || "dashboard"),
    [menu, setMenu] = useState(false),
    [commands, setCommands] = useState(false),
    [commandQuery, setCommandQuery] = useState(""),
    [help, setHelp] = useState(false),
    [syncing, setSyncing] = useState(false),
    [pending, setPending] = useState(0),
    [account, setAccount] = useState(false),
    [switchUser, setSwitchUser] = useState(false),
    [staff, setStaff] = useState<any[]>([]),
    [switchId, setSwitchId] = useState(""),
    [pin, setPin] = useState(""),
    [idleDeadline, setIdleDeadline] = useState<number | null>(null),
    [about, setAbout] = useState(false),
    [ownPassword, setOwnPassword] = useState(false);
  const client = useQueryClient();
  const mobile = useMediaQuery(MOBILE_MENU);
  const menuButton = useRef<HTMLButtonElement>(null),
    sidebar = useRef<HTMLElement>(null),
    stayActive = useRef(() => {});
  const allowed = navigation.filter(
    (n) =>
      user &&
      (!["onboarding", "billing"].includes(n.id) || PRODUCT_TENANCY_REQUIRED) &&
      can(user.permissions, n.permission),
  );
  const onboarding = useQuery<OnboardingStatus>({
    queryKey: ["onboarding", user?.id],
    queryFn: () => api("/onboarding"),
    enabled: PRODUCT_TENANCY_REQUIRED && !!user && can(user.permissions, "*"),
  });
  useRealtime();
  const go = (id: string) => {
    location.hash = id;
    setPage(id);
    setMenu(false);
    setCommands(false);
  };
  useEffect(() => {
    if (
      user &&
      page === "dashboard" &&
      onboarding.data?.available &&
      !onboarding.data.dismissed
    )
      go("onboarding");
  }, [user?.id, page, onboarding.data?.available, onboarding.data?.dismissed]);
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);
  // G12: al abrir el menú en celular, el foco entra en él.
  useEffect(() => {
    if (mobile && menu)
      sidebar.current?.querySelector<HTMLElement>(".nav-item")?.focus();
  }, [mobile, menu]);
  useEffect(() => {
    (async () => {
      const saved = await localDB.cache.get("session").catch(() => undefined);
      const valid = saved?.data?.expiresAt > Date.now();
      try {
        // La sesión de este equipo venció por inactividad (o no se pudo
        // cerrar en el servidor): se pide la contraseña aunque la cookie de
        // renovación siga viva (R9-offline-5).
        if (saved && !valid) {
          await endSession();
          return;
        }
        await refreshSession();
        // Abrir o recargar la aplicación es actividad.
        const current = useStore.getState().user;
        if (current)
          await localDB.cache.update("session", {
            "data.expiresAt": sessionDeadline(current),
          });
      } catch (e) {
        // Sin red, o sin internet con la red local activa (navigator.onLine
        // sigue en true), se entra con la sesión guardada. Si el servidor
        // rechaza la sesión, se pide la contraseña (R9-offline-1).
        if (isNetworkError(e) && valid)
          useStore.getState().setSession(saved!.data.user, null);
      } finally {
        setReady(true);
      }
    })();
    const hash = () => setPage(location.hash.slice(1) || "dashboard");
    const connected = () => setOnline(true),
      disconnected = () => setOnline(false);
    window.addEventListener("hashchange", hash);
    window.addEventListener("online", connected);
    window.addEventListener("offline", disconnected);
    return () => {
      window.removeEventListener("hashchange", hash);
      window.removeEventListener("online", connected);
      window.removeEventListener("offline", disconnected);
    };
  }, [setOnline]);
  // Sin internet pero con la red local activa nunca llega el evento «online»:
  // mientras la caja esté sin conexión se prueba el servidor cada 5 s
  // (R9-offline-1).
  useEffect(() => {
    if (online) return;
    const timer = setInterval(async () => {
      if (!navigator.onLine) return;
      try {
        const response = await fetch("/api/health", {
          cache: "no-store",
          signal: AbortSignal.timeout(4000),
        });
        if (response.ok) setOnline(true);
      } catch {
        /* Sigue sin conexión. */
      }
    }, 5000);
    return () => clearInterval(timer);
  }, [online, setOnline]);
  useEffect(() => {
    if (
      user &&
      !allowed.some((n) => n.id === page) &&
      page !== "settings" &&
      !(page === "styles" && SHOW_STYLE_GUIDE)
    )
      go(allowed[0]?.id || "products");
  }, [user, page]);
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    const update = async () => {
      const count = await localDB.sales.where("userId").equals(user.id).count();
      if (!cancelled) setPending(count);
    };
    update();
    const timer = setInterval(update, 4000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [user]);
  // N-M3: ante un error transitorio del servidor («retry») las ventas siguen
  // pendientes y se reenvían solas, con espera creciente y el mismo UUID.
  const retryTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const retryAttempt = useRef(0);
  const latestSynchronize = useRef<() => Promise<void>>(async () => undefined);
  const scheduleRetry = () => {
    clearTimeout(retryTimer.current);
    retryTimer.current = setTimeout(
      () => latestSynchronize.current(),
      retryDelayMs(retryAttempt.current++),
    );
  };
  useEffect(() => () => clearTimeout(retryTimer.current), []);
  const synchronize = async () => {
    if (syncing || !online) return;
    setSyncing(true);
    try {
      await registerTerminal();
      await syncMerchandise();
      const result = await syncSales();
      if (result.synced) toast(`${result.synced} ventas sincronizadas.`);
      if (result.conflicts)
        toast(`${result.conflicts} ventas requieren revisión en Caja.`, true);
      if (result.retry) {
        toast(retryMessage(result.retry), true);
        scheduleRetry();
      } else retryAttempt.current = 0;
      await client.invalidateQueries();
    } catch (e: any) {
      toast(e.message, true);
    } finally {
      setSyncing(false);
    }
  };
  latestSynchronize.current = synchronize;
  useEffect(() => {
    if (user && online) synchronize();
  }, [user?.id, online]);
  useEffect(() => {
    const keyboard = (e: KeyboardEvent) => {
      // Con Bloq Mayús o Mayús llega «K».
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setCommands(true);
      }
      if (e.key === "Escape") {
        setCommands(false);
        setMenu(false);
        // El foco vuelve al botón que abrió el menú (G12).
        if (sidebar.current?.contains(document.activeElement))
          menuButton.current?.focus();
      }
      // Atajos del sistema anterior: F9 Entrada de mercancía, F7 Etiquetas,
      // F10 Precios (F2, F4, F8 y F12 son de la caja).
      const target = (
        { F9: "merchandise", F7: "products", F10: "products" } as Record<
          string,
          string
        >
      )[e.key];
      const page = navigation.find((n) => n.id === target);
      const current = useStore.getState().user;
      if (page && current && can(current.permissions, page.permission)) {
        e.preventDefault();
        location.hash = page.id;
        setPage(page.id);
        setMenu(false);
        setCommands(false);
        if (e.key === "F7")
          toast("Busca el producto y pulsa su botón de etiquetas.");
      }
    };
    window.addEventListener("keydown", keyboard);
    return () => window.removeEventListener("keydown", keyboard);
  }, []);
  useEffect(() => {
    if (!user) return;
    const timeout = (user.sessionTimeoutMinutes ?? 30) * 60000;
    const warnBefore = Math.min(IDLE_WARNING_MS, timeout / 2);
    let last = Date.now(),
      // 05-N2: la última vez que una persona tocó la pantalla. `last` también
      // se alarga cuando hay trabajo sin terminar; éste, no.
      touched = Date.now(),
      closing = false,
      checking = false;
    const extend = () => {
      last = Date.now();
      setIdleDeadline(null);
      localDB.cache.update("session", { "data.expiresAt": last + timeout });
    };
    const active = () => {
      touched = Date.now();
      extend();
    };
    stayActive.current = active;
    // 05-A3: con artículos en el carrito o ventas sin sincronizar en este
    // equipo, la inactividad espera. Sin internet, cerrarla dejaba a la cajera
    // sin poder entrar ni vender y perdía el carrito. 05-N2: con tope; un
    // carrito olvidado ya no deja la sesión abierta toda la noche (sólo la cola
    // sin enviar y sin conexión espera sin límite).
    const holdsWork = async () => {
      const cartItems = useStore.getState().cart.length;
      const pendingSales = await localDB.sales
        .where("userId")
        .equals(user.id)
        .filter((sale) => sale.status === "pending")
        .count()
        .catch(() => 0);
      return inactivityWaits({
        cartItems,
        pendingSales,
        online: useStore.getState().online,
        untouchedMs: Date.now() - touched,
        timeoutMs: timeout,
      });
    };
    const check = async () => {
      if (closing || checking || Date.now() - last <= timeout - warnBefore)
        return;
      checking = true;
      try {
        if (await holdsWork()) {
          extend();
          return;
        }
        // Otra pestaña de este equipo pudo tener actividad: el plazo guardado
        // es el de todo el equipo.
        const saved = await localDB.cache.get("session").catch(() => undefined);
        const shared = Number(saved?.data?.expiresAt) - timeout;
        if (shared > last) last = shared;
        const idle = Date.now() - last;
        if (idle <= timeout - warnBefore) {
          setIdleDeadline(null);
          return;
        }
        // G12: aviso previo con «Seguir conectado» antes de cerrar.
        if (idle <= timeout) {
          setIdleDeadline(last + timeout);
          return;
        }
        // Antes sólo se borraba el estado del navegador: la cookie y la
        // sesión del servidor seguían vivas y al recargar volvía a entrar el
        // usuario anterior (R9-offline-5).
        closing = true;
        setIdleDeadline(null);
        // 05-N2: el carrito a medias no se pierde al bloquear la pantalla.
        await keepDraftThrough(endSession);
        client.clear();
        toast("Sesión cerrada por inactividad.");
      } finally {
        checking = false;
      }
    };
    const interval = setInterval(check, 5000);
    window.addEventListener("pointerdown", active);
    window.addEventListener("keydown", active);
    return () => {
      clearInterval(interval);
      setIdleDeadline(null);
      window.removeEventListener("pointerdown", active);
      window.removeEventListener("keydown", active);
    };
  }, [user?.id]);
  if (!ready) return <Loading />;
  if (!user) return <Login />;
  if (PRODUCT_TENANCY_REQUIRED && window.location.pathname === "/mcp/autorizar")
    return <McpAuthorize />;
  const current = navigation.find((n) => n.id === page);
  const initials = user.name
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("");
  const pages: Record<string, React.ReactNode> = {
    onboarding: <Onboarding go={go} />,
    billing: <Billing />,
    dashboard: <Dashboard go={go} />,
    "month-report": <MonthReport go={go} />,
    pos: <POS go={go} />,
    products: <Catalog />,
    inventory: <Inventory />,
    purchases: <Purchases />,
    cash: <Cash />,
    expenses: <Expenses />,
    customers: <Customers />,
    promotions: <Promotions />,
    reports: <Reports />,
    alerts: <Alerts go={go} />,
    settings: <Configuration />,
    ...(SHOW_STYLE_GUIDE ? { styles: <StyleGuide /> } : {}),
    sales: <SalesHistory />,
    "void-requests": <VoidRequests />,
    "transfer-reconciliation": <TransferReconciliation />,
    "courier-payouts": <CourierPayouts />,
    merchandise: <Merchandise />,
    incentives: <IncentivesPage />,
  };
  return (
    <div className={`app-shell ${page === "pos" ? "pos-shell" : ""}`}>
      {menu && (
        <button
          className="sidebar-backdrop"
          aria-label="Cerrar menú"
          onClick={() => {
            setMenu(false);
            menuButton.current?.focus();
          }}
        />
      )}
      {can(user.permissions, "inventory:write") &&
        user.role !== "seller" &&
        page !== "merchandise" &&
        page !== "pos" && (
          <nav className="goods-mobile-bar">
            <Button onClick={() => go("merchandise")}>
              <Truck size={24} /> Mercancía
            </Button>
          </nav>
        )}
      {/* G12: en celular, el menú cerrado queda fuera del orden de tabulación
          y del lector de pantalla. */}
      <aside
        ref={sidebar}
        className={`sidebar ${menu ? "open" : ""}`}
        inert={mobile && !menu}
        aria-hidden={mobile && !menu ? true : undefined}
      >
        <a className="brand" href="#dashboard">
          <div className="brand-icon">
            n<span>•</span>
          </div>
          <span>
            nexora<span className="brand-pos">POS</span>
          </span>
        </a>
        <div className="store-switch">
          <div className="store-avatar">
            <ShoppingBag size={18} />
          </div>
          <div>
            <strong>{sidebarLabels.branch}</strong>
            <small>{sidebarLabels.business}</small>
          </div>
          <ChevronDown size={15} />
        </div>
        <div className="nav-caption">TU NEGOCIO</div>
        <nav>
          {allowed.map((n) => (
            <button
              key={n.id}
              className={`nav-item ${page === n.id ? "active" : ""}`}
              onClick={() => go(n.id)}
            >
              <n.icon size={19} />
              <span>{n.label}</span>
              {page === n.id && <span className="nav-dot" />}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <DesktopPrinterControls />
          <div className="help-card">
            <div className="help-symbol">✦</div>
            <strong>Ayuda para trabajar</strong>
            <p>
              Consulta los pasos de venta
              <br />y los atajos de tu caja.
            </p>
            <button onClick={() => setHelp(true)}>
              Ver ayuda <ArrowUpRight size={15} />
            </button>
          </div>
          {can(user.permissions, "sale:manage") && (
            <button
              className={`nav-item ${page === "settings" ? "active" : ""}`}
              onClick={() => go("settings")}
            >
              <Settings size={19} />
              Configuración
            </button>
          )}
          <button
            className="nav-item"
            onClick={() => {
              setAbout(true);
              setMenu(false);
            }}
          >
            <Info size={19} />
            Acerca de
          </button>
          {SHOW_STYLE_GUIDE && (
            <button className="nav-item" onClick={() => go("styles")}>
              <Palette size={19} />
              Guía de estilos
            </button>
          )}
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <div className="topbar-left">
            <button
              ref={menuButton}
              className="icon-button mobile-menu"
              aria-expanded={mobile ? menu : undefined}
              onClick={() => setMenu(true)}
              aria-label="Abrir menú"
            >
              <Menu />
            </button>
            <span className="breadcrumb">
              Mi tienda <span>/</span>
              <strong>
                {current?.label ||
                  (page === "styles" ? "Guía de estilos" : "Configuración")}
              </strong>
            </span>
          </div>
          <div className="topbar-right">
            <button className="global-search" onClick={() => setCommands(true)}>
              <Search size={17} />
              <span>Buscar en Nexora</span>
              <kbd>⌘ K</kbd>
            </button>
            <button
              className={`connection ${online ? "" : "offline"}`}
              onClick={synchronize}
              title={
                pending
                  ? `${pending} ventas pendientes`
                  : online
                    ? "Conectado"
                    : "Sin conexión"
              }
            >
              {syncing ? (
                <RefreshCw size={15} className="spin" />
              ) : online ? (
                <Wifi size={15} />
              ) : (
                <WifiOff size={15} />
              )}
              <span>
                {syncing
                  ? "Sincronizando"
                  : online
                    ? "En línea"
                    : "Sin conexión"}
                {pending ? ` · ${pending}` : ""}
              </span>
            </button>
            <button
              className="icon-button"
              onClick={toggleTheme}
              aria-label={
                theme === "light" ? "Activar modo oscuro" : "Activar modo claro"
              }
            >
              {theme === "light" ? <Moon size={19} /> : <Sun size={19} />}
            </button>
            {PRODUCT_TENANCY_REQUIRED && (
              <SupportHelp
                userName={user.name}
                screen={current?.label || "Configuración"}
                admin={can(user.permissions, "*")}
              />
            )}
            {can(user.permissions, "alerts:write") && (
              <button
                className="icon-button notification-bell"
                onClick={() => go("alerts")}
                aria-label={`Ver alertas${alertCount ? ": " + alertCount + " nuevas" : ""}`}
              >
                <Bell size={20} />
                {alertCount > 0 && <i title={`${alertCount} alertas nuevas`} />}
              </button>
            )}
            <div className="topbar-separator" />
            <button className="account" onClick={() => setAccount(!account)}>
              <span className="avatar">{initials}</span>
              <div>
                <strong>{user.name}</strong>
                <small>
                  {{
                    admin: "Administradora",
                    manager: "Gerente",
                    seller: "Vendedora",
                    warehouse: "Almacén",
                  }[user.role] || user.role}
                </small>
              </div>
              <ChevronDown size={15} />
            </button>
            {account && (
              <div className="account-menu">
                {can(user.permissions, "sale:write") && (
                  <button
                    onClick={async () => {
                      // 05-B13: sin conexión la lista no llega; antes no se
                      // veía nada.
                      try {
                        setStaff(await api("/staff"));
                        setSwitchUser(true);
                      } catch (e) {
                        toast(
                          isNetworkError(e)
                            ? "Necesitas conexión para cambiar de vendedor."
                            : (e as Error).message,
                          true,
                        );
                      } finally {
                        setAccount(false);
                      }
                    }}
                  >
                    Cambiar de usuario con PIN
                  </button>
                )}
                <button
                  onClick={() => {
                    setOwnPassword(true);
                    setAccount(false);
                  }}
                >
                  <KeyRound size={16} />
                  Cambiar mi contraseña
                </button>
                <button
                  onClick={async () => {
                    // La cola local permanece hasta que su dueño vuelva a
                    // entrar. Sin conexión, la sesión queda vencida en este
                    // equipo (R9-offline-5).
                    await endSession();
                    client.clear();
                    setAccount(false);
                  }}
                >
                  <LogOut size={16} />
                  Cerrar sesión
                </button>
              </div>
            )}
          </div>
        </header>
        <main className={`main-content ${page === "pos" ? "pos-content" : ""}`}>
          {PRODUCT_TENANCY_REQUIRED && can(user.permissions, "*") && <SupportAccessBanner />}
          <DeviceGate />
          {pages[page.split("?")[0]] || <Dashboard go={go} />}
        </main>
        <footer className="app-footer">
          <span>Nexora POS · Tu negocio, en movimiento.</span>
          <span>RD$ · ITBIS incluido · Documento interno</span>
        </footer>
      </div>
      <Modal
        open={commands}
        onClose={() => setCommands(false)}
        title="¿A dónde quieres ir?"
      >
        <label className="field">
          <input
            autoFocus
            aria-label="Buscar pantalla"
            placeholder="Buscar pantalla…"
            value={commandQuery}
            onChange={(e) => setCommandQuery(e.target.value)}
          />
        </label>
        <div className="command-list">
          {allowed
            .filter((n) =>
              n.label.toLowerCase().includes(commandQuery.toLowerCase()),
            )
            .map((n) => (
              <button onClick={() => go(n.id)} key={n.id}>
                <n.icon size={20} />
                {n.label}
                <ArrowUpRight size={16} />
              </button>
            ))}
        </div>
      </Modal>
      <Modal
        open={help}
        onClose={() => setHelp(false)}
        title="Centro de ayuda"
      >
        <p>Guías breves para las tareas habituales.</p>
        <details><summary>Vender y cobrar</summary><p>Abre tu caja, busca el producto y elige su variante. Revisa cliente, cantidades y total antes de cobrar. Puedes combinar efectivo, tarjeta y transferencia.</p></details>
        <details><summary>Cobrar un crédito</summary><p>En Créditos pendientes, abre el estado de cuenta, revisa el saldo y registra el abono en la forma de pago recibida. Una transferencia queda pendiente de verificación cuando corresponde.</p></details>
        <details><summary>Cerrar la caja</summary><p>Sincroniza las ventas pendientes, cierra el lote del verifón, cuenta el efectivo por denominación y escribe la tarjeta declarada. Lee el cuadre impreso y avisa a administración si hay diferencia.</p></details>
        <details><summary>Trabajar sin conexión</summary><p>Las ventas pendientes quedan en este dispositivo. No borres los datos del navegador ni cambies de equipo. Al volver la conexión, revisa la sincronización y los conflictos en Caja.</p></details>
        <p><a href="/estado.html" target="_blank" rel="noopener noreferrer">Consultar estado del servicio</a></p>
        <h3>Atajos de teclado</h3>
        <div className="shortcut-list">
          <span>
            <kbd>F2</kbd> Buscar producto
          </span>
          <span>
            <kbd>F4</kbd> Elegir cliente
          </span>
          <span>
            <kbd>F8</kbd> Poner venta en espera
          </span>
          <span>
            <kbd>F12</kbd> Cobrar
          </span>
          <span>
            <kbd>F9</kbd> Entrada de mercancía
          </span>
          <span>
            <kbd>F7</kbd> Etiquetas
          </span>
          <span>
            <kbd>F10</kbd> Precios
          </span>
          <span>
            <kbd>Ctrl + K</kbd> Cambiar pantalla
          </span>
        </div>
        <p>
          Si tu tienda permite ventas sin internet, quedan pendientes en este
          dispositivo. No borres sus datos ni cambies de equipo hasta reconectar
          y sincronizar. Si aparece un conflicto, avisa a gerencia y revisa
          Caja.
        </p>
        <Button
          onClick={() => {
            go("pos");
            setHelp(false);
          }}
        >
          Ir al punto de venta
        </Button>
      </Modal>
      <About open={about} onClose={() => setAbout(false)} />
      {PRODUCT_TENANCY_REQUIRED && user.role !== "support" && <Assistant online={online} />}
      {ownPassword && (
        <ChangeOwnPassword onClose={() => setOwnPassword(false)} />
      )}
      {idleDeadline !== null && (
        <IdleWarning
          deadline={idleDeadline}
          onStay={() => stayActive.current()}
        />
      )}
      <Modal
        open={switchUser}
        onClose={() => setSwitchUser(false)}
        title="Cambiar de usuario"
      >
        <p className="modal-intro">
          Entras con la sesión y la caja de esa persona: cada usuario vende solo
          en su propia caja. Si no tiene una abierta, debe abrir la suya.
        </p>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            try {
              const result = await post("/auth/pin", {
                userId: switchId,
                pin,
              });
              // 05-M1: el carrito de quien sale queda guardado a su nombre
              // (cartDraft.ts) y la nueva persona ve el suyo.
              client.clear();
              await saveSession(result.user, result.accessToken);
              setSwitchUser(false);
              setPin("");
            } catch (e: any) {
              toast(e.message, true);
            }
          }}
        >
          <label className="field">
            <span>Usuario</span>
            <select
              required
              value={switchId}
              onChange={(e) => setSwitchId(e.target.value)}
            >
              <option value="">Seleccionar…</option>
              {staff.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>PIN</span>
            <input
              type="password"
              inputMode="numeric"
              pattern="[0-9]{4,6}"
              required
              value={pin}
              onChange={(e) => setPin(e.target.value)}
            />
          </label>
          <Button>Entrar</Button>
        </form>
      </Modal>
    </div>
  );
}
// Los avisos quedan fuera de las pantallas, en el mismo lugar con y sin
// sesión: así «Sesión cerrada por inactividad» sigue a la vista en el inicio
// de sesión (R9-offline-5).
export function App() {
  if (PUBLIC_REGISTRATION_ENABLED && window.location.pathname === "/registro")
    return <Registration />;
  if (
    PRODUCT_TENANCY_REQUIRED &&
    window.location.pathname === "/confirmar-correo"
  )
    return <ConfirmEmail />;
  if (
    PRODUCT_TENANCY_REQUIRED &&
    window.location.pathname === "/aceptar-invitacion"
  )
    return <AcceptInvitation />;
  return (
    <>
      <Shell />
      <Toasts />
    </>
  );
}
