/* global document, innerWidth, getComputedStyle */
import { chromium } from "@playwright/test";
import { mkdir } from "node:fs/promises";

const output = "docs/diseno/obsidian-lumina/motion/capturas-pc";
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true });
try {
  for (const [name, width, height] of [["desktop", 1440, 900], ["movil", 390, 844]]) {
    for (const reducedMotion of ["no-preference", "reduce"]) {
      const page = await browser.newPage({ viewport: { width, height }, reducedMotion });
      await page.route("**/api/**", (route) => route.fulfill({ status: 503, body: "{}" }));
      await page.goto("http://127.0.0.1:5198/", { waitUntil: "networkidle" });
      await page.locator(".login-vault").waitFor();
      await page.locator(".login-prism-frame img").evaluate((img) => img.decode());
      if (reducedMotion === "reduce") {
        const animation = await page.locator(".login-prism-frame img").evaluate((img) => getComputedStyle(img).animationName);
        if (animation !== "none") throw new Error(`Movimiento reducido: ${animation}`);
      }
      await page.screenshot({ path: `${output}/${name}-${reducedMotion}.png`, fullPage: true, animations: "disabled" });
      const result = await page.evaluate(() => ({
        width: document.documentElement.scrollWidth,
        viewport: innerWidth,
        groups: [...document.querySelectorAll(".login-faces strong")].map((el) => el.textContent),
        videos: document.querySelectorAll("video").length,
      }));
      if (result.width > result.viewport || result.groups.join(",") !== "Vende,Controla,Decide" || result.videos) throw new Error(JSON.stringify(result));
      await page.keyboard.press("Tab");
      const focused = await page.evaluate(() => document.activeElement?.tagName);
      if (!["BUTTON", "INPUT", "A"].includes(focused)) throw new Error(`Foco inesperado: ${focused}`);
      console.log(name, reducedMotion, JSON.stringify(result));
      await page.close();
    }
  }
} finally {
  await browser.close();
}
