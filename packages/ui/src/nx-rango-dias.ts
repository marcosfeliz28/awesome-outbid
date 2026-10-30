// Lista de días «aaaa-mm-dd» desde inicio hasta fin, inclusive. Tope de 366 días.
const FORMATO = /^\d{4}-\d{2}-\d{2}$/;
const MAXIMO = 366;

function aFecha(texto: string): Date {
  if (!FORMATO.test(texto)) throw new Error("rangoDeDias: fecha inválida");
  const [a, m, d] = texto.split("-").map(Number);
  const fecha = new Date(Date.UTC(a, m - 1, d));
  if (
    fecha.getUTCFullYear() !== a ||
    fecha.getUTCMonth() !== m - 1 ||
    fecha.getUTCDate() !== d
  )
    throw new Error("rangoDeDias: fecha inválida");
  return fecha;
}

export function rangoDeDias(inicio: string, fin: string): string[] {
  const desde = aFecha(inicio);
  const hasta = aFecha(fin);
  if (desde > hasta) throw new Error("rangoDeDias: inicio posterior a fin");
  const dias: string[] = [];
  for (let t = desde.getTime(); t <= hasta.getTime(); t += 86_400_000) {
    dias.push(new Date(t).toISOString().slice(0, 10));
    if (dias.length > MAXIMO) throw new Error("rangoDeDias: máximo 366 días");
  }
  return dias;
}
