// Pliega acentos y mayúsculas; la ñ queda como n. Se compara por caracteres, sin regex.
const plegar = (s: string) => s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();

export function resaltarCoincidencia(
  texto: string,
  busqueda: string,
): { texto: string; coincide: boolean }[] {
  const trozos = [...texto];
  const plegados = trozos.map(plegar);
  const unido = plegados.join("");
  const aguja = plegar(busqueda);
  const marcado = trozos.map(() => false);
  if (aguja) {
    for (let pos = unido.indexOf(aguja); pos !== -1; pos = unido.indexOf(aguja, pos + aguja.length)) {
      let inicio = 0;
      trozos.forEach((_, i) => {
        const fin = inicio + plegados[i].length;
        if (fin > pos && inicio < pos + aguja.length) marcado[i] = true;
        inicio = fin;
      });
    }
  }
  const partes: { texto: string; coincide: boolean }[] = [];
  trozos.forEach((trozo, i) => {
    const ultima = partes[partes.length - 1];
    if (ultima && ultima.coincide === marcado[i]) ultima.texto += trozo;
    else partes.push({ texto: trozo, coincide: marcado[i] });
  });
  return partes;
}
