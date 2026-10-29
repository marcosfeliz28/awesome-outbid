// Solo formato: no valida el dígito verificador. Cédula 000-0000000-0 (11 dígitos), RNC 000-00000-0 (9).
export function formatearCedulaRNC(texto: string): string {
  if (!/^[\d\s-]*$/.test(texto)) return "—";
  const digitos = texto.replace(/\D/g, "");
  if (digitos.length === 11) return `${digitos.slice(0, 3)}-${digitos.slice(3, 10)}-${digitos.slice(10)}`;
  if (digitos.length === 9) return `${digitos.slice(0, 3)}-${digitos.slice(3, 8)}-${digitos.slice(8)}`;
  return "—";
}
