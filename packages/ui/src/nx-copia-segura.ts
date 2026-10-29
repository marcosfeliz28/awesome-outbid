function copiar(valor: unknown, camino: unknown[]): unknown {
  if (valor === null) return null;
  switch (typeof valor) {
    case "string":
    case "boolean":
      return valor;
    case "number":
      if (!Number.isFinite(valor))
        throw new Error("copiarSinAliasing: número no válido en JSON");
      return valor;
    case "function":
      throw new Error("copiarSinAliasing: no se puede copiar una función");
    case "object": {
      if (!Array.isArray(valor)) {
        const proto = Object.getPrototypeOf(valor);
        if (proto !== Object.prototype && proto !== null)
          throw new Error(
            "copiarSinAliasing: solo JSON simple (objeto no plano)",
          );
      }
      if (camino.includes(valor))
        throw new Error("copiarSinAliasing: la estructura tiene un ciclo");
      const dentro = [...camino, valor];
      if (Array.isArray(valor)) return valor.map((v) => copiar(v, dentro));
      return Object.fromEntries(
        Object.entries(valor as object).map(([k, v]) => [k, copiar(v, dentro)]),
      );
    }
    default:
      throw new Error(
        `copiarSinAliasing: valor no válido en JSON (${typeof valor})`,
      );
  }
}

// Copia profunda de JSON simple; falla claro con funciones, ciclos y valores que JSON no admite.
export function copiarSinAliasing<T>(valor: T): T {
  return copiar(valor, []) as T;
}
