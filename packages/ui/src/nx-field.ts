// Etiqueta, ayuda y error de un campo, enlazados con aria-describedby.
export function atributosCampo({
  id,
  ayuda,
  error,
}: {
  id: string;
  ayuda?: string;
  error?: string;
}) {
  const ayudaId = `${id}-ayuda`;
  const errorId = `${id}-error`;
  const describe = [ayuda ? ayudaId : null, error ? errorId : null]
    .filter(Boolean)
    .join(" ");
  return {
    id,
    "aria-describedby": describe === "" ? undefined : describe,
    "aria-invalid": error !== undefined,
    ayudaId,
    errorId,
  };
}
