// «Preguntas» en el punto de venta: respuestas de un toque sin IA y la
// encuesta de la caja. El botón no cambia el resto de la pantalla.
import { test, expect } from "./apoyo";

test("Preguntas: abre el listado, responde y guarda la encuesta", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByLabel("Usuario").fill("admin@fitstore.demo");
  await page
    .getByLabel("Contraseña", { exact: true })
    .fill("FitStore-Demo-2026!");
  await page.getByRole("button", { name: "Entrar a mi tienda" }).click();
  await expect(page.getByRole("heading", { name: /Hola,/ })).toBeVisible();
  await page.evaluate(() => (location.hash = "pos"));
  await page.getByRole("button", { name: "Preguntas rápidas sin IA" }).click();
  await page.getByText("¿Cuántos productos hay a la venta?").click();
  await expect(
    page.getByRole("dialog").getByText("Productos", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Otra pregunta" }).click();
  await page.getByText("Encuesta de la caja (30 preguntas rápidas)").click();
  await page.getByRole("button", { name: "Sí", exact: true }).first().click();
  await page.getByRole("button", { name: "Guardar respuestas" }).click();
  await expect(page.getByText("Tu respuesta quedó guardada")).toBeVisible();
});
