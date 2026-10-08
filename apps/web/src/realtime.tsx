import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { create } from "zustand";
import {
  BadgeCheck,
  Laptop,
  MonitorSmartphone,
  ShieldAlert,
  Smartphone,
} from "lucide-react";
import { Badge, Button, Modal } from "@fitstore/ui";
import { can, formatMoney } from "@fitstore/shared";
import {
  api,
  CartItem,
  loadCatalog,
  localDB,
  post,
  Product,
  refreshCart,
  refreshSession,
  useStore,
} from "./api";
import { attrLabel, toast } from "./helpers";
// «Producto · talla: RD$ 1,500.00 → RD$ 1,700.00» (R9-offline-3).
export const priceChanges = (changes: { item: CartItem; before: number }[]) =>
  changes
    .map(({ item, before }) => {
      const label = attrLabel(item.variant.attributes || {});
      return (
        (label === "Única"
          ? item.product.name
          : item.product.name + " · " + label) +
        ": " +
        formatMoney(before) +
        " → " +
        formatMoney(item.variant.price)
      );
    })
    .join("; ");
// Aviso de las líneas del carrito que cambiaron de precio. Lo usan el POS y
// el canal de avisos al reconectar: ese llega antes que el efecto del POS y,
// sin el aviso aquí, el total cambiaba sin que la cajera lo supiera
// (R9-offline-3).
export function announcePriceChanges(
  changes: { item: CartItem; before: number }[],
) {
  if (changes.length)
    toast(
      "Precio actualizado: " +
        priceChanges(changes) +
        ". Revisa el total antes de cobrar.",
      true,
    );
}
type Identity = { id: string; name: string; secret: string };
const randomSecret = () =>
  Array.from(crypto.getRandomValues(new Uint8Array(24)), (b) =>
    b.toString(16).padStart(2, "0"),
  ).join("");
const defaultDeviceName = () =>
  (/Mobi|Android|iPhone|iPad/i.test(navigator.userAgent)
    ? "Celular "
    : "Computadora ") + crypto.randomUUID().slice(0, 4).toUpperCase();
// Identidad local del equipo: id + secreto que sólo conoce este navegador.
export function terminalIdentity(): Identity {
  const branch = useStore.getState().user?.branchId ?? "main";
  const key = "fitstore-equipment:" + branch;
  let value: Partial<Identity> | null = null;
  try {
    value = JSON.parse(localStorage.getItem(key) ?? "null");
  } catch {
    value = null;
  }
  const identity: Identity = {
    id: value?.id ?? crypto.randomUUID(),
    name: value?.name ?? defaultDeviceName(),
    secret: value?.secret ?? randomSecret(),
  };
  if (
    !value ||
    value.id !== identity.id ||
    value.secret !== identity.secret ||
    value.name !== identity.name
  )
    localStorage.setItem(key, JSON.stringify(identity));
  return identity;
}
function forgetIdentity() {
  const branch = useStore.getState().user?.branchId ?? "main";
  localStorage.removeItem("fitstore-equipment:" + branch);
}
export const useTerminal = create<{
  terminal: any | null;
  revoked: boolean;
  set: (terminal: any | null, revoked?: boolean) => void;
}>((set) => ({
  terminal: null,
  revoked: false,
  set: (terminal, revoked = false) => set({ terminal, revoked }),
}));
export async function registerTerminal() {
  try {
    const terminal = await post("/terminals/register", terminalIdentity());
    useTerminal.getState().set(terminal);
    return terminal;
  } catch (e: any) {
    if (/revocado|otro dispositivo/i.test(e.message))
      useTerminal.getState().set(null, true);
    throw e;
  }
}
export function useRealtime() {
  const { user, online } = useStore();
  const client = useQueryClient();
  useEffect(() => {
    if (!user || !online) return;
    let stopped = false;
    let controller: AbortController | undefined;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let delay = 1000;
    const apply = (id: string, stock: number) => {
      const state = useStore.getState();
      let changed = false;
      const cart = state.cart.map((i) => {
        if (i.variant.id !== id) return i;
        changed = true;
        if (stock <= 0 && Number(i.variant.stock) > 0)
          toast(i.product.name + ": se agotó en otra caja.", true);
        return { ...i, variant: { ...i.variant, stock: String(stock) } };
      });
      if (changed) state.setCart(cart);
      client.setQueryData<Product[]>(["catalog"], (old) =>
        old?.map((p) => ({
          ...p,
          variants: p.variants.map((v) =>
            v.id === id ? { ...v, stock: String(stock) } : v,
          ),
        })),
      );
    };
    const handle = async (type: string, data: any) => {
      if (type === "ready") {
        const catalog = await loadCatalog();
        if (stopped) return;
        client.setQueryData(["catalog"], catalog);
        for (const p of catalog)
          for (const v of p.variants) apply(v.id, Number(v.stock));
        // El carrito toma también precios y datos vigentes, no sólo el
        // stock, y se avisa qué precio cambió (R9-offline-3).
        announcePriceChanges(
          refreshCart(client.getQueryData<Product[]>(["catalog"]) ?? catalog),
        );
        void client.invalidateQueries();
      } else if (type === "stock.changed") {
        const known = client
          .getQueryData<Product[]>(["catalog"])
          ?.some((p) => p.variants.some((v) => v.id === data.variantId));
        if (!known) {
          const catalog = await loadCatalog();
          if (stopped) return;
          client.setQueryData(["catalog"], catalog);
        }
        apply(data.variantId, data.qtyOnHand);
        const cached = await localDB.cache.get("catalog:" + user.branchId);
        if (cached) {
          cached.data = cached.data.map((p: Product) => ({
            ...p,
            variants: p.variants.map((v) =>
              v.id === data.variantId
                ? { ...v, stock: String(data.qtyOnHand) }
                : v,
            ),
          }));
          await localDB.cache.put(cached);
        }
        for (const key of [
          "stock",
          "dashboard",
          "movements",
          "clearance",
          "orders",
        ])
          void client.invalidateQueries({ queryKey: [key] });
      } else if (type === "alert.created") {
        void client.invalidateQueries({ queryKey: ["alerts"] });
        void client.invalidateQueries({ queryKey: ["alert-bell"] });
        void client.invalidateQueries({ queryKey: ["dashboard"] });
      }
    };
    const connect = async () => {
      try {
        await registerTerminal();
        if (stopped) return;
        controller = new AbortController();
        const response = await fetch("/api/events", {
          headers: { Authorization: "Bearer " + useStore.getState().token },
          credentials: "include",
          signal: controller.signal,
        });
        if (response.status === 401) {
          await refreshSession();
          throw new Error("reconnect");
        }
        if (!response.ok || !response.body) throw new Error("events");
        delay = 1000;
        const reader = response.body.getReader(),
          decoder = new TextDecoder();
        let buffer = "";
        let pending = Promise.resolve();
        while (!stopped) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += decoder
            .decode(value, { stream: true })
            .replace(/\r\n/g, "\n");
          let end;
          while ((end = buffer.indexOf("\n\n")) >= 0) {
            const frame = buffer.slice(0, end);
            buffer = buffer.slice(end + 2);
            const type = frame
              .split("\n")
              .find((l) => l.startsWith("event:"))
              ?.slice(6)
              .trim();
            const data = frame
              .split("\n")
              .filter((l) => l.startsWith("data:"))
              .map((l) => l.slice(5).trim())
              .join("\n");
            if (type && data)
              pending = pending
                .then(() =>
                  stopped ? undefined : handle(type, JSON.parse(data)),
                )
                .catch(() => {});
          }
        }
      } catch {
        /* Reconexión con actualización completa al recibir ready. */
      }
      if (!stopped) {
        timer = setTimeout(connect, delay);
        delay = Math.min(delay * 2, 10000);
      }
    };
    void connect();
    return () => {
      stopped = true;
      controller?.abort();
      clearTimeout(timer);
    };
  }, [user?.id, online, client]);
}
export function Equipment() {
  const client = useQueryClient();
  const user = useStore((s) => s.user)!;
  const here = terminalIdentity();
  const query = useQuery({
    queryKey: ["terminals"],
    queryFn: () => api<any[]>("/terminals"),
    refetchInterval: 15000,
  });
  const [name, setName] = useState(here.name);
  const act = async (path: string, ok: string) => {
    try {
      await post(path, {});
      toast(ok);
      await query.refetch();
    } catch (e: any) {
      toast(e.message, true);
    }
  };
  const rows = [...(query.data ?? [])].sort(
    (a, b) =>
      ["pending", "approved", "revoked"].indexOf(a.status) -
      ["pending", "approved", "revoked"].indexOf(b.status),
  );
  return (
    <div className="equipment">
      <section className="panel equipment-here">
        <div>
          <h2>Este equipo</h2>
          <p>
            Cada computadora, laptop o celular que factura o mueve mercancía
            debe estar aprobado. Los equipos nuevos de vendedores y almacén
            esperan tu aprobación.
          </p>
        </div>
        <form
          className="equipment-rename"
          onSubmit={async (e) => {
            e.preventDefault();
            try {
              await post("/terminals/" + here.id + "/rename", { name });
              localStorage.setItem(
                "fitstore-equipment:" + user.branchId,
                JSON.stringify({ ...terminalIdentity(), name }),
              );
              toast("Nombre guardado.");
              await client.invalidateQueries({ queryKey: ["terminals"] });
            } catch (err: any) {
              toast(err.message, true);
            }
          }}
        >
          <label className="field">
            Nombre de este equipo
            <input
              value={name}
              maxLength={80}
              onChange={(e) => setName(e.target.value)}
            />
          </label>
          <Button type="submit">Guardar nombre</Button>
        </form>
      </section>
      {query.error && (
        <p className="form-error" role="alert">
          {query.error.message}
        </p>
      )}
      <ul className="equipment-list">
        {rows.map((t) => {
          const Icon = /celular|tel[eé]fono|m[oó]vil/i.test(t.name)
            ? Smartphone
            : Laptop;
          return (
            <li key={t.id} className={`panel equipment-item ${t.status}`}>
              <div className="equipment-icon">
                <Icon size={20} aria-hidden="true" />
                {t.connected && <span className="equipment-online" />}
              </div>
              <div className="equipment-info">
                <strong>
                  {t.name}
                  {t.id === here.id && <em> · este equipo</em>}
                </strong>
                <small>
                  {t.status === "revoked"
                    ? "Revocado"
                    : t.connected
                      ? "Conectado ahora"
                      : "Última actividad " +
                        new Date(t.lastActivityAt).toLocaleString("es-DO", {
                          timeZone: "America/Santo_Domingo",
                          day: "2-digit",
                          month: "short",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                  {t.lastUserName ? " · " + t.lastUserName : ""}
                </small>
                <small>
                  {t.openCash
                    ? "Caja abierta desde " +
                      new Date(t.openCash.openedAt).toLocaleTimeString(
                        "es-DO",
                        {
                          timeZone: "America/Santo_Domingo",
                          hour: "2-digit",
                          minute: "2-digit",
                        },
                      )
                    : "Sin caja abierta"}
                  {t.status === "pending" && t.createdByName && !t.legacy
                    ? " · Registrado por " + t.createdByName
                    : ""}
                </small>
                {t.legacy && t.status === "pending" && (
                  <small className="equipment-legacy">
                    {t.createdByName
                      ? "Equipo de antes de la actualización, reclamado por " +
                        t.createdByName +
                        ". Apruébalo sólo si es el mismo dispositivo; si no, revócalo."
                      : "Equipo de antes de la actualización. Debe abrir Nexora POS para identificarse antes de aprobarlo."}
                  </small>
                )}
              </div>
              <Badge
                tone={
                  t.status === "approved"
                    ? "success"
                    : t.status === "pending"
                      ? "warning"
                      : "neutral"
                }
              >
                {t.status === "approved"
                  ? "Aprobado"
                  : t.status === "pending"
                    ? "Pendiente"
                    : "Revocado"}
              </Badge>
              <div className="equipment-actions">
                {t.status === "pending" && t.identified !== false && (
                  <Button
                    onClick={() =>
                      act("/terminals/" + t.id + "/approve", "Equipo aprobado.")
                    }
                  >
                    Aprobar
                  </Button>
                )}
                {t.status !== "revoked" && t.id !== here.id && (
                  <Button
                    variant="secondary"
                    onClick={() => {
                      if (
                        window.confirm(
                          "¿Revocar este equipo? Se cerrarán sus sesiones y no podrá volver a operar.",
                        )
                      )
                        void act(
                          "/terminals/" + t.id + "/revoke",
                          "Equipo revocado.",
                        );
                    }}
                  >
                    Revocar equipo
                  </Button>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
// Aviso para un equipo que todavía no puede facturar ni mover mercancía.
export function DeviceGate() {
  const { terminal, revoked } = useTerminal();
  const user = useStore((s) => s.user);
  const [name, setName] = useState(""),
    [pin, setPin] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  if (!user || (!revoked && terminal?.status !== "pending")) return null;
  if (revoked)
    return (
      <section className="device-gate revoked" role="alert">
        <ShieldAlert size={22} aria-hidden="true" />
        <div>
          <strong>Este equipo fue revocado</strong>
          <p>
            No puede facturar ni mover mercancía. Si fue un error, regístralo
            como equipo nuevo y pide a un gerente que lo apruebe.
          </p>
        </div>
        <Button
          variant="secondary"
          onClick={async () => {
            forgetIdentity();
            useTerminal.getState().set(null);
            await registerTerminal().catch((e) => toast(e.message, true));
          }}
        >
          Registrar como equipo nuevo
        </Button>
      </section>
    );
  return (
    <section className="device-gate" role="status">
      <BadgeCheck size={22} aria-hidden="true" />
      <div>
        <strong>Este equipo necesita aprobación</strong>
        <p>
          Puedes consultar, pero para facturar o mover mercancía un gerente debe
          aprobarlo: con su PIN aquí mismo o desde Configuración › Equipos.
        </p>
        <form
          className="device-gate-form"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setError("");
            try {
              const t = terminalIdentity();
              if (name.trim() && name.trim() !== terminal.name) {
                await post("/terminals/" + t.id + "/rename", {
                  name: name.trim(),
                });
                localStorage.setItem(
                  "fitstore-equipment:" + user.branchId,
                  JSON.stringify({ ...t, name: name.trim() }),
                );
              }
              const approved = await post(
                "/terminals/" + t.id + "/approve-with-pin",
                { managerPin: pin },
              );
              useTerminal.getState().set(approved);
              setPin("");
              toast("Equipo aprobado. Ya puedes operar.");
            } catch (err: any) {
              setError(err.message);
            } finally {
              setBusy(false);
            }
          }}
        >
          <label className="field">
            Nombre del equipo
            <input
              value={name}
              placeholder={terminal.name}
              maxLength={80}
              onChange={(e) => setName(e.target.value)}
            />
          </label>
          <label className="field">
            PIN del gerente
            <input
              type="password"
              inputMode="numeric"
              autoComplete="off"
              maxLength={6}
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
            />
          </label>
          <Button type="submit" disabled={busy || pin.length < 4}>
            {busy ? "Aprobando…" : "Aprobar este equipo"}
          </Button>
        </form>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
      </div>
    </section>
  );
}
// La caja abierta del usuario está asignada a otro equipo: sólo se puede vender,
// cobrar abonos o mover efectivo desde ese equipo, o trasladándola aquí.
export function cashOnOtherDevice(session: any) {
  return !!session && session.registerId !== terminalIdentity().id;
}
export function CashElsewhere({
  session,
  compact = false,
}: {
  session: any;
  compact?: boolean;
}) {
  const user = useStore((s) => s.user)!;
  const client = useQueryClient();
  const [open, setOpen] = useState(false),
    [pin, setPin] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const needsPin = !can(user.permissions, "sale:manage");
  const submit = async () => {
    setBusy(true);
    setError("");
    try {
      // Asegura que el servidor conozca este equipo antes de trasladar.
      await registerTerminal();
      await post(
        "/cash-sessions/" + session.id + "/transfer",
        needsPin ? { managerPin: pin } : {},
      );
      toast("Caja trasladada a este equipo.");
      setOpen(false);
      setPin("");
      await client.invalidateQueries({ queryKey: ["cash-sessions"] });
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <div
        className={`cash-elsewhere ${compact ? "compact" : ""}`}
        role="status"
      >
        <MonitorSmartphone size={compact ? 18 : 22} aria-hidden="true" />
        <div>
          <strong>
            Tu caja está abierta en «{session.registerName ?? "otro equipo"}»
          </strong>
          <p>
            Para cobrar aquí, trasládala a este equipo o ciérrala en el otro.
          </p>
        </div>
        <Button variant="secondary" onClick={() => setOpen(true)}>
          Trasladar caja aquí
        </Button>
      </div>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Trasladar caja a este equipo"
      >
        <p className="modal-intro">
          Las ventas, abonos y movimientos de esta caja se registrarán desde
          este equipo. El cambio queda en la bitácora con ambos equipos.
        </p>
        {needsPin && (
          <label className="field">
            PIN del gerente
            <input
              type="password"
              inputMode="numeric"
              autoComplete="off"
              maxLength={6}
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
            />
          </label>
        )}
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <Button
          disabled={busy || (needsPin && pin.length < 4)}
          onClick={submit}
        >
          {busy ? "Trasladando…" : "Trasladar caja"}
        </Button>
      </Modal>
    </>
  );
}
