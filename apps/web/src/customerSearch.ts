// 05-N5: qué cliente elige Enter en el selector de la caja. Antes tomaba el
// primero que contuviera el texto en cualquier parte: «Ana» + Enter elegía a
// «Adriana Torres» y una venta a crédito quedaba a nombre equivocado.

const fold = (text: string) =>
  text.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
const words = (text: string) =>
  fold(text)
    .split(/[\s/,-]+/)
    .filter(Boolean);

/** Cada palabra buscada es el comienzo de alguna palabra del nombre. */
export function startsWithWords(name: string, query: string) {
  const wanted = words(query);
  const have = words(name);
  return (
    wanted.length > 0 && wanted.every((w) => have.some((h) => h.startsWith(w)))
  );
}

type Candidate = { name?: string | null };

/**
 * El cliente que elige Enter, o null si hay que elegir con el ratón o con las
 * flechas: un solo resultado, el único que empieza por lo escrito o, sin
 * texto, «Consumidor final».
 */
export function pickOnEnter<T extends Candidate>(list: T[], query: string) {
  if (list.length === 1) return list[0];
  if (!words(query).length)
    return /^consumidor final$/i.test(String(list[0]?.name ?? "").trim())
      ? list[0]
      : null;
  const starts = list.filter((c) =>
    startsWithWords(String(c.name ?? ""), query),
  );
  return starts.length === 1 ? starts[0] : null;
}
