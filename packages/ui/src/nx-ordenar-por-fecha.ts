// Ordena una copia por fecha; las fechas inválidas, vacías o nulas van al final. Una dirección no válida es «asc».
export function ordenarPorFecha<T>(lista: T[], campo: keyof T, dir: "asc" | "desc"): T[] {
  const ms = (item: T) => {
    const valor = item[campo];
    return valor == null ? NaN : new Date(valor as string | number | Date).getTime();
  };
  const signo = dir === "desc" ? -1 : 1;
  return [...lista].sort((x, y) => {
    const a = ms(x);
    const b = ms(y);
    if (Number.isNaN(a) || Number.isNaN(b)) return Number.isNaN(a) === Number.isNaN(b) ? 0 : Number.isNaN(a) ? 1 : -1;
    return (a - b) * signo;
  });
}
