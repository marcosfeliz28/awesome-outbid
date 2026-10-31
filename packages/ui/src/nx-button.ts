// Clase CSS del botón según su variante.
export type VarianteBoton =
  "primary" | "pos-charge" | "secondary" | "ghost" | "danger";

export function claseVariante(variante: VarianteBoton): string {
  const validas: readonly string[] = [
    "primary",
    "pos-charge",
    "secondary",
    "ghost",
    "danger",
  ];
  if (!validas.includes(variante)) {
    throw new Error(`La variante debe ser una de: ${validas.join(", ")}`);
  }
  return `nx-button nx-button--${variante}`;
}

// Atributos del botón con estados. Cargando deshabilita y marca aria-busy.
// La altura mínima de 44 px es el objetivo táctil.
export type TamanoBoton = "sm" | "md";

export function atributosBoton({
  variante,
  tamano,
  deshabilitado = false,
  cargando = false,
}: {
  variante: "primary" | "secondary" | "danger" | "ghost";
  tamano: TamanoBoton;
  deshabilitado?: boolean;
  cargando?: boolean;
}) {
  return {
    className: `nx-button nx-button--${variante} nx-button--${tamano}`,
    disabled: deshabilitado || cargando,
    "aria-busy": cargando,
    alturaMinimaPx: 44,
  };
}
