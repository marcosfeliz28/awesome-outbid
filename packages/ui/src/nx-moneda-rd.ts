// Formato de montos en pesos dominicanos: «RD$ 1,234.50». Negativos llevan el signo antes de RD$.
export function formatearMonedaRD(n: number): string {
  if (!Number.isFinite(n)) return "—";
  const centavos = Math.round(Math.abs(n) * 100);
  const enteros = Math.floor(centavos / 100);
  const decimales = String(centavos % 100).padStart(2, "0");
  const miles = enteros.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  const signo = n < 0 && centavos !== 0 ? "-" : "";
  return `${signo}RD$ ${miles}.${decimales}`;
}
