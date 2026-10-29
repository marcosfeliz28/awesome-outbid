// Formato de pesos dominicanos: «RD$ 1,234.50»; negativos «-RD$ 1,500.00». NaN e infinitos → «—».
export function formatearMonedaRD(n: number): string {
  if (!Number.isFinite(n)) return "—";
  const [entero, decimales] = Math.abs(n).toFixed(2).split(".");
  const conComas = entero.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  const signo = n < 0 && Math.abs(n) >= 0.005 ? "-" : "";
  return `${signo}RD$ ${conComas}.${decimales}`;
}
