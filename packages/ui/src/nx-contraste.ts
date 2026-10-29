// Razón de contraste WCAG 2.x entre dos colores hex de 6 dígitos.
const HEX = /^#[0-9A-Fa-f]{6}$/;

function luminancia(hex: string): number {
  const valor = parseInt(hex.slice(1), 16);
  const canales = [(valor >> 16) & 255, (valor >> 8) & 255, valor & 255].map(
    (c) => {
      const s = c / 255;
      return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
    },
  );
  return 0.2126 * canales[0] + 0.7152 * canales[1] + 0.0722 * canales[2];
}

export function razonContraste(fg: string, bg: string): number {
  if (!HEX.test(fg) || !HEX.test(bg)) throw new Error("Color inválido");
  const l1 = luminancia(fg);
  const l2 = luminancia(bg);
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
}

// AA: texto normal 4.5 o más; texto grande 3 o más.
export function cumpleAA(
  fg: string,
  bg: string,
  tamano: "normal" | "grande",
): boolean {
  const umbral = tamano === "normal" ? 4.5 : 3;
  return razonContraste(fg, bg) >= umbral;
}
