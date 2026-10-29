// Debounce: solo se llama a fn cuando pasan «ms» sin nuevas llamadas; usa los últimos argumentos.
export function limitarFrecuencia<A extends unknown[]>(fn: (...args: A) => void, ms: number) {
  let temporizador: ReturnType<typeof setTimeout> | undefined;
  const limitada = (...args: A) => {
    clearTimeout(temporizador);
    temporizador = setTimeout(() => fn(...args), ms);
  };
  limitada.cancelar = () => clearTimeout(temporizador);
  return limitada;
}
