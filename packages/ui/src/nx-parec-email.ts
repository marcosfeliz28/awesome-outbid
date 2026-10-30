// Solo la forma: algo@algo.algo, sin espacios ni dos arrobas. No consulta nada en la red.
const FORMA = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function parecEmail(s: string): boolean {
  return FORMA.test(s);
}
