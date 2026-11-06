// Presentación móvil: cada tabla del contenido recibe la etiqueta de su columna
// en cada celda (data-label) y la clase table-cards en su contenedor; el CSS de
// ≤ 768 px las muestra como tarjetas. No toca datos ni lógica.
function label(table: HTMLTableElement) {
  const wrap = table.parentElement;
  if (!wrap) return;
  const heads = [...table.querySelectorAll("thead th")].map(
    (th) => th.textContent?.trim() ?? "",
  );
  if (!heads.length) return;
  for (const row of table.querySelectorAll("tbody tr")) {
    const cells = [...row.children] as HTMLElement[];
    if (cells[0]?.hasAttribute("data-label")) continue;
    if (cells.some((c) => c.hasAttribute("colspan"))) continue;
    cells.forEach((c, i) => c.setAttribute("data-label", heads[i] ?? ""));
  }
  wrap.classList.add("table-cards");
}
export function watchTables(root: HTMLElement) {
  const run = () => root.querySelectorAll("table").forEach(label);
  run();
  const observer = new MutationObserver(run);
  observer.observe(root, { childList: true, subtree: true });
  return () => observer.disconnect();
}
