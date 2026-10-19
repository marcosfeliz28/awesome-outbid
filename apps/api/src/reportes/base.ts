import { Prisma } from "@prisma/client";
import type { Actor } from "../common";

// Los 40 reportes de la dueña (orden 18-oct). Cada grupo vive en su archivo y
// se registra en ./index.ts; reports.ts los sirve en pantalla, Excel y PDF.
export type Range = { gte: Date; lte: Date };
export type Row = Record<string, string | number | null>;
export type ReportDef = {
  title: string;
  group: "Ventas" | "Dinero" | "Margen" | "Inventario" | "Clientes y crédito";
  /** Muestra costo o margen: solo para quien tiene profit:read. */
  margin?: boolean;
  run: (
    db: any,
    actor: Actor,
    range: Range,
    query: Record<string, string>,
  ) => Promise<Row[]>;
};

// Igual que en reports.ts: los DateTime de Prisma son UTC sin zona.
export const utc = (date: Date) =>
  Prisma.sql`(${date}::timestamptz AT TIME ZONE 'UTC')`;
// Día, hora y mes de negocio (Santo Domingo) de una columna UTC.
export const local = (column: Prisma.Sql) =>
  Prisma.sql`((${column} AT TIME ZONE 'UTC') AT TIME ZONE 'America/Santo_Domingo')`;
export const num = (v: unknown) => Math.round(Number(v ?? 0) * 100) / 100;
export const pct = (part: unknown, whole: unknown) =>
  Number(whole) ? Math.round((Number(part) / Number(whole)) * 1000) / 10 : 0;
