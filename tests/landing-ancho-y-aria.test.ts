// Revisión de la portada a 375 y 768 px: sin scroll horizontal y con gutter de 1 rem.
// Las etiquetas aria de los botones de plan cambian con el idioma.
import { readFileSync } from "node:fs";
import { expect, it } from "vitest";

const html = readFileSync("apps/web/public/venta/index.html", "utf8");

it("la portada conserva el gutter y el ancho mínimo para 375 px", () => {
  expect(html).toMatch(/width:\s*min\(70rem,\s*calc\(100% - 2rem\)\)/);
  expect(html).toMatch(/body\s*\{\s*min-width:\s*20rem/);
  expect(html).toMatch(/<meta name="viewport" content="width=device-width/);
});

it("las etiquetas aria de los botones de plan tienen su versión en inglés", () => {
  const planes = html.match(/aria-label="Probar gratis el plan [^"]+"/g) ?? [];
  expect(planes).toHaveLength(4);
  for (const plan of planes) {
    const nombre = plan.match(/plan ([^"]+)"/)?.[1];
    expect(html).toContain(`data-aria-es="Probar gratis el plan ${nombre}"`);
    expect(html).toMatch(
      new RegExp(`data-aria-en="Try the ${nombre} plan for free"`),
    );
  }
});
