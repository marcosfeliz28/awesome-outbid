import { useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Search,
  ScanLine,
  Plus,
  Minus,
  Trash2,
  UserRound,
  CreditCard,
  Banknote,
  Landmark,
  Pause,
  ChevronRight,
  Check,
  Printer,
  Send,
  Mail,
  ArrowLeft,
  X,
  FileText,
  Camera,
  Truck,
} from "lucide-react";
import { Button, Badge, Modal, Empty } from "@fitstore/ui";
import {
  can,
  formatMoney,
  lineTotals,
  money,
  d,
  paymentTotals,
} from "@fitstore/shared";
import type { SaleInput } from "@fitstore/shared";
import {
  useStore,
  api,
  ANSWER_TIMEOUT,
  post,
  loadCatalog,
  localDB,
  download,
  cachedApi,
  discountLocalStock,
  isNetworkError,
  refreshCart,
  type CartItem,
  type Product,
  type Variant,
} from "./api";
import {
  QueryState,
  attrLabel,
  categoryImage,
  matchesWords,
  searchWords,
  toast,
} from "./helpers";
import { InvoicePrint, METHOD_LABEL, PrintSheet, printSoon } from "./Prints";
import {
  announcePriceChanges,
  CashElsewhere,
  cashOnOtherDevice,
  priceChanges,
} from "./realtime";
import { offlineSaleAction } from "./offlinePolicy";

function discountFor(
  promo: any,
  variant: Variant,
  product: Product,
  qty: number,
) {
  const scope = promo.scope;
  if (
    (scope.variantId && scope.variantId !== variant.id) ||
    (scope.productId && scope.productId !== product.id) ||
    (scope.categoryId && scope.categoryId !== product.categoryId) ||
    (scope.brand && scope.brand !== product.brand)
  )
    return 0;
  if (promo.type === "percent") return Number(promo.value);
  if (promo.type === "amount")
    return Math.min(100, (Number(promo.value) / Number(variant.price)) * 100);
  if (promo.type === "special_price")
    return Math.max(0, (1 - Number(promo.value) / Number(variant.price)) * 100);
  if (promo.type === "nxm")
    return (
      ((Math.floor(qty / (scope.buy || 2)) *
        ((scope.buy || 2) - (scope.pay || 1))) /
        qty) *
      100
    );
  if (promo.type === "second_half")
    return ((Math.floor(qty / 2) * 0.5) / qty) * 100;
  return 0;
}
// Descuento manual efectivo de una línea (la línea combinada con el global).
// Se limita a 0-100 %: un valor fuera de rango (de una venta en espera o de
// una versión anterior) nunca deja un total negativo en pantalla (R9-caja-8).
const manualDiscount = (i: CartItem, globalDiscount: number) => {
  const line = Math.min(
    100,
    Math.max(
      0,
      i.discountPercent,
      ((i.discountAmount ?? 0) /
        Math.max(0.01, i.qty * Number(i.variant.price))) *
        100,
    ),
  );
  const global = Math.min(100, Math.max(0, globalDiscount));
  return 100 - ((100 - line) * (100 - global)) / 100;
};
const lineGross = (i: CartItem, qty = i.qty) =>
  money(d(qty).times(Number(i.variant.price)));
// Parece un código: un solo bloque de dígitos (con «-» o «.», como 1600) o
// un solo bloque con 5 dígitos o más (barras o IDs como «e2e-16000»). Los
// modelos y tonos del nombre («a40», «275n», «m158») y las palabras
// («iso100», «tribulus 1400») son búsquedas: Enter agrega el único
// resultado (R9-caja-1).
const looksLikeCode = (text: string) => {
  const t = text.trim();
  return (
    !/\s/.test(t) &&
    (/^[\d.-]*\d[\d.-]*$/.test(t) || (t.match(/\d/g)?.length ?? 0) >= 5)
  );
};
// Campos de descuento de la caja y separación máxima entre teclas de un
// lector (una persona tarda bastante más entre una tecla y otra).
const DISCOUNT_FIELDS = ".line-discount input, #global-discount";
const SCAN_GAP_MS = 50;
// Un elemento donde se escribe: ahí el teclado no se desvía al buscador.
const isEditable = (el: Element | null) =>
  el instanceof HTMLInputElement ||
  el instanceof HTMLTextAreaElement ||
  el instanceof HTMLSelectElement ||
  (el instanceof HTMLElement && el.isContentEditable);
export function POS({ go }: { go: (page: string) => void }) {
  const {
    cart,
    add,
    updateQty,
    clearCart,
    setCart,
    user,
    online,
    globalDiscount,
    setDiscount,
    customerId,
    setCustomer,
  } = useStore();
  const [q, setQ] = useState(""),
    [category, setCategory] = useState("all"),
    [choosing, setChoosing] = useState<Product | null>(null),
    [checkout, setCheckout] = useState(false),
    [held, setHeld] = useState(false),
    [clientPicker, setClientPicker] = useState(false),
    [camera, setCamera] = useState(false);
  const search = useRef<HTMLInputElement>(null);
  // La ventana de variantes se abrió con Enter desde el buscador: al elegir,
  // el buscador queda vacío como tras un escaneo (R9-caja-6).
  const clearOnChoose = useRef(false);
  // Teclas seguidas en un campo de descuento, por si son de un lector, y
  // cuántas de esas ráfagas se pasaron al buscador (R9-caja-3/8).
  const burst = useRef<{
    field: Element;
    chars: string;
    last: number;
    cart: CartItem[];
    globalDiscount: number;
  } | null>(null);
  const scans = useRef(0);
  // Aviso de un descuento fuera de límite. Espera un instante: si era el
  // comienzo de un escaneo, no se muestra (R9-caja-3/8).
  const limitWarning = (message: string) => {
    const seen = scans.current;
    setTimeout(() => {
      if (scans.current === seen) toast(message, true);
    }, 150);
  };
  const client = useQueryClient();
  // Lo que la caja necesita para vender sale de la copia local si no hay
  // conexión o el servidor no responde. offlineFirst: sin red, React Query
  // pausaba las consultas y tras una venta seguía el stock viejo
  // (R9-offline-1/2).
  const products = useQuery({
    queryKey: ["catalog"],
    queryFn: loadCatalog,
    networkMode: "offlineFirst",
  });
  const categories = useQuery({
    queryKey: ["categories"],
    queryFn: () => cachedApi<any[]>("/categories", "categories"),
    networkMode: "offlineFirst",
  });
  const customers = useQuery({
    queryKey: ["customers"],
    queryFn: () => cachedApi<any[]>("/customers", "customers:" + user!.id),
    networkMode: "offlineFirst",
  });
  const sessions = useQuery({
    queryKey: ["cash-sessions"],
    queryFn: () => cachedApi<any[]>("/cash-sessions", "cash:" + user!.id),
    networkMode: "offlineFirst",
  });
  const promos = useQuery({
    queryKey: ["promotions"],
    queryFn: () => cachedApi<any[]>("/promotions", "promotions"),
    networkMode: "offlineFirst",
  });
  const activePromos = (promos.data || []).filter(
    (p: any) =>
      p.active &&
      new Date(p.startsAt) <= new Date() &&
      new Date(p.endsAt) >= new Date(),
  );
  const session = sessions.data?.find(
    (s: any) => !s.closedAt && s.userId === user!.id,
  );
  const elsewhere = cashOnOtherDevice(session);
  const config = useQuery({
    queryKey: ["settings", user!.branchId],
    queryFn: () => cachedApi<any>("/settings", "settings:" + user!.branchId),
    networkMode: "offlineFirst",
  });
  // Lo que la caja usa queda guardado en este equipo aunque lo haya leído
  // otra pantalla (Caja, Clientes…): al recargar sin conexión se sigue
  // vendiendo con la caja abierta (R9-offline-1).
  useEffect(() => {
    for (const [key, data] of [
      ["categories", categories.data],
      ["customers:" + user!.id, customers.data],
      ["cash:" + user!.id, sessions.data],
      ["promotions", promos.data],
      ["settings:" + user!.branchId, config.data],
    ])
      if (data !== undefined)
        void localDB.cache.put({ key, data }).catch(() => {});
  }, [
    categories.data,
    customers.data,
    sessions.data,
    promos.data,
    config.data,
    user!.branchId,
  ]);
  // El carrito usa los precios del catálogo vigente: si otro equipo cambió
  // un precio, la línea se actualiza y se avisa antes de cobrar
  // (R9-offline-3).
  useEffect(() => {
    if (products.data) announcePriceChanges(refreshCart(products.data));
  }, [products.data]);
  const totals = cart.map((i) =>
    lineTotals(
      i.qty,
      Number(i.variant.price),
      Math.max(
        manualDiscount(i, globalDiscount),
        ...activePromos.map((p: any) =>
          discountFor(p, i.variant, i.product, i.qty),
        ),
      ),
      Number(i.product.taxRate),
      config.data?.taxIncluded !== false,
    ),
  );
  const total = money(totals.reduce((a, i) => a.plus(i.total), d(0))),
    subtotal = money(totals.reduce((a, i) => a.plus(i.subtotal), d(0))),
    tax = money(totals.reduce((a, i) => a.plus(i.tax), d(0))),
    discount = money(totals.reduce((a, i) => a.plus(i.discount), d(0)));
  // "added" o "negative" si el artículo entró al carrito; false si no.
  const choose = (
    variant: Variant,
    product: Product,
  ): "added" | "negative" | false => {
    const existing = cart.find((i) => i.variant.id === variant.id);
    if (
      (existing?.qty || 0) + 1 > Number(variant.stock) &&
      !(config.data?.allowNegativeStock && !product.category.requiresLot)
    ) {
      toast(
        "No hay suficiente stock de " +
          product.name +
          " (quedan " +
          Number(variant.stock) +
          ").",
        true,
      );
      return false;
    }
    add(variant, product);
    setChoosing(null);
    if ((existing?.qty || 0) + 1 > Number(variant.stock)) {
      toast(
        "Advertencia: " + product.name + " quedará con stock negativo.",
        true,
      );
      return "negative";
    }
    return "added";
  };
  const addProduct = (product: Product) => {
    clearOnChoose.current = false;
    return product.variants.length === 1
      ? choose(product.variants[0], product)
      : setChoosing(product);
  };
  // Línea del carrito con descuentos dentro de rango (R9-caja-8).
  const setLine = (id: string, change: Partial<CartItem>) =>
    setCart(
      cart.map((item) =>
        item.variant.id === id ? { ...item, ...change } : item,
      ),
    );
  const changeQty = (i: CartItem, qty: number) => {
    // Al bajar la cantidad, el descuento por monto se ajusta al nuevo
    // importe de la línea en vez de dejar el total negativo (R9-caja-8).
    if (qty > 0 && (i.discountAmount ?? 0) > lineGross(i, qty)) {
      setLine(i.variant.id, { qty, discountAmount: lineGross(i, qty) });
      toast(
        "El descuento por monto de " +
          i.product.name +
          " bajó a " +
          formatMoney(lineGross(i, qty)) +
          ", el importe de la línea.",
        true,
      );
    } else updateQty(i.variant.id, qty);
  };
  // true si la venta quedó guardada (también la usa «Ventas en espera» para
  // guardar el carrito actual antes de recuperar otra).
  const saveHeld = async (type = "held") => {
    // El estado se lee al momento: el atajo F8 no usa el cliente de antes de
    // F4 (R9-caja-7).
    const state = useStore.getState();
    if (!state.cart.length) return false;
    try {
      if (!state.online)
        throw new Error("Conéctate para guardar una venta en espera.");
      await post("/quotes", {
        type,
        customerId: state.customerId,
        // La venta en espera conserva todos sus descuentos (R9-caja-4).
        globalDiscount: state.globalDiscount,
        items: state.cart.map((i) => {
          const label = attrLabel(i.variant.attributes || {});
          return {
            variantId: i.variant.id,
            qty: i.qty,
            discountPercent: i.discountPercent,
            discountAmount: i.discountAmount,
            name: (label === "Única"
              ? i.product.name
              : i.product.name + " · " + label
            ).slice(0, 300),
          };
        }),
      });
      clearCart();
      await client.invalidateQueries({ queryKey: ["quotes"] });
      toast(
        type === "held" ? "Venta guardada en espera." : "Cotización guardada.",
      );
      return true;
    } catch (e: any) {
      toast(e.message, true);
      return false;
    }
  };
  const charge = () => {
    if (!cart.length) return;
    if (!session) {
      toast("Abre tu caja antes de cobrar.", true);
      return;
    }
    if (elsewhere) {
      toast(
        "Tu caja está abierta en «" +
          (session.registerName ?? "otro equipo") +
          "». Trasládala a este equipo para cobrar.",
        true,
      );
      return;
    }
    setCheckout(true);
  };
  // El atajo usa siempre la versión de este render: con el efecto atado a
  // [cart, session, online], F8 guardaba el cliente anterior (R9-caja-7).
  const onKey = useRef<(e: KeyboardEvent) => void>(() => {});
  onKey.current = (e) => {
    if (e.key === "F2") {
      e.preventDefault();
      search.current?.focus();
    }
    if (e.key === "F4") {
      e.preventDefault();
      setClientPicker(true);
    }
    if (e.key === "F8") {
      e.preventDefault();
      saveHeld();
    }
    if (e.key === "F12") {
      e.preventDefault();
      charge();
    }
    const printable =
      e.key.length === 1 &&
      e.key !== " " &&
      !e.ctrlKey &&
      !e.metaKey &&
      !e.altKey;
    // Con el foco en un descuento, los dígitos de un escaneo se tomaban como
    // descuento (101 %, 1001 %…) y el producto no entraba (R9-caja-3/8). Un
    // lector envía las teclas casi juntas; una persona, no. Tres teclas
    // seguidas a menos de SCAN_GAP_MS son un escaneo: los descuentos vuelven
    // a su valor de antes y el código sigue en el buscador, donde su Enter
    // agrega el producto. Una tecla sostenida (repetición) no cuenta.
    const field = document.activeElement;
    if (
      printable &&
      !e.repeat &&
      field instanceof HTMLInputElement &&
      field.matches(DISCOUNT_FIELDS) &&
      search.current
    ) {
      const b = burst.current;
      if (!b || b.field !== field || e.timeStamp - b.last >= SCAN_GAP_MS) {
        const { cart, globalDiscount } = useStore.getState();
        burst.current = {
          field,
          chars: e.key,
          last: e.timeStamp,
          cart,
          globalDiscount,
        };
        return;
      }
      b.chars += e.key;
      b.last = e.timeStamp;
      if (b.chars.length < 3) return;
      e.preventDefault();
      burst.current = null;
      scans.current++;
      const before = new Map(b.cart.map((i) => [i.variant.id, i]));
      flushSync(() => {
        setCart(
          useStore.getState().cart.map((item) => {
            const old = before.get(item.variant.id);
            return old
              ? {
                  ...item,
                  discountPercent: old.discountPercent,
                  discountAmount: old.discountAmount,
                }
              : item;
          }),
        );
        setDiscount(b.globalDiscount);
        setQ(b.chars);
      });
      search.current.focus();
      search.current.setSelectionRange(b.chars.length, b.chars.length);
      return;
    }
    // El lector escribe como un teclado. Si el foco quedó en una tarjeta, en
    // un botón +/− o en ninguna parte (tras cerrar una ventana o «Nueva
    // venta»), los dígitos se perdían y el Enter volvía a pulsar el botón:
    // se agregaba otra unidad del producto anterior (R9-caja-3, R9-caja-6).
    // Lo que se escribe fuera de un campo va al buscador y reemplaza la
    // búsqueda anterior. Con una ventana abierta no se toca nada.
    if (
      printable &&
      search.current &&
      !isEditable(document.activeElement) &&
      !document.querySelector('[role="dialog"]')
    ) {
      search.current.focus();
      search.current.select();
    }
  };
  useEffect(() => {
    const key = (e: KeyboardEvent) => onKey.current(e);
    window.addEventListener("keydown", key, true);
    return () => window.removeEventListener("keydown", key, true);
  }, []);
  // Búsqueda por palabras sueltas, sin acentos, apóstrofos ni orden:
  // "iso100 vanilla 5lb" encuentra "ISO100 Hydrolyzed - Dymatize - Gourmet
  // Vanilla / 5 lb" y "loreal" encuentra "L'Oréal".
  const words = searchWords(q);
  const searchText = (p: Product) =>
    [
      p.name,
      p.sku,
      p.brand,
      ...p.variants.flatMap((v) => [
        v.sku,
        v.barcode,
        ...Object.values(v.attributes || {}).map(String),
      ]),
    ].join(" ");
  const inCategory = (products.data ?? []).filter(
    (p) => category === "all" || p.categoryId === category,
  );
  const exactMatches = inCategory.filter(
    (p) => !words.length || matchesWords(searchText(p), words),
  );
  // Ninguno tiene todas las palabras ("proteina whey" frente a nombres en
  // inglés): se muestran los que tienen más de ellas, como sugerencia.
  const approximate = !exactMatches.length && words.length > 1;
  const filtered = approximate
    ? inCategory
        .map((p) => ({
          p,
          hits: words.filter(
            (w) => w.length >= 3 && matchesWords(searchText(p), [w]),
          ).length,
        }))
        .filter((x) => x.hits > 0)
        .sort((a, b) => b.hits - a.hits)
        .map((x) => x.p)
    : exactMatches;
  // Con cientos de productos se dibujan 120 tarjetas; la búsqueda llega al resto.
  const MAX_CARDS = 120;
  const visible = filtered.slice(0, MAX_CARDS);
  // Código exacto: primero el código de barras y, si ninguno coincide, el
  // código del producto (el ID del inventario, por ejemplo 1216). Así se cobra
  // escribiendo el número + Enter, sin depender del orden del catálogo.
  const byCode = (code: string) => {
    const c = code.trim().toLowerCase();
    if (!c) return undefined;
    // Sin distinguir mayúsculas (R8-01). Si el código es de más de un
    // producto, no se elige ninguno en silencio.
    const hits = (products.data ?? []).flatMap((p) =>
      p.variants
        .filter(
          (v) => v.barcode.toLowerCase() === c || v.sku.toLowerCase() === c,
        )
        .map((v) => ({ product: p, variant: v })),
    );
    // Se cuentan variantes distintas: si el catálogo trajo dos veces la
    // misma, no es un código repetido (R9-offline-4).
    const distinct = new Set(hits.map((h) => h.variant.id)).size;
    if (distinct > 1) return { ambiguous: distinct } as const;
    return hits[0];
  };
  const scan = (code: string) => {
    const found = byCode(code);
    if (found && "ambiguous" in found) {
      setQ(code);
      // Seleccionado, para que el siguiente escaneo lo reemplace en vez de
      // pegarse al código anterior (R9-caja-2).
      requestAnimationFrame(() => search.current?.select());
      toast(
        "El código " +
          code.trim() +
          " es de " +
          found.ambiguous +
          " productos. Elige el producto en la lista y corrige el código en Productos.",
        true,
      );
      return;
    }
    const product = found?.product,
      variant = found?.variant;
    if (product && variant) {
      const result = choose(variant, product);
      if (result) {
        setQ("");
        // La advertencia de stock negativo ya está a la vista.
        if (result === "added") toast(product.name + " agregado.");
      } else {
        // Sin stock: el código queda a la vista, pero seleccionado, para
        // que el siguiente escaneo lo reemplace en vez de sumarse.
        setQ(code);
        requestAnimationFrame(() => search.current?.select());
      }
    } else {
      setQ(code);
      requestAnimationFrame(() => search.current?.select());
      toast("Código no encontrado: " + code.trim() + ".", true);
    }
  };
  // Enter en el buscador (teclado o lector).
  const enter = () => {
    const text = q.trim();
    if (!text) return;
    if (byCode(text)) return scan(q);
    const warn = (message: string) => {
      toast(message, true);
      search.current?.select();
    };
    // Un código que no es de ningún producto activo (por ejemplo, el de uno
    // desactivado) no agrega otro que sólo lo contiene en el nombre o en las
    // barras: «1600» no es «Longjack … 1600 mg» (R9-caja-1). La lista queda
    // a la vista por si se quiere elegir a mano.
    if (looksLikeCode(text) || (!filtered.length && /^\S*\d\S*$/.test(text)))
      return warn("Código no encontrado: " + text + ".");
    if (filtered.length === 1 && !approximate) {
      const product = filtered[0];
      if (product.variants.length > 1) {
        clearOnChoose.current = true;
        setChoosing(product);
        return;
      }
      const result = choose(product.variants[0], product);
      if (result) {
        // Como al escanear: aviso y buscador vacío, para que el siguiente
        // escaneo no se pegue a las palabras (R9-caja-6).
        setQ("");
        if (result === "added") toast(product.name + " agregado.");
      } else search.current?.select();
      return;
    }
    // Ningún producto o varios: no se agregó nada y se dice (R9-caja-6).
    warn(
      filtered.length
        ? "No se agregó nada: elige el producto en la lista."
        : "No se agregó nada: no hay productos con esas palabras.",
    );
  };
  return (
    <div className="pos-layout">
      <section className="pos-catalog">
        <div className="page-heading">
          <div>
            <span className="eyebrow">CADA VENTA, UNA NUEVA META</span>
            <h1>
              Punto de venta <span className="title-dot" />
            </h1>
            <p>Encuentra, agrega y listo. Así de simple.</p>
          </div>
          <div className="heading-actions">
            <Button variant="secondary" onClick={() => setHeld(true)}>
              <Pause size={16} />
              En espera
            </Button>
            <Button
              variant="secondary"
              onClick={() => setCamera(true)}
              aria-label="Escanear con cámara"
            >
              <Camera size={18} />
            </Button>
          </div>
        </div>
        <div className="pos-search">
          <Search size={21} />
          <input
            ref={search}
            aria-label="Buscar productos"
            placeholder="Escribe el código (ej. 1216) o palabras del producto…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key !== "Enter") return;
              // Sin esto, el mismo Enter pulsaba «Cerrar» en la ventana de
              // variantes que acababa de abrir (R9-caja-6).
              e.preventDefault();
              enter();
            }}
          />
          <kbd>F2</kbd>
          <ScanLine size={20} />
        </div>
        <div className="category-tabs">
          <button
            onClick={() => setCategory("all")}
            className={category === "all" ? "active" : ""}
          >
            Todos los productos
          </button>
          {categories.data
            // Sólo categorías con productos a la venta: las vacías no estorban.
            ?.filter((c: any) =>
              (products.data ?? []).some((p) => p.categoryId === c.id),
            )
            .map((c: any) => (
              <button
                key={c.id}
                onClick={() => setCategory(c.id)}
                className={category === c.id ? "active" : ""}
              >
                <i style={{ background: c.color }} />
                {c.name}
              </button>
            ))}
        </div>
        <div className="catalog-caption">
          <span>
            {approximate && filtered.length
              ? `Ninguno tiene todas esas palabras · ${filtered.length} parecidos`
              : filtered.length > MAX_CARDS
                ? `Mostrando ${MAX_CARDS} de ${filtered.length} · escribe para encontrar el resto`
                : filtered.length === 1
                  ? "1 producto encontrado"
                  : `${filtered.length} productos para descubrir`}
          </span>
          <span>
            <span className="live-dot" />
            Stock actualizado {online ? "en línea" : "localmente"}
          </span>
        </div>
        <QueryState query={products}>
          {filtered.length ? (
            <div className="product-grid">
              {visible.map((p) => {
                const stock = p.variants.reduce(
                  (a, v) => a + Number(v.stock),
                  0,
                );
                return (
                  <button
                    className="product-card"
                    onClick={() => addProduct(p)}
                    key={p.id}
                    disabled={
                      stock <= 0 &&
                      !(
                        config.data?.allowNegativeStock &&
                        !p.category.requiresLot
                      )
                    }
                  >
                    <div className="product-image">
                      <img
                        src={p.imageUrl || categoryImage(p.category.name)}
                        alt={p.name}
                      />
                      {stock <= Number(p.minStock) && (
                        <Badge tone={stock === 0 ? "danger" : "warning"}>
                          {stock === 0 ? "Agotado" : "Últimas unidades"}
                        </Badge>
                      )}
                      <span className="add-product">
                        <Plus size={18} />
                      </span>
                    </div>
                    <div className="product-info">
                      <span
                        className="product-category"
                        style={{ color: p.category.color }}
                      >
                        {p.category.name}
                      </span>
                      <h3 title={p.name}>{p.name}</h3>
                      <p>
                        {p.variants.length > 1
                          ? `${p.variants.length} variantes`
                          : [
                              "Cód. " + p.variants[0]?.sku,
                              attrLabel(p.variants[0]?.attributes || {}),
                            ]
                              .filter(Boolean)
                              .join(" · ")}
                      </p>
                      <div className="product-bottom">
                        <strong>
                          {formatMoney(
                            Math.min(...p.variants.map((v) => Number(v.price))),
                          )}
                        </strong>
                        <span>{stock} en stock</span>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          ) : (
            <Empty
              title="No encontramos ese producto"
              description="Prueba con el código del producto o con menos palabras."
            />
          )}
        </QueryState>
      </section>
      <aside className="cart-panel">
        <div className="cart-heading">
          <div>
            <h2>Venta actual</h2>
            <span>
              <span className="live-dot" />
              {!session
                ? "Caja sin abrir"
                : elsewhere
                  ? "Caja abierta en otro equipo"
                  : "Caja abierta"}
            </span>
          </div>
          <Badge tone="violet">
            {cart.reduce((a, i) => a + i.qty, 0)} artículos
          </Badge>
        </div>
        <button
          className="customer-selector"
          onClick={() => setClientPicker(true)}
        >
          <span className="customer-avatar">
            <UserRound size={18} />
          </span>
          <div>
            <strong>
              {customers.data?.find((c: any) => c.id === customerId)?.name ||
                "Consumidor final"}
            </strong>
            <small>Elegir cliente · F4</small>
          </div>
          <ChevronRight size={16} />
        </button>
        <div className="cart-items">
          {cart.length ? (
            cart.map((i, index) => (
              <div className="cart-item" key={i.variant.id}>
                <img
                  src={
                    i.product.imageUrl ||
                    categoryImage(i.product.category?.name)
                  }
                  alt=""
                />
                <div className="cart-item-detail">
                  <strong>{i.product.name}</strong>
                  <small>{attrLabel(i.variant.attributes)}</small>
                  <div className="cart-item-controls">
                    <div className="quantity-control">
                      <button
                        aria-label={"Reducir " + i.product.name}
                        onClick={() => changeQty(i, i.qty - 1)}
                      >
                        <Minus size={12} />
                      </button>
                      <span>{i.qty}</span>
                      <button
                        aria-label={"Aumentar " + i.product.name}
                        onClick={() => {
                          if (
                            i.qty < Number(i.variant.stock) ||
                            (config.data?.allowNegativeStock &&
                              !i.product.category.requiresLot)
                          )
                            updateQty(i.variant.id, i.qty + 1);
                          else toast("Stock insuficiente.", true);
                        }}
                      >
                        <Plus size={12} />
                      </button>
                    </div>
                    <label className="line-discount">
                      <input
                        type="number"
                        min="0"
                        max="100"
                        step="1"
                        aria-label={"Descuento de " + i.product.name}
                        value={i.discountPercent}
                        onChange={(e) => {
                          // Hasta 100 %. Un valor mayor no se aplica (queda
                          // el anterior y se avisa): llevarlo al 100 % dejaba
                          // la línea gratis sin que se notara (R9-caja-8).
                          const value = Math.max(
                            0,
                            Number(e.target.value) || 0,
                          );
                          if (value > 100)
                            return limitWarning(
                              "El descuento de una línea llega hasta el 100 %.",
                            );
                          setLine(i.variant.id, { discountPercent: value });
                        }}
                      />
                      %
                    </label>
                    <label className="line-discount">
                      <span>RD$</span>
                      <input
                        type="number"
                        min="0"
                        max={Number(i.variant.price) * i.qty}
                        step="0.01"
                        aria-label={"Descuento por monto de " + i.product.name}
                        value={i.discountAmount ?? 0}
                        onChange={(e) => {
                          // Hasta el importe de la línea; un valor mayor no
                          // se aplica y se avisa (R9-caja-8).
                          const value = Math.max(
                              0,
                              Number(e.target.value) || 0,
                            ),
                            max = lineGross(i);
                          if (value > max)
                            return limitWarning(
                              "El descuento no puede pasar del importe de la línea (" +
                                formatMoney(max) +
                                ").",
                            );
                          setLine(i.variant.id, { discountAmount: value });
                        }}
                      />
                    </label>
                  </div>
                </div>
                <div className="cart-line-total">
                  <button
                    aria-label={"Quitar " + i.product.name}
                    onClick={() => updateQty(i.variant.id, 0)}
                  >
                    <X size={14} />
                  </button>
                  <strong>{formatMoney(totals[index].total)}</strong>
                </div>
              </div>
            ))
          ) : (
            <Empty
              title="Tu próxima venta empieza aquí"
              description="Agrega un producto para comenzar."
            />
          )}
        </div>
        <div className="cart-summary">
          <div>
            <span>Subtotal</span>
            <strong>{formatMoney(subtotal)}</strong>
          </div>
          <div>
            <label htmlFor="global-discount">Descuento global</label>
            <span className="discount-input">
              <input
                id="global-discount"
                type="number"
                min="0"
                max="100"
                value={globalDiscount}
                onChange={(e) => {
                  // Como en las líneas: más de 100 % no se aplica (R9-caja-8).
                  const value = Math.max(0, Number(e.target.value) || 0);
                  if (value > 100)
                    return limitWarning(
                      "El descuento global llega hasta el 100 %.",
                    );
                  setDiscount(value);
                }}
              />
              % <small>−{formatMoney(discount)}</small>
            </span>
          </div>
          <div>
            <span>
              ITBIS {config.data?.taxIncluded !== false ? "incluido" : ""}
            </span>
            <strong>{formatMoney(tax)}</strong>
          </div>
          <div className="cart-total">
            <span>Total a cobrar</span>
            <strong>{formatMoney(total)}</strong>
          </div>
          {!session && (
            <button className="open-cash-link" onClick={() => go("cash")}>
              Abre tu caja para comenzar <ArrowLeft size={14} />
            </button>
          )}
          {elsewhere && <CashElsewhere session={session} compact />}
          <Button
            variant="success"
            className="charge-button"
            disabled={!cart.length}
            onClick={charge}
          >
            <CreditCard size={20} />
            <span>Cobrar</span>
            <kbd>F12</kbd>
          </Button>
          <div className="cart-bottom-actions">
            <button disabled={!cart.length} onClick={() => saveHeld()}>
              <Pause size={14} />
              En espera
            </button>
            <button disabled={!cart.length} onClick={() => saveHeld("quote")}>
              <FileText size={14} />
              Cotizar
            </button>
            <button disabled={!cart.length} onClick={clearCart}>
              <Trash2 size={14} />
              Limpiar
            </button>
          </div>
          <small className="cart-security">
            Cada venta se registra con tu usuario.
          </small>
        </div>
      </aside>
      <Modal
        open={!!choosing}
        onClose={() => setChoosing(null)}
        title={choosing?.name || "Seleccionar variante"}
      >
        <p>Elige la combinación para esta venta.</p>
        <div className="variant-grid">
          {choosing?.variants.map((v) => (
            <button
              className="variant-option"
              key={v.id}
              disabled={
                Number(v.stock) <= 0 &&
                !(
                  config.data?.allowNegativeStock &&
                  !choosing.category.requiresLot
                )
              }
              onClick={() => {
                if (choose(v, choosing) && clearOnChoose.current) setQ("");
              }}
            >
              <strong>{attrLabel(v.attributes)}</strong>
              <span>{formatMoney(v.price)}</span>
              <Badge tone={Number(v.stock) > 5 ? "success" : "warning"}>
                {v.stock} disponibles
              </Badge>
            </button>
          ))}
        </div>
      </Modal>
      <Modal
        open={clientPicker}
        onClose={() => setClientPicker(false)}
        title="¿Para quién es esta venta?"
      >
        <div className="customer-list">
          <button
            onClick={() => {
              setCustomer(null);
              setClientPicker(false);
            }}
          >
            <UserRound />
            Consumidor final
          </button>
          {customers.data?.map((c: any) => (
            <button
              key={c.id}
              onClick={() => {
                setCustomer(c.id);
                setClientPicker(false);
              }}
            >
              <UserRound />
              <span>
                {c.name}
                <small>{c.phone}</small>
              </span>
            </button>
          ))}
        </div>
        <Button
          variant="secondary"
          onClick={() => {
            setClientPicker(false);
            go("customers");
          }}
        >
          Crear un cliente
        </Button>
      </Modal>
      {checkout && (
        <Checkout
          total={total}
          tax={tax}
          lines={totals}
          session={session}
          onClose={() => setCheckout(false)}
          config={config.data}
          customers={customers.data || []}
        />
      )}
      {held && (
        <HeldSales
          products={products.data || []}
          ready={products.isSuccess}
          holdCurrent={() => saveHeld()}
          onClose={() => setHeld(false)}
        />
      )}
      {camera && (
        <Scanner
          onCode={(code) => {
            scan(code);
            setCamera(false);
          }}
          onClose={() => setCamera(false)}
        />
      )}
    </div>
  );
}

function HeldSales({
  products,
  ready,
  holdCurrent,
  onClose,
}: {
  products: Product[];
  ready: boolean;
  holdCurrent: () => Promise<boolean>;
  onClose: () => void;
}) {
  const { setCart, setCustomer, setDiscount } = useStore();
  const [busy, setBusy] = useState(false);
  const client = useQueryClient();
  const query = useQuery({
    queryKey: ["quotes"],
    queryFn: () => api("/quotes"),
  });
  const recover = async (quote: any) => {
    if (busy) return;
    // El carrito se arma antes de consumir la venta en espera: si falta un
    // producto, se avisa cuál y no se pierde nada (R9-caja-5).
    if (!ready) {
      toast(
        "El catálogo todavía se está cargando. Intenta en un momento.",
        true,
      );
      return;
    }
    const lines: CartItem[] = [],
      missing: string[] = [];
    for (const i of quote.items) {
      const product = products.find((p) =>
        p.variants.some((v) => v.id === i.variantId),
      );
      const variant = product?.variants.find((v) => v.id === i.variantId);
      if (product && variant)
        lines.push({
          product,
          variant,
          qty: Number(i.qty),
          discountPercent: Number(i.discountPercent ?? 0),
          ...(i.discountAmount
            ? { discountAmount: Number(i.discountAmount) }
            : {}),
        });
      else missing.push(i.name || "un artículo");
    }
    if (!lines.length) {
      toast(
        "Ningún artículo de esta venta sigue a la venta: " +
          missing.join(", ") +
          ".",
        true,
      );
      return;
    }
    const current = useStore.getState().cart;
    const notes = [
      ...(missing.length
        ? [
            "Ya no están a la venta y no se recuperarán: " +
              missing.join(", ") +
              ".",
          ]
        : []),
      // El carrito actual no se reemplaza en silencio: queda en espera.
      ...(current.length
        ? [
            "La venta actual (" +
              current.reduce((a, i) => a + i.qty, 0) +
              " artículos) quedará en espera.",
          ]
        : []),
    ];
    if (
      notes.length &&
      !window.confirm(notes.join("\n") + "\n¿Recuperar esta venta?")
    )
      return;
    setBusy(true);
    try {
      if (current.length && !(await holdCurrent())) return;
      await post("/quotes/" + quote.id + "/convert", {});
      setCart(lines);
      setCustomer(quote.customerId ?? null);
      // Su propio descuento global, no el del carrito anterior (R9-caja-4).
      setDiscount(Number(quote.globalDiscount ?? 0));
      onClose();
    } catch (e: any) {
      toast(e.message, true);
    } finally {
      setBusy(false);
      await client.invalidateQueries({ queryKey: ["quotes"] });
    }
  };
  return (
    <Modal open onClose={onClose} title="Ventas en espera y cotizaciones">
      <QueryState query={query}>
        {query.data?.length ? (
          query.data.map((quote: any) => (
            <button
              className="held-row"
              key={quote.id}
              disabled={busy}
              onClick={() => recover(quote)}
            >
              <Pause size={18} />
              <span>
                {quote.type === "held" ? "En espera" : "Cotización"}
                <small>
                  {quote.items.length} artículos ·{" "}
                  {new Date(quote.createdAt).toLocaleString("es-DO", {
                    timeZone: "America/Santo_Domingo",
                  })}
                </small>
                {quote.items.some((i: any) => i.name) && (
                  <small>
                    {quote.items
                      .map((i: any) => i.name)
                      .filter(Boolean)
                      .join(", ")}
                  </small>
                )}
              </span>
              <ChevronRight />
            </button>
          ))
        ) : (
          <Empty
            title="Todo listo para la próxima venta"
            description="Aquí aparecerán los carritos que guardes."
          />
        )}
      </QueryState>
    </Modal>
  );
}

// Cobro que el servidor no contestó y que no se guarda localmente: pudo quedar
// registrado. Se conserva su offlineUuid para que cobrarlo otra vez no registre
// la venta dos veces (R9-offline-1).
let unanswered: { key: string; uuid: string; capturedAt: string } | null = null;
function Checkout({
  total,
  tax,
  lines,
  session,
  onClose,
  config,
  customers,
}: {
  total: number;
  tax: number;
  lines: ReturnType<typeof lineTotals>[];
  session: any;
  onClose: () => void;
  config: any;
  customers: any[];
}) {
  const { cart, customerId, globalDiscount, user, online, clearCart } =
    useStore();
  const [payments, setPayments] = useState<SaleInput["payments"]>([]),
    [method, setMethod] =
      useState<SaleInput["payments"][number]["method"]>("cash"),
    [amount, setAmount] = useState(String(total)),
    [details, setDetails] = useState({
      bank: "",
      reference: "",
      cardBrand: "Visa",
      cardLast4: "",
      approvalCode: "",
      cardType: "credit" as "credit" | "debit",
    }),
    [pin, setPin] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [receipt, setReceipt] = useState<any>(null);
  const [creditNoteId, setCreditNoteId] = useState("");
  const [creditNoteCode, setCreditNoteCode] = useState("");
  const [creditDueDate, setCreditDueDate] = useState("");
  const [ncfType, setNcfType] = useState<"" | "B01" | "B02">("");
  const [recipientLegalId, setRecipientLegalId] = useState("");
  const notes = useQuery({
    queryKey: ["credit-notes", customerId, creditNoteCode],
    queryFn: () =>
      api(
        "/credit-notes?" +
          new URLSearchParams({
            ...(customerId ? { customerId } : {}),
            ...(creditNoteCode.length === 32 ? { code: creditNoteCode } : {}),
          }),
      ),
    enabled:
      online &&
      (can(user!.permissions, "sale:manage") ||
        !!customerId ||
        creditNoteCode.length === 32),
  });
  // Un cobro sin respuesta del servidor se repite con el mismo offlineUuid
  // mientras el carrito sea el mismo, aunque se haya cerrado la ventana
  // (R9-offline-1).
  const attempt = JSON.stringify([
    session?.id,
    customerId,
    globalDiscount,
    cart.map((i) => [
      i.variant.id,
      i.qty,
      i.discountPercent,
      i.discountAmount ?? 0,
    ]),
  ]);
  const previous = unanswered?.key === attempt ? unanswered : null;
  const [awaitingConfirmation, setAwaitingConfirmation] = useState(!!previous);
  const uuid = useRef(previous?.uuid ?? crypto.randomUUID());
  const captured = useRef<string | null>(previous?.capturedAt ?? null);
  const client = useQueryClient();
  let payment = { paid: 0, pending: total, change: 0 };
  try {
    payment = paymentTotals(total, payments);
  } catch {
    /* El formulario evita el exceso de pagos sin efectivo. */
  }
  const needsPin =
    payments
      .filter((p) => p.method === "credit")
      .reduce((sum, p) => sum + p.amount, 0) >
      Number(config?.creditApprovalThreshold ?? 1000) ||
    payments.some((p) => p.method === "credit_note" && !p.creditNoteCode) ||
    (!can(user!.permissions, "sale:manage") &&
      cart.some(
        (i) =>
          manualDiscount(i, globalDiscount) >
          (config?.sellerDiscountLimit ?? 10),
      ));
  const addPayment = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    const value = Number(amount);
    if (!Number.isFinite(value) || value <= 0) {
      setError("Indica un monto positivo.");
      return;
    }
    if (method === "credit_note" && !creditNoteId) {
      setError("Selecciona una nota de crédito.");
      return;
    }
    if (method === "credit" && (!customerId || !creditDueDate)) {
      setError("Selecciona un cliente y fecha de vencimiento.");
      return;
    }
    const next = [
      ...payments,
      {
        method,
        amount: value,
        ...(method === "credit_note"
          ? { creditNoteId, ...(creditNoteCode ? { creditNoteCode } : {}) }
          : {}),
        ...(method === "card"
          ? {
              cardBrand: details.cardBrand,
              cardType: details.cardType,
              cardLast4: details.cardLast4,
              approvalCode: details.approvalCode,
            }
          : method === "transfer"
            ? { bank: details.bank, reference: details.reference }
            : {}),
      },
    ];
    try {
      const result = paymentTotals(total, next);
      setPayments(next);
      setAmount(String(result.pending));
      setDetails({
        ...details,
        reference: "",
        cardLast4: "",
        approvalCode: "",
      });
    } catch (e: any) {
      setError(e.message);
    }
  };
  const finish = async () => {
    setBusy(true);
    setError("");
    const input: SaleInput = {
      offlineUuid: uuid.current,
      capturedAt:
        captured.current ?? (captured.current = new Date().toISOString()),
      customerId,
      cashSessionId: session.id,
      items: cart.map((i) => ({
        variantId: i.variant.id,
        qty: i.qty,
        discountPercent: i.discountPercent,
        discountAmount: i.discountAmount,
      })),
      globalDiscount,
      expectedTotal: total,
      ...(payments.some((p) => p.method === "credit") && creditDueDate
        ? {
            creditDueDate: new Date(
              creditDueDate + "T23:59:59-04:00",
            ).toISOString(),
          }
        : {}),
      ...(ncfType
        ? { ncfType, ...(recipientLegalId ? { recipientLegalId } : {}) }
        : {}),
      payments,
      ...(pin ? { managerPin: pin } : {}),
    };
    // El ticket lleva el descuento de cada línea para que cuadre con el total
    // cobrado (R9-caja-9).
    const snapshot = cart.map((i, index) => ({
      variantId: i.variant.id,
      name: i.product.name,
      sku: i.variant.sku,
      qty: i.qty,
      unitPrice: Number(i.variant.price),
      discount: lines[index]?.discount ?? 0,
      lineTotal: lines[index]?.total ?? 0,
    }));
    try {
      const preserveUnanswered = async (): Promise<never> => {
        setAwaitingConfirmation(true);
        unanswered = {
          key: attempt,
          uuid: uuid.current,
          capturedAt: captured.current!,
        };
        // Nunca se conserva el PIN del gerente. Si la petición no llegó y la
        // operación lo requería, la sincronización quedará para revisión; si
        // sí llegó, el UUID basta para recuperar la venta ya registrada.
        const { managerPin: discardedPin, ...recoveryInput } = input;
        void discardedPin;
        let preserved = false;
        try {
          await localDB.sales.put({
            id: uuid.current,
            userId: user!.id,
            branchId: user!.branchId,
            input: recoveryInput,
            status: "pending",
            createdAt: Date.now(),
            receipt: {
              number: "PENDIENTE-" + uuid.current.slice(0, 8),
              total,
              taxTotal: tax,
              snapshot,
              uncertain: true,
            },
          });
          preserved = true;
        } catch {
          // La memoria de esta pestaña aún conserva el UUID. El mensaje
          // siguiente indica qué hacer si IndexedDB no estaba disponible.
        }
        throw new Error(
          preserved
            ? "No hubo respuesta del servidor: la venta quedó pendiente de confirmación con el mismo código. No la cobres otra vez; al volver la conexión se comprobará automáticamente sin duplicarla."
            : "No hubo respuesta del servidor: no se sabe si la venta quedó registrada. Mantén este carrito y, cuando vuelva la conexión, pulsa «Finalizar venta» otra vez con los mismos pagos; si ya quedó registrada, no se cobra dos veces.",
        );
      };
      // Sólo con la opción habilitada una venta iniciada offline queda en este
      // equipo y descuenta el stock local. Si una petición en línea perdió la
      // respuesta, se conserva aparte para confirmar su UUID sin asumir que
      // se completó ni volver a descontar inventario (R9-offline-1/2).
      const saveLocal = async (fallback: boolean) => {
        const offlineAction = offlineSaleAction(
          config?.allowOfflineSales,
          fallback,
        );
        if (offlineAction !== "save") {
          if (offlineAction === "retry") {
            // La petición pudo llegar antes del corte. Se conserva el mismo
            // UUID también tras una recarga, pero no se imprime, no se limpia
            // el carrito ni se descuenta stock local hasta confirmarla.
            return preserveUnanswered();
          }
          throw new Error(
            "Las ventas sin conexión están desactivadas para evitar conflictos de inventario entre varias cajas. Conéctate para cobrar o pide al administrador que revise esta opción en Ajustes.",
          );
        }
        // Contraentrega: queda un saldo pendiente en el servidor, como el crédito.
        const credit = payments.some(
          (p) =>
            p.method === "credit" ||
            p.method === "credit_note" ||
            p.method === "cod",
        );
        // Sin respuesta (504 o conexión cortada tras enviar), un crédito o
        // una venta con PIN pudo quedar registrada. La misma ruta de
        // recuperación persistente evita duplicar la deuda tras una recarga.
        if (fallback && (credit || needsPin)) {
          // La política activa permite guardar efectivo localmente, pero no
          // autoriza completar créditos o aprobaciones sin confirmación.
          return preserveUnanswered();
        }
        if (credit)
          throw new Error(
            "Las ventas a crédito, contraentrega y notas de crédito requieren conexión.",
          );
        if (needsPin)
          throw new Error(
            "Un gerente debe aprobar descuentos superiores al límite en línea.",
          );
        const local = {
          number: "LOCAL-" + uuid.current.slice(0, 8),
          total,
          taxTotal: tax,
          payments: payments.map((p) => ({
            ...p,
            change: p.method === "cash" ? payment.change : 0,
          })),
          offline: true,
        };
        await localDB.sales.put({
          id: uuid.current,
          userId: user!.id,
          branchId: user!.branchId,
          input,
          status: "pending",
          createdAt: Date.now(),
          receipt: { ...local, snapshot },
        });
        await discountLocalStock(client, input.items);
        return local;
      };
      let sale: any;
      let confirmedOnline = false;
      if (!online) sale = await saveLocal(false);
      else {
        try {
          // Con plazo: en un corte con el router encendido la petición se
          // quedaba sin respuesta minutos, con la venta en «ocupado»
          // (R9-offline-1).
          sale = await api("/sales", {
            method: "POST",
            body: JSON.stringify(input),
            timeout: ANSWER_TIMEOUT,
          });
          confirmedOnline = true;
        } catch (e: any) {
          if (!isNetworkError(e)) throw e;
          sale = await saveLocal(true);
        }
      }
      if (confirmedOnline)
        await localDB.sales.delete(uuid.current).catch(() => {});
      setAwaitingConfirmation(false);
      unanswered = null;
      // En línea, el ticket usa los importes que guardó el servidor (una
      // línea puede repartirse en varios lotes); sin conexión, los de la caja.
      const sum = (rows: any[], key: string) =>
        money(rows.reduce((a, r) => a.plus(r[key] ?? 0), d(0)));
      const printed = snapshot.map((line) => {
        const rows = (sale.items ?? []).filter(
          (r: any) => r.variantId === line.variantId,
        );
        return rows.length
          ? {
              ...line,
              discount: sum(rows, "discount"),
              lineTotal: sum(rows, "lineTotal"),
            }
          : line;
      });
      setReceipt({
        ...sale,
        snapshot: printed,
        change: payment.change,
        tendered: payments,
        createdAt: sale.createdAt ?? new Date().toISOString(),
      });
      // Impresión automática de la factura (Ajustes).
      if (config?.autoPrintReceipt) printSoon();
      clearCart();
      await client.invalidateQueries();
    } catch (e: any) {
      // Un precio o una promoción cambiaron en otro equipo: antes la única
      // salida era quitar y volver a agregar la línea. Se leen catálogo,
      // promociones y ajustes, el carrito toma los precios nuevos y se dice
      // cuáles cambiaron; el cobro ya muestra el total nuevo (R9-offline-3).
      if (/precios o promociones cambiaron/i.test(e.message))
        setError(await reprice().catch(() => e.message));
      // El cobro sin respuesta sí quedó registrado, pero con otros pagos: en
      // esta ventana no se vuelve a cobrar (R9-offline-1).
      else if (/UUID ya corresponde/i.test(e.message)) {
        setAwaitingConfirmation(false);
        unanswered = null;
        setError(
          "El cobro anterior sí quedó registrado, con otros pagos. Revísalo en Ventas antes de cobrar otra vez.",
        );
      } else setError(e.message);
    } finally {
      setBusy(false);
    }
  };
  const reprice = async () => {
    const before = new Map(
      cart.map((i) => [i.variant.id, Number(i.variant.price)]),
    );
    await Promise.all(
      ["catalog", "promotions", "settings"].map((key) =>
        client.refetchQueries({ queryKey: [key] }),
      ),
    );
    refreshCart(client.getQueryData<Product[]>(["catalog"]) ?? []);
    const changes = useStore
      .getState()
      .cart.filter(
        (i) =>
          before.has(i.variant.id) &&
          before.get(i.variant.id) !== Number(i.variant.price),
      )
      .map((item) => ({ item, before: before.get(item.variant.id)! }));
    return (
      (changes.length
        ? "Los precios cambiaron: " + priceChanges(changes) + "."
        : "Las promociones cambiaron.") +
      " El total ya está actualizado: revisa los pagos y finaliza otra vez."
    );
  };
  // Si esta ventana sigue abierta, al recuperar conexión confirma el mismo
  // UUID y sólo entonces muestra el recibo y limpia el carrito. La cola puede
  // sincronizarlo a la vez; ambas rutas son idempotentes.
  useEffect(() => {
    if (!online || !awaitingConfirmation || busy || receipt) return;
    setAwaitingConfirmation(false);
    void finish();
  }, [online, awaitingConfirmation, busy, receipt]);
  if (receipt) {
    const text = `Nexora POS · ${receipt.number}\nTotal: ${formatMoney(receipt.total)}\nGracias por tu compra. Documento interno, no fiscal.`;
    const customer = customers.find((c) => c.id === customerId);
    return (
      <Modal open title="¡Una venta más, una meta más cerca!" onClose={onClose}>
        <div className="sale-success">
          <div className="success-circle">
            <Check size={36} />
          </div>
          <h2>{formatMoney(receipt.total)}</h2>
          <p>{receipt.number}</p>
          {receipt.offline ? (
            <Badge tone="warning">
              Guardada en este dispositivo · Pendiente de sincronizar
            </Badge>
          ) : (
            <Badge tone="success">Venta registrada</Badge>
          )}
          {Number(receipt.creditBalance) > 0 && (
            <p>
              Saldo a crédito:{" "}
              <strong>{formatMoney(receipt.creditBalance)}</strong>
            </p>
          )}
          <p>
            Cambio: <strong>{formatMoney(receipt.change)}</strong>
          </p>
        </div>
        <div className="receipt-actions">
          <Button className="print-big" onClick={() => window.print()}>
            <Printer size={20} />
            Imprimir factura
          </Button>
          {!receipt.offline && (
            <Button
              variant="secondary"
              onClick={() =>
                download(
                  "/sales/" + receipt.id + "/receipt.pdf",
                  receipt.number + ".pdf",
                ).catch((e) => toast(e.message, true))
              }
            >
              <FileText size={17} />
              Factura PDF
            </Button>
          )}
          <a
            className="button secondary"
            target="_blank"
            rel="noreferrer"
            href={
              "https://wa.me/" +
              (customer?.phone?.replace(/\D/g, "") || "") +
              "?text=" +
              encodeURIComponent(text)
            }
          >
            <Send size={17} />
            WhatsApp
          </a>
          <a
            className="button secondary"
            href={
              "mailto:" +
              (customer?.email || "") +
              "?subject=" +
              encodeURIComponent("Recibo " + receipt.number) +
              "&body=" +
              encodeURIComponent(text)
            }
          >
            <Mail size={17} />
            Correo
          </a>
        </div>
        <Button className="full-width" onClick={onClose}>
          Nueva venta <Plus size={18} />
        </Button>
        <PrintSheet width={config?.receiptWidth}>
          <InvoicePrint sale={receipt} config={config} customer={customer} />
        </PrintSheet>
      </Modal>
    );
  }
  return (
    <Modal open title="Todo listo para cobrar" onClose={onClose}>
      <div className="payment-total">
        <span>Total de esta venta</span>
        <h2>{formatMoney(total)}</h2>
        <small>
          ITBIS {config?.taxIncluded === false ? "" : "incluido"} ·{" "}
          {formatMoney(tax)}
        </small>
      </div>
      <div className="payment-methods">
        {[
          { id: "cash", label: "Efectivo", icon: Banknote },
          { id: "card", label: "Tarjeta", icon: CreditCard },
          { id: "transfer", label: "Transferencia", icon: Landmark },
          { id: "credit_note", label: "Nota de crédito", icon: FileText },
          { id: "credit", label: "A crédito", icon: CreditCard },
          { id: "cod", label: "Contraentrega", icon: Truck },
        ]
          .filter((m) => m.id !== "credit" || config?.allowCreditSales)
          .map((m) => (
            <button
              className={method === m.id ? "active" : ""}
              key={m.id}
              onClick={() => {
                setMethod(m.id as any);
                setAmount(String(payment.pending));
              }}
            >
              <m.icon size={22} />
              {m.label}
            </button>
          ))}
      </div>
      {config?.ncfMode === "prepared" && (
        <div className="form-grid">
          <label className="field">
            <span>Solicitud de NCF</span>
            <select
              value={ncfType}
              onChange={(e) => setNcfType(e.target.value as any)}
            >
              <option value="">Sin solicitud</option>
              <option value="B01">B01 · Crédito fiscal</option>
              <option value="B02">B02 · Consumidor final</option>
            </select>
          </label>
          {ncfType === "B01" && (
            <label className="field">
              <span>RNC o cédula del cliente</span>
              <input
                pattern="[0-9]{9,11}"
                value={recipientLegalId}
                onChange={(e) => setRecipientLegalId(e.target.value)}
              />
            </label>
          )}
          <small>
            Preparación de datos. El comprobante sigue siendo interno hasta su
            emisión fiscal.
          </small>
        </div>
      )}
      <form onSubmit={addPayment}>
        {method === "credit_note" && (
          <label className="field">
            <span>Código impreso de la nota</span>
            <input
              value={creditNoteCode}
              maxLength={32}
              onChange={(e) => {
                setCreditNoteCode(e.target.value.trim().toUpperCase());
                setCreditNoteId("");
              }}
            />
            <small>
              Las notas sin cliente requieren código. Las demás pueden aprobarse
              con PIN de gerente.
            </small>
          </label>
        )}
        {method === "credit_note" && (
          <label className="field">
            <span>Nota de crédito disponible</span>
            <select
              required
              value={creditNoteId}
              onChange={(e) => setCreditNoteId(e.target.value)}
            >
              <option value="">Seleccionar…</option>
              {notes.data
                ?.filter(
                  (n: any) => !n.customerId || n.customerId === customerId,
                )
                .map((n: any) => (
                  <option key={n.id} value={n.id}>
                    {n.number} · {formatMoney(n.balance)}
                  </option>
                ))}
            </select>
          </label>
        )}
        {method === "cod" && (
          <p className="cod-hint">
            Contraentrega: la venta sale del inventario y este importe queda
            pendiente hasta que el mensajero traiga el dinero. Regístralo luego
            en Caja › Contraentregas pendientes (efectivo, tarjeta o
            transferencia, con la foto de la evidencia). Se combina con
            cualquier otra forma, incluido el crédito.
          </p>
        )}
        {method === "credit" && (
          <label className="field">
            <span>Vencimiento del crédito</span>
            <input
              type="date"
              required
              value={creditDueDate}
              onChange={(e) => setCreditDueDate(e.target.value)}
            />
            <small>Requiere un cliente seleccionado.</small>
          </label>
        )}
        <label className="field">
          <span>Monto del pago</span>
          <input
            autoFocus
            type="number"
            min="0.01"
            step="0.01"
            required
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
        </label>
        {method === "cash" && (
          <div className="quick-bills">
            <button
              type="button"
              onClick={() => setAmount(String(payment.pending))}
            >
              Exacto
            </button>
            {[100, 200, 500, 1000, 2000].map((value) => (
              <button
                type="button"
                onClick={() => setAmount(String(value))}
                key={value}
              >
                {value.toLocaleString()}
              </button>
            ))}
          </div>
        )}
        {method === "card" && (
          <div className="form-grid">
            <label className="field">
              <span>Últimos 4 dígitos</span>
              <input
                required
                pattern="[0-9]{4}"
                maxLength={4}
                inputMode="numeric"
                value={details.cardLast4}
                onChange={(e) =>
                  setDetails({ ...details, cardLast4: e.target.value })
                }
              />
            </label>
            <label className="field">
              <span>Número de aprobación</span>
              <input
                required
                value={details.approvalCode}
                onChange={(e) =>
                  setDetails({ ...details, approvalCode: e.target.value })
                }
              />
            </label>
            <label className="field">
              <span>Marca</span>
              <select
                value={details.cardBrand}
                onChange={(e) =>
                  setDetails({ ...details, cardBrand: e.target.value })
                }
              >
                <option>Visa</option>
                <option>Mastercard</option>
                <option>Amex</option>
              </select>
            </label>
            <label className="field">
              <span>Tipo de tarjeta</span>
              <select
                value={details.cardType}
                onChange={(e) =>
                  setDetails({ ...details, cardType: e.target.value as any })
                }
              >
                <option value="credit">Crédito</option>
                <option value="debit">Débito</option>
              </select>
            </label>
          </div>
        )}
        {method === "transfer" && (
          <div className="form-grid">
            <label className="field">
              <span>Banco</span>
              <input
                required
                value={details.bank}
                onChange={(e) =>
                  setDetails({ ...details, bank: e.target.value })
                }
              />
            </label>
            <label className="field">
              <span>Referencia</span>
              <input
                required
                value={details.reference}
                onChange={(e) =>
                  setDetails({ ...details, reference: e.target.value })
                }
              />
            </label>
          </div>
        )}
        <Button
          variant="secondary"
          className="full-width"
          disabled={payment.pending <= 0}
        >
          <Plus size={16} />
          Agregar pago
        </Button>
      </form>
      <div className="payment-list">
        {payments.map((p, index) => (
          <div key={index}>
            <span>
              {METHOD_LABEL[p.method] ?? p.method}
              <small>{p.approvalCode || p.reference || ""}</small>
            </span>
            <strong>{formatMoney(p.amount)}</strong>
            <button
              aria-label="Quitar pago"
              onClick={() =>
                setPayments(payments.filter((_, i) => i !== index))
              }
            >
              <X size={15} />
            </button>
          </div>
        ))}
      </div>
      <div className="payment-balance">
        <div>
          <span>Pendiente</span>
          <strong>{formatMoney(payment.pending)}</strong>
        </div>
        <div>
          <span>Cambio</span>
          <strong className="green-text">{formatMoney(payment.change)}</strong>
        </div>
      </div>
      {needsPin && (
        <label className="field">
          <span>PIN del gerente para aprobar el descuento</span>
          <input
            type="password"
            inputMode="numeric"
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            pattern="[0-9]{4,6}"
          />
        </label>
      )}
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <Button
        variant="success"
        className="full-width"
        disabled={
          busy || !payments.length || payment.pending > 0 || (needsPin && !pin)
        }
        onClick={finish}
      >
        <Check size={19} />
        {busy ? "Registrando…" : "Finalizar venta"}
      </Button>
    </Modal>
  );
}
function Scanner({
  onCode,
  onClose,
}: {
  onCode: (code: string) => void;
  onClose: () => void;
}) {
  const video = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    let controls: { stop: () => void } | undefined;
    let stopped = false;
    (async () => {
      try {
        const { BrowserMultiFormatReader } = await import("@zxing/browser");
        if (stopped) return;
        const reader = new BrowserMultiFormatReader();
        controls = await reader.decodeFromVideoDevice(
          undefined,
          video.current!,
          (result, _error, c) => {
            if (result && !stopped) {
              stopped = true;
              c.stop();
              onCode(result.getText());
            }
          },
        );
        if (stopped) controls.stop();
      } catch (e: any) {
        setError(
          "No se pudo usar la cámara: " +
            e.message +
            ". Usa el lector o el buscador.",
        );
      }
    })();
    return () => {
      stopped = true;
      controls?.stop();
    };
  }, []);
  return (
    <Modal open title="Escanear código de barras" onClose={onClose}>
      {error ? (
        <p className="form-error">{error}</p>
      ) : (
        <>
          <video ref={video} className="scanner-video" muted playsInline />
          <p>Centra el código en la cámara.</p>
        </>
      )}
    </Modal>
  );
}
