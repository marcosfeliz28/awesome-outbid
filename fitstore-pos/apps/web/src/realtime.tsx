import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { MonitorSmartphone } from "lucide-react";
import { Button, Modal } from "@fitstore/ui";
import { can } from "@fitstore/shared";
import {
  api,
  loadCatalog,
  localDB,
  post,
  Product,
  refreshSession,
  useStore,
} from "./api";
import { toast } from "./helpers";
export function terminalIdentity() {
  const branch = useStore.getState().user?.branchId ?? "main";
  const key = "fitstore-equipment:" + branch;
  let value = localStorage.getItem(key);
  if (!value) {
    value = JSON.stringify({
      id: crypto.randomUUID(),
      name: "Equipo " + crypto.randomUUID().slice(0, 6),
    });
    localStorage.setItem(key, value);
  }
  return JSON.parse(value) as { id: string; name: string };
}
export const registerTerminal = () =>
  post("/terminals/register", terminalIdentity());
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
  const query = useQuery({
    queryKey: ["terminals"],
    queryFn: () => api<any[]>("/terminals"),
    refetchInterval: 15000,
  });
  const [name, setName] = useState(terminalIdentity().name);
  return (
    <div>
      <h2>Equipos</h2>
      <label className="field">
        Nombre de este equipo
        <input
          value={name}
          maxLength={80}
          onChange={(e) => setName(e.target.value)}
        />
      </label>
      <Button
        onClick={async () => {
          try {
            const t = terminalIdentity();
            await post("/terminals/" + t.id + "/rename", { name });
            localStorage.setItem(
              "fitstore-equipment:" + useStore.getState().user!.branchId,
              JSON.stringify({ ...t, name }),
            );
            await client.invalidateQueries({ queryKey: ["terminals"] });
          } catch (e: any) {
            toast(e.message, true);
          }
        }}
      >
        Guardar nombre
      </Button>
      {query.error && <p role="alert">{query.error.message}</p>}
      {query.data?.map((t) => (
        <div className="panel" key={t.id}>
          <strong>{t.name}</strong>
          <p>
            {t.revokedAt
              ? "Revocado"
              : t.connected
                ? "Conectado ahora"
                : "Desconectado"}{" "}
            · Última actividad:{" "}
            {new Date(t.lastActivityAt).toLocaleString("es-DO")}
          </p>
          <p>
            {t.openCash
              ? "Caja abierta · " + t.openCash.id
              : "Sin caja abierta"}
          </p>
          {!t.revokedAt && (
            <Button
              variant="secondary"
              onClick={async () => {
                if (
                  !window.confirm("¿Revocar este equipo y cerrar sus sesiones?")
                )
                  return;
                try {
                  await post("/terminals/" + t.id + "/revoke", {});
                  await query.refetch();
                } catch (e: any) {
                  toast(e.message, true);
                }
              }}
            >
              Revocar equipo
            </Button>
          )}
        </div>
      ))}
    </div>
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
