// `crypto.randomUUID` sólo existe en páginas seguras (https o localhost). Cuando
// un celular abre la tienda por la red local con http://192.168.x.x, no está, y
// abrir caja, vender o registrar mercancía fallaban con «crypto.randomUUID is
// not a function». `crypto.getRandomValues` sí está siempre: con él se arma el
// mismo identificador (UUID versión 4).
if (typeof crypto.randomUUID !== "function") {
  crypto.randomUUID = () => {
    const bytes = crypto.getRandomValues(new Uint8Array(16));
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    const hex = [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}` as ReturnType<
      Crypto["randomUUID"]
    >;
  };
}
