/* eslint-disable -- script de grabación del promo (Node CommonJS), fuera de la app */
// node promo.cjs <horizontal|vertical> — graba cuadros reales de la app (modo Impacto)
// con CDP screencast y escribe frames/ + lista.txt para ffmpeg.
const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");
const mode = process.argv[2] || "horizontal";
const V = mode === "vertical";
const out = path.join(__dirname, "promo-" + mode);
fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out + "/frames", { recursive: true });
const BASE = "http://127.0.0.1:4173/";
const vp = V ? { width: 405, height: 720 } : { width: 1920, height: 1080 };
const scale = V ? 1080 / 405 : 1;

const CSS = `
#promo-cap{position:fixed;left:${V ? "50%" : "64px"};bottom:${V ? "64px" : "64px"};z-index:99999;
 transform:${V ? "translateX(-50%)" : "none"};max-width:${V ? "88%" : "70%"};
 padding:${V ? "14px 20px" : "22px 34px"};border-radius:${V ? "16px" : "22px"};
 background:linear-gradient(135deg,#140b2ee6,#0b1022e6);border:1px solid #8b5cf666;
 box-shadow:0 20px 60px #0008,0 0 0 1px #22d3ee22;color:#fff;
 font:700 ${V ? "22px" : "46px"}/1.15 "Plus Jakarta Sans Variable","Plus Jakarta Sans",sans-serif;
 letter-spacing:-.02em;animation:pc-in 420ms cubic-bezier(.16,1,.3,1) both;text-align:${V ? "center" : "left"}}
#promo-cap small{display:block;margin-top:${V ? "6px" : "8px"};font:500 ${V ? "13px" : "24px"}/1.3 "Inter Variable","Inter",sans-serif;color:#c4b5fd;letter-spacing:0}
@keyframes pc-in{from{opacity:0;transform:${V ? "translate(-50%,16px)" : "translateY(16px)"}}}
.promo-card{position:fixed;inset:0;z-index:99998;display:grid;place-content:center;text-align:center;gap:${V ? "14px" : "22px"};
 background:radial-gradient(60% 50% at 30% 30%,#7c3aed55,transparent 70%),radial-gradient(50% 40% at 75% 70%,#22d3ee33,transparent 70%),#05060f;color:#fff;padding:24px}
.promo-card .logo{margin:0 auto;width:${V ? "64px" : "112px"};height:${V ? "64px" : "112px"};border-radius:${V ? "18px" : "30px"};display:grid;place-content:center;
 background:linear-gradient(135deg,#7c3aed,#ec4899);font:800 ${V ? "40px" : "70px"}/1 "Plus Jakarta Sans Variable",sans-serif;box-shadow:0 20px 60px #7c3aed66;animation:pc-pop 700ms cubic-bezier(.16,1,.3,1) both}
.promo-card h1{margin:0;font:800 ${V ? "48px" : "120px"}/1 "Plus Jakarta Sans Variable",sans-serif;letter-spacing:-.04em;animation:pc-up 700ms 120ms cubic-bezier(.16,1,.3,1) both}
.promo-card p{margin:0;font:500 ${V ? "18px" : "38px"}/1.35 "Inter Variable",sans-serif;color:#d8d4ff;animation:pc-up 700ms 260ms cubic-bezier(.16,1,.3,1) both}
.promo-card .chips{display:flex;flex-wrap:wrap;gap:${V ? "8px" : "16px"};justify-content:center;margin-top:${V ? "8px" : "18px"};animation:pc-up 700ms 420ms cubic-bezier(.16,1,.3,1) both}
.promo-card .chips span{padding:${V ? "8px 12px" : "12px 22px"};border-radius:999px;border:1px solid #ffffff33;background:#ffffff10;font:600 ${V ? "13px" : "26px"}/1 "Inter Variable",sans-serif;color:#e9e5ff}
@keyframes pc-up{from{opacity:0;transform:translateY(24px)}}
@keyframes pc-pop{from{opacity:0;transform:scale(.6) rotate(-8deg)}}
`;

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({
    viewport: vp,
    deviceScaleFactor: scale,
    serviceWorkers: "block",
  });
  await ctx.addInitScript(() => {
    localStorage.setItem("norexos-visual", "impacto");
    localStorage.setItem("fitstore-theme", "light");
  });
  const page = await ctx.newPage();
  const cdp = await ctx.newCDPSession(page);
  const frames = []; // {file, t}
  const segments = []; // [start, end]
  let n = 0;
  cdp.on("Page.screencastFrame", async ({ data, metadata, sessionId }) => {
    const file = `frames/${String(n++).padStart(6, "0")}.jpg`;
    fs.writeFileSync(path.join(out, file), Buffer.from(data, "base64"));
    frames.push({ file, t: metadata.timestamp });
    cdp.send("Page.screencastFrameAck", { sessionId }).catch(() => {});
  });
  const W = Math.round(vp.width * scale),
    H = Math.round(vp.height * scale);
  const css = () => page.addStyleTag({ content: CSS }).catch(() => {});
  async function segment(ms, act) {
    await cdp.send("Page.startScreencast", {
      format: "jpeg",
      quality: 92,
      maxWidth: W,
      maxHeight: H,
    });
    const start = Date.now() / 1000;
    const work = act ? act() : Promise.resolve();
    await page.waitForTimeout(ms);
    await work;
    const end = Date.now() / 1000;
    await cdp.send("Page.stopScreencast");
    segments.push([start, end]);
  }
  const caption = (title, sub = "") =>
    page.evaluate(
      ([t, s]) => {
        document.getElementById("promo-cap")?.remove();
        const el = document.createElement("div");
        el.id = "promo-cap";
        el.innerHTML = t + (s ? `<small>${s}</small>` : "");
        document.documentElement.append(el);
      },
      [title, sub],
    );
  const noCaption = () =>
    page.evaluate(() => document.getElementById("promo-cap")?.remove());
  const card = (html) =>
    page.evaluate((h) => {
      document.querySelector(".promo-card")?.remove();
      const el = document.createElement("div");
      el.className = "promo-card";
      el.innerHTML = h;
      document.documentElement.append(el);
    }, html);
  const noCard = () =>
    page.evaluate(() => document.querySelector(".promo-card")?.remove());

  await page.goto(BASE);
  await page.evaluate(() => document.fonts.ready);
  await css();
  // 1. Portada
  await card(
    `<div class="logo">n</div><h1>Norexos</h1><p>Punto de venta e inventario${V ? "<br>" : " "}para tiendas con energía</p>`,
  );
  await page.waitForTimeout(150);
  await segment(3200);
  await noCard();
  // 2. Entrada
  await caption("Entra a tu tienda", "Seguro y en segundos");
  await segment(4200, async () => {
    await page.waitForTimeout(700);
    await page
      .locator(".login-form-panel input")
      .first()
      .pressSequentially("admin@fitstore.demo", { delay: 45 });
    await page
      .locator('input[type="password"]')
      .pressSequentially("FitStore-Demo-2026!", { delay: 30 });
  });
  // 3. Resumen
  await noCaption();
  await page.keyboard.press("Enter");
  await page.waitForSelector(".app-shell");
  await css();
  await page.waitForSelector(".kpi-card");
  await page.evaluate(() => (location.hash = "settings"));
  await page.waitForTimeout(800);
  await caption(
    "Todo tu negocio en una pantalla",
    "Ventas, cajas y alertas al día",
  );
  await segment(4800, async () => {
    if (V) await page.evaluate(() => (location.hash = "dashboard"));
    else await page.locator(".nav-item", { hasText: "Resumen" }).click();
  });
  // 4. Reportes
  if (!V) {
    await caption("Reportes claros", "Cambia de informe con un toque");
    await segment(5200, async () => {
      await page.locator(".nav-item", { hasText: "Reportes" }).click();
      await page.waitForTimeout(1800);
      await page
        .locator(".report-group button:not(.report-group-title)")
        .nth(2)
        .click()
        .catch(() => {});
      await page.waitForTimeout(1200);
      await page
        .locator(".report-group button:not(.report-group-title)")
        .nth(3)
        .click()
        .catch(() => {});
    });
  }
  // 5. Vitrina (demostración) en claro y luego oscuro
  await page.evaluate(() => (location.hash = "inventory"));
  await page.waitForTimeout(900);
  await caption("Lo más vendido, de un vistazo", "Gráficas que se dibujan");
  await segment(4600, async () => {
    await page.evaluate(() => (location.hash = "demo"));
  });
  await caption("Claro u oscuro", "Pensado para el día y la noche");
  await segment(3600, async () => {
    await page.waitForTimeout(300);
    // La captura CDP congela la View Transition del tema: se cambia directo.
    await page.evaluate(() => {
      localStorage.setItem("fitstore-theme", "dark");
      document.documentElement.dataset.theme = "dark";
    });
    await page.waitForTimeout(900);
    await page.mouse.wheel(0, V ? 500 : 400);
  });
  // 6. Celular (solo horizontal: la app real dentro de un marco de teléfono)
  if (!V) {
    await noCaption();
    await page.evaluate(() => {
      const el = document.createElement("div");
      el.className = "promo-card";
      el.style.gridTemplateColumns = "1fr auto";
      el.style.gap = "120px";
      el.style.textAlign = "left";
      el.innerHTML = `<div><h1 style="font-size:96px">También<br>en tu celular</h1><p style="margin-top:24px">La misma tienda, en la palma de la mano.</p></div>
      <div style="width:410px;height:860px;border-radius:56px;padding:12px;background:#111;box-shadow:0 40px 120px #7c3aed55,0 0 0 2px #ffffff22">
      <iframe src="/#demo" style="width:390px;height:836px;border:0;border-radius:46px;background:#fff"></iframe></div>`;
      document.documentElement.append(el);
    });
    await page.waitForTimeout(2500);
    await segment(4800, async () => {
      const f = page.frameLocator("iframe");
      await page.waitForTimeout(1600);
      await page
        .frames()[1]
        ?.evaluate(() => window.scrollBy({ top: 600, behavior: "smooth" }))
        .catch(() => {});
      await f
        .locator("main")
        .first()
        .evaluate((m) => m.scrollBy({ top: 600, behavior: "smooth" }))
        .catch(() => {});
    });
    await noCard();
  }
  // 7. Cierre
  await noCaption();
  await card(
    `<div class="logo">n</div><h1>Norexos</h1><p>Tu negocio, en movimiento.</p><div class="chips"><span>Vende en segundos</span><span>Inventario al día</span><span>Decide con claridad</span></div>`,
  );
  await page.waitForTimeout(100);
  await segment(4000);
  await browser.close();

  // lista para el demuxer concat de ffmpeg: cada cuadro dura hasta el siguiente.
  const lines = [];
  for (const [s, e] of segments) {
    const fs_ = frames.filter((f) => f.t >= s - 0.05 && f.t <= e + 0.05);
    if (!fs_.length) continue;
    fs_.forEach((f, i) => {
      const next = i + 1 < fs_.length ? fs_[i + 1].t : e;
      const d = Math.max(1 / 60, next - Math.max(f.t, s));
      lines.push(`file '${f.file}'`, `duration ${d.toFixed(4)}`);
    });
  }
  lines.push(lines[lines.length - 2]);
  fs.writeFileSync(path.join(out, "lista.txt"), lines.join("\n") + "\n");
  console.log(
    mode,
    "cuadros",
    frames.length,
    "segmentos",
    segments.map(([s, e]) => (e - s).toFixed(1)).join(","),
  );
})();
