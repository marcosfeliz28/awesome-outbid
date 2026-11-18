import { log } from "node:console";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const source = readFileSync("apps/web/src/Management.tsx", "utf8");
const view = source.slice(
  source.indexOf("export function SalesHistory()"),
  source.indexOf("function TelegramNotices()"),
);
assert.match(view, /className="sales-fusion"/);
assert.match(
  view,
  /Cada venta tiene una historia/,
  "preserves E2E navigation heading",
);
assert.match(view, /Every sale tells a story/, "English heading is translated");
assert.match(
  view,
  /saleMoney\(preview, preview.total\)/,
  "preview keeps blind cash protection",
);
assert.match(view, /aria-pressed=\{previewId === s.id\}/);
assert.match(view, /can\(user.permissions, "sale:manage"\)/);
assert.match(view, /can\(user.permissions, "\*"\)/);
assert.match(view, /queryKey: \["sales", search.trim\(\), saleDate\]/);
assert.match(view, /!query.isPending && !query.isError/);
const css = readFileSync("apps/web/src/fusion-ventas.css", "utf8");
assert.match(css, /prefers-reduced-motion/);
assert.match(css, /focus-visible/);
assert.match(css, /max-width: 540px/);
const summary = readFileSync("apps/web/src/SalesFusion.tsx", "utf8");
assert.match(summary, /Results loaded/);
assert.doesNotMatch(summary, /24000|DEMO-001/);
assert.match(css, /max-width: 1600px/);
assert.match(css, /position: sticky/);
assert.match(css, /--primary: var\(--sv-accent\)/);
assert.match(summary, /\{number\s*\? en/);
assert.match(summary, /Venta seleccionada/);
assert.match(summary, /Selected sale/);
assert.match(view, /YOUR BUSINESS, WITH CLARITY/);
assert.match(view, /en-US/);
assert.match(view, /View /);
assert.match(view, /Cash/);
assert.match(view, /Recorded payments/);
assert.match(view, /Courier delivery/);
assert.match(view, /Visible after closing your register\./);
assert.match(view, /Item to return/);
assert.match(view, /Refund method/);
assert.match(view, /english=\{en\}/);
log(
  "PASS: 30 presentation, permissions, blind cash and accessibility contracts",
);
