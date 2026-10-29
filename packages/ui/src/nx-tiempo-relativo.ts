// Texto relativo de una fecha: ahora mismo, o minutos / horas / días, pasados o futuros.
export function tiempoRelativo(
  desde: Date,
  ahora: Date,
  idioma: "es" | "en",
): string {
  const minutos = Math.trunc((ahora.getTime() - desde.getTime()) / 60000);
  if (minutos === 0) return idioma === "es" ? "ahora mismo" : "just now";
  const abs = Math.abs(minutos);
  const horas = Math.trunc(abs / 60);
  const [n, unidad] =
    abs < 60
      ? [abs, "min"]
      : horas < 24
        ? [horas, "h"]
        : [Math.trunc(horas / 24), "d"];
  if (minutos > 0)
    return idioma === "es" ? `hace ${n} ${unidad}` : `${n} ${unidad} ago`;
  return idioma === "es" ? `en ${n} ${unidad}` : `in ${n} ${unidad}`;
}
