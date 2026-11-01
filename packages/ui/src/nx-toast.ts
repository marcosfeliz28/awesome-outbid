// Aviso emergente. Los errores no se cierran solos.
export type TipoToast = "exito" | "aviso" | "error";

export function atributosToast(tipo: TipoToast) {
  if (tipo === "error") return { role: "alert", duracionMs: null };
  return { role: "status", duracionMs: 4000 };
}
