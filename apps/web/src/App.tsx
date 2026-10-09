import { DeviceGate, useRealtime, registerTerminal } from "./realtime";
import { Merchandise } from "./Merchandise";
import { useEffect, useState } from "react";
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
} from "lucide-react";
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
import { Toasts, toast } from "./helpers";
import { Dashboard } from "./Dashboard";
import { POS } from "./POS";
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

const navigation = [
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
];
function Login() {
  const [login, setLogin] = useState(""),
    [password, setPassword] = useState(""),
    [changeRequired, setChangeRequired] = useState(false),
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
          <span className="eyebrow light">TU TIENDA. TU RITMO.</span>
          <h1>
            Todo bajo control.
            <br />
            Más espacio
            <br />
            para crecer.
          </h1>
          <p>Ventas, inventario y decisiones que mueven tu negocio.</p>
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
        <small>Hecho para una tienda con energía.</small>
        <div className="art-circle one" />
        <div className="art-circle two" />
      </div>
      <div className="login-form-panel">
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setError("");
            try {
              if (!changeRequired) {
                const data = await post("/auth/login", { login, password });
                if (data.requiresPasswordChange) {
                  setChangeRequired(true);
                  setError("");
                  return;
                }
                await saveSession(data.user, data.accessToken);
              } else {
                const data = await post("/auth/change-password", {
                  login,
                  currentPassword: password,
                  newPassword,
                  confirmPassword,
                });
                await saveSession(data.user, data.accessToken);
              }
            } catch (e: any) {
              setError(e.message);
            } finally {
              setBusy(false);
            }
          }}
        >
          <span className="eyebrow">BIENVENIDA A NEXORA</span>
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
          <label className="field">
            <span>Usuario</span>
            <input
              type="text"
              autoComplete="username"
              required
              placeholder="mfeliz"
              value={login}
              onChange={(e) => setLogin(e.target.value)}
            />
          </label>
          <label className="field">
            <span>{changeRequired ? "Contraseña temporal" : "Contraseña"}</span>
            <input
              type="password"
              autoComplete="current-password"
              required
              placeholder="Tu contraseña"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>
          {changeRequired && (
            <>
              <label className="field">
                <span>Nueva contraseña</span>
                <input
                  type="password"
                  autoComplete="new-password"
                  required
                  minLength={12}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                />
              </label>
              <label className="field">
                <span>Confirma la nueva contraseña</span>
                <input
                  type="password"
                  autoComplete="new-password"
                  required
                  minLength={12}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                />
              </label>
              <small>
                Usa al menos 12 caracteres, con mayúscula, minúscula, número y
                símbolo.
              </small>
            </>
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
                : "Entrar a mi tienda"}
            <ArrowUpRight size={18} />
          </Button>
          {SHOW_DEMO_CREDENTIALS && (
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

function Shell() {
  const { user, online, theme, toggleTheme, setOnline } = useStore();
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
    [pin, setPin] = useState("");
  const client = useQueryClient();
  const allowed = navigation.filter(
    (n) => user && can(user.permissions, n.permission),
  );
  useRealtime();
  const go = (id: string) => {
    location.hash = id;
    setPage(id);
    setMenu(false);
    setCommands(false);
  };
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);
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
      await client.invalidateQueries();
    } catch (e: any) {
      toast(e.message, true);
    } finally {
      setSyncing(false);
    }
  };
  useEffect(() => {
    if (user && online) synchronize();
  }, [user?.id, online]);
  useEffect(() => {
    const keyboard = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        setCommands(true);
      }
      if (e.key === "Escape") {
        setCommands(false);
        setMenu(false);
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
    let last = Date.now(),
      closing = false;
    const active = () => {
      last = Date.now();
      localDB.cache.update("session", { "data.expiresAt": last + timeout });
    };
    const interval = setInterval(async () => {
      if (closing || Date.now() - last <= timeout) return;
      // Otra pestaña de este equipo pudo tener actividad: el plazo guardado
      // es el de todo el equipo.
      const saved = await localDB.cache.get("session").catch(() => undefined);
      if (saved?.data?.expiresAt > Date.now()) {
        last = saved!.data.expiresAt - timeout;
        return;
      }
      // Antes sólo se borraba el estado del navegador: la cookie y la sesión
      // del servidor seguían vivas y al recargar volvía a entrar el usuario
      // anterior (R9-offline-5).
      closing = true;
      await endSession();
      client.clear();
      toast("Sesión cerrada por inactividad.");
    }, 30000);
    window.addEventListener("pointerdown", active);
    window.addEventListener("keydown", active);
    return () => {
      clearInterval(interval);
      window.removeEventListener("pointerdown", active);
      window.removeEventListener("keydown", active);
    };
  }, [user?.id]);
  if (!ready) return <Loading />;
  if (!user) return <Login />;
  const current = navigation.find((n) => n.id === page);
  const initials = user.name
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("");
  const pages: Record<string, React.ReactNode> = {
    dashboard: <Dashboard go={go} />,
    pos: <POS go={go} />,
    products: <Catalog />,
    inventory: <Inventory />,
    purchases: <Purchases />,
    cash: <Cash />,
    expenses: <Expenses />,
    customers: <Customers />,
    promotions: <Promotions />,
    reports: <Reports />,
    alerts: <Alerts />,
    settings: <Configuration />,
    ...(SHOW_STYLE_GUIDE ? { styles: <StyleGuide /> } : {}),
    sales: <SalesHistory />,
    merchandise: <Merchandise />,
  };
  return (
    <div className={`app-shell ${page === "pos" ? "pos-shell" : ""}`}>
      {menu && (
        <button
          className="sidebar-backdrop"
          aria-label="Cerrar menú"
          onClick={() => setMenu(false)}
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
      <aside className={`sidebar ${menu ? "open" : ""}`}>
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
            <strong>Tienda principal</strong>
            <small>República Dominicana</small>
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
              className="icon-button mobile-menu"
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
                {syncing ? "Sincronizando" : online ? "En línea" : "Offline"}
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
                      setStaff(await api("/staff"));
                      setSwitchUser(true);
                      setAccount(false);
                    }}
                  >
                    Cambiar vendedor con PIN
                  </button>
                )}
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
          <DeviceGate />
          {pages[page] || <Dashboard go={go} />}
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
        title="Tu tienda, en movimiento"
      >
        <p>
          Abre tu caja, busca un producto en Punto de venta y agrega sus
          variantes. Cobrar permite combinar efectivo, tarjeta y transferencia.
        </p>
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
      <Modal
        open={switchUser}
        onClose={() => setSwitchUser(false)}
        title="Cambiar vendedor"
      >
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            try {
              const result = await post("/auth/pin", {
                userId: switchId,
                pin,
              });
              useStore.getState().clearCart();
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
            <span>Vendedor</span>
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
            <span>PIN de 4–6 dígitos</span>
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
  return (
    <>
      <Shell />
      <Toasts />
    </>
  );
}
