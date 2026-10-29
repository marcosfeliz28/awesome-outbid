export interface TelefonoValidado {
  valido: boolean;
  normalizado: string;
}

const AREAS = new Set(["809", "829", "849"]);
const INVALIDO: TelefonoValidado = { valido: false, normalizado: "" };

// Solo valida la forma (809/829/849 + 7 dígitos; acepta +1 o 1 delante); no consulta nada.
export function validarTelefono(
  entrada: string | null | undefined,
): TelefonoValidado {
  if (!entrada) return INVALIDO;
  if (/[^\d\s().+-]/.test(entrada)) return INVALIDO;
  let digitos = entrada.replace(/\D/g, "");
  if (digitos.length === 11 && digitos.startsWith("1"))
    digitos = digitos.slice(1);
  if (digitos.length !== 10 || !AREAS.has(digitos.slice(0, 3))) return INVALIDO;
  return { valido: true, normalizado: digitos };
}
