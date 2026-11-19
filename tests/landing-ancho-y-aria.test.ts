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

it("las etiquetas aria de las invitaciones tienen su versión en inglés", () => {
  const planes =
    html.match(/aria-label="Solicitar invitación de 7 días para [^"]+"/g) ?? [];
  expect(planes).toHaveLength(3);
  for (const plan of planes) {
    const nombre = plan.match(/para ([^"]+)"/)?.[1];
    expect(html).toContain(
      `data-aria-es="Solicitar invitación de 7 días para ${nombre}"`,
    );
    expect(html).toMatch(
      new RegExp(`data-aria-en="Request a 7-day invitation for ${nombre}"`),
    );
  }
});

it("publica sólo las condiciones comerciales confirmadas", () => {
  for (const text of [
    "7 días gratis por invitación",
    "Renovación anual: US$39",
    "Medio · 1 sucursal · hasta 5 cajas",
    "Completo · hasta 3 sucursales · hasta 10 cajas",
    "recibo no fiscal",
  ])
    expect(html).toContain(text);
  expect(html).toMatch(/US\$149[\s\S]{0,100}pago único/);
  expect(html).not.toMatch(
    /Autoservicio|Básico|Premium|preguntas de IA|paquetes extra de IA/,
  );
});
