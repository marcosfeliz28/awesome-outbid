// Estado vacío: título, texto y una acción. Se anuncia con role status.
export function atributosVacio({
  titulo,
  texto,
  accion,
}: {
  titulo: string;
  texto: string;
  accion: string;
}) {
  if (titulo.trim() === "")
    throw new Error("El estado vacío necesita un título");
  return { role: "status", titulo, texto, accion };
}
