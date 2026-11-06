// Formato de importes en pesos dominicanos: «RD$ 1,234.50».
// No oculta importes: la caja ciega la aplica el servidor (B-01), no este componente.
export function formatDOP(valor: number): string {
  if (!Number.isFinite(valor)) throw new Error("Importe no finito");
  const partes = Math.abs(valor).toFixed(2).split(".");
  const entero = partes[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  const signo = valor < 0 ? "-" : "";
  return `${signo}RD$ ${entero}.${partes[1]}`;
}
