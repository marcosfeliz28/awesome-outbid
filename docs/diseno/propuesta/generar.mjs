/* global console, process, document */
// Genera las maquetas estáticas de la propuesta de diseño (3 direcciones × 3
// pantallas) y sus capturas. No toca la aplicación.
//   node docs/diseno/propuesta/generar.mjs            → HTML + PNG
//   node docs/diseno/propuesta/generar.mjs --sin-png  → solo HTML
// Las capturas se reducen a paleta de 256 colores con Python/Pillow si está
// disponible (para que cada PNG quede por debajo de ~400 KB).
import { writeFileSync, statSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const OUT = dirname(fileURLToPath(import.meta.url));

// ───────────────────────── Datos de muestra ─────────────────────────
const LINES = { sup: "Suplementos", maq: "Maquillaje", faj: "Fajas" };
const PRODUCTS = [
  {
    sku: "1937",
    name: "BS Small Set de brochas",
    line: "maq",
    price: 1000,
    stock: 14,
  },
  {
    sku: "1188",
    name: "Carnivor Mass 6 lb chocolate",
    line: "sup",
    price: 4800,
    stock: 6,
  },
  {
    sku: "1615",
    name: "Faja chaleco Génesis talla M",
    line: "faj",
    price: 3500,
    stock: 5,
  },
  {
    sku: "1933",
    name: "Nitro-Tech Ripped 4 lb vainilla",
    line: "sup",
    price: 4500,
    stock: 3,
  },
  {
    sku: "1213",
    name: "Isopure 1 lb chocolate",
    line: "sup",
    price: 2600,
    stock: 9,
  },
  {
    sku: "1214",
    name: "Creatine Powder ON 300 g",
    line: "sup",
    price: 2200,
    stock: 11,
  },
  {
    sku: "1677",
    name: "Too Faced Born This Way corrector",
    line: "maq",
    price: 2100,
    stock: 2,
  },
  {
    sku: "1702",
    name: "Amave Liquid Foundation 05",
    line: "maq",
    price: 950,
    stock: 18,
  },
  {
    sku: "1710",
    name: "Amave Matte Setting Spray",
    line: "maq",
    price: 850,
    stock: 12,
  },
  {
    sku: "1576",
    name: "Corset Génesis talla 3XS",
    line: "faj",
    price: 2900,
    stock: 24,
  },
  {
    sku: "1602",
    name: "Corset Génesis talla L",
    line: "faj",
    price: 2900,
    stock: 1,
  },
  { sku: "1714", name: "Amave Blush 03", line: "maq", price: 700, stock: 16 },
];
const CART = [
  { ...PRODUCTS[0], qty: 1 },
  { ...PRODUCTS[1], qty: 1 },
  { ...PRODUCTS[2], qty: 1 },
];
const TOTAL = CART.reduce((s, l) => s + l.price * l.qty, 0);
const ITBIS = Math.round(((TOTAL * 18) / 118) * 100) / 100;
const BILLS = [2000, 1000, 500, 200, 100, 50, 20];
const COINS = [25, 10, 5, 1];
const COUNT = {
  2000: 3,
  1000: 4,
  500: 5,
  200: 6,
  100: 7,
  50: 4,
  20: 0,
  25: 2,
  10: 5,
  5: 3,
  1: 10,
};
const CASH = Object.entries(COUNT).reduce((s, [d, q]) => s + Number(d) * q, 0);
const PAY = [
  { key: "efectivo", label: "Efectivo", amount: 21400, n: 11 },
  { key: "tarjeta", label: "Tarjeta", amount: 15250, n: 7 },
  { key: "transfer", label: "Transferencia", amount: 11700, n: 5 },
];
const DAY = PAY.reduce((s, p) => s + p.amount, 0);
const CASHIERS = [
  { name: "Lizbeth", amount: 19800, n: 9 },
  { name: "Manuela", amount: 16250, n: 8 },
  { name: "Wendy", amount: 12300, n: 6 },
];
const BY_LINE = [
  { line: "sup", amount: 22900 },
  { line: "maq", amount: 14250 },
  { line: "faj", amount: 11200 },
];
const HOURS = [
  ["9", 1200],
  ["10", 2600],
  ["11", 5400],
  ["12", 6900],
  ["1", 4100],
  ["2", 3300],
  ["3", 5800],
  ["4", 7600],
  ["5", 6400],
  ["6", 5050],
];
// Autocomprobación: las tres vistas del día suman lo mismo.
const sum = (a) => a.reduce((s, x) => s + x.amount, 0);
if (sum(CASHIERS) !== DAY || sum(BY_LINE) !== DAY)
  throw new Error("Datos del tablero no cuadran");
if (HOURS.reduce((s, h) => s + h[1], 0) !== DAY)
  throw new Error("Horas no cuadran");
if (CASH !== 14725) throw new Error("Conteo de muestra cambió: " + CASH);

const fmt = (n, dec = false) =>
  "RD$ " +
  n.toLocaleString("en-US", {
    minimumFractionDigits: dec ? 2 : 0,
    maximumFractionDigits: 2,
  });

// ───────────────────────── Direcciones ─────────────────────────
// Cada dirección: fuentes, tokens claros/oscuros y CSS propio.
const DIRS = {
  a: {
    slug: "a-mostrador",
    name: "Mostrador",
    fonts:
      "family=Atkinson+Hyperlegible+Mono:wght@500;700&family=Atkinson+Hyperlegible+Next:wght@400;500;700;800",
    ui: '"Atkinson Hyperlegible Next", system-ui, sans-serif',
    num: '"Atkinson Hyperlegible Mono", ui-monospace, monospace',
    head: '"Atkinson Hyperlegible Next", system-ui, sans-serif',
    radius: ["6px", "10px", "14px"],
    light: {
      bg: "#E9ECF2",
      surface: "#FFFFFF",
      surface2: "#F4F5F9",
      ink: "#161A2E",
      muted: "#4A5068",
      line: "#CDD2DE",
      primary: "#4C2A9E",
      onPrimary: "#FFFFFF",
      primarySoft: "#ECE6FA",
      cobrar: "#0B6B4F",
      onCobrar: "#FFFFFF",
      danger: "#B42318",
      warn: "#8A4B00",
      ok: "#0B6B4F",
      display: "#161A2E",
      onDisplay: "#F3F0FF",
      displayMuted: "#B9B6D3",
      sup: "#0E5E8C",
      maq: "#A3245C",
      faj: "#6E5300",
      focus: "#4C2A9E",
    },
    dark: {
      bg: "#0E1018",
      surface: "#181B27",
      surface2: "#1F2333",
      ink: "#ECEEF6",
      muted: "#A9AEC4",
      line: "#2E3347",
      primary: "#BBA6F7",
      onPrimary: "#1A0F3D",
      primarySoft: "#2A2347",
      cobrar: "#34C48F",
      onCobrar: "#04130D",
      danger: "#FF8A80",
      warn: "#F2B45A",
      ok: "#34C48F",
      display: "#05060A",
      onDisplay: "#F3F0FF",
      displayMuted: "#A9A6C6",
      sup: "#6CC1F0",
      maq: "#F28DB8",
      faj: "#E3C25B",
      focus: "#BBA6F7",
    },
  },
  b: {
    slug: "b-tocador",
    name: "Tocador",
    fonts: "family=Figtree:wght@400;500;600;700;800&family=Young+Serif",
    ui: '"Figtree", system-ui, sans-serif',
    num: '"Figtree", system-ui, sans-serif',
    head: '"Young Serif", Georgia, serif',
    radius: ["10px", "16px", "24px"],
    light: {
      bg: "#FBF4F4",
      surface: "#FFFFFF",
      surface2: "#F6EAEA",
      ink: "#2B1630",
      muted: "#6B5260",
      line: "#EAD6D6",
      primary: "#8E2A57",
      onPrimary: "#FFFFFF",
      primarySoft: "#F7E3EB",
      cobrar: "#1D6B48",
      onCobrar: "#FFFFFF",
      danger: "#B3261E",
      warn: "#8A4B00",
      ok: "#1D6B48",
      display: "#2B1630",
      onDisplay: "#FFF3F7",
      displayMuted: "#D9BFCB",
      sup: "#3D6A2E",
      maq: "#8E2A57",
      faj: "#7A4A2A",
      focus: "#8E2A57",
    },
    dark: {
      bg: "#1A1119",
      surface: "#241823",
      surface2: "#2E1F2C",
      ink: "#F6E9EF",
      muted: "#C3AAB7",
      line: "#3D2A3A",
      primary: "#F0A6C6",
      onPrimary: "#3A0F22",
      primarySoft: "#3D2232",
      cobrar: "#4CC48A",
      onCobrar: "#06160E",
      danger: "#FF8F86",
      warn: "#F0B45E",
      ok: "#4CC48A",
      display: "#120B12",
      onDisplay: "#FFF3F7",
      displayMuted: "#CDB3C0",
      sup: "#A8D58F",
      maq: "#F0A6C6",
      faj: "#E5B48F",
      focus: "#F0A6C6",
    },
  },
  c: {
    slug: "c-tres-lineas",
    name: "Tres líneas",
    fonts:
      "family=Barlow:wght@400;500;600;700&family=Barlow+Semi+Condensed:wght@500;600;700",
    ui: '"Barlow", system-ui, sans-serif',
    num: '"Barlow Semi Condensed", "Barlow", sans-serif',
    head: '"Barlow Semi Condensed", "Barlow", sans-serif',
    radius: ["4px", "6px", "8px"],
    light: {
      bg: "#EEF2F1",
      surface: "#FFFFFF",
      surface2: "#F5F8F7",
      ink: "#0F2A2E",
      muted: "#46605F",
      line: "#CBD6D4",
      primary: "#0F2A2E",
      onPrimary: "#FFFFFF",
      primarySoft: "#E1EAE8",
      cobrar: "#157347",
      onCobrar: "#FFFFFF",
      danger: "#B3261E",
      warn: "#8A4B00",
      ok: "#157347",
      display: "#0F2A2E",
      onDisplay: "#F2FAF8",
      displayMuted: "#A9C2BF",
      sup: "#0B5F86",
      maq: "#A8325E",
      faj: "#7A5A00",
      focus: "#0B5F86",
    },
    dark: {
      bg: "#0C1719",
      surface: "#132225",
      surface2: "#192C30",
      ink: "#E6F0EE",
      muted: "#9DB5B2",
      line: "#27403F",
      primary: "#E6F0EE",
      onPrimary: "#0C1719",
      primarySoft: "#1E3437",
      cobrar: "#3CCB7F",
      onCobrar: "#04140B",
      danger: "#FF8F86",
      warn: "#F0B45E",
      ok: "#3CCB7F",
      display: "#081012",
      onDisplay: "#F2FAF8",
      displayMuted: "#9DB5B2",
      sup: "#6CC4EE",
      maq: "#F291B5",
      faj: "#E0C060",
      focus: "#6CC4EE",
    },
  },
};

// ───────────────────────── Contraste WCAG ─────────────────────────
function lum(hex) {
  const c = hex
    .replace("#", "")
    .match(/../g)
    .map((h) => parseInt(h, 16) / 255);
  const [r, g, b] = c.map((v) =>
    v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4,
  );
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
export function ratio(a, b) {
  const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m);
  return (x + 0.05) / (y + 0.05);
}
const PAIRS = [
  ["ink", "bg"],
  ["ink", "surface"],
  ["ink", "surface2"],
  ["muted", "surface"],
  ["muted", "bg"],
  ["muted", "surface2"],
  ["primary", "surface"],
  ["primary", "primarySoft"],
  ["onPrimary", "primary"],
  ["onCobrar", "cobrar"],
  ["danger", "surface"],
  ["warn", "surface"],
  ["ok", "surface"],
  ["onDisplay", "display"],
  ["displayMuted", "display"],
  ["sup", "surface"],
  ["maq", "surface"],
  ["faj", "surface"],
  ["sup", "surface2"],
  ["maq", "surface2"],
  ["faj", "surface2"],
];
const contrastRows = [];
for (const [k, d] of Object.entries(DIRS))
  for (const theme of ["light", "dark"]) {
    let min = 99,
      worst = "";
    for (const [fg, bg] of PAIRS) {
      const r = ratio(d[theme][fg], d[theme][bg]);
      if (r < 4.5)
        throw new Error(
          `Contraste ${k}/${theme} ${fg} sobre ${bg}: ${r.toFixed(2)}`,
        );
      if (r < min) [min, worst] = [r, fg + " / " + bg];
    }
    contrastRows.push({
      dir: d.name,
      theme,
      min: min.toFixed(2),
      worst,
      ink: ratio(d[theme].ink, d[theme].surface).toFixed(1),
    });
  }

// ───────────────────────── Piezas de HTML ─────────────────────────
const vars = (t) =>
  Object.entries(t)
    .map(
      ([k, v]) =>
        `--${k.replace(/[A-Z]/g, (m) => "-" + m.toLowerCase())}:${v};`,
    )
    .join("");

const ICON = {
  search: '<path d="M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zm9 16-4.3-4.3"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6"/>',
  pause: '<path d="M9 5v14M15 5v14"/>',
  trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
  menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
  cart: '<path d="M3 4h2l2.4 11h10.2L20 7H6.2"/><circle cx="9" cy="19.5" r="1.5"/><circle cx="17" cy="19.5" r="1.5"/>',
  cash: '<rect x="3" y="6" width="18" height="12" rx="2"/><circle cx="12" cy="12" r="2.5"/>',
  chart: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
  box: '<path d="M3 7l9-4 9 4-9 4-9-4zM3 7v10l9 4 9-4V7M12 11v10"/>',
  bell: '<path d="M6 16V11a6 6 0 1 1 12 0v5l2 2H4l2-2zM10 21h4"/>',
  wifi: '<path d="M2 9a15 15 0 0 1 20 0M5 12.5a10 10 0 0 1 14 0M8.5 16a5 5 0 0 1 7 0"/><circle cx="12" cy="19.5" r="1"/>',
  minus: '<path d="M5 12h14"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  print: '<path d="M7 9V3h10v6M7 17H4v-7h16v7h-3M7 14h10v7H7z"/>',
};
const icon = (n, s = 20) =>
  `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICON[n]}</svg>`;
const kbd = (k) => `<kbd>${k}</kbd>`;

const BASE_CSS = `
*{box-sizing:border-box}
html{-webkit-text-size-adjust:100%}
body{margin:0;background:var(--bg);color:var(--ink);font-family:var(--font-ui);font-size:15px;line-height:1.4;font-feature-settings:"tnum" 1,"lnum" 1}
button,input{font:inherit;color:inherit}
button{cursor:pointer}
:focus-visible{outline:3px solid var(--focus);outline-offset:2px}
.num{font-family:var(--font-num);font-variant-numeric:tabular-nums lining-nums;white-space:nowrap}
.muted{color:var(--muted)}
h1,h2,h3{font-family:var(--font-head);margin:0;line-height:1.15}
kbd{font-family:var(--font-num);font-size:12px;font-weight:700;min-width:30px;padding:3px 6px;border-radius:var(--r-s);border:1px solid currentColor;display:inline-flex;justify-content:center;opacity:.9}
.app{display:grid;grid-template-columns:76px 1fr;min-height:100vh}
.rail{background:var(--surface);border-right:1px solid var(--line);display:flex;flex-direction:column;align-items:center;gap:4px;padding:12px 0}
.rail .logo{width:44px;height:44px;border-radius:var(--r-m);background:var(--primary);color:var(--on-primary);display:grid;place-items:center;font-weight:800;font-size:18px;margin-bottom:12px}
.rail a{width:64px;min-height:56px;border-radius:var(--r-m);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;font-size:11.5px;color:var(--muted);text-decoration:none}
.rail a[aria-current]{background:var(--primary-soft);color:var(--primary);font-weight:700}
.top{display:flex;align-items:center;gap:12px;padding:10px 20px;background:var(--surface);border-bottom:1px solid var(--line);min-height:60px}
.top .where{font-weight:700;font-size:16px}
.top .who{margin-left:auto;display:flex;align-items:center;gap:14px;font-size:14px}
.online{display:inline-flex;gap:6px;align-items:center;color:var(--ok);font-weight:600}
.avatar{width:36px;height:36px;border-radius:50%;background:var(--primary-soft);color:var(--primary);display:grid;place-items:center;font-weight:800}
.menu-btn{display:none;width:44px;height:44px;border:0;background:none;border-radius:var(--r-s)}
.btn{min-height:48px;padding:0 18px;border-radius:var(--r-m);border:1px solid var(--line);background:var(--surface);display:inline-flex;align-items:center;gap:10px;font-weight:700;font-size:15px}
.btn.primary{background:var(--primary);color:var(--on-primary);border-color:transparent}
.btn.cobrar{background:var(--cobrar);color:var(--on-cobrar);border-color:transparent}
.btn.ghost{background:transparent}
/* ── Caja ── */
.pos{display:grid;grid-template-columns:1fr 410px;min-height:calc(100vh - 60px)}
.catalog{padding:18px 20px;min-width:0}
.search{display:flex;align-items:center;gap:10px;height:56px;padding:0 14px;border:2px solid var(--line);border-radius:var(--r-m);background:var(--surface);font-size:17px}
.search span{flex:1;color:var(--muted)}
.chips{display:flex;gap:8px;margin:14px 0;overflow-x:auto}
.chip{min-height:44px;padding:0 16px;border-radius:var(--r-m);border:1px solid var(--line);background:var(--surface);font-weight:600;white-space:nowrap;display:inline-flex;align-items:center;gap:8px}
.chip[aria-pressed=true]{background:var(--ink);color:var(--surface);border-color:var(--ink)}
.chip[aria-pressed=true] .muted{color:inherit}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:12px}
.card{background:var(--surface);border:1px solid var(--line);border-radius:var(--r-m);padding:12px;display:flex;flex-direction:column;gap:6px;min-height:132px;text-align:left}
.card .name{font-weight:700;font-size:15px;line-height:1.25}
.card .meta{display:flex;flex-wrap:wrap;justify-content:space-between;align-items:baseline;gap:2px 8px;margin-top:auto}
.card .price{font-weight:800;font-size:18px}
.card .stock{font-size:13px;color:var(--muted)}
.card .stock.low{color:var(--danger);font-weight:700}
.tag{font-size:12.5px;font-weight:700}
.tag.sup{color:var(--sup)}.tag.maq{color:var(--maq)}.tag.faj{color:var(--faj)}
.cart{background:var(--surface);border-left:1px solid var(--line);display:flex;flex-direction:column}
.cart-head{padding:16px 18px;border-bottom:1px solid var(--line)}
.client{display:flex;align-items:center;gap:12px;width:100%;min-height:52px;padding:8px 12px;border:1px dashed var(--line);border-radius:var(--r-m);background:var(--surface2);text-align:left}
.client b{display:block}.client small{color:var(--muted)}
.client kbd{margin-left:auto}
.lines{flex:1;padding:6px 18px;overflow:auto}
.ln{display:grid;grid-template-columns:1fr auto;gap:4px 12px;padding:12px 0;border-bottom:1px solid var(--line)}
.ln .name{font-weight:700}
.ln .amt{font-weight:800;font-size:17px;text-align:right}
.qty{display:inline-flex;align-items:center;border:1px solid var(--line);border-radius:var(--r-s)}
.qty button{width:44px;height:44px;border:0;background:none;display:grid;place-items:center}
.qty span{min-width:28px;text-align:center;font-weight:700}
.sum{padding:14px 18px;border-top:1px solid var(--line);display:grid;gap:6px}
.sum .row{display:flex;justify-content:space-between}
.total{display:flex;justify-content:space-between;align-items:baseline;gap:12px;padding:14px 18px}
.total .label{font-weight:700;font-size:16px}
.total .value{font-weight:800;font-size:40px;letter-spacing:-.01em}
.actions{padding:0 18px 18px;display:grid;grid-template-columns:1fr 1fr;gap:10px}
.actions .cobrar{grid-column:1/-1;min-height:64px;font-size:20px;justify-content:space-between;padding:0 20px}
.actions .btn{justify-content:center;white-space:nowrap;padding:0 12px}
.mobile-bar{display:none}
/* ── Cierre ── */
.page{padding:20px;max-width:1180px;margin:0 auto}
.page-head{display:flex;flex-wrap:wrap;gap:8px 20px;align-items:flex-end;margin-bottom:16px}
.page-head h1{font-size:28px}
.page-head p{margin:0;color:var(--muted)}
.close{display:grid;grid-template-columns:1.25fr 1fr;gap:16px;align-items:start}
.panel{background:var(--surface);border:1px solid var(--line);border-radius:var(--r-l);padding:18px}
.panel h2{font-size:19px;display:flex;align-items:center;gap:10px;margin-bottom:4px}
.panel > p{margin:0 0 12px;color:var(--muted)}
.step{width:30px;height:30px;border-radius:50%;background:var(--primary);color:var(--on-primary);display:inline-grid;place-items:center;font-size:15px;font-family:var(--font-ui)}
.denoms h3{font-size:14px;color:var(--muted);margin:14px 0 6px;font-family:var(--font-ui);font-weight:700}
.drow{display:grid;grid-template-columns:110px 20px 110px 1fr;align-items:center;gap:6px;padding:4px 0}
.drow .d{font-weight:800;font-size:17px}
.drow input{height:48px;width:100%;border:2px solid var(--line);border-radius:var(--r-s);background:var(--surface2);text-align:center;font-size:18px;font-weight:700;font-family:var(--font-num)}
.drow .t{text-align:right;font-weight:600}
.subtotal{display:flex;justify-content:space-between;align-items:baseline;margin-top:12px;padding-top:12px;border-top:2px solid var(--ink)}
.subtotal b{font-size:26px}
.field{display:grid;gap:6px;margin-top:12px}
.field label{font-weight:700}
.field input{height:52px;border:2px solid var(--line);border-radius:var(--r-s);background:var(--surface2);padding:0 12px;font-size:19px;font-weight:700;font-family:var(--font-num)}
.field small{color:var(--muted)}
.note{background:var(--surface2);border-radius:var(--r-m);padding:12px;margin:0}
.confirm{display:flex;gap:12px;align-items:flex-start;margin:14px 0;font-weight:600}
.confirm .box{flex:none;width:28px;height:28px;border-radius:var(--r-s);background:var(--primary);color:var(--on-primary);display:grid;place-items:center}
.close-btn{width:100%;min-height:60px;justify-content:center;font-size:18px}
/* ── Tablero ── */
.dash{display:grid;grid-template-columns:repeat(12,1fr);gap:16px}
.span-12{grid-column:span 12}.span-8{grid-column:span 8}.span-7{grid-column:span 7}.span-5{grid-column:span 5}.span-4{grid-column:span 4}.span-6{grid-column:span 6}
.hero-figure{font-size:52px;font-weight:800;letter-spacing:-.02em;line-height:1}
.facts{display:flex;flex-wrap:wrap;gap:8px 28px;margin-top:12px}
.facts div{display:grid}.facts b{font-size:20px}
.stack{display:flex;height:22px;border-radius:var(--r-s);overflow:hidden;margin:12px 0}
.legend{display:grid;gap:10px}
.legend .row{display:grid;grid-template-columns:14px 1fr auto;gap:10px;align-items:center}
.legend .sw{width:14px;height:14px;border-radius:3px}
.legend .amt{font-weight:800;font-size:17px}
.bars{display:grid;gap:12px}
.bar{display:grid;grid-template-columns:96px 1fr 104px;gap:10px;align-items:center}
.bar .track{height:14px;background:var(--surface2);border-radius:var(--r-s);overflow:hidden}
.bar .fill{height:100%;background:var(--primary)}
.bar .amt{text-align:right;font-weight:700}
.alerts{list-style:none;margin:0;padding:0;display:grid;gap:10px}
.alerts li{display:grid;grid-template-columns:1fr auto;gap:4px 12px;align-items:center;padding:12px;border-radius:var(--r-m);background:var(--surface2);border-left:4px solid var(--warn)}
.alerts li.danger{border-left-color:var(--danger)}
.alerts b{display:block}
.alerts small{color:var(--muted)}
.alerts .btn{min-height:44px;padding:0 14px;font-size:14px}
.hours{display:flex;align-items:flex-end;gap:8px;height:150px;padding-top:8px}
.hours div{flex:1;display:flex;flex-direction:column;align-items:center;gap:6px;height:100%;justify-content:flex-end;font-size:12.5px;color:var(--muted)}
.hours i{display:block;width:100%;background:var(--primary);border-radius:var(--r-s) var(--r-s) 0 0}
@media (max-width:900px){
  .app{grid-template-columns:1fr}
  .rail{display:none}
  .menu-btn{display:grid;place-items:center}
  .top{padding:8px 12px;gap:8px}
  .top .who .name,.top .who .reg{display:none}
  .pos{grid-template-columns:1fr}
  .catalog{padding:12px 16px 120px}
  .cart{display:none}
  .grid{grid-template-columns:1fr;gap:8px}
  .card{min-height:0;display:grid;grid-template-columns:1fr auto;gap:2px 12px;padding:12px}
  .card .meta{display:contents}
  .card .price{grid-column:2;grid-row:1/3;align-self:center;font-size:18px}
  .card .stock{grid-column:1}
  .card .tag{grid-column:1;order:-1}
  .mobile-bar{display:flex;position:fixed;left:0;right:0;bottom:0;gap:10px;padding:10px 16px calc(10px + env(safe-area-inset-bottom));background:var(--surface);border-top:1px solid var(--line);align-items:center}
  .mobile-bar .see{min-height:56px;flex:1;justify-content:space-between;flex-direction:column;align-items:flex-start;gap:0;padding:6px 12px}
  .mobile-bar .see small{font-weight:600;color:var(--muted);font-size:13px}
  .mobile-bar .see .num{font-size:22px}
  .mobile-bar .cobrar{min-height:56px;font-size:18px}
  .page{padding:14px 16px 24px}
  .page-head h1{font-size:24px}
  .close{grid-template-columns:1fr}
  .drow{grid-template-columns:92px 14px 1fr 96px}
  .dash{grid-template-columns:1fr}
  .dash > *{grid-column:1/-1;min-width:0}
  .hero-figure{font-size:42px}
  .bar{grid-template-columns:80px 1fr 92px}
  .alerts li{grid-template-columns:1fr}
  .alerts .btn{justify-self:start}
}
`;

// CSS propio de cada dirección: aquí vive su carácter.
const DIR_CSS = {
  a: `
  /* Mostrador: la pantalla se porta como la caja registradora. */
  kbd{background:var(--surface);color:var(--ink);border:1px solid var(--line);border-bottom-width:3px;opacity:1}
  .btn.cobrar kbd,.btn.primary kbd{background:transparent;color:inherit;border-color:currentColor}
  .register{background:var(--display);color:var(--on-display);padding:14px 18px;display:grid;gap:2px}
  .register .label{color:var(--display-muted);font-weight:600;font-size:14px}
  .register .value{font-family:var(--font-num);font-size:44px;font-weight:700;letter-spacing:-.02em}
  .register .sub{display:flex;justify-content:space-between;color:var(--display-muted);font-size:13.5px}
  .total{display:none}
  .card{border-bottom-width:3px}
  .card .sku{font-family:var(--font-num);font-size:12.5px;color:var(--muted)}
  .grid{grid-template-columns:repeat(auto-fill,minmax(176px,1fr))}
  .chip[aria-pressed=true]{background:var(--primary);border-color:var(--primary);color:var(--on-primary)}
  .drow .d{font-family:var(--font-num)}
  .hero .register{border-radius:var(--r-l)}
  .hero .register .value{font-size:56px}
  @media (max-width:900px){.hero .register .value{font-size:34px}.mobile-bar .see{background:var(--display);color:var(--on-display);border-color:transparent}.mobile-bar .see small{color:var(--display-muted)}}
  `,
  b: `
  /* Tocador: mostrador de belleza; cada línea tiene su pigmento. */
  .top{border-bottom:0;background:var(--bg)}
  .rail{border-right:0;background:var(--bg)}
  .rail .logo{border-radius:50%;font-family:var(--font-head);font-weight:400}
  .rail a[aria-current]{border-radius:999px}
  .catalog,.cart{background:transparent}
  .cart{margin:8px 16px 8px 0;border:0;border-radius:var(--r-l);background:var(--surface);box-shadow:0 1px 0 var(--line),0 12px 32px -18px rgba(43,22,48,.35)}
  .search,.chip,.btn{border-radius:999px}
  .search{border-width:1px;background:var(--surface)}
  .chip .dot{width:12px;height:12px;border-radius:50%}
  .card{border:0;box-shadow:0 1px 0 var(--line);padding:14px;flex-direction:column}
  .card .swatch{width:40px;height:40px;border-radius:50%;margin-bottom:4px}
  .swatch.sup,.dot.sup{background:var(--sup)}.swatch.maq,.dot.maq{background:var(--maq)}.swatch.faj,.dot.faj{background:var(--faj)}
  .client{border-style:solid;border-radius:999px}
  .total{padding:10px 18px}.total .label{white-space:nowrap}
  .total .value{font-family:var(--font-head);font-weight:400;font-size:38px}
  .card .swatch{width:28px;height:28px}
  .page-head h1,.panel h2{font-weight:400}
  .panel{border:0;box-shadow:0 1px 0 var(--line)}
  .hero-figure{font-family:var(--font-head);font-weight:400}
  .drow input,.field input{border-width:1px;border-radius:12px}
  .step{background:var(--primary-soft);color:var(--primary);font-weight:800}
  @media (max-width:900px){.card{display:grid;grid-template-columns:28px 1fr auto}.card .swatch{grid-row:1/4;margin:0}.card .tag,.card .name,.card .stock{grid-column:2}.card .price{grid-column:3;grid-row:1/4}}
  `,
  c: `
  /* Tres líneas: el color dice de qué línea es cada cosa; números condensados. */
  body{font-size:15.5px}
  .top{background:var(--display);color:var(--on-display);border-bottom:0}
  .top .online{color:var(--on-display)}
  .top .muted{color:var(--display-muted)}
  .top .avatar{background:var(--on-display);color:var(--display)}
  .rail{background:var(--display);border-right:0}
  .rail .logo{background:var(--on-display);color:var(--display)}
  .rail a{color:var(--display-muted)}
  .rail a[aria-current]{background:rgba(255,255,255,.12);color:var(--on-display)}
  .menu-btn{color:var(--on-display)}
  .card{border-left:6px solid var(--line)}
  .card.sup,.ln.sup{border-left-color:var(--sup)}.card.maq,.ln.maq{border-left-color:var(--maq)}.card.faj,.ln.faj{border-left-color:var(--faj)}
  .ln{border-left:5px solid transparent;padding-left:10px}
  .chip{border-radius:var(--r-s);text-transform:none}
  .chip .dot{width:10px;height:22px;border-radius:2px}
  .dot.sup{background:var(--sup)}.dot.maq{background:var(--maq)}.dot.faj{background:var(--faj)}
  .chip[aria-pressed=true]{background:var(--ink)}
  .card .price,.ln .amt,.total .value,.hero-figure,.subtotal b,.facts b,.legend .amt{font-family:var(--font-num);font-weight:700}
  .total .value{font-size:46px}
  .page-head h1,.panel h2{text-transform:none;font-weight:700}
  .search{border-width:2px;border-color:var(--ink)}
  `,
};

function shell(d, theme, title, body) {
  const fontsUrl = `https://fonts.googleapis.com/css2?${d.fonts}&display=swap`;
  return `<!doctype html>
<html lang="es" data-theme="${theme}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title} · ${d.name}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="${fontsUrl}" rel="stylesheet">
<style>
:root{--font-ui:${d.ui};--font-num:${d.num};--font-head:${d.head};--r-s:${d.radius[0]};--r-m:${d.radius[1]};--r-l:${d.radius[2]};${vars(d.light)}color-scheme:light}
@media (prefers-color-scheme:dark){:root:not([data-theme="light"]){${vars(d.dark)}color-scheme:dark}}
:root[data-theme="dark"]{${vars(d.dark)}color-scheme:dark}
${BASE_CSS}
${DIR_CSS[d.key]}
</style>
</head>
<body>
${body}
</body>
</html>`;
}

function rail(active) {
  const items = [
    ["cart", "Vender"],
    ["cash", "Caja"],
    ["box", "Mercancía"],
    ["chart", "Tablero"],
    ["bell", "Alertas"],
  ];
  return `<nav class="rail" aria-label="Menú"><div class="logo">n</div>${items
    .map(
      ([i, l]) =>
        `<a href="#"${l === active ? ' aria-current="page"' : ""}>${icon(i, 22)}${l}</a>`,
    )
    .join("")}</nav>`;
}
function topbar(d, where) {
  return `<header class="top"><button class="menu-btn" aria-label="Abrir menú">${icon("menu", 24)}</button>
<span class="where">${where}</span>
<div class="who"><span class="online">${icon("wifi", 18)}<span class="reg">En línea</span></span>
<span class="reg muted">Tienda · Caja 1</span><span class="name">Lizbeth</span><span class="avatar">L</span></div></header>`;
}

function posScreen(d) {
  const k = d.key;
  const chips = [
    ["all", "Todo", 128],
    ["sup", "Suplementos", 54],
    ["maq", "Maquillaje", 41],
    ["faj", "Fajas", 33],
  ]
    .map(
      ([key, l, n], i) =>
        `<button class="chip" aria-pressed="${i === 0}">${key !== "all" && k !== "a" ? `<span class="dot ${key}"></span>` : ""}${l} <span class="muted num">${n}</span></button>`,
    )
    .join("");
  const cards = PRODUCTS.map(
    (p) => `<button class="card ${p.line}">
${k === "b" ? `<span class="swatch ${p.line}"></span>` : ""}
<span class="tag ${p.line}">${LINES[p.line]}${k === "a" ? ` <span class="sku">· ${p.sku}</span>` : ""}</span>
<span class="name">${p.name}</span>
<span class="meta"><span class="price num">${fmt(p.price)}</span><span class="stock${p.stock <= 3 ? " low" : ""}">${p.stock <= 3 ? "Quedan " + p.stock : p.stock + " en tienda"}</span></span>
</button>`,
  ).join("");
  const lines = CART.map(
    (
      l,
    ) => `<div class="ln ${l.line}"><span class="name">${l.name}</span><span class="amt num">${fmt(l.price * l.qty)}</span>
<span class="qty"><button aria-label="Quitar uno">${icon("minus", 18)}</button><span class="num">${l.qty}</span><button aria-label="Agregar uno">${icon("plus", 18)}</button></span>
<span class="muted num" style="text-align:right;align-self:center">${fmt(l.price)} c/u</span></div>`,
  ).join("");
  const register = `<div class="register" role="status"><span class="label">Total a cobrar · 3 artículos</span><span class="value">${fmt(TOTAL, true)}</span><span class="sub"><span>ITBIS incluido</span><span class="num">${fmt(ITBIS, true)}</span></span></div>`;
  const body = `<div class="app">${rail("Vender")}<div>${topbar(d, "Vender")}
<main class="pos"><section class="catalog" aria-label="Catálogo">
<div class="search">${icon("search", 22)}<span>Código, nombre o escanea</span>${kbd("F2")}</div>
<div class="chips">${chips}</div>
<div class="grid">${cards}</div></section>
<aside class="cart" aria-label="Venta actual">
<div class="cart-head"><button class="client">${icon("user", 22)}<span><b>Consumidor final</b><small>Elegir cliente</small></span>${kbd("F4")}</button></div>
<div class="lines cart-items">${lines}</div>
${k === "a" ? register : `<div class="sum"><div class="row muted"><span>Subtotal</span><span class="num">${fmt(TOTAL, true)}</span></div><div class="row muted"><span>ITBIS incluido</span><span class="num">${fmt(ITBIS, true)}</span></div></div>`}
<div class="total"><span class="label">Total a cobrar</span><span class="value num">${fmt(TOTAL, true)}</span></div>
<div class="actions"><button class="btn cobrar">Cobrar <span class="num">${fmt(TOTAL, true)}</span>${kbd("F12")}</button>
<button class="btn">${icon("pause")}En espera ${kbd("F8")}</button><button class="btn ghost">${icon("trash")}Limpiar</button></div>
</aside></main></div></div>
<div class="mobile-bar"><button class="btn see"><small>Ver venta · 3 artículos</small><span class="num">${fmt(TOTAL, true)}</span></button><button class="btn cobrar">Cobrar ${kbd("F12")}</button></div>`;
  return body;
}

function closeScreen(d) {
  const row = (v) => {
    const q = COUNT[v];
    return `<label class="drow"><span class="d num">${fmt(v)}</span><span class="muted" aria-hidden="true">×</span><input aria-label="Cantidad de ${v}" inputmode="numeric" value="${q || ""}" placeholder="0"><span class="t num">${q ? fmt(v * q) : "—"}</span></label>`;
  };
  const card = 7600,
    delivered = CASH - 2000;
  return `<div class="app">${rail("Caja")}<div>${topbar(d, "Cerrar caja")}
<main class="page"><div class="page-head"><h1>Cerrar caja</h1><p>Lizbeth · Caja 1 · abierta hoy a las 9:02 a.m.</p></div>
<div class="close">
<section class="panel denoms"><h2><span class="step">1</span>Cuenta el efectivo</h2><p>Escribe cuántos billetes y monedas hay de cada uno. Lo vacío cuenta como cero.</p>
<h3>Billetes</h3>${BILLS.map(row).join("")}
<h3>Monedas</h3>${COINS.map(row).join("")}
<div class="subtotal"><span>Efectivo contado</span><b class="num">${fmt(CASH, true)}</b></div></section>
<div style="display:grid;gap:16px">
<section class="panel"><h2><span class="step">2</span>Tarjeta</h2><p>Cierra primero el lote del verifón y copia lo que imprimió.</p>
<div class="field"><label for="card">Total del lote</label><input id="card" class="num" value="${card.toLocaleString("en-US")}.00"></div>
<div class="field"><label for="lote">Número de lote</label><input id="lote" class="num" value="000347"><small>Obligatorio si hubo cobros con tarjeta.</small></div></section>
<section class="panel"><h2><span class="step">3</span>Transferencias</h2><p class="note">No las cuentas tú: el sistema las suma y la dueña las verifica en el banco.</p></section>
<section class="panel"><h2><span class="step">4</span>Entrega</h2>
<div class="field"><label for="ent">Efectivo que entregas a la dueña</label><input id="ent" class="num" value="${delivered.toLocaleString("en-US")}.00"></div>
<div class="subtotal" style="border-top-width:1px"><span>Se queda en caja para mañana</span><b class="num" style="font-size:20px">${fmt(2000, true)}</b></div>
<div class="confirm"><span class="box">${icon("check", 18)}</span><span>Conté el efectivo y copié el lote de tarjeta.</span></div>
<button class="btn primary close-btn">${icon("print")}Cerrar caja e imprimir cuadre</button></section>
</div></div></main></div></div>`;
}

function dashScreen(d) {
  const k = d.key;
  const payColor = {
    efectivo: "var(--cobrar)",
    tarjeta: k === "b" ? "var(--faj)" : "var(--sup)",
    transfer: k === "b" ? "var(--maq)" : "var(--primary)",
  };
  if (k === "c") payColor.transfer = "var(--maq)";
  const max = Math.max(...HOURS.map((h) => h[1]));
  const hero =
    k === "a"
      ? `<div class="register"><span class="label">Ventas de hoy · 23 facturas</span><span class="value">${fmt(DAY, true)}</span><span class="sub"><span>Ayer a esta hora RD$ 41,900</span><span>+15 %</span></span></div>`
      : `<div class="hero-figure num">${fmt(DAY)}</div><p class="muted" style="margin:6px 0 0">Ventas de hoy, 23 facturas. Ayer a esta hora: RD$ 41,900 (+15 %).</p>`;
  return `<div class="app">${rail("Tablero")}<div>${topbar(d, "Tablero")}
<main class="page"><div class="page-head"><h1>Hoy, lunes 26 de octubre</h1><p>Grupo MacGen · Tienda · actualizado 6:40 p.m.</p></div>
<div class="dash">
<section class="panel span-7 hero"><h2 style="margin-bottom:12px">Ventas del día</h2>${hero}
<div class="facts"><div><span class="muted">Ticket promedio</span><b class="num">${fmt(2102)}</b></div><div><span class="muted">Artículos</span><b class="num">61</b></div><div><span class="muted">Devoluciones</span><b class="num">${fmt(0)}</b></div></div></section>
<section class="panel span-5"><h2>Forma de pago</h2>
<div class="stack" role="img" aria-label="Efectivo 44 %, tarjeta 32 %, transferencia 24 %">${PAY.map((p) => `<span style="width:${(p.amount / DAY) * 100}%;background:${payColor[p.key]}"></span>`).join("")}</div>
<div class="legend">${PAY.map((p) => `<div class="row"><span class="sw" style="background:${payColor[p.key]}"></span><span>${p.label} <span class="muted">· ${p.n} cobros${p.key === "transfer" ? ", 3 por verificar" : ""}</span></span><span class="amt num">${fmt(p.amount)}</span></div>`).join("")}</div></section>
<section class="panel span-7"><h2 style="margin-bottom:12px">Un poco de atención</h2><ul class="alerts">
<li class="danger"><span><b>Transferencias por verificar: 3</b><small>RD$ 7,350 · Lizbeth FS-0000212, Wendy FS-0000219 y FS-0000221</small></span><button class="btn">Verificar</button></li>
<li><span><b>Corset Génesis talla L: queda 1 en tienda</b><small>Fajas · en casa hay 2</small></span><button class="btn">Traspasar</button></li>
<li><span><b>Too Faced Born This Way corrector: quedan 2</b><small>Maquillaje · se vendieron 4 esta semana</small></span><button class="btn">Pedir</button></li>
<li><span><b>La caja de Wendy sigue abierta desde ayer</b><small>Caja 2 · abierta el domingo 25 a las 9:10 a.m.</small></span><button class="btn">Ver caja</button></li>
</ul></section>
<section class="panel span-5"><h2 style="margin-bottom:12px">Por cajera</h2><div class="bars">${CASHIERS.map((c) => `<div class="bar"><span>${c.name}</span><span class="track"><span class="fill" style="display:block;width:${(c.amount / CASHIERS[0].amount) * 100}%"></span></span><span class="amt num">${fmt(c.amount)}</span></div>`).join("")}</div>
<h2 style="margin:20px 0 12px">Por línea</h2><div class="bars">${BY_LINE.map((b) => `<div class="bar"><span class="tag ${b.line}">${LINES[b.line]}</span><span class="track"><span class="fill" style="display:block;width:${(b.amount / BY_LINE[0].amount) * 100}%;background:var(--${b.line})"></span></span><span class="amt num">${fmt(b.amount)}</span></div>`).join("")}</div></section>
<section class="panel span-12"><h2>Ventas por hora</h2><div class="hours" role="img" aria-label="Ventas por hora: el pico fue a las 4 p.m.">${HOURS.map(([h, v]) => `<div><i style="height:${(v / max) * 100}%"></i>${h}</div>`).join("")}</div></section>
</div></main></div></div>`;
}

// ───────────────────────── Escribir y capturar ─────────────────────────
const SCREENS = [
  ["caja", "Vender", posScreen],
  ["cierre", "Cerrar caja", closeScreen],
  ["tablero", "Tablero", dashScreen],
];
const files = [];
for (const [key, d] of Object.entries(DIRS)) {
  d.key = key;
  for (const [s, title, fn] of SCREENS) {
    const name = `${d.slug}-${s}.html`;
    writeFileSync(join(OUT, name), shell(d, "light", title, fn(d)));
    files.push({ d, s, name });
  }
}
writeFileSync(
  join(OUT, "contraste.json"),
  JSON.stringify(contrastRows, null, 2) + "\n",
);
console.log(
  "HTML listo:",
  files.length,
  "pantallas. Contraste mínimo por tema:",
);
console.table(contrastRows);

if (!process.argv.includes("--sin-png")) {
  // require respeta NODE_PATH (Playwright instalado globalmente o en el repo).
  const { chromium } = createRequire(import.meta.url)("playwright");
  const browser = await chromium.launch();
  const shots = [];
  const fontCache = {};
  for (const f of files) {
    for (const [w, h, tag] of [
      [1366, 768, "1366"],
      [390, 844, "390"],
    ]) {
      const page = await browser.newPage({
        viewport: { width: w, height: h },
        deviceScaleFactor: 1,
      });
      // Las fuentes se bajan con curl (respeta el proxy y su certificado) y se
      // entregan a Chromium, que no confía en el certificado del proxy.
      await page.route(/fonts\.(googleapis|gstatic)\.com/, (route) => {
        const url = route.request().url();
        fontCache[url] ??= execFileSync("curl", [
          "-sfL",
          "-A",
          route.request().headers()["user-agent"],
          url,
        ]);
        route.fulfill({
          body: fontCache[url],
          contentType: url.includes("googleapis") ? "text/css" : "font/woff2",
          headers: { "access-control-allow-origin": "*" },
        });
      });
      await page.goto("file://" + join(OUT, f.name), {
        waitUntil: "networkidle",
      });
      await page.evaluate(() => document.fonts.ready);
      // Autocomprobación: nada desborda a lo ancho (sin scroll horizontal).
      const sw = await page.evaluate(
        () => document.documentElement.scrollWidth,
      );
      if (sw > w) throw new Error(`${f.name} a ${w}px desborda: ${sw}px`);
      const base = f.name.replace(".html", "");
      // La caja se ve tal cual en pantalla; cierre y tablero completos.
      const full = f.s !== "caja";
      const png = join(OUT, `${base}-${tag}.png`);
      await page.screenshot({ path: png, fullPage: full });
      shots.push(png);
      if (f.s === "caja" && tag === "1366") {
        await page.evaluate(
          () => (document.documentElement.dataset.theme = "dark"),
        );
        const dark = join(OUT, `${base}-${tag}-oscuro.png`);
        await page.screenshot({ path: dark });
        shots.push(dark);
      }
      await page.close();
    }
  }
  await browser.close();
  try {
    execFileSync("python3", [
      "-c",
      "import sys\nfrom PIL import Image\nfor p in sys.argv[1:]:\n  im=Image.open(p).convert('RGB')\n  im.quantize(256,method=Image.Quantize.MEDIANCUT,dither=Image.Dither.NONE).save(p,optimize=True)",
      ...shots,
    ]);
  } catch {
    console.warn("Sin Pillow: PNG sin comprimir.");
  }
  for (const p of shots) {
    const kb = statSync(p).size / 1024;
    if (kb > 400) console.warn("PNG grande:", p, kb.toFixed(0), "KB");
  }
  console.log("PNG listos:", shots.length);
}
