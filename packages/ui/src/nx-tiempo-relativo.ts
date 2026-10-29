// Texto relativo de una fecha: menos de un minuto, minutos pasados o minutos futuros.
export function tiempoRelativo(
  desde: Date,
  ahora: Date,
  idioma: "es" | "en",
): string {
  const minutos = Math.floor((ahora.getTime() - desde.getTime()) / 60000);
  if (minutos < 1 && minutos > -1)
    return idioma === "es" ? "ahora mismo" : "just now";
  if (minutos > 0)
    return idioma === "es" ? `hace ${minutos} min` : `${minutos} min ago`;
  const n = -minutos;
  return idioma === "es" ? `en ${n} min` : `in ${n} min`;
}
