import { BUSINESS_TIME_ZONE } from "@fitstore/shared";

// La zona la devuelve /settings desde Tenant; no se toma del dispositivo.
// Caché pequeña para no reconstruir el validador por cada fila de una tabla.
const validated = new Map<string, string>();

export function businessTimeZone(value: unknown): string {
  if (typeof value !== "string" || !value.trim()) return BUSINESS_TIME_ZONE;
  const cached = validated.get(value);
  if (cached) return cached;
  let zone = BUSINESS_TIME_ZONE;
  try {
    new Intl.DateTimeFormat("es-DO", { timeZone: value });
    zone = value;
  } catch {
    // Ajustes anteriores o una zona inválida: conservar la zona de la tienda.
  }
  validated.set(value, zone);
  return zone;
}

export function formatBusinessDateTime(
  value: string | number | Date,
  timeZone: unknown,
  options: Intl.DateTimeFormatOptions = { dateStyle: "short", timeStyle: "short" },
): string {
  return new Intl.DateTimeFormat("es-DO", {
    ...options,
    timeZone: businessTimeZone(timeZone),
  }).format(new Date(value));
}

export function formatBusinessDate(value: string | number | Date, timeZone: unknown): string {
  return new Intl.DateTimeFormat("es-DO", {
    day: "2-digit", month: "2-digit", year: "numeric",
    timeZone: businessTimeZone(timeZone),
  }).format(new Date(value));
}
