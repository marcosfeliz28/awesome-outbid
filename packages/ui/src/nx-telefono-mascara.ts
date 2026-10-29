// Muestra solo el área (3 primeros) y los 4 últimos dígitos de un teléfono dominicano: «809-***-4567».
export function enmascararTelefono(texto: string): string {
  let digitos = texto.replace(/\D/g, "");
  if (digitos.length === 11 && digitos.startsWith("1"))
    digitos = digitos.slice(1);
  if (digitos.length !== 10) return "—";
  return `${digitos.slice(0, 3)}-***-${digitos.slice(6)}`;
}
