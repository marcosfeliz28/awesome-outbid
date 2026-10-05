import { useEffect, useRef, useState } from "react";
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
  post,
  loadCatalog,
  localDB,
  download,
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
import { CashElsewhere, cashOnOtherDevice } from "./realtime";

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
  const client = useQueryClient();
  const products = useQuery({ queryKey: ["catalog"], queryFn: loadCatalog });
  const categories = useQuery({
    queryKey: ["categories"],
    queryFn: async () => {
      if (!navigator.onLine)
        return (await localDB.cache.get("categories"))?.data || [];
      const data = await api("/categories");
      await localDB.cache.put({ key: "categories", data });
      return data;
    },
  });
  const customers = useQuery({
    queryKey: ["customers"],
    queryFn: async () => {
      if (!navigator.onLine)
        return (await localDB.cache.get("customers:" + user!.id))?.data || [];
      const data = await api("/customers");
      await localDB.cache.put({ key: "customers:" + user!.id, data });
      return data;
    },
  });
  const sessions = useQuery({
    queryKey: ["cash-sessions"],
    queryFn: async () => {
      if (!navigator.onLine)
        return (await localDB.cache.get("cash:" + user!.id))?.data || [];
      const data = await api("/cash-sessions");
      await localDB.cache.put({ key: "cash:" + user!.id, data });
      return data;
    },
  });
  const promos = useQuery({
    queryKey: ["promotions"],
    queryFn: async () => {
      if (!navigator.onLine)
        return (await localDB.cache.get("promotions"))?.data || [];
      const data = await api("/promotions");
      await localDB.cache.put({ key: "promotions", data });
      return data;
    },
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
    queryKey: ["settings"],
    queryFn: async () => {
      if (!navigator.onLine)
        return (
          (await localDB.cache.get("settings"))?.data || { taxIncluded: true }
        );
      const data = await api("/settings");
      await localDB.cache.put({ key: "settings", data });
      return data;
    },
  });
  const totals = cart.map((i) =>
    lineTotals(
      i.qty,
      Number(i.variant.price),
      Math.max(
        100 -
          ((100 -
            Math.max(
              i.discountPercent,
              ((i.discountAmount ?? 0) /
                Math.max(0.01, i.qty * Number(i.variant.price))) *
                100,
            )) *
            (100 - globalDiscount)) /
            100,
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
  // Devuelve true sólo si el artículo entró al carrito.
  const choose = (variant: Variant, product: Product) => {
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
    if ((existing?.qty || 0) + 1 > Number(variant.stock))
      toast("Advertencia: esta venta dejará stock negativo.", true);
    return true;
  };
  const addProduct = (product: Product) =>
    product.variants.length === 1
      ? choose(product.variants[0], product)
      : setChoosing(product);
  const saveHeld = async (type = "held") => {
    if (!cart.length) return;
    try {
      if (!online)
        throw new Error("Conéctate para guardar una venta en espera.");
      await post("/quotes", {
        type,
        customerId,
        items: cart.map((i) => ({
          variantId: i.variant.id,
          qty: i.qty,
          discountPercent: i.discountPercent,
          discountAmount: i.discountAmount,
        })),
      });
      clearCart();
      await client.invalidateQueries({ queryKey: ["quotes"] });
      toast(
        type === "held" ? "Venta guardada en espera." : "Cotización guardada.",
      );
    } catch (e: any) {
      toast(e.message, true);
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
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
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
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [cart, session, online]);
  // Búsqueda por palabras sueltas, sin acentos, apóstrofos ni orden:
  // "iso100 vanilla 5lb" encuentra "ISO100 Hydrolyzed - Dymatize - Gourmet
  // Vanilla / 5 lb" y "loreal" encuentra "L'Oréal".
  const words = searchWords(q);
  const filtered =
    products.data?.filter(
      (p) =>
        (category === "all" || p.categoryId === category) &&
        (!words.length ||
          matchesWords(
            [
              p.name,
              p.sku,
              p.brand,
              ...p.variants.flatMap((v) => [
                v.sku,
                v.barcode,
                ...Object.values(v.attributes || {}).map(String),
              ]),
            ].join(" "),
            words,
          )),
    ) || [];
  // Con cientos de productos se dibujan 120 tarjetas; la búsqueda llega al resto.
  const MAX_CARDS = 120;
  const visible = filtered.slice(0, MAX_CARDS);
  // Código exacto: primero el código de barras y, si ninguno coincide, el
  // código del producto (el ID del inventario, por ejemplo 1216). Así se cobra
  // escribiendo el número + Enter, sin depender del orden del catálogo.
  const byCode = (code: string) => {
    const c = code.trim().toLowerCase();
    if (!c) return undefined;
    for (const field of ["barcode", "sku"] as const)
      for (const p of products.data ?? [])
        for (const v of p.variants)
          if (v[field].toLowerCase() === c) return { product: p, variant: v };
    return undefined;
  };
  const scan = (code: string) => {
    const found = byCode(code);
    const product = found?.product,
      variant = found?.variant;
    if (product && variant) {
      // Sin stock: el código queda en la caja y el aviso de stock se ve.
      if (choose(variant, product)) {
        setQ("");
        toast(product.name + " agregado.");
      }
    } else {
      setQ(code);
      toast("Código no encontrado.", true);
    }
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
              if (e.key === "Enter") {
                if (byCode(q)) scan(q);
                else if (filtered.length === 1) addProduct(filtered[0]);
              }
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
          {categories.data?.map((c: any) => (
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
            {filtered.length > MAX_CARDS
              ? `Mostrando ${MAX_CARDS} de ${filtered.length} · escribe para encontrar el resto`
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
                        onClick={() => updateQty(i.variant.id, i.qty - 1)}
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
                        onChange={(e) =>
                          setCart(
                            cart.map((item) =>
                              item.variant.id === i.variant.id
                                ? {
                                    ...item,
                                    discountPercent: Number(e.target.value),
                                  }
                                : item,
                            ),
                          )
                        }
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
                        onChange={(e) =>
                          setCart(
                            cart.map((item) =>
                              item.variant.id === i.variant.id
                                ? {
                                    ...item,
                                    discountAmount: Number(e.target.value),
                                  }
                                : item,
                            ),
                          )
                        }
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
                onChange={(e) =>
                  setDiscount(
                    Math.min(100, Math.max(0, Number(e.target.value))),
                  )
                }
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
              onClick={() => choose(v, choosing)}
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
          session={session}
          onClose={() => setCheckout(false)}
          config={config.data}
          customers={customers.data || []}
        />
      )}
      {held && (
        <HeldSales
          products={products.data || []}
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
  onClose,
}: {
  products: Product[];
  onClose: () => void;
}) {
  const { setCart, setCustomer } = useStore();
  const client = useQueryClient();
  const query = useQuery({
    queryKey: ["quotes"],
    queryFn: () => api("/quotes"),
  });
  return (
    <Modal open onClose={onClose} title="Ventas en espera y cotizaciones">
      <QueryState query={query}>
        {query.data?.length ? (
          query.data.map((quote: any) => (
            <button
              className="held-row"
              key={quote.id}
              onClick={async () => {
                try {
                  await post("/quotes/" + quote.id + "/convert", {});
                  const cart = quote.items.map((i: any) => {
                    const product = products.find((p) =>
                      p.variants.some((v) => v.id === i.variantId),
                    );
                    const variant = product?.variants.find(
                      (v) => v.id === i.variantId,
                    );
                    if (!product || !variant)
                      throw new Error("Una variante ya no está disponible.");
                    return { ...i, product, variant };
                  });
                  setCart(cart);
                  setCustomer(quote.customerId);
                  await client.invalidateQueries({ queryKey: ["quotes"] });
                  onClose();
                } catch (e: any) {
                  toast(e.message, true);
                }
              }}
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

function Checkout({
  total,
  tax,
  session,
  onClose,
  config,
  customers,
}: {
  total: number;
  tax: number;
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
  const uuid = useRef(crypto.randomUUID());
  const captured = useRef<string | null>(null);
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
          100 -
            ((100 -
              Math.max(
                i.discountPercent,
                ((i.discountAmount ?? 0) /
                  Math.max(0.01, i.qty * Number(i.variant.price))) *
                  100,
              )) *
              (100 - globalDiscount)) /
              100 >
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
    const snapshot = cart.map((i) => ({
      name: i.product.name,
      sku: i.variant.sku,
      qty: i.qty,
      unitPrice: Number(i.variant.price),
    }));
    try {
      let sale: any;
      if (!online) {
        if (
          payments.some(
            (p) => p.method === "credit" || p.method === "credit_note",
          )
        )
          throw new Error(
            "Las ventas a crédito y notas de crédito requieren conexión.",
          );
        if (needsPin)
          throw new Error(
            "Un gerente debe aprobar descuentos superiores al límite en línea.",
          );
        sale = {
          number: "LOCAL-" + uuid.current.slice(0, 8),
          total,
          taxTotal: tax,
          payments: payments.map((p) => ({
            ...p,
            change: p.method === "cash" ? payment.change : 0,
          })),
          offline: true,
        };
        await localDB.sales.add({
          id: uuid.current,
          userId: user!.id,
          branchId: user!.branchId,
          input,
          status: "pending",
          createdAt: Date.now(),
          receipt: { ...sale, snapshot },
        });
        const cached = await localDB.cache.get("catalog:" + user!.branchId);
        if (cached)
          await localDB.cache.put({
            key: cached.key,
            data: cached.data.map((p: Product) => ({
              ...p,
              variants: p.variants.map((v) => ({
                ...v,
                stock: String(
                  Math.max(
                    0,
                    Number(v.stock) -
                      (cart.find((i) => i.variant.id === v.id)?.qty || 0),
                  ),
                ),
              })),
            })),
          });
      } else {
        try {
          sale = await post("/sales", input);
        } catch (e: any) {
          if (e instanceof TypeError) {
            if (needsPin)
              throw new Error(
                "Reconecta para verificar la aprobación del gerente.",
              );
            sale = {
              number: "LOCAL-" + uuid.current.slice(0, 8),
              total,
              taxTotal: tax,
              payments,
              offline: true,
            };
            await localDB.sales.put({
              id: uuid.current,
              userId: user!.id,
              branchId: user!.branchId,
              input,
              status: "pending",
              createdAt: Date.now(),
              receipt: { ...sale, snapshot },
            });
          } else throw e;
        }
      }
      setReceipt({ ...sale, snapshot, change: payment.change });
      clearCart();
      await client.invalidateQueries();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };
  if (receipt) {
    const text = `FitStore · ${receipt.number}\nTotal: ${formatMoney(receipt.total)}\nGracias por tu compra. Documento interno, no fiscal.`;
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
          <Button variant="secondary" onClick={() => window.print()}>
            <Printer size={17} />
            Ticket {config?.receiptWidth || 80} mm
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
        <div
          className="receipt-only"
          style={{ width: (config?.receiptWidth || 80) + "mm" }}
        >
          <h2>FitStore</h2>
          <p>{receipt.number}</p>
          <p>Documento interno — no fiscal</p>
          {receipt.snapshot.map((i: any) => (
            <p key={i.sku}>
              {i.name}
              <br />
              {i.qty} × {formatMoney(i.unitPrice)}
            </p>
          ))}
          <hr />
          <h3>Total {formatMoney(receipt.total)}</h3>
          <p>ITBIS {formatMoney(receipt.taxTotal)}</p>
          {Number(receipt.creditBalance) > 0 && (
            <p>Saldo a crédito {formatMoney(receipt.creditBalance)}</p>
          )}
          {receipt.ncfType && (
            <p>Solicitud NCF {receipt.ncfType} · pendiente de emisión fiscal</p>
          )}
          <p>Cambio {formatMoney(receipt.change)}</p>
          {receipt.offline && (
            <p>RECIBO PROVISIONAL · PENDIENTE DE SINCRONIZAR</p>
          )}
          <p>¡Gracias por tu compra!</p>
        </div>
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
              {p.method === "cash"
                ? "Efectivo"
                : p.method === "card"
                  ? "Tarjeta"
                  : p.method === "transfer"
                    ? "Transferencia"
                    : p.method === "credit_note"
                      ? "Nota de crédito"
                      : "A crédito"}
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
