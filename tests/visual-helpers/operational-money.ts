import { expect, type Page } from "@playwright/test";
/** Call on each real fixture page, at 1440/390, ES/EN and light/dark.
 * Fixtures must include a long amount (e.g. RD$ 98,765,432.17).
 * This is an assertion helper, not evidence that browser QA has run.
 */
export async function assertOperationalMoney(page: Page) {
  const metrics = await page
    .locator(".operational-aux-money")
    .evaluateAll((nodes) =>
      nodes.map((node) => {
        const range = document.createRange();
        range.selectNodeContents(node);
        const rects = Array.from(range.getClientRects()).filter(
          (rect) => rect.width > 0,
        );
        const style = getComputedStyle(node);
        return {
          text: node.textContent,
          lines: new Set(rects.map((rect) => Math.round(rect.top))).size,
          client: node.clientWidth,
          scroll: node.scrollWidth,
          overflow: style.overflowX,
          whiteSpace: style.whiteSpace,
        };
      }),
    );
  expect(metrics.length).toBeGreaterThan(0);
  for (const amount of metrics) {
    expect(amount.lines, amount.text || "importe").toBe(1);
    expect(amount.whiteSpace).toBe("nowrap");
    expect(amount.client).toBeGreaterThan(0);
    if (amount.scroll > amount.client + 1) expect(amount.overflow).toBe("auto");
  }
}
