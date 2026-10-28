// Validación de cédula y RNC dominicanos (D22).
//
// Algoritmo del dígito verificador:
// - RNC (9 dígitos): módulo 11 con pesos 7, 9, 8, 6, 5, 4, 3, 2 sobre los
//   primeros 8 dígitos. dv = 11 − (suma mod 11); si dv = 11 → 1, si dv = 10 → 0.
// - Cédula (11 dígitos): módulo 10 con pesos alternados 1, 2 sobre los primeros
//   10 dígitos; cada producto ≥ 10 se reduce restando 9. dv = (10 − suma mod 10) mod 10.
//
// Fuente: reglas públicas de validación de la DGII para el RNC y la cédula.
// Ejemplo verificado: RNC 1-30-22250-9 (pesos 7 9 8 6 5 4 3 2 → suma 79,
// 79 mod 11 = 2, dv = 9). // verificar con contador ante cambios de norma.

const DIGITS_ONLY = /^\d+$/;

/** Dígito verificador de la cédula (módulo 10, pesos 1 y 2 alternados). */
export function checkDigitCedula(body: string): number {
  // body: 10 dígitos.
  let sum = 0;
  for (let i = 0; i < body.length; i++) {
    const product = Number(body[i]) * (i % 2 === 0 ? 1 : 2);
    sum += product >= 10 ? product - 9 : product;
  }
  return (10 - (sum % 10)) % 10;
}

/** Dígito verificador del RNC (módulo 11, pesos 7 9 8 6 5 4 3 2). */
export function checkDigitRnc(body: string): number {
  // body: 8 dígitos.
  const weights = [7, 9, 8, 6, 5, 4, 3, 2];
  let sum = 0;
  for (let i = 0; i < body.length; i++) sum += Number(body[i]) * weights[i];
  const dv = 11 - (sum % 11);
  return dv === 11 ? 1 : dv === 10 ? 0 : dv;
}

/** ¿La cédula (11 dígitos) tiene un dígito verificador válido? */
export function isCedulaValida(value: string): boolean {
  const digits = value.replace(/\D/g, "");
  if (!DIGITS_ONLY.test(digits) || digits.length !== 11) return false;
  return checkDigitCedula(digits.slice(0, 10)) === Number(digits[10]);
}

/** ¿El RNC (9 dígitos) tiene un dígito verificador válido? */
export function isRncValido(value: string): boolean {
  const digits = value.replace(/\D/g, "");
  if (!DIGITS_ONLY.test(digits) || digits.length !== 9) return false;
  return checkDigitRnc(digits.slice(0, 8)) === Number(digits[8]);
}
